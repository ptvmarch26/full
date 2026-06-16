// const fs = require("fs");
// const path = require("path");
// const net = require("net");
// const { spawnSync, spawn } = require("child_process");

// // ---------------------------------------------------------------------------
// // Paths
// // ---------------------------------------------------------------------------
// const ROOT = path.resolve(__dirname, ".."); // cam-demo/
// const REPO_ROOT = path.resolve(ROOT, ".."); // D:\KLTN\full\
// const PUBLIC_OUT = path.join(ROOT, "public", "runs", "latest");

// // Redirect all console output to a log file so errors are visible
// fs.mkdirSync(PUBLIC_OUT, { recursive: true });
// const LOG_FILE = path.join(PUBLIC_OUT, "runner.log");
// const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
// const _log = (...a) => {
//   const msg = a.join(" ");
//   process.stdout.write(msg + "\n");
//   logStream.write(msg + "\n");
// };
// const _err = (...a) => {
//   const msg = a.join(" ");
//   process.stderr.write(msg + "\n");
//   logStream.write("[ERR] " + msg + "\n");
// };
// console.log = _log;
// console.warn = _log;
// console.error = _err;
// process.on("exit", () => {
//   try {
//     logStream.end();
//   } catch {}
// });
// process.on("uncaughtException", (e) => {
//   _err("UNCAUGHT:", e.stack || e.message);
//   logStream.end();
//   process.exit(1);
// });
// process.on("unhandledRejection", (e) => {
//   _err("UNHANDLED:", e?.stack || e);
//   logStream.end();
//   process.exit(1);
// });

// const MODE_DIRS = {
//   A: path.join(REPO_ROOT, "Mode A"),
//   B: path.join(REPO_ROOT, "Mode B"),
//   C: path.join(REPO_ROOT, "Mode C"),
// };

// const STOP_FLAG = path.join(PUBLIC_OUT, ".stop");

// // ---------------------------------------------------------------------------
// // Parse config
// // ---------------------------------------------------------------------------
// function parseConfig() {
//   const args = process.argv.slice(2);
//   const b64Idx = args.indexOf("--config-b64");
//   if (b64Idx !== -1) {
//     try {
//       return JSON.parse(Buffer.from(args[b64Idx + 1], "base64").toString());
//     } catch {}
//   }
//   const cfgIdx = args.indexOf("--config");
//   if (cfgIdx !== -1) {
//     try {
//       return JSON.parse(fs.readFileSync(args[cfgIdx + 1], "utf8"));
//     } catch {}
//   }
//   return {};
// }

// // ---------------------------------------------------------------------------
// // JSON helpers
// // ---------------------------------------------------------------------------
// function ensureDir(p) {
//   fs.mkdirSync(p, { recursive: true });
// }

// function writeJson(filePath, data) {
//   ensureDir(path.dirname(filePath));
//   fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
// }

// function makeStageLogger(mode, stage, logs, stageLogs) {
//   const liveLogDir = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
//   ensureDir(liveLogDir);

//   return function pushStageLog(type, msg) {
//     const entry = {
//       stage: stage.key,
//       type,
//       message: msg,
//       timestamp: new Date().toISOString(),
//     };

//     stageLogs.push(entry);

//     const line = `[Mode ${mode}] [${stage.key}] [${type}] ${msg}`;
//     if (type === "stderr") {
//       console.error(line);
//     } else {
//       console.log(line);
//     }

//     try {
//       writeJson(path.join(liveLogDir, "stage-logs.json"), [...logs, ...stageLogs]);
//     } catch {}
//   };
// }

// function readJson(filePath) {
//   try {
//     return JSON.parse(fs.readFileSync(filePath, "utf8"));
//   } catch {
//     return null;
//   }
// }

// // ---------------------------------------------------------------------------
// // Progress helpers
// // ---------------------------------------------------------------------------
// function initProgress(modes) {
//   const modeEntries = {};
//   modes.forEach((m) => {
//     modeEntries[m] = { status: "pending", currentStage: null, detail: null };
//   });
//   writeJson(path.join(PUBLIC_OUT, "progress.json"), {
//     status: "running",
//     currentMode: modes[0],
//     modes: modeEntries,
//     updatedAt: new Date().toISOString(),
//   });
// }

// function updateProgress(allModeProgress, currentMode) {
//   writeJson(path.join(PUBLIC_OUT, "progress.json"), {
//     status: "running",
//     currentMode,
//     modes: allModeProgress,
//     updatedAt: new Date().toISOString(),
//   });
// }

// function finalizeProgress(allModeProgress) {
//   writeJson(path.join(PUBLIC_OUT, "progress.json"), {
//     status: "completed",
//     currentMode: null,
//     modes: allModeProgress,
//     updatedAt: new Date().toISOString(),
//   });
// }

// // ---------------------------------------------------------------------------
// // Port check
// // ---------------------------------------------------------------------------
// function isPortOpen(port) {
//   return new Promise((resolve) => {
//     const s = net.createConnection(port, "127.0.0.1");
//     s.on("connect", () => {
//       s.destroy();
//       resolve(true);
//     });
//     s.on("error", () => resolve(false));
//   });
// }

// async function waitForPort(port, timeoutMs = 30000) {
//   const start = Date.now();
//   while (Date.now() - start < timeoutMs) {
//     if (await isPortOpen(port)) return true;
//     await new Promise((r) => setTimeout(r, 1000));
//   }
//   return false;
// }

// // Wait until the Kubo/IPFS HTTP API is actually usable.
// // Checking that port 5001 is open is not enough: the daemon can be starting,
// // the command can fail silently, or another process can occupy the port.
// async function waitForIpfsApiReady(timeoutMs = 60000) {
//   const http = require("http");
//   const start = Date.now();

//   while (Date.now() - start < timeoutMs) {
//     const ready = await new Promise((resolve) => {
//       const req = http.request(
//         {
//           hostname: "127.0.0.1",
//           port: 5001,
//           method: "POST",
//           path: "/api/v0/id",
//         },
//         (res) => {
//           let body = "";

//           res.on("data", (chunk) => {
//             body += chunk.toString();
//           });

//           res.on("end", () => {
//             resolve(
//               res.statusCode >= 200 &&
//                 res.statusCode < 300 &&
//                 body.includes('"ID"'),
//             );
//           });
//         },
//       );

//       req.on("error", () => resolve(false));
//       req.setTimeout(2000, () => {
//         req.destroy();
//         resolve(false);
//       });
//       req.end();
//     });

//     if (ready) return true;
//     await new Promise((r) => setTimeout(r, 1000));
//   }

//   return false;
// }

// // Waits until hardhat's JSON-RPC actually accepts requests (not just TCP open)
// async function waitForHardhatReady(port, timeoutMs = 45000) {
//   const http = require("http");
//   const start = Date.now();
//   while (Date.now() - start < timeoutMs) {
//     const ready = await new Promise((resolve) => {
//       const body = JSON.stringify({
//         jsonrpc: "2.0",
//         method: "eth_chainId",
//         params: [],
//         id: 1,
//       });
//       const req = http.request(
//         {
//           hostname: "127.0.0.1",
//           port,
//           method: "POST",
//           path: "/",
//           headers: {
//             "Content-Type": "application/json",
//             "Content-Length": Buffer.byteLength(body),
//           },
//         },
//         (res) => {
//           resolve(res.statusCode < 500);
//         },
//       );
//       req.on("error", () => resolve(false));
//       req.setTimeout(2000, () => {
//         req.destroy();
//         resolve(false);
//       });
//       req.write(body);
//       req.end();
//     });
//     if (ready) return true;
//     await new Promise((r) => setTimeout(r, 800));
//   }
//   return false;
// }

// // ---------------------------------------------------------------------------
// // Process helpers
// // ---------------------------------------------------------------------------
// function runHardhatScript(scriptPath, modeDir, env = {}, onLine = null) {
//   return new Promise((resolve) => {
//     const proc = spawn(
//       "npx",
//       ["hardhat", "run", scriptPath, "--network", "localhost"],
//       {
//         cwd: modeDir,
//         shell: true,
//         windowsHide: true,
//         env: { ...process.env, ...env },
//         stdio: ["ignore", "pipe", "pipe"],
//       },
//     );

//     let stdout = "";
//     let stderr = "";

//     proc.stdout.on("data", (data) => {
//       const text = data.toString();
//       stdout += text;
//       text
//         .split("\n")
//         .filter((l) => l.trim())
//         .forEach((line) => onLine?.("stdout", line.trim()));
//     });

//     proc.stderr.on("data", (data) => {
//       const text = data.toString();
//       text
//         .split("\n")
//         .filter((l) => l.trim())
//         .forEach((line) => {
//           if (
//             !line.includes("DeprecationWarning") &&
//             !line.includes("ExperimentalWarning")
//           ) {
//             stderr += line + "\n";
//             onLine?.("stderr", line.trim());
//           }
//         });
//     });

//     const killTimer = setTimeout(() => {
//       try {
//         proc.kill();
//       } catch {}
//     }, 300000);
//     proc.on("close", (code) => {
//       clearTimeout(killTimer);
//       resolve({ ok: code === 0, stdout, stderr });
//     });
//     proc.on("error", (err) => {
//       clearTimeout(killTimer);
//       resolve({ ok: false, stdout, stderr: err.message });
//     });
//   });
// }

// // ---------------------------------------------------------------------------
// // CSV parser for vote metrics
// // ---------------------------------------------------------------------------
// function parseVoteCsv(csvPath) {
//   if (!fs.existsSync(csvPath)) return null;
//   const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
//   if (lines.length < 2) return null;

//   const headers = lines[0].split(",").map((h) => h.trim());
//   const rows = lines.slice(1).map((line) => {
//     const vals = line.split(",");
//     const obj = {};
//     headers.forEach((h, i) => {
//       obj[h] = vals[i]?.trim() ?? "";
//     });
//     return obj;
//   });

//   const accepted = rows.filter(
//     (r) => r.resultCode === "0" || r.resultCode === "200",
//   );
//   const failed = rows.filter(
//     (r) => r.resultCode !== "0" && r.resultCode !== "200",
//   );

//   const avg = (arr, key) =>
//     arr.length === 0
//       ? 0
//       : arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length;
//   const sum = (arr, key) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);

