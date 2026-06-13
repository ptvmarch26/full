export default function RecommendationCard({ recommended, feasibleModes, reasoning }) {
  if (feasibleModes?.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <div className="text-sm font-semibold text-red-700 mb-1">No Feasible Mode</div>
        <p className="text-xs text-red-600">No mode satisfies the current BATD and OC requirements.</p>
      </div>
    )
  }

  if (!recommended) return null

  const color = { A: 'blue', B: 'violet', C: 'emerald' }[recommended] ?? 'blue'
  const colorMap = {
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-600'   },
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-600' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-600'},
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-5`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`${c.badge} text-white text-xs font-bold px-2.5 py-1 rounded`}>
          ★ Recommended
        </div>
        <span className={`text-lg font-bold ${c.text}`}>Mode {recommended}</span>
        {feasibleModes?.length > 1 && (
          <span className="text-xs text-slate-400 ml-auto">
            Feasible: {feasibleModes.map(m => `Mode ${m}`).join(', ')}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{reasoning}</p>
    </div>
  )
}
