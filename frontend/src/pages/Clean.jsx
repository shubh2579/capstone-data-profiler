import { useState } from 'react'
import { runClean } from '../api'
import { Sparkles, CheckCircle } from 'lucide-react'

export default function Clean() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try { setResult((await runClean()).data) }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="text-indigo-400" /> Clean &amp; Transform
          </h1>
          <p className="text-gray-500 mt-1">Fix data issues identified during profiling</p>
        </div>
        <button onClick={run} disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {loading ? <span className="animate-spin">⟳</span> : '▶'} {loading ? 'Cleaning…' : 'Apply Cleaning'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6">{error}</div>}

      {!result && !loading && (
        <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 text-center text-gray-600">
          Click <strong className="text-gray-400">Apply Cleaning</strong> to start
        </div>
      )}

      {result && (
        <>
          {/* Before/After */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Rows Before', value: result.rows_before.toLocaleString(), color: 'text-white' },
              { label: 'Rows After',  value: result.rows_after.toLocaleString(),  color: 'text-emerald-400' },
              { label: 'Rows Removed',value: result.rows_removed.toLocaleString(), color: result.rows_removed > 0 ? 'text-amber-400' : 'text-gray-400' },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Cleaning log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="font-semibold mb-4 text-gray-200 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" /> Cleaning Log
            </h2>
            <ul className="space-y-2">
              {result.cleaning_log.map((entry, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-emerald-500 mt-0.5">✓</span> {entry}
                </li>
              ))}
            </ul>
          </div>

          {/* Null summary */}
          {result.null_summary.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">Remaining Nulls</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-800/50">
                    <th className="px-4 py-3 text-left">Column</th>
                    <th className="px-4 py-3 text-left">Null Count</th>
                  </tr>
                </thead>
                <tbody>
                  {result.null_summary.map((r, i) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{r.column}</td>
                      <td className="px-4 py-3 text-amber-400">{r.null_count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Preview */}
          {result.preview.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">
                Preview — first {result.preview.length} rows
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/50">
                      {Object.keys(result.preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/20">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-gray-300 whitespace-nowrap max-w-[120px] truncate">
                            {v == null ? <span className="text-gray-600">null</span> : String(v)}
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
