-- CreateEnum
CREATE TYPE "SystemName" AS ENUM ('SWS', 'EKARMIKA', 'ESURAKSHATE', 'KSYNC');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('REGISTERED_ADDRESS_CHANGE', 'AUTHORIZED_SIGNATORY_CHANGE', 'EMPLOYEE_COUNT_CHANGE', 'LICENSE_EXPIRY_CHANGE', 'POWER_CAPACITY_CHANGE');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'IDEMPOTENCY_ACCEPTED', 'DUPLICATE_DETECTED', 'NORMALIZED', 'CONFLICT_CHECKED', 'CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'ROUTED', 'TRANSLATED', 'QUEUED', 'WRITE_ATTEMPTED', 'WRITE_SUCCEEDED', 'WRITE_FAILED', 'RETRY_SCHEDULED', 'DLQ_MOVED', 'COMPLETED', 'FAILED', 'MANUAL_REVIEW_REQUIRED', 'PROPAGATED_CHANGE_CONFIRMED', 'TARGET_NOT_APPLICABLE', 'REGISTRATION_REQUIRED', 'TARGET_MAPPING_MISSING', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('JSONATA', 'XSLT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ConflictResolutionStatus" AS ENUM ('AUTO_RESOLVED', 'SUPERSEDED', 'MANUAL_REVIEW_REQUIRED', 'REPLAYED_AFTER_REVIEW', 'REJECTED_AFTER_REVIEW', 'PENDING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REPLAYED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QueueJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRY_SCHEDULED', 'DLQ_MOVED');

