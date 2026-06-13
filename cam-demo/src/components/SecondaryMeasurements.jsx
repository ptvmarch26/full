export default function SecondaryMeasurements({ baselines, config, recommended }) {
  const circuitDefs  = baselines?.zc?.circuits ?? {}
  const zcByMode     = baselines?.zc?.byMode ?? {}
  const sc           = baselines?.sc ?? {}
  const threshold    = config?.threshold
  const thresholdStr = threshold ? `${threshold.approvalThreshold}/${threshold.trusteeCount}` : null
  const BASELINE_THRESHOLDS = ['2/3','3/5','4/7']
  const isBaselineThreshold = BASELINE_THRESHOLDS.includes(thresholdStr)

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Secondary Measurements</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* SC */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">SC — Smart Contract Complexity</div>
          <div className="flex gap-3">
            {['A','B','C'].map(m => (
              <div key={m} className={`flex-1 text-center rounded-lg p-2 ${
                recommended === m ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'
              }`}>
                <div className="text-xs text-slate-500">Mode {m}</div>
                <div className="text-lg font-bold text-slate-700">{sc[m] ?? '—'}</div>
                <div className="text-xs text-slate-400">WMC</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Weighted Method Count from static analysis.</p>
        </div>

        {/* THO */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">THO — Threshold Overhead</div>

          {/* Fixed schemes for Mode A/B */}
          <div className="flex gap-2 mb-3">
            {['A','B'].map(m => (
              <div key={m} className="flex-1 text-center rounded-lg p-2 bg-slate-50 border border-slate-100">
                <div className="text-xs text-slate-500 mb-0.5">Mode {m}</div>
                <div className="font-mono font-bold text-slate-600 text-sm">2 / 3</div>
                <div className="text-xs text-slate-400">fixed</div>
              </div>
            ))}
            <div className="flex-1 text-center rounded-lg p-2 bg-blue-50 border border-blue-200">
              <div className="text-xs text-slate-500 mb-0.5">Mode C</div>
              <div className="font-mono font-bold text-blue-700 text-sm">{thresholdStr ?? '—'}</div>
              <div className="text-xs text-slate-400">configurable</div>
            </div>
          </div>

          {threshold && (
            <div className="mb-2">
              {isBaselineThreshold
                ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Mode C matches baseline scenario</span>
                : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Mode C: custom threshold — no exact baseline</span>
              }
            </div>
          )}
          <p className="text-xs text-slate-400">THO is relevant to Mode C. Mode A/B use fixed 2-of-3.</p>
        </div>

        {/* ZC */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">ZC — Circuit-level Workload</div>
          <div className="grid grid-cols-3 gap-3">
            {['A', 'B', 'C'].map(m => {
              const modeCircuits = (zcByMode[m] ?? []).map(name => ({ name, ...(circuitDefs[name] ?? {}) }))
              const totalConstraints = modeCircuits.reduce((s, c) => s + (c.constraints ?? 0), 0)
              return (
                <div key={m} className={`rounded-lg border p-3 ${
                  recommended === m ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-slate-50'
                }`}>
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Mode {m}
                    <span className="ml-2 font-normal text-slate-400">{totalConstraints.toLocaleString()} constraints total</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {modeCircuits.map(c => (
                        <tr key={c.name} className="border-b border-slate-100 last:border-0">
                          <td className="py-1 font-mono text-slate-600 text-xs">{c.name}</td>
                          <td className="py-1 text-right text-slate-500 tabular-nums">{(c.constraints ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-xs text-slate-400">
                    {modeCircuits.reduce((s, c) => s + (c.totalStorageMB ?? 0), 0).toFixed(1)} MB &nbsp;·&nbsp;
                    {modeCircuits.reduce((s, c) => s + (c.totalTimeSec ?? 0), 0).toFixed(1)}s setup
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3">ZC measures the ZK proof setup workload per mode. Higher constraints = heavier computation.</p>
        </div>

        {/* MSG */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">MSG — Merkle Setup Growth</div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-700">{config?.n?.toLocaleString() ?? '—'}</div>
              <div className="text-xs text-slate-500">voters</div>
            </div>
            <div className="text-2xl text-slate-300">→</div>
            <div>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                config?.VS === 'Small'     ? 'bg-green-100 text-green-700' :
                config?.VS === 'Medium'    ? 'bg-blue-100 text-blue-700' :
                config?.VS === 'Large'     ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {config?.VS ?? '—'} Scale
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">MSG is common to all modes. Merkle tree build and proof generation time grow with voter scale.</p>
        </div>
      </div>
    </div>
  )
}
