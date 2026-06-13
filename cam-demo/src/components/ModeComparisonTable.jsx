import { fmtGas, fmtMs } from '../lib/formatters.js'

const BASELINE_BVC = { A: 53987,  B: 261924, C: 83855 }
const BASELINE_OAL = { A: 1200,   B: 1250,   C: 1450  }
const BASELINE_SC  = { A: 18,     B: 18,     C: 24    }

export default function ModeComparisonTable({ modesData, feasibility, recommended }) {
  const modes = ['A', 'B', 'C']

  const rows = [
    {
      metric: 'BVC (gas/ballot)',
      desc: 'Ballot Verification Cost',
      vals: modes.map(m => fmtGas(modesData?.[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? BASELINE_BVC[m])),
      best: modes.reduce((b, m) => {
        const v = modesData?.[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? BASELINE_BVC[m]
        const bv = modesData?.[b]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? BASELINE_BVC[b]
        return v < bv ? m : b
      }),
    },
    {
      metric: 'OAL (ms/ballot)',
      desc: 'Online Acceptance Latency',
      vals: modes.map(m => fmtMs(modesData?.[m]?.metrics?.OAL?.averageEndToEndMs ?? BASELINE_OAL[m])),
      best: modes.reduce((b, m) => {
        const v = modesData?.[m]?.metrics?.OAL?.averageEndToEndMs ?? BASELINE_OAL[m]
        const bv = modesData?.[b]?.metrics?.OAL?.averageEndToEndMs ?? BASELINE_OAL[b]
        return v < bv ? m : b
      }),
    },
    {
      metric: 'SC (WMC)',
      desc: 'Smart Contract Complexity',
      vals: modes.map(m => BASELINE_SC[m]),
      best: modes.reduce((b, m) => BASELINE_SC[m] < BASELINE_SC[b] ? m : b),
    },
    {
      metric: 'Witness avg (ms)',
      desc: 'ZK Witness Generation',
      vals: modes.map(m => fmtMs(modesData?.[m]?.metrics?.OAL?.averageWitnessMs ?? '—')),
      best: null,
    },
    {
      metric: 'Proof gen avg (ms)',
      desc: 'ZK Proof Generation',
      vals: modes.map(m => fmtMs(modesData?.[m]?.metrics?.OAL?.averageProofMs ?? '—')),
      best: null,
    },
    {
      metric: 'Accepted ballots',
      desc: 'Accepted / Submitted',
      vals: modes.map(m => {
        const bvc = modesData?.[m]?.metrics?.BVC
        if (!bvc) return '—'
        return `${bvc.acceptedBallots}/${bvc.submittedBallots}`
      }),
      best: null,
    },
    {
      metric: 'Feasibility',
      desc: 'Under current requirements',
      vals: modes.map(m => {
        const f = feasibility?.[m]
        if (!f) return '—'
        if (!f.feasible) return '✗ Eliminated'
        if (f.caution) return '⚠ Caution'
        return '✓ Feasible'
      }),
      best: null,
    },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">Mode Comparison</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 w-1/3">Metric</th>
            {modes.map(m => (
              <th key={m} className={`px-4 py-2.5 text-xs font-medium text-center ${
                recommended === m ? 'text-blue-600' : 'text-slate-500'
              }`}>
                Mode {m} {recommended === m && '★'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="px-4 py-2.5">
                <div className="font-medium text-slate-700 text-xs">{row.metric}</div>
                <div className="text-slate-400 text-xs">{row.desc}</div>
              </td>
              {modes.map((m, j) => {
                const isBest = row.best === m
                const isElim = feasibility?.[m]?.feasible === false
                return (
                  <td key={m} className={`px-4 py-2.5 text-center text-xs font-mono ${
                    isElim ? 'text-slate-300' :
                    isBest ? 'text-green-600 font-semibold' : 'text-slate-700'
                  }`}>
                    {row.vals[j]}
                    {isBest && !isElim && <span className="ml-1 text-green-500 text-xs">↓</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
