import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, ShieldCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { BadgeList } from "@/components/common/BadgeList";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfoCard } from "@/components/common/InfoCard";
import { KeyValueGrid } from "@/components/common/KeyValueGrid";
import { LoadingState } from "@/components/common/LoadingState";
import { MetadataList } from "@/components/common/MetadataList";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SystemBadge } from "@/components/common/SystemBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatAddress, formatDateTime, formatLabel, formatStatusText, summarizeValue } from "@/lib/formatters";
import { getConflicts } from "@/services/conflicts.service";
import { getAuthorityMatrix } from "@/services/dashboard.service";

const PAGE_SIZE = 20;

function renderPayloadField(payload: Record<string, unknown>, field: string) {
  const value = payload[field];

  if (field === "registeredAddress" && value && typeof value === "object") {
    return formatAddress(value as never);
  }

  if (field === "authorizedSignatory" && value && typeof value === "object" && "name" in value) {
    return summarizeValue(value.name);
  }

  return summarizeValue(value);
}

export function ConflictsPage() {
  const [page, setPage] = useState(1);
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);

  const conflictsQuery = useQuery({
    queryFn: () => getConflicts({ limit: PAGE_SIZE, page }),
    queryKey: ["conflicts", page],
  });

  const authorityQuery = useQuery({
    queryFn: getAuthorityMatrix,
    queryKey: ["authority-matrix"],
  });

  const conflicts = conflictsQuery.data?.items ?? [];
  const manualReviewItems = conflictsQuery.data?.manualReviewItems ?? [];

  const selectedConflict =
    conflicts.find((conflict) => conflict.conflictId === selectedConflictId) ?? conflicts[0];

  const selectedManualReviews = useMemo(
    () =>
      manualReviewItems.filter((item) => item.conflictId && item.conflictId === selectedConflict?.conflictId),
    [manualReviewItems, selectedConflict?.conflictId],
  );

  const matchingAuthorityRules = useMemo(
    () =>
      (authorityQuery.data ?? []).filter((rule) =>
        selectedConflict?.conflictingFields.some((field) => rule.fieldPath.includes(field)),
      ),
    [authorityQuery.data, selectedConflict?.conflictingFields],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review collision handling, authority-matrix decisions, and manual review work items created when systems compete for the same UBID."
        title="Conflicts"
        trailing={<StatusBadge variant="pending">Resolution Console</StatusBadge>}
      />

      {conflictsQuery.isLoading || authorityQuery.isLoading ? (
        <LoadingState label="Loading conflicts and authority rules..." />
      ) : null}

      {conflictsQuery.isError || authorityQuery.isError ? (
        <ErrorState
          description="Conflict or Authority Matrix data could not be loaded from the backend."
          title="Conflict data is unavailable"
        />
      ) : null}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <InfoCard
          actions={<StatusBadge variant="neutral">{conflictsQuery.data?.total ?? 0} conflicts</StatusBadge>}
          className="overflow-hidden"
          description="Select a conflict to compare both payloads and see the rule or review outcome."
          title="Conflict Table"
        >
          {conflicts.length === 0 ? (
            <EmptyState
              description="No conflicts have been recorded yet. Run the conflict scenario to generate a deterministic example."
              title="No conflicts recorded"
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Conflict</th>
                      <th className="px-4 py-3 font-medium">UBID</th>
                      <th className="px-4 py-3 font-medium">Field</th>
                      <th className="px-4 py-3 font-medium">Resolution</th>
                      <th className="px-4 py-3 font-medium">Winner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((conflict) => (
                      <tr
                        key={conflict.conflictId}
                        className={`cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 ${
                          selectedConflict?.conflictId === conflict.conflictId ? "bg-sky-50/80" : ""
                        }`}
                        onClick={() => setSelectedConflictId(conflict.conflictId)}
                      >
                        <td className="px-4 py-4 text-slate-900">{conflict.conflictId}</td>
                        <td className="px-4 py-4 text-slate-700">{conflict.ubid}</td>
                        <td className="px-4 py-4 text-slate-700">
                          {conflict.conflictingFields?.[0] ? formatLabel(conflict.conflictingFields[0]) : "-"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge variant={conflict.resolutionStatus === "AUTO_RESOLVED" ? "active" : "pending"}>
                            {formatStatusText(conflict.resolutionStatus ?? conflict.outcome)}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-4">
                          <SystemBadge system={conflict.sourceSystem} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  type="button"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, conflictsQuery.data?.total ?? 0)} of {conflictsQuery.data?.total ?? 0}
                </span>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page * PAGE_SIZE >= (conflictsQuery.data?.total ?? 0)}
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </InfoCard>

        <div className="space-y-6">
          <InfoCard title="Authority Matrix">
            {authorityQuery.data && authorityQuery.data.length > 0 ? (
              <div className="space-y-3">
                {authorityQuery.data.map((rule) => (
                  <article key={`${rule.fieldPath}-${rule.version}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{rule.fieldPath}</p>
                      <StatusBadge variant={rule.manualReviewRequired ? "pending" : "active"}>
                        {rule.manualReviewRequired ? "Manual Review" : "Auto"}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">Authority: {rule.authoritativeSystem}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-400">
                      {rule.targetSystem ? `Targets ${rule.targetSystem}` : "Applies across systems"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState description="No active Authority Matrix rules were returned." title="No authority rules found" />
            )}
          </InfoCard>

          <InfoCard title="Manual Review Queue">
            {manualReviewItems.length === 0 ? (
              <p className="text-sm text-slate-600">No manual review items are currently open.</p>
            ) : (
              <div className="space-y-3">
                {manualReviewItems.map((item) => (
                  <article key={item.reviewId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <StatusBadge variant={item.reviewStatus === "OPEN" ? "pending" : "neutral"}>
                        {formatStatusText(item.reviewStatus)}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{item.summary ?? "Manual review details are available in the debug payload."}</p>
                  </article>
                ))}
              </div>
            )}
          </InfoCard>

          {selectedConflict ? (
            <>
              <InfoCard title="Selected Conflict">
                <div className="flex flex-wrap items-center gap-2">
                  <SystemBadge system={selectedConflict.sourceSystem} />
                  <SystemBadge system={selectedConflict.targetSystem} />
                  <StatusBadge variant={selectedConflict.resolutionStatus === "AUTO_RESOLVED" ? "active" : "pending"}>
                    {formatStatusText(selectedConflict.resolutionStatus ?? selectedConflict.outcome)}
                  </StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {selectedConflict.explanation ?? selectedConflict.notes ?? "Conflict explanation is available in the authority decision payload."}
                </p>
                <KeyValueGrid
                  className="mt-5"
                  columns={2}
                  items={[
                    { label: "Conflict ID", value: <span className="font-mono text-[13px]">{selectedConflict.conflictId}</span> },
                    { label: "Correlation ID", value: <span className="font-mono text-[13px]">{selectedConflict.correlationId}</span> },
                    { label: "Event ID", value: <span className="font-mono text-[13px]">{selectedConflict.eventId}</span> },
                    { label: "Detected At", value: formatDateTime(selectedConflict.detectedAt) },
                    { label: "Outcome", value: formatStatusText(selectedConflict.outcome) },
                    { label: "Reviewed At", value: formatDateTime(selectedConflict.reviewedAt) },
                  ]}
                />
              </InfoCard>

              <InfoCard title="Conflicting Fields">
                <BadgeList values={selectedConflict.conflictingFields} />
              </InfoCard>

              <InfoCard title="Payload Comparison">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <GitCompareArrows className="h-4 w-4 text-sky-700" />
                      Source Payload
                    </div>
                    <div className="mt-3">
                      <SystemBadge system={selectedConflict.sourceSystem} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedConflict.conflictingFields.map((field) => (
                        <div key={`source-${field}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{formatLabel(field)}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-900">
                            {renderPayloadField(selectedConflict.sourcePayload as Record<string, unknown>, field)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <TriangleAlert className="h-4 w-4 text-sky-700" />
                      Target Payload
                    </div>
                    <div className="mt-3">
                      <SystemBadge system={selectedConflict.targetSystem} />
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedConflict.conflictingFields.map((field) => (
                        <div key={`target-${field}`} className="rounded-2xl border border-white bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{formatLabel(field)}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-900">
                            {renderPayloadField(selectedConflict.targetPayload as Record<string, unknown>, field)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </InfoCard>

              <InfoCard title="Applied Authority Rule">
                {matchingAuthorityRules.length > 0 ? (
                  <div className="space-y-3">
                    {matchingAuthorityRules.map((rule) => (
                      <article key={`${rule.fieldPath}-${rule.version}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">{rule.fieldPath}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <SystemBadge system={rule.authoritativeSystem} />
                            <StatusBadge variant={rule.manualReviewRequired ? "pending" : "active"}>
                              {rule.manualReviewRequired ? "Manual Review" : "Auto Resolve"}
                            </StatusBadge>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{rule.notes ?? "Rule metadata is available in the debug view."}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No direct authority rule match was found from the currently loaded rule list.</p>
                )}
              </InfoCard>

              {selectedManualReviews.length > 0 ? (
                <InfoCard title="Manual Review Details">
                  <div className="space-y-3">
                    {selectedManualReviews.map((item) => (
                      <article key={item.reviewId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          <StatusBadge variant={item.reviewStatus === "OPEN" ? "pending" : "neutral"}>
                            {formatStatusText(item.reviewStatus)}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{item.summary ?? "See the debug panel for full review payloads."}</p>
                      </article>
                    ))}
                  </div>
                </InfoCard>
              ) : null}

              <InfoCard title="Decision Metadata">
                <MetadataList metadata={selectedConflict.authorityDecision ?? selectedConflict.metadata} />
              </InfoCard>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
