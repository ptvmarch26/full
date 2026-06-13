import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import ModeProgressPanel from '../components/ModeProgressPanel.jsx'
import PipelineStepper from '../components/PipelineStepper.jsx'
import StageLogs from '../components/StageLogs.jsx'
import FinalResultsChart from '../components/FinalResultsChart.jsx'
import { loadProgress, loadComparison } from '../lib/loadJson.js'
import { getVoterScale } from '../lib/scenarioMatcher.js'
import { fmtGas, fmtMs, fmtDuration } from '../lib/formatters.js'

const SAMPLE_CONFIG = {
  n: 1000, q: 10, s: 2,
  modes: ['A', 'B', 'C'],
  batd: 'Authority-constrained',
  oc: 'Moderate',
  trusteeCount: 5,
  approvalThreshold: 3,
}

const BATD_OPTIONS = ['Authority-reliant', 'Authority-constrained', 'Publicly verifiable']
const OC_OPTIONS   = ['Minimal', 'Moderate', 'Advanced']

function validate(cfg) {
  const errs = {}
  if (!cfg.n || cfg.n < 1)                          errs.n = 'n ≥ 1'
  if (!cfg.q || cfg.q < 2)                          errs.q = 'q ≥ 2'
  if (!cfg.s || cfg.s < 1)                          errs.s = 's ≥ 1'
  if (cfg.s > cfg.q)                                errs.s = 's ≤ q'
  if (!cfg.trusteeCount || cfg.trusteeCount < 2)    errs.trusteeCount = '≥ 2'
  if (cfg.trusteeCount > 19)                        errs.trusteeCount = '≤ 19 (Hardhat limit)'
  if (!cfg.approvalThreshold || cfg.approvalThreshold < 1) errs.approvalThreshold = '≥ 1'
  if (cfg.approvalThreshold >= cfg.trusteeCount)    errs.approvalThreshold = '< trustees (threshold scheme)'
  if (!cfg.modes || cfg.modes.length === 0)         errs.modes = 'Select at least one mode'
  return errs
}

