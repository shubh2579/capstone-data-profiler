# Data Quality Engine — Capstone Project Plan

## Project Overview

A **multi-agent Data Quality Engine** that automatically evaluates, detects, and reports on data quality issues. Built with **LangChain + LangGraph** + OpenAI + Streamlit, backed by **SQLite** (open-source, zero-infrastructure), deployed on **AWS**.

The pipeline is orchestrated as a **LangGraph state machine** — each stage is a graph node, state flows between them, and the cleaned data fans out to two downstream services.

- **Text-to-SQL** — LangChain agent with tool calling, natural language → SQL
- **Anomaly Detection** — ML-based statistical anomaly detection

```
RIDEBOOKING.csv (loaded into SQLite on startup)
         │
         ▼
 ┌───────────────┐
 │ 1. PROFILE    │  LangChain agent + ydata-profiling → HTML/JSON report
 │  (LangGraph   │  (nulls, schema, uniqueness, accuracy, timeliness)
 │    node)      │
 └──────┬────────┘
        │  state["raw_df"]
        ▼
 ┌───────────────┐
 │ 2. CLEAN &    │  LangGraph node — Fix nulls, cast types, dedup
 │  TRANSFORM    │
 │  (LangGraph   │
 │    node)      │
 └──────┬────────┘
        │  state["clean_df"]
   ┌────┴──────────────────┐
   ▼                       ▼
 ┌──────────────┐   ┌──────────────────┐
 │ 3. TEXT-TO-  │   │ 4. ANOMALY       │
 │    SQL       │   │    DETECTION     │
 │ LangChain    │   │ (IsolationForest)│
 │ AgentExecutor│   │  LangGraph node  │
 └──────────────┘   └──────────────────┘
```

---

## Database: SQLite

**Why SQLite:**
- Zero setup — built into Python standard library (`import sqlite3`)
- No server, no credentials, no cloud account required
- Full SQL support — all standard queries work
- File-based — `ridebooking.db` bundled with the app or loaded from the CSV at startup
- Portable — the same `.db` file runs locally and inside Docker on AWS

**Data loading strategy:**
- On app startup, check if `data/ridebooking.db` exists
- If not, load `data/RIDEBOOKING.csv` into SQLite via pandas `df.to_sql()`
- All agents and services query `ridebooking.db` via a shared `SQLiteQueryEngine`

---

## Milestones (from Problem Statement)

| Week | Days | What we build |
|------|------|---------------|
| Week 1 | Day 1–2 | Scope, requirements, env setup |
|        | Day 3–5 | Version control, replace Snowflake stubs with SQLite engine |
|        | Day 6–7 | `SQLiteQueryEngine` + unit tests, CSV → SQLite loader |
| Week 2 | Day 8–10 | Data Profiling agent: null detection, schema validation, uniqueness checks |
|        | Day 11–14 | Extend checks: timeliness, consistency, accuracy + Clean/Transform service |
| Week 3 | Day 15–17 | HTML report generator + Streamlit UI skeleton (all 4 pages) |
|        | Day 18–21 | Full AutoGen orchestration: Text-to-SQL + Anomaly Detection wired into UI |
| Week 4 | Day 22–24 | Integration testing across full pipeline |
|        | Day 25–27 | User testing, feedback iteration, polish |
|        | Day 28    | Docker containerisation + deploy on AWS |

---

## Grading Rubric (reference when making trade-offs)

| Category | Weight | Key Criteria |
|----------|--------|--------------|
| Functionality | 30% | Data quality checks (15%), accuracy of detection (10%), multi-source integration (5%) |
| Technical Implementation | 25% | AutoGen orchestration (10%), backend/API (10%), DB connectivity & security (5%) |
| User Experience | 20% | Natural language query interface (10%), HTML reporting (5%), UX (5%) |
| Deployment | 10% | Docker + cloud (5%), performance & accessibility (5%) |
| Documentation | 10% | Project docs (5%), setup guide (5%) |
| Creativity & Innovation | 5% | Novel multi-agent approach (3%), practical problem-solving (2%) |

---

## LangChain + LangGraph Architecture

### Why LangGraph for the pipeline
The 4-stage pipeline maps directly to a LangGraph `StateGraph`:
- Each stage is a **node** that receives the shared `PipelineState` and returns updates to it
- `raw_df` and `clean_df` live in the graph state — no manual passing between components
- The fan-out from Stage 2 to Stages 3 & 4 is a natural **conditional edge**
- Streamlit calls `graph.invoke()` or streams `graph.stream()` per user action

### Core LangChain components used

| Component | Used for |
|-----------|----------|
| `ChatOpenAI` (langchain-openai) | LLM for both agents |
| `create_tool_calling_agent` | Text-to-SQL agent |
| `AgentExecutor` | Runs the Text-to-SQL agent loop |
| `StructuredTool` | Wraps SQLite query functions as agent tools |
| `ChatPromptTemplate` | System prompts for each agent |
| `StateGraph` (langgraph) | Orchestrates the 4-stage pipeline |
| `TypedDict` state | Shared state passed between graph nodes |

