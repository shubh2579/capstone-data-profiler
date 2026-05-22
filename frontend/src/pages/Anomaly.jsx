import { useState } from 'react'
import { runAnomaly } from '../api'
import { AlertTriangle, Download } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'

export default function Anomaly() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)

  const run = async () => {
    setLoading(true); setError(null)
    try { setResult((await runAnomaly()).data) }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  const downloadCSV = () => {
    if (!result?.flagged_rows?.length) return
    const cols = Object.keys(result.flagged_rows[0])
    const csv = [cols.join(','), ...result.flagged_rows.map(r =>
      cols.map(c => JSON.stringify(r[c] ?? '')).join(',')
    )].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv]))
    a.download = 'anomalies.csv'; a.click()
  }

  const normal   = result?.scatter_data?.filter(d => !d.anomaly) ?? []
  const flagged  = result?.scatter_data?.filter(d => d.anomaly)  ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-indigo-400" /> Anomaly Detection
          </h1>
          <p className="text-gray-500 mt-1">ML-powered detection of unusual records using Isolation Forest</p>
        </div>
        <button onClick={run} disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          {loading ? <span className="animate-spin">⟳</span> : '▶'} {loading ? 'Analysing 150K rows…' : 'Run Detection'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6">{error}</div>}

      {!result && !loading && (
        <div className="border-2 border-dashed border-gray-800 rounded-xl p-16 text-center text-gray-600">
          Click <strong className="text-gray-400">Run Detection</strong> to start · takes ~10 seconds
        </div>
      )}

      {loading && (
        <div className="border-2 border-dashed border-indigo-900/50 rounded-xl p-16 text-center text-indigo-400 animate-pulse">
          Loading &amp; analysing 150,000 rows…
        </div>
      )}

      {result?.summary && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Rows',       value: result.summary.total_rows.toLocaleString(),  color: 'text-white' },
              { label: 'Anomalies Found',  value: result.summary.anomaly_count.toLocaleString(), color: 'text-red-400' },
              { label: 'Anomaly Rate',     value: `${result.summary.anomaly_pct}%`,            color: 'text-amber-400' },
            ].map(c => (
              <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{c.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mb-8">
            Features used: {result.summary.features_used?.join(', ')}
          </p>

          {/* Scatter plot */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
            <h2 className="font-semibold mb-1 text-gray-200">Ride Distance vs Booking Value</h2>
            <p className="text-xs text-gray-600 mb-4">Sample of 3,000 points — <span className="text-red-400">red = anomaly</span></p>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <XAxis dataKey="RIDE_DISTANCE" name="Distance (km)" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis dataKey="BOOKING_VALUE" name="Booking Value (₹)" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <ZAxis range={[20, 20]} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0]?.payload
                    return (
                      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs">
                        <div className="text-gray-300">Distance: {d?.RIDE_DISTANCE?.toFixed(1)} km</div>
                        <div className="text-gray-300">Value: ₹{d?.BOOKING_VALUE?.toFixed(0)}</div>
                        {d?.reason && <div className="text-red-400 mt-1 max-w-48">{d.reason}</div>}
                      </div>
                    )
                  }}
                />
                <Scatter name="Normal"  data={normal}  fill="#6366f1" opacity={0.3} />
                <Scatter name="Anomaly" data={flagged} fill="#ef4444" opacity={0.8} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Flagged table */}
          {result.flagged_rows?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <span className="font-semibold text-gray-200">
                  Flagged Records — {result.flagged_rows.length.toLocaleString()} shown
                </span>
                <button onClick={downloadCSV}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                  <Download size={12} /> Download CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-500 uppercase tracking-wide">
                      {Object.keys(result.flagged_rows[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-medium whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.flagged_rows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-t border-gray-800 hover:bg-red-900/10 transition-colors">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                            {v == null ? <span className="text-gray-600">—</span> : String(v)}
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
