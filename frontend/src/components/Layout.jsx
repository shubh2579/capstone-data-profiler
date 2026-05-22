import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getStatus } from '../api'
import { BarChart2, Sparkles, Database, AlertTriangle, Zap, LayoutDashboard, ExternalLink, GitBranch } from 'lucide-react'

const SNOWFLAKE_URL = 'https://app.snowflake.com/ap-southeast-7.aws/ot93905/#/data/databases/RIDEBOOKING_DB/schemas/PUBLIC/table/RIDEBOOKING'
const GITHUB_URL    = 'https://github.com/shubh2579/capstone-data-profiler'

const nav = [
  { to: '/overview', label: 'Overview',           icon: LayoutDashboard },
  { to: '/profile',  label: 'Data Profiling',     icon: BarChart2 },
  { to: '/clean',    label: 'Clean & Transform',  icon: Sparkles },
  { to: '/sql',      label: 'Text-to-SQL',        icon: Database },
  { to: '/anomaly',  label: 'Anomaly Detection',  icon: AlertTriangle },
]

export default function Layout({ children }) {
  const [status, setStatus] = useState(null)

  useEffect(() => {
    getStatus().then(r => setStatus(r.data)).catch(() => setStatus({ connected: false }))
  }, [])

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="text-indigo-400" size={20} />
            <span className="font-bold text-lg tracking-tight">Data Quality Engine</span>
          </div>
          <p className="text-xs text-gray-500">Multi-agent pipeline</p>
        </div>

        {/* Connection badge */}
        <div className="px-4 py-3 border-b border-gray-800">
          {status ? (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              status.connected
                ? 'bg-emerald-900/50 text-emerald-400'
                : 'bg-red-900/50 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {status.connected
                ? `${status.backend === 'snowflake' ? '❄️ Snowflake' : 'SQLite'} connected`
                : 'Disconnected'}
            </span>
          ) : (
            <span className="text-xs text-gray-600">Checking connection…</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* External links */}
        <div className="p-4 border-t border-gray-800 space-y-2">
          <a href={SNOWFLAKE_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors group">
            <span className="text-base leading-none">❄️</span>
            <span>Open in Snowflake</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100 transition-opacity ml-auto" />
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors group">
            <GitBranch size={14} />
            <span>View on GitHub</span>
            <ExternalLink size={11} className="opacity-50 group-hover:opacity-100 transition-opacity ml-auto" />
          </a>
          <p className="text-xs text-gray-700 pt-1">LangChain · LangGraph · GPT-4o-mini</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-950">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
