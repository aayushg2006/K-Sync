import type { AuthorizedSignatory, RegisteredAddress, SystemName } from "./event.types";

export type BusinessFieldName =
  | "businessName"
  | "registeredAddress"
  | "authorizedSignatory"
  | "employeeCount"
  | "workerLimit"
  | "powerCapacityHP"
  | "licenseExpiry";

interface BusinessRecordBase {
  ubid: string;
  businessName: string;
  sourceSystem: SystemName;
  registeredAddress?: RegisteredAddress;
  authorizedSignatory?: AuthorizedSignatory;
  employeeCount?: number;
  workerLimit?: number;
  powerCapacityHP?: number;
  licenseExpiry?: string;
  lastUpdatedAt?: string;
}

export interface SwsBusinessRecord extends BusinessRecordBase {
  sourceSystem: "SWS";
  sourceRequestId?: string;
}

export interface EkarmikaRecord extends BusinessRecordBase {
  sourceSystem: "EKARMIKA";
  labourRegistrationNumber?: string;
}

export interface EsurakshateRecord extends BusinessRecordBase {
  sourceSystem: "ESURAKSHATE";
  factoryLicenseNumber?: string;
}

export interface BusinessComparison {
  ubid: string;
  businessName: string;
  sws?: SwsBusinessRecord;
  ekarmika?: EkarmikaRecord;
  esurakshate?: EsurakshateRecord;
  registryMappings: Array<{
    businessName?: string;
    isActive: boolean;
    localIdentifier: string;
    localIdentifierType: string;
    metadata?: Record<string, unknown>;
    systemName: SystemName;
    ubid: string;
  }>;
  missingSystems: string[];
  differingFields: BusinessFieldName[];
  lastComparedAt?: string;
}
