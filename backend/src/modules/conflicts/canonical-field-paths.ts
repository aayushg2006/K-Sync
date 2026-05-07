import { CanonicalEvent } from "../../common/types/event.types";

export const CANONICAL_FIELD_PATHS = [
  "businessName",
  "registeredAddress",
  "authorizedSignatory.name",
  "employeeCount",
  "workerLimit",
  "powerCapacityHP",
  "licenseExpiry",
] as const;

export type CanonicalFieldPath = (typeof CANONICAL_FIELD_PATHS)[number];

const changedFieldToCanonicalPath = {
  authorizedSignatory: "authorizedSignatory.name",
  businessName: "businessName",
  employeeCount: "employeeCount",
  licenseExpiry: "licenseExpiry",
  powerCapacityHP: "powerCapacityHP",
  registeredAddress: "registeredAddress",
  workerLimit: "workerLimit",
} as const satisfies Record<
  CanonicalEvent["changedFields"][number],
  CanonicalFieldPath
>;

export function getCanonicalFieldPathsForEvent(
  event: Pick<CanonicalEvent, "changedFields">,
): CanonicalFieldPath[] {
  return Array.from(
    new Set(event.changedFields.map((field) => changedFieldToCanonicalPath[field])),
  );
}

