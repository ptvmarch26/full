/**
 * run-demo.js — End-to-end demo runner for CAM-Analyze
 *
 * Usage:
 *   node scripts/run-demo.js --config-b64 <base64-json>
 *   node scripts/run-demo.js --config ./run-config.json
 *
 * Runs Mode A → B → C sequentially.
 * For each mode: start IPFS (once) + start hardhat node → deploy → register → vote → aggregate → partial → tally
 * Writes progress to public/runs/latest/progress.json after each stage.
 * Writes comparison.json when all modes complete.
 */

const fs   = require('fs')
const path = require('path')
const net  = require('net')
const { spawnSync, spawn } = require('child_process')

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT       = path.resolve(__dirname, '..')                 // cam-demo/
const REPO_ROOT  = path.resolve(ROOT, '..')                      // D:\KLTN\full\
const PUBLIC_OUT = path.join(ROOT, 'public', 'runs', 'latest')

// Redirect all console output to a log file so errors are visible
fs.mkdirSync(PUBLIC_OUT, { recursive: true })
const LOG_FILE = path.join(PUBLIC_OUT, 'runner.log')
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' })
const _log = (...a) => { const msg = a.join(' '); process.stdout.write(msg + '\n'); logStream.write(msg + '\n') }
const _err = (...a) => { const msg = a.join(' '); process.stderr.write(msg + '\n'); logStream.write('[ERR] ' + msg + '\n') }
console.log  = _log
console.warn = _log
console.error = _err
process.on('uncaughtException', e => { _err('UNCAUGHT:', e.stack || e.message); logStream.end(); process.exit(1) })
process.on('unhandledRejection', e => { _err('UNHANDLED:', e?.stack || e); logStream.end(); process.exit(1) })

const MODE_DIRS = {
  A: path.join(REPO_ROOT, 'Mode A'),
  B: path.join(REPO_ROOT, 'Mode B'),
  C: path.join(REPO_ROOT, 'Mode C'),
}

const STOP_FLAG = path.join(PUBLIC_OUT, '.stop')

