import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { fmtGas, fmtMs } from '../lib/formatters.js'

const MODE_COLORS = { A: '#2563eb', B: '#7c3aed', C: '#059669' }
const FADED = '#cbd5e1'

function MetricBar({ title, data, formatter, note, feasibility }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      {note && <p className="text-xs text-slate-400 mb-3">{note}</p>}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="mode" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatter(v).replace(' ms','').replace(',','')} width={50} />
          <Tooltip formatter={(v) => formatter(v)} />
          <Bar dataKey="value" radius={[4,4,0,0]}>
            {data.map((d) => (
              <Cell
                key={d.mode}
                fill={feasibility?.[d.mode]?.feasible === false ? FADED : MODE_COLORS[d.mode]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function MetricsCharts({ modesData, baselines, feasibility }) {
  const modes = ['A', 'B', 'C']

  const bvcData = modes.map(m => ({
    mode: `Mode ${m}`,
    value: modesData?.[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? baselines?.bvcPerBallot?.[m] ?? 0,
  }))

  const oalData = modes.map(m => ({
    mode: `Mode ${m}`,
    value: modesData?.[m]?.metrics?.OAL?.averageEndToEndMs ?? baselines?.oalBaseline?.[m] ?? 0,
  }))

  const feasibilityForChart = {}
  modes.forEach(m => {
    feasibilityForChart[`Mode ${m}`] = feasibility?.[m] ?? { feasible: true }
  })

  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricBar
        title="BVC — Ballot Verification Cost (gas/ballot)"
        data={bvcData}
        formatter={fmtGas}
        feasibility={feasibilityForChart}
      />
      <MetricBar
        title="OAL — Online Acceptance Latency (ms/ballot)"
        data={oalData}
        formatter={fmtMs}
        note="Measured in local Hardhat environment."
        feasibility={feasibilityForChart}
      />
    </div>
  )
}
