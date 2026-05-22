import { useState, useRef, useEffect } from 'react'
import { runSQL, refineSQL } from '../api'
import {
  Database, Send, ThumbsUp, ThumbsDown, RefreshCw,
  ChevronDown, ChevronRight, RotateCcw, History,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'

const EXAMPLES = [
  'What is the average booking value per vehicle type?',
  'Show me the top 10 customers by total spend.',
  'How many rides were cancelled by customers each day?',
  'What is the distribution of payment methods?',
  'Which pickup locations have the highest average ride distance?',
]

const FEEDBACK_CHIPS = [
  { label: 'Wrong filter / WHERE clause',  value: 'The WHERE clause is wrong — it filters out data that should be included.' },
  { label: 'Wrong aggregation',            value: 'The aggregation (SUM/AVG/COUNT) is incorrect.' },
  { label: 'Wrong columns returned',       value: 'The query returned wrong or unnecessary columns.' },
  { label: 'Results look too low / high',  value: 'The numbers look incorrect — possibly missing NULLs or wrong grouping.' },
  { label: 'Too many rows',                value: 'Too many rows were returned. Please add a LIMIT or tighter filter.' },
  { label: 'Missing rows / data',          value: 'Some expected rows are missing. Please check for over-filtering.' },
  { label: 'Wrong time range',             value: 'The date/time range is incorrect.' },
  { label: 'Show more detail / breakdown', value: 'Please show a more granular breakdown in the results.' },
]

/* ── Small helpers ─────────────────────────────────────────────────────────── */

function canAutoChart(result) {
  return (
    result?.columns?.length === 2 &&
    result.rows?.length > 0 &&
    result.rows.every(r => typeof Object.values(r)[1] === 'number')
  )
}

function ResultTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/60 text-xs text-gray-500 uppercase tracking-wide">
            {columns.map(c => (
              <th key={c} className="px-4 py-3 text-left font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
              {columns.map(c => (
                <td key={c} className="px-4 py-3 text-gray-300">
                  {row[c] == null
                    ? <span className="text-gray-600">null</span>
                    : typeof row[c] === 'number'
                      ? row[c].toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Iteration card ────────────────────────────────────────────────────────── */

function IterationCard({ item, index, isLatest, onFeedbackSubmit }) {
  const [open, setOpen] = useState(isLatest)
  const [feedbackMode, setFeedbackMode] = useState(false)
  const [selectedChip, setSelectedChip] = useState(null)
  const [customFeedback, setCustomFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeFeedback = customFeedback.trim() || selectedChip || ''

  const handleChip = (val) => {
    setSelectedChip(prev => prev === val ? null : val)
    setCustomFeedback('')
  }

  const submit = async () => {
    if (!activeFeedback) return
    setSubmitting(true)
    await onFeedbackSubmit(activeFeedback)
    setSubmitting(false)
    setFeedbackMode(false)
    setSelectedChip(null)
    setCustomFeedback('')
  }

  const label = index === 0 ? 'Original answer' : `Refinement #${index}`
  const borderColor = isLatest ? 'border-indigo-700' : 'border-gray-800'
  const chart = canAutoChart(item)

  return (
    <div className={`bg-gray-900 border ${borderColor} rounded-xl overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
            isLatest ? 'bg-indigo-600/30 text-indigo-300' : 'bg-gray-800 text-gray-500'
          }`}>
            {label}
          </span>
          {item.feedback && (
            <span className="text-xs text-amber-400 italic truncate max-w-xs">
              ↪ "{item.feedback}"
            </span>
          )}
          <span className="text-xs text-gray-600">
            {item.row_count?.toLocaleString()} rows
          </span>
        </div>
        {open ? <ChevronDown size={15} className="text-gray-500" /> : <ChevronRight size={15} className="text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-800">
          {/* Answer */}
          {item.answer && (
            <div className="px-5 pt-4 pb-3 bg-indigo-950/30 border-b border-gray-800 text-sm text-indigo-200">
              <span className="font-semibold text-indigo-400">Answer: </span>{item.answer}
            </div>
          )}

          {/* SQL */}
          {item.sql && (
            <details className="border-b border-gray-800 group">
              <summary className="px-5 py-2.5 cursor-pointer text-xs text-gray-500 hover:text-gray-300 select-none">
                Generated SQL ▾
              </summary>
              <pre className="px-5 pb-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {item.sql}
              </pre>
            </details>
          )}

          {/* Chart */}
          {chart && (
            <div className="px-5 pt-4 pb-2 border-b border-gray-800">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={item.rows}>
                  <XAxis dataKey={item.columns[0]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey={item.columns[1]} fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          {item.rows?.length > 0 && (
            <div className="border-b border-gray-800">
              <div className="px-5 py-2 text-xs text-gray-500 font-medium">
                {item.row_count?.toLocaleString()} rows returned
              </div>
              <ResultTable columns={item.columns} rows={item.rows} />
            </div>
          )}

          {/* Feedback section — only on the latest result */}
          {isLatest && !feedbackMode && (
            <div className="px-5 py-4 flex items-center gap-3">
              <span className="text-xs text-gray-500">Was this helpful?</span>
              <button
                onClick={() => {/* thumbs up — just visual */ }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-900/30 border border-emerald-800 text-emerald-400 rounded-full hover:bg-emerald-900/50 transition-colors"
              >
                <ThumbsUp size={12} /> Looks good
              </button>
              <button
                onClick={() => setFeedbackMode(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-900/30 border border-amber-800 text-amber-400 rounded-full hover:bg-amber-900/50 transition-colors"
              >
                <ThumbsDown size={12} /> Refine answer
              </button>
            </div>
          )}

          {/* Feedback form */}
          {isLatest && feedbackMode && (
            <div className="px-5 py-4 border-t border-gray-800 bg-gray-950/40">
              <div className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <RefreshCw size={14} className="text-amber-400" />
                What should be corrected?
              </div>

              {/* Quick chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                {FEEDBACK_CHIPS.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => handleChip(chip.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      selectedChip === chip.value
                        ? 'bg-amber-600/30 border-amber-600 text-amber-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Free-text */}
              <textarea
                value={customFeedback}
                onChange={e => { setCustomFeedback(e.target.value); setSelectedChip(null) }}
                placeholder="Or describe the issue in your own words…"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-600 transition-colors resize-none mb-3"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={submit}
                  disabled={!activeFeedback || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw size={13} className={submitting ? 'animate-spin' : ''} />
                  {submitting ? 'Refining…' : 'Retry with feedback'}
                </button>
                <button
                  onClick={() => { setFeedbackMode(false); setSelectedChip(null); setCustomFeedback('') }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Main page ─────────────────────────────────────────────────────────────── */

export default function SQL() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [history, setHistory]   = useState([])   // list of result objects
  const bottomRef               = useRef(null)

  useEffect(() => {
    if (history.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.length])

  const reset = () => { setHistory([]); setError(null) }

  const runInitial = async (q) => {
    const query = q || question
    if (!query.trim()) return
    reset()
    setLoading(true)
    try {
      const res = (await runSQL(query)).data
      setHistory([{ ...res, feedback: null }])
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRefine = async (feedback) => {
    const last = history[history.length - 1]
    setLoading(true)
    setError(null)
    try {
      const res = (await refineSQL({
        question: history[0].question,
        previous_sql: last.sql || '',
        previous_answer: last.answer || '',
        feedback,
        iteration: history.length,
      })).data
      setHistory(prev => [...prev, { ...res, feedback }])
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="text-indigo-400" /> Text-to-SQL
        </h1>
        <p className="text-gray-500 mt-1">
          Ask in plain English · refine with feedback · iterate until satisfied
        </p>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex gap-3">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && runInitial()}
            placeholder="e.g. What is the average ride distance per vehicle type?"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button onClick={() => runInitial()} disabled={loading || !question.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            {loading
              ? <RefreshCw size={14} className="animate-spin" />
              : <Send size={14} />}
            {loading ? '…' : 'Run'}
          </button>
          {history.length > 0 && (
            <button onClick={reset} title="Start over"
              className="px-3 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 transition-colors">
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Example pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(e => (
            <button key={e}
              onClick={() => { setQuestion(e); runInitial(e) }}
              disabled={loading}
              className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-400 hover:text-gray-200 rounded-full transition-colors">
              {e}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* History / iteration timeline */}
      {history.length > 0 && (
        <>
          {history.length > 1 && (
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
              <History size={13} />
              {history.length} iterations — latest shown expanded
            </div>
          )}

          <div className="flex flex-col gap-4">
            {history.map((item, i) => (
              <IterationCard
                key={i}
                item={item}
                index={i}
                isLatest={i === history.length - 1}
                onFeedbackSubmit={handleRefine}
              />
            ))}
          </div>
        </>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
