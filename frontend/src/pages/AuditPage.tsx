import { useQuery } from "@tanstack/react-query";
import { Filter, Network, ScrollText } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfoCard } from "@/components/common/InfoCard";
import { KeyValueGrid } from "@/components/common/KeyValueGrid";
import { LoadingState } from "@/components/common/LoadingState";
import { MetadataList } from "@/components/common/MetadataList";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StructuredValue } from "@/components/common/StructuredValue";
import { SystemBadge } from "@/components/common/SystemBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDateTime, formatStatusText } from "@/lib/formatters";
import { getAuditLogs } from "@/services/audit.service";
import type { AuditLog } from "@/types/audit.types";

const PAGE_SIZE = 20;

function toStatusVariant(status: string) {
  if (["COMPLETED", "WRITE_SUCCEEDED", "PROPAGATED_CHANGE_CONFIRMED"].includes(status)) {
    return "active";
  }

  if (["FAILED", "WRITE_FAILED", "DLQ_MOVED", "SUPERSEDED"].includes(status)) {
    return "neutral";
  }

  return "pending";
}

export function AuditPage() {
  const [draftCorrelationId, setDraftCorrelationId] = useState("");
  const [draftUbid, setDraftUbid] = useState("");
  const [correlationIdFilter, setCorrelationIdFilter] = useState("");
  const [ubidFilter, setUbidFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  const auditQuery = useQuery({
    queryFn: () =>
      getAuditLogs({
        correlationId: correlationIdFilter || undefined,
        ubid: ubidFilter || undefined,
        limit: PAGE_SIZE,
        page,
      }),
    queryKey: ["audit-logs", correlationIdFilter, ubidFilter, page],
  });

  const auditLogs = auditQuery.data?.items ?? [];

  useEffect(() => {
    if (auditLogs.length === 0) {
      setSelectedAuditId(null);
      return;
    }

    if (!selectedAuditId || !auditLogs.some((log) => log.auditId === selectedAuditId)) {
      setSelectedAuditId(auditLogs[0].auditId);
    }
  }, [auditLogs, selectedAuditId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setCorrelationIdFilter(draftCorrelationId.trim());
    setUbidFilter(draftUbid.trim());
  }

  const selectedAudit: AuditLog | undefined =
    auditLogs.find((log) => log.auditId === selectedAuditId) ?? auditLogs[0];

  const relatedLogs = useMemo(() => {
    if (!selectedAudit) {
      return [];
    }

    return auditLogs.filter(
      (log) =>
        log.correlationId === selectedAudit.correlationId ||
        log.eventId === selectedAudit.eventId,
    );
  }, [auditLogs, selectedAudit]);

  const payloadBefore =
    selectedAudit?.metadata && "payloadBefore" in selectedAudit.metadata
      ? selectedAudit.metadata.payloadBefore
      : undefined;
  const payloadAfter =
    selectedAudit?.metadata && "payloadAfter" in selectedAudit.metadata
      ? selectedAudit.metadata.payloadAfter
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Trace event lifecycles across validation, routing, translation, delivery, and retries with readable audit evidence tied to the same correlation flow."
        title="Audit"
        trailing={<StatusBadge variant="active">Correlation View</StatusBadge>}
      />

      <InfoCard
        description="Filter the operational ledger by correlation ID or UBID to focus on a single sync journey."
        title="Audit Filters"
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="correlation-filter">
                Filter by correlation ID
              </label>
              <input
                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
                id="correlation-filter"
                onChange={(event) => setDraftCorrelationId(event.target.value)}
                placeholder="scenario-sws-address-..."
                value={draftCorrelationId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="ubid-filter">
                Filter by UBID
              </label>
              <input
                className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
                id="ubid-filter"
                onChange={(event) => setDraftUbid(event.target.value)}
                placeholder="UBID-KA-2026-0001"
                value={draftUbid}
              />
            </div>
            <div className="flex items-end">
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 lg:w-auto"
                type="submit"
              >
                <Filter className="h-4 w-4" />
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </InfoCard>

      {auditQuery.isLoading ? <LoadingState label="Loading audit logs..." /> : null}

      {auditQuery.isError ? (
        <ErrorState
          description="Audit data could not be loaded from the dashboard API."
          title="Audit logs unavailable"
        />
      ) : null}

      {!auditQuery.isLoading && !auditQuery.isError && auditLogs.length === 0 ? (
        <EmptyState
          description="No audit logs match the current filters."
          title="No audit logs found"
        />
      ) : null}

      {auditLogs.length > 0 ? (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <InfoCard
            actions={<StatusBadge variant="neutral">{auditQuery.data?.total ?? 0} records</StatusBadge>}
            className="overflow-hidden"
            description="Select a row to understand what stage the sync reached and what metadata was captured."
            title="Audit Trail"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Systems</th>
                    <th className="px-4 py-3 font-medium">Message</th>
                    <th className="px-4 py-3 font-medium">Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr
                      key={log.auditId}
                      className={`cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 ${
                        selectedAudit?.auditId === log.auditId ? "bg-sky-50/80" : ""
                      }`}
                      onClick={() => setSelectedAuditId(log.auditId)}
                    >
                      <td className="px-4 py-4 text-slate-500">{formatDateTime(log.createdAt ?? log.recordedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge variant="neutral">{log.stage}</StatusBadge>
                          <StatusBadge variant={toStatusVariant(log.status)}>{formatStatusText(log.status)}</StatusBadge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <SystemBadge system={log.sourceSystem} />
                          {log.targetSystem ? <SystemBadge system={log.targetSystem} /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{log.message}</td>
                      <td className="px-4 py-4 text-slate-500">{log.correlationId}</td>
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
                {Math.min(page * PAGE_SIZE, auditQuery.data?.total ?? 0)} of {auditQuery.data?.total ?? 0}
              </span>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page * PAGE_SIZE >= (auditQuery.data?.total ?? 0)}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </InfoCard>

          <div className="space-y-6">
            {selectedAudit ? (
              <>
                <InfoCard title="Selected Audit Record">
                  <div className="flex flex-wrap items-center gap-2">
                    <SystemBadge system={selectedAudit.sourceSystem} />
                    {selectedAudit.targetSystem ? <SystemBadge system={selectedAudit.targetSystem} /> : null}
                    <StatusBadge variant="neutral">{formatStatusText(selectedAudit.stage)}</StatusBadge>
                    <StatusBadge variant={toStatusVariant(selectedAudit.status)}>{formatStatusText(selectedAudit.status)}</StatusBadge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">{selectedAudit.auditId}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{selectedAudit.message}</p>
                  <KeyValueGrid
                    className="mt-5"
                    columns={2}
                    items={[
                      { label: "Event ID", value: <span className="font-mono text-[13px]">{selectedAudit.eventId}</span> },
                      { label: "Correlation ID", value: <span className="font-mono text-[13px]">{selectedAudit.correlationId}</span> },
                      { label: "UBID", value: selectedAudit.ubid },
                      { label: "Service Type", value: formatStatusText(selectedAudit.serviceType) },
                      { label: "Operation", value: formatStatusText(selectedAudit.operation) },
                      { label: "Recorded At", value: formatDateTime(selectedAudit.recordedAt) },
                    ]}
                  />
                </InfoCard>

                <InfoCard title="Stage Sequence on This Page">
                  <div className="space-y-3">
                    {relatedLogs.map((log) => (
                      <article key={log.auditId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge variant="neutral">{formatStatusText(log.stage)}</StatusBadge>
                          <StatusBadge variant={toStatusVariant(log.status)}>{formatStatusText(log.status)}</StatusBadge>
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-950">{log.message}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(log.createdAt ?? log.recordedAt)}</p>
                      </article>
                    ))}
                  </div>
                </InfoCard>

                <InfoCard title="Audit Metadata">
                  <MetadataList metadata={selectedAudit.metadata} />
                </InfoCard>

                <InfoCard title="Payload Transitions">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <ScrollText className="h-4 w-4 text-sky-700" />
                        Payload Before
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-600">
                        <StructuredValue value={payloadBefore} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Network className="h-4 w-4 text-sky-700" />
                        Payload After
                      </div>
                      <div className="mt-3 text-sm leading-6 text-slate-600">
                        <StructuredValue value={payloadAfter} />
                      </div>
                    </div>
                  </div>
                </InfoCard>
              </>
            ) : (
              <EmptyState
                description="Select an audit row to inspect metadata and payload details."
                title="No audit record selected"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