//   return {
//     BVC: {
//       averageGasPerAcceptedBallot: Math.round(avg(accepted, "gasUsed")),
//       totalGasUsed: Math.round(sum(accepted, "gasUsed")),
//       submittedBallots: rows.length,
//       acceptedBallots: accepted.length,
//       failedBallots: failed.length,
//     },
//     OAL: {
//       averageEndToEndMs: parseFloat(avg(accepted, "endToEndTimeMs").toFixed(2)),
//       averageWitnessMs: parseFloat(avg(accepted, "witnessTimeMs").toFixed(2)),
//       averageProofMs: parseFloat(
//         avg(accepted, "proofGenerationTimeMs").toFixed(2),
//       ),
//     },
//   };
// }

// // ---------------------------------------------------------------------------
// // Extract final counts from tally stdout
// // ---------------------------------------------------------------------------
// function extractFinalCounts(stdout) {
//   const counts = [];
//   // look for patterns like "Candidate 1: 6 votes" or "Result: [6, 4]"
//   const arrayMatch = stdout.match(/\[(\d+(?:,\s*\d+)*)\]/);
//   if (arrayMatch) {
//     const nums = arrayMatch[1].split(",").map((n) => parseInt(n.trim()));
//     const total = nums.reduce((s, v) => s + v, 0);
//     nums.forEach((v, i) => {
//       counts.push({
//         candidateId: i + 1,
//         candidateName: `Candidate ${i + 1}`,
//         votes: v,
//         percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
//       });
//     });
//     return counts;
//   }
//   // fallback: try "Candidate X = N"
//   const matches = [...stdout.matchAll(/[Cc]andidate\s+(\d+)[^\d]+(\d+)/g)];
//   if (matches.length > 0) {
//     const total = matches.reduce((s, m) => s + parseInt(m[2]), 0);
//     matches.forEach((m) => {
//       const v = parseInt(m[2]);
//       counts.push({
//         candidateId: parseInt(m[1]),
//         candidateName: `Candidate ${m[1]}`,
//         votes: v,
//         percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
//       });
//     });
//     return counts;
//   }
//   return [];
// }

// // ---------------------------------------------------------------------------
// // Recommendation algorithm
// // ---------------------------------------------------------------------------
// function computeRecommendation(batd, oc, modeResults) {
//   const feasibility = { A: true, B: true, C: true };
//   const eliminated = [];

//   if (batd === "Authority-constrained") {
//     feasibility.A = false;
//     eliminated.push({
//       mode: "A",
//       reason: "BATD = Authority-constrained eliminates Mode A",
//     });
//   }
//   if (batd === "Publicly verifiable") {
//     feasibility.A = false;
//     feasibility.C = false;
//     eliminated.push({
//       mode: "A",
//       reason: "BATD = Publicly verifiable: only Mode B is valid",
//     });
//     eliminated.push({
//       mode: "C",
//       reason: "BATD = Publicly verifiable: only Mode B is valid",
//     });
//   }
//   if (oc === "Minimal") {
//     feasibility.C = false;
//     eliminated.push({
//       mode: "C",
//       reason: "OC = Minimal: Mode C requires advanced operational capability",
//     });
//   }

//   const feasibleModes = Object.entries(feasibility)
//     .filter(([, v]) => v)
//     .map(([k]) => k);

//   if (feasibleModes.length === 0) {
//     return {
//       feasibleModes: [],
//       eliminatedModes: eliminated,
//       recommended: null,
//       reasoning: "No feasible mode.",
//     };
//   }

//   const BVC_BASELINE = { A: 53987, B: 261924, C: 83855 };
//   const OAL_BASELINE = { A: 1200, B: 1250, C: 1450 };

//   const scores = feasibleModes.map((m) => ({
//     mode: m,
//     bvc:
//       modeResults[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ??
//       BVC_BASELINE[m],
//     oal: modeResults[m]?.metrics?.OAL?.averageEndToEndMs ?? OAL_BASELINE[m],
//   }));

//   const maxBvc = Math.max(...scores.map((s) => s.bvc));
//   const maxOal = Math.max(...scores.map((s) => s.oal));
//   scores.forEach((s) => {
//     s.score = (s.bvc / maxBvc) * 0.6 + (s.oal / maxOal) * 0.4;
//   });
//   scores.sort((a, b) => a.score - b.score);

//   const best = scores[0];
//   const cautionNote =
//     oc === "Moderate" && best.mode === "C"
//       ? " Note: OC = Moderate — careful trustee coordination required."
//       : "";
//   const reasoning = `Mode ${best.mode} recommended — lowest weighted cost among feasible modes (BVC: ${best.bvc.toLocaleString()} gas, OAL: ${best.oal.toFixed(0)} ms).${cautionNote}`;

//   return {
//     feasibleModes,
//     eliminatedModes: eliminated,
//     recommended: best.mode,
//     reasoning,
//   };
// }

// // ---------------------------------------------------------------------------
// // Per-mode Merkle tree depth (determines max voters) and fixed-trustee count
// // ---------------------------------------------------------------------------
// const MODE_PARAMS = {
//   A: { depth: 20, fixedTrustees: 2, maxN: 1_000_000 },
//   B: { depth: 10, fixedTrustees: 2, maxN: 1_000 },
//   C: { depth: 10, maxN: 1_000 },
// };

// // ---------------------------------------------------------------------------
// // Circuit patching helpers
// // ---------------------------------------------------------------------------
// function getCircomMain(circomPath) {
//   const content = fs.readFileSync(circomPath, "utf8");
//   const m = content.match(/^component main = .+;/m);
//   return m ? m[0] : null;
// }

// function patchCircomMain(circomPath, newMain) {
//   let content = fs.readFileSync(circomPath, "utf8");
//   content = content.replace(/^component main = .+;/m, newMain);
//   fs.writeFileSync(circomPath, content, "utf8");
// }

// // Read the number of candidates the WASM was actually compiled for
// // by counting main.r[N] signals in the .sym file
// function readCompiledQFromSym(symPath) {
//   if (!fs.existsSync(symPath)) return 0;
//   try {
//     const content = fs.readFileSync(symPath, "utf8");
//     const matches = [...content.matchAll(/,main\.r\[(\d+)\]/g)];
//     if (matches.length === 0) return 0;
//     return Math.max(...matches.map((m) => parseInt(m[1]))) + 1;
//   } catch {
//     return 0;
//   }
// }

// // Read the number of trustees the TallyValidity WASM was compiled for
// // by counting main.lambda[N] signals in the .sym file
// function readCompiledTvTrusteesFromSym(symPath) {
//   if (!fs.existsSync(symPath)) return 0;
//   try {
//     const content = fs.readFileSync(symPath, "utf8");
//     const matches = [...content.matchAll(/,main\.lambda\[(\d+)\]/g)];
//     if (matches.length === 0) return 0;
//     return Math.max(...matches.map((m) => parseInt(m[1]))) + 1;
//   } catch {
//     return 0;
//   }
// }

// function runNodeScript(scriptArgs, cwd, onLine = null, extraEnv = {}) {
//   return new Promise((resolve) => {
//     const proc = spawn("node", scriptArgs, {
//       cwd,
//       shell: false,
//       windowsHide: true,
//       env: { ...process.env, ...extraEnv },
//       stdio: ["ignore", "pipe", "pipe"],
//     });

//     let stdout = "";
//     let stderr = "";

//     proc.stdout.on("data", (data) => {
//       const text = data.toString();
//       stdout += text;
//       text
//         .split("\n")
//         .filter((l) => l.trim())
//         .forEach((line) => onLine?.("stdout", line.trim()));
//     });

//     proc.stderr.on("data", (data) => {
//       const text = data.toString();
//       text
//         .split("\n")
//         .filter((l) => l.trim())
//         .forEach((line) => {
//           if (
//             !line.includes("DeprecationWarning") &&
//             !line.includes("ExperimentalWarning")
//           ) {
//             stderr += line + "\n";
//             onLine?.("stderr", line.trim());
//           }
//         });
//     });

//     const killTimer = setTimeout(() => {
//       try {
//         proc.kill();
//       } catch {}
//     }, 900000);
//     proc.on("close", (code) => {
//       clearTimeout(killTimer);
//       resolve({ ok: code === 0, stdout, stderr });
//     });
//     proc.on("error", (err) => {
//       clearTimeout(killTimer);
//       resolve({ ok: false, stdout, stderr: err.message });
//     });
//   });
// }

// // ---------------------------------------------------------------------------
// // Run one mode end-to-end
// // ---------------------------------------------------------------------------
// async function runMode(mode, modeDir, config, allModeProgress, logs) {
//   const mp = allModeProgress[mode];
//   mp.status = "running";

//   const { maxN } = MODE_PARAMS[mode];

//   // Max Merkle tree depth per mode (determines voter capacity)
//   const MAX_DEPTH = { A: 20, B: 10, C: 10 };
//   // Default trustee count for TallyValidity circuit (A/B fixed; C uses user threshold)
//   const TV_TRUSTEES_DEFAULT = { A: 2, B: 2, C: 4 };

//   const effectiveN = Math.min(config.n ?? 10, maxN);
//   const circuitQ = config.q ?? (mode === "C" ? 2 : 10);
//   const computedDepth = Math.max(1, Math.ceil(Math.log2(effectiveN)));
//   const circuitDepth = Math.min(computedDepth, MODE_PARAMS[mode].depth);
//   const effectiveS = Math.min(config.s ?? 1, circuitQ);

//   // Mode A and B use a fixed 2-of-3 trustee scheme (hardcoded in partial.js).
//   // Only Mode C supports configurable threshold via DEMO_THRESHOLD / DEMO_TRUSTEES.
//   const modeThreshold =
//     mode === "C" ? (config.threshold?.approvalThreshold ?? 4) : 2;
//   const modeTrustees = mode === "C" ? (config.threshold?.trusteeCount ?? 7) : 3;

//   // For Mode C, compile circuit with user-specified threshold so proofs match
//   const tvTrustees = mode === "C" ? modeThreshold : TV_TRUSTEES_DEFAULT[mode];

