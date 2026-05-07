import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  RotateCcw,
  Route,
  ShieldAlert,
  Shuffle,
  Workflow,
} from "lucide-react";
import { ReactNode, useState } from "react";

import { ErrorState } from "@/components/common/ErrorState";
import { InfoCard } from "@/components/common/InfoCard";
import { ScenarioResultCard } from "@/components/common/ScenarioResultCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  resetDemo,
  runConflictScenario,
  runDepartmentToSwsScenario,
  runFailureRetryScenario,
  runIdempotencyScenario,
  runSwsToDepartmentsScenario,
  type DemoResetResult,
  type ScenarioRunResult,
} from "@/services/scenarios.service";

type ScenarioAction = {
  description: string;
  icon: ReactNode;
  label: string;
  run: () => Promise<ScenarioRunResult | DemoResetResult>;
};

export function DemoControlPage() {
  const [lastResult, setLastResult] = useState<ScenarioRunResult | DemoResetResult | null>(null);
  const queryClient = useQueryClient();

  const scenarioMutation = useMutation({
    mutationFn: (runner: () => Promise<ScenarioRunResult | DemoResetResult>) => runner(),
    onSuccess: async (result) => {
      setLastResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["system-health"] }),
        queryClient.invalidateQueries({ queryKey: ["queue-status"] }),
        queryClient.invalidateQueries({ queryKey: ["authority-matrix"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["event-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["business-comparison"] }),
        queryClient.invalidateQueries({ queryKey: ["conflicts"] }),
      ]);
    },
  });

  const actions: ScenarioAction[] = [
    {
      description: "Runs a deterministic SWS registered-address change and waits for propagation into both department systems.",
      icon: <Route className="h-5 w-5" />,
      label: "Run Scenario 1: SWS -> Departments",
      run: runSwsToDepartmentsScenario,
    },
    {
      description: "Applies a direct e-Surakshate manager update, polls the change, and verifies sync back into SWS.",
      icon: <Shuffle className="h-5 w-5" />,
      label: "Run Scenario 2: Department -> SWS",
      run: runDepartmentToSwsScenario,
    },
    {
      description: "Creates competing registered-address updates and demonstrates Authority Matrix conflict resolution.",
      icon: <ShieldAlert className="h-5 w-5" />,
      label: "Run Scenario 3: Conflict Resolution",
      run: runConflictScenario,
    },
    {
      description: "Sends the same SWS request twice and confirms duplicate detection with no second fan-out write.",
      icon: <Workflow className="h-5 w-5" />,
      label: "Run Scenario 4: Idempotency Retry",
      run: runIdempotencyScenario,
    },
    {
      description: "Forces the first e-Karmika write to fail once and verifies the retry succeeds deterministically.",
      icon: <RefreshCw className="h-5 w-5" />,
      label: "Run Scenario 5: Failure + Retry",
      run: runFailureRetryScenario,
    },
    {
      description: "Restores seeded mock records, registry entries, queue state, conflicts, snapshots, and runtime event data.",
      icon: <RotateCcw className="h-5 w-5" />,
      label: "Reset Demo Data",
      run: resetDemo,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Execute deterministic demo scenarios, observe returned identifiers, and refresh the rest of the workspace to inspect resulting state transitions."
        title="Demo Control"
        trailing={<StatusBadge variant="pending">Scenario Runner</StatusBadge>}
      />

      {scenarioMutation.isError ? (
        <ErrorState
          description={scenarioMutation.error instanceof Error ? scenarioMutation.error.message : "A scenario action failed unexpectedly."}
          title="Scenario action error"
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.label}
            className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 text-left shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={scenarioMutation.isPending}
            onClick={() => scenarioMutation.mutate(action.run)}
            type="button"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{action.icon}</div>
              <StatusBadge variant="pending">Scenario</StatusBadge>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">{action.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
          </button>
        ))}
      </section>

      {lastResult ? (
        <ScenarioResultCard result={lastResult} />
      ) : (
        <InfoCard className="border-dashed bg-slate-50/90" title="Run a Scenario">
          <p className="text-sm text-slate-600">
            Run a scenario to generate a correlation trail, downstream writes, and conflict or idempotency evidence across K-Sync.
          </p>
        </InfoCard>
      )}
    </div>
  );
}
