import { applyFeasibilityRules, getFeasibleModes, getEliminatedModes } from './feasibilityRules.js'

const BASELINE_BVC = { A: 53987, B: 261924, C: 83855 }
const BASELINE_OAL = { A: 1200,  B: 1250,   C: 1450  }
const BASELINE_SC  = { A: 18,    B: 18,     C: 24    }

export function buildRecommendation(batd, oc, modesData) {
  const feasibility = applyFeasibilityRules(batd, oc)
  const feasibleModes = getFeasibleModes(feasibility)
  const eliminatedModes = getEliminatedModes(feasibility)

  if (feasibleModes.length === 0) {
    return { feasibility, feasibleModes, eliminatedModes, recommended: null, reasoning: 'No feasible mode under current requirements.' }
  }

  // Score each feasible mode: lower BVC + lower OAL = better
  const scores = feasibleModes.map(mode => {
    const bvc = modesData?.[mode]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? BASELINE_BVC[mode]
    const oal = modesData?.[mode]?.metrics?.OAL?.averageEndToEndMs ?? BASELINE_OAL[mode]
    return { mode, bvc, oal }
  })

  const maxBvc = Math.max(...scores.map(s => s.bvc))
  const maxOal = Math.max(...scores.map(s => s.oal))

  const withScore = scores.map(s => ({
    ...s,
    score: (s.bvc / maxBvc) * 0.6 + (s.oal / maxOal) * 0.4,
  }))
  withScore.sort((a, b) => a.score - b.score)

  const best = withScore[0]
  const caution = feasibility[best.mode]?.caution

  const reasoning = caution
    ? `Mode ${best.mode} recommended with caution — lowest weighted cost among feasible modes (BVC: ${best.bvc.toLocaleString()} gas, OAL: ${best.oal.toFixed(0)} ms). Note: OC = Moderate requires careful trustee coordination.`
    : `Mode ${best.mode} recommended — lowest weighted cost among feasible modes (BVC: ${best.bvc.toLocaleString()} gas, OAL: ${best.oal.toFixed(0)} ms).`

  return { feasibility, feasibleModes, eliminatedModes, recommended: best.mode, reasoning, scores: withScore }
}

export function getBaselineBVC() { return BASELINE_BVC }
export function getBaselineOAL() { return BASELINE_OAL }
export function getBaselineSC()  { return BASELINE_SC  }
