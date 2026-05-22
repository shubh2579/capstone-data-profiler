import sqlite3
import os
import logging
from typing import Any
from contextlib import contextmanager
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class SQLiteQueryEngine:
    """Executes SQL queries against the local SQLite ridebooking database."""

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("SQLITE_DB_PATH", "data/ridebooking.db")

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def test_connection(self) -> dict[str, Any]:
        try:
            with self._get_connection() as conn:
                version = conn.execute("SELECT sqlite_version()").fetchone()[0]
            return {"success": True, "message": "Connection successful", "version": version}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def execute_query(self, query: str, goal: str = "", return_format: str = "dict") -> dict[str, Any]:
        """Execute a SQL query and return results.

        Args:
            query: SQL query string
            goal: Human-readable description of what the query achieves
            return_format: 'dict' | 'dataframe' | 'list'
        """
        try:
            with self._get_connection() as conn:
                df = pd.read_sql_query(query, conn)

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
            logger.error("Query failed: %s", e)
            return {"success": False, "error": str(e), "query": query}

    def get_table_info(self, table_name: str) -> dict[str, Any]:
        """Return column names and types for a table."""
        try:
            with self._get_connection() as conn:
                rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
            columns = [{"name": r["name"], "type": r["type"], "notnull": bool(r["notnull"])} for r in rows]
            return {"success": True, "table_name": table_name, "columns": columns, "column_count": len(columns)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_tables(self) -> dict[str, Any]:
        """List all tables in the database."""
        try:
            with self._get_connection() as conn:
                rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
            tables = [r["name"] for r in rows]
            return {"success": True, "tables": tables, "table_count": len(tables)}
        except Exception as e:
            return {"success": False, "error": str(e)}
