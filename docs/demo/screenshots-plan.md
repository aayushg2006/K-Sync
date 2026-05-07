# Screenshots Plan

## Core Capture Set

- Dashboard overview with metrics cards visible
- System Health panel showing backend dependencies and mock systems
- Queue Status panel showing Redis-backed queues
- Business comparison page for `UBID-KA-2026-0001`
- Events page with a recently created canonical event
- Audit page filtered to a recent correlation ID
- Conflicts page showing the auto-resolved Scenario 3 record
- Demo Control page with one successful scenario result expanded

## Recommended Capture Order

1. Reset the demo data.
2. Capture the dashboard before running any scenario.
3. Run Scenario 1 and capture Events plus Business Sync.
4. Run Scenario 2 and capture the reverse-sync result.
5. Run Scenario 3 and capture Conflicts.
6. Run Scenario 5 and capture Audit or Queue Status.

## Quality Notes

- Keep the browser window wide enough to show navigation plus main content.
- Prefer seeded business `UBID-KA-2026-0001` because every scenario references it.
- Use the same backend dataset for all screenshots to keep labels and IDs consistent.
