from fastapi import APIRouter
from pydantic import BaseModel
from agent.pipeline.text_to_sql_node import build_text_to_sql_agent
from api.utils import df_to_records

router = APIRouter()


class SQLRequest(BaseModel):
    question: str


class RefineRequest(BaseModel):
    question: str
    previous_sql: str
    previous_answer: str
    feedback: str
    iteration: int = 1


def _invoke_and_extract(question: str) -> dict:
    """Run the text-to-SQL agent and return a normalised response dict."""
    executor = build_text_to_sql_agent()
    result = executor.invoke({"input": question})

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
        "sql": sql_query,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "answer": result.get("output", ""),
    }


@router.post("/sql")
def run_sql(req: SQLRequest):
    payload = _invoke_and_extract(req.question)
    return {"question": req.question, **payload}


@router.post("/sql/refine")
def refine_sql(req: RefineRequest):
    """
    Re-run the agent with the original question enriched by the user's feedback
    and a summary of what the previous attempt produced.
    """
    refined_question = (
        f"Original question: {req.question}\n\n"
        f"My previous SQL was:\n{req.previous_sql}\n\n"
        f"The previous answer was:\n{req.previous_answer}\n\n"
        f"The user was not satisfied. Their feedback:\n{req.feedback}\n\n"
        f"Please write a corrected SQL query that addresses this feedback. "
        f"Do NOT reuse the same query. Fix the specific issue the user highlighted."
    )
    payload = _invoke_and_extract(refined_question)
    return {
        "question": req.question,
        "feedback": req.feedback,
        "iteration": req.iteration,
        **payload,
    }
