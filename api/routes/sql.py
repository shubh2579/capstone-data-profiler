from fastapi import APIRouter
from pydantic import BaseModel
from agent.pipeline.text_to_sql_node import build_text_to_sql_agent
from api.utils import df_to_records

router = APIRouter()

class SQLRequest(BaseModel):
    question: str

@router.post("/sql")
def run_sql(req: SQLRequest):
    executor = build_text_to_sql_agent()
    result = executor.invoke({"input": req.question})

    sql_query = ""
    rows = []
    columns = []

    for _, observation in result.get("intermediate_steps", []):
        if isinstance(observation, dict) and observation.get("success"):
            sql_query = observation.get("query", "")
            df = observation.get("data_frame")
            if df is not None and not df.empty:
                columns = list(df.columns)
                rows = df_to_records(df)
            break

    return {
        "success": bool(rows or sql_query),
        "question": req.question,
        "sql": sql_query,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "answer": result.get("output", ""),
    }
