import json
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate

_SCHEMA_PATH = Path(__file__).parent.parent / "metadata" / "schema.json"


def _load_schema() -> str:
    try:
        return json.dumps(json.loads(_SCHEMA_PATH.read_text()), indent=2)
    except Exception:
        return "{}"


TEXT_TO_SQL_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are an expert SQL analyst for a ride-booking platform.
You have access to a {dialect} database with the following schema:

{schema}

STRICT RULES:
- Table name: RIDEBOOKING (uppercase). All column names are UPPER_SNAKE_CASE.
- Return only valid {dialect} SQL — no markdown fences, no explanations.
- Limit results to 500 rows unless the user asks for aggregations.
- If a query fails, simplify it — do NOT retry the identical query.

Call the execute_query tool with the SQL, then summarise findings in 2–3 sentences.""",
    ),
    ("placeholder", "{agent_scratchpad}"),
    ("human", "{input}"),
])


PROFILING_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are a data quality analyst for a ride-booking platform.
Your job is to profile data in the RIDEBOOKING SQLite table and produce a comprehensive quality report.

Schema:
{schema}

When asked to profile data:
1. Call the profile_data tool with an appropriate SELECT query.
2. Analyse the returned summary for quality issues:
   - High null rates (> 5 %)
   - Duplicate rows
   - Out-of-range values (ratings > 5, negative fares/distances)
   - Unexpected categorical values
3. Return a structured finding list with severity (HIGH / MEDIUM / LOW) and recommended fix.""",
    ),
    ("placeholder", "{agent_scratchpad}"),
    ("human", "{input}"),
])

SCHEMA_STR = _load_schema()
