"""Initialise the data backend (SQLite fallback or Snowflake primary)."""
import logging
import os
import sqlite3
from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

if TYPE_CHECKING:
    from agent.tools.sqlite_query_engine import SQLiteQueryEngine
    from agent.tools.snowflake_query_engine import SnowflakeQueryEngine

logger = logging.getLogger(__name__)

DB_PATH = Path(os.getenv("SQLITE_DB_PATH", "data/ridebooking.db"))
CSV_PATH = Path("data/RIDEBOOKING.csv")
TABLE_NAME = "RIDEBOOKING"


# ── SQLite init ───────────────────────────────────────────────────────────────

def init_db() -> bool:
    """Create local SQLite DB from CSV (always used as warm fallback)."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    if DB_PATH.exists():
        logger.info("SQLite DB already exists at %s", DB_PATH)
        return True

    if not CSV_PATH.exists():
        logger.warning("CSV not found at %s — SQLite not initialised", CSV_PATH)
        return False

    try:
        df = pd.read_csv(CSV_PATH, low_memory=False)
        df.columns = [c.strip().upper().replace(" ", "_") for c in df.columns]

        conn = sqlite3.connect(DB_PATH)
        df.to_sql(TABLE_NAME, conn, if_exists="replace", index=False)
        conn.close()

        logger.info("SQLite: loaded %d rows into %s", len(df), DB_PATH)
        return True
    except Exception as e:
        logger.error("SQLite init failed: %s", e)
        return False


def get_db_path() -> str:
    return str(DB_PATH)


# ── Backend factory ───────────────────────────────────────────────────────────

def active_backend() -> str:
    """Return 'snowflake' or 'sqlite' based on DATA_BACKEND env-var + cred check."""
    requested = os.getenv("DATA_BACKEND", "sqlite").lower()
    if requested == "snowflake":
        from agent.tools.snowflake_query_engine import snowflake_creds_available  # noqa: PLC0415
        if snowflake_creds_available():
            return "snowflake"
        logger.warning("DATA_BACKEND=snowflake but credentials incomplete — falling back to SQLite")
    return "sqlite"


def get_query_engine():
    """Return the configured query engine (SnowflakeQueryEngine or SQLiteQueryEngine)."""
    if active_backend() == "snowflake":
        from agent.tools.snowflake_query_engine import SnowflakeQueryEngine  # noqa: PLC0415
        return SnowflakeQueryEngine()
    from agent.tools.sqlite_query_engine import SQLiteQueryEngine  # noqa: PLC0415
    return SQLiteQueryEngine(db_path=get_db_path())
