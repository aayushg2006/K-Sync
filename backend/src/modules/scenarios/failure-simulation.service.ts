import { SystemName } from "../../common/types/system.types";

interface SimulatedFailureRule {
  reason: string;
  remainingFailures: number;
}

const simulatedFailures = new Map<string, SimulatedFailureRule>();

function buildRuleKey(targetSystem: SystemName, ubid: string) {
  return `${targetSystem}:${ubid}`;
}

export function scheduleSimulatedWriteFailure(input: {
  reason?: string;
  remainingFailures?: number;
  targetSystem: SystemName;
  ubid: string;
}) {
  simulatedFailures.set(buildRuleKey(input.targetSystem, input.ubid), {
    reason: input.reason ?? `Simulated ${input.targetSystem} write failure for ${input.ubid}.`,
    remainingFailures: input.remainingFailures ?? 1,
  });
}

export function consumeSimulatedWriteFailure(
  targetSystem: SystemName,
  ubid: string,
) {
  const key = buildRuleKey(targetSystem, ubid);
  const rule = simulatedFailures.get(key);

  if (!rule || rule.remainingFailures <= 0) {
    return null;
  }

  rule.remainingFailures -= 1;

  if (rule.remainingFailures <= 0) {
    simulatedFailures.delete(key);
  } else {
    simulatedFailures.set(key, rule);
  }

  return rule.reason;
}

export function clearSimulatedWriteFailures() {
  simulatedFailures.clear();
}
