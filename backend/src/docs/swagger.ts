import { Express } from "express";

import env from "../config/env";
import { API_DOCS_PATH, APP_NAME } from "../config/constants";

const swaggerUi = require("swagger-ui-express");

function createSuccessResponse(
  description: string,
  dataSchema: Record<string, unknown>,
  exampleData: unknown,
  message: string,
) {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          allOf: [
            { $ref: "#/components/schemas/ApiResponse" },
            {
              type: "object",
              properties: {
                data: dataSchema,
                message: { type: "string" },
                success: { type: "boolean", example: true },
              },
            },
          ],
        },
        example: {
          success: true,
          data: exampleData,
          message,
        },
      },
    },
  };
}

const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: APP_NAME,
    version: "0.1.0",
    description: "K-Sync API documentation for mock systems, interoperability flows, dashboard reads, audit, conflicts, polling, and deterministic demo scenarios.",
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development server",
    },
  ],
  tags: [
    { name: "Health", description: "Service health and runtime checks" },
    { name: "Mock SWS", description: "Mock Karnataka Single Window System APIs" },
    { name: "Mock e-Karmika", description: "Mock labour department APIs" },
    { name: "Mock e-Surakshate", description: "Mock factory safety department APIs" },
    { name: "K-Sync", description: "Canonical ingest and event APIs" },
    { name: "Scenarios", description: "Deterministic demo scenario runner APIs" },
    { name: "Audit", description: "Audit trail and traceability APIs" },
    { name: "Conflicts", description: "Conflict review and replay APIs" },
    { name: "Dashboard", description: "Dashboard read APIs for metrics, queue health, and cross-system views" },
  ],
  components: {
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: {},
          message: { type: "string", example: "Request completed successfully." },
          meta: {
            type: "object",
            additionalProperties: true,
          },
          error: {
            type: "object",
            nullable: true,
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
        },
        required: ["success"],
      },
      ErrorResponse: {
        type: "object",
        properties: {
          code: { type: "string", example: "NOT_FOUND" },
          message: { type: "string", example: "Requested resource was not found." },
          details: {},
        },
        required: ["code", "message"],
      },
      PaginationEnvelope: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {},
          },
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 42 },
        },
        required: ["items", "page", "limit", "total"],
      },
      SystemName: {
        type: "string",
        enum: ["SWS", "EKARMIKA", "ESURAKSHATE", "KSYNC"],
      },
      ServiceType: {
        type: "string",
        enum: [
          "REGISTERED_ADDRESS_CHANGE",
          "AUTHORIZED_SIGNATORY_CHANGE",
          "EMPLOYEE_COUNT_CHANGE",
          "LICENSE_EXPIRY_CHANGE",
          "POWER_CAPACITY_CHANGE",
        ],
      },
      EventStatus: {
        type: "string",
        enum: [
          "RECEIVED",
          "VALIDATED",
          "IDEMPOTENCY_ACCEPTED",
          "DUPLICATE_DETECTED",
          "NORMALIZED",
          "CONFLICT_CHECKED",
          "CONFLICT_DETECTED",
          "CONFLICT_RESOLVED",
          "ROUTED",
          "TRANSLATED",
          "QUEUED",
          "WRITE_ATTEMPTED",
          "WRITE_SUCCEEDED",
          "WRITE_FAILED",
          "RETRY_SCHEDULED",
          "DLQ_MOVED",
          "COMPLETED",
          "FAILED",
          "MANUAL_REVIEW_REQUIRED",
          "PROPAGATED_CHANGE_CONFIRMED",
          "TARGET_NOT_APPLICABLE",
          "REGISTRATION_REQUIRED",
          "TARGET_MAPPING_MISSING",
          "SUPERSEDED",
        ],
      },
      ConflictResolutionStatus: {
        type: "string",
        enum: [
          "AUTO_RESOLVED",
          "SUPERSEDED",
          "MANUAL_REVIEW_REQUIRED",
          "REPLAYED_AFTER_REVIEW",
          "REJECTED_AFTER_REVIEW",
          "PENDING",
        ],
      },
      RegisteredAddress: {
        type: "object",
        properties: {
          line1: { type: "string" },
          line2: { type: "string" },
          city: { type: "string" },
          district: { type: "string" },
          state: { type: "string" },
          postalCode: { type: "string" },
        },
        required: ["line1", "city", "state", "postalCode"],
      },
      AuthorizedSignatory: {
        type: "object",
        properties: {
          name: { type: "string" },
          designation: { type: "string" },
          email: { type: "string", format: "email" },
          mobile: { type: "string" },
        },
        required: ["name"],
      },
      CanonicalPayload: {
        type: "object",
        properties: {
          businessName: { type: "string" },
          registeredAddress: { $ref: "#/components/schemas/RegisteredAddress" },
          authorizedSignatory: { $ref: "#/components/schemas/AuthorizedSignatory" },
          employeeCount: { type: "integer" },
          workerLimit: { type: "integer" },
          powerCapacityHP: { type: "number" },
          licenseExpiry: { type: "string", format: "date" },
        },
      },
      MockSwsBusiness: {
        type: "object",
        properties: {
          ubid: { type: "string" },
          businessName: { type: "string" },
          labourRegNo: { type: "string" },
          factoryLicenseNo: { type: "string" },
          sourceRequestId: { type: "string" },
          registeredAddress: { $ref: "#/components/schemas/RegisteredAddress" },
          authorizedSignatory: { $ref: "#/components/schemas/AuthorizedSignatory" },
          employeeCount: { type: "integer" },
          workerLimit: { type: "integer" },
          powerCapacityHP: { type: "number" },
          licenseExpiry: { type: "string", format: "date" },
          lastModified: { type: "string", format: "date-time" },
        },
        required: ["ubid", "businessName", "lastModified"],
      },
      MockEkarmikaEstablishment: {
        type: "object",
        properties: {
          labourRegNo: { type: "string" },
          ubid: { type: "string" },
          businessName: { type: "string" },
          addressFull: { type: "string" },
          managerName: { type: "string" },
          employeeCount: { type: "integer" },
          workerLimit: { type: "integer" },
          powerCapacityHP: { type: "number" },
          lastModified: { type: "string", format: "date-time" },
        },
        required: ["labourRegNo", "ubid", "businessName", "lastModified"],
      },
      MockEsurakshateFactory: {
        type: "object",
        properties: {
          factoryLicenseNo: { type: "string" },
          ubid: { type: "string" },
          businessName: { type: "string" },
          factoryAddress: { type: "string" },
          managerName: { type: "string" },
          employeeCount: { type: "integer" },
          workerLimit: { type: "integer" },
          powerCapacityHP: { type: "number" },
          lastModified: { type: "string", format: "date-time" },
        },
        required: ["factoryLicenseNo", "ubid", "businessName", "lastModified"],
      },
      RoutedTarget: {
        type: "object",
        properties: {
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          localIdentifier: { type: "string" },
        },
        required: ["targetSystem", "localIdentifier"],
      },
      KsyncIngestRequest: {
        type: "object",
        properties: {
          correlationId: { type: "string" },
          sourceSystem: { $ref: "#/components/schemas/SystemName" },
          sourceRequestId: { type: "string" },
          ubid: { type: "string", example: "UBID-KA-2026-0001" },
          serviceType: { $ref: "#/components/schemas/ServiceType" },
          operation: { type: "string", enum: ["CREATE", "UPDATE", "DELETE"] },
          changedFields: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "businessName",
                "registeredAddress",
                "authorizedSignatory",
                "employeeCount",
                "workerLimit",
                "powerCapacityHP",
                "licenseExpiry",
              ],
            },
          },
          payload: { $ref: "#/components/schemas/CanonicalPayload" },
        },
        required: ["sourceSystem", "ubid", "serviceType", "operation", "changedFields", "payload"],
      },
      KsyncIngestResult: {
        type: "object",
        properties: {
          correlationId: { type: "string" },
          duplicate: { type: "boolean" },
          eventId: { type: "string" },
          normalizedPayloadHash: { type: "string" },
          status: { $ref: "#/components/schemas/EventStatus" },
          targets: {
            type: "array",
            items: { $ref: "#/components/schemas/RoutedTarget" },
          },
        },
        required: ["correlationId", "duplicate", "eventId", "normalizedPayloadHash", "status", "targets"],
      },
      DashboardEvent: {
        type: "object",
        properties: {
          eventId: { type: "string" },
          correlationId: { type: "string" },
          sourceSystem: { $ref: "#/components/schemas/SystemName" },
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          sourceRequestId: { type: "string" },
          ubid: { type: "string" },
          serviceType: { $ref: "#/components/schemas/ServiceType" },
          operation: { type: "string" },
          changedFields: { type: "array", items: { type: "string" } },
          payload: { $ref: "#/components/schemas/CanonicalPayload" },
          normalizedPayloadHash: { type: "string" },
          status: { $ref: "#/components/schemas/EventStatus" },
          routeTargets: { type: "array", items: { type: "object", additionalProperties: true } },
          metadata: { type: "object", additionalProperties: true },
          receivedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["eventId", "correlationId", "sourceSystem", "ubid", "serviceType", "operation", "changedFields", "payload", "normalizedPayloadHash", "status", "routeTargets", "receivedAt", "createdAt", "updatedAt"],
      },
      AuditLog: {
        type: "object",
        properties: {
          auditId: { type: "string" },
          eventId: { type: "string" },
          correlationId: { type: "string" },
          ubid: { type: "string" },
          sourceSystem: { $ref: "#/components/schemas/SystemName" },
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          serviceType: { $ref: "#/components/schemas/ServiceType" },
          operation: { type: "string" },
          stage: {
            type: "string",
            enum: ["INGESTION", "VALIDATION", "NORMALIZATION", "ROUTING", "CONFLICT_REVIEW", "DELIVERY"],
          },
          status: { $ref: "#/components/schemas/EventStatus" },
          message: { type: "string" },
          sourceRequestId: { type: "string" },
          metadata: { type: "object", additionalProperties: true },
          recordedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["auditId", "eventId", "correlationId", "ubid", "sourceSystem", "serviceType", "operation", "stage", "status", "message", "recordedAt", "createdAt"],
      },
      ConflictRecord: {
        type: "object",
        properties: {
          conflictId: { type: "string" },
          eventId: { type: "string" },
          correlationId: { type: "string" },
          ubid: { type: "string" },
          serviceType: { $ref: "#/components/schemas/ServiceType" },
          sourceSystem: { $ref: "#/components/schemas/SystemName" },
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          conflictingFields: { type: "array", items: { type: "string" } },
          sourcePayload: { type: "object", additionalProperties: true },
          targetPayload: { type: "object", additionalProperties: true },
          detectedAt: { type: "string", format: "date-time" },
          outcome: { type: "string", enum: ["PENDING_REVIEW", "SOURCE_ACCEPTED", "TARGET_ACCEPTED", "MERGED", "REJECTED"] },
          resolutionStatus: { $ref: "#/components/schemas/ConflictResolutionStatus" },
          reviewStatus: { type: "string", enum: ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "REPLAYED", "CLOSED"] },
          winningEventId: { type: "string" },
          losingEventId: { type: "string" },
          explanation: { type: "string" },
          notes: { type: "string" },
          reviewedBy: { type: "string" },
          reviewedAt: { type: "string", format: "date-time" },
          authorityDecision: { type: "object", additionalProperties: true },
          metadata: { type: "object", additionalProperties: true },
        },
        required: ["conflictId", "eventId", "correlationId", "ubid", "serviceType", "sourceSystem", "targetSystem", "conflictingFields", "sourcePayload", "targetPayload", "detectedAt", "outcome", "resolutionStatus"],
      },
      ManualReviewItem: {
        type: "object",
        properties: {
          reviewId: { type: "string" },
          reviewStatus: { type: "string", enum: ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "REPLAYED", "CLOSED"] },
          reviewType: { type: "string" },
          eventId: { type: "string" },
          conflictId: { type: "string" },
          jobId: { type: "string" },
          correlationId: { type: "string" },
          ubid: { type: "string" },
          sourceSystem: { $ref: "#/components/schemas/SystemName" },
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          title: { type: "string" },
          summary: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          resolutionPayload: { type: "object", additionalProperties: true },
          reviewerNotes: { type: "string" },
          assignedTo: { type: "string" },
          openedAt: { type: "string", format: "date-time" },
          reviewedAt: { type: "string", format: "date-time" },
          closedAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["reviewId", "reviewStatus", "reviewType", "title", "openedAt", "createdAt", "updatedAt"],
      },
      AuthorityMatrixRule: {
        type: "object",
        properties: {
          fieldPath: { type: "string" },
          version: { type: "integer" },
          serviceType: { $ref: "#/components/schemas/ServiceType" },
          authoritativeSystem: { $ref: "#/components/schemas/SystemName" },
          fallbackSystem: { $ref: "#/components/schemas/SystemName" },
          targetSystem: { $ref: "#/components/schemas/SystemName" },
          manualReviewRequired: { type: "boolean" },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE", "DEPRECATED"] },
          ruleConfig: { type: "object", additionalProperties: true },
          notes: { type: "string" },
        },
        required: ["fieldPath", "version", "authoritativeSystem", "manualReviewRequired", "status"],
      },
      ScenarioResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          scenario: { type: "string", example: "SWS_TO_DEPARTMENTS" },
          message: { type: "string" },
          correlationId: { type: "string" },
          eventId: { type: "string" },
          conflictId: { type: "string" },
          details: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["success", "scenario", "message", "details"],
      },
      QueueStats: {
        type: "object",
        properties: {
          waiting: { type: "integer" },
          active: { type: "integer" },
          completed: { type: "integer" },
          failed: { type: "integer" },
          delayed: { type: "integer" },
          paused: { type: "integer" },
        },
        required: ["waiting", "active", "completed", "failed", "delayed", "paused"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Backend health check",
        responses: {
          200: {
            description: "Backend service is reachable.",
            content: {
              "application/json": {
                example: {
                  status: "ok",
                  service: APP_NAME,
                },
              },
            },
          },
        },
      },
    },
    "/api/mock/sws": {
      get: {
        tags: ["Mock SWS"],
        summary: "Get Mock SWS module status",
        responses: {
          200: createSuccessResponse(
            "Mock SWS module status.",
            {
              type: "object",
              properties: {
                module: { type: "string" },
                status: { type: "string" },
                seededBusinesses: { type: "integer" },
                message: { type: "string" },
              },
            },
            {
              module: "mock-sws",
              status: "placeholder-ready",
              seededBusinesses: 3,
              message: "Mock SWS PostgreSQL API is ready.",
            },
            "Mock SWS module is available.",
          ),
        },
      },
    },
    "/api/mock/sws/businesses": {
      get: {
        tags: ["Mock SWS"],
        summary: "List mock SWS businesses",
        responses: {
          200: createSuccessResponse(
            "Mock SWS businesses loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/MockSwsBusiness" },
            },
            [
              {
                ubid: "UBID-KA-2026-0001",
                businessName: "Pragati Precision Works Pvt Ltd",
                labourRegNo: "LAB-KA-2026-0001",
                factoryLicenseNo: "FAC-KA-2026-0001",
                sourceRequestId: "SWS-SEED-0001",
                lastModified: "2026-05-01T09:00:00.000Z",
              },
            ],
            "Mock SWS businesses loaded.",
          ),
        },
      },
    },
    "/api/mock/sws/business/{ubid}": {
      get: {
        tags: ["Mock SWS"],
        summary: "Get a mock SWS business by UBID",
        parameters: [
          {
            name: "ubid",
            in: "path",
            required: true,
            schema: { type: "string", example: "UBID-KA-2026-0001" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Mock SWS business loaded.",
            { $ref: "#/components/schemas/MockSwsBusiness" },
            {
              ubid: "UBID-KA-2026-0001",
              businessName: "Pragati Precision Works Pvt Ltd",
              labourRegNo: "LAB-KA-2026-0001",
              factoryLicenseNo: "FAC-KA-2026-0001",
              sourceRequestId: "SWS-SEED-0001",
              registeredAddress: {
                line1: "12 Peenya Industrial Area",
                city: "Bengaluru",
                state: "Karnataka",
                postalCode: "560058",
              },
              authorizedSignatory: {
                name: "Ananya Kulkarni",
              },
              lastModified: "2026-05-01T09:00:00.000Z",
            },
            "Mock SWS business UBID-KA-2026-0001 loaded.",
          ),
          404: {
            description: "Business not found.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Mock SWS"],
        summary: "Update a mock SWS business",
        parameters: [
          {
            name: "ubid",
            in: "path",
            required: true,
            schema: { type: "string", example: "UBID-KA-2026-0001" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  businessName: { type: "string" },
                  sourceRequestId: { type: "string" },
                  payload: { $ref: "#/components/schemas/CanonicalPayload" },
                },
              },
              example: {
                sourceRequestId: "MANUAL-UPDATE-1",
                payload: {
                  authorizedSignatory: { name: "Meera Rao" },
                },
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "Mock SWS business updated.",
            { $ref: "#/components/schemas/MockSwsBusiness" },
            {
              ubid: "UBID-KA-2026-0001",
              businessName: "Pragati Precision Works Pvt Ltd",
              sourceRequestId: "MANUAL-UPDATE-1",
              lastModified: "2026-05-07T10:00:00.000Z",
            },
            "Mock SWS business UBID-KA-2026-0001 updated.",
          ),
        },
      },
    },
    "/api/mock/sws/service-request": {
      post: {
        tags: ["Mock SWS"],
        summary: "Create a mock SWS service request",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/KsyncIngestRequest" },
                  {
                    type: "object",
                    properties: {
                      requestedAt: { type: "string", format: "date-time" },
                    },
                  },
                ],
              },
              example: {
                correlationId: "SWS-REQ-001",
                sourceRequestId: "SWS-REQ-001",
                sourceSystem: "SWS",
                ubid: "UBID-KA-2026-0001",
                serviceType: "REGISTERED_ADDRESS_CHANGE",
                operation: "UPDATE",
                changedFields: ["registeredAddress"],
                payload: {
                  registeredAddress: {
                    line1: "Plot 44, Peenya Industrial Area",
                    city: "Bengaluru",
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                    postalCode: "560058",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: createSuccessResponse(
            "Mock SWS service request accepted.",
            {
              type: "object",
              additionalProperties: true,
            },
            {
              business: {
                ubid: "UBID-KA-2026-0001",
                lastModified: "2026-05-07T10:00:00.000Z",
              },
              request: {
                requestId: "SWSREQ-12345678",
                correlationId: "SWS-REQ-001",
              },
            },
            "Mock SWS service request accepted.",
          ),
        },
      },
    },
    "/api/mock/ekarmika": {
      get: {
        tags: ["Mock e-Karmika"],
        summary: "Get Mock e-Karmika module status",
        responses: {
          200: createSuccessResponse(
            "Mock e-Karmika module status.",
            {
              type: "object",
              properties: {
                module: { type: "string" },
                status: { type: "string" },
                seededEstablishments: { type: "integer" },
                message: { type: "string" },
              },
            },
            {
              module: "mock-ekarmika",
              status: "placeholder-ready",
              seededEstablishments: 2,
              message: "Mock e-Karmika PostgreSQL API is ready.",
            },
            "Mock e-Karmika module is available.",
          ),
        },
      },
    },
    "/api/mock/ekarmika/establishments/{labourRegNo}": {
      get: {
        tags: ["Mock e-Karmika"],
        summary: "Get an e-Karmika establishment by labour registration number",
        parameters: [
          {
            name: "labourRegNo",
            in: "path",
            required: true,
            schema: { type: "string", example: "LAB-KA-2026-0001" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "e-Karmika establishment loaded.",
            { $ref: "#/components/schemas/MockEkarmikaEstablishment" },
            {
              labourRegNo: "LAB-KA-2026-0001",
              ubid: "UBID-KA-2026-0001",
              businessName: "Pragati Precision Works Pvt Ltd",
              addressFull: "12 Peenya Industrial Area, Bengaluru, Karnataka, 560058",
              managerName: "Ananya Kulkarni",
              lastModified: "2026-05-01T09:00:00.000Z",
            },
            "Mock e-Karmika establishment LAB-KA-2026-0001 loaded.",
          ),
        },
      },
    },
    "/api/mock/ekarmika/establishments/{labourRegNo}/amendment": {
      put: {
        tags: ["Mock e-Karmika"],
        summary: "Amend a mock e-Karmika establishment",
        parameters: [
          {
            name: "labourRegNo",
            in: "path",
            required: true,
            schema: { type: "string", example: "LAB-KA-2026-0001" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  businessName: { type: "string" },
                  addressFull: { type: "string" },
                  managerName: { type: "string" },
                  employeeCount: { type: "integer" },
                  workerLimit: { type: "integer" },
                  powerCapacityHP: { type: "number" },
                },
              },
              example: {
                addressFull: "44 Peenya Layout, Bengaluru, Karnataka, 560058",
                managerName: "Meera Rao",
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "e-Karmika amendment applied.",
            {
              type: "object",
              additionalProperties: true,
            },
            {
              establishment: {
                labourRegNo: "LAB-KA-2026-0001",
                managerName: "Meera Rao",
              },
              change: {
                changeId: "EKCHG-12345678",
              },
            },
            "Mock e-Karmika establishment LAB-KA-2026-0001 amended.",
          ),
        },
      },
    },
    "/api/mock/ekarmika/manual-update": {
      post: {
        tags: ["Mock e-Karmika"],
        summary: "Apply a direct manual e-Karmika update",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/KsyncIngestRequest" },
                  {
                    type: "object",
                    properties: {
                      remarks: { type: "string" },
                      updatedBy: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "Manual e-Karmika update applied.",
            {
              type: "object",
              additionalProperties: true,
            },
            {
              establishment: {
                labourRegNo: "LAB-KA-2026-0001",
              },
              change: {
                changeId: "EKCHG-12345678",
              },
            },
            "Mock e-Karmika manual update applied.",
          ),
        },
      },
    },
    "/api/mock/ekarmika/changes": {
      get: {
        tags: ["Mock e-Karmika"],
        summary: "List mock e-Karmika change records",
        parameters: [
          {
            name: "updated_since",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Mock e-Karmika changes loaded.",
            {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
            [
              {
                changeId: "EKCHG-12345678",
                ubid: "UBID-KA-2026-0001",
                labourRegNo: "LAB-KA-2026-0001",
                serviceType: "REGISTERED_ADDRESS_CHANGE",
              },
            ],
            "Mock e-Karmika changes loaded.",
          ),
        },
      },
    },
    "/api/mock/esurakshate": {
      get: {
        tags: ["Mock e-Surakshate"],
        summary: "Get Mock e-Surakshate module status",
        responses: {
          200: createSuccessResponse(
            "Mock e-Surakshate module status.",
            {
              type: "object",
              properties: {
                module: { type: "string" },
                status: { type: "string" },
                seededFactories: { type: "integer" },
                message: { type: "string" },
              },
            },
            {
              module: "mock-esurakshate",
              status: "placeholder-ready",
              seededFactories: 2,
              message: "Mock e-Surakshate PostgreSQL API is ready.",
            },
            "Mock e-Surakshate module is available.",
          ),
        },
      },
    },
    "/api/mock/esurakshate/factories/{factoryLicenseNo}": {
      get: {
        tags: ["Mock e-Surakshate"],
        summary: "Get a mock e-Surakshate factory by license number",
        parameters: [
          {
            name: "factoryLicenseNo",
            in: "path",
            required: true,
            schema: { type: "string", example: "FAC-KA-2026-0001" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Factory loaded.",
            { $ref: "#/components/schemas/MockEsurakshateFactory" },
            {
              factoryLicenseNo: "FAC-KA-2026-0001",
              ubid: "UBID-KA-2026-0001",
              businessName: "Pragati Precision Works Pvt Ltd",
              factoryAddress: "12 Peenya Industrial Area, Bengaluru, Karnataka, 560058",
              managerName: "Ananya Kulkarni",
              lastModified: "2026-05-01T09:00:00.000Z",
            },
            "Mock e-Surakshate factory FAC-KA-2026-0001 loaded.",
          ),
        },
      },
    },
    "/api/mock/esurakshate/factories/{factoryLicenseNo}/amendment": {
      put: {
        tags: ["Mock e-Surakshate"],
        summary: "Amend a mock e-Surakshate factory record",
        parameters: [
          {
            name: "factoryLicenseNo",
            in: "path",
            required: true,
            schema: { type: "string", example: "FAC-KA-2026-0001" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  businessName: { type: "string" },
                  factoryAddress: { type: "string" },
                  managerName: { type: "string" },
                  employeeCount: { type: "integer" },
                  workerLimit: { type: "integer" },
                  powerCapacityHP: { type: "number" },
                },
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "Factory amended.",
            {
              type: "object",
              additionalProperties: true,
            },
            {
              factory: {
                factoryLicenseNo: "FAC-KA-2026-0001",
                managerName: "Meera Rao",
              },
              change: {
                changeId: "ESCHG-12345678",
              },
            },
            "Mock e-Surakshate factory FAC-KA-2026-0001 amended.",
          ),
        },
      },
    },
    "/api/mock/esurakshate/manual-update": {
      post: {
        tags: ["Mock e-Surakshate"],
        summary: "Apply a direct manual e-Surakshate update",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/KsyncIngestRequest" },
                  {
                    type: "object",
                    properties: {
                      remarks: { type: "string" },
                      updatedBy: { type: "string" },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "Manual e-Surakshate update applied.",
            {
              type: "object",
              additionalProperties: true,
            },
            {
              factory: {
                factoryLicenseNo: "FAC-KA-2026-0001",
              },
              change: {
                changeId: "ESCHG-12345678",
              },
            },
            "Mock e-Surakshate manual update applied.",
          ),
        },
      },
    },
    "/api/mock/esurakshate/snapshot/{factoryLicenseNo}": {
      get: {
        tags: ["Mock e-Surakshate"],
        summary: "Get an e-Surakshate factory snapshot",
        parameters: [
          {
            name: "factoryLicenseNo",
            in: "path",
            required: true,
            schema: { type: "string", example: "FAC-KA-2026-0001" },
          },
          {
            name: "format",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["json", "xml"] },
          },
        ],
        responses: {
          200: {
            description: "Snapshot generated.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiResponse" },
                    {
                      type: "object",
                      properties: {
                        data: {
                          type: "object",
                          properties: {
                            factoryLicenseNo: { type: "string" },
                            snapshotXml: { type: "string" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
              "application/xml": {
                schema: {
                  type: "string",
                },
              },
            },
          },
        },
      },
    },
    "/api/ksync": {
      get: {
        tags: ["K-Sync"],
        summary: "Get K-Sync module status",
        responses: {
          200: createSuccessResponse(
            "K-Sync module status.",
            {
              type: "object",
              properties: {
                module: { type: "string" },
                totalEvents: { type: "integer" },
                status: { type: "string" },
                message: { type: "string" },
              },
            },
            {
              module: "ksync",
              totalEvents: 12,
              status: "placeholder-ready",
              message: "K-Sync core module is running with Prisma-backed storage.",
            },
            "K-Sync core module is available.",
          ),
        },
      },
    },
    "/api/ksync/ingest": {
      post: {
        tags: ["K-Sync"],
        summary: "Ingest a canonical event into K-Sync",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/KsyncIngestRequest" },
              example: {
                correlationId: "scenario-sws-address-001",
                sourceRequestId: "scenario-sws-address-001",
                sourceSystem: "SWS",
                ubid: "UBID-KA-2026-0001",
                serviceType: "REGISTERED_ADDRESS_CHANGE",
                operation: "UPDATE",
                changedFields: ["registeredAddress"],
                payload: {
                  registeredAddress: {
                    line1: "Plot 44, Peenya Industrial Area",
                    city: "Bengaluru",
                    district: "Bengaluru Urban",
                    state: "Karnataka",
                    postalCode: "560058",
                  },
                },
              },
            },
          },
        },
        responses: {
          202: createSuccessResponse(
            "Ingest request accepted.",
            { $ref: "#/components/schemas/KsyncIngestResult" },
            {
              correlationId: "scenario-sws-address-001",
              duplicate: false,
              eventId: "EVT-ABCDE12345",
              normalizedPayloadHash: "hash-123",
              status: "QUEUED",
              targets: [
                { targetSystem: "EKARMIKA", localIdentifier: "LAB-KA-2026-0001" },
                { targetSystem: "ESURAKSHATE", localIdentifier: "FAC-KA-2026-0001" },
              ],
            },
            "K-Sync ingest request accepted.",
          ),
        },
      },
    },
    "/api/ksync/events": {
      get: {
        tags: ["K-Sync"],
        summary: "List canonical events",
        responses: {
          200: createSuccessResponse(
            "Canonical events loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/DashboardEvent" },
            },
            [],
            "Canonical events loaded.",
          ),
        },
      },
    },
    "/api/ksync/events/{eventId}": {
      get: {
        tags: ["K-Sync"],
        summary: "Get a canonical event by event ID",
        parameters: [
          {
            name: "eventId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Canonical event loaded.",
            { $ref: "#/components/schemas/DashboardEvent" },
            {
              eventId: "EVT-ABCDE12345",
              correlationId: "scenario-sws-address-001",
              sourceSystem: "SWS",
              ubid: "UBID-KA-2026-0001",
              serviceType: "REGISTERED_ADDRESS_CHANGE",
              operation: "UPDATE",
              changedFields: ["registeredAddress"],
              payload: {},
              normalizedPayloadHash: "hash-123",
              status: "QUEUED",
              routeTargets: [],
              receivedAt: "2026-05-07T10:00:00.000Z",
              createdAt: "2026-05-07T10:00:00.000Z",
              updatedAt: "2026-05-07T10:00:00.000Z",
            },
            "Canonical event EVT-ABCDE12345 loaded.",
          ),
        },
      },
    },
    "/api/ksync/run-scenario/sws-to-departments": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 1: SWS to Departments",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/run-scenario/department-to-sws": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 2: Department to SWS",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/run-scenario/conflict": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 3: Conflict",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/run-scenario/manual-review": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 4: Manual Review",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/run-scenario/idempotency": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 5: Idempotency",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/run-scenario/failure-retry": {
      post: {
        tags: ["Scenarios"],
        summary: "Run Scenario 6: Failure and Retry",
        responses: {
          202: {
            description: "Scenario executed.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/ksync/reset-demo": {
      post: {
        tags: ["Scenarios"],
        summary: "Reset deterministic demo data",
        responses: {
          200: {
            description: "Demo state reset.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ScenarioResponse" },
              },
            },
          },
        },
      },
    },
    "/api/audit/logs": {
      get: {
        tags: ["Audit"],
        summary: "List audit logs",
        parameters: [
          { name: "correlationId", in: "query", schema: { type: "string" } },
          { name: "eventId", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/EventStatus" } },
          { name: "ubid", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
        ],
        responses: {
          200: createSuccessResponse(
            "Audit logs loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLog" },
            },
            [],
            "Audit logs loaded.",
          ),
        },
      },
    },
    "/api/audit/{correlationId}": {
      get: {
        tags: ["Audit"],
        summary: "Get audit logs by correlation ID",
        parameters: [
          {
            name: "correlationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Audit logs for correlation ID loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLog" },
            },
            [],
            "Audit logs for correlation scenario-sws-address-001 loaded.",
          ),
        },
      },
    },
    "/api/conflicts": {
      get: {
        tags: ["Conflicts"],
        summary: "List conflicts",
        responses: {
          200: createSuccessResponse(
            "Conflicts loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/ConflictRecord" },
            },
            [],
            "Conflicts loaded.",
          ),
        },
      },
    },
    "/api/conflicts/{conflictId}": {
      get: {
        tags: ["Conflicts"],
        summary: "Get a conflict by conflict ID",
        parameters: [
          {
            name: "conflictId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Conflict loaded.",
            { $ref: "#/components/schemas/ConflictRecord" },
            {
              conflictId: "CF-ABCDE12345",
              eventId: "EVT-ABCDE12345",
              correlationId: "scenario-conflict-sws-001",
              ubid: "UBID-KA-2026-0001",
              serviceType: "REGISTERED_ADDRESS_CHANGE",
              sourceSystem: "SWS",
              targetSystem: "EKARMIKA",
              conflictingFields: ["registeredAddress"],
              sourcePayload: {},
              targetPayload: {},
              detectedAt: "2026-05-07T10:00:00.000Z",
              outcome: "SOURCE_ACCEPTED",
              resolutionStatus: "AUTO_RESOLVED",
            },
            "Conflict CF-ABCDE12345 loaded.",
          ),
        },
      },
    },
    "/api/conflicts/{conflictId}/review": {
      post: {
        tags: ["Conflicts"],
        summary: "Review a conflict",
        parameters: [
          {
            name: "conflictId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["APPROVED", "REJECTED"] },
                  outcome: { type: "string", enum: ["PENDING_REVIEW", "SOURCE_ACCEPTED", "TARGET_ACCEPTED", "MERGED", "REJECTED"] },
                  notes: { type: "string" },
                  reviewedAt: { type: "string", format: "date-time" },
                  reviewedBy: { type: "string" },
                  reviewerId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: createSuccessResponse(
            "Conflict reviewed.",
            { $ref: "#/components/schemas/ConflictRecord" },
            {
              conflictId: "CF-ABCDE12345",
              resolutionStatus: "REJECTED_AFTER_REVIEW",
              reviewStatus: "REJECTED",
            },
            "Conflict CF-ABCDE12345 reviewed.",
          ),
        },
      },
    },
    "/api/conflicts/{conflictId}/replay": {
      post: {
        tags: ["Conflicts"],
        summary: "Request conflict replay",
        parameters: [
          {
            name: "conflictId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string" },
                  requestedBy: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          202: createSuccessResponse(
            "Replay request recorded.",
            {
              type: "object",
              properties: {
                conflictId: { type: "string" },
                replayed: { type: "boolean" },
                reviewStatus: { type: "string" },
                status: { type: "string" },
              },
            },
            {
              conflictId: "CF-ABCDE12345",
              replayed: false,
              reviewStatus: "OPEN",
              status: "NOT_IMPLEMENTED",
            },
            "Replay request recorded for conflict CF-ABCDE12345.",
          ),
        },
      },
    },
    "/api/dashboard/metrics": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dashboard metrics",
        responses: {
          200: createSuccessResponse(
            "Dashboard metrics loaded.",
            {
              type: "object",
              properties: {
                totalEvents: { type: "integer" },
                successfulSyncs: { type: "integer" },
                failedWrites: { type: "integer" },
                conflictsDetected: { type: "integer" },
                duplicateRequestsBlocked: { type: "integer" },
                pendingManualReviews: { type: "integer" },
                dlqJobs: { type: "integer" },
                queueJobs: { type: "integer" },
              },
            },
            {
              totalEvents: 12,
              successfulSyncs: 8,
              failedWrites: 1,
              conflictsDetected: 2,
              duplicateRequestsBlocked: 1,
              pendingManualReviews: 0,
              dlqJobs: 0,
              queueJobs: 6,
            },
            "Dashboard metrics loaded",
          ),
        },
      },
    },
    "/api/dashboard/system-health": {
      get: {
        tags: ["Dashboard"],
        summary: "Get system health for dependencies and mock systems",
        responses: {
          200: createSuccessResponse(
            "System health loaded.",
            {
              type: "object",
              properties: {
                mockSws: { type: "object", properties: { status: { type: "string" } } },
                mockEkarmika: { type: "object", properties: { status: { type: "string" } } },
                mockEsurakshate: { type: "object", properties: { status: { type: "string" } } },
                database: { type: "object", properties: { status: { type: "string" }, message: { type: "string" } } },
                redis: { type: "object", properties: { status: { type: "string" }, message: { type: "string" } } },
                queue: { type: "object", properties: { status: { type: "string" }, message: { type: "string" } } },
              },
            },
            {
              mockSws: { status: "online" },
              mockEkarmika: { status: "online" },
              mockEsurakshate: { status: "online" },
              database: { status: "online" },
              redis: { status: "online" },
              queue: { status: "active" },
            },
            "System health loaded",
          ),
        },
      },
    },
    "/api/dashboard/business-comparison/{ubid}": {
      get: {
        tags: ["Dashboard"],
        summary: "Compare a business across SWS and department systems",
        parameters: [
          {
            name: "ubid",
            in: "path",
            required: true,
            schema: { type: "string", example: "UBID-KA-2026-0001" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Business comparison loaded.",
            {
              type: "object",
              properties: {
                ubid: { type: "string" },
                sws: { type: "object", nullable: true, additionalProperties: true },
                ekarmika: { type: "object", nullable: true, additionalProperties: true },
                esurakshate: { type: "object", nullable: true, additionalProperties: true },
                registryMappings: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: true,
                  },
                },
                missingSystems: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
            {
              ubid: "UBID-KA-2026-0001",
              sws: {},
              ekarmika: {},
              esurakshate: {},
              registryMappings: [],
              missingSystems: [],
            },
            "Business comparison loaded",
          ),
        },
      },
    },
    "/api/dashboard/events": {
      get: {
        tags: ["Dashboard"],
        summary: "Get paginated dashboard events",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "ubid", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/EventStatus" } },
          { name: "sourceSystem", in: "query", schema: { $ref: "#/components/schemas/SystemName" } },
          { name: "serviceType", in: "query", schema: { $ref: "#/components/schemas/ServiceType" } },
        ],
        responses: {
          200: createSuccessResponse(
            "Events loaded.",
            {
              allOf: [
                { $ref: "#/components/schemas/PaginationEnvelope" },
                {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DashboardEvent" },
                    },
                  },
                },
              ],
            },
            {
              items: [],
              page: 1,
              limit: 20,
              total: 0,
            },
            "Events loaded",
          ),
        },
      },
    },
    "/api/dashboard/events/{eventId}": {
      get: {
        tags: ["Dashboard"],
        summary: "Get a dashboard event with related audit logs",
        parameters: [
          {
            name: "eventId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: createSuccessResponse(
            "Dashboard event loaded.",
            {
              type: "object",
              properties: {
                event: { $ref: "#/components/schemas/DashboardEvent" },
                auditLogs: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AuditLog" },
                },
              },
              required: ["event", "auditLogs"],
            },
            {
              event: {
                eventId: "EVT-ABCDE12345",
              },
              auditLogs: [],
            },
            "Event EVT-ABCDE12345 loaded",
          ),
        },
      },
    },
    "/api/dashboard/audit": {
      get: {
        tags: ["Dashboard"],
        summary: "Get paginated dashboard audit logs",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "ubid", in: "query", schema: { type: "string" } },
          { name: "correlationId", in: "query", schema: { type: "string" } },
          { name: "eventId", in: "query", schema: { type: "string" } },
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "sourceSystem", in: "query", schema: { $ref: "#/components/schemas/SystemName" } },
          { name: "targetSystem", in: "query", schema: { $ref: "#/components/schemas/SystemName" } },
        ],
        responses: {
          200: createSuccessResponse(
            "Audit logs loaded.",
            {
              allOf: [
                { $ref: "#/components/schemas/PaginationEnvelope" },
                {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/AuditLog" },
                    },
                  },
                },
              ],
            },
            {
              items: [],
              page: 1,
              limit: 20,
              total: 0,
            },
            "Audit logs loaded",
          ),
        },
      },
    },
    "/api/dashboard/conflicts": {
      get: {
        tags: ["Dashboard"],
        summary: "Get paginated dashboard conflicts with manual review items",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
          { name: "ubid", in: "query", schema: { type: "string" } },
          { name: "resolutionStatus", in: "query", schema: { $ref: "#/components/schemas/ConflictResolutionStatus" } },
        ],
        responses: {
          200: createSuccessResponse(
            "Conflicts loaded.",
            {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ConflictRecord" },
                },
                manualReviewItems: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ManualReviewItem" },
                },
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
              },
              required: ["items", "manualReviewItems", "page", "limit", "total"],
            },
            {
              items: [],
              manualReviewItems: [],
              page: 1,
              limit: 20,
              total: 0,
            },
            "Conflicts loaded",
          ),
        },
      },
    },
    "/api/dashboard/queue-status": {
      get: {
        tags: ["Dashboard"],
        summary: "Get dashboard queue and Redis status",
        responses: {
          200: createSuccessResponse(
            "Queue status loaded.",
            {
              type: "object",
              properties: {
                redis: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                },
                queue: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    message: { type: "string" },
                  },
                },
                bullmq: {
                  type: "object",
                  properties: {
                    departmentWriteQueue: { $ref: "#/components/schemas/QueueStats" },
                    swsWriteQueue: { $ref: "#/components/schemas/QueueStats" },
                    pollingQueue: { $ref: "#/components/schemas/QueueStats" },
                    retryQueue: { $ref: "#/components/schemas/QueueStats" },
                  },
                },
                queueJobStatusCounts: {
                  type: "object",
                  additionalProperties: { type: "integer" },
                },
                deadLetterJobCount: { type: "integer" },
              },
              required: ["redis", "queue", "queueJobStatusCounts", "deadLetterJobCount"],
            },
            {
              redis: { status: "online" },
              queue: { status: "active" },
              bullmq: {
                departmentWriteQueue: { waiting: 0, active: 0, completed: 2, failed: 0, delayed: 0, paused: 0 },
              },
              queueJobStatusCounts: {
                QUEUED: 0,
                PROCESSING: 0,
                COMPLETED: 2,
                FAILED: 0,
                RETRY_SCHEDULED: 0,
                DLQ_MOVED: 0,
              },
              deadLetterJobCount: 0,
            },
            "Queue status loaded",
          ),
        },
      },
    },
    "/api/dashboard/authority-matrix": {
      get: {
        tags: ["Dashboard"],
        summary: "Get active Authority Matrix rules",
        responses: {
          200: createSuccessResponse(
            "Authority Matrix loaded.",
            {
              type: "array",
              items: { $ref: "#/components/schemas/AuthorityMatrixRule" },
            },
            [
              {
                fieldPath: "registeredAddress",
                version: 1,
                authoritativeSystem: "SWS",
                targetSystem: "EKARMIKA",
                manualReviewRequired: false,
                status: "ACTIVE",
              },
            ],
            "Authority Matrix loaded",
          ),
        },
      },
    },
  },
};

export function setupSwagger(app: Express) {
  app.use(API_DOCS_PATH, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
