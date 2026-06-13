import { useState, useEffect, useMemo } from 'react'
import AppHeader from '../components/AppHeader.jsx'
import FeasibilityGate from '../components/FeasibilityGate.jsx'
import RecommendationCard from '../components/RecommendationCard.jsx'
import MetricsCharts from '../components/MetricsCharts.jsx'
import ModeComparisonTable from '../components/ModeComparisonTable.jsx'
import SecondaryMeasurements from '../components/SecondaryMeasurements.jsx'
import { loadComparison, loadBaselines, loadRunHistory } from '../lib/loadJson.js'
import { buildRecommendation } from '../lib/metricsMapper.js'
import { getVoterScale } from '../lib/scenarioMatcher.js'

const BATD_OPTIONS = ['Authority-reliant', 'Authority-constrained', 'Publicly verifiable']
const OC_OPTIONS   = ['Minimal', 'Moderate', 'Advanced']

const DEFAULT_CFG = { n: 1000, q: 10, s: 2, batd: 'Authority-constrained', oc: 'Moderate', trusteeCount: 5, approvalThreshold: 3 }

export default function DashboardPage() {
  const [comparison, setComparison] = useState(null)
  const [baselines, setBaselines] = useState(null)
  const [history, setHistory] = useState([])
  const [cfg, setCfg] = useState(DEFAULT_CFG)

  useEffect(() => {
    loadComparison().then(d => { if (d) setComparison(d) })
    loadBaselines().then(d => { if (d) setBaselines(d) })
    loadRunHistory().then(d => { if (Array.isArray(d)) setHistory(d) })
  }, [])

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))
  const numSet = (k, v) => set(k, v === '' ? '' : Number(v))
  const VS = cfg.n ? getVoterScale(Number(cfg.n)) : '—'

  const matchedRun = useMemo(() => {
    if (!history.length) return null
    const n = Number(cfg.n), q = Number(cfg.q), s = Number(cfg.s)
    const matches = history.filter(r =>
      Number(r.config.n) === n && Number(r.config.q) === q && Number(r.config.s) === s
    )
    return matches.length ? matches[matches.length - 1] : null
  }, [history, cfg.n, cfg.q, cfg.s])

  const { feasibility, feasibleModes, eliminatedModes, recommended, reasoning } =
    buildRecommendation(cfg.batd, cfg.oc, matchedRun?.modesData ?? comparison?.modes)

  function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { setComparison(JSON.parse(ev.target.result)) } catch {}
    }
    reader.readAsText(file)
  }

  const modesData  = matchedRun?.modesData ?? comparison?.modes ?? null
  const runConfig  = matchedRun?.config ?? comparison?.config ?? null
  const dataSource = matchedRun ? 'history' : comparison ? 'latest' : null

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      {/* Config bar */}
      <div className="bg-white border-b border-slate-200 sticky top-14 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap gap-4 items-end">
          {/* Scenario */}
          <div className="flex gap-3 items-end">
            <SmallField label="n">
              <input type="number" value={cfg.n} onChange={e => numSet('n', e.target.value)}
                className="w-20 border border-slate-200 rounded px-2 py-1 text-sm" />
            </SmallField>
            <SmallField label="q">
              <input type="number" value={cfg.q} onChange={e => numSet('q', e.target.value)}
                className="w-16 border border-slate-200 rounded px-2 py-1 text-sm" />
            </SmallField>
            <SmallField label="s">
              <input type="number" value={cfg.s} onChange={e => numSet('s', e.target.value)}
                className="w-14 border border-slate-200 rounded px-2 py-1 text-sm" />
            </SmallField>
            <div className="text-xs text-slate-400 pb-1.5">VS: <strong>{VS}</strong></div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          {/* Requirements */}
          <div className="flex gap-3 items-end">
            <SmallField label="BATD">
              <select value={cfg.batd} onChange={e => set('batd', e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-sm bg-white">
                {BATD_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </SmallField>
            <SmallField label="OC">
              <select value={cfg.oc} onChange={e => set('oc', e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-sm bg-white">
                {OC_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </SmallField>
            <SmallField label="Threshold (approvals/trustees)">
              <div className="flex gap-1 items-center">
                <input type="number" min="1" max={Math.max(1, cfg.trusteeCount - 1)} value={cfg.approvalThreshold}
                  onChange={e => numSet('approvalThreshold', e.target.value)}
                  className="w-12 border border-slate-200 rounded px-2 py-1 text-sm" />
                <span className="text-slate-400 text-sm">/</span>
                <input type="number" min="2" max="19" value={cfg.trusteeCount}
                  onChange={e => numSet('trusteeCount', e.target.value)}
                  className="w-12 border border-slate-200 rounded px-2 py-1 text-sm" />
                {['2/3','3/5','4/7'].includes(`${cfg.approvalThreshold}/${cfg.trusteeCount}`) && (
                  <span className="text-xs text-green-600 ml-1">✓</span>
                )}
              </div>
            </SmallField>
          </div>

          <div className="ml-auto flex gap-2 items-center pb-0.5">
            <label className="text-xs text-blue-600 cursor-pointer hover:underline">
              Import run-summary
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
            {runConfig && dataSource === 'history' && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                Dữ liệu thực: n={runConfig.n} q={runConfig.q} s={runConfig.s} — {Object.keys(modesData ?? {}).map(m => `Mode ${m}`).join(', ')} (phần còn lại dùng baseline)
              </span>
            )}
            {runConfig && dataSource === 'latest' && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                Lần chạy gần nhất: n={runConfig.n} q={runConfig.q} s={runConfig.s}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        <FeasibilityGate feasibility={feasibility} />
        <RecommendationCard
          recommended={recommended}
          feasibleModes={feasibleModes}
          reasoning={reasoning}
        />
        <MetricsCharts modesData={modesData} baselines={baselines} feasibility={feasibility} />
        <ModeComparisonTable modesData={modesData} feasibility={feasibility} recommended={recommended} />
        <SecondaryMeasurements
          baselines={baselines}
          config={{ n: cfg.n, q: cfg.q, s: cfg.s, VS, threshold: { trusteeCount: cfg.trusteeCount, approvalThreshold: cfg.approvalThreshold } }}
          recommended={recommended}
        />

      </div>
    </div>
  )
}

function SmallField({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs text-slate-500">{label}</label>
      {children}
    </div>
  )
}
