import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  StopCircle,
  Terminal,
  XCircle,
} from "lucide-react";
import CamAnalyzeLayout from "../components/CamAnalyzeLayout.jsx";
import { loadProgress, loadComparison } from "../lib/loadJson.js";
import { fmtDuration, fmtGas, fmtMs } from "../lib/formatters.js";

const TERMINAL_STATUSES = ["completed", "error", "stopped"];

const STAGES = [
  {
    key: "compile",
    label: "Circuit Compilation",
    script: "circom.js + hardhat compile",
  },
  {
    key: "setup",
    label: "Setup",
    script: "deploy.js",
  },
  {
    key: "prepare_voters",
    label: "Generate Voter Data",
    script: "gen_voter.js + prepare_voters.js",
  },
  {
    key: "registration",
    label: "Registration",
    script: "register.js",
  },
  {
    key: "vote",
    label: "Ballot Validation & Commitment",
    script: "vote.js",
  },
  {
    key: "aggregation",
    label: "Aggregation",
    script: "prepare_aggregation.js + aggregate.js",
  },
  {
    key: "tally",
    label: "Tallying & Result Revelation",
    script: "partial.js + tally.js",
  },
];

export default function ModeAnalysisPage() {
  const navigate = useNavigate();

  const [progress, setProgress] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(true);
  const [selectedMode, setSelectedMode] = useState(null);

  const pollRef = useRef(null);

  const modeKeys = progress?.modes
    ? Object.keys(progress.modes)
    : comparison?.modes
      ? Object.keys(comparison.modes)
      : [];

  const allDoneFromProgress =
    progress?.status === "completed" ||
    (progress?.modes &&
      modeKeys.length > 0 &&
      modeKeys.every((mode) =>
        TERMINAL_STATUSES.includes(progress?.modes?.[mode]?.status),
      ));

  const allDoneFromComparison =
    comparison?.modes &&
    Object.keys(comparison.modes).length > 0 &&
    Object.keys(comparison.modes).every((mode) =>
      TERMINAL_STATUSES.includes(comparison.modes?.[mode]?.status),
    );

  const allDone = allDoneFromProgress || allDoneFromComparison;

  const effectiveSelectedMode = selectedMode || modeKeys[0] || null;

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [p, cmp] = await Promise.all([loadProgress(), loadComparison()]);

      if (cancelled) return;

      if (p) setProgress(p);
      if (cmp) setComparison(cmp);

      const modes = p?.modes
        ? Object.keys(p.modes)
        : cmp?.modes
          ? Object.keys(cmp.modes)
          : [];

      const terminal =
        p?.status === "completed" ||
        (p?.modes &&
          modes.length > 0 &&
          modes.every((mode) =>
            TERMINAL_STATUSES.includes(p?.modes?.[mode]?.status),
          )) ||
        (cmp?.modes &&
          Object.keys(cmp.modes).length > 0 &&
          Object.keys(cmp.modes).every((mode) =>
            TERMINAL_STATUSES.includes(cmp?.modes?.[mode]?.status),
          ));

      setSelectedMode(modes[0] || null);
      setRunning(!terminal);
      setLoading(false);
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    pollRef.current = setInterval(async () => {
      const p = await loadProgress();
      if (!p) return;

      setProgress(p);

      const modes = Object.keys(p.modes ?? {});
      const terminal =
        p.status === "completed" ||
        (modes.length > 0 &&
          modes.every((mode) =>
            TERMINAL_STATUSES.includes(p.modes?.[mode]?.status),
          ));

      if (!selectedMode && modes.length > 0) {
        setSelectedMode(p.currentMode || modes[0]);
      }

      if (terminal) {
        clearInterval(pollRef.current);
        setRunning(false);

        const cmp = await loadComparison();
        if (cmp) {
          setComparison(cmp);
          setSelectedMode(Object.keys(cmp.modes ?? {})[0] || null);
        }
      }
    }, 2000);

    return () => clearInterval(pollRef.current);
  }, [running, selectedMode]);

  async function handleStop() {
    fetch("/api/stop-demo", { method: "POST" }).catch(() => {});
    clearInterval(pollRef.current);
    setRunning(false);
  }

  if (loading) {
    return (
      <CamAnalyzeLayout active="analysis">
        <main className="mx-auto mt-20 flex min-h-[calc(100vh-160px)] w-full max-w-[1440px] items-center justify-center p-6">
          <div className="flex items-center gap-3 text-sm text-[#505f76]">
            <Loader2 size={18} className="animate-spin text-[#0058be]" />
            Loading latest simulation...
          </div>
        </main>
      </CamAnalyzeLayout>
    );
  }

  if (!progress && !comparison) {
    return (
      <CamAnalyzeLayout active="analysis">
        <main className="mx-auto mt-20 flex min-h-[calc(100vh-160px)] w-full max-w-[1440px] items-center justify-center p-6">
          <div className="rounded-xl border border-[#c2c6d6] bg-white p-8 text-center shadow-sm">
            <Terminal size={40} className="mx-auto mb-4 text-[#0058be]" />
            <h2 className="text-xl font-semibold text-[#191c1e]">
              No simulation data
            </h2>

            <p className="mt-2 max-w-md text-sm text-[#505f76]">
              Run a simulation from the setup page first, then the analysis
              result will appear here.
            </p>

            <button
              onClick={() => navigate("/run")}
              className="mt-6 rounded-lg bg-[#0058be] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white"
            >
              Go to Setup
            </button>
          </div>
        </main>
      </CamAnalyzeLayout>
    );
  }

  return (
    <CamAnalyzeLayout active="analysis">
      <main className="mx-auto mt-20 min-h-[calc(100vh-160px)] w-full max-w-[1440px] space-y-8 p-6">
        <TopHeader
          running={running && !allDone}
          completed={allDone}
          runId={comparison?.runId}
          onBack={() => navigate("/run")}
          onStop={handleStop}
          onRerun={() => navigate("/run")}
        />

        {running && !allDone ? (
          <RunningView
            progress={progress}
            modeKeys={modeKeys}
            selectedMode={effectiveSelectedMode}
          />
        ) : (
          <CompletedView
            comparison={comparison}
            modeKeys={modeKeys}
            selectedMode={effectiveSelectedMode}
            setSelectedMode={setSelectedMode}
          />
        )}
      </main>
    </CamAnalyzeLayout>
  );
}