-- CreateEnum
CREATE TYPE "AuditStage" AS ENUM ('INGESTION', 'VALIDATION', 'NORMALIZATION', 'ROUTING', 'CONFLICT_REVIEW', 'DELIVERY');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "labourRegNo" TEXT,
    "factoryLicenseNo" TEXT,
    "sourceRequestId" TEXT,
    "registeredAddress" JSONB,
    "authorizedSignatory" JSONB,
    "employeeCount" INTEGER,
    "workerLimit" INTEGER,
    "powerCapacityHP" INTEGER,
    "licenseExpiry" TEXT,
    "metadata" JSONB,
    "lastModifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UbidRegistry" (
    "id" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "systemName" "SystemName" NOT NULL,
    "localIdentifierType" TEXT NOT NULL,
    "localIdentifier" TEXT NOT NULL,
    "businessName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UbidRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "sourceSystem" "SystemName" NOT NULL,
    "targetSystem" "SystemName",
    "sourceRequestId" TEXT,
    "ubid" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "operation" "OperationType" NOT NULL,
    "changedFields" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "normalizedPayloadHash" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL,
    "routeTargets" JSONB,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "primaryKey" TEXT,
    "fallbackKey" TEXT NOT NULL,
    "eventId" TEXT,
    "sourceSystem" "SystemName" NOT NULL,
    "sourceRequestId" TEXT,
    "ubid" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "normalizedPayloadHash" TEXT NOT NULL,
    "cachedResult" JSONB,
    "status" "EventStatus",
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "sourceSystem" "SystemName" NOT NULL,
    "targetSystem" "SystemName",
    "serviceType" "ServiceType" NOT NULL,
    "operation" "OperationType" NOT NULL,
    "stage" "AuditStage" NOT NULL,
    "status" "EventStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "sourceRequestId" TEXT,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaMapping" (
    "id" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "sourceSystem" "SystemName" NOT NULL,
    "targetSystem" "SystemName" NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "mappingType" "MappingType" NOT NULL,
    "status" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "mappingExpression" TEXT NOT NULL,
    "fieldConfig" JSONB,
    "sampleInput" JSONB,
    "sampleOutput" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "SchemaMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL,
    "conflictId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "sourceSystem" "SystemName" NOT NULL,
    "targetSystem" "SystemName" NOT NULL,
    "conflictingFields" JSONB NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "targetPayload" JSONB NOT NULL,
    "resolutionStatus" "ConflictResolutionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "ReviewStatus",
    "authorityDecision" JSONB,
    "metadata" JSONB,
    "notes" TEXT,
    "reviewedBy" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorityMatrix" (
    "id" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "serviceType" "ServiceType",
    "authoritativeSystem" "SystemName" NOT NULL,
    "fallbackSystem" "SystemName",
    "targetSystem" "SystemName",
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" "MappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "ruleConfig" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentSnapshot" (
    "id" TEXT NOT NULL,
    "systemName" "SystemName" NOT NULL,
    "ubid" TEXT NOT NULL,
    "localIdentifier" TEXT NOT NULL,
    "localIdentifierType" TEXT,
    "snapshotPayload" JSONB NOT NULL,
    "normalizedPayloadHash" TEXT,
    "changedFields" JSONB,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "status" "QueueJobStatus" NOT NULL,
    "eventId" TEXT,
    "correlationId" TEXT,
    "ubid" TEXT,
    "sourceSystem" "SystemName",
    "targetSystem" "SystemName",
    "attemptsMade" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeadLetterJob" (
    "id" TEXT NOT NULL,
    "dlqId" TEXT NOT NULL,
    "jobId" TEXT,
    "eventId" TEXT,
    "correlationId" TEXT,
    "ubid" TEXT,
    "sourceSystem" "SystemName",
    "targetSystem" "SystemName",
    "queueName" TEXT NOT NULL,
    "status" "QueueJobStatus" NOT NULL DEFAULT 'DLQ_MOVED',
    "payload" JSONB NOT NULL,
    "error" JSONB,
    "metadata" JSONB,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "movedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualReviewItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "reviewType" TEXT NOT NULL,
    "eventId" TEXT,
    "conflictId" TEXT,
    "jobId" TEXT,
    "correlationId" TEXT,
    "ubid" TEXT,
    "sourceSystem" "SystemName",
    "targetSystem" "SystemName",
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "payload" JSONB,
    "resolutionPayload" JSONB,
    "reviewerNotes" TEXT,
    "assignedTo" TEXT,
    "requestedBy" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockSwsRecord" (
    "id" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "labourRegNo" TEXT,
    "factoryLicenseNo" TEXT,
    "sourceRequestId" TEXT,
    "registeredAddress" JSONB,
    "authorizedSignatory" JSONB,
    "employeeCount" INTEGER,
    "workerLimit" INTEGER,
    "powerCapacityHP" INTEGER,
    "licenseExpiry" TEXT,
    "rawPayload" JSONB,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockSwsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockEkarmikaRecord" (
    "id" TEXT NOT NULL,
    "labourRegNo" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "addressFull" TEXT,
    "managerName" TEXT,
    "employeeCount" INTEGER,
    "workerLimit" INTEGER,
    "powerCapacityHP" INTEGER,
    "rawPayload" JSONB,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockEkarmikaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockEsurakshateRecord" (
    "id" TEXT NOT NULL,
    "factoryLicenseNo" TEXT NOT NULL,
    "ubid" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "factoryAddress" TEXT,
    "managerName" TEXT,
    "employeeCount" INTEGER,
    "workerLimit" INTEGER,
    "powerCapacityHP" INTEGER,
    "snapshotXml" TEXT,
    "rawPayload" JSONB,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockEsurakshateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_ubid_key" ON "Business"("ubid");

-- CreateIndex
CREATE UNIQUE INDEX "Business_labourRegNo_key" ON "Business"("labourRegNo");

-- CreateIndex
CREATE UNIQUE INDEX "Business_factoryLicenseNo_key" ON "Business"("factoryLicenseNo");

-- CreateIndex
CREATE INDEX "Business_ubid_idx" ON "Business"("ubid");

-- CreateIndex
CREATE INDEX "Business_labourRegNo_idx" ON "Business"("labourRegNo");

-- CreateIndex
CREATE INDEX "Business_factoryLicenseNo_idx" ON "Business"("factoryLicenseNo");

-- CreateIndex
CREATE INDEX "UbidRegistry_ubid_idx" ON "UbidRegistry"("ubid");

-- CreateIndex
CREATE INDEX "UbidRegistry_systemName_idx" ON "UbidRegistry"("systemName");

-- CreateIndex
CREATE INDEX "UbidRegistry_localIdentifier_idx" ON "UbidRegistry"("localIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "UbidRegistry_ubid_systemName_localIdentifierType_key" ON "UbidRegistry"("ubid", "systemName", "localIdentifierType");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalEvent_eventId_key" ON "CanonicalEvent"("eventId");

-- CreateIndex
CREATE INDEX "CanonicalEvent_ubid_idx" ON "CanonicalEvent"("ubid");

-- CreateIndex
CREATE INDEX "CanonicalEvent_eventId_idx" ON "CanonicalEvent"("eventId");

-- CreateIndex
CREATE INDEX "CanonicalEvent_correlationId_idx" ON "CanonicalEvent"("correlationId");

-- CreateIndex
CREATE INDEX "CanonicalEvent_status_idx" ON "CanonicalEvent"("status");

-- CreateIndex
CREATE INDEX "CanonicalEvent_sourceSystem_idx" ON "CanonicalEvent"("sourceSystem");

-- CreateIndex
CREATE INDEX "CanonicalEvent_targetSystem_idx" ON "CanonicalEvent"("targetSystem");

-- CreateIndex
CREATE INDEX "CanonicalEvent_serviceType_idx" ON "CanonicalEvent"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_primaryKey_key" ON "IdempotencyKey"("primaryKey");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_fallbackKey_key" ON "IdempotencyKey"("fallbackKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_eventId_idx" ON "IdempotencyKey"("eventId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_ubid_idx" ON "IdempotencyKey"("ubid");

-- CreateIndex
CREATE INDEX "IdempotencyKey_sourceSystem_idx" ON "IdempotencyKey"("sourceSystem");

-- CreateIndex
CREATE INDEX "IdempotencyKey_sourceRequestId_idx" ON "IdempotencyKey"("sourceRequestId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_serviceType_idx" ON "IdempotencyKey"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_auditId_key" ON "AuditLog"("auditId");

-- CreateIndex
CREATE INDEX "AuditLog_auditId_idx" ON "AuditLog"("auditId");

-- CreateIndex
CREATE INDEX "AuditLog_eventId_idx" ON "AuditLog"("eventId");

-- CreateIndex
CREATE INDEX "AuditLog_ubid_idx" ON "AuditLog"("ubid");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_status_idx" ON "AuditLog"("status");

-- CreateIndex
CREATE INDEX "AuditLog_sourceSystem_idx" ON "AuditLog"("sourceSystem");

-- CreateIndex
CREATE INDEX "AuditLog_targetSystem_idx" ON "AuditLog"("targetSystem");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaMapping_mappingId_key" ON "SchemaMapping"("mappingId");

-- CreateIndex
CREATE INDEX "SchemaMapping_mappingId_idx" ON "SchemaMapping"("mappingId");

-- CreateIndex
CREATE INDEX "SchemaMapping_sourceSystem_idx" ON "SchemaMapping"("sourceSystem");

-- CreateIndex
CREATE INDEX "SchemaMapping_targetSystem_idx" ON "SchemaMapping"("targetSystem");

-- CreateIndex
CREATE INDEX "SchemaMapping_serviceType_idx" ON "SchemaMapping"("serviceType");

-- CreateIndex
CREATE INDEX "SchemaMapping_status_idx" ON "SchemaMapping"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Conflict_conflictId_key" ON "Conflict"("conflictId");

-- CreateIndex
CREATE INDEX "Conflict_conflictId_idx" ON "Conflict"("conflictId");

-- CreateIndex
CREATE INDEX "Conflict_eventId_idx" ON "Conflict"("eventId");

-- CreateIndex
CREATE INDEX "Conflict_ubid_idx" ON "Conflict"("ubid");

-- CreateIndex
CREATE INDEX "Conflict_correlationId_idx" ON "Conflict"("correlationId");

-- CreateIndex
CREATE INDEX "Conflict_sourceSystem_idx" ON "Conflict"("sourceSystem");

-- CreateIndex
CREATE INDEX "Conflict_targetSystem_idx" ON "Conflict"("targetSystem");

-- CreateIndex
CREATE INDEX "Conflict_resolutionStatus_idx" ON "Conflict"("resolutionStatus");

-- CreateIndex
CREATE INDEX "Conflict_reviewStatus_idx" ON "Conflict"("reviewStatus");

-- CreateIndex
CREATE INDEX "AuthorityMatrix_fieldPath_idx" ON "AuthorityMatrix"("fieldPath");

-- CreateIndex
CREATE INDEX "AuthorityMatrix_serviceType_idx" ON "AuthorityMatrix"("serviceType");

-- CreateIndex
CREATE INDEX "AuthorityMatrix_authoritativeSystem_idx" ON "AuthorityMatrix"("authoritativeSystem");

-- CreateIndex
CREATE INDEX "AuthorityMatrix_targetSystem_idx" ON "AuthorityMatrix"("targetSystem");

-- CreateIndex
CREATE INDEX "AuthorityMatrix_status_idx" ON "AuthorityMatrix"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorityMatrix_fieldPath_version_key" ON "AuthorityMatrix"("fieldPath", "version");

-- CreateIndex
CREATE INDEX "DepartmentSnapshot_ubid_idx" ON "DepartmentSnapshot"("ubid");

-- CreateIndex
CREATE INDEX "DepartmentSnapshot_systemName_idx" ON "DepartmentSnapshot"("systemName");

-- CreateIndex
CREATE INDEX "DepartmentSnapshot_localIdentifier_idx" ON "DepartmentSnapshot"("localIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentSnapshot_systemName_ubid_localIdentifier_key" ON "DepartmentSnapshot"("systemName", "ubid", "localIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "QueueJob_jobId_key" ON "QueueJob"("jobId");

-- CreateIndex
CREATE INDEX "QueueJob_jobId_idx" ON "QueueJob"("jobId");

-- CreateIndex
CREATE INDEX "QueueJob_eventId_idx" ON "QueueJob"("eventId");

-- CreateIndex
CREATE INDEX "QueueJob_ubid_idx" ON "QueueJob"("ubid");

-- CreateIndex
CREATE INDEX "QueueJob_correlationId_idx" ON "QueueJob"("correlationId");

-- CreateIndex
CREATE INDEX "QueueJob_status_idx" ON "QueueJob"("status");

-- CreateIndex
CREATE INDEX "QueueJob_sourceSystem_idx" ON "QueueJob"("sourceSystem");

-- CreateIndex
CREATE INDEX "QueueJob_targetSystem_idx" ON "QueueJob"("targetSystem");

-- CreateIndex
CREATE INDEX "QueueJob_queueName_idx" ON "QueueJob"("queueName");

-- CreateIndex
CREATE UNIQUE INDEX "DeadLetterJob_dlqId_key" ON "DeadLetterJob"("dlqId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_dlqId_idx" ON "DeadLetterJob"("dlqId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_jobId_idx" ON "DeadLetterJob"("jobId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_eventId_idx" ON "DeadLetterJob"("eventId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_ubid_idx" ON "DeadLetterJob"("ubid");

-- CreateIndex
CREATE INDEX "DeadLetterJob_correlationId_idx" ON "DeadLetterJob"("correlationId");

-- CreateIndex
CREATE INDEX "DeadLetterJob_status_idx" ON "DeadLetterJob"("status");

-- CreateIndex
CREATE INDEX "DeadLetterJob_sourceSystem_idx" ON "DeadLetterJob"("sourceSystem");

-- CreateIndex
CREATE INDEX "DeadLetterJob_targetSystem_idx" ON "DeadLetterJob"("targetSystem");

-- CreateIndex
CREATE UNIQUE INDEX "ManualReviewItem_reviewId_key" ON "ManualReviewItem"("reviewId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_reviewId_idx" ON "ManualReviewItem"("reviewId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_eventId_idx" ON "ManualReviewItem"("eventId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_conflictId_idx" ON "ManualReviewItem"("conflictId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_jobId_idx" ON "ManualReviewItem"("jobId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_ubid_idx" ON "ManualReviewItem"("ubid");

-- CreateIndex
CREATE INDEX "ManualReviewItem_correlationId_idx" ON "ManualReviewItem"("correlationId");

-- CreateIndex
CREATE INDEX "ManualReviewItem_reviewStatus_idx" ON "ManualReviewItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "ManualReviewItem_sourceSystem_idx" ON "ManualReviewItem"("sourceSystem");

-- CreateIndex
CREATE INDEX "ManualReviewItem_targetSystem_idx" ON "ManualReviewItem"("targetSystem");

-- CreateIndex
CREATE UNIQUE INDEX "MockSwsRecord_ubid_key" ON "MockSwsRecord"("ubid");

-- CreateIndex
CREATE INDEX "MockSwsRecord_ubid_idx" ON "MockSwsRecord"("ubid");

-- CreateIndex
CREATE INDEX "MockSwsRecord_labourRegNo_idx" ON "MockSwsRecord"("labourRegNo");

-- CreateIndex
CREATE INDEX "MockSwsRecord_factoryLicenseNo_idx" ON "MockSwsRecord"("factoryLicenseNo");

-- CreateIndex
CREATE UNIQUE INDEX "MockEkarmikaRecord_labourRegNo_key" ON "MockEkarmikaRecord"("labourRegNo");

-- CreateIndex
CREATE INDEX "MockEkarmikaRecord_ubid_idx" ON "MockEkarmikaRecord"("ubid");

-- CreateIndex
CREATE INDEX "MockEkarmikaRecord_labourRegNo_idx" ON "MockEkarmikaRecord"("labourRegNo");

-- CreateIndex
CREATE UNIQUE INDEX "MockEsurakshateRecord_factoryLicenseNo_key" ON "MockEsurakshateRecord"("factoryLicenseNo");

-- CreateIndex
CREATE INDEX "MockEsurakshateRecord_ubid_idx" ON "MockEsurakshateRecord"("ubid");

-- CreateIndex
CREATE INDEX "MockEsurakshateRecord_factoryLicenseNo_idx" ON "MockEsurakshateRecord"("factoryLicenseNo");