---

## Pipeline Detail

### Stage 1 — Data Profiling
**LangGraph node**: `profile_node`
**Agent**: LangChain `AgentExecutor` with `SQLiteDataProfilingTool` (ydata-profiling)

Quality checks performed:
- **Null detection** — `NULL` and literal `'null'` strings in `BOOKING_VALUE`, `RIDE_DISTANCE`
- **Schema validation** — unexpected values in `VEHICLE_TYPE`, `PAYMENT_METHOD`, `Booking Status`
- **Uniqueness** — duplicate `BOOKING_ID` rows
- **Accuracy** — out-of-range values (ratings > 5, negative distances/fares)
- **Timeliness** — gaps in `DATE` coverage
- **Consistency** — cancellation flags vs `Booking Status` cross-check

Outputs:
- Interactive HTML report (ydata-profiling) → stored in `ge_reports/`
- JSON summary → parsed for metric cards in UI
- Raw DataFrame stored in `st.session_state["raw_df"]`

---

### Stage 2 — Clean & Transform
**Service**: `app/services/data_cleaner.py`

Cleaning steps (user can toggle each in UI):
1. Replace literal `'null'` strings with `NaN` in `BOOKING_VALUE`, `RIDE_DISTANCE`
2. Cast `BOOKING_VALUE` and `RIDE_DISTANCE` to float
3. Strip whitespace from all string columns
4. Drop exact duplicate rows
5. Filter out rows where `BOOKING_ID` is null

Outputs:
- Before/after row count shown in UI
- Cleaned DataFrame stored in `st.session_state["clean_df"]`

---

### Stage 3 — Text-to-SQL
**LangGraph node**: `text_to_sql_node`
**Agent**: LangChain `create_tool_calling_agent` + `AgentExecutor`

- `ChatOpenAI(model="gpt-4o-mini")` as the LLM
- `StructuredTool` wraps `SQLiteQueryEngine.execute_query`
- Schema context (`metadata/schema.json`) injected into `ChatPromptTemplate` system message
- Natural language → agent generates SQL → executes → results in `st.dataframe` + Plotly chart

---

### Stage 4 — Anomaly Detection
**LangGraph node**: `anomaly_node`
**Model**: `sklearn.ensemble.IsolationForest`

- Runs on `state["clean_df"]` from Stage 2
- Numeric features: `BOOKING_VALUE`, `RIDE_DISTANCE`, `AVG_VTAT`, `AVG_CTAT`, `DRIVER_RATINGS`, `CUSTOMER_RATING`
- IQR-based explainer adds a human-readable `reason` column per flagged row
- Results: anomaly %, Plotly scatter, flagged rows table

---

## Project Structure

```
capstone project/
├── PLAN.md
├── .env                               ← secrets (gitignored)
├── .env.example                       ← env var template
├── requirements.txt                   ← all dependencies
├── Dockerfile                         ← Week 4
├── docker-compose.yml                 ← local dev
│
├── data/
│   ├── RIDEBOOKING.csv                ← raw source data
│   └── ridebooking.db                 ← SQLite DB (auto-created from CSV)
│
├── ge_reports/                        ← ydata-profiling HTML/JSON outputs
│
├── app/                               ← Streamlit application
│   ├── main.py                        ← entry point + page config + DB init
│   ├── pages/
│   │   ├── 1_data_profiling.py        ← Stage 1 UI
│   │   ├── 2_clean_transform.py       ← Stage 2 UI
│   │   ├── 3_text_to_sql.py           ← Stage 3 UI
│   │   └── 4_anomaly_detection.py     ← Stage 4 UI
│   ├── services/
│   │   ├── db_init.py                 ← CSV → SQLite loader (runs on startup)
│   │   ├── data_cleaner.py            ← cleaning & transform logic
│   │   ├── anomaly_detector.py        ← IsolationForest + IQR explainer
│   │   └── data_loader.py             ← fetch DataFrame from SQLite
│   └── components/
│       └── sidebar.py                 ← DB status, pipeline progress indicator
│
└── agent/                             ← LangChain agent layer (replaces week2 AutoGen code)
    ├── pipeline/
    │   ├── state.py                   ← PipelineState TypedDict for LangGraph
    │   ├── graph.py                   ← StateGraph wiring all 4 nodes
    │   ├── profile_node.py            ← Stage 1 node
    │   ├── clean_node.py              ← Stage 2 node
    │   ├── text_to_sql_node.py        ← Stage 3 node (AgentExecutor)
    │   └── anomaly_node.py            ← Stage 4 node
    ├── tools/
    │   ├── sqlite_query_engine.py     ← SQLite connector (replaces SnowflakeQueryEngine)
    │   └── sqlite_profiling_tool.py   ← ydata-profiling wrapper
    ├── model.py                       ← ChatOpenAI("gpt-4o-mini") factory
    └── prompts.py                     ← ChatPromptTemplates for each agent
    
metadata/
└── schema.json                        ← RIDEBOOKING table schema (keep as-is)
```