function TopHeader({ running, completed, runId, onBack, onStop, onRerun }) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <div className="mb-2 flex items-center gap-3">
          <StatusBadge
            status={running ? "running" : completed ? "completed" : "pending"}
          />

          <span className="text-xs font-semibold uppercase tracking-widest text-[#727785]">
            {runId || "Current Run"}
          </span>
        </div>

        <h1 className="text-3xl font-semibold text-[#191c1e]">
          Simulation Analysis & Execution
        </h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border border-[#c2c6d6] bg-white px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#505f76] transition hover:bg-[#eceef0]"
        >
          <ArrowLeft size={15} />
          Setup
        </button>

        {running ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 rounded-lg bg-[#ffdad6] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#93000a] transition hover:bg-[#ba1a1a] hover:text-white"
          >
            <StopCircle size={15} />
            Stop
          </button>
        ) : (
          <button
            onClick={onRerun}
            className="flex items-center gap-2 rounded-lg bg-[#0058be] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-[#2170e4]"
          >
            <RefreshCw size={15} />
            Re-run
          </button>
        )}
      </div>
    </div>
  );
}

function RunningView({ progress, modeKeys, selectedMode }) {
  const activeMode = progress?.currentMode || selectedMode || modeKeys[0];
  const modeProgress = activeMode ? progress?.modes?.[activeMode] : null;

  const stages = STAGES.map((stage, index) => ({
    ...stage,
    status: inferStageStatus(modeProgress, stage.key, index),
    durationMs: null,
  }));

  const completedCount = stages.filter(
    (stage) => stage.status === "completed",
  ).length;

  const overallPercent = Math.round((completedCount / STAGES.length) * 100);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-[#c2c6d6] bg-white p-6 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-[#191c1e]">
            Simulation in Progress
            <span className="flex items-center gap-2 rounded-sm bg-[#2170e4] px-3 py-2 text-xs font-bold uppercase tracking-widest text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Running
            </span>
          </h2>

          <p className="mt-2 text-sm text-[#505f76]">
            Executing the CAMS-V 7-stage verification process.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {modeKeys.length === 0 ? (
              <span className="text-sm text-[#727785]">
                Waiting for mode...
              </span>
            ) : (
              modeKeys.map((mode) => (
                <span
                  key={mode}
                  className={`rounded-sm px-3 py-1.5 text-xs font-bold ${
                    mode === activeMode
                      ? "bg-[#0058be] text-white"
                      : "bg-[#d8e2ff] text-[#0058be]"
                  }`}
                >
                  Mode {mode}
                </span>
              ))
            )}

            <a
              href="/api/runner-log"
              target="_blank"
              rel="noreferrer"
              className="ml-1 text-xs font-semibold text-[#0058be] underline"
            >
              View raw log
            </a>
          </div>
        </div>

        <div className="min-w-[260px]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#727785]">
              Overall Progress
            </span>

            <span className="text-lg font-bold text-[#0058be]">
              {overallPercent}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#e0e3e5]">
            <div
              className="progress-bar-shine h-full bg-[#0058be] transition-all duration-500"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#c2c6d6] bg-white p-8 shadow-sm">
        <div className="mb-7 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-[#505f76]">
            Execution Pipeline
          </h3>

          {activeMode && (
            <span className="rounded-sm bg-[#d8e2ff] px-3 py-1 text-xs font-bold text-[#0058be]">
              Mode {activeMode}
            </span>
          )}
        </div>

        <StageTimeline stages={stages} />
      </section>
    </div>
  );
}

