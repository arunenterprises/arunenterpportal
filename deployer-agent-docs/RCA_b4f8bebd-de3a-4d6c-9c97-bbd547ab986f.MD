# Production MongoDB Report — `fooding` / Weekly Fooding

Deployment: vendor-workflow-sys · DB: `vendor-workflow-sys-base` · Active run: b4f8bebd-de3a-4d6c-9c97-bbd547ab986f
Mode: READ-ONLY. No data modified, no deploy run.

## 1. `fooding` collection
**Total docs: 2** (both present, both `status=Approved`, both have `id`).

| # | id | refNo | month | year | status | createdAt | updatedAt | #lines | sum(lines.amount) |
|---|----|-------|-------|------|--------|-----------|-----------|--------|-------------------|
| 1 | WF-mv7r9ky6 | WF-202610-0IC | October | 2026 | Approved | 2026-10-14T06:55:22.446Z | 2026-10-14T08:59:03.319Z | 1 | 500 |
| 2 | WF-mv7xgmo8 | WF-202610-1L2 | October | 2026 | Approved | 2026-10-14T09:48:48.968Z | 2026-10-14T09:50:23.432Z | 1 | 500 |

- Duplicate `refNo`: **NONE** (WF-202610-0IC, WF-202610-1L2 are distinct).
- Duplicate `id`: **NONE** (WF-mv7r9ky6, WF-mv7xgmo8 are distinct).
- Docs missing `id`: **NONE** (both have `id`).

## 2. `payments` docs mentioning fooding
Filter: `$or` of case-insensitive regex `food` over `source`, `type`, `category`, `remarks`.
**Match count: 0.** No payment document references fooding in those fields. (Sampled `payments` docs use `source` values like "HR Pay Bill"; the collection has 12 docs per latest backup, none fooding-tagged.)

## 3. Latest `backups` doc (`collection_counts`)
Latest backup by `_id`: `6ad7d003132ab19d22eb3354`.
`collection_counts` = advance_requests:32, attendance:19, bills:11, boqs:6, counters:1, employees:9, exits:0, expenses:69, loans:0, paybills:2, payments:12, recruitments:6, settings:1, users:4, vendors:18, work_orders:6.
**`collection_counts.fooding`: ABSENT (no `fooding` key).**
Note: this latest backup's `_id` (6ad7d003…) is OLDER than both fooding docs' `_id`s (6ad8e973…, 6ad8e974…), i.e. the backup was taken BEFORE either fooding record was created — so the backup simply predates the fooding feature/data; it is not evidence of lost fooding records.

## Interpretation
The 2 Weekly Fooding records DO exist in production `fooding`, both Approved and well-formed (id, refNo, lines, amounts intact). There is no data-loss, no duplicate-key, and no missing-`id` issue in the stored data. Since the data is present but the user reports the Accounts > Weekly Fooding tab shows nothing, the most likely cause is on the read/display side (frontend tab query, filter, or API route) rather than the data layer — this needs a source-level check, not a DB fix.
