const SCENARIOS = [
  { id: 'S1', n: 256,   q: 2,  s: 1, threshold: null },
  { id: 'S2', n: 5000,  q: 2,  s: 1, threshold: null },
  { id: 'S3', n: 10000, q: 2,  s: 1, threshold: null },
  { id: 'S4', n: 1000,  q: 4,  s: 1, threshold: null },
  { id: 'S5', n: 1000,  q: 8,  s: 1, threshold: null },
  { id: 'S6', n: 1000,  q: 10, s: 2, threshold: null },
  { id: 'S7', n: 1000,  q: 2,  s: 1, threshold: '2/3' },
  { id: 'S8', n: 1000,  q: 2,  s: 1, threshold: '3/5' },
  { id: 'S9', n: 1000,  q: 2,  s: 1, threshold: '4/7' },
]

export function matchScenario(n, q, s, trusteeCount, approvalThreshold) {
  const thresholdStr = trusteeCount && approvalThreshold
    ? `${approvalThreshold}/${trusteeCount}`
    : null

  const exact = SCENARIOS.find(sc =>
    sc.n === n && sc.q === q && sc.s === s && sc.threshold === thresholdStr
  )
  if (exact) return { matched: exact, isExact: true }

  const noThreshold = SCENARIOS.find(sc =>
    sc.n === n && sc.q === q && sc.s === s && sc.threshold === null
  )
  if (noThreshold) return { matched: noThreshold, isExact: false }

  let best = null
  let bestScore = Infinity
  for (const sc of SCENARIOS) {
    const score = Math.abs(sc.n - n) / 1000 + Math.abs(sc.q - q) + Math.abs(sc.s - s)
    if (score < bestScore) { bestScore = score; best = sc }
  }
  return { matched: best, isExact: false }
}

export function getVoterScale(n) {
  if (n < 1000) return 'Small'
  if (n <= 50000) return 'Medium'
  if (n <= 500000) return 'Large'
  return 'Very Large'
}
