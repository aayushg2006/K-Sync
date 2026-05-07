import { InfoCard } from "@/components/common/InfoCard";
import { KeyValueGrid } from "@/components/common/KeyValueGrid";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatScenarioName } from "@/lib/formatters";
import type { DemoResetResult, ScenarioRunResult } from "@/services/scenarios.service";

type ScenarioResultCardProps = {
  result: ScenarioRunResult | DemoResetResult;
};

export function ScenarioResultCard({ result }: ScenarioResultCardProps) {
  return (
    <InfoCard description="Use these identifiers to jump into Events, Audit, Business Sync, and Conflicts and validate the resulting system state." title="Scenario Result">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge variant="active">{formatScenarioName(result.scenario)}</StatusBadge>
        {result.correlationId ? <StatusBadge variant="neutral">Correlation {result.correlationId}</StatusBadge> : null}
        {result.eventId ? <StatusBadge variant="neutral">Event {result.eventId}</StatusBadge> : null}
        {result.conflictId ? <StatusBadge variant="pending">Conflict {result.conflictId}</StatusBadge> : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{result.message}</p>
      <KeyValueGrid
        className="mt-5"
        columns={2}
        items={[
          { label: "Scenario", value: formatScenarioName(result.scenario) },
          {
            label: "Correlation ID",
            value: result.correlationId ? <span className="font-mono text-[13px]">{result.correlationId}</span> : "Not returned",
          },
          {
            label: "Event ID",
            value: result.eventId ? <span className="font-mono text-[13px]">{result.eventId}</span> : "Not returned",
          },
          {
            label: "Conflict ID",
            value: result.conflictId ? <span className="font-mono text-[13px]">{result.conflictId}</span> : "Not returned",
          },
        ]}
      />
      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
        <p className="text-sm font-medium text-slate-900">Suggested next checks</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Review Events for the canonical payload, Audit for the delivery trail, Business Sync for state propagation, and Conflicts if the scenario produced a collision or manual review.
        </p>
      </div>
    </InfoCard>
  );
}