//   const env = {
//     DEMO_N: String(effectiveN),
//     DEMO_Q: String(circuitQ),
//     DEMO_S: String(effectiveS),
//     DEMO_THRESHOLD: String(modeThreshold),
//     DEMO_TRUSTEES: String(modeTrustees),
//     DEMO_DEPTH: String(circuitDepth),
//     IPFS_API_URL: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
//     IPFS_TIMEOUT_MS: process.env.IPFS_TIMEOUT_MS || "5000",
//     ALLOW_MOCK_IPFS: process.env.ALLOW_MOCK_IPFS || "0",
//   };

//   // Always recompile circuits to ensure they match current input parameters
//   const vpcPath = path.join(modeDir, "circuits/VoteProofCombined.circom");
//   const tvPath = path.join(modeDir, "circuits/TallyValidity.circom");
//   const vpcWasm = path.join(
//     modeDir,
//     "circuits/build/VoteProofCombined/VoteProofCombined_js/VoteProofCombined.wasm",
//   );
//   const tvWasm = path.join(
//     modeDir,
//     "circuits/build/TallyValidity/TallyValidity_js/TallyValidity.wasm",
//   );
//   const vpcSymPath = path.join(
//     modeDir,
//     "circuits/build/VoteProofCombined/VoteProofCombined.sym",
//   );
//   const tvSymPath = path.join(
//     modeDir,
//     "circuits/build/TallyValidity/TallyValidity.sym",
//   );
//   const neededVPC = `component main = VotingCircuit(${circuitDepth}, ${circuitQ});`;
//   const neededTV = `component main = BatchTallyValidity(${tvTrustees}, ${circuitQ});`;
//   const needsCompile = true; // always recompile for compatibility with current inputs

//   const STAGES = [
//     needsCompile && {
//       key: "compile",
//       label: "Circuit Compilation",
//       scriptLabel: "circom.js + hardhat compile",
//       isCompile: true,
//     },
//     {
//       key: "setup",
//       label: "Setup",
//       scripts: ["scripts/deploy.js"],
//       scriptLabel: "deploy.js",
//     },
//     {
//       key: "prepare_voters",
//       label: "Generate Voter Data",
//       nodeScripts: ["scripts/gen_voter.js", "scripts/prepare_voters.js"],
//       scriptLabel: "gen_voter.js + prepare_voters.js",
//     },
//     {
//       key: "registration",
//       label: "Registration",
//       scripts: ["test/register.js"],
//       scriptLabel: "register.js",
//     },
//     {
//       key: "vote",
//       label: "Ballot Validation & Commitment",
//       scripts: ["test/vote.js"],
//       scriptLabel: "vote.js",
//     },
//     {
//       key: "aggregation",
//       label: "Aggregation",
//       scripts: ["scripts/prepare_aggregation.js", "test/aggregate.js"],
//       scriptLabel: "prepare_aggregation.js + aggregate.js",
//     },
//     {
//       key: "tally",
//       label: "Tallying & Result Revelation",
//       scripts: ["test/partial.js", "test/tally.js"],
//       scriptLabel: "partial.js + tally.js",
//     },
//   ].filter(Boolean);

//   if (needsCompile) {
//     console.log(
//       `[Mode ${mode}] Circuit recompilation needed: depth=${circuitDepth} q=${circuitQ}`,
//     );
//   } else {
//     console.log(
//       `[Mode ${mode}] Circuits up-to-date (depth=${circuitDepth} q=${circuitQ}), skipping compile`,
//     );
//   }

//   const stageResults = [];
//   let finalCounts = [];
//   let csvMetrics = null;

//   for (const stage of STAGES) {
//     if (fs.existsSync(STOP_FLAG)) {
//       mp.status = "stopped";
//       return null;
//     }

//     mp.currentStage = stage.key;
//     mp.detail = null;
//     mp.stageStartedAt = new Date().toISOString();
//     if (stage.key === "compile") mp.hasCompile = true;
//     updateProgress(allModeProgress, mode);

//     const stageStart = Date.now();
//     let stageOk = true;
//     let stageError = null;
//     const stageLogs = [];
//     const pushStageLog = makeStageLogger(mode, stage, logs, stageLogs);

//     if (stage.nodeScripts) {
//       // Node scripts run directly (not via hardhat), e.g. gen_demo_voters.cjs
//       for (const scriptPath of stage.nodeScripts) {
//         const fullPath = path.join(modeDir, scriptPath);
//         if (!fs.existsSync(fullPath)) {
//           console.log(
//             `[Mode ${mode}] Skipping missing node script: ${scriptPath}`,
//           );
//           continue;
//         }
//         console.log(`[Mode ${mode}] Running node ${scriptPath}...`);
//         const { ok } = await runNodeScript(
//           [fullPath],
//           modeDir,
//           (type, msg) => {
//             pushStageLog(type, msg);
//           },
//           env,
//         );
//         if (!ok) {
//           stageOk = false;
//           stageError = `Node script ${scriptPath} failed.`;
//           console.error(`[Mode ${mode}] FAILED: ${scriptPath}`);
//           break;
//         }
//       }
//     } else if (stage.isCompile) {
//       // Patch circuit files then recompile
//       console.log(
//         `[Mode ${mode}] Patching circuits: depth=${circuitDepth} q=${circuitQ} tvTrustees=${tvTrustees}`,
//       );
//       patchCircomMain(vpcPath, neededVPC);
//       patchCircomMain(tvPath, neededTV);

//       console.log(
//         `[Mode ${mode}] Compiling VoteProofCombined + TallyValidity (this may take several minutes)...`,
//       );
//       const compileResult = await runNodeScript(
//         ["scripts/circom.js", "VoteProofCombined", "TallyValidity"],
//         modeDir,
//         (type, msg) => {
//           pushStageLog(type, msg);
//         },
//       );

//       if (!compileResult.ok) {
//         const fbQ = readCompiledQFromSym(vpcSymPath);
//         if (fbQ > 0 && fs.existsSync(vpcWasm) && fs.existsSync(tvWasm)) {
//           // Read the trustee count the TallyValidity WASM was actually compiled for
//           const fbTvTrustees = readCompiledTvTrusteesFromSym(tvSymPath);
//           const fbTv =
//             fbTvTrustees > 0 ? fbTvTrustees : TV_TRUSTEES_DEFAULT[mode];
//           console.warn(
//             `[Mode ${mode}] circom compile failed — falling back to pre-compiled circuit (q=${fbQ}, tvTrustees=${fbTv})`,
//           );
//           env.DEMO_Q = String(fbQ);
//           env.DEMO_S = String(Math.min(config.s ?? 1, fbQ));
//           // For Mode C, override threshold/trustees to match the pre-compiled circuit
//           if (mode === "C") {
//             env.DEMO_THRESHOLD = String(fbTv);
//             if (Number(env.DEMO_TRUSTEES) < fbTv)
//               env.DEMO_TRUSTEES = String(fbTv + 1);
//           }
//           patchCircomMain(
//             vpcPath,
//             `component main = VotingCircuit(${circuitDepth}, ${fbQ});`,
//           );
//           patchCircomMain(
//             tvPath,
//             `component main = BatchTallyValidity(${fbTv}, ${fbQ});`,
//           );
//           pushStageLog(
//             "warn",
//             `circom v2 not available; using pre-compiled circuit (q=${fbQ}, tvTrustees=${fbTv}). Install circom v2 to use any q/threshold.`,
//           );
//         } else {
//           stageOk = false;
//           stageError = "Circuit compilation failed.";
//           console.error(`[Mode ${mode}] COMPILE FAILED`);
//         }
//       }

//       // Always run hardhat compile so Solidity artifacts stay in sync with current sources,
//       // regardless of whether circom succeeded or fell back to pre-compiled circuits.
//       if (stageOk) {
//         console.log(`[Mode ${mode}] Running hardhat compile...`);
//         const hcResult = await new Promise((resolve) => {
//           const proc = spawn("npx", ["hardhat", "compile"], {
//             cwd: modeDir,
//             shell: true,
//             windowsHide: true,
//             stdio: ["ignore", "pipe", "pipe"],
//           });
//           let ok = true;
//           proc.stdout.on("data", (d) => {
//             d.toString()
//               .split("\n")
//               .filter((l) => l.trim())
//               .forEach((msg) => {
//                 pushStageLog("stdout", msg.trim());
//               });
//           });
//           proc.stderr.on("data", (d) => {
//             d.toString()
//               .split("\n")
//               .filter((l) => l.trim())
//               .forEach((msg) => {
//                 if (
//                   !msg.includes("DeprecationWarning") &&
//                   !msg.includes("ExperimentalWarning")
//                 )
//                   pushStageLog("stderr", msg.trim());
//               });
//           });
//           const t = setTimeout(() => {
//             try {
//               proc.kill();
//             } catch {}
//           }, 120000);
//           proc.on("close", (code) => {
//             clearTimeout(t);
//             resolve({ ok: code === 0 });
//           });
//           proc.on("error", () => {
//             clearTimeout(t);
//             resolve({ ok: false });
//           });
//         });
//         if (!hcResult.ok) {
//           stageOk = false;
//           stageError = "hardhat compile failed.";
//           console.error(`[Mode ${mode}] hardhat compile FAILED`);
//         }
//       }
//     } else {
//       for (const scriptPath of stage.scripts) {
//         const fullPath = path.join(modeDir, scriptPath);
//         if (!fs.existsSync(fullPath)) {
//           console.log(`[Mode ${mode}] Skipping missing script: ${scriptPath}`);
//           continue;
//         }

//         console.log(`[Mode ${mode}] Running ${scriptPath}...`);
//         let scriptStdout = "";
//         const { ok } = await runHardhatScript(
//           scriptPath,
//           modeDir,
//           env,
//           (type, msg) => {
//             pushStageLog(type, msg);
//             if (type === "stdout") scriptStdout += msg + "\n";

//             // Real-time vote progress: update detail so UI can show "Vote X/N"
//             if (stage.key === "vote" && type === "stdout") {
//               const m = msg.match(/^Vote (\d+)\/(\d+):/);
//               if (m) {
//                 mp.detail = `Vote ${m[1]}/${m[2]}`;
//                 updateProgress(allModeProgress, mode);
//               }
//             }
//           },
//         );

