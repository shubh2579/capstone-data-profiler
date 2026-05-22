import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStatus } from '../api'
import { BarChart2, Sparkles, Database, AlertTriangle, Zap, ArrowRight, ArrowDown, ChevronRight, RefreshCw } from 'lucide-react'

const STACK = [
  { label: 'LangChain',  color: 'bg-green-900/40 text-green-300 border-green-800' },
  { label: 'LangGraph',  color: 'bg-teal-900/40 text-teal-300 border-teal-800' },
  { label: 'Snowflake',  color: 'bg-blue-900/40 text-blue-300 border-blue-800' },
  { label: 'FastAPI',    color: 'bg-indigo-900/40 text-indigo-300 border-indigo-800' },
  { label: 'React',      color: 'bg-cyan-900/40 text-cyan-300 border-cyan-800' },
  { label: 'IsolationForest', color: 'bg-purple-900/40 text-purple-300 border-purple-800' },
  { label: 'OpenAI GPT-4o-mini', color: 'bg-rose-900/40 text-rose-300 border-rose-800' },
  { label: 'Tailwind CSS', color: 'bg-sky-900/40 text-sky-300 border-sky-800' },
]

const STAGES = [
  {
    num: '01',
    icon: BarChart2,
    title: 'Data Profiling',
    description: 'Automated quality assessment — nulls, duplicates, distributions, schema validation',
    tech: 'Custom Pandas Profiler',
    color: 'border-indigo-600',
    accent: 'text-indigo-400',
    bg: 'bg-indigo-600/10',
    to: '/profile',
  },
  {
    num: '02',
    icon: Sparkles,
    title: 'Clean & Transform',
    description: 'Fix data issues: strip quotes, cast numerics, drop duplicates, remove invalid records',
    tech: 'LangGraph Node',
    color: 'border-violet-600',
    accent: 'text-violet-400',
    bg: 'bg-violet-600/10',
    to: '/clean',
  },
  {
    num: '03',
    icon: Database,
    title: 'Text-to-SQL',
    description: 'Natural language → Snowflake SQL via GPT-4o-mini · iterative feedback loop to refine answers',
    tech: 'LangGraph + OpenAI · /api/sql/refine',
    color: 'border-sky-600',
    accent: 'text-sky-400',
    bg: 'bg-sky-600/10',
    to: '/sql',
  },
  {
    num: '04',
    icon: AlertTriangle,
    title: 'Anomaly Detection',
    description: 'Isolation Forest on 6 numeric features + IQR z-score explainer per flagged row',
    tech: 'scikit-learn',
    color: 'border-rose-600',
    accent: 'text-rose-400',
    bg: 'bg-rose-600/10',
    to: '/anomaly',
  },
]

function Arrow({ vertical }) {
  return vertical
    ? <div className="flex justify-center my-1"><ArrowDown size={18} className="text-gray-600" /></div>
    : <div className="flex items-center justify-center px-1"><ArrowRight size={18} className="text-gray-600" /></div>
}