export default function RunPage() {
  const navigate = useNavigate()
  const [cfg, setCfg] = useState(SAMPLE_CONFIG)
  const [errors, setErrors] = useState({})
  const [running, setRunning]   = useState(false)
  const [progress, setProgress] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [showProgress, setShowProgress] = useState(false)
  const pollRef = useRef(null)

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))
  const numSet = (k, v) => set(k, v === '' ? '' : Number(v))

  const VS = cfg.n ? getVoterScale(Number(cfg.n)) : '—'

  // Poll progress while running
  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(async () => {
        const p = await loadProgress()
        if (p) setProgress(p)
        const runModes = p?.modes ? Object.keys(p.modes) : []
        const allDone = runModes.length > 0 && runModes.every(m => p.modes[m]?.status === 'completed')
        const anyError = runModes.some(m => p?.modes?.[m]?.status === 'error')
        if (p?.status === 'completed' || allDone || anyError) {
          clearInterval(pollRef.current)
          setRunning(false)
          const cmp = await loadComparison()
          if (cmp) setComparison(cmp)
        }
      }, 2000)
    }
    return () => clearInterval(pollRef.current)
  }, [running])

  async function handleRun() {
    const errs = validate(cfg)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const body = {
      n: Number(cfg.n), q: Number(cfg.q), s: Number(cfg.s),
      modes: cfg.modes,
      VS,
      batd: cfg.batd, oc: cfg.oc,
      threshold: { trusteeCount: Number(cfg.trusteeCount), approvalThreshold: Number(cfg.approvalThreshold) },
    }

    const selectedModes = Array.isArray(cfg.modes) ? cfg.modes : [cfg.modes]
    const initialModes = {}
    selectedModes.forEach((m, i) => {
      initialModes[m] = { status: i === 0 ? 'running' : 'pending', currentStage: i === 0 ? 'setup' : null }
    })

    setShowProgress(true)
    setRunning(true)
    setProgress({
      status: 'running', currentMode: selectedModes[0],
      modes: initialModes,
    })

    try {
      await fetch('/api/run-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      setRunning(false)
    }
  }

  function handleStop() {
    fetch('/api/stop-demo', { method: 'POST' }).catch(() => {})
    clearInterval(pollRef.current)
    setRunning(false)
  }

  function handleLoadSample() {
    setCfg(SAMPLE_CONFIG)
    setErrors({})
  }

  function handleReset() {
    setCfg({ n: '', q: '', s: '', modes: ['A'], batd: 'Authority-reliant', oc: 'Minimal', trusteeCount: 3, approvalThreshold: 2 })
    setErrors({})
    setShowProgress(false)
    setProgress(null)
    setComparison(null)
  }

  function handleExport() {
    const data = {
      electionId: 'ELC2026',
      n: Number(cfg.n), q: Number(cfg.q), s: Number(cfg.s),
      VS,
      modes: cfg.modes,
      BATD: cfg.batd, OC: cfg.oc,
      threshold: { trusteeCount: Number(cfg.trusteeCount), approvalThreshold: Number(cfg.approvalThreshold) },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'run-config.json'
    a.click()
  }

  const runningModes = progress?.modes ? Object.keys(progress.modes) : []
  const allDone = progress?.status === 'completed' ||
    (runningModes.length > 0 && runningModes.every(m => progress.modes[m]?.status === 'completed'))

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-5">

        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Run Simulation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure the election scenario and run the end-to-end pipeline for all 3 modes.
          </p>
        </div>

        {/* Section: Election Scenario */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Election Scenario</h2>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Voters (n)" error={errors.n}>
              <input type="number" min="1" value={cfg.n}
                onChange={e => numSet('n', e.target.value)}
                className={inputCls(errors.n)} />
              <div className="space-y-0.5 mt-1">
                {cfg.n && <span className="text-xs text-slate-400 block">VS: {VS}</span>}
                {cfg.n > 1000 && (cfg.modes.includes('B') || cfg.modes.includes('C')) && (
                  <span className="text-xs text-amber-600 block">Mode B/C capped at 1,000</span>
                )}
              </div>
            </Field>
            <Field label="Candidates (q)" error={errors.q}>
              <input type="number" min="2" value={cfg.q}
                onChange={e => numSet('q', e.target.value)}
                className={inputCls(errors.q)} />
            </Field>
            <Field label="Selections (s)" error={errors.s}>
              <input type="number" min="1" value={cfg.s}
                onChange={e => numSet('s', e.target.value)}
                className={inputCls(errors.s)} />
            </Field>
          </div>

          {/* Simulation constraints info */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 space-y-1">
            <p className="text-xs text-slate-600 font-medium">Simulation constraints (pre-compiled circuits)</p>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5">
              <span className="text-xs font-mono text-slate-600">Mode A: q=10, n≤1,000,000</span>
              <span className="text-xs font-mono text-slate-600">Mode B: q=10, n≤1,000</span>
              <span className="text-xs font-mono text-slate-600">Mode C: q=2, n≤1,000</span>
            </div>
            <p className="text-xs text-slate-400">q/s inputs are for dashboard analysis only. Simulation always uses circuit-compiled q per mode.</p>
          </div>

          <Field label="Modes to run" error={errors.modes}>
            <div className="flex gap-4 flex-wrap">
              {['A', 'B', 'C'].map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" value={m}
                    checked={cfg.modes.includes(m)}
                    onChange={e => {
                      const checked = e.target.checked
                      set('modes', checked
                        ? [...cfg.modes, m].sort()
                        : cfg.modes.filter(x => x !== m)
                      )
                    }}
                    className="accent-blue-600 w-4 h-4" />
                  <span className="text-sm text-slate-700">Mode {m}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>

        {/* Section: Requirements */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Requirements</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="BATD">
              <select value={cfg.batd} onChange={e => set('batd', e.target.value)} className={inputCls()}>
                {BATD_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="OC">
              <select value={cfg.oc} onChange={e => set('oc', e.target.value)} className={inputCls()}>
                {OC_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">Threshold (Mode C only)</p>
              <span className="text-xs text-slate-400">2 ≤ trustees ≤ 19 · approvals &lt; trustees</span>
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Field label="Total Trustees" error={errors.trusteeCount}>
                <input type="number" min="2" max="19" value={cfg.trusteeCount}
                  onChange={e => numSet('trusteeCount', e.target.value)}
                  className={inputCls(errors.trusteeCount)} />
              </Field>
              <Field label="Required Approvals" error={errors.approvalThreshold}>
                <input type="number" min="1" max={cfg.trusteeCount - 1} value={cfg.approvalThreshold}
                  onChange={e => numSet('approvalThreshold', e.target.value)}
                  className={inputCls(errors.approvalThreshold)} />
              </Field>
              <div className="pb-1 flex flex-col gap-1">
                <span className="text-sm font-mono bg-slate-100 px-3 py-2 rounded text-slate-700 block text-center">
                  {cfg.approvalThreshold}/{cfg.trusteeCount}
                </span>
                {['2/3','3/5','4/7'].includes(`${cfg.approvalThreshold}/${cfg.trusteeCount}`) && (
                  <span className="text-xs text-green-600 text-center">✓ baseline scenario</span>
                )}
              </div>
            </div>
            <div className="mt-2 space-y-0.5">
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-500">Mode C</span> — configurable, re-generates DKG keys per run.
              </p>
              <p className="text-xs text-slate-400">
                <span className="font-medium text-slate-500">Mode A / B</span> — fixed <span className="font-mono">2-of-3</span> trustee scheme, threshold input ignored.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={handleRun} disabled={running}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {running ? <><span className="animate-spin">⟳</span> Running…</> : '▶ Run Simulation'}
          </button>
          {running && (
            <button onClick={handleStop}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors">
              Stop
            </button>
          )}
          {showProgress && (
            <a href="/api/runner-log" target="_blank" rel="noreferrer"
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 text-sm rounded-lg transition-colors">
              View Log
            </a>
          )}
          <button onClick={handleLoadSample}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors">
            Load Sample
          </button>
          <button onClick={handleReset}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors">
            Reset
          </button>
          <button onClick={handleExport}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm rounded-lg transition-colors">
            Export run-config.json
          </button>
        </div>

        {/* Progress Panel */}
        {showProgress && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Progress</h2>
              {running && <span className="text-xs text-blue-500 animate-pulse">Polling every 2s…</span>}
            </div>
            <ModeProgressPanel progress={progress} comparison={comparison} />
          </div>
        )}

        {/* Results — shown after simulation completes */}
        {allDone && comparison && (
          <>
            {/* Stage Results */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Stage Results</h2>
              <div className={`grid gap-4 ${runningModes.length === 1 ? 'grid-cols-1 max-w-sm' : runningModes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {runningModes.map(m => {
                  const md = comparison.modes?.[m]
                  return (
                    <div key={m} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-slate-700 text-sm">Mode {m}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          md?.status === 'completed' ? 'bg-green-100 text-green-700' :
                          md?.status === 'error'     ? 'bg-red-100 text-red-600' :
                          'bg-slate-100 text-slate-400'
                        }`}>{md?.status ?? 'no data'}</span>
                      </div>
                      <PipelineStepper modeData={md} mode={m} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Performance Summary */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">Performance Summary</h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500 font-medium">Metric</th>
                    {runningModes.map(m => (
                      <th key={m} className="text-center px-4 py-2 text-slate-500 font-medium">Mode {m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total runtime',      fn: m => fmtDuration(comparison.modes?.[m]?.pipeline?.totalDurationMs) },
                    { label: 'Submitted ballots',  fn: m => comparison.modes?.[m]?.metrics?.BVC?.submittedBallots ?? '—' },
                    { label: 'Accepted ballots',   fn: m => comparison.modes?.[m]?.metrics?.BVC?.acceptedBallots ?? '—' },
                    { label: 'Failed ballots',     fn: m => comparison.modes?.[m]?.metrics?.BVC?.failedBallots ?? '—' },
                    { label: 'Total gas used',     fn: m => fmtGas(comparison.modes?.[m]?.metrics?.BVC?.totalGasUsed) },
                    { label: 'Avg gas/ballot',     fn: m => fmtGas(comparison.modes?.[m]?.metrics?.BVC?.averageGasPerAcceptedBallot) },
                    { label: 'Avg OAL',            fn: m => fmtMs(comparison.modes?.[m]?.metrics?.OAL?.averageEndToEndMs) },
                    { label: 'Avg witness time',   fn: m => fmtMs(comparison.modes?.[m]?.metrics?.OAL?.averageWitnessMs) },
                    { label: 'Avg proof gen time', fn: m => fmtMs(comparison.modes?.[m]?.metrics?.OAL?.averageProofMs) },
                  ].map(row => (
                    <tr key={row.label} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600">{row.label}</td>
                      {runningModes.map(m => (
                        <td key={m} className="px-4 py-2 text-center font-mono text-slate-700">{row.fn(m)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Final Vote Counts */}
            <FinalResultsChart modesData={comparison.modes} />

            {/* Stage Logs */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Stage Logs</h2>
              <StageLogs />
            </div>

            <div className="flex justify-end">
              <button onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
                View Dashboard →
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}

function inputCls(err) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${
    err ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
  }`
}
