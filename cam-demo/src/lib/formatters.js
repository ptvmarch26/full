export function fmtMs(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function fmtDuration(ms) {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  if (m === 0) return `${s}s`
  return `${m}m ${s % 60}s`
}

export function fmtGas(gas) {
  if (gas == null) return '—'
  return Number(gas).toLocaleString()
}

export function fmtPct(pct) {
  if (pct == null) return '—'
  return `${Number(pct).toFixed(1)}%`
}

export function fmtTimestamp(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString()
}