// ---------------------------------------------------------------------------
// Parse config
// ---------------------------------------------------------------------------
function parseConfig() {
  const args = process.argv.slice(2)
  const b64Idx = args.indexOf('--config-b64')
  if (b64Idx !== -1) {
    try { return JSON.parse(Buffer.from(args[b64Idx + 1], 'base64').toString()) } catch {}
  }
  const cfgIdx = args.indexOf('--config')
  if (cfgIdx !== -1) {
    try { return JSON.parse(fs.readFileSync(args[cfgIdx + 1], 'utf8')) } catch {}
  }
  return {}
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------
function initProgress(modes) {
  const modeEntries = {}
  modes.forEach(m => { modeEntries[m] = { status: 'pending', currentStage: null, detail: null } })
  writeJson(path.join(PUBLIC_OUT, 'progress.json'), {
    status: 'running', currentMode: modes[0], modes: modeEntries, updatedAt: new Date().toISOString(),
  })
}

function updateProgress(allModeProgress, currentMode) {
  writeJson(path.join(PUBLIC_OUT, 'progress.json'), {
    status: 'running', currentMode,
    modes: allModeProgress,
    updatedAt: new Date().toISOString(),
  })
}

function finalizeProgress(allModeProgress) {
  writeJson(path.join(PUBLIC_OUT, 'progress.json'), {
    status: 'completed', currentMode: null,
    modes: allModeProgress,
    updatedAt: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Port check
// ---------------------------------------------------------------------------
function isPortOpen(port) {
  return new Promise(resolve => {
    const s = net.createConnection(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); resolve(true) })
    s.on('error', () => resolve(false))
  })
}

async function checkCommandExists(cmd) {
  return new Promise(resolve => {
    const result = spawnSync(cmd, ['--version'], {
      shell: true,
      stdio: 'ignore',
    })
    resolve(result.status === 0)
  })
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
function runHardhatScript(scriptPath, modeDir, env = {}, onLine = null) {
  return new Promise((resolve) => {
    const proc = spawn(
      'npx', ['hardhat', 'run', scriptPath, '--network', 'localhost'],
      {
        cwd: modeDir,
        shell: true,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      text.split('\n').filter(l => l.trim()).forEach(line => onLine?.('stdout', line.trim()))
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      text.split('\n').filter(l => l.trim()).forEach(line => {
        if (!line.includes('DeprecationWarning') && !line.includes('ExperimentalWarning')) {
          stderr += line + '\n'
          onLine?.('stderr', line.trim())
        }
      })
    })

    const killTimer = setTimeout(() => { try { proc.kill() } catch {} }, 300000)
    proc.on('close', (code) => {
      clearTimeout(killTimer)
      resolve({ ok: code === 0, stdout, stderr })
    })
    proc.on('error', (err) => {
      clearTimeout(killTimer)
      resolve({ ok: false, stdout, stderr: err.message })
    })
  })
}

// ---------------------------------------------------------------------------
// CSV parser for vote metrics
// ---------------------------------------------------------------------------
function parseVoteCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return null
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean)
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',')
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i]?.trim() ?? '' })
    return obj
  })

  const accepted = rows.filter(r => r.resultCode === '0' || r.resultCode === '200')
  const failed   = rows.filter(r => r.resultCode !== '0' && r.resultCode !== '200')

  const avg = (arr, key) => arr.length === 0 ? 0 : arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length
  const sum = (arr, key) => arr.reduce((s, r) => s + Number(r[key] || 0), 0)

  return {
    BVC: {
      averageGasPerAcceptedBallot: Math.round(avg(accepted, 'gasUsed')),
      totalGasUsed: Math.round(sum(accepted, 'gasUsed')),
      submittedBallots: rows.length,
      acceptedBallots: accepted.length,
      failedBallots: failed.length,
    },
    OAL: {
      averageEndToEndMs:  parseFloat(avg(accepted, 'endToEndTimeMs').toFixed(2)),
      averageWitnessMs:   parseFloat(avg(accepted, 'witnessTimeMs').toFixed(2)),
      averageProofMs:     parseFloat(avg(accepted, 'proofGenerationTimeMs').toFixed(2)),
    },
  }
}

// ---------------------------------------------------------------------------
// Extract final counts from tally stdout
// ---------------------------------------------------------------------------
function extractFinalCounts(stdout) {
  const counts = []
  // look for patterns like "Candidate 1: 6 votes" or "Result: [6, 4]"
  const arrayMatch = stdout.match(/\[(\d+(?:,\s*\d+)*)\]/)
  if (arrayMatch) {
    const nums = arrayMatch[1].split(',').map(n => parseInt(n.trim()))
    const total = nums.reduce((s, v) => s + v, 0)
    nums.forEach((v, i) => {
      counts.push({
        candidateId: i + 1,
        candidateName: `Candidate ${i + 1}`,
        votes: v,
        percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
      })
    })
    return counts
  }
  // fallback: try "Candidate X = N"
  const matches = [...stdout.matchAll(/[Cc]andidate\s+(\d+)[^\d]+(\d+)/g)]
  if (matches.length > 0) {
    const total = matches.reduce((s, m) => s + parseInt(m[2]), 0)
    matches.forEach(m => {
      const v = parseInt(m[2])
      counts.push({
        candidateId: parseInt(m[1]),
        candidateName: `Candidate ${m[1]}`,
        votes: v,
        percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
      })
    })
    return counts
  }
  return []
}