export default function Overview() {
  const [status, setStatus] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getStatus().then(r => setStatus(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-indigo-600/20 rounded-xl">
            <Zap size={24} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Quality Engine</h1>
            <p className="text-gray-500">Multi-agent pipeline · Snowflake · LangGraph · GPT-4o-mini</p>
          </div>
        </div>

        {/* Dataset badge */}
        <div className="flex flex-wrap gap-3 mt-4">
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-gray-300">
            📦 NCR Uber Ride Bookings
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-full text-gray-300">
            📊 150,000 rows · 21 columns
          </span>
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 border rounded-full ${
            status?.connected
              ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
              : 'bg-gray-800 border-gray-700 text-gray-400'
          }`}>
            {status?.backend === 'snowflake' ? '❄️' : '🗄️'}{' '}
            {status?.connected
              ? `${status.backend === 'snowflake' ? 'Snowflake' : 'SQLite'} connected`
              : 'Checking connection…'}
          </span>
        </div>
      </div>

      {/* Pipeline Architecture */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
          Pipeline Architecture
        </h2>

        {/* Data source */}
        <div className="flex justify-center mb-3">
          <div className="bg-gray-900 border border-blue-800 rounded-xl px-6 py-3 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Data Source</div>
            <div className="font-semibold text-blue-300 flex items-center gap-2 justify-center">
              ❄️ Snowflake
              <span className="text-xs text-gray-600 font-normal">/ SQLite fallback</span>
            </div>
            <div className="text-xs text-gray-600 mt-1">RIDEBOOKING_DB · PUBLIC · 150K rows</div>
          </div>
        </div>

        <Arrow vertical />

        {/* LangGraph box wrapping all nodes */}
        <div className="relative border border-dashed border-gray-700 rounded-2xl p-6 bg-gray-900/30">
          <span className="absolute -top-3 left-4 text-xs text-gray-500 bg-gray-950 px-2 font-mono">
            LangGraph StateGraph
          </span>

          {/* Stage 1 + 2 — linear */}
          <div className="flex flex-col md:flex-row items-center gap-3 justify-center">
            {[STAGES[0], STAGES[1]].map((s, i) => (
              <div key={s.num} className="flex items-center gap-3">
                <StageCard s={s} onClick={() => navigate(s.to)} />
                {i === 0 && <Arrow />}
              </div>
            ))}
          </div>

          <Arrow vertical />

          {/* Fan-out label */}
          <div className="text-center text-xs text-gray-600 font-mono mb-3">fan-out → parallel execution</div>

          {/* Stage 3 + 4 — side by side */}
          <div className="flex flex-col md:flex-row items-stretch gap-3 justify-center">
            {[STAGES[2], STAGES[3]].map(s => (
              <StageCard key={s.num} s={s} onClick={() => navigate(s.to)} wide />
            ))}
          </div>
        </div>

        <Arrow vertical />

        {/* API + UI layer */}
        <div className="flex flex-col md:flex-row gap-3 justify-center mt-1">
          <div className="bg-gray-900 border border-indigo-900 rounded-xl px-5 py-3 text-center flex-1 max-w-xs">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Backend</div>
            <div className="font-semibold text-indigo-300">FastAPI</div>
            <div className="text-xs text-gray-600 mt-1">
              /api/profile · /api/clean · /api/sql · /api/sql/refine · /api/anomaly
            </div>
          </div>
          <div className="bg-gray-900 border border-cyan-900 rounded-xl px-5 py-3 text-center flex-1 max-w-xs">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Frontend</div>
            <div className="font-semibold text-cyan-300">React + Vite + Tailwind</div>
            <div className="text-xs text-gray-600 mt-1">5 pages · Overview + 4 pipeline tabs · dark dashboard</div>
          </div>
        </div>
      </div>

      {/* Key Features highlight strip */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
          Key Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-sky-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={15} className="text-sky-400" />
              <span className="text-sm font-semibold text-sky-300">Feedback Loop</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Text-to-SQL supports iterative refinement. If an answer is wrong, select a quick-fix chip
              or describe the issue — the LLM rewrites the SQL with full context of what failed.
            </p>
          </div>
          <div className="bg-gray-900 border border-purple-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={15} className="text-purple-400" />
              <span className="text-sm font-semibold text-purple-300">Explainable Anomalies</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Every flagged row gets an IQR z-score explanation — not just a flag.
              Scatter plot + downloadable CSV of the 5% anomaly set.
            </p>
          </div>
          <div className="bg-gray-900 border border-emerald-900 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={15} className="text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Dual Backend</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Snowflake as primary data warehouse with automatic SQLite fallback.
              Switch via <code className="text-gray-400 font-mono text-xs">DATA_BACKEND</code> env-var — zero code change.
            </p>
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
          Tech Stack
        </h2>
        <div className="flex flex-wrap gap-2">
          {STACK.map(s => (
            <span key={s.label} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${s.color}`}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Quick-launch cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <span className="w-1 h-5 bg-indigo-500 rounded-full inline-block" />
          Quick Launch
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STAGES.map(s => {
            const Icon = s.icon
            return (
              <button key={s.num} onClick={() => navigate(s.to)}
                className={`text-left group bg-gray-900 border ${s.color} rounded-xl p-5 hover:bg-gray-800/60 transition-all`}>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${s.bg} mb-3`}>
                    <Icon size={18} className={s.accent} />
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors mt-1" />
                </div>
                <div className="font-semibold text-gray-100 mb-1">{s.num} · {s.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{s.description}</div>
                <div className={`text-xs mt-2 font-mono ${s.accent}`}>{s.tech}</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StageCard({ s, onClick, wide }) {
  const Icon = s.icon
  return (
    <button onClick={onClick}
      className={`group bg-gray-950 border ${s.color} rounded-xl p-4 hover:bg-gray-900 transition-all text-left ${wide ? 'flex-1' : 'w-52'}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${s.bg}`}>
          <Icon size={14} className={s.accent} />
        </div>
        <span className="text-xs font-mono text-gray-600">{s.num}</span>
      </div>
      <div className={`text-sm font-semibold ${s.accent} mb-1`}>{s.title}</div>
      <div className="text-xs text-gray-600 font-mono">{s.tech}</div>
    </button>
  )
}
