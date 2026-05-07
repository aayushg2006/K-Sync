import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Copy,
  Database,
  GitBranch,
  Inbox,
  ListChecks,
  ServerCog,
} from "lucide-react";

import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { MetricCard } from "@/components/common/MetricCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getDashboardMetrics,
  getQueueStatus,
  getSystemHealth,
} from "@/services/dashboard.service";

function toStatusVariant(status: string) {
  if (status === "online" || status === "active") {
    return "active";
  }

  if (status === "degraded") {
    return "pending";
  }

  return "neutral";
}

export function DashboardPage() {
  const metricsQuery = useQuery({
    queryFn: getDashboardMetrics,
    queryKey: ["dashboard-metrics"],
  });

  const healthQuery = useQuery({
    queryFn: getSystemHealth,
    queryKey: ["system-health"],
  });

  const queueQuery = useQuery({
    queryFn: getQueueStatus,
    queryKey: ["queue-status"],
  });

  const metrics = metricsQuery.data;
  const health = healthQuery.data;
  const queueStatus = queueQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Monitor canonical event throughput, downstream delivery, infrastructure health, and review queues from one operational dashboard."
        title="Dashboard"
        trailing={<StatusBadge variant="active">Live Data</StatusBadge>}
      />

      {metricsQuery.isError || healthQuery.isError || queueQuery.isError ? (
        <ErrorState
          description="Some dashboard data could not be loaded. Check backend availability, Redis connectivity, and queue workers, then refresh the page."
          title="Dashboard data is partially unavailable"
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Operational Metrics</h2>
          <p className="max-w-2xl text-sm text-slate-500">Counts are sourced from Prisma-backed events, audits, conflicts, and queue records.</p>
        </div>

        {metricsQuery.isLoading || !metrics ? (
          <LoadingState label="Loading dashboard metrics..." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard description="Canonical events recorded by K-Sync." icon={<Activity className="h-5 w-5" />} title="Total Events" value={metrics.totalEvents} />
            <MetricCard description="Events that completed sync or confirmed propagated delivery." icon={<GitBranch className="h-5 w-5" />} title="Successful Syncs" value={metrics.successfulSyncs} />
            <MetricCard description="Write attempts that failed during downstream delivery." icon={<AlertTriangle className="h-5 w-5" />} title="Failed Writes" value={metrics.failedWrites} />
            <MetricCard description="Conflict records detected by the Authority Matrix flow." icon={<ServerCog className="h-5 w-5" />} title="Conflicts" value={metrics.conflictsDetected} />
            <MetricCard description="Requests blocked by idempotency protections." icon={<Copy className="h-5 w-5" />} title="Duplicates Blocked" value={metrics.duplicateRequestsBlocked} />
            <MetricCard description="Open or in-review manual review items awaiting action." icon={<ListChecks className="h-5 w-5" />} title="Manual Reviews" value={metrics.pendingManualReviews} />
            <MetricCard description="Dead-letter records that require follow-up." icon={<Inbox className="h-5 w-5" />} title="DLQ Jobs" value={metrics.dlqJobs} />
            <MetricCard description="Queue job records tracked in the database." icon={<Database className="h-5 w-5" />} title="Queue Jobs" value={metrics.queueJobs} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">System Health</h2>
          <p className="max-w-2xl text-sm text-slate-500">Readiness across mock systems, database, Redis, and queue processing.</p>
        </div>

        {healthQuery.isLoading || !health ? (
          <LoadingState label="Checking system health..." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              { key: "mockSws", label: "Mock SWS", value: health.mockSws },
              { key: "mockEkarmika", label: "Mock e-Karmika", value: health.mockEkarmika },
              { key: "mockEsurakshate", label: "Mock e-Surakshate", value: health.mockEsurakshate },
              { key: "database", label: "Database", value: health.database },
              { key: "redis", label: "Redis", value: health.redis },
              { key: "queue", label: "Queue", value: health.queue },
            ].map((item) => (
              <article key={item.key} className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{item.label}</h3>
                  <StatusBadge variant={toStatusVariant(item.value.status)}>{item.value.status}</StatusBadge>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{item.value.message ?? "Service responded successfully."}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">Queue Visibility</h2>
          <p className="max-w-2xl text-sm text-slate-500">BullMQ runtime counts plus database-backed queue job status totals.</p>
        </div>

        {queueQuery.isLoading || !queueStatus ? (
          <LoadingState label="Loading queue status..." />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge variant={toStatusVariant(queueStatus.redis.status)}>Redis {queueStatus.redis.status}</StatusBadge>
                <StatusBadge variant={toStatusVariant(queueStatus.queue.status)}>Queue {queueStatus.queue.status}</StatusBadge>
                <StatusBadge variant="neutral">DLQ {queueStatus.deadLetterJobCount}</StatusBadge>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {Object.entries(queueStatus.bullmq ?? {}).map(([queueName, stats]) => (
                  <div key={queueName} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900">{queueName}</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                      <div><dt>Waiting</dt><dd className="font-medium text-slate-950">{stats?.waiting ?? 0}</dd></div>
                      <div><dt>Active</dt><dd className="font-medium text-slate-950">{stats?.active ?? 0}</dd></div>
                      <div><dt>Completed</dt><dd className="font-medium text-slate-950">{stats?.completed ?? 0}</dd></div>
                      <div><dt>Failed</dt><dd className="font-medium text-slate-950">{stats?.failed ?? 0}</dd></div>
                      <div><dt>Delayed</dt><dd className="font-medium text-slate-950">{stats?.delayed ?? 0}</dd></div>
                      <div><dt>Paused</dt><dd className="font-medium text-slate-950">{stats?.paused ?? 0}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <h3 className="text-lg font-semibold text-slate-950">Queue Job Status Counts</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(queueStatus.queueJobStatusCounts).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-700">{status}</span>
                    <span className="text-sm font-semibold text-slate-950">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
