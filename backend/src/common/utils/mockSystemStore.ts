import { nanoid } from "nanoid";

import { AuthorizedSignatory, CanonicalPayloadField, RegisteredAddress } from "../types/event.types";
import { OperationType, ServiceType } from "../types/system.types";

export interface MockSwsBusiness {
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
  lastModified: string;
}

export interface MockEkarmikaEstablishment {
  labourRegNo: string;
  ubid: string;
  businessName: string;
  addressFull?: string;
  managerName?: string;
  employeeCount?: number;
  workerLimit?: number;
  powerCapacityHP?: number;
  lastModified: string;
}

export interface MockEsurakshateFactory {
  factoryLicenseNo: string;
  ubid: string;
  businessName: string;
  factoryAddress?: string;
  managerName?: string;
  employeeCount?: number;
  workerLimit?: number;
  powerCapacityHP?: number;
  lastModified: string;
}

export interface MockServiceRequestRecord {
  requestId: string;
  correlationId: string;
  ubid: string;
  serviceType: ServiceType;
  operation: OperationType;
  changedFields: CanonicalPayloadField[];
  lastModified: string;
  sourceRequestId: string;
}

export interface MockDepartmentChangeRecord {
  changeId: string;
  ubid: string;
  labourRegNo?: string;
  factoryLicenseNo?: string;
  operation?: OperationType;
  serviceType?: ServiceType;
  changeSource: "AMENDMENT" | "MANUAL_UPDATE";
  changedFields: string[];
  updatedBy?: string;
  remarks?: string;
  lastModified: string;
}

export interface MockSystemStore {
  swsBusinesses: Record<string, MockSwsBusiness>;
  ekarmikaEstablishments: Record<string, MockEkarmikaEstablishment>;
  esurakshateFactories: Record<string, MockEsurakshateFactory>;
  swsServiceRequests: MockServiceRequestRecord[];
  ekarmikaChanges: MockDepartmentChangeRecord[];
  esurakshateChanges: MockDepartmentChangeRecord[];
}

function createSeedStore(): MockSystemStore {
  return {
    swsBusinesses: {
      "UBID-KA-2026-0001": {
        ubid: "UBID-KA-2026-0001",
        businessName: "Acme Industries Pvt Ltd",
        labourRegNo: "LAB-KA-2026-0001",
        factoryLicenseNo: "FAC-KA-2026-0001",
        sourceRequestId: "SWS-REQ-0001",
        registeredAddress: {
          line1: "42 Residency Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560025",
        },
        authorizedSignatory: {
          name: "Asha Rao",
        },
        employeeCount: 120,
        workerLimit: 160,
        powerCapacityHP: 45,
        lastModified: "2026-05-01T09:00:00.000Z",
      },
      "UBID-KA-2026-0002": {
        ubid: "UBID-KA-2026-0002",
        businessName: "Bharat Textiles LLP",
        labourRegNo: "LAB-KA-2026-0002",
        sourceRequestId: "SWS-REQ-0002",
        registeredAddress: {
          line1: "18 Mysore Road",
          city: "Mysuru",
          state: "Karnataka",
          postalCode: "570001",
        },
        authorizedSignatory: {
          name: "Meera Nair",
        },
        employeeCount: 84,
        workerLimit: 100,
        powerCapacityHP: 30,
        lastModified: "2026-05-01T09:15:00.000Z",
      },
      "UBID-KA-2026-0003": {
        ubid: "UBID-KA-2026-0003",
        businessName: "Cauvery Fabrication Works",
        factoryLicenseNo: "FAC-KA-2026-0003",
        sourceRequestId: "SWS-REQ-0003",
        registeredAddress: {
          line1: "5 Industrial Estate",
          city: "Hubballi",
          state: "Karnataka",
          postalCode: "580029",
        },
        authorizedSignatory: {
          name: "Ravi Kumar",
        },
        employeeCount: 67,
        workerLimit: 90,
        powerCapacityHP: 55,
        lastModified: "2026-05-01T09:30:00.000Z",
      },
    },
    ekarmikaEstablishments: {
      "LAB-KA-2026-0001": {
        labourRegNo: "LAB-KA-2026-0001",
        ubid: "UBID-KA-2026-0001",
        businessName: "Acme Industries Pvt Ltd",
        addressFull: "42 Residency Road, Bengaluru, Karnataka 560025",
        managerName: "Asha Rao",
        employeeCount: 120,
        workerLimit: 160,
        powerCapacityHP: 45,
        lastModified: "2026-05-01T09:05:00.000Z",
      },
      "LAB-KA-2026-0002": {
        labourRegNo: "LAB-KA-2026-0002",
        ubid: "UBID-KA-2026-0002",
        businessName: "Bharat Textiles LLP",
        addressFull: "18 Mysore Road, Mysuru, Karnataka 570001",
        managerName: "Meera Nair",
        employeeCount: 84,
        workerLimit: 100,
        powerCapacityHP: 30,
        lastModified: "2026-05-01T09:20:00.000Z",
      },
    },
    esurakshateFactories: {
      "FAC-KA-2026-0001": {
        factoryLicenseNo: "FAC-KA-2026-0001",
        ubid: "UBID-KA-2026-0001",
        businessName: "Acme Industries Pvt Ltd",
        factoryAddress: "42 Residency Road, Bengaluru, Karnataka 560025",
        managerName: "Asha Rao",
        employeeCount: 120,
        workerLimit: 160,
        powerCapacityHP: 45,
        lastModified: "2026-05-01T09:10:00.000Z",
      },
      "FAC-KA-2026-0003": {
        factoryLicenseNo: "FAC-KA-2026-0003",
        ubid: "UBID-KA-2026-0003",
        businessName: "Cauvery Fabrication Works",
        factoryAddress: "5 Industrial Estate, Hubballi, Karnataka 580029",
        managerName: "Ravi Kumar",
        employeeCount: 67,
        workerLimit: 90,
        powerCapacityHP: 55,
        lastModified: "2026-05-01T09:35:00.000Z",
      },
    },
    swsServiceRequests: [],
    ekarmikaChanges: [],
    esurakshateChanges: [],
  };
}

export const mockSystemStore = createSeedStore();

export function createChangeId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}
