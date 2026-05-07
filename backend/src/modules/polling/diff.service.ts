import {
  CanonicalPayload,
  CanonicalPayloadField,
  RegisteredAddress,
} from "../../common/types/event.types";
import { ServiceType } from "../../common/types/system.types";
import { CanonicalFieldPath } from "../conflicts/canonical-field-paths";

export type PollableSystemName = "EKARMIKA" | "ESURAKSHATE";

export interface SnapshotDiffEntry {
  canonicalFieldPath: CanonicalFieldPath;
  changedField: CanonicalPayloadField;
  newValue: unknown;
  oldValue: unknown;
  payloadFragment: Partial<CanonicalPayload>;
  serviceType?: ServiceType;
  sourceField: string;
}

type DiffMapping = {
  canonicalFieldPath: CanonicalFieldPath;
  changedField: CanonicalPayloadField;
  payloadBuilder: (value: unknown) => Partial<CanonicalPayload>;
  serviceType?: ServiceType;
  sourceField: string;
};

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function areValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(sortValue(left)) === JSON.stringify(sortValue(right));
}

function parseFlatAddress(value: unknown): RegisteredAddress | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return undefined;
  }

  const postalCandidate = parts.length >= 1 ? parts[parts.length - 1] : undefined;
  const stateCandidate = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  const cityCandidate = parts.length >= 3 ? parts[parts.length - 3] : undefined;
  const lineParts = parts.slice(
    0,
    Math.max(parts.length - (postalCandidate && /^\d{6}$/.test(postalCandidate) ? 3 : 1), 1),
  );

  return {
    city: cityCandidate ?? "",
    line1: lineParts.join(", ") || parts[0],
    postalCode:
      postalCandidate && /^\d{6}$/.test(postalCandidate)
        ? postalCandidate
        : "",
    state: stateCandidate ?? "",
  };
}

const EKARMIKA_DIFF_MAPPINGS: DiffMapping[] = [
  {
    canonicalFieldPath: "registeredAddress",
    changedField: "registeredAddress",
    payloadBuilder: (value) => ({
      registeredAddress: parseFlatAddress(value),
    }),
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceField: "addressFull",
  },
  {
    canonicalFieldPath: "authorizedSignatory.name",
    changedField: "authorizedSignatory",
    payloadBuilder: (value) => ({
      authorizedSignatory:
        typeof value === "string" && value.trim().length > 0
          ? { name: value }
          : undefined,
    }),
    serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
    sourceField: "employerName",
  },
  {
    canonicalFieldPath: "employeeCount",
    changedField: "employeeCount",
    payloadBuilder: (value) => ({
      employeeCount: typeof value === "number" ? value : undefined,
    }),
    serviceType: "EMPLOYEE_COUNT_CHANGE",
    sourceField: "employeeCount",
  },
];

const ESURAKSHATE_DIFF_MAPPINGS: DiffMapping[] = [
  {
    canonicalFieldPath: "registeredAddress",
    changedField: "registeredAddress",
    payloadBuilder: (value) => ({
      registeredAddress: parseFlatAddress(value),
    }),
    serviceType: "REGISTERED_ADDRESS_CHANGE",
    sourceField: "factoryAddress",
  },
  {
    canonicalFieldPath: "authorizedSignatory.name",
    changedField: "authorizedSignatory",
    payloadBuilder: (value) => ({
      authorizedSignatory:
        typeof value === "string" && value.trim().length > 0
          ? { name: value }
          : undefined,
    }),
    serviceType: "AUTHORIZED_SIGNATORY_CHANGE",
    sourceField: "managerName",
  },
  {
    canonicalFieldPath: "workerLimit",
    changedField: "workerLimit",
    payloadBuilder: (value) => ({
      workerLimit: typeof value === "number" ? value : undefined,
    }),
    sourceField: "workerLimit",
  },
  {
    canonicalFieldPath: "powerCapacityHP",
    changedField: "powerCapacityHP",
    payloadBuilder: (value) => ({
      powerCapacityHP: typeof value === "number" ? value : undefined,
    }),
    serviceType: "POWER_CAPACITY_CHANGE",
    sourceField: "powerCapacityHP",
  },
  {
    canonicalFieldPath: "licenseExpiry",
    changedField: "licenseExpiry",
    payloadBuilder: (value) => ({
      licenseExpiry: typeof value === "string" ? value : undefined,
    }),
    serviceType: "LICENSE_EXPIRY_CHANGE",
    sourceField: "licenseExpiry",
  },
];

function getDiffMappings(systemName: PollableSystemName) {
  return systemName === "EKARMIKA"
    ? EKARMIKA_DIFF_MAPPINGS
    : ESURAKSHATE_DIFF_MAPPINGS;
}

export function diffObjects(
  oldSnapshot: Record<string, unknown>,
  newSnapshot: Record<string, unknown>,
  systemName: PollableSystemName,
): SnapshotDiffEntry[] {
  const entries: SnapshotDiffEntry[] = [];

  for (const mapping of getDiffMappings(systemName)) {
    const oldValue = oldSnapshot[mapping.sourceField];
    const newValue = newSnapshot[mapping.sourceField];

    if (areValuesEqual(oldValue, newValue)) {
      continue;
    }

    entries.push({
      canonicalFieldPath: mapping.canonicalFieldPath,
      changedField: mapping.changedField,
      newValue,
      oldValue,
      payloadFragment: mapping.payloadBuilder(newValue),
      serviceType: mapping.serviceType,
      sourceField: mapping.sourceField,
    });
  }

  return entries;
}
