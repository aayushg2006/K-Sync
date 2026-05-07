import { MappingStatus, Prisma } from "@prisma/client";

import { AppError } from "../../common/errors/AppError";
import { ERROR_CODES } from "../../common/errors/errorCodes";
import { SystemName } from "../../common/types/system.types";
import prisma from "../../config/prisma";
import { CanonicalFieldPath } from "./canonical-field-paths";

export interface AuthorityRuleRecord {
  authoritativeSystem: SystemName;
  fallbackSystem?: SystemName;
  fieldPath: CanonicalFieldPath;
  manualReviewRequired: boolean;
  notes?: string;
  ruleConfig?: Record<string, unknown>;
  version: number;
}

type AuthorityMatrixRow = {
  authoritativeSystem: SystemName;
  fallbackSystem: SystemName | null;
  fieldPath: string;
  manualReviewRequired: boolean;
  notes: string | null;
  ruleConfig: Prisma.JsonValue | null;
  version: number;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseRuleConfig(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return clone(value as Record<string, unknown>);
}

function toAuthorityRule(record: AuthorityMatrixRow): AuthorityRuleRecord {
  return {
    authoritativeSystem: record.authoritativeSystem,
    fallbackSystem: record.fallbackSystem ?? undefined,
    fieldPath: record.fieldPath as CanonicalFieldPath,
    manualReviewRequired: record.manualReviewRequired,
    notes: record.notes ?? undefined,
    ruleConfig: parseRuleConfig(record.ruleConfig),
    version: record.version,
  };
}

export async function getAuthorityRule(
  fieldPath: CanonicalFieldPath,
): Promise<AuthorityRuleRecord> {
  const rule = await prisma.authorityMatrix.findFirst({
    where: {
      fieldPath,
      status: MappingStatus.ACTIVE,
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
    select: {
      authoritativeSystem: true,
      fallbackSystem: true,
      fieldPath: true,
      manualReviewRequired: true,
      notes: true,
      ruleConfig: true,
      version: true,
    },
  });

  if (!rule) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      details: {
        fieldPath,
        status: MappingStatus.ACTIVE,
      },
      message: `No active Authority Matrix rule exists for ${fieldPath}.`,
      statusCode: 404,
    });
  }

  return toAuthorityRule(rule);
}

export async function getAuthoritativeSystem(fieldPath: CanonicalFieldPath) {
  return (await getAuthorityRule(fieldPath)).authoritativeSystem;
}

export async function requiresManualReview(fieldPath: CanonicalFieldPath) {
  return (await getAuthorityRule(fieldPath)).manualReviewRequired;
}

