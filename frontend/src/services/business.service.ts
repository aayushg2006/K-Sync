import { api, unwrapApiResponse } from "@/lib/api";
import type {
  BusinessComparison,
  BusinessFieldName,
  EkarmikaRecord,
  EsurakshateRecord,
  SwsBusinessRecord,
} from "@/types/business.types";
import type { AuthorizedSignatory, RegisteredAddress } from "@/types/event.types";

type DashboardBusinessComparisonResponse = {
  ubid: string;
  sws: {
    ubid: string;
    businessName: string;
    labourRegNo?: string;
    factoryLicenseNo?: string;
    sourceRequestId?: string;
    registeredAddress?: RegisteredAddress;
    authorizedSignatory?: AuthorizedSignatory;
    employeeCount?: number;
    workerLimit?: number;
    powerCapacityHP?: number;
    licenseExpiry?: string;
    lastModifiedAt: string;
  } | null;
  ekarmika: {
    labourRegNo: string;
    ubid: string;
    businessName: string;
    addressFull?: string;
    managerName?: string;
    employeeCount?: number;
    workerLimit?: number;
    powerCapacityHP?: number;
    lastModifiedAt: string;
  } | null;
  esurakshate: {
    factoryLicenseNo: string;
    ubid: string;
    businessName: string;
    factoryAddress?: string;
    managerName?: string;
    employeeCount?: number;
    workerLimit?: number;
    powerCapacityHP?: number;
    lastModifiedAt: string;
  } | null;
  registryMappings: BusinessComparison["registryMappings"];
  missingSystems: string[];
};

type MockSwsBusinessListItem = {
  ubid: string;
  businessName: string;
};

const SUPPORTED_COMPARE_FIELDS: BusinessFieldName[] = [
  "businessName",
  "registeredAddress",
  "authorizedSignatory",
  "employeeCount",
  "workerLimit",
  "powerCapacityHP",
  "licenseExpiry",
];

function normalizeFlatAddress(address?: string): RegisteredAddress | undefined {
  if (!address) {
    return undefined;
  }

  return {
    city: "",
    line1: address,
    postalCode: "",
    state: "",
  };
}

function toSwsRecord(payload: NonNullable<DashboardBusinessComparisonResponse["sws"]>): SwsBusinessRecord {
  return {
    ubid: payload.ubid,
    businessName: payload.businessName,
    sourceSystem: "SWS",
    sourceRequestId: payload.sourceRequestId,
    registeredAddress: payload.registeredAddress,
    authorizedSignatory: payload.authorizedSignatory,
    employeeCount: payload.employeeCount,
    workerLimit: payload.workerLimit,
    powerCapacityHP: payload.powerCapacityHP,
    licenseExpiry: payload.licenseExpiry,
    lastUpdatedAt: payload.lastModifiedAt,
  };
}

function toEkarmikaRecord(payload: NonNullable<DashboardBusinessComparisonResponse["ekarmika"]>): EkarmikaRecord {
  return {
    ubid: payload.ubid,
    businessName: payload.businessName,
    sourceSystem: "EKARMIKA",
    labourRegistrationNumber: payload.labourRegNo,
    registeredAddress: normalizeFlatAddress(payload.addressFull),
    authorizedSignatory: payload.managerName
      ? {
          name: payload.managerName,
        }
      : undefined,
    employeeCount: payload.employeeCount,
    workerLimit: payload.workerLimit,
    powerCapacityHP: payload.powerCapacityHP,
    lastUpdatedAt: payload.lastModifiedAt,
  };
}

function toEsurakshateRecord(payload: NonNullable<DashboardBusinessComparisonResponse["esurakshate"]>): EsurakshateRecord {
  return {
    ubid: payload.ubid,
    businessName: payload.businessName,
    sourceSystem: "ESURAKSHATE",
    factoryLicenseNumber: payload.factoryLicenseNo,
    registeredAddress: normalizeFlatAddress(payload.factoryAddress),
    authorizedSignatory: payload.managerName
      ? {
          name: payload.managerName,
        }
      : undefined,
    employeeCount: payload.employeeCount,
    workerLimit: payload.workerLimit,
    powerCapacityHP: payload.powerCapacityHP,
    lastUpdatedAt: payload.lastModifiedAt,
  };
}

function fieldValue(record: BusinessComparison[keyof Pick<BusinessComparison, "sws" | "ekarmika" | "esurakshate">], field: BusinessFieldName) {
  if (!record) {
    return undefined;
  }

  return JSON.stringify(record[field] ?? null);
}

function calculateDifferingFields(comparison: Pick<BusinessComparison, "sws" | "ekarmika" | "esurakshate">): BusinessFieldName[] {
  return SUPPORTED_COMPARE_FIELDS.filter((field) => {
    const values = [comparison.sws, comparison.ekarmika, comparison.esurakshate]
      .map((record) => fieldValue(record, field))
      .filter((value) => value !== undefined);

    return new Set(values).size > 1;
  });
}

export async function getBusinessComparison(ubid: string): Promise<BusinessComparison> {
  const comparisonResponse = await unwrapApiResponse<DashboardBusinessComparisonResponse>(
    api.get(`/api/dashboard/business-comparison/${encodeURIComponent(ubid)}`),
  );

  const comparison: BusinessComparison = {
    ubid: comparisonResponse.ubid,
    businessName:
      comparisonResponse.sws?.businessName ??
      comparisonResponse.ekarmika?.businessName ??
      comparisonResponse.esurakshate?.businessName ??
      comparisonResponse.ubid,
    sws: comparisonResponse.sws ? toSwsRecord(comparisonResponse.sws) : undefined,
    ekarmika: comparisonResponse.ekarmika
      ? toEkarmikaRecord(comparisonResponse.ekarmika)
      : undefined,
    esurakshate: comparisonResponse.esurakshate
      ? toEsurakshateRecord(comparisonResponse.esurakshate)
      : undefined,
    registryMappings: comparisonResponse.registryMappings,
    missingSystems: comparisonResponse.missingSystems,
    differingFields: [],
    lastComparedAt: new Date().toISOString(),
  };

  comparison.differingFields = calculateDifferingFields(comparison);

  return comparison;
}

export async function getBusinesses(): Promise<BusinessComparison[]> {
  const businesses = await unwrapApiResponse<MockSwsBusinessListItem[]>(
    api.get("/api/mock/sws/businesses"),
  );

  return Promise.all(businesses.map((business) => getBusinessComparison(business.ubid)));
}
