import math
import pandas as pd


def df_to_records(df: pd.DataFrame, limit: int | None = None) -> list[dict]:
    """Convert a DataFrame to JSON-safe records — NaN/Inf → None."""
    if df is None or df.empty:
        return []
    subset = df.head(limit) if limit else df
    records = subset.to_dict(orient="records")
    return [
        {k: (None if isinstance(v, float) and (math.isnan(v) or math.isinf(v)) else v)
         for k, v in row.items()}
        for row in records
    ]
