from typing import Any

from agent.tools.sqlite_profiling_tool import SQLiteDataProfilingTool
from agent.pipeline.state import PipelineState


def profile_node(state: PipelineState) -> dict[str, Any]:
    """LangGraph node: profiles the RIDEBOOKING table and updates state."""
    tool = SQLiteDataProfilingTool()
    report = tool.profile_data(
        query="SELECT * FROM RIDEBOOKING",
        table_name="RIDEBOOKING",
        goal="Full data quality assessment — nulls, duplicates, distributions",
        generate_html=True,
        generate_json=True,
    )

    html_path = report.get("report_paths", {}).get("html", "")
    return {
        "profile_report": report,
        "profile_html_path": html_path,
    }
