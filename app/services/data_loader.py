"""Thin wrapper — fetch data from SQLite into a pandas DataFrame."""
import pandas as pd
from agent.tools.sqlite_query_engine import SQLiteQueryEngine
from app.services.db_init import get_db_path


def load_table(query: str = "SELECT * FROM RIDEBOOKING LIMIT 1000") -> pd.DataFrame:
    engine = SQLiteQueryEngine(db_path=get_db_path())
    result = engine.execute_query(query, return_format="dataframe")
    if result["success"]:
        return result["data_frame"]
    raise RuntimeError(result.get("error", "Unknown query error"))