// ---------------------------------------------------------------------------
// Recommendation algorithm
// ---------------------------------------------------------------------------
function computeRecommendation(batd, oc, modeResults) {
  const feasibility = { A: true, B: true, C: true }
  const eliminated = []

  if (batd === 'Authority-constrained') {
    feasibility.A = false
    eliminated.push({ mode: 'A', reason: 'BATD = Authority-constrained eliminates Mode A' })
  }
  if (batd === 'Publicly verifiable') {
    feasibility.A = false; feasibility.C = false
    eliminated.push({ mode: 'A', reason: 'BATD = Publicly verifiable: only Mode B is valid' })
    eliminated.push({ mode: 'C', reason: 'BATD = Publicly verifiable: only Mode B is valid' })
  }
  if (oc === 'Minimal') {
    feasibility.C = false
    eliminated.push({ mode: 'C', reason: 'OC = Minimal: Mode C requires advanced operational capability' })
  }

  const feasibleModes = Object.entries(feasibility).filter(([,v]) => v).map(([k]) => k)

  if (feasibleModes.length === 0) {
    return { feasibleModes: [], eliminatedModes: eliminated, recommended: null, reasoning: 'No feasible mode.' }
  }

  const BVC_BASELINE = { A: 53987, B: 261924, C: 83855 }
  const OAL_BASELINE = { A: 1200,  B: 1250,   C: 1450  }

  const scores = feasibleModes.map(m => ({
    mode: m,
    bvc: modeResults[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ?? BVC_BASELINE[m],
    oal: modeResults[m]?.metrics?.OAL?.averageEndToEndMs ?? OAL_BASELINE[m],
  }))

  const maxBvc = Math.max(...scores.map(s => s.bvc))
  const maxOal = Math.max(...scores.map(s => s.oal))
  scores.forEach(s => { s.score = (s.bvc / maxBvc) * 0.6 + (s.oal / maxOal) * 0.4 })
  scores.sort((a, b) => a.score - b.score)

  const best = scores[0]
  const cautionNote = (oc === 'Moderate' && best.mode === 'C')
    ? ' Note: OC = Moderate — careful trustee coordination required.'
    : ''
  const reasoning = `Mode ${best.mode} recommended — lowest weighted cost among feasible modes (BVC: ${best.bvc.toLocaleString()} gas, OAL: ${best.oal.toFixed(0)} ms).${cautionNote}`

  return { feasibleModes, eliminatedModes: eliminated, recommended: best.mode, reasoning }
}

// ---------------------------------------------------------------------------
// Per-mode Merkle tree depth (determines max voters) and fixed-trustee count
// ---------------------------------------------------------------------------
const MODE_PARAMS = {
  A: { depth: 20, fixedTrustees: 2, maxN: 1_000_000 },
  B: { depth: 10, fixedTrustees: 2, maxN: 1_000     },
  C: { depth: 10, maxN: 1_000                        },
}

// ---------------------------------------------------------------------------
// Circuit patching helpers
// ---------------------------------------------------------------------------
function getCircomMain(circomPath) {
  const content = fs.readFileSync(circomPath, 'utf8')
  const m = content.match(/^component main = .+;/m)
  return m ? m[0] : null
}

function patchCircomMain(circomPath, newMain) {
  let content = fs.readFileSync(circomPath, 'utf8')
  content = content.replace(/^component main = .+;/m, newMain)
  fs.writeFileSync(circomPath, content, 'utf8')
}

function runNodeScript(scriptArgs, cwd, onLine = null) {
  return new Promise((resolve) => {
    const proc = spawn('node', scriptArgs, {
      cwd,
      shell: false,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      stdout += text
      text.split('\n').filter(l => l.trim()).forEach(line => onLine?.('stdout', line.trim()))
    })

    proc.stderr.on('data', (data) => {
      const text = data.toString()
      text.split('\n').filter(l => l.trim()).forEach(line => {
        if (!line.includes('DeprecationWarning') && !line.includes('ExperimentalWarning')) {
          stderr += line + '\n'
          onLine?.('stderr', line.trim())
        }
      })
    })

    const killTimer = setTimeout(() => { try { proc.kill() } catch {} }, 900000)
    proc.on('close', (code) => {
      clearTimeout(killTimer)
      resolve({ ok: code === 0, stdout, stderr })
    })
    proc.on('error', (err) => {
      clearTimeout(killTimer)
      resolve({ ok: false, stdout, stderr: err.message })
    })
  })
}

// ---------------------------------------------------------------------------
// Run one mode end-to-end
// ---------------------------------------------------------------------------
async function runMode(mode, modeDir, config, allModeProgress, logs) {
  const mp = allModeProgress[mode]
  mp.status = 'running'

  const { depth, fixedTrustees, maxN } = MODE_PARAMS[mode]

  const effectiveN = Math.min(config.n ?? 10, maxN)
  const effectiveQ = config.q ?? (mode === 'B' ? 10 : 2)
  const effectiveS = Math.min(config.s ?? 1, effectiveQ)

  // Mode A and B use a fixed 2-of-3 trustee scheme (hardcoded in partial.js).
  // Only Mode C supports configurable threshold via DEMO_THRESHOLD / DEMO_TRUSTEES.
  const modeThreshold = mode === 'C'
    ? (config.threshold?.approvalThreshold ?? 4)
    : 2
  const modeTrustees = mode === 'C'
    ? (config.threshold?.trusteeCount ?? 7)
    : 3

  const env = {
    DEMO_N:         String(effectiveN),
    DEMO_Q:         String(effectiveQ),
    DEMO_S:         String(effectiveS),
    DEMO_THRESHOLD: String(modeThreshold),
    DEMO_TRUSTEES:  String(modeTrustees),
  }

  // ---------------------------------------------------------------------------
  // Determine if circuit recompilation is needed
  // ---------------------------------------------------------------------------
  const circuitsDir  = path.join(modeDir, 'circuits')
  const vpcPath      = path.join(circuitsDir, 'VoteProofCombined.circom')
  const tvPath       = path.join(circuitsDir, 'TallyValidity.circom')
  const tvTrustees   = mode === 'C' ? modeThreshold : fixedTrustees
  const neededVPC    = `component main = VotingCircuit(${depth}, ${effectiveQ});`
  const neededTV     = `component main = BatchTallyValidity(${tvTrustees}, ${effectiveQ});`
  const needsCompile = getCircomMain(vpcPath) !== neededVPC || getCircomMain(tvPath) !== neededTV

  const STAGES = [
    ...(needsCompile ? [{
      key: 'compile',
      label: 'Circuit Compilation',
      isCompile: true,
      scriptLabel: 'circom.js VoteProofCombined TallyValidity',
    }] : []),
    {
      key: 'setup',
      label: 'Setup',
      scripts: ['scripts/deploy.js'],
      scriptLabel: 'deploy.js',
    },
    {
      key: 'registration',
      label: 'Registration',
      scripts: ['test/register.js'],
      scriptLabel: 'register.js',
    },
    {
      key: 'vote',
      label: 'Ballot Validation & Commitment',
      scripts: ['test/vote.js'],
      scriptLabel: 'vote.js',
    },
    {
      key: 'aggregation',
      label: 'Aggregation',
      scripts: ['scripts/prepare_aggregation.js', 'test/aggregate.js'],
      scriptLabel: 'prepare_aggregation.js + aggregate.js',
    },
    {
      key: 'tally',
      label: 'Tallying & Result Revelation',
      scripts: ['test/partial.js', 'test/tally.js'],
      scriptLabel: 'partial.js + tally.js',
    },
  ]

  const stageResults = []
  let finalCounts = []
  let csvMetrics = null

  for (const stage of STAGES) {
    if (fs.existsSync(STOP_FLAG)) {
      mp.status = 'stopped'
      return null
    }

    mp.currentStage = stage.key
    mp.detail = null
    mp.stageStartedAt = new Date().toISOString()
    if (stage.key === 'compile') mp.hasCompile = true
    updateProgress(allModeProgress, mode)

    const stageStart = Date.now()
    let stageOk = true
    let stageError = null
    const stageLogs = []

    if (stage.isCompile) {
      // Patch circuit files then compile
      console.log(`[Mode ${mode}] Patching circuits: q=${effectiveQ}, tvTrustees=${tvTrustees}`)
      patchCircomMain(vpcPath, neededVPC)
      patchCircomMain(tvPath, neededTV)

      console.log(`[Mode ${mode}] Compiling VoteProofCombined + TallyValidity...`)
      const { ok } = await runNodeScript(
        ['scripts/circom.js', 'VoteProofCombined', 'TallyValidity'],
        modeDir,
        (type, msg) => {
          stageLogs.push({ stage: stage.key, type, message: msg, timestamp: new Date().toISOString() })
        }
      )

      if (!ok) {
        stageOk = false
        stageError = 'Circuit compilation failed.'
        console.error(`[Mode ${mode}] COMPILE FAILED`)
      }
    } else {
      for (const scriptPath of stage.scripts) {
        const fullPath = path.join(modeDir, scriptPath)
        if (!fs.existsSync(fullPath)) {
          console.log(`[Mode ${mode}] Skipping missing script: ${scriptPath}`)
          continue
        }

        console.log(`[Mode ${mode}] Running ${scriptPath}...`)
        let scriptStdout = ''
        const { ok } = await runHardhatScript(scriptPath, modeDir, env, (type, msg) => {
          stageLogs.push({ stage: stage.key, type, message: msg, timestamp: new Date().toISOString() })
          if (type === 'stdout') scriptStdout += msg + '\n'

          // Real-time vote progress
          if (stage.key === 'vote' && type === 'stdout') {
            const m = msg.match(/^Vote (\d+)\/(\d+):/)
            if (m) {
              mp.detail = `Vote ${m[1]}/${m[2]}`
              updateProgress(allModeProgress, mode)
            }
          }
        })

        if (!ok) {
          stageOk = false
          stageError = `Script ${scriptPath} failed.`
          console.error(`[Mode ${mode}] FAILED: ${scriptPath}`)
          break
        }

        // Extract tally results
        if (scriptPath.includes('tally.js')) {
          finalCounts = extractFinalCounts(scriptStdout)
        }
      }
    }

    logs.push(...stageLogs)

    const stageDuration = Date.now() - stageStart
    stageResults.push({
      key: stage.key,
      label: stage.label,
      script: stage.scriptLabel,
      status: stageOk ? 'completed' : 'error',
      durationMs: stageDuration,
      error: stageError,
    })

    if (!stageOk) {
      mp.status = 'error'
      mp.currentStage = stage.key
      updateProgress(allModeProgress, mode)
      return { stages: stageResults, metrics: null, results: null, error: stageError }
    }

    mp.detail = stageResults[stageResults.length - 1].durationMs
      ? `${(stageDuration / 1000).toFixed(1)}s`
      : null
    updateProgress(allModeProgress, mode)
  }

  // Parse CSV metrics after vote stage
  const csvPath = path.join(modeDir, 'data', 'vote_submission_times.csv')
  csvMetrics = parseVoteCsv(csvPath)

  // Copy output artifacts
  const outDir = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`)
  ensureDir(outDir)
  const filesToCopy = [
    ['data/vote.json', 'vote.json'],
    ['data/aggregation.json', 'aggregation.json'],
    ['data/vote_submission_times.csv', 'vote_submission_times.csv'],
  ]
  for (const [src, dst] of filesToCopy) {
    const srcPath = path.join(modeDir, src)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(outDir, dst))
    }
  }
  writeJson(path.join(outDir, 'stage-logs.json'), logs.filter(l => true))

  mp.status = 'completed'
  mp.currentStage = null
  updateProgress(allModeProgress, mode)

  const totalDuration = stageResults.reduce((s, st) => s + (st.durationMs ?? 0), 0)

  return {
    status: 'completed',
    pipeline: {
      totalDurationMs: totalDuration,
      startedAt: new Date(Date.now() - totalDuration).toISOString(),
      finishedAt: new Date().toISOString(),
    },
    stages: stageResults,
    metrics: csvMetrics ?? {
      BVC: { averageGasPerAcceptedBallot: 0, totalGasUsed: 0, submittedBallots: 0, acceptedBallots: 0, failedBallots: 0 },
      OAL: { averageEndToEndMs: 0, averageWitnessMs: 0, averageProofMs: 0 },
    },
    results: {
      finalCounts,
      revealedOnChain: finalCounts.length > 0,
    },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  ensureDir(PUBLIC_OUT)

  // Clear stop flag
  if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG)

  const config = parseConfig()
  const modesToRun = config.modes === 'all' || !config.modes
    ? ['A', 'B', 'C']
    : Array.isArray(config.modes) ? config.modes : [config.modes]

  console.log(`[run-demo] Config: n=${config.n} q=${config.q} s=${config.s} modes=${modesToRun.join(',')}`)

  // --- Start IPFS daemon once ---
  let ipfsProc = null
  const ipfsAlreadyRunning = await isPortOpen(5001)
  
  if (!ipfsAlreadyRunning) {
    console.log('[run-demo] Checking if IPFS is installed...')
    const ipfsExists = await checkCommandExists('ipfs')
    
    if (!ipfsExists) {
      console.warn('[run-demo] IPFS command not found. Please install: https://dist.ipfs.tech/')
      console.warn('[run-demo] Continuing without IPFS...')
    } else {
      console.log('[run-demo] Starting IPFS daemon...')
      try {
        ipfsProc = spawn('ipfs', ['daemon'], {
          detached: false,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],  // Capture output
          timeout: 5000,  // Kill if not started in 5s
        })
        
        // Log IPFS output
        ipfsProc.stdout?.on('data', (data) => {
          console.log(`[ipfs] ${data.toString().trim()}`)
        })
        ipfsProc.stderr?.on('data', (data) => {
          console.error(`[ipfs-err] ${data.toString().trim()}`)
        })
        ipfsProc.on('error', (err) => {
          console.error(`[ipfs] Spawn error:`, err.message)
        })
        
        const ipfsReady = await waitForPort(5001, 30000)
        if (!ipfsReady) {
          console.warn('[run-demo] IPFS daemon did not start in time. Continuing without IPFS...')
          if (ipfsProc) ipfsProc.kill()
        } else {
          console.log('[run-demo] IPFS daemon ready.')
        }
      } catch (err) {
        console.error('[run-demo] Failed to start IPFS:', err.message)
        console.warn('[run-demo] Continuing without IPFS...')
      }
    }
  } else {
    console.log('[run-demo] IPFS daemon already running.')
  }

  // Initialise progress
  const allModeProgress = {}
  modesToRun.forEach(m => {
    allModeProgress[m] = { status: 'pending', currentStage: null, detail: null }
  })
  initProgress(modesToRun)

  const modeResults = {}

  for (const mode of modesToRun) {
    if (fs.existsSync(STOP_FLAG)) {
      console.log('[run-demo] Stop flag detected. Aborting.')
      break
    }

    const modeDir = MODE_DIRS[mode]
    if (!fs.existsSync(modeDir)) {
      console.error(`[run-demo] Mode ${mode} directory not found: ${modeDir}`)
      allModeProgress[mode].status = 'error'
      updateProgress(allModeProgress, mode)
      continue
    }

    console.log(`\n[run-demo] ===== Starting Mode ${mode} =====`)
    allModeProgress[mode].status = 'running'

    // Start hardhat node
    console.log(`[Mode ${mode}] Starting Hardhat node...`)
    const hardhatProc = spawn('npx', ['hardhat', 'node'], {
      cwd: modeDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],  // Capture output for debugging
      detached: false,
    })

    // Log hardhat output
    hardhatProc.stdout.on('data', (data) => {
      console.log(`[Mode ${mode}] [hardhat] ${data.toString().trim()}`)
    })
    hardhatProc.stderr.on('data', (data) => {
      console.error(`[Mode ${mode}] [hardhat-err] ${data.toString().trim()}`)
    })

    const nodeReady = await waitForPort(8545, 30000)
    if (!nodeReady) {
      console.error(`[Mode ${mode}] Hardhat node did not start.`)
      allModeProgress[mode].status = 'error'
      updateProgress(allModeProgress, mode)
      hardhatProc.kill()
      continue
    }
    console.log(`[Mode ${mode}] Hardhat node ready.`)
    
    // Additional delay to ensure hardhat is fully initialized
    await new Promise(r => setTimeout(r, 2000))

    const logs = []
    const result = await runMode(mode, modeDir, config, allModeProgress, logs)
    if (result) modeResults[mode] = result

    // Stop hardhat node
    console.log(`[Mode ${mode}] Stopping Hardhat node...`)
    try {
      process.platform === 'win32'
        ? spawnSync('taskkill', ['/F', '/T', '/PID', String(hardhatProc.pid)], { shell: true })
        : hardhatProc.kill('SIGTERM')
    } catch {}

    // Wait for port to close before next mode
    let portClosed = false
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000))
      if (!(await isPortOpen(8545))) { portClosed = true; break }
    }
    if (!portClosed) console.warn(`[run-demo] Port 8545 still open after Mode ${mode}.`)
  }

  // Stop IPFS if we started it
  if (ipfsProc) {
    console.log('[run-demo] Stopping IPFS daemon...')
    try {
      process.platform === 'win32'
        ? spawnSync('taskkill', ['/F', '/T', '/PID', String(ipfsProc.pid)], { shell: true })
        : ipfsProc.kill('SIGTERM')
    } catch {}
  }

  // Compute recommendation
  const rec = computeRecommendation(config.batd ?? 'Authority-reliant', config.oc ?? 'Minimal', modeResults)

  // Write comparison.json
  const VS = config.n < 1000 ? 'Small' : config.n <= 50000 ? 'Medium' : config.n <= 500000 ? 'Large' : 'Very Large'
  const comparison = {
    runId: `run-${Date.now()}`,
    createdAt: new Date().toISOString(),
    config: {
      n: config.n, q: config.q, s: config.s,
      VS,
      threshold: config.threshold,
    },
    modes: modeResults,
    recommendation: rec,
  }
  writeJson(path.join(PUBLIC_OUT, 'comparison.json'), comparison)

  // Append lean entry to run history (keyed by n/q/s; newest wins)
  const HISTORY_PATH = path.join(ROOT, 'public', 'data', 'run-history.json')
  let history = []
  try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')) } catch {}
  const histEntry = {
    runId: comparison.runId,
    createdAt: comparison.createdAt,
    config: comparison.config,
    modesData: Object.fromEntries(
      Object.entries(comparison.modes).map(([k, v]) => [k, {
        status: v.status,
        metrics: v.metrics,
        results: v.results,
      }])
    ),
    recommendation: comparison.recommendation,
  }
  const hKey = r => `${r.config.n}_${r.config.q}_${r.config.s}`
  const existingIdx = history.findIndex(r => hKey(r) === hKey(histEntry))
  if (existingIdx >= 0) {
    // Merge modesData so previous mode runs are not lost
    history[existingIdx] = {
      ...histEntry,
      modesData: { ...history[existingIdx].modesData, ...histEntry.modesData },
    }
  } else {
    history.push(histEntry)
  }
  if (history.length > 100) history = history.slice(-100)
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2))
  console.log('[run-demo] Run history updated.')

  finalizeProgress(allModeProgress)
  console.log('\n[run-demo] All done. comparison.json written.')
}

main().catch(err => {
  console.error('[run-demo] Fatal error:', err)
  process.exit(1)
})
