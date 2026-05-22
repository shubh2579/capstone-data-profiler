# Data Quality Engine

A **multi-agent data quality pipeline** that automatically profiles, cleans, and analyses ride-booking data using LangChain, LangGraph, Snowflake, and GPT-4o-mini — with a modern React + FastAPI interface.

---

## Architecture

```
                      ┌─────────────────────────────────────────┐
                      │         LangGraph StateGraph             │
                      │                                          │
  ❄️ Snowflake  ──────▶  [01 Profile] ──▶ [02 Clean & Transform] │
  (150K rows)         │                        │                  │
                      │              ┌─────────┴──────────┐      │
                      │              ▼                     ▼      │
                      │    [03 Text-to-SQL]   [04 Anomaly Detection] │
                      │    GPT-4o-mini          IsolationForest   │
                      └─────────────────────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              ▼             ▼
                         FastAPI API    React UI
                         (port 8000)  (port 5173)
```

### Stage Details

| Stage | Method | Output |
|-------|--------|--------|
| 01 · Data Profiling | Custom pandas profiler — nulls, duplicates, distributions | HTML report + JSON stats |
| 02 · Clean & Transform | LangGraph node — quote stripping, numeric casting, dedup | Cleaned DataFrame |
| 03 · Text-to-SQL | LangGraph + GPT-4o-mini + Snowflake | SQL + results + auto-chart |
| 04 · Anomaly Detection | IsolationForest (contamination=5%) + IQR z-score explainer | 7,500 flagged rows (5%) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| LLM | OpenAI GPT-4o-mini |
| Orchestration | LangGraph StateGraph |
| Agent framework | LangChain 1.x |
| Data warehouse | Snowflake (ap-southeast-7.aws) |
| Local fallback | SQLite |
| Backend API | FastAPI + Uvicorn |
| Frontend | React 19 + Vite + Tailwind CSS |
| ML | scikit-learn IsolationForest |
| Dataset | NCR Uber Ride Bookings — 150K rows × 21 cols |

---

## Quick Start

### Prerequisites
- Python 3.11+ and Node.js 18+
- A Snowflake account (free trial: https://signup.snowflake.com)
- An OpenAI API key (https://platform.openai.com)

### 1. Clone & configure

```bash
git clone <your-repo-url>
cd "capstone project"
cp .env.example .env
# Fill in OPENAI_API_KEY, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD
```

### 2. Python backend

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run with Docker

Two modes are available — choose the one that fits your workflow.

#### Option A — Two containers (recommended for development, with hot-reload)

```bash
docker-compose up --build
```

| Container | URL | What it does |
|---|---|---|
| `api` | http://localhost:8000 | FastAPI + all pipeline endpoints |
| `frontend` | http://localhost:5173 | Vite dev server with hot-reload |

The frontend container proxies every `/api/*` call to the `api` container via Docker's internal DNS (`http://api:8000`). The `frontend` service waits for the `api` healthcheck to pass before starting.

#### Option B — Single container (production / demo)

Builds the React app and serves it directly from FastAPI on one port.

```bash
docker build -t dqe .
docker run -p 8000:8000 --env-file .env dqe
```

Open **http://localhost:8000** — FastAPI serves the React app as static files. React Router works because FastAPI returns `index.html` for any non-`/api` path.

### 4. Run manually (two terminals)

**Terminal 1 — FastAPI:**
```bash
source .venv/bin/activate
uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — React:**
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `DATA_BACKEND` | No | `snowflake` or `sqlite` (default: `sqlite`) |
| `SNOWFLAKE_ACCOUNT` | If Snowflake | Account locator e.g. `abc123.ap-southeast-7.aws` |
| `SNOWFLAKE_USER` | If Snowflake | Snowflake username |
| `SNOWFLAKE_PASSWORD` | If Snowflake | Snowflake password |
| `SNOWFLAKE_WAREHOUSE` | If Snowflake | Default: `COMPUTE_WH` |
| `SNOWFLAKE_DATABASE` | If Snowflake | Default: `RIDEBOOKING_DB` |
| `SNOWFLAKE_SCHEMA` | If Snowflake | Default: `PUBLIC` |
| `SQLITE_DB_PATH` | No | Default: `data/ridebooking.db` |

On first run with `DATA_BACKEND=snowflake`, the app automatically uploads `data/RIDEBOOKING.csv` (150K rows) to Snowflake.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/status` | Connection status + backend type |
| `POST` | `/api/profile` | Run data profiling |
| `POST` | `/api/clean` | Run cleaning pipeline |
| `POST` | `/api/sql` | `{ "question": "..." }` → SQL + results |
| `POST` | `/api/sql/refine` | `{ "question", "previous_sql", "previous_answer", "feedback" }` → corrected SQL |
| `POST` | `/api/anomaly` | Run anomaly detection |

Interactive docs: **http://localhost:8000/docs**

---

## Project Structure

```
capstone project/
├── agent/                    ← LangChain + LangGraph pipeline
│   ├── model.py              ← get_llm() factory
│   ├── prompts.py            ← ChatPromptTemplates
│   ├── pipeline/             ← LangGraph nodes
│   │   ├── state.py          ← PipelineState TypedDict
│   │   ├── graph.py          ← StateGraph wiring
│   │   ├── profile_node.py
│   │   ├── clean_node.py
│   │   ├── text_to_sql_node.py
│   │   └── anomaly_node.py
│   └── tools/                ← Query engines
│       ├── sqlite_query_engine.py
│       ├── snowflake_query_engine.py
│       └── sqlite_profiling_tool.py
├── api/                      ← FastAPI backend
│   ├── main.py
│   ├── utils.py
│   └── routes/
│       ├── status.py
│       ├── profile.py
│       ├── clean.py
│       ├── sql.py
│       └── anomaly.py
├── app/services/             ← Shared services
│   ├── db_init.py            ← Backend factory (Snowflake/SQLite)
│   └── snowflake_init.py     ← CSV → Snowflake uploader
├── frontend/                 ← React + Vite + Tailwind
│   └── src/
│       ├── pages/            ← Overview, Profile, Clean, SQL, Anomaly
│       └── components/       ← Layout, Sidebar
├── data/
│   ├── RIDEBOOKING.csv       ← Source dataset (150K rows)
│   └── ridebooking.db        ← SQLite DB (auto-created)
├── metadata/
│   └── schema.json           ← Table schema for LLM context
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## Dataset

**NCR Uber Ride Bookings** — [Kaggle](https://www.kaggle.com/datasets/yashdevladdha/uber-ride-analytics-dashboard)

| Metric | Value |
|--------|-------|
| Rows | 150,000 |
| Columns | 21 |
| Date range | 2024 |
| Booking statuses | Completed (62%), Cancelled by Driver (18%), No Driver Found (7%), Cancelled by Customer (7%), Incomplete (6%) |
| Total fare value | ₹51.8M |
| Anomalies detected | 7,500 (5.0%) |

---

## Submission Checklist

- [x] Git repository
- [x] `.env.example` with all required variables
- [x] Docker (single-container) + docker-compose (two-container dev)
- [x] FastAPI backend — 6 endpoints including `/api/sql/refine`
- [x] React frontend — 5 pages (Overview + 4 pipeline tabs)
- [x] Architecture overview page with interactive pipeline flow diagram
- [x] Snowflake integration (live data warehouse)
- [x] LangGraph multi-agent orchestration
- [x] Anomaly detection with explainability (IQR z-score per flagged row)
- [x] Text-to-SQL with auto-charting + iterative feedback loop
- [ ] Demo video (5–10 min)
- [ ] Deployed endpoint

---

## License

MIT — Capstone Project 2026
