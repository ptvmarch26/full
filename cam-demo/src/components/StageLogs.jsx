import { useState, useEffect } from 'react'
import { loadStageLogs } from '../lib/loadJson.js'
import { fmtTimestamp } from '../lib/formatters.js'

export default function StageLogs({ embeddedLogs }) {
  const [modeFilter, setModeFilter] = useState('A')
  const [stageFilter, setStageFilter] = useState('all')
  const [logs, setLogs] = useState([])

  useEffect(() => {
    if (embeddedLogs) {
      setLogs(embeddedLogs)
      return
    }
    loadStageLogs(modeFilter).then(data => setLogs(data ?? []))
  }, [modeFilter, embeddedLogs])

  const stages = ['all','setup','registration','vote','aggregation','tally']
  const filtered = stageFilter === 'all' ? logs : logs.filter(l => l.stage === stageFilter)

  function copyLogs() {
    navigator.clipboard.writeText(filtered.map(l => `[${l.timestamp}] [${l.stage}] ${l.message}`).join('\n'))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 p-3 border-b border-slate-100 bg-slate-50 flex-wrap">
        <div className="flex gap-1">
          {['A','B','C'].map(m => (
            <button key={m} onClick={() => setModeFilter(m)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                modeFilter === m ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              Mode {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {stages.map(s => (
            <button key={s} onClick={() => setStageFilter(s)}
              className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                stageFilter === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={copyLogs} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">
          Copy logs
        </button>
      </div>

      <div className="h-64 overflow-y-auto font-mono text-xs p-3 space-y-1 bg-slate-950">
        {filtered.length === 0 ? (
          <div className="text-slate-500">No logs.</div>
        ) : filtered.map((l, i) => (
          <div key={i} className={`flex gap-2 ${l.type === 'stderr' ? 'text-red-400' : 'text-slate-300'}`}>
            <span className="text-slate-600 shrink-0">{fmtTimestamp(l.timestamp)}</span>
            <span className="text-slate-500 shrink-0">[{l.stage}]</span>
            <span>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
