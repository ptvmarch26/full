import { fmtDuration } from '../lib/formatters.js'

const STAGE_ORDER = ['setup','registration','vote','aggregation','tally']

export default function PipelineStepper({ modeData, mode }) {
  if (!modeData) return <div className="text-xs text-slate-400 p-4">No data for Mode {mode}.</div>

  const stages = modeData.stages ?? []
  const pipeline = modeData.pipeline ?? {}

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          modeData.status === 'completed' ? 'bg-green-100 text-green-700' :
          modeData.status === 'error'     ? 'bg-red-100 text-red-600' :
          'bg-slate-100 text-slate-500'
        }`}>
          {modeData.status === 'completed' ? `✓ Completed in ${fmtDuration(pipeline.totalDurationMs)}` : modeData.status}
        </span>
      </div>

      {stages.map((st, i) => (
        <div key={st.key} className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              st.status === 'completed' ? 'bg-green-500 text-white' :
              st.status === 'running'   ? 'bg-blue-500 text-white animate-pulse' :
              st.status === 'error'     ? 'bg-red-500 text-white' :
              'bg-slate-200 text-slate-400'
            }`}>
              {st.status === 'completed' ? '✓' : st.status === 'error' ? '✗' : i + 1}
            </div>
            {i < stages.length - 1 && (
              <div className={`w-0.5 h-5 mt-1 ${
                st.status === 'completed' ? 'bg-green-300' : 'bg-slate-200'
              }`} />
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-slate-700">{st.label}</span>
              {st.durationMs && (
                <span className="text-xs text-slate-400">{fmtDuration(st.durationMs)}</span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono">{st.script}</div>
            {st.error && <div className="text-xs text-red-500 mt-0.5">{st.error}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
