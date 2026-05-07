import type { RegisteredAddress } from "@/types/event.types";

const FIELD_LABELS: Record<string, string> = {
  authorizedSignatory: "Authorized Signatory",
  businessName: "Business Name",
  changedFields: "Changed Fields",
  completedAt: "Completed At",
  correlationId: "Correlation ID",
  createdAt: "Created At",
  employeeCount: "Employee Count",
  eventId: "Event ID",
  factoryLicenseNo: "Factory License No",
  idempotencyKeys: "Idempotency Keys",
  labourRegNo: "Labour Registration No",
  licenseExpiry: "License Expiry",
  localIdentifier: "Local Identifier",
  localIdentifierType: "Identifier Type",
  mappingId: "Mapping ID",
  normalizedPayloadHash: "Normalized Payload Hash",
  payloadAfter: "Payload After",
  payloadBefore: "Payload Before",
  powerCapacityHP: "Power Capacity",
  postalCode: "Postal Code",
  queueJobStatusCounts: "Queue Job Status Counts",
  recordedAt: "Recorded At",
  registeredAddress: "Registered Address",
  resolutionStatus: "Resolution Status",
  reviewStatus: "Review Status",
  routeTargets: "Route Targets",
  routingResolutions: "Routing Resolutions",
  serviceType: "Service Type",
  sourceRequestId: "Source Request ID",
  sourceSystem: "Source System",
  status: "Status",
  targetSystem: "Target System",
  ubid: "UBID",
  updatedAt: "Updated At",
  updatedFields: "Updated Fields",
  version: "Version",
  workerLimit: "Worker Limit",
};

function capitalizeWords(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatLabel(value: string) {
  if (FIELD_LABELS[value]) {
    return FIELD_LABELS[value];
  }

  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim();

  return capitalizeWords(normalized);
}

export function formatStatusText(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return capitalizeWords(value.toLowerCase().replaceAll("_", " "));
}

export function formatScenarioName(value?: string | null) {
  return formatStatusText(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export function formatAddress(address?: RegisteredAddress) {
  if (!address) {
    return "Not available";
  }

  return [
    address.line1,
    address.line2,
    address.city,
    address.district,
    address.state,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatCount(value?: number | null, suffix?: string) {
  if (value === undefined || value === null) {
    return "Not available";
  }

  return suffix ? `${value} ${suffix}` : value.toLocaleString();
}

export function summarizeValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "Not available";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "None";
    }

    return value
      .map((entry) => summarizeValue(entry))
      .join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function toMetadataEntries(record?: Record<string, unknown>) {
  if (!record) {
    return [];
  }

  return Object.entries(record).map(([key, value]) => ({
    label: formatLabel(key),
    value: summarizeValue(value),
  }));
}
