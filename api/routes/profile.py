from fastapi import APIRouter
from agent.tools.sqlite_profiling_tool import SQLiteDataProfilingTool

router = APIRouter()

@router.post("/profile")
def run_profile():
    tool = SQLiteDataProfilingTool()
    report = tool.profile_data(
        query="SELECT * FROM RIDEBOOKING",
        table_name="RIDEBOOKING",
        goal="Full data quality assessment",
        generate_html=True,
        generate_json=True,
    )
    # Remove non-serialisable DataFrame from response
    report.pop("data_frame", None)
    return report
