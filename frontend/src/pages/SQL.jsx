import { useState } from 'react'
import { runSQL } from '../api'
import { Database, Send } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const EXAMPLES = [
  'What is the average booking value per vehicle type?',
  'Show me the top 10 customers by total spend.',
  'How many rides were cancelled by customers each day?',
  'What is the distribution of payment methods?',
  'Which pickup locations have the highest average ride distance?',
]

export default function SQL() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)

  const run = async (q) => {
    const query = q || question
    if (!query.trim()) return
    setLoading(true); setError(null); setResult(null)
    try { setResult((await runSQL(query)).data) }
    catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  const canChart = result?.columns?.length === 2 &&
    result.rows?.length > 0 &&
    result.rows.every(r => typeof Object.values(r)[1] === 'number')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="text-indigo-400" /> Text-to-SQL
        </h1>
        <p className="text-gray-500 mt-1">Ask questions about your data in plain English</p>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex gap-3">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="e.g. What is the average ride distance per vehicle type?"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button onClick={() => run()} disabled={loading || !question.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Send size={14} /> {loading ? '…' : 'Run'}
          </button>
        </div>

        {/* Example pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => { setQuestion(e); run(e) }}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-full transition-colors">
              {e}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6">{error}</div>}

      {result && (
        <>
          {/* Answer */}
          {result.answer && (
            <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-xl p-4 mb-6 text-sm text-indigo-200">
              <span className="font-semibold text-indigo-400">Answer: </span>{result.answer}
            </div>
          )}

          {/* SQL */}
          {result.sql && (
            <details className="bg-gray-900 border border-gray-800 rounded-xl mb-6 group">
              <summary className="px-5 py-3 cursor-pointer text-sm text-gray-400 hover:text-gray-200 select-none">
                Generated SQL
              </summary>
              <pre className="px-5 pb-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{result.sql}</pre>
            </details>
          )}

          {/* Chart */}
          {canChart && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
              <h2 className="font-semibold mb-4 text-gray-200">{question}</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={result.rows}>
                  <XAxis dataKey={result.columns[0]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey={result.columns[1]} fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          {result.rows?.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-800 font-semibold text-gray-200">
                Results — {result.row_count.toLocaleString()} rows
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/50 text-xs text-gray-500 uppercase tracking-wide">
                      {result.columns.map(c => <th key={c} className="px-4 py-3 text-left font-medium">{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                        {result.columns.map(c => (
                          <td key={c} className="px-4 py-3 text-gray-300">
                            {row[c] == null ? <span className="text-gray-600">null</span>
                              : typeof row[c] === 'number' ? row[c].toLocaleString(undefined, {maximumFractionDigits: 2})
                              : String(row[c])}
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
