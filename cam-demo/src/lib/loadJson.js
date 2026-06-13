export async function loadJson(url) {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function loadComparison() {
  return loadJson('/runs/latest/comparison.json')
}

export async function loadProgress() {
  return loadJson('/runs/latest/progress.json')
}

export async function loadStageLogs(mode) {
  return loadJson(`/runs/latest/mode-${mode.toLowerCase()}/stage-logs.json`)
}

export async function loadBaselines() {
  return loadJson('/data/experimental-baselines.json')
}

export async function loadRunHistory() {
  return loadJson('/data/run-history.json')
}
