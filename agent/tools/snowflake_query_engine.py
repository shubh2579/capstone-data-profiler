"""Snowflake query engine — same interface as SQLiteQueryEngine.

Uses SQLAlchemy (snowflake-sqlalchemy) for all queries so pandas.read_sql
works without warnings and connections are properly pooled.
"""
import logging
import os
import re
from typing import Any

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_REQUIRED = [
    "SNOWFLAKE_ACCOUNT",
    "SNOWFLAKE_USER",
    "SNOWFLAKE_PASSWORD",
    "SNOWFLAKE_WAREHOUSE",
    "SNOWFLAKE_DATABASE",
    "SNOWFLAKE_SCHEMA",
]


def snowflake_creds_available() -> bool:
    """Return True only when all required Snowflake env-vars are non-empty."""
    return all(os.getenv(k, "").strip() for k in _REQUIRED)


def _build_engine():
    """Build a cached SQLAlchemy engine for Snowflake."""
    from sqlalchemy import create_engine  # noqa: PLC0415

    p = {k: os.getenv(k, "") for k in (
        "SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD",
        "SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_DATABASE", "SNOWFLAKE_SCHEMA",
    )}
    url = (
        f"snowflake://{p['SNOWFLAKE_USER']}:{p['SNOWFLAKE_PASSWORD']}"
        f"@{p['SNOWFLAKE_ACCOUNT']}"
        f"/{p['SNOWFLAKE_DATABASE']}/{p['SNOWFLAKE_SCHEMA']}"
        f"?warehouse={p['SNOWFLAKE_WAREHOUSE']}"
    )
    return create_engine(url)


# Module-level engine cache (re-created if creds change)
_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        _engine = _build_engine()
    return _engine


def _fix_nulls_ordering(sql: str) -> str:
    """Snowflake puts NULLs first in DESC order by default (opposite of most DBs).
    Automatically append NULLS LAST to every DESC clause and NULLS FIRST to
    every ASC clause that doesn't already have a NULLS directive.
    """
    # Match ORDER BY ... DESC / ASC not already followed by NULLS
    sql = re.sub(
        r'\bDESC\b(?!\s+NULLS)',
        'DESC NULLS LAST',
        sql,
        flags=re.IGNORECASE,
    )
    sql = re.sub(
        r'\bASC\b(?!\s+NULLS)',
        'ASC NULLS FIRST',
        sql,
        flags=re.IGNORECASE,
    )
    return sql


class SnowflakeQueryEngine:
    """Executes SQL queries against Snowflake — drop-in replacement for SQLiteQueryEngine."""

    def test_connection(self) -> dict[str, Any]:
        if not snowflake_creds_available():
            return {"success": False, "message": "Snowflake credentials not configured"}
        try:
            engine = _get_engine()
            with engine.connect() as conn:
                row = conn.execute(__import__("sqlalchemy").text("SELECT CURRENT_VERSION()")).fetchone()
            return {"success": True, "message": "Connection successful", "version": row[0]}
        except Exception as e:
            logger.error("Snowflake connection failed: %s", e)
            return {"success": False, "message": str(e)}

    def execute_query(self, query: str, goal: str = "", return_format: str = "dict") -> dict[str, Any]:
        if not snowflake_creds_available():
            return {"success": False, "error": "Snowflake credentials not configured", "query": query}
        try:
            query = _fix_nulls_ordering(query)
            engine = _get_engine()
            with engine.connect() as conn:
                df = pd.read_sql(__import__("sqlalchemy").text(query), conn)

            # Snowflake-SQLAlchemy returns lowercase column names; normalise to
            # UPPER_SNAKE_CASE so the rest of the pipeline (anomaly_node, clean_node,
            # etc.) can use consistent uppercase references.
            df.columns = [c.upper() for c in df.columns]

            if return_format == "dataframe":
                data = df
            elif return_format == "list":
                data = df.values.tolist()
            else:
                data = df.to_dict(orient="records")

            return {
                "success": True,
                "data": data,
                "data_frame": df,
                "query": query,
                "goal": goal,
                "row_count": len(df),
                "columns": list(df.columns),
            }
        except Exception as e:
            logger.error("Snowflake query failed: %s", e)
            return {"success": False, "error": str(e), "query": query}

    def get_table_info(self, table_name: str) -> dict[str, Any]:
        db = os.getenv("SNOWFLAKE_DATABASE", "RIDEBOOKING_DB")
        schema = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
        query = f"""
            SELECT COLUMN_NAME AS name, DATA_TYPE AS type,
                   CASE IS_NULLABLE WHEN 'NO' THEN 1 ELSE 0 END AS notnull
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_CATALOG = '{db.upper()}'
              AND TABLE_SCHEMA   = '{schema.upper()}'
              AND TABLE_NAME     = '{table_name.upper()}'
            ORDER BY ORDINAL_POSITION
        """
        result = self.execute_query(query)
        if not result["success"]:
            return result
        return {"success": True, "table_name": table_name,
                "columns": result["data"], "column_count": len(result["data"])}

    def list_tables(self) -> dict[str, Any]:
        db = os.getenv("SNOWFLAKE_DATABASE", "RIDEBOOKING_DB")
        schema = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
        query = f"""
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_CATALOG = '{db.upper()}'
              AND TABLE_SCHEMA   = '{schema.upper()}'
              AND TABLE_TYPE     = 'BASE TABLE'
            ORDER BY TABLE_NAME
        """
        result = self.execute_query(query)
        if not result["success"]:
            return result
        tables = [r["TABLE_NAME"] for r in result["data"]]
        return {"success": True, "tables": tables, "table_count": len(tables)}
