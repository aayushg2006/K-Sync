# Demo Script

## Demo Goal

Show that K-Sync can propagate changes both ways between SWS and department systems, detect conflicts deterministically, reject duplicate writes, and survive a controlled downstream failure with retry.

## Suggested 6-8 Minute Flow

1. Open the frontend dashboard and mention that the backend is exposed through the Cloud Run URL configured in `frontend/.env`.
2. Open the Demo Control page and run `Reset Demo` to restore deterministic seed data.
3. Run Scenario 1 and explain that an SWS registered-address change is translated and pushed to both mock departments.
4. Open Events or Business Sync to confirm the propagated values on the target systems.
5. Run Scenario 2 and explain that a direct e-Surakshate manager change is detected by polling and synced back into SWS.
6. Run Scenario 3 and show that competing address updates create a conflict that is auto-resolved in favor of SWS using the authority matrix.
7. Run Scenario 4 and highlight that the second submission is flagged as a duplicate and does not create duplicate queue work.
8. Run Scenario 5 and show the audit trail for `WRITE_FAILED`, `RETRY_SCHEDULED`, and `WRITE_SUCCEEDED` without creating a dead-letter entry.
9. End on the Audit or Queue Status page to reinforce traceability and operational visibility.

## Talking Points

- Zero-touch integration: no source-system code changes are required.
- UBID is the common join key across systems.
- Translation is deterministic and auditable.
- Conflict handling is rule-driven, not ad hoc.
- Queue-backed retries make the pipeline resilient to transient failures.