//         if (!ok) {
//           stageOk = false;
//           stageError = `Script ${scriptPath} failed.`;
//           console.error(`[Mode ${mode}] FAILED: ${scriptPath}`);
//           const errLines = stageLogs
//             .filter((l) => l.stage === stage.key && l.type === "stderr")
//             .slice(-10);
//           if (errLines.length)
//             console.error(
//               `[Mode ${mode}] Last errors:\n${errLines.map((l) => l.message).join("\n")}`,
//             );
//           break;
//         }

//         // Extract tally results
//         if (scriptPath.includes("tally.js")) {
//           finalCounts = extractFinalCounts(scriptStdout);
//         }
//       }
//     }

//     logs.push(...stageLogs);

//     const stageDuration = Date.now() - stageStart;
//     stageResults.push({
//       key: stage.key,
//       label: stage.label,
//       script: stage.scriptLabel,
//       status: stageOk ? "completed" : "error",
//       durationMs: stageDuration,
//       error: stageError,
//     });

//     if (!stageOk) {
//       mp.status = "error";
//       mp.currentStage = stage.key;
//       updateProgress(allModeProgress, mode);
//       // Write partial logs so failures are visible in the UI
//       const outDirErr = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
//       ensureDir(outDirErr);
//       writeJson(path.join(outDirErr, "stage-logs.json"), logs);
//       return {
//         stages: stageResults,
//         metrics: null,
//         results: null,
//         error: stageError,
//       };
//     }

//     mp.detail = stageResults[stageResults.length - 1].durationMs
//       ? `${(stageDuration / 1000).toFixed(1)}s`
//       : null;
//     updateProgress(allModeProgress, mode);
//   }

//   // Parse CSV metrics after vote stage
//   const csvPath = path.join(modeDir, "data", "vote_submission_times.csv");
//   csvMetrics = parseVoteCsv(csvPath);

//   // Copy output artifacts
//   const outDir = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
//   ensureDir(outDir);
//   const filesToCopy = [
//     ["data/vote.json", "vote.json"],
//     ["data/aggregation.json", "aggregation.json"],
//     ["data/vote_submission_times.csv", "vote_submission_times.csv"],
//   ];
//   for (const [src, dst] of filesToCopy) {
//     const srcPath = path.join(modeDir, src);
//     if (fs.existsSync(srcPath)) {
//       fs.copyFileSync(srcPath, path.join(outDir, dst));
//     }
//   }
//   writeJson(
//     path.join(outDir, "stage-logs.json"),
//     logs.filter((l) => true),
//   );

//   mp.status = "completed";
//   mp.currentStage = null;
//   updateProgress(allModeProgress, mode);

//   const totalDuration = stageResults.reduce(
//     (s, st) => s + (st.durationMs ?? 0),
//     0,
//   );

//   return {
//     status: "completed",
//     pipeline: {
//       totalDurationMs: totalDuration,
//       startedAt: new Date(Date.now() - totalDuration).toISOString(),
//       finishedAt: new Date().toISOString(),
//     },
//     stages: stageResults,
//     metrics: csvMetrics ?? {
//       BVC: {
//         averageGasPerAcceptedBallot: 0,
//         totalGasUsed: 0,
//         submittedBallots: 0,
//         acceptedBallots: 0,
//         failedBallots: 0,
//       },
//       OAL: { averageEndToEndMs: 0, averageWitnessMs: 0, averageProofMs: 0 },
//     },
//     results: {
//       finalCounts,
//       revealedOnChain: finalCounts.length > 0,
//     },
//   };
// }

// // ---------------------------------------------------------------------------
// // Main
// // ---------------------------------------------------------------------------
// async function main() {
//   ensureDir(PUBLIC_OUT);

//   // Clear stop flag
//   if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG);

//   const config = parseConfig();
//   const modesToRun =
//     config.modes === "all" || !config.modes
//       ? ["A", "B", "C"]
//       : Array.isArray(config.modes)
//         ? config.modes
//         : [config.modes];

//   console.log(
//     `[run-demo] Config: n=${config.n} q=${config.q} s=${config.s} modes=${modesToRun.join(",")}`,
//   );

//   // Reset progress.json immediately so UI polls don't read stale data from a previous run
//   const allModeProgress = {};
//   modesToRun.forEach((m) => {
//     allModeProgress[m] = {
//       status: "pending",
//       currentStage: null,
//       detail: null,
//     };
//   });
//   initProgress(modesToRun);

//   // --- Start IPFS daemon once ---
//   let ipfsProc = null;
//   const ipfsAlreadyReady = await waitForIpfsApiReady(3000);

//   if (!ipfsAlreadyReady) {
//     console.log("[run-demo] IPFS API not ready. Starting IPFS daemon...");

//     ipfsProc = spawn("ipfs", ["daemon"], {
//       detached: false,
//       shell: true,
//       windowsHide: true,
//       stdio: ["ignore", "pipe", "pipe"],
//     });

//     ipfsProc.stdout.on("data", (data) => {
//       data
//         .toString()
//         .split("\n")
//         .filter((line) => line.trim())
//         .forEach((line) => {
//           console.log(`[ipfs] ${line.trim()}`);
//         });
//     });

//     ipfsProc.stderr.on("data", (data) => {
//       data
//         .toString()
//         .split("\n")
//         .filter((line) => line.trim())
//         .forEach((line) => {
//           console.error(`[ipfs-err] ${line.trim()}`);
//         });
//     });

//     const ipfsReady = await waitForIpfsApiReady(60000);

//     if (!ipfsReady) {
//       console.error("[run-demo] IPFS API did not become ready. Aborting run.");
//       console.error(
//         "[run-demo] Check manually: curl -X POST http://127.0.0.1:5001/api/v0/id",
//       );

//       try {
//         if (ipfsProc) ipfsProc.kill("SIGTERM");
//       } catch {}

//       Object.keys(allModeProgress).forEach((m) => {
//         allModeProgress[m].status = "error";
//         allModeProgress[m].currentStage = null;
//         allModeProgress[m].detail = "IPFS API not ready";
//       });
//       writeJson(path.join(PUBLIC_OUT, "progress.json"), {
//         status: "error",
//         currentMode: null,
//         modes: allModeProgress,
//         updatedAt: new Date().toISOString(),
//       });

//       try {
//         fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
//       } catch {}

//       process.exit(1);
//     }

//     console.log("[run-demo] IPFS API ready.");
//   } else {
//     console.log("[run-demo] IPFS API already ready.");
//   }

//   const modeResults = {};

//   for (const mode of modesToRun) {
//     if (fs.existsSync(STOP_FLAG)) {
//       console.log("[run-demo] Stop flag detected. Aborting.");
//       break;
//     }

//     const modeDir = MODE_DIRS[mode];
//     if (!fs.existsSync(modeDir)) {
//       console.error(`[run-demo] Mode ${mode} directory not found: ${modeDir}`);
//       allModeProgress[mode].status = "error";
//       updateProgress(allModeProgress, mode);
//       continue;
//     }

//     console.log(`\n[run-demo] ===== Starting Mode ${mode} =====`);
//     allModeProgress[mode].status = "running";

//     // Kill any leftover process on 8545 before starting a fresh node
//     if (await isPortOpen(8545)) {
//       console.log(
//         `[Mode ${mode}] Port 8545 still in use — killing leftover process...`,
//       );
//       if (process.platform === "win32") {
//         spawnSync(
//           "powershell",
//           [
//             "-Command",
//             "Get-NetTCPConnection -LocalPort 8545 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }",
//           ],
//           { shell: false, windowsHide: true },
//         );
//       }
//       // Wait for it to actually close
//       for (let i = 0; i < 10; i++) {
//         await new Promise((r) => setTimeout(r, 1000));
//         if (!(await isPortOpen(8545))) break;
//       }
//     }

//     // Start hardhat node
//     console.log(`[Mode ${mode}] Starting Hardhat node...`);
//     const hardhatProc = spawn("npx", ["hardhat", "node"], {
//       cwd: modeDir,
//       shell: true,
//       windowsHide: true,
//       stdio: ["ignore", "pipe", "pipe"],
//       detached: false,
//     });

//     hardhatProc.stdout.on("data", (data) => {
//       data
//         .toString()
//         .split("\n")
//         .filter((line) => line.trim())
//         .forEach((line) => {
//           console.log(`[Mode ${mode}] [hardhat-node] ${line.trim()}`);
//         });
//     });

//     hardhatProc.stderr.on("data", (data) => {
//       data
//         .toString()
//         .split("\n")
//         .filter((line) => line.trim())
//         .forEach((line) => {
//           console.error(`[Mode ${mode}] [hardhat-node-err] ${line.trim()}`);
//         });
//     });

//     const nodeReady = await waitForHardhatReady(8545, 45000);
//     if (!nodeReady) {
//       console.error(`[Mode ${mode}] Hardhat node did not start.`);
//       allModeProgress[mode].status = "error";
//       updateProgress(allModeProgress, mode);
//       hardhatProc.kill();
//       continue;
//     }
//     console.log(`[Mode ${mode}] Hardhat node ready.`);

//     // Clear stale data so each run starts fresh
//     try {
//       fs.writeFileSync(path.join(modeDir, "data/vote.json"), "[]", "utf8");
//     } catch {}
//     try {
//       fs.unlinkSync(path.join(modeDir, "data/aggregation.json"));
//     } catch {}
//     try {
//       fs.unlinkSync(path.join(modeDir, "circuits/inputs/tally_input.json"));
//     } catch {}

//     const logs = [];
//     const result = await runMode(mode, modeDir, config, allModeProgress, logs);
//     if (result) modeResults[mode] = result;

//     // Stop hardhat node
//     console.log(`[Mode ${mode}] Stopping Hardhat node...`);
//     try {
//       process.platform === "win32"
//         ? spawnSync("taskkill", ["/F", "/T", "/PID", String(hardhatProc.pid)], {
//             shell: true,
//             windowsHide: true,
//           })
//         : hardhatProc.kill("SIGTERM");
//     } catch {}

//     // Wait for port to close before next mode
//     let portClosed = false;
//     for (let i = 0; i < 15; i++) {
//       await new Promise((r) => setTimeout(r, 1000));
//       if (!(await isPortOpen(8545))) {
//         portClosed = true;
//         break;
//       }
//     }
//     if (!portClosed)
//       console.warn(`[run-demo] Port 8545 still open after Mode ${mode}.`);
//   }

