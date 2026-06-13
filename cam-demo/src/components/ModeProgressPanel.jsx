import { useState, useEffect } from 'react'
import { fmtDuration } from '../lib/formatters.js'

const STAGES = [
  { key: 'compile',         label: 'Compile Circuits' },
  { key: 'setup',           label: 'Setup' },
  { key: 'prepare_voters',  label: 'Generate Voter Data' },
  { key: 'registration',    label: 'Registration' },
  { key: 'vote',            label: 'Ballot & Commitment' },
  { key: 'aggregation',     label: 'Aggregation' },
  { key: 'tally',           label: 'Tally & Reveal' },
]

const STAGE_ORDER = STAGES.map(s => s.key)
function isStageAfter(key, current) {
  return STAGE_ORDER.indexOf(key) < STAGE_ORDER.indexOf(current)
}

function fmtElapsed(ms) {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function StageRow({ stage, modeStatus, currentStage, elapsedMs }) {
  let icon, textClass
  if (modeStatus === 'completed' || (modeStatus === 'running' && isStageAfter(stage.key, currentStage))) {
    icon = '✓'; textClass = 'text-green-600'
  } else if (modeStatus === 'running' && currentStage === stage.key) {
    icon = '⟳'; textClass = 'text-blue-600'
  } else if (modeStatus === 'error' && currentStage === stage.key) {
    icon = '✗'; textClass = 'text-red-500'
  } else {
    icon = '○'; textClass = 'text-slate-300'
  }

  const isActive = modeStatus === 'running' && currentStage === stage.key

  return (
    <div className={`flex items-center gap-2 text-xs py-0.5 ${textClass}`}>
      <span className={`w-4 text-center font-mono ${isActive ? 'animate-spin inline-block' : ''}`}>{icon}</span>
      <span className={isActive ? 'font-medium' : ''}>{stage.label}</span>
      {isActive && elapsedMs > 0 && (
        <span className="text-slate-400 font-mono ml-auto">{fmtElapsed(elapsedMs)}</span>
      )}
    </div>
  )
}

function ModeColumn({ mode, modeProgress, totalDurationMs, now }) {
  const status = modeProgress?.status ?? 'idle'
  const currentStage = modeProgress?.currentStage ?? null
  const stageStartedAt = modeProgress?.stageStartedAt ?? null
  const hasCompile = modeProgress?.hasCompile ?? false

  // Only show compile stage row if this mode actually runs/ran it
  const visibleStages = STAGES.filter(s => s.key !== 'compile' || hasCompile || currentStage === 'compile')

  const elapsedMs = (status === 'running' && stageStartedAt)
    ? Math.max(0, now - new Date(stageStartedAt).getTime())
    : 0

  const statusColors = {
    idle:      'border-slate-200 bg-white',
    pending:   'border-slate-200 bg-white',
    running:   'border-blue-300 bg-blue-50',
    completed: 'border-green-300 bg-green-50',
    error:     'border-red-300 bg-red-50',
    stopped:   'border-slate-300 bg-slate-50',
  }

  return (
    <div className={`flex-1 rounded-lg border p-4 ${statusColors[status] ?? statusColors.idle}`}>
      <div className="font-semibold text-slate-700 mb-3 text-sm">Mode {mode}</div>
      <div className="space-y-0.5">
        {visibleStages.map(s => (
          <StageRow
            key={s.key}
            stage={s}
            modeStatus={status}
            currentStage={currentStage}
            elapsedMs={currentStage === s.key ? elapsedMs : 0}
          />
        ))}
      </div>
      <div className="mt-3 text-xs">
        {status === 'idle'      && <span className="text-slate-400">Waiting</span>}
        {status === 'pending'   && <span className="text-slate-400">Waiting</span>}
        {status === 'running'   && (
          <span className="text-blue-600">
            Running… {currentStage && <span className="text-slate-500">({currentStage})</span>}
          </span>
        )}
        {status === 'completed' && (
          <span className="text-green-600">✓ Done{totalDurationMs ? ` — ${fmtDuration(totalDurationMs)}` : ''}</span>
        )}
        {status === 'error'     && <span className="text-red-500">✗ Failed</span>}
        {status === 'stopped'   && <span className="text-slate-500">Stopped</span>}
      </div>
    </div>
  )
}

export default function ModeProgressPanel({ progress, comparison }) {
  const [now, setNow] = useState(Date.now())
  const modes = ['A', 'B', 'C']
  const anyRunning = modes.some(m => progress?.modes?.[m]?.status === 'running')
  const allDone = modes.every(m => progress?.modes?.[m]?.status === 'completed')

  // Tick every second while any mode is running to update elapsed timers
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [anyRunning])

  // "last updated" indicator
  const updatedAt = progress?.updatedAt ? new Date(progress.updatedAt) : null
  const secondsSinceUpdate = updatedAt ? Math.floor((now - updatedAt.getTime()) / 1000) : null

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {modes.map(m => (
          <ModeColumn
            key={m}
            mode={m}
            modeProgress={progress?.modes?.[m]}
            totalDurationMs={comparison?.modes?.[m]?.pipeline?.totalDurationMs}
            now={now}
          />
        ))}
      </div>

      {/* Runner heartbeat */}
      {anyRunning && secondsSinceUpdate !== null && (
        <div className="text-xs text-slate-400 text-right">
          Last update: {secondsSinceUpdate < 5 ? 'just now' : `${secondsSinceUpdate}s ago`}
          {secondsSinceUpdate > 30 && (
            <span className="text-amber-500 ml-2">— script may be processing (ZK proofs can take minutes)</span>
          )}
        </div>
      )}

      {allDone && (
        <div className="text-xs text-slate-500 text-center">
          All modes completed — view results on the Dashboard.
        </div>
      )}
    </div>
  )
}
