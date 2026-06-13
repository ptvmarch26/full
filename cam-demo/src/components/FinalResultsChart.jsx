import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MODE_COLORS = { A: '#2563eb', B: '#7c3aed', C: '#059669' }

function ResultTable({ counts }) {
  return (
    <table className="w-full text-xs mt-3">
      <thead>
        <tr className="text-slate-500 border-b border-slate-100">
          <th className="text-left py-1.5">Candidate</th>
          <th className="text-right py-1.5">Votes</th>
          <th className="text-right py-1.5">%</th>
        </tr>
      </thead>
      <tbody>
        {counts.map(c => (
          <tr key={c.candidateId} className="border-b border-slate-50">
            <td className="py-1.5 text-slate-700">{c.candidateName ?? `Candidate ${c.candidateId}`}</td>
            <td className="py-1.5 text-right font-mono text-slate-700">{c.votes}</td>
            <td className="py-1.5 text-right font-mono text-slate-500">{c.percentage?.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function FinalResultsChart({ modesData }) {
  const modes = ['A','B','C'].filter(m => modesData?.[m]?.results?.finalCounts?.length)
  if (modes.length === 0) return <div className="text-xs text-slate-400">No results available.</div>

  return (
    <div className="space-y-4">
      {modes.map(m => {
        const counts = modesData[m].results.finalCounts
        const bvc = modesData[m].metrics?.BVC
        const chartData = counts.map(c => ({
          name: c.candidateName ?? `Cand. ${c.candidateId}`,
          votes: c.votes,
        }))
        return (
          <div key={m} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Mode {m} — Final Vote Counts</h3>
              {bvc && (
                <span className="text-xs text-slate-400">
                  {bvc.acceptedBallots}/{bvc.submittedBallots} accepted
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="votes" radius={[3,3,0,0]} fill={MODE_COLORS[m]} />
              </BarChart>
            </ResponsiveContainer>
            <ResultTable counts={counts} />
          </div>
        )
      })}
    </div>
  )
}
