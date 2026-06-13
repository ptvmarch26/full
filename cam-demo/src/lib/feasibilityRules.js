export function applyFeasibilityRules(batd, oc) {
  const results = {
    A: { feasible: true, caution: false, reasons: [] },
    B: { feasible: true, caution: false, reasons: [] },
    C: { feasible: true, caution: false, reasons: [] },
  }

  if (batd === 'Authority-constrained') {
    results.A.feasible = false
    results.A.reasons.push('BATD = Authority-constrained eliminates Mode A')
  }
  if (batd === 'Publicly verifiable') {
    results.A.feasible = false
    results.A.reasons.push('BATD = Publicly verifiable: only Mode B is valid')
    results.C.feasible = false
    results.C.reasons.push('BATD = Publicly verifiable: only Mode B is valid')
  }

  if (oc === 'Minimal') {
    results.C.feasible = false
    results.C.reasons.push('OC = Minimal: Mode C requires advanced operational capability')
  }
  if (oc === 'Moderate') {
    results.C.caution = true
    results.C.reasons.push('OC = Moderate: Mode C feasible but requires careful trustee management')
  }

  return results
}

export function getFeasibleModes(feasibility) {
  return Object.entries(feasibility)
    .filter(([, v]) => v.feasible)
    .map(([k]) => k)
}

export function getEliminatedModes(feasibility) {
  return Object.entries(feasibility)
    .filter(([, v]) => !v.feasible)
    .map(([mode, v]) => ({ mode, reason: v.reasons[0] || 'Eliminated by policy' }))
}
