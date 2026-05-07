# Scenario Flows

## Reset Demo

- Endpoint: `POST /api/ksync/reset-demo`
- Purpose: restore mock system records, queues, snapshots, and baseline seed data before each walkthrough
- Expected result: success response with restored record counts

## Scenario 1: SWS To Departments

- Endpoint: `POST /api/ksync/run-scenario/sws-to-departments`
- Input pattern: SWS updates `registeredAddress` for `UBID-KA-2026-0001`
- Expected outcome:
  - canonical event is created
  - queue jobs are created for EKARMIKA and ESURAKSHATE
  - both target systems show the new address
  - audit trail ends in `WRITE_SUCCEEDED` or `COMPLETED`

## Scenario 2: Department To SWS

- Endpoint: `POST /api/ksync/run-scenario/department-to-sws`
- Input pattern: direct e-Surakshate manager change followed by polling
- Expected outcome:
  - polling detects the change
  - an `AUTHORIZED_SIGNATORY_CHANGE` event is created
  - mock SWS reflects manager name `Meera Rao`
  - audit trail shows successful reverse sync

## Scenario 3: Conflict Resolution

- Endpoint: `POST /api/ksync/run-scenario/conflict`
- Input pattern:
  - e-Karmika publishes a competing address update
  - SWS publishes a different address update for the same business
- Expected outcome:
  - conflict record is created
  - resolution status becomes `AUTO_RESOLVED`
  - SWS wins for `registeredAddress`
  - competing department event is superseded

## Scenario 4: Idempotency

- Endpoint: `POST /api/ksync/run-scenario/idempotency`
- Input pattern: same payload and `sourceRequestId` submitted twice
- Expected outcome:
  - first request is accepted
  - second request is marked duplicate
  - duplicate path does not create new queue jobs

## Scenario 5: Failure And Retry

- Endpoint: `POST /api/ksync/run-scenario/failure-retry`
- Input pattern: first EKARMIKA write is intentionally failed once
- Expected outcome:
  - audit shows `WRITE_FAILED`
  - retry path emits `RETRY_SCHEDULED`
  - final write succeeds
  - no dead-letter record is created
