import { useQuery } from "@tanstack/react-query";
import { CircleAlert, GitCompareArrows } from "lucide-react";
import { useState } from "react";

import { BadgeList } from "@/components/common/BadgeList";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { InfoCard } from "@/components/common/InfoCard";
import { KeyValueGrid } from "@/components/common/KeyValueGrid";
import { LoadingState } from "@/components/common/LoadingState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SystemBadge } from "@/components/common/SystemBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatAddress, formatCount, formatDate, formatDateTime } from "@/lib/formatters";
import { getBusinessComparison } from "@/services/business.service";
import type {
  BusinessComparison,
  EkarmikaRecord,
  EsurakshateRecord,
  SwsBusinessRecord,
} from "@/types/business.types";

const selectableUbids = ["UBID-KA-2026-0001", "UBID-KA-2026-0002", "UBID-KA-2026-0003"] as const;

type BusinessPanelProps = {
  emptyMessage: string;
  record?: SwsBusinessRecord | EkarmikaRecord | EsurakshateRecord;
  subtitle?: string;
  title: "SWS" | "EKARMIKA" | "ESURAKSHATE";
};

function BusinessColumn({ emptyMessage, record, subtitle, title }: BusinessPanelProps) {
  if (!record) {
    return (
      <InfoCard className="border-dashed" title={title}>
        <div className="flex items-center justify-between gap-3">
          <SystemBadge system={title} />
          <StatusBadge variant="neutral">Missing</StatusBadge>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{emptyMessage}</p>
      </InfoCard>
    );
  }

  return (
    <InfoCard title={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SystemBadge system={title} />
        <StatusBadge variant="active">Available</StatusBadge>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{record.businessName}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <KeyValueGrid
        className="mt-5"
        columns={1}
        items={[
          { label: "Authorized Signatory", value: record.authorizedSignatory?.name ?? "Not available" },
          { label: "Registered Address", value: formatAddress(record.registeredAddress) },
          { label: "Employee Count", value: formatCount(record.employeeCount) },
          { label: "Worker Limit", value: formatCount(record.workerLimit) },
          { label: "Power Capacity", value: formatCount(record.powerCapacityHP, "HP") },
          { label: "License Expiry", value: formatDate(record.licenseExpiry) },
          { label: "Last Modified", value: formatDateTime(record.lastUpdatedAt) },
        ]}
      />
    </InfoCard>
  );
}

export function BusinessSyncPage() {
  const [selectedUbid, setSelectedUbid] = useState<string>(selectableUbids[0]);

  const comparisonQuery = useQuery({
    queryFn: () => getBusinessComparison(selectedUbid),
    queryKey: ["business-comparison", selectedUbid],
  });

  const comparison: BusinessComparison | undefined = comparisonQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Compare business records across SWS, e-Karmika, and e-Surakshate to verify what propagated cleanly and where the systems still diverge."
        title="Business Sync"
        trailing={<StatusBadge variant="active">Comparison View</StatusBadge>}
      />

      <InfoCard description="Choose a business identity and compare the latest state visible in each connected system." title="UBID Selector">
        <label className="block text-sm font-medium text-slate-700" htmlFor="ubid-selector">
          Select UBID
        </label>
        <select
          className="mt-3 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white"
          id="ubid-selector"
          onChange={(event) => setSelectedUbid(event.target.value)}
          value={selectedUbid}
        >
          {selectableUbids.map((ubid) => (
            <option key={ubid} value={ubid}>
              {ubid}
            </option>
          ))}
        </select>
      </InfoCard>

      {comparisonQuery.isLoading ? <LoadingState label="Loading business comparison..." /> : null}

      {comparisonQuery.isError ? (
        <ErrorState
          description="The business comparison request could not be completed. Check that the dashboard backend APIs are running."
          title="Business comparison is unavailable"
        />
      ) : null}

      {comparison ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <InfoCard title="Sync Summary">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant={comparison.differingFields.length > 0 ? "pending" : "active"}>
                  {comparison.differingFields.length > 0 ? "Differences Found" : "In Sync"}
                </StatusBadge>
                {comparison.missingSystems.map((system) => (
                  <StatusBadge key={system} variant="neutral">
                    {system} missing
                  </StatusBadge>
                ))}
              </div>
              <KeyValueGrid
                className="mt-5"
                columns={2}
                items={[
                  { label: "UBID", value: comparison.ubid },
                  { label: "Business Name", value: comparison.businessName },
                  { label: "Systems Present", value: 3 - comparison.missingSystems.length },
                  { label: "Last Compared", value: formatDateTime(comparison.lastComparedAt) },
                ]}
              />
            </InfoCard>

            <InfoCard title="Sync Gaps">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <GitCompareArrows className="h-4 w-4 text-sky-700" />
                    Differing Fields
                  </div>
                  <div className="mt-3">
                    <BadgeList values={comparison.differingFields} />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CircleAlert className="h-4 w-4 text-sky-700" />
                    Missing Systems
                  </div>
                  <div className="mt-3">
                    {comparison.missingSystems.length > 0 ? (
                      <BadgeList values={comparison.missingSystems} />
                    ) : (
                      <p className="text-sm text-slate-500">All three systems returned a record for this UBID.</p>
                    )}
                  </div>
                </div>
              </div>
            </InfoCard>
          </div>

          <div className="grid gap-4 2xl:grid-cols-3">
            <BusinessColumn
              emptyMessage="No SWS record for this UBID."
              record={comparison.sws}
              subtitle={comparison.sws?.sourceRequestId ? `Request ${comparison.sws.sourceRequestId}` : undefined}
              title="SWS"
            />
            <BusinessColumn
              emptyMessage="No e-Karmika record for this UBID."
              record={comparison.ekarmika}
              subtitle={comparison.ekarmika?.labourRegistrationNumber}
              title="EKARMIKA"
            />
            <BusinessColumn
              emptyMessage="No e-Surakshate record for this UBID."
              record={comparison.esurakshate}
              subtitle={comparison.esurakshate?.factoryLicenseNumber}
              title="ESURAKSHATE"
            />
          </div>

          <InfoCard title="UBID Registry Mappings">
            {comparison.registryMappings.length === 0 ? (
              <EmptyState description="No registry mappings were returned for this UBID." title="No mappings found" />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {comparison.registryMappings.map((mapping) => (
                  <article key={`${mapping.systemName}-${mapping.localIdentifierType}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <SystemBadge system={mapping.systemName} />
                      <StatusBadge variant={mapping.isActive ? "active" : "neutral"}>
                        {mapping.isActive ? "Active" : "Inactive"}
                      </StatusBadge>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-medium text-slate-950">Identifier type:</span> {mapping.localIdentifierType}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">Identifier:</span> {mapping.localIdentifier}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950">UBID:</span> {mapping.ubid}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </InfoCard>
        </>
      ) : (
        !comparisonQuery.isLoading &&
        !comparisonQuery.isError && (
          <EmptyState
            description="Select a UBID to inspect business state across all systems."
            title="No business comparison loaded"
          />
        )
      )}
    </div>
  );
}
