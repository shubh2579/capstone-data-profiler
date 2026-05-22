"""Upload RIDEBOOKING.csv to Snowflake on first run.

Uses snowflake.connector.pandas_tools.write_pandas — the recommended
approach that avoids SQLAlchemy reflection issues and handles table
creation automatically.
"""
import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

CSV_PATH = Path("data/RIDEBOOKING.csv")
TABLE_NAME = os.getenv("SNOWFLAKE_TABLE", "RIDEBOOKING").upper()


def _get_connector():
    import snowflake.connector  # noqa: PLC0415

    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT", ""),
        user=os.getenv("SNOWFLAKE_USER", ""),
        password=os.getenv("SNOWFLAKE_PASSWORD", ""),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        database=os.getenv("SNOWFLAKE_DATABASE", "RIDEBOOKING_DB"),
        schema=os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC"),
    )


def _bootstrap_snowflake(conn) -> None:
    """Ensure warehouse / database / schema exist (idempotent)."""
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH")
    database = os.getenv("SNOWFLAKE_DATABASE", "RIDEBOOKING_DB")
    schema = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
    cur = conn.cursor()
    cur.execute(f"CREATE WAREHOUSE IF NOT EXISTS {warehouse} AUTO_SUSPEND = 60 AUTO_RESUME = TRUE WAREHOUSE_SIZE = 'X-SMALL'")
    cur.execute(f"CREATE DATABASE IF NOT EXISTS {database}")
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {database}.{schema}")
    cur.execute(f"USE WAREHOUSE {warehouse}")
    cur.execute(f"USE DATABASE {database}")
    cur.execute(f"USE SCHEMA {schema}")
    cur.close()
    logger.info("Snowflake bootstrap OK: %s.%s", database, schema)


def table_exists_in_snowflake(conn) -> bool:
    """Return True if the table exists and has at least one row."""
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}")
        row = cur.fetchone()
        cur.close()
        return row is not None and row[0] > 0
    except Exception:
        return False


def init_snowflake() -> bool:
    """Upload CSV to Snowflake. Returns True on success or if already done."""
    from agent.tools.snowflake_query_engine import snowflake_creds_available  # noqa: PLC0415

    if not snowflake_creds_available():
        logger.info("Snowflake credentials not set — skipping init")
        return False

    if not CSV_PATH.exists():
        logger.warning("CSV not found at %s — cannot init Snowflake", CSV_PATH)
        return False

    conn = None
    try:
        conn = _get_connector()
        _bootstrap_snowflake(conn)

        if table_exists_in_snowflake(conn):
            logger.info("Snowflake table %s already populated — skipping upload", TABLE_NAME)
            return True

        logger.info("Loading CSV for Snowflake upload…")
        df = pd.read_csv(CSV_PATH, low_memory=False)
        df.columns = [c.strip().upper().replace(" ", "_") for c in df.columns]

        # Strip surrounding quotes from ID columns (raw CSV artefact: "CNR5884300")
        for col in ["BOOKING_ID", "CUSTOMER_ID"]:
            if col in df.columns:
                df[col] = df[col].str.strip('"')

        from snowflake.connector.pandas_tools import write_pandas  # noqa: PLC0415

        success, nchunks, nrows, _ = write_pandas(
            conn,
            df,
            TABLE_NAME,
            auto_create_table=True,
            overwrite=True,
            chunk_size=10_000,
        )

        if success:
            logger.info("Uploaded %d rows in %d chunks to Snowflake table %s", nrows, nchunks, TABLE_NAME)
        else:
            logger.error("write_pandas reported failure for table %s", TABLE_NAME)

        return success

    except Exception as e:
        logger.error("Snowflake init failed: %s", e)
        return False
    finally:
        if conn:
            conn.close()