function CompletedView({
  comparison,
  modeKeys,
  selectedMode,
  setSelectedMode,
}) {
  const modes = comparison?.modes ?? {};
  const keys = Object.keys(modes);

  const actualModeKeys = keys.length > 0 ? keys : modeKeys;
  const currentMode =
    selectedMode && modes[selectedMode] ? selectedMode : actualModeKeys[0];

  const currentModeData = currentMode ? modes[currentMode] : null;

  if (!comparison || !currentModeData) {
    return (
      <div className="rounded-xl border border-[#c2c6d6] bg-white p-8 text-center">
        <Clock3 size={36} className="mx-auto mb-4 text-[#0058be]" />

        <h2 className="text-xl font-semibold text-[#191c1e]">
          Waiting for result file
        </h2>

        <p className="mt-2 text-sm text-[#505f76]">
          The pipeline is finished, but comparison.json is not available yet.
        </p>
      </div>
    );
  }

  const metrics = currentModeData.metrics ?? {};
  const bvc = metrics.BVC ?? {};
  const oal = metrics.OAL ?? {};

  const finalCounts = currentModeData.results?.finalCounts ?? [];
  const revealedOnChain = currentModeData.results?.revealedOnChain;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-semibold text-[#191c1e]">
            Experiment Results
          </h2>

          <p className="mt-2 text-sm text-[#505f76]">
            Showing result for Mode {currentMode}. Switch mode to inspect other
            runs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-2 rounded-sm bg-[#00855b] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white">
            <CheckCircle2 size={14} />
            Success
          </span>

          {revealedOnChain && (
            <span className="rounded-sm bg-[#d0e1fb] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#505f76]">
              Result revealed on-chain
            </span>
          )}
        </div>
      </section>

      <ModeTabs
        modes={actualModeKeys}
        selected={currentMode}
        onSelect={setSelectedMode}
      />

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Run ID" value={shortRunId(comparison.runId)} />
        <MetricCard label="Modes" value={`${actualModeKeys.length}`} />

        <MetricCard
          label="Runtime"
          value={fmtDuration(currentModeData.pipeline?.totalDurationMs)}
          highlight
        />

        <MetricCard
          label="Accepted"
          value={bvc.acceptedBallots ?? "—"}
          success
        />

        <MetricCard label="Failed" value={bvc.failedBallots ?? "—"} danger />

        <MetricCard
          label="Avg Gas"
          value={fmtGas(bvc.averageGasPerAcceptedBallot)}
        />

        <MetricCard label="Avg OAL" value={fmtMs(oal.averageEndToEndMs)} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-[#c2c6d6] bg-white p-6 shadow-sm lg:col-span-4">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#191c1e]">
              Mode {currentMode} Pipeline
            </h3>

            <span className="rounded bg-[#0058be] px-2 py-1 text-[10px] font-bold uppercase text-white">
              {currentModeData.status}
            </span>
          </div>

          <div className="space-y-4">
            {(currentModeData.stages ?? []).map((stage) => (
              <div
                key={stage.key}
                className="flex items-center justify-between border-b border-[#eceef0] pb-3 last:border-b-0"
              >
                <span className="text-sm text-[#424754]">{stage.label}</span>

                <span className="font-mono text-sm font-bold text-[#191c1e]">
                  {fmtDuration(stage.durationMs)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#c2c6d6] bg-white shadow-sm lg:col-span-8">
          <div className="border-b border-[#c2c6d6] bg-[#f2f4f6] px-6 py-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#191c1e]">
              Benchmark Comparison
            </h3>
          </div>

          <PerformanceTable modes={modes} />
        </section>
      </div>

      <VoteResults
        finalCounts={finalCounts}
        acceptedBallots={bvc.acceptedBallots}
      />

      {comparison.feasibilitySummary && (
        <FeasibilityCard summary={comparison.feasibilitySummary} />
      )}
    </div>
  );
}

function StageTimeline({ stages }) {
  return (
    <div className="relative space-y-0">
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        const completed = stage.status === "completed";
        const running = stage.status === "running";
        const error = stage.status === "error";

        return (
          <div
            key={stage.key}
            className={`relative flex gap-6 ${last ? "" : "pb-8"}`}
          >
            {!last && (
              <div
                className={`absolute left-[15px] top-8 h-full w-[2px] ${
                  completed ? "bg-[#0058be]" : "bg-[#e0e3e5]"
                }`}
              />
            )}

            <div
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                completed
                  ? "bg-[#00855b] text-white"
                  : running
                    ? "bg-[#0058be] text-white ring-4 ring-[#0058be]/20"
                    : error
                      ? "bg-[#ba1a1a] text-white"
                      : "bg-[#e0e3e5] text-[#727785]"
              }`}
            >
              {completed ? (
                <Check size={15} />
              ) : running ? (
                <Loader2 size={15} className="animate-spin" />
              ) : error ? (
                <XCircle size={15} />
              ) : (
                index + 1
              )}
            </div>

            <div
              className={`${
                stage.status === "pending" ? "opacity-50" : ""
              } flex-1`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-semibold text-[#191c1e]">
                    {stage.label}
                  </h4>

                  <p className="mt-1 font-mono text-xs text-[#727785]">
                    {stage.script}
                  </p>
                </div>

                <div className="text-right">
                  <StageBadge status={stage.status} />

                  {stage.durationMs !== null &&
                    stage.durationMs !== undefined && (
                      <p className="mt-1 font-mono text-[11px] text-[#727785]">
                        {fmtDuration(stage.durationMs)}
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceTable({ modes }) {
  const modeKeys = Object.keys(modes ?? {});

  const rows = [
    {
      label: "Total Runtime",
      value: (mode) => fmtDuration(modes?.[mode]?.pipeline?.totalDurationMs),
    },
    {
      label: "Submitted Ballots",
      value: (mode) => modes?.[mode]?.metrics?.BVC?.submittedBallots ?? "—",
    },
    {
      label: "Accepted Ballots",
      value: (mode) => modes?.[mode]?.metrics?.BVC?.acceptedBallots ?? "—",
    },
    {
      label: "Failed Ballots",
      value: (mode) => modes?.[mode]?.metrics?.BVC?.failedBallots ?? "—",
    },
    {
      label: "Total Gas Used",
      value: (mode) => fmtGas(modes?.[mode]?.metrics?.BVC?.totalGasUsed),
    },
    {
      label: "Avg Gas / Ballot",
      value: (mode) =>
        fmtGas(modes?.[mode]?.metrics?.BVC?.averageGasPerAcceptedBallot),
    },
    {
      label: "Avg OAL",
      value: (mode) => fmtMs(modes?.[mode]?.metrics?.OAL?.averageEndToEndMs),
    },
    {
      label: "Avg Witness Time",
      value: (mode) => fmtMs(modes?.[mode]?.metrics?.OAL?.averageWitnessMs),
    },
    {
      label: "Avg Proof Time",
      value: (mode) => fmtMs(modes?.[mode]?.metrics?.OAL?.averageProofMs),
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[#c2c6d6] bg-white text-[11px] uppercase tracking-wider text-[#727785]">
          <tr>
            <th className="px-6 py-4 font-bold">Metric</th>

            {modeKeys.map((mode) => (
              <th key={mode} className="px-6 py-4 text-center font-bold">
                Mode {mode}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#e0e3e5]">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-6 py-4 font-medium text-[#191c1e]">
                {row.label}
              </td>

              {modeKeys.map((mode) => (
                <td
                  key={mode}
                  className="px-6 py-4 text-center font-mono text-[#424754]"
                >
                  {row.value(mode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VoteResults({ finalCounts, acceptedBallots }) {
  const maxVotes = Math.max(...finalCounts.map((item) => item.votes), 0);

  return (
    <section className="rounded-xl border border-[#c2c6d6] bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-[#191c1e]">
          Final Vote Tally
        </h3>

        <span className="text-sm text-[#727785]">
          Total Ballots Counted: {acceptedBallots ?? "—"}
        </span>
      </div>

      <div className="space-y-6">
        {finalCounts.length === 0 ? (
          <div className="text-sm text-[#727785]">No vote count data.</div>
        ) : (
          finalCounts.map((item) => {
            const leading = item.votes === maxVotes;

            return (
              <div key={item.candidateId} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
                  <div className="flex items-center gap-2">
                    <span>{item.candidateName}</span>

                    {leading && (
                      <span className="rounded-sm bg-[#00855b] px-2 py-0.5 text-[9px] text-white">
                        Leading
                      </span>
                    )}
                  </div>

                  <span
                    className={leading ? "text-[#0058be]" : "text-[#727785]"}
                  >
                    {item.votes} ({item.percentage}%)
                  </span>
                </div>

                <div className="h-8 overflow-hidden rounded bg-[#eceef0]">
                  <div
                    className={`h-full transition-all duration-700 ${
                      leading ? "bg-[#0058be]" : "bg-[#505f76]/40"
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function FeasibilityCard({ summary }) {
  const feasibleModes = summary?.feasibleModes ?? [];
  const eliminatedModes = summary?.eliminatedModes ?? [];

  return (
    <section className="overflow-hidden rounded-xl border border-[#c2c6d6] bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-[#e0e3e5] bg-[#f8fafc] px-6 py-5 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#191c1e]">
            Feasibility Gate
          </h3>

          <p className="mt-1 text-sm text-[#505f76]">
            Modes are filtered by BATD and OC before metric comparison.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-sm border border-[#d8e2ff] bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#0058be]">
            BATD Filter
          </span>

          <span className="rounded-sm border border-[#d8e2ff] bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#0058be]">
            OC Filter
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-12">
        <div className="border-b border-[#e0e3e5] p-6 lg:col-span-4 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dff8e8]">
              <CheckCircle2 size={17} className="text-[#006947]" />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#191c1e]">
                Feasible Modes
              </h4>

              <p className="mt-0.5 text-xs text-[#727785]">
                Modes that pass the context filter
              </p>
            </div>
          </div>

          {feasibleModes.length === 0 ? (
            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4 text-sm text-[#727785]">
              No feasible mode.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {feasibleModes.map((mode) => (
                <span
                  key={mode}
                  className="inline-flex items-center rounded-lg border border-[#c7d7fe] bg-[#f8fbff] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#0058be]"
                >
                  Mode {mode}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 lg:col-span-8">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffdad6]">
              <XCircle size={17} className="text-[#ba1a1a]" />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[#191c1e]">
                Eliminated Modes
              </h4>

              <p className="mt-0.5 text-xs text-[#727785]">
                Modes removed by feasibility rules
              </p>
            </div>
          </div>

          {eliminatedModes.length === 0 ? (
            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4 text-sm text-[#727785]">
              No mode is eliminated under the current requirements.
            </div>
          ) : (
            <div className="space-y-3">
              {eliminatedModes.map((item) => (
                <div
                  key={item.mode}
                  className="rounded-lg border border-[#f2b8b5] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="rounded-md bg-[#ffdad6] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#93000a]">
                        Mode {item.mode}
                      </span>

                      <p className="text-sm leading-6 text-[#505f76]">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ModeTabs({ modes, selected, onSelect }) {
  if (!modes || modes.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => onSelect(mode)}
          className={`rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
            selected === mode
              ? "border-[#0058be] bg-[#d8e2ff] text-[#0058be]"
              : "border-[#c2c6d6] bg-white text-[#505f76] hover:border-[#0058be]"
          }`}
        >
          Mode {mode}
        </button>
      ))}
    </div>
  );
}

function MetricCard({ label, value, highlight, success, danger }) {
  return (
    <div className="rounded-lg border border-[#c2c6d6] bg-white p-4 shadow-sm">
      <p className="mb-1 text-[10px] font-bold uppercase text-[#727785]">
        {label}
      </p>

      <p
        className={`truncate text-lg font-semibold ${
          danger
            ? "text-[#ba1a1a]"
            : success
              ? "text-[#006947]"
              : highlight
                ? "text-[#0058be]"
                : "text-[#191c1e]"
        }`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const className =
    status === "completed"
      ? "bg-[#00855b] text-white"
      : status === "running"
        ? "bg-[#2170e4] text-white status-pulse"
        : status === "error"
          ? "bg-[#ba1a1a] text-white"
          : "bg-[#eceef0] text-[#505f76]";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-widest ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {status}
    </div>
  );
}

function StageBadge({ status }) {
  const label = status || "pending";

  const className =
    label === "completed"
      ? "bg-[#dff8e8] text-[#006947]"
      : label === "running"
        ? "bg-[#d8e2ff] text-[#0058be]"
        : label === "error"
          ? "bg-[#ffdad6] text-[#93000a]"
          : "bg-[#eceef0] text-[#727785]";

  return (
    <span
      className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${className}`}
    >
      {label}
    </span>
  );
}

function inferStageStatus(modeProgress, stageKey, index) {
  const status = modeProgress?.status;

  if (status === "completed") return "completed";
  if (status === "error") return "error";
  if (status === "stopped") return "stopped";

  const currentKey = modeProgress?.currentStage;
  const currentIndex = STAGES.findIndex((stage) => stage.key === currentKey);

  if (!currentKey || currentIndex < 0) {
    return index === 0 ? "running" : "pending";
  }

  if (stageKey === currentKey) return "running";
  if (index < currentIndex) return "completed";
  return "pending";
}

function shortRunId(runId) {
  if (!runId) return "—";
  return runId.replace("run-", "#").slice(0, 12);
}