---

## Implementation Phases

### Phase 1 — Core infrastructure (Week 1 Day 3–7)

| File | What to build |
|------|---------------|
| `app/services/db_init.py` | Load `RIDEBOOKING.csv` → SQLite `ridebooking.db` on startup |
| `agent/tools/sqlite_query_engine.py` | `SQLiteQueryEngine`: connect, `execute_query`, `get_table_info`, `list_tables` |
| `agent/tools/sqlite_profiling_tool.py` | ydata-profiling wrapper: `profile_data`, `_generate_html_report`, `_generate_json_report` |
| `agent/model.py` | `get_llm()` → `ChatOpenAI(model="gpt-4o-mini")` |
| `agent/prompts.py` | `ChatPromptTemplate` for Text-to-SQL and Profiling agents |

### Phase 2 — LangGraph pipeline (Week 2 Day 8–14)

| File | What to build |
|------|---------------|
| `agent/pipeline/state.py` | `PipelineState(TypedDict)` with `raw_df`, `clean_df`, `profile_report`, `anomaly_results`, `sql_results` |
| `agent/pipeline/profile_node.py` | Profiling agent node — runs ydata-profiling, updates state |
| `agent/pipeline/clean_node.py` | Cleaning node — applies transformations, updates `clean_df` |
| `agent/pipeline/text_to_sql_node.py` | `AgentExecutor` with `StructuredTool` for SQL execution |
| `agent/pipeline/anomaly_node.py` | IsolationForest + IQR explainer node |
| `agent/pipeline/graph.py` | Wire `StateGraph`, add nodes, add edges (fan-out after clean) |

### Phase 3 — Streamlit UI (Week 3 Day 15–21)

| File | What to build |
|------|---------------|
| `app/main.py` | Entry point, DB init on startup, 4-page layout |
| `app/components/sidebar.py` | DB status badge, pipeline progress indicator |
| `app/pages/1_data_profiling.py` | Invoke `profile_node` → embed HTML report + metric cards |
| `app/pages/2_clean_transform.py` | Invoke `clean_node` → before/after preview + toggleable steps |
| `app/pages/3_text_to_sql.py` | Invoke `text_to_sql_node` → SQL expander + `st.dataframe` + chart |
| `app/pages/4_anomaly_detection.py` | Invoke `anomaly_node` → metrics + scatter + flagged rows table |

### Phase 4 — Polish + AWS Deploy (Week 4)
- `@st.cache_resource` for DB connection and LLM, `@st.cache_data` for query results
- Full error handling throughout (empty results, LLM failures, corrupt data)
- README with setup steps and screenshots
- `Dockerfile` + `docker-compose.yml`
- **AWS**: Push image to **ECR**, deploy on **ECS Fargate**, secrets in **AWS Secrets Manager**

---

## AWS Deployment Architecture

```
GitHub Actions CI/CD
        │
        ▼
  Docker Build
        │
        ▼
  Push to AWS ECR  ←──── image registry
        │
        ▼
  AWS ECS Fargate  ←──── serverless container (no EC2)
        │
        ▼
  Application Load Balancer  ←──── public HTTPS URL
```

- `ridebooking.db` bundled inside the Docker image (or mounted from EFS for persistence)
- `ge_reports/` HTML outputs written to ephemeral container storage (or S3 for persistence)
- Secrets (`OPENAI_API_KEY`) stored in **AWS Secrets Manager** / ECS task environment variables

---

## Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=

# SQLite (optional override — defaults to data/ridebooking.db)
SQLITE_DB_PATH=data/ridebooking.db

# AWS (for deployment only)
AWS_REGION=us-east-1
```

---

## Dependencies

```
# Core
streamlit>=1.39.0
pandas>=2.0.0
python-dotenv>=1.0.0

# LangChain + LangGraph
langchain>=0.3.0
langchain-openai>=0.2.0
langchain-community>=0.3.0
langgraph>=0.2.0

# Profiling
ydata-profiling>=4.17.0

# ML
scikit-learn>=1.4.0

# Visualisation
plotly>=5.22.0

# SQLite — built into Python stdlib, no install needed
```

---

## Decisions Locked

| Decision | Choice |
|----------|--------|
| LLM model | `gpt-4o-mini` |
| Database | SQLite (CSV loaded into `ridebooking.db` on startup) |
| Reports storage | In-container (`ge_reports/`) — revisit for AWS if needed |
| Deployment | AWS ECS Fargate + ECR |