//   // Stop IPFS if we started it
//   if (ipfsProc) {
//     console.log("[run-demo] Stopping IPFS daemon...");
//     try {
//       process.platform === "win32"
//         ? spawnSync("taskkill", ["/F", "/T", "/PID", String(ipfsProc.pid)], {
//             shell: true,
//             windowsHide: true,
//           })
//         : ipfsProc.kill("SIGTERM");
//     } catch {}
//   }

//   // Compute recommendation
//   const rec = computeRecommendation(
//     config.batd ?? "Authority-reliant",
//     config.oc ?? "Minimal",
//     modeResults,
//   );

//   // Write comparison.json
//   const VS =
//     config.n < 1000
//       ? "Small"
//       : config.n <= 50000
//         ? "Medium"
//         : config.n <= 500000
//           ? "Large"
//           : "Very Large";
//   const comparison = {
//     runId: `run-${Date.now()}`,
//     createdAt: new Date().toISOString(),
//     config: {
//       n: config.n,
//       q: config.q,
//       s: config.s,
//       VS,
//       threshold: config.threshold,
//     },
//     modes: modeResults,
//     recommendation: rec,
//   };
//   writeJson(path.join(PUBLIC_OUT, "comparison.json"), comparison);

//   // Append lean entry to run history (keyed by n/q/s; newest wins)
//   const HISTORY_PATH = path.join(ROOT, "public", "data", "run-history.json");
//   let history = [];
//   try {
//     history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
//   } catch {}
//   const histEntry = {
//     runId: comparison.runId,
//     createdAt: comparison.createdAt,
//     config: comparison.config,
//     modesData: Object.fromEntries(
//       Object.entries(comparison.modes).map(([k, v]) => [
//         k,
//         {
//           status: v.status,
//           metrics: v.metrics,
//           results: v.results,
//         },
//       ]),
//     ),
//     recommendation: comparison.recommendation,
//   };
//   const hKey = (r) => `${r.config.n}_${r.config.q}_${r.config.s}`;
//   const existingIdx = history.findIndex((r) => hKey(r) === hKey(histEntry));
//   if (existingIdx >= 0) {
//     // Merge modesData so previous mode runs are not lost
//     history[existingIdx] = {
//       ...histEntry,
//       modesData: { ...history[existingIdx].modesData, ...histEntry.modesData },
//     };
//   } else {
//     history.push(histEntry);
//   }
//   if (history.length > 100) history = history.slice(-100);
//   fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
//   console.log("[run-demo] Run history updated.");

//   finalizeProgress(allModeProgress);
//   console.log("\n[run-demo] All done. comparison.json written.");

//   // Remove PID file so the middleware knows this runner has exited cleanly
//   try {
//     fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
//   } catch {}
// }

// main().catch((err) => {
//   console.error("[run-demo] Fatal error:", err);
//   try {
//     fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
//   } catch {}
//   process.exit(1);
// });


const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawnSync, spawn } = require("child_process");

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, ".."); // cam-demo/
const REPO_ROOT = path.resolve(ROOT, ".."); // D:\KLTN\full\
const PUBLIC_OUT = path.join(ROOT, "public", "runs", "latest");

// Redirect all console output to a log file so errors are visible
fs.mkdirSync(PUBLIC_OUT, { recursive: true });
const LOG_FILE = path.join(PUBLIC_OUT, "runner.log");
const logStream = fs.createWriteStream(LOG_FILE, { flags: "w" });
const _log = (...a) => {
  const msg = a.join(" ");
  process.stdout.write(msg + "\n");
  logStream.write(msg + "\n");
};
const _err = (...a) => {
  const msg = a.join(" ");
  process.stderr.write(msg + "\n");
  logStream.write("[ERR] " + msg + "\n");
};
console.log = _log;
console.warn = _log;
console.error = _err;
process.on("exit", () => {
  try {
    logStream.end();
  } catch {}
});
process.on("uncaughtException", (e) => {
  _err("UNCAUGHT:", e.stack || e.message);
  logStream.end();
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  _err("UNHANDLED:", e?.stack || e);
  logStream.end();
  process.exit(1);
});

const MODE_DIRS = {
  A: path.join(REPO_ROOT, "Mode A"),
  B: path.join(REPO_ROOT, "Mode B"),
  C: path.join(REPO_ROOT, "Mode C"),
};

const STOP_FLAG = path.join(PUBLIC_OUT, ".stop");

// ---------------------------------------------------------------------------
// Parse config
// ---------------------------------------------------------------------------
function parseConfig() {
  const args = process.argv.slice(2);
  const b64Idx = args.indexOf("--config-b64");
  if (b64Idx !== -1) {
    try {
      return JSON.parse(Buffer.from(args[b64Idx + 1], "base64").toString());
    } catch {}
  }
  const cfgIdx = args.indexOf("--config");
  if (cfgIdx !== -1) {
    try {
      return JSON.parse(fs.readFileSync(args[cfgIdx + 1], "utf8"));
    } catch {}
  }
  return {};
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function makeStageLogger(mode, stage, logs, stageLogs) {
  const liveLogDir = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
  ensureDir(liveLogDir);

  return function pushStageLog(type, msg) {
    const entry = {
      stage: stage.key,
      type,
      message: msg,
      timestamp: new Date().toISOString(),
    };

    stageLogs.push(entry);

    const line = `[Mode ${mode}] [${stage.key}] [${type}] ${msg}`;
    if (type === "stderr") {
      console.error(line);
    } else {
      console.log(line);
    }

    try {
      writeJson(path.join(liveLogDir, "stage-logs.json"), [...logs, ...stageLogs]);
    } catch {}
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------
function initProgress(modes) {
  const modeEntries = {};
  modes.forEach((m) => {
    modeEntries[m] = { status: "pending", currentStage: null, detail: null };
  });
  writeJson(path.join(PUBLIC_OUT, "progress.json"), {
    status: "running",
    currentMode: modes[0],
    modes: modeEntries,
    updatedAt: new Date().toISOString(),
  });
}

function updateProgress(allModeProgress, currentMode) {
  writeJson(path.join(PUBLIC_OUT, "progress.json"), {
    status: "running",
    currentMode,
    modes: allModeProgress,
    updatedAt: new Date().toISOString(),
  });
}

function finalizeProgress(allModeProgress) {
  writeJson(path.join(PUBLIC_OUT, "progress.json"), {
    status: "completed",
    currentMode: null,
    modes: allModeProgress,
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Port check
// ---------------------------------------------------------------------------
function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.createConnection(port, "127.0.0.1");
    s.on("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Wait until the Kubo/IPFS HTTP API is actually usable.
// Checking that port 5001 is open is not enough: the daemon can be starting,
// the command can fail silently, or another process can occupy the port.
async function waitForIpfsApiReady(timeoutMs = 60000) {
  const http = require("http");
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: 5001,
          method: "POST",
          path: "/api/v0/id",
        },
        (res) => {
          let body = "";

          res.on("data", (chunk) => {
            body += chunk.toString();
          });

          res.on("end", () => {
            resolve(
              res.statusCode >= 200 &&
                res.statusCode < 300 &&
                body.includes('"ID"'),
            );
          });
        },
      );

      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });

    if (ready) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }

  return false;
}

// Waits until hardhat's JSON-RPC actually accepts requests (not just TCP open)
async function waitForHardhatReady(port, timeoutMs = 45000) {
  const http = require("http");
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await new Promise((resolve) => {
      const body = JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      });
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          method: "POST",
          path: "/",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          resolve(res.statusCode < 500);
        },
      );
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
      req.write(body);
      req.end();
    });
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}


// ---------------------------------------------------------------------------
// Ubuntu Hardhat node helpers
// ---------------------------------------------------------------------------
const HARDHAT_PORT = 8545;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function killProcessOnPort(port) {
  if (!(await isPortOpen(port))) return;

  console.log(`[run-demo] Port ${port} is in use. Killing existing process...`);

  spawnSync(
    "bash",
    [
      "-lc",
      `
      fuser -k ${port}/tcp 2>/dev/null || true
      lsof -ti:${port} | xargs -r kill -9 || true
      `,
    ],
    {
      shell: false,
      stdio: "ignore",
    },
  );

  for (let i = 0; i < 15; i++) {
    await sleep(1000);

    if (!(await isPortOpen(port))) {
      console.log(`[run-demo] Port ${port} released.`);
      return;
    }
  }

  console.warn(`[run-demo] Port ${port} is still open after kill attempt.`);
}

async function startHardhatNodeForMode(mode, modeDir) {
  await killProcessOnPort(HARDHAT_PORT);

  console.log(`[Mode ${mode}] Starting Hardhat node in: ${modeDir}`);

  const hardhatProc = spawn("npx", ["hardhat", "node"], {
    cwd: modeDir,
    shell: true,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],

    // Ubuntu/Linux: create a new process group.
    // Later we kill the whole group using process.kill(-pid).
    detached: true,
  });

  hardhatProc.stdout.on("data", (data) => {
    data
      .toString()
      .split("\n")
      .filter((line) => line.trim())
      .forEach((line) => {
        console.log(`[Mode ${mode}] [hardhat-node] ${line.trim()}`);
      });
  });

  hardhatProc.stderr.on("data", (data) => {
    data
      .toString()
      .split("\n")
      .filter((line) => line.trim())
      .forEach((line) => {
        console.error(`[Mode ${mode}] [hardhat-node-err] ${line.trim()}`);
      });
  });

  const ready = await waitForHardhatReady(HARDHAT_PORT, 45000);

  if (!ready) {
    console.error(`[Mode ${mode}] Hardhat node did not become ready.`);
    await stopHardhatNodeForMode(mode, hardhatProc);
    throw new Error(`Hardhat node failed to start for Mode ${mode}`);
  }

  console.log(`[Mode ${mode}] Hardhat node ready on port ${HARDHAT_PORT}.`);

  return hardhatProc;
}

