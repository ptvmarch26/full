import {
  applyFeasibilityRules,
  getFeasibleModes,
  getEliminatedModes,
} from "./feasibilityRules.js";

export function buildFeasibilitySummary(batd, oc) {
  const feasibility = applyFeasibilityRules(batd, oc);
  const feasibleModes = getFeasibleModes(feasibility);
  const eliminatedModes = getEliminatedModes(feasibility);

  return {
    feasibility,
    feasibleModes,
    eliminatedModes,
  };
}
