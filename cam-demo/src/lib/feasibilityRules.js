export function applyFeasibilityRules(batd, oc) {
  const results = {
    A: { feasible: true, caution: false, reasons: [] },
    B: { feasible: true, caution: false, reasons: [] },
    C: { feasible: true, caution: false, reasons: [] },
  };

  if (batd === "Authority-constrained") {
    results.A.feasible = false;
    results.A.reasons.push(
      "BATD = Authority-constrained eliminates Mode A because Mode A depends mainly on CA for ballot acceptance.",
    );
  }

  if (batd === "Publicly verifiable") {
    results.A.feasible = false;
    results.A.reasons.push(
      "BATD = Publicly verifiable eliminates Mode A because ballot validity is verified off-chain by CA.",
    );

    results.C.feasible = false;
    results.C.reasons.push(
      "BATD = Publicly verifiable eliminates Mode C because ballot validity is still verified off-chain by trustees.",
    );
  }

  if (oc === "Minimal") {
    results.C.feasible = false;
    results.C.reasons.push(
      "OC = Minimal eliminates Mode C because Mode C requires trustee coordination and threshold approval.",
    );
  }

  if (oc === "Moderate" && results.C.feasible) {
    results.C.caution = true;
    results.C.reasons.push(
      "OC = Moderate: Mode C is feasible only with a simple trustee threshold configuration.",
    );
  }

  return results;
}

export function getFeasibleModes(feasibility) {
  return Object.entries(feasibility)
    .filter(([, value]) => value.feasible)
    .map(([mode]) => mode);
}

export function getEliminatedModes(feasibility) {
  return Object.entries(feasibility)
    .filter(([, value]) => !value.feasible)
    .map(([mode, value]) => ({
      mode,
      reason: value.reasons[0] || "Eliminated by feasibility rule.",
    }));
}
