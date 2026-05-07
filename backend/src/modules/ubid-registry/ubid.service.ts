import { Prisma } from "@prisma/client";

import { ServiceType, SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";
import { getRoutingRuleTargets } from "../routing/routing.rules";

export type TargetResolutionStatus =
  | "ROUTABLE"
  | "TARGET_NOT_APPLICABLE"
  | "REGISTRATION_REQUIRED"
  | "TARGET_MAPPING_MISSING";

export interface UbidMappingRecord {
  businessName?: string;
  isActive: boolean;
  localIdentifier: string;
  localIdentifierType: string;
  metadata?: Record<string, unknown>;
  systemName: SystemName;
  ubid: string;
}

export interface ResolvedTarget {
  businessName?: string;
  localIdentifier?: string;
  localIdentifierType?: string;
  sourceSystem: SystemName;
  status: TargetResolutionStatus;
  targetSystem: SystemName;
  ubid: string;
}

type UbidRegistryRow = {
  businessName: string | null;
  isActive: boolean;
  localIdentifier: string;
  localIdentifierType: string;
  metadata: Prisma.JsonValue | null;
  systemName: SystemName;
  ubid: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as Record<string, unknown>);
}

function toMappingRecord(record: UbidRegistryRow): UbidMappingRecord {
  return {
    businessName: record.businessName ?? undefined,
    isActive: record.isActive,
    localIdentifier: record.localIdentifier,
    localIdentifierType: record.localIdentifierType,
    metadata: parseMetadata(record.metadata),
    systemName: record.systemName,
    ubid: record.ubid,
  };
}

export async function getMappingsByUbid(ubid: string): Promise<UbidMappingRecord[]> {
  const mappings = await prisma.ubidRegistry.findMany({
    where: { ubid },
    orderBy: [{ systemName: "asc" }, { localIdentifierType: "asc" }],
    select: {
      businessName: true,
      isActive: true,
      localIdentifier: true,
      localIdentifierType: true,
      metadata: true,
      systemName: true,
      ubid: true,
    },
  });

  return mappings.map((mapping) => toMappingRecord(mapping));
}

export async function getLocalIdentifier(
  ubid: string,
  systemName: SystemName,
): Promise<string | null> {
  const mapping = await prisma.ubidRegistry.findFirst({
    where: {
      ubid,
      systemName,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      localIdentifier: true,
    },
  });

  return mapping?.localIdentifier ?? null;
}

export async function resolveTargets(
  ubid: string,
  sourceSystem: SystemName,
  serviceType: ServiceType,
): Promise<ResolvedTarget[]> {
  const targetSystems = getRoutingRuleTargets(sourceSystem, serviceType).filter(
    (targetSystem) => targetSystem !== sourceSystem,
  );

  if (targetSystems.length === 0) {
    return [];
  }

  const mappings = await getMappingsByUbid(ubid);

  return targetSystems.map((targetSystem) => {
    const mapping = mappings.find(
      (candidate) =>
        candidate.systemName === targetSystem && candidate.isActive,
    );

    if (!mapping) {
      return {
        sourceSystem,
        status: "REGISTRATION_REQUIRED",
        targetSystem,
        ubid,
      };
    }

    if (!mapping.localIdentifier) {
      return {
        businessName: mapping.businessName,
        localIdentifierType: mapping.localIdentifierType,
        sourceSystem,
        status: "TARGET_MAPPING_MISSING",
        targetSystem,
        ubid,
      };
    }

    return {
      businessName: mapping.businessName,
      localIdentifier: mapping.localIdentifier,
      localIdentifierType: mapping.localIdentifierType,
      sourceSystem,
      status: "ROUTABLE",
      targetSystem,
      ubid,
    };
  });
}
