from typing import Any
import pandas as pd

from agent.pipeline.state import PipelineState


def clean_node(state: PipelineState, db_path: str | None = None) -> dict[str, Any]:
    """LangGraph node: loads raw data and applies cleaning steps."""
    # Import here to avoid circular imports at module level
    from app.services.db_init import get_query_engine  # noqa: PLC0415

    engine = get_query_engine()
    result = engine.execute_query("SELECT * FROM RIDEBOOKING", return_format="dataframe")

    if not result["success"]:
        return {"clean_df": pd.DataFrame(), "cleaning_log": [f"Failed to load data: {result['error']}"]}

    df: pd.DataFrame = result["data_frame"].copy()
    log: list[str] = []

    # Step 1 — strip surrounding quotes from ID columns (raw CSV artefact: "CNR5884300")
    id_cols = [c for c in ["BOOKING_ID", "CUSTOMER_ID"] if c in df.columns]
    for col in id_cols:
        mask = df[col].str.startswith('"') & df[col].str.endswith('"')
        if mask.any():
            df[col] = df[col].str.strip('"')
            log.append(f"Stripped surrounding quotes from {mask.sum()} values in {col}")

    # Step 2 — replace literal 'null' strings with NaN
    null_str_cols = ["BOOKING_VALUE", "RIDE_DISTANCE"]
    for col in null_str_cols:
        if col in df.columns:
            before = df[col].eq("null").sum()
            df[col] = df[col].replace("null", pd.NA)
            if before:
                log.append(f"Replaced {before} literal 'null' strings in {col} with NaN")

    # Step 3 — cast numeric columns
    numeric_cols = ["BOOKING_VALUE", "RIDE_DISTANCE", "AVG_VTAT", "AVG_CTAT",
                    "DRIVER_RATINGS", "CUSTOMER_RATING",
                    "CANCELLED_RIDES_BY_CUSTOMER", "CANCELLED_RIDES_BY_DRIVER",
                    "INCOMPLETE_RIDES"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    log.append(f"Cast {[c for c in numeric_cols if c in df.columns]} to numeric")

    # Step 4 — strip whitespace from string columns
    str_cols = df.select_dtypes(include="object").columns.tolist()
    for col in str_cols:
        df[col] = df[col].str.strip()
    log.append(f"Stripped whitespace from {len(str_cols)} string columns")

    # Step 5 — drop exact duplicate rows
    before = len(df)
    df = df.drop_duplicates()
    dropped = before - len(df)
    if dropped:
        log.append(f"Dropped {dropped} duplicate rows")

    # Step 6 — remove rows with null BOOKING_ID (invalid records)
    if "BOOKING_ID" in df.columns:
        before = len(df)
        df = df[df["BOOKING_ID"].notna() & (df["BOOKING_ID"] != "")]
        dropped = before - len(df)
        if dropped:
            log.append(f"Removed {dropped} rows with missing BOOKING_ID")

    log.append(f"Cleaning complete — {len(df):,} rows remaining")
    return {"raw_df": result["data_frame"], "clean_df": df, "cleaning_log": log}
