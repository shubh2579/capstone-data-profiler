import { useState } from 'react'
import { runProfile } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { BarChart2, Download } from 'lucide-react'

export default function Profile() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try {
      const r = await runProfile()
      setReport(r.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const stats = report?.full_stats
  const summary = report?.summary

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="text-indigo-400" /> Data Profiling
          </h1>
          <p className="text-gray-500 mt-1">Automated quality report — nulls, duplicates, distributions</p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {loading ? <span className="animate-spin">⟳</span> : '▶'} {loading ? 'Profiling…' : 'Run Profiling'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6">{error}</div>}

      {!report && !loading && (
        <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 text-center text-gray-600">
          Click <strong className="text-gray-400">Run Profiling</strong> to analyse your dataset
        </div>
      )}

      {stats && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Rows',     value: stats.row_count.toLocaleString() },
              { label: 'Columns',        value: stats.column_count },
              { label: 'Duplicate Rows', value: stats.duplicate_rows.toLocaleString() },
              { label: 'Missing Cells',  value: `${stats.pct_missing_cells.toFixed(1)}%` },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-2xl font-bold text-white">{c.value}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Null % bar chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="font-semibold mb-4 text-gray-200">Null % by Column</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[...stats.columns].sort((a,b) => b.null_pct - a.null_pct)}>
                <XAxis dataKey="column" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} unit="%" />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="null_pct" radius={[4,4,0,0]}>
                  {stats.columns.map((c, i) => (
                    <Cell key={i} fill={c.null_pct > 50 ? '#ef4444' : c.null_pct > 20 ? '#f59e0b' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Column detail table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">Column Detail</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-800/50">
                    {['Column','Type','Non-null','Null %','Unique','Top Value'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.columns.map((c, i) => (
                    <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{c.column}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.dtype.includes('float') || c.dtype.includes('int') ? 'bg-blue-900/50 text-blue-300' : 'bg-green-900/50 text-green-300'
                        }`}>{c.dtype}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.non_null.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={c.null_pct > 50 ? 'text-red-400' : c.null_pct > 20 ? 'text-amber-400' : 'text-gray-300'}>
                          {c.null_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{c.unique.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[140px]">{c.top_value ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Numeric stats */}
          {stats.columns.filter(c => c.mean !== undefined).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">Numeric Statistics</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-800/50">
                      {['Column','Mean','Std','Min','25%','Median','75%','Max'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.columns.filter(c => c.mean !== undefined).map((c, i) => (
                      <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{c.column}</td>
                        {['mean','std','min','p25','median','p75','max'].map(k => (
                          <td key={k} className="px-4 py-3 text-gray-300">
                            {c[k] != null ? Number(c[k]).toFixed(2) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
