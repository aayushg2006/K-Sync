import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock3, Fingerprint, GitBranch, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BadgeList } from "@/components/common/BadgeList";
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
import {
  formatAddress,
  formatCount,
  formatDateTime,
  formatStatusText,
  summarizeValue,
} from "@/lib/formatters";
import { getEventById, getEvents } from "@/services/events.service";
import type { EventStatus, SystemName } from "@/types/event.types";

const PAGE_SIZE = 20;

function toStatusVariant(status: EventStatus) {
  if (["COMPLETED", "WRITE_SUCCEEDED", "PROPAGATED_CHANGE_CONFIRMED"].includes(status)) {
    return "active";
  }

  if (["FAILED", "WRITE_FAILED", "DLQ_MOVED", "SUPERSEDED"].includes(status)) {
    return "neutral";
  }

  return "pending";
}

export function EventsPage() {
  const [page, setPage] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const eventsQuery = useQuery({
    queryFn: () => getEvents({ limit: PAGE_SIZE, page }),
    queryKey: ["events", page],
  });

  const events = eventsQuery.data?.items ?? [];

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (!selectedEventId || !events.some((event) => event.eventId === selectedEventId)) {
      setSelectedEventId(events[0].eventId);
    }
  }, [events, selectedEventId]);

  const eventDetailQuery = useQuery({
    enabled: Boolean(selectedEventId),
    queryFn: () => getEventById(selectedEventId!),
    queryKey: ["event-detail", selectedEventId],
  });

  const selectedEvent = eventDetailQuery.data?.event;
  const relatedAuditLogs = eventDetailQuery.data?.auditLogs ?? [];
  const eventMetadata = (selectedEvent?.metadata ?? {}) as Record<string, unknown>;
  const routingResolutions = Array.isArray(eventMetadata.routingResolutions)
    ? eventMetadata.routingResolutions
    : [];
  const queuedTargets = Array.isArray(eventMetadata.queuedTargets)
    ? eventMetadata.queuedTargets
    : [];
  const conflictIds = Array.isArray(eventMetadata.conflictIds)
    ? eventMetadata.conflictIds.filter((value): value is string => typeof value === "string")
    : [];
  const idempotencyKeys =
    eventMetadata.idempotencyKeys && typeof eventMetadata.idempotencyKeys === "object"
      ? (eventMetadata.idempotencyKeys as Record<string, unknown>)
      : undefined;
  const supplementalMetadata = selectedEvent
    ? Object.fromEntries(
        Object.entries(eventMetadata).filter(
          ([key]) =>
            !["routingResolutions", "queuedTargets", "conflictIds", "idempotencyKeys"].includes(key),
        ),
      )
    : undefined;

  const payloadItems = useMemo(() => {
    if (!selectedEvent) {
      return [];
    }

    return [
      { label: "Business Name", value: selectedEvent.payload.businessName ?? "Not available" },
      { label: "Registered Address", value: formatAddress(selectedEvent.payload.registeredAddress) },
      { label: "Authorized Signatory", value: selectedEvent.payload.authorizedSignatory?.name ?? "Not available" },
      { label: "Employee Count", value: formatCount(selectedEvent.payload.employeeCount) },
      { label: "Worker Limit", value: formatCount(selectedEvent.payload.workerLimit) },
      { label: "Power Capacity", value: formatCount(selectedEvent.payload.powerCapacityHP, "HP") },
      { label: "License Expiry", value: selectedEvent.payload.licenseExpiry ?? "Not available" },
    ];
  }, [selectedEvent]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Inspect canonical events, understand which systems were routed, and review delivery evidence without digging through raw payload dumps."
        title="Events"
        trailing={<StatusBadge variant="active">Canonical Stream</StatusBadge>}
      />

      {eventsQuery.isLoading ? <LoadingState label="Loading canonical events..." /> : null}

      {eventsQuery.isError ? (
        <ErrorState
          description="The event list could not be loaded. Verify the backend is running and the dashboard events API is reachable."
          title="Events are unavailable"
        />
      ) : null}

      {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 ? (
        <EmptyState
          description="No canonical events are available yet. Run a scenario from Demo Control to populate the event stream."
          title="No events available"
        />
      ) : null}

      {events.length > 0 ? (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
          <InfoCard
            actions={
              <StatusBadge variant="neutral">
                Page {eventsQuery.data?.page} of {Math.max(1, Math.ceil((eventsQuery.data?.total ?? 0) / PAGE_SIZE))}
              </StatusBadge>
            }
            className="overflow-hidden"
            description="Choose an event to inspect the canonical payload, routing targets, and downstream audit trail."
            title="Canonical Event Stream"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-y border-slate-200 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Flow</th>
                    <th className="px-4 py-3 font-medium">Targets</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr
                      key={event.eventId}
                      className={`cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50 ${
                        selectedEventId === event.eventId ? "bg-sky-50/80" : ""
                      }`}
                      onClick={() => setSelectedEventId(event.eventId)}
                    >
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-950">{event.eventId}</div>
                        <div className="mt-1 text-xs text-slate-500">{event.ubid}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <SystemBadge system={event.sourceSystem} />
                          {event.targetSystem ? (
                            <>
                              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                              <SystemBadge system={event.targetSystem} />
                            </>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">{formatStatusText(event.serviceType)}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {event.routeTargets?.length ? `${event.routeTargets.length} routed target(s)` : "Resolved in metadata"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge variant={toStatusVariant(event.status)}>{formatStatusText(event.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-4 text-slate-500">{formatDateTime(event.receivedAt)}</td>
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
                {Math.min(page * PAGE_SIZE, eventsQuery.data?.total ?? 0)} of {eventsQuery.data?.total ?? 0}
              </span>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page * PAGE_SIZE >= (eventsQuery.data?.total ?? 0)}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </InfoCard>

          <div className="space-y-6">
            {eventDetailQuery.isLoading ? <LoadingState label="Loading event details..." /> : null}

            {eventDetailQuery.isError ? (
              <ErrorState
                description="The selected event details could not be loaded."
                title="Event details unavailable"
              />
            ) : null}

            {selectedEvent ? (
              <>
                <InfoCard title="Event Overview">
                  <div className="flex flex-wrap items-center gap-2">
                    <SystemBadge system={selectedEvent.sourceSystem} />
                    {selectedEvent.targetSystem ? <SystemBadge system={selectedEvent.targetSystem} /> : null}
                    <StatusBadge variant={toStatusVariant(selectedEvent.status)}>
                      {formatStatusText(selectedEvent.status)}
                    </StatusBadge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-950">{selectedEvent.eventId}</h3>
                  <KeyValueGrid
                    className="mt-5"
                    columns={2}
                    items={[
                      { label: "UBID", value: selectedEvent.ubid },
                      {
                        label: "Correlation ID",
                        value: <span className="font-mono text-[13px]">{selectedEvent.correlationId}</span>,
                      },
                      { label: "Service Type", value: formatStatusText(selectedEvent.serviceType) },
                      { label: "Operation", value: formatStatusText(selectedEvent.operation) },
                      { label: "Received At", value: formatDateTime(selectedEvent.receivedAt) },
                      { label: "Completed At", value: formatDateTime(selectedEvent.completedAt) },
                      {
                        label: "Source Request ID",
                        value: selectedEvent.sourceRequestId ? (
                          <span className="font-mono text-[13px]">{selectedEvent.sourceRequestId}</span>
                        ) : (
                          "Not available"
                        ),
                      },
                      {
                        label: "Payload Hash",
                        value: <span className="font-mono text-[12px]">{selectedEvent.normalizedPayloadHash}</span>,
                      },
                    ]}
                  />
                </InfoCard>

                <InfoCard title="Changed Fields and Routing">
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Fingerprint className="h-4 w-4 text-sky-700" />
                        Changed Fields
                      </div>
                      <div className="mt-3">
                        <BadgeList values={selectedEvent.changedFields} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Route className="h-4 w-4 text-sky-700" />
                        Route Targets
                      </div>
                      <div className="mt-3 space-y-3">
                        {(selectedEvent.routeTargets ?? []).length > 0 ? (
                          (selectedEvent.routeTargets ?? []).map((target, index) => (
                            <div
                              key={`${selectedEvent.eventId}-${index}`}
                              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                {typeof target.targetSystem === "string" ? (
                                  <SystemBadge system={target.targetSystem as SystemName} />
                                ) : (
                                  <StatusBadge variant="neutral">Target</StatusBadge>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-slate-700">
                                Local identifier:{" "}
                                <span className="font-medium text-slate-950 [overflow-wrap:anywhere]">
                                  {summarizeValue(target.localIdentifier)}
                                </span>
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No direct route target list was returned for this event.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </InfoCard>

                <InfoCard title="Canonical Payload">
                  <KeyValueGrid columns={2} items={payloadItems} />
                </InfoCard>

                <InfoCard title="Routing and Queue Metadata">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <GitBranch className="h-4 w-4 text-sky-700" />
                        Routing Resolutions
                      </div>
                      <div className="mt-3 space-y-3">
                        {routingResolutions.length > 0 ? (
                          routingResolutions.map((resolution, index) => (
                            <div
                              key={`${selectedEvent.eventId}-resolution-${index}`}
                              className="rounded-2xl border border-white bg-white px-4 py-3"
                            >
                              <StructuredValue value={resolution} />
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">No routing resolution entries were returned.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Clock3 className="h-4 w-4 text-sky-700" />
                        Additional Metadata
                      </div>
                      <div className="mt-3 space-y-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Conflict IDs</p>
                          <div className="mt-2">
                            <BadgeList values={conflictIds} />
                          </div>
                        </div>
                        {queuedTargets.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Queued Targets
                            </p>
                            <div className="mt-2 space-y-3">
                              {queuedTargets.map((target, index) => (
                                <div
                                  key={`${selectedEvent.eventId}-queued-${index}`}
                                  className="rounded-2xl border border-white bg-white px-4 py-3"
                                >
                                  <StructuredValue value={target} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {idempotencyKeys ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Idempotency Keys
                            </p>
                            <div className="mt-2 rounded-2xl border border-white bg-white px-4 py-3">
                              <StructuredValue value={idempotencyKeys} />
                            </div>
                          </div>
                        ) : null}
                        {supplementalMetadata && Object.keys(supplementalMetadata).length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Supplemental Metadata
                            </p>
                            <div className="mt-2">
                              <MetadataList metadata={supplementalMetadata} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </InfoCard>

                <InfoCard title="Related Audit Evidence">
                  {relatedAuditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {relatedAuditLogs.map((log, index) => {
                        const auditRecord = log as Record<string, unknown>;

                        return (
                          <article
                            key={`${selectedEvent.eventId}-audit-${index}`}
                            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              {typeof auditRecord.sourceSystem === "string" ? (
                                <SystemBadge system={auditRecord.sourceSystem as never} />
                              ) : null}
                              {typeof auditRecord.targetSystem === "string" ? (
                                <SystemBadge system={auditRecord.targetSystem as never} />
                              ) : null}
                              {typeof auditRecord.status === "string" ? (
                                <StatusBadge variant="neutral">
                                  {formatStatusText(auditRecord.status)}
                                </StatusBadge>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-medium text-slate-950">{summarizeValue(auditRecord.message)}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {formatStatusText(String(auditRecord.stage ?? "stage"))} at{" "}
                              {formatDateTime(
                                typeof auditRecord.createdAt === "string"
                                  ? auditRecord.createdAt
                                  : typeof auditRecord.recordedAt === "string"
                                    ? auditRecord.recordedAt
                                    : undefined,
                              )}
                            </p>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No related audit entries were returned for this event.</p>
                  )}
                </InfoCard>
              </>
            ) : (
              !eventDetailQuery.isLoading && (
                <EmptyState
                  description="Select an event to inspect the canonical payload and related audit logs."
                  title="No event selected"
                />
              )
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
