import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FlaskConical,
  Play,
  RefreshCw,
  Rocket,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import CamAnalyzeLayout from "../components/CamAnalyzeLayout.jsx";
import { getVoterScale } from "../lib/scenarioMatcher.js";

const SAMPLE_CONFIG = {
  n: 1000,
  q: 5,
  s: 1,
  modes: ["A", "B", "C"],
  batd: "Authority-constrained",
  oc: "Moderate",
  trusteeCount: 5,
  approvalThreshold: 3,
};

const BATD_OPTIONS = [
  "Authority-reliant",
  "Authority-constrained",
  "Publicly verifiable",
];
const OC_OPTIONS = ["Minimal", "Moderate", "Advanced"];

function validate(cfg) {
  const errs = {};

  if (!cfg.n || cfg.n < 1) errs.n = "n ≥ 1";
  if (!cfg.q || cfg.q < 2) errs.q = "q ≥ 2";
  if (!cfg.s || cfg.s < 1) errs.s = "s ≥ 1";
  if (cfg.s > cfg.q) errs.s = "s ≤ q";
  if (!cfg.modes || cfg.modes.length === 0)
    errs.modes = "Select at least one mode";
  if (!cfg.trusteeCount || cfg.trusteeCount < 2) errs.trusteeCount = "≥ 2";
  if (cfg.trusteeCount > 19) errs.trusteeCount = "≤ 19";
  if (!cfg.approvalThreshold || cfg.approvalThreshold < 1)
    errs.approvalThreshold = "≥ 1";
  if (cfg.approvalThreshold >= cfg.trusteeCount)
    errs.approvalThreshold = "< trustees";

  return errs;
}

