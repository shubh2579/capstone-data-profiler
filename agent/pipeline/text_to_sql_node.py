from typing import Any

import pandas as pd
from langchain_core.messages import HumanMessage
from langchain_core.tools import StructuredTool
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field

from agent.model import get_llm
from agent.prompts import SCHEMA_STR
from agent.pipeline.state import PipelineState


class ExecuteQueryInput(BaseModel):
    query: str = Field(description="SQL query to execute against the RIDEBOOKING table")
    goal: str = Field(default="", description="What the query is trying to answer")


class _TextToSQLExecutor:
    """Wraps a LangGraph react-agent and captures raw tool results for the UI."""

    def __init__(self, graph, captured: dict):
        self._graph = graph
        self._captured = captured

    def invoke(self, inputs: dict) -> dict:
        question = inputs.get("input", "")
        result = self._graph.invoke(
            {"messages": [HumanMessage(content=question)]},
            config={"recursion_limit": 6},
        )
        final_answer = result["messages"][-1].content if result["messages"] else ""

        # Fake intermediate_steps structure expected by the Streamlit page
        fake_steps = [(object(), self._captured.copy())] if self._captured else []

        return {"output": final_answer, "intermediate_steps": fake_steps}


def build_text_to_sql_agent(db_path: str | None = None) -> _TextToSQLExecutor:
    from app.services.db_init import get_query_engine  # noqa: PLC0415

    engine = get_query_engine()
    captured: dict[str, Any] = {}

    def _execute(query: str, goal: str = "") -> str:
        result = engine.execute_query(query, goal)
        captured.clear()
        captured.update(result)
        if result.get("success"):
            return f"Query returned {result['row_count']} rows. Columns: {result['columns']}"
        return f"Query failed: {result.get('error', 'unknown error')}"

    tool = StructuredTool.from_function(
        func=_execute,
        name="execute_query",
        description="Execute a SQL query against the RIDEBOOKING table and return results.",
        args_schema=ExecuteQueryInput,
    )

    from app.services.db_init import active_backend  # noqa: PLC0415
    backend = active_backend()

    if backend == "snowflake":
        dialect_rules = (
            "The database is Snowflake.\n"
            "- Numeric columns (BOOKING_VALUE, RIDE_DISTANCE, AVG_VTAT, AVG_CTAT,\n"
            "  DRIVER_RATINGS, CUSTOMER_RATING) are already FLOAT — use them directly, NO casting.\n"
            "- DO NOT use TRY_CAST. Columns are already the correct type.\n"
            "- BOOKING_VALUE is NULL for non-Completed rides. Use WHERE BOOKING_VALUE IS NOT NULL\n"
            "  when aggregating spend/revenue so cancelled rides don't distort results.\n"
            "- CRITICAL NULL ORDERING: In Snowflake, ORDER BY col DESC puts NULLs FIRST.\n"
            "  ALWAYS write: ORDER BY col DESC NULLS LAST (or ASC NULLS FIRST for ascending).\n"
            "- CUSTOMER_ID values look like CID1234567, BOOKING_ID values look like CNR1234567.\n"
            "- Use standard Snowflake SQL (ILIKE, DATE_TRUNC, TO_DATE, NULLS LAST, etc.).\n"
            "- Table is RIDEBOOKING — no schema prefix needed."
        )
    else:
        dialect_rules = (
            "The database is SQLite.\n"
            "- NEVER use TRY_CAST, DECIMAL, VARCHAR, ISNULL, NVL, or non-SQLite functions.\n"
            "- Numeric casts: CAST(column AS REAL) or CAST(column AS INTEGER) only."
        )

    system_prompt = (
        f"You are a SQL expert for a ride-booking analytics platform.\n\n"
        f"Table schema:\n{SCHEMA_STR}\n\n"
        f"STRICT RULES:\n"
        f"{dialect_rules}\n"
        "- Table name is always RIDEBOOKING (uppercase).\n"
        "- All column names are UPPER_SNAKE_CASE.\n"
        "- Limit to 500 rows unless the user asks for aggregations.\n"
        "- If a query fails, simplify it — do NOT retry the same query.\n"
        "- After getting results, summarise findings in 2–3 sentences."
    )

    graph = create_react_agent(get_llm(), [tool], prompt=system_prompt)
    return _TextToSQLExecutor(graph, captured)


def text_to_sql_node(state: PipelineState, question: str, db_path: str | None = None) -> dict[str, Any]:
    """LangGraph node: translates a natural language question to SQL and executes it."""
    executor = build_text_to_sql_agent(db_path=db_path)
    result = executor.invoke({"input": question})

    sql_query = ""
    sql_df = pd.DataFrame()
    sql_results: list[dict] = []

    for _, observation in result.get("intermediate_steps", []):
        if isinstance(observation, dict) and observation.get("success"):
            sql_query = observation.get("query", "")
            sql_df = observation.get("data_frame", pd.DataFrame())
            sql_results = observation.get("data", [])
            break

    return {
        "sql_question": question,
        "sql_query": sql_query,
        "sql_results": sql_results,
        "sql_df": sql_df,
    }
