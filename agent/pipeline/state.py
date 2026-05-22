from typing import Any
from typing_extensions import TypedDict
import pandas as pd


class PipelineState(TypedDict, total=False):
    """Shared state that flows through all LangGraph pipeline nodes."""

    # Stage 1 outputs
    raw_df: pd.DataFrame
    profile_report: dict[str, Any]   # summary dict from SQLiteDataProfilingTool
    profile_html_path: str            # path to generated HTML report

    # Stage 2 outputs
    clean_df: pd.DataFrame
    cleaning_log: list[str]           # human-readable list of steps applied

    # Stage 3 outputs
    sql_question: str
    sql_query: str
    sql_results: list[dict[str, Any]]
    sql_df: pd.DataFrame

    # Stage 4 outputs
    anomaly_df: pd.DataFrame          # clean_df + is_anomaly + anomaly_score + reason
    anomaly_summary: dict[str, Any]   # total_rows, anomaly_count, anomaly_pct