export default function RunSimulationPage() {
  const navigate = useNavigate();

  const [cfg, setCfg] = useState(SAMPLE_CONFIG);
  const [errors, setErrors] = useState({});
  const [starting, setStarting] = useState(false);

  const VS = cfg.n ? getVoterScale(Number(cfg.n)) : "—";

  const set = (key, value) => setCfg((prev) => ({ ...prev, [key]: value }));
  const numSet = (key, value) => set(key, value === "" ? "" : Number(value));

  function handleReset() {
    setCfg({
      n: "",
      q: "",
      s: "",
      modes: [],
      batd: "Authority-reliant",
      oc: "Minimal",
      trusteeCount: 3,
      approvalThreshold: 2,
    });
    setErrors({});
  }

  function handleRun() {
    const errs = validate(cfg);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const body = {
      n: Number(cfg.n),
      q: Number(cfg.q),
      s: Number(cfg.s),
      modes: cfg.modes,
      VS,
      batd: cfg.batd,
      oc: cfg.oc,
      threshold: {
        trusteeCount: Number(cfg.trusteeCount),
        approvalThreshold: Number(cfg.approvalThreshold),
      },
    };

    localStorage.setItem("camsv:lastConfig", JSON.stringify(body));
    localStorage.setItem("camsv:runStartedAt", String(Date.now()));

    setStarting(true);

    fetch("/api/run-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {
      localStorage.setItem("camsv:lastRunError", "Cannot start simulation.");
    });

    navigate("/run/analysis");
  }

  return (
    <CamAnalyzeLayout active="setup">
      <main className="mx-auto mt-20 grid min-h-[calc(100vh-160px)] w-full max-w-[1440px] grid-cols-12 items-start gap-6 p-6">
        <aside className="sticky top-[104px] col-span-12 flex flex-col gap-4 md:col-span-4 lg:col-span-3">
          <div className="rounded-lg border border-[#c2c6d6] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 size={15} className="text-[#0058be]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#191c1e]">
                Parameters
              </h2>
            </div>

            <div className="space-y-5">
              <Field label="Voters (n)" error={errors.n}>
                <input
                  type="number"
                  value={cfg.n}
                  min="1"
                  onChange={(e) => numSet("n", e.target.value)}
                  className={inputClass(errors.n)}
                />

                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#727785]">
                    Voter Scale (VS)
                  </span>
                  <span className="rounded-sm bg-[#d8e2ff] px-2 py-0.5 text-[11px] font-bold uppercase text-[#0058be]">
                    {VS}
                  </span>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Candidates (q)" error={errors.q}>
                  <input
                    type="number"
                    value={cfg.q}
                    min="2"
                    onChange={(e) => numSet("q", e.target.value)}
                    className={inputClass(errors.q)}
                  />
                </Field>

                <Field label="Selections (s)" error={errors.s}>
                  <input
                    type="number"
                    value={cfg.s}
                    min="1"
                    onChange={(e) => numSet("s", e.target.value)}
                    className={inputClass(errors.s)}
                  />
                </Field>
              </div>

              <SectionDivider />

              <div>
                <div className="mb-2 text-[11px] font-semibold text-[#424754]">
                  Target Modes
                </div>

                <div className="space-y-1">
                  {[
                    ["A", "Standard"],
                    ["B", "Enhanced Privacy"],
                    ["C", "Trustless"],
                  ].map(([mode, label]) => {
                    const checked = cfg.modes.includes(mode);

                    return (
                      <label
                        key={mode}
                        className="flex cursor-pointer items-center gap-2 rounded-sm p-1.5 transition hover:bg-[#eceef0]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...cfg.modes, mode].sort()
                              : cfg.modes.filter((item) => item !== mode);

                            set("modes", next);
                          }}
                          className="h-4 w-4 rounded accent-[#0058be]"
                        />

                        <span className="text-sm text-[#191c1e]">
                          Mode {mode}{" "}
                          <span className="text-[#505f76]">({label})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {errors.modes && (
                  <div className="mt-1 text-[11px] text-[#ba1a1a]">
                    {errors.modes}
                  </div>
                )}
              </div>

              <SectionDivider />

              <div>
                <div className="mb-3 text-[11px] font-semibold text-[#424754]">
                  Governance Context
                </div>

                <div className="space-y-3">
                  <Field label="BATD Strategy">
                    <select
                      value={cfg.batd}
                      onChange={(e) => set("batd", e.target.value)}
                      className={inputClass()}
                    >
                      {BATD_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Operational Capability (OC)">
                    <select
                      value={cfg.oc}
                      onChange={(e) => set("oc", e.target.value)}
                      className={inputClass()}
                    >
                      {OC_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <SectionDivider />

              <div className={!cfg.modes.includes("C") ? "opacity-50" : ""}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#424754]">
                    Mode C Thresholds
                  </span>
                  <span className="rounded-sm bg-[#d0e1fb] px-2 py-0.5 text-[10px] font-bold uppercase text-[#505f76]">
                    {cfg.approvalThreshold} / {cfg.trusteeCount} required
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Trustees" error={errors.trusteeCount}>
                    <input
                      type="number"
                      min="2"
                      max="19"
                      value={cfg.trusteeCount}
                      onChange={(e) => numSet("trusteeCount", e.target.value)}
                      disabled={!cfg.modes.includes("C")}
                      className={inputClass(errors.trusteeCount)}
                    />
                  </Field>

                  <Field label="Approvals" error={errors.approvalThreshold}>
                    <input
                      type="number"
                      min="1"
                      max={Number(cfg.trusteeCount) - 1}
                      value={cfg.approvalThreshold}
                      onChange={(e) =>
                        numSet("approvalThreshold", e.target.value)
                      }
                      disabled={!cfg.modes.includes("C")}
                      className={inputClass(errors.approvalThreshold)}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={handleRun}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0058be] py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Starting
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run Simulation
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c2c6d6] py-2.5 text-xs font-bold uppercase tracking-widest text-[#424754] transition hover:bg-[#eceef0]"
              >
                <RefreshCw size={15} />
                Reset
              </button>
            </div>
          </div>
        </aside>

        <section className="col-span-12 flex min-h-[716px] flex-col gap-6 md:col-span-8 lg:col-span-9">
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#c2c6d6] bg-white p-12 text-center">
            <div className="relative mb-6 h-44 w-44">
              <div className="absolute inset-0 flex items-center justify-center">
                <Rocket size={120} className="text-[#0058be] opacity-20" />
              </div>
            </div>

            <h3 className="mb-3 text-2xl font-semibold text-[#191c1e]">
              Ready for Simulation
            </h3>

            <p className="max-w-md text-sm leading-6 text-[#424754]">
              Configure network parameters on the left panel. Click Run
              Simulation to initiate the 7-stage CAMS-V verification process.
            </p>

            <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
              <MiniInfo
                icon={<Users size={18} />}
                title="Scenario"
                text="n, q, s"
              />
              <MiniInfo
                icon={<FlaskConical size={18} />}
                title="Modes"
                text="A / B / C"
              />
              <MiniInfo
                icon={<ShieldCheck size={18} />}
                title="Trust"
                text="BATD + OC"
              />
            </div>
          </div>
        </section>
      </main>
    </CamAnalyzeLayout>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-[#424754]">
        {label}
      </label>

      {children}

      {error && <div className="mt-1 text-[11px] text-[#ba1a1a]">{error}</div>}
    </div>
  );
}

function inputClass(error) {
  return `w-full rounded-sm border px-2 py-1.5 text-sm outline-none transition focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] disabled:cursor-not-allowed disabled:opacity-60 ${
    error ? "border-[#ba1a1a] bg-[#ffdad6]/30" : "border-[#c2c6d6] bg-[#f2f4f6]"
  }`;
}

function SectionDivider() {
  return <div className="border-t border-[#c2c6d6]" />;
}

function MiniInfo({ icon, title, text }) {
  return (
    <div className="rounded-lg border border-[#c2c6d6] bg-[#f7f9fb] p-4 text-left">
      <div className="mb-2 text-[#0058be]">{icon}</div>
      <div className="text-sm font-semibold text-[#191c1e]">{title}</div>
      <div className="mt-1 text-xs text-[#727785]">{text}</div>
    </div>
  );
}
