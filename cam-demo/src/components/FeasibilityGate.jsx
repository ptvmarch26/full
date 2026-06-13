export default function FeasibilityGate({ feasibility }) {
  if (!feasibility) return null

  const modes = ['A', 'B', 'C']
  const badge = {
    feasible: 'bg-green-100 text-green-700 border-green-200',
    caution:  'bg-yellow-100 text-yellow-700 border-yellow-200',
    out:      'bg-red-50 text-red-500 border-red-200 line-through opacity-60',
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        Phase 1 — Feasibility Gate
      </h2>
      <div className="flex gap-3 mb-4">
        {modes.map(m => {
          const f = feasibility[m]
          const type = !f.feasible ? 'out' : f.caution ? 'caution' : 'feasible'
          const icon = !f.feasible ? '✗' : f.caution ? '⚠' : '✓'
          return (
            <div key={m} className={`flex-1 border rounded-lg p-3 text-center ${badge[type]}`}>
              <div className="text-lg font-semibold">{icon}</div>
              <div className="text-sm font-medium">Mode {m}</div>
              <div className="text-xs mt-1 opacity-75">
                {!f.feasible ? 'Eliminated' : f.caution ? 'Feasible / Caution' : 'Feasible'}
              </div>
            </div>
          )
        })}
      </div>
      <div className="space-y-1">
        {modes.flatMap(m =>
          feasibility[m].reasons.map((r, i) => (
            <div key={`${m}-${i}`} className="text-xs text-slate-500 flex gap-2">
              <span className={feasibility[m].feasible ? 'text-yellow-500' : 'text-red-400'}>→</span>
              <span>{r}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