async function stopHardhatNodeForMode(mode, hardhatProc) {
  if (!hardhatProc) return;

  console.log(`[Mode ${mode}] Stopping Hardhat node...`);

  try {
    // Kill whole process group.
    process.kill(-hardhatProc.pid, "SIGTERM");
  } catch (err) {
    try {
      hardhatProc.kill("SIGTERM");
    } catch {}
  }

  for (let i = 0; i < 10; i++) {
    await sleep(1000);

    if (!(await isPortOpen(HARDHAT_PORT))) {
      console.log(`[Mode ${mode}] Hardhat node stopped.`);
      return;
    }
  }

  console.warn(`[Mode ${mode}] Hardhat node still alive. Force killing...`);

  try {
    process.kill(-hardhatProc.pid, "SIGKILL");
  } catch {}

  await killProcessOnPort(HARDHAT_PORT);
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
function runHardhatScript(scriptPath, modeDir, env = {}, onLine = null) {
  return new Promise((resolve) => {
    const proc = spawn(
      "npx",
      ["hardhat", "run", scriptPath, "--network", "localhost"],
      {
        cwd: modeDir,
        shell: true,
        windowsHide: true,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      text
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => onLine?.("stdout", line.trim()));
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      text
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => {
          if (
            !line.includes("DeprecationWarning") &&
            !line.includes("ExperimentalWarning")
          ) {
            stderr += line + "\n";
            onLine?.("stderr", line.trim());
          }
        });
    });

    const killTimer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
    }, 300000);
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({ ok: code === 0, stdout, stderr });
    });
    proc.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({ ok: false, stdout, stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// CSV parser for vote metrics
// ---------------------------------------------------------------------------
function parseVoteCsv(csvPath) {
  if (!fs.existsSync(csvPath)) return null;
  const lines = fs.readFileSync(csvPath, "utf8").split("\n").filter(Boolean);
  if (lines.length < 2) return null;

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = vals[i]?.trim() ?? "";
    });
    return obj;
  });

  const accepted = rows.filter(
    (r) => r.resultCode === "0" || r.resultCode === "200",
  );
  const failed = rows.filter(
    (r) => r.resultCode !== "0" && r.resultCode !== "200",
  );

  const avg = (arr, key) =>
    arr.length === 0
      ? 0
      : arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length;
  const sum = (arr, key) => arr.reduce((s, r) => s + Number(r[key] || 0), 0);

  return {
    BVC: {
      averageGasPerAcceptedBallot: Math.round(avg(accepted, "gasUsed")),
      totalGasUsed: Math.round(sum(accepted, "gasUsed")),
      submittedBallots: rows.length,
      acceptedBallots: accepted.length,
      failedBallots: failed.length,
    },
    OAL: {
      averageEndToEndMs: parseFloat(avg(accepted, "endToEndTimeMs").toFixed(2)),
      averageWitnessMs: parseFloat(avg(accepted, "witnessTimeMs").toFixed(2)),
      averageProofMs: parseFloat(
        avg(accepted, "proofGenerationTimeMs").toFixed(2),
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// Extract final counts from tally stdout
// ---------------------------------------------------------------------------
function extractFinalCounts(stdout) {
  const counts = [];
  // look for patterns like "Candidate 1: 6 votes" or "Result: [6, 4]"
  const arrayMatch = stdout.match(/\[(\d+(?:,\s*\d+)*)\]/);
  if (arrayMatch) {
    const nums = arrayMatch[1].split(",").map((n) => parseInt(n.trim()));
    const total = nums.reduce((s, v) => s + v, 0);
    nums.forEach((v, i) => {
      counts.push({
        candidateId: i + 1,
        candidateName: `Candidate ${i + 1}`,
        votes: v,
        percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
      });
    });
    return counts;
  }
  // fallback: try "Candidate X = N"
  const matches = [...stdout.matchAll(/[Cc]andidate\s+(\d+)[^\d]+(\d+)/g)];
  if (matches.length > 0) {
    const total = matches.reduce((s, m) => s + parseInt(m[2]), 0);
    matches.forEach((m) => {
      const v = parseInt(m[2]);
      counts.push({
        candidateId: parseInt(m[1]),
        candidateName: `Candidate ${m[1]}`,
        votes: v,
        percentage: total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0,
      });
    });
    return counts;
  }
  return [];
}

// ---------------------------------------------------------------------------
// Recommendation algorithm
// ---------------------------------------------------------------------------
function computeRecommendation(batd, oc, modeResults) {
  const feasibility = { A: true, B: true, C: true };
  const eliminated = [];

  if (batd === "Authority-constrained") {
    feasibility.A = false;
    eliminated.push({
      mode: "A",
      reason: "BATD = Authority-constrained eliminates Mode A",
    });
  }
  if (batd === "Publicly verifiable") {
    feasibility.A = false;
    feasibility.C = false;
    eliminated.push({
      mode: "A",
      reason: "BATD = Publicly verifiable: only Mode B is valid",
    });
    eliminated.push({
      mode: "C",
      reason: "BATD = Publicly verifiable: only Mode B is valid",
    });
  }
  if (oc === "Minimal") {
    feasibility.C = false;
    eliminated.push({
      mode: "C",
      reason: "OC = Minimal: Mode C requires advanced operational capability",
    });
  }

  const feasibleModes = Object.entries(feasibility)
    .filter(([, v]) => v)
    .map(([k]) => k);

  if (feasibleModes.length === 0) {
    return {
      feasibleModes: [],
      eliminatedModes: eliminated,
      recommended: null,
      reasoning: "No feasible mode.",
    };
  }

  const BVC_BASELINE = { A: 53987, B: 261924, C: 83855 };
  const OAL_BASELINE = { A: 1200, B: 1250, C: 1450 };

  const scores = feasibleModes.map((m) => ({
    mode: m,
    bvc:
      modeResults[m]?.metrics?.BVC?.averageGasPerAcceptedBallot ??
      BVC_BASELINE[m],
    oal: modeResults[m]?.metrics?.OAL?.averageEndToEndMs ?? OAL_BASELINE[m],
  }));

  const maxBvc = Math.max(...scores.map((s) => s.bvc));
  const maxOal = Math.max(...scores.map((s) => s.oal));
  scores.forEach((s) => {
    s.score = (s.bvc / maxBvc) * 0.6 + (s.oal / maxOal) * 0.4;
  });
  scores.sort((a, b) => a.score - b.score);

  const best = scores[0];
  const cautionNote =
    oc === "Moderate" && best.mode === "C"
      ? " Note: OC = Moderate — careful trustee coordination required."
      : "";
  const reasoning = `Mode ${best.mode} recommended — lowest weighted cost among feasible modes (BVC: ${best.bvc.toLocaleString()} gas, OAL: ${best.oal.toFixed(0)} ms).${cautionNote}`;

  return {
    feasibleModes,
    eliminatedModes: eliminated,
    recommended: best.mode,
    reasoning,
  };
}

// ---------------------------------------------------------------------------
// Per-mode Merkle tree depth (determines max voters) and fixed-trustee count
// ---------------------------------------------------------------------------
const MODE_PARAMS = {
  A: { depth: 20, fixedTrustees: 2, maxN: 1_000_000 },
  B: { depth: 10, fixedTrustees: 2, maxN: 1_000 },
  C: { depth: 10, maxN: 1_000 },
};

// ---------------------------------------------------------------------------
// Circuit patching helpers
// ---------------------------------------------------------------------------
function getCircomMain(circomPath) {
  const content = fs.readFileSync(circomPath, "utf8");
  const m = content.match(/^component main = .+;/m);
  return m ? m[0] : null;
}

function patchCircomMain(circomPath, newMain) {
  let content = fs.readFileSync(circomPath, "utf8");
  content = content.replace(/^component main = .+;/m, newMain);
  fs.writeFileSync(circomPath, content, "utf8");
}

// Read the number of candidates the WASM was actually compiled for
// by counting main.r[N] signals in the .sym file
function readCompiledQFromSym(symPath) {
  if (!fs.existsSync(symPath)) return 0;
  try {
    const content = fs.readFileSync(symPath, "utf8");
    const matches = [...content.matchAll(/,main\.r\[(\d+)\]/g)];
    if (matches.length === 0) return 0;
    return Math.max(...matches.map((m) => parseInt(m[1]))) + 1;
  } catch {
    return 0;
  }
}

// Read the number of trustees the TallyValidity WASM was compiled for
// by counting main.lambda[N] signals in the .sym file
function readCompiledTvTrusteesFromSym(symPath) {
  if (!fs.existsSync(symPath)) return 0;
  try {
    const content = fs.readFileSync(symPath, "utf8");
    const matches = [...content.matchAll(/,main\.lambda\[(\d+)\]/g)];
    if (matches.length === 0) return 0;
    return Math.max(...matches.map((m) => parseInt(m[1]))) + 1;
  } catch {
    return 0;
  }
}

function runNodeScript(scriptArgs, cwd, onLine = null, extraEnv = {}) {
  return new Promise((resolve) => {
    const proc = spawn("node", scriptArgs, {
      cwd,
      shell: false,
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      text
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => onLine?.("stdout", line.trim()));
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      text
        .split("\n")
        .filter((l) => l.trim())
        .forEach((line) => {
          if (
            !line.includes("DeprecationWarning") &&
            !line.includes("ExperimentalWarning")
          ) {
            stderr += line + "\n";
            onLine?.("stderr", line.trim());
          }
        });
    });

    const killTimer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
    }, 900000);
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({ ok: code === 0, stdout, stderr });
    });
    proc.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({ ok: false, stdout, stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// Run one mode end-to-end
// ---------------------------------------------------------------------------
async function runMode(mode, modeDir, config, allModeProgress, logs) {
  const mp = allModeProgress[mode];
  mp.status = "running";

  const { maxN } = MODE_PARAMS[mode];

  // Max Merkle tree depth per mode (determines voter capacity)
  const MAX_DEPTH = { A: 20, B: 10, C: 10 };
  // Default trustee count for TallyValidity circuit (A/B fixed; C uses user threshold)
  const TV_TRUSTEES_DEFAULT = { A: 2, B: 2, C: 4 };

  const effectiveN = Math.min(config.n ?? 10, maxN);
  const circuitQ = config.q ?? (mode === "C" ? 2 : 10);
  const computedDepth = Math.max(1, Math.ceil(Math.log2(effectiveN)));
  const circuitDepth = Math.min(computedDepth, MODE_PARAMS[mode].depth);
  const effectiveS = Math.min(config.s ?? 1, circuitQ);

  // Mode A and B use a fixed 2-of-3 trustee scheme (hardcoded in partial.js).
  // Only Mode C supports configurable threshold via DEMO_THRESHOLD / DEMO_TRUSTEES.
  const modeThreshold =
    mode === "C" ? (config.threshold?.approvalThreshold ?? 4) : 2;
  const modeTrustees = mode === "C" ? (config.threshold?.trusteeCount ?? 7) : 3;

  // For Mode C, compile circuit with user-specified threshold so proofs match
  const tvTrustees = mode === "C" ? modeThreshold : TV_TRUSTEES_DEFAULT[mode];

  const env = {
    DEMO_N: String(effectiveN),
    DEMO_Q: String(circuitQ),
    DEMO_S: String(effectiveS),
    DEMO_THRESHOLD: String(modeThreshold),
    DEMO_TRUSTEES: String(modeTrustees),
    DEMO_DEPTH: String(circuitDepth),
    IPFS_API_URL: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
    IPFS_TIMEOUT_MS: process.env.IPFS_TIMEOUT_MS || "5000",
    ALLOW_MOCK_IPFS: process.env.ALLOW_MOCK_IPFS || "0",
  };

  // Always recompile circuits to ensure they match current input parameters
  const vpcPath = path.join(modeDir, "circuits/VoteProofCombined.circom");
  const tvPath = path.join(modeDir, "circuits/TallyValidity.circom");
  const vpcWasm = path.join(
    modeDir,
    "circuits/build/VoteProofCombined/VoteProofCombined_js/VoteProofCombined.wasm",
  );
  const tvWasm = path.join(
    modeDir,
    "circuits/build/TallyValidity/TallyValidity_js/TallyValidity.wasm",
  );
  const vpcSymPath = path.join(
    modeDir,
    "circuits/build/VoteProofCombined/VoteProofCombined.sym",
  );
  const tvSymPath = path.join(
    modeDir,
    "circuits/build/TallyValidity/TallyValidity.sym",
  );
  const neededVPC = `component main = VotingCircuit(${circuitDepth}, ${circuitQ});`;
  const neededTV = `component main = BatchTallyValidity(${tvTrustees}, ${circuitQ});`;
  const needsCompile = true; // always recompile for compatibility with current inputs

  const STAGES = [
    needsCompile && {
      key: "compile",
      label: "Circuit Compilation",
      scriptLabel: "circom.js + hardhat compile",
      isCompile: true,
    },
    {
      key: "setup",
      label: "Setup",
      scripts: ["scripts/deploy.js"],
      scriptLabel: "deploy.js",
    },
    {
      key: "prepare_voters",
      label: "Generate Voter Data",
      nodeScripts: ["scripts/gen_voter.js", "scripts/prepare_voters.js"],
      scriptLabel: "gen_voter.js + prepare_voters.js",
    },
    {
      key: "registration",
      label: "Registration",
      scripts: ["test/register.js"],
      scriptLabel: "register.js",
    },
    {
      key: "vote",
      label: "Ballot Validation & Commitment",
      scripts: ["test/vote.js"],
      scriptLabel: "vote.js",
    },
    {
      key: "aggregation",
      label: "Aggregation",
      scripts: ["scripts/prepare_aggregation.js", "test/aggregate.js"],
      scriptLabel: "prepare_aggregation.js + aggregate.js",
    },
    {
      key: "tally",
      label: "Tallying & Result Revelation",
      scripts: ["test/partial.js", "test/tally.js"],
      scriptLabel: "partial.js + tally.js",
    },
  ].filter(Boolean);

  if (needsCompile) {
    console.log(
      `[Mode ${mode}] Circuit recompilation needed: depth=${circuitDepth} q=${circuitQ}`,
    );
  } else {
    console.log(
      `[Mode ${mode}] Circuits up-to-date (depth=${circuitDepth} q=${circuitQ}), skipping compile`,
    );
  }

  const stageResults = [];
  let finalCounts = [];
  let csvMetrics = null;

  for (const stage of STAGES) {
    if (fs.existsSync(STOP_FLAG)) {
      mp.status = "stopped";
      return null;
    }

    mp.currentStage = stage.key;
    mp.detail = null;
    mp.stageStartedAt = new Date().toISOString();
    if (stage.key === "compile") mp.hasCompile = true;
    updateProgress(allModeProgress, mode);

    const stageStart = Date.now();
    let stageOk = true;
    let stageError = null;
    const stageLogs = [];
    const pushStageLog = makeStageLogger(mode, stage, logs, stageLogs);

    if (stage.nodeScripts) {
      // Node scripts run directly (not via hardhat), e.g. gen_demo_voters.cjs
      for (const scriptPath of stage.nodeScripts) {
        const fullPath = path.join(modeDir, scriptPath);
        if (!fs.existsSync(fullPath)) {
          console.log(
            `[Mode ${mode}] Skipping missing node script: ${scriptPath}`,
          );
          continue;
        }
        console.log(`[Mode ${mode}] Running node ${scriptPath}...`);
        const { ok } = await runNodeScript(
          [fullPath],
          modeDir,
          (type, msg) => {
            pushStageLog(type, msg);
          },
          env,
        );
        if (!ok) {
          stageOk = false;
          stageError = `Node script ${scriptPath} failed.`;
          console.error(`[Mode ${mode}] FAILED: ${scriptPath}`);
          break;
        }
      }
    } else if (stage.isCompile) {
      // Patch circuit files then recompile
      console.log(
        `[Mode ${mode}] Patching circuits: depth=${circuitDepth} q=${circuitQ} tvTrustees=${tvTrustees}`,
      );
      patchCircomMain(vpcPath, neededVPC);
      patchCircomMain(tvPath, neededTV);

      console.log(
        `[Mode ${mode}] Compiling VoteProofCombined + TallyValidity (this may take several minutes)...`,
      );
      const compileResult = await runNodeScript(
        ["scripts/circom.js", "VoteProofCombined", "TallyValidity"],
        modeDir,
        (type, msg) => {
          pushStageLog(type, msg);
        },
      );

      if (!compileResult.ok) {
        const fbQ = readCompiledQFromSym(vpcSymPath);
        if (fbQ > 0 && fs.existsSync(vpcWasm) && fs.existsSync(tvWasm)) {
          // Read the trustee count the TallyValidity WASM was actually compiled for
          const fbTvTrustees = readCompiledTvTrusteesFromSym(tvSymPath);
          const fbTv =
            fbTvTrustees > 0 ? fbTvTrustees : TV_TRUSTEES_DEFAULT[mode];
          console.warn(
            `[Mode ${mode}] circom compile failed — falling back to pre-compiled circuit (q=${fbQ}, tvTrustees=${fbTv})`,
          );
          env.DEMO_Q = String(fbQ);
          env.DEMO_S = String(Math.min(config.s ?? 1, fbQ));
          // For Mode C, override threshold/trustees to match the pre-compiled circuit
          if (mode === "C") {
            env.DEMO_THRESHOLD = String(fbTv);
            if (Number(env.DEMO_TRUSTEES) < fbTv)
              env.DEMO_TRUSTEES = String(fbTv + 1);
          }
          patchCircomMain(
            vpcPath,
            `component main = VotingCircuit(${circuitDepth}, ${fbQ});`,
          );
          patchCircomMain(
            tvPath,
            `component main = BatchTallyValidity(${fbTv}, ${fbQ});`,
          );
          pushStageLog(
            "warn",
            `circom v2 not available; using pre-compiled circuit (q=${fbQ}, tvTrustees=${fbTv}). Install circom v2 to use any q/threshold.`,
          );
        } else {
          stageOk = false;
          stageError = "Circuit compilation failed.";
          console.error(`[Mode ${mode}] COMPILE FAILED`);
        }
      }

      // Always run hardhat compile so Solidity artifacts stay in sync with current sources,
      // regardless of whether circom succeeded or fell back to pre-compiled circuits.
      if (stageOk) {
        console.log(`[Mode ${mode}] Running hardhat compile...`);
        const hcResult = await new Promise((resolve) => {
          const proc = spawn("npx", ["hardhat", "compile"], {
            cwd: modeDir,
            shell: true,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let ok = true;
          proc.stdout.on("data", (d) => {
            d.toString()
              .split("\n")
              .filter((l) => l.trim())
              .forEach((msg) => {
                pushStageLog("stdout", msg.trim());
              });
          });
          proc.stderr.on("data", (d) => {
            d.toString()
              .split("\n")
              .filter((l) => l.trim())
              .forEach((msg) => {
                if (
                  !msg.includes("DeprecationWarning") &&
                  !msg.includes("ExperimentalWarning")
                )
                  pushStageLog("stderr", msg.trim());
              });
          });
          const t = setTimeout(() => {
            try {
              proc.kill();
            } catch {}
          }, 120000);
          proc.on("close", (code) => {
            clearTimeout(t);
            resolve({ ok: code === 0 });
          });
          proc.on("error", () => {
            clearTimeout(t);
            resolve({ ok: false });
          });
        });
        if (!hcResult.ok) {
          stageOk = false;
          stageError = "hardhat compile failed.";
          console.error(`[Mode ${mode}] hardhat compile FAILED`);
        }
      }
    } else {
      for (const scriptPath of stage.scripts) {
        const fullPath = path.join(modeDir, scriptPath);
        if (!fs.existsSync(fullPath)) {
          console.log(`[Mode ${mode}] Skipping missing script: ${scriptPath}`);
          continue;
        }

        console.log(`[Mode ${mode}] Running ${scriptPath}...`);
        let scriptStdout = "";
        const { ok } = await runHardhatScript(
          scriptPath,
          modeDir,
          env,
          (type, msg) => {
            pushStageLog(type, msg);
            if (type === "stdout") scriptStdout += msg + "\n";

            // Real-time vote progress: update detail so UI can show "Vote X/N"
            if (stage.key === "vote" && type === "stdout") {
              const m = msg.match(/^Vote (\d+)\/(\d+):/);
              if (m) {
                mp.detail = `Vote ${m[1]}/${m[2]}`;
                updateProgress(allModeProgress, mode);
              }
            }
          },
        );

        if (!ok) {
          stageOk = false;
          stageError = `Script ${scriptPath} failed.`;
          console.error(`[Mode ${mode}] FAILED: ${scriptPath}`);
          const errLines = stageLogs
            .filter((l) => l.stage === stage.key && l.type === "stderr")
            .slice(-10);
          if (errLines.length)
            console.error(
              `[Mode ${mode}] Last errors:\n${errLines.map((l) => l.message).join("\n")}`,
            );
          break;
        }

        // Extract tally results
        if (scriptPath.includes("tally.js")) {
          finalCounts = extractFinalCounts(scriptStdout);
        }
      }
    }

    logs.push(...stageLogs);

    const stageDuration = Date.now() - stageStart;
    stageResults.push({
      key: stage.key,
      label: stage.label,
      script: stage.scriptLabel,
      status: stageOk ? "completed" : "error",
      durationMs: stageDuration,
      error: stageError,
    });

    if (!stageOk) {
      mp.status = "error";
      mp.currentStage = stage.key;
      updateProgress(allModeProgress, mode);
      // Write partial logs so failures are visible in the UI
      const outDirErr = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
      ensureDir(outDirErr);
      writeJson(path.join(outDirErr, "stage-logs.json"), logs);
      return {
        stages: stageResults,
        metrics: null,
        results: null,
        error: stageError,
      };
    }

    mp.detail = stageResults[stageResults.length - 1].durationMs
      ? `${(stageDuration / 1000).toFixed(1)}s`
      : null;
    updateProgress(allModeProgress, mode);
  }

  // Parse CSV metrics after vote stage
  const csvPath = path.join(modeDir, "data", "vote_submission_times.csv");
  csvMetrics = parseVoteCsv(csvPath);

  // Copy output artifacts
  const outDir = path.join(PUBLIC_OUT, `mode-${mode.toLowerCase()}`);
  ensureDir(outDir);
  const filesToCopy = [
    ["data/vote.json", "vote.json"],
    ["data/aggregation.json", "aggregation.json"],
    ["data/vote_submission_times.csv", "vote_submission_times.csv"],
  ];
  for (const [src, dst] of filesToCopy) {
    const srcPath = path.join(modeDir, src);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(outDir, dst));
    }
  }
  writeJson(
    path.join(outDir, "stage-logs.json"),
    logs.filter((l) => true),
  );

  mp.status = "completed";
  mp.currentStage = null;
  updateProgress(allModeProgress, mode);

  const totalDuration = stageResults.reduce(
    (s, st) => s + (st.durationMs ?? 0),
    0,
  );

  return {
    status: "completed",
    pipeline: {
      totalDurationMs: totalDuration,
      startedAt: new Date(Date.now() - totalDuration).toISOString(),
      finishedAt: new Date().toISOString(),
    },
    stages: stageResults,
    metrics: csvMetrics ?? {
      BVC: {
        averageGasPerAcceptedBallot: 0,
        totalGasUsed: 0,
        submittedBallots: 0,
        acceptedBallots: 0,
        failedBallots: 0,
      },
      OAL: { averageEndToEndMs: 0, averageWitnessMs: 0, averageProofMs: 0 },
    },
    results: {
      finalCounts,
      revealedOnChain: finalCounts.length > 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  ensureDir(PUBLIC_OUT);

  // Clear stop flag
  if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG);

  const config = parseConfig();
  const modesToRun =
    config.modes === "all" || !config.modes
      ? ["A", "B", "C"]
      : Array.isArray(config.modes)
        ? config.modes
        : [config.modes];

  console.log(
    `[run-demo] Config: n=${config.n} q=${config.q} s=${config.s} modes=${modesToRun.join(",")}`,
  );

  // Reset progress.json immediately so UI polls don't read stale data from a previous run
  const allModeProgress = {};
  modesToRun.forEach((m) => {
    allModeProgress[m] = {
      status: "pending",
      currentStage: null,
      detail: null,
    };
  });
  initProgress(modesToRun);

  // --- Start IPFS daemon once ---
  let ipfsProc = null;
  const ipfsAlreadyReady = await waitForIpfsApiReady(3000);

  if (!ipfsAlreadyReady) {
    console.log("[run-demo] IPFS API not ready. Starting IPFS daemon...");

    ipfsProc = spawn("ipfs", ["daemon"], {
      detached: false,
      shell: true,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    ipfsProc.stdout.on("data", (data) => {
      data
        .toString()
        .split("\n")
        .filter((line) => line.trim())
        .forEach((line) => {
          console.log(`[ipfs] ${line.trim()}`);
        });
    });

    ipfsProc.stderr.on("data", (data) => {
      data
        .toString()
        .split("\n")
        .filter((line) => line.trim())
        .forEach((line) => {
          console.error(`[ipfs-err] ${line.trim()}`);
        });
    });

    const ipfsReady = await waitForIpfsApiReady(60000);

    if (!ipfsReady) {
      console.error("[run-demo] IPFS API did not become ready. Aborting run.");
      console.error(
        "[run-demo] Check manually: curl -X POST http://127.0.0.1:5001/api/v0/id",
      );

      try {
        if (ipfsProc) ipfsProc.kill("SIGTERM");
      } catch {}

      Object.keys(allModeProgress).forEach((m) => {
        allModeProgress[m].status = "error";
        allModeProgress[m].currentStage = null;
        allModeProgress[m].detail = "IPFS API not ready";
      });
      writeJson(path.join(PUBLIC_OUT, "progress.json"), {
        status: "error",
        currentMode: null,
        modes: allModeProgress,
        updatedAt: new Date().toISOString(),
      });

      try {
        fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
      } catch {}

      process.exit(1);
    }

    console.log("[run-demo] IPFS API ready.");
  } else {
    console.log("[run-demo] IPFS API already ready.");
  }

  const modeResults = {};

  for (const mode of modesToRun) {
    if (fs.existsSync(STOP_FLAG)) {
      console.log("[run-demo] Stop flag detected. Aborting.");
      break;
    }

    const modeDir = MODE_DIRS[mode];
    if (!fs.existsSync(modeDir)) {
      console.error(`[run-demo] Mode ${mode} directory not found: ${modeDir}`);
      allModeProgress[mode].status = "error";
      updateProgress(allModeProgress, mode);
      continue;
    }

    console.log(`\n[run-demo] ===== Starting Mode ${mode} =====`);
    allModeProgress[mode].status = "running";

    let hardhatProc = null;

    try {
      hardhatProc = await startHardhatNodeForMode(mode, modeDir);

      // Clear stale data so each run starts fresh
      try {
        fs.writeFileSync(path.join(modeDir, "data/vote.json"), "[]", "utf8");
      } catch {}
      try {
        fs.unlinkSync(path.join(modeDir, "data/aggregation.json"));
      } catch {}
      try {
        fs.unlinkSync(path.join(modeDir, "circuits/inputs/tally_input.json"));
      } catch {}

      const logs = [];
      const result = await runMode(mode, modeDir, config, allModeProgress, logs);
      if (result) modeResults[mode] = result;
    } catch (err) {
      console.error(`[Mode ${mode}] Fatal mode error: ${err.stack || err.message}`);

      allModeProgress[mode].status = "error";
      allModeProgress[mode].currentStage = null;
      allModeProgress[mode].detail = err.message;
      updateProgress(allModeProgress, mode);

      modeResults[mode] = {
        status: "error",
        pipeline: {
          totalDurationMs: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        },
        stages: [],
        metrics: null,
        results: null,
        error: err.message,
      };
    } finally {
      await stopHardhatNodeForMode(mode, hardhatProc);
    }
  }

  // Stop IPFS if we started it
  if (ipfsProc) {
    console.log("[run-demo] Stopping IPFS daemon...");
    try {
      process.platform === "win32"
        ? spawnSync("taskkill", ["/F", "/T", "/PID", String(ipfsProc.pid)], {
            shell: true,
            windowsHide: true,
          })
        : ipfsProc.kill("SIGTERM");
    } catch {}
  }

  // Compute recommendation
  const rec = computeRecommendation(
    config.batd ?? "Authority-reliant",
    config.oc ?? "Minimal",
    modeResults,
  );

  // Write comparison.json
  const VS =
    config.n < 1000
      ? "Small"
      : config.n <= 50000
        ? "Medium"
        : config.n <= 500000
          ? "Large"
          : "Very Large";
  const comparison = {
    runId: `run-${Date.now()}`,
    createdAt: new Date().toISOString(),
    config: {
      n: config.n,
      q: config.q,
      s: config.s,
      VS,
      threshold: config.threshold,
    },
    modes: modeResults,
    recommendation: rec,
  };
  writeJson(path.join(PUBLIC_OUT, "comparison.json"), comparison);

  // Append lean entry to run history (keyed by n/q/s; newest wins)
  const HISTORY_PATH = path.join(ROOT, "public", "data", "run-history.json");
  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  } catch {}
  const histEntry = {
    runId: comparison.runId,
    createdAt: comparison.createdAt,
    config: comparison.config,
    modesData: Object.fromEntries(
      Object.entries(comparison.modes).map(([k, v]) => [
        k,
        {
          status: v.status,
          metrics: v.metrics,
          results: v.results,
        },
      ]),
    ),
    recommendation: comparison.recommendation,
  };
  const hKey = (r) => `${r.config.n}_${r.config.q}_${r.config.s}`;
  const existingIdx = history.findIndex((r) => hKey(r) === hKey(histEntry));
  if (existingIdx >= 0) {
    // Merge modesData so previous mode runs are not lost
    history[existingIdx] = {
      ...histEntry,
      modesData: { ...history[existingIdx].modesData, ...histEntry.modesData },
    };
  } else {
    history.push(histEntry);
  }
  if (history.length > 100) history = history.slice(-100);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log("[run-demo] Run history updated.");

  finalizeProgress(allModeProgress);
  console.log("\n[run-demo] All done. comparison.json written.");

  // Remove PID file so the middleware knows this runner has exited cleanly
  try {
    fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
  } catch {}
}

main().catch((err) => {
  console.error("[run-demo] Fatal error:", err);
  try {
    fs.unlinkSync(path.join(PUBLIC_OUT, ".runner.pid"));
  } catch {}
  process.exit(1);
});
