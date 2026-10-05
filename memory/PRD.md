# Arun Enterprises — Vendor + HR Management System · PRD

## Architecture
- Backend: FastAPI + MongoDB. Frontend: React + Tailwind. Auth: JWT + per-user permissions.
- Email: Emergent Resend proxy (platform-managed).
- Scheduler: Emergent platform crons via `.emergent/crons.yml`.

## Bug Fixes (Feb 2026 · Latest)
- **Vendor Bank Details Not Fetching in Voucher**: `generateVoucher` in Reports.jsx was reading `vend.bankAccount` + `vend.ifsc`, but vendor master schema uses `accountNumber` + `ifscCode`. Fixed with fallback chain: `vend.accountNumber || vend.bankAccount` and `vend.ifscCode || vend.ifsc`. Missing-field warning updated too.
- **Edit Button Not Working**: Rewrote Edit action — now re-fetches latest vendor bank details on click, allows re-opening Approved vouchers (SuperAdmin/Admin with confirm → calls `reopenPayment`), scrolls to Amount field and focuses it, enables for both existing PV and newly selectable bills.

## Cross-Device Sync & GM Dashboard Overhaul (Feb 2026 · Critical)

### Zombie Resurrection Fix (Data Integrity)
- **Root cause**: Deleted payment vouchers were only filtered client-side. `/api/payments/bulk` is per-id upsert (no delete), so deleted records persisted in cloud and resurrected on every cross-device sync. Users reported "purana data wapas aa jata hai" after night deletes.
- **Backend**: Added `DELETE /api/payments/{pvNo:path}` + `POST /api/payments/delete_bulk` (both `require_admin`). Supports slashes in pvNo (GPV/.../... format).
- **Frontend `savePayments()` reconciliation**: Diffs previous vs new pvNo set, calls `apiDeletePaymentsBulk` for records that disappeared. Guarantees cloud removal on GPV→PN rename or any client-side filter.
- **New helper `deletePaymentCloud(pvNo)`**: Explicit single-voucher delete with backend DELETE + local filter + cloud reconcile. Used by Reports.jsx and GM dashboard.
- **New core deletes exported**: `deleteVendor`, `deleteBill`, `deleteExpense` in store.js (call corresponding backend DELETE endpoints).

### GM Dashboard Overhaul
- **Duplicate approvals fix**: Added `uniqById()` dedupe wrapper to all 11 collection reads in GM Dashboard. Prevents same approval showing multiple times from stale cross-device cache.
- **Reject button on every row** (all 11 inbox sections, both Pending + Approved tabs): Prompts for reason → sends record back to Draft/status=1 with `rejectReason`, `rejectedByName`, `rejectedAt` fields. Fully cloud-synced.
- **Delete button on every row** (all 11 sections, both tabs): Visible for all users (styled grey if role-locked), executes only for Admin/SuperAdmin per `canDelete()` gate. Calls cloud-reconciled delete so records never resurrect.
- **New action handlers**: 11 reject + 10 delete functions wired in GeneralManager.jsx, 1 missing (leave delete) by design.

### Payment Voucher Prefix Scheme (Feb 2026 · Implemented)
- **GPV/{FY}/{XXXX}** → draft on "Generate Voucher" (Generate Register)
- **PN/{FY}/{XXXX}** → auto-renamed on Approval (same serial retained; shown in Payments Register)
- **PV/...** → legacy records untouched for backward compatibility
- HR auto-vouchers: `GPV/HR-FNF/...` and `GPV/HR/...` on creation (Submitted) → `PN/HR-FNF/...` / `PN/HR/...` on Approval
- Helpers: `nextPvNo()` (store.js) returns GPV/..., `toApprovedPvNo()` converts GPV→PN
- HR source regex updated to `/^(PV|GPV|PN)\/(HR|ADV|HR-FNF)/i`

## Pending Requirements (Noted · Awaiting Specifics)
- **Payment Register Temp / Sr. No prefix separation** (Feb 2026 · user requested):
  Currently both Payment Register serial and Payment Voucher share the same `PV/{FY}/{0001}` series via `nextPvNo()` in `store.js:755`. User wants two independent counters/prefixes:
  - Payment Register (Temp / Sr. No) → separate prefix (e.g. `PR/{FY}/{0001}` — to be confirmed)
  - Payment Voucher → stays as `PV/{FY}/{0001}` (or new prefix if user prefers)
  Scope: new counter in `counters` collection, update register/voucher generation, keep migration safe for already-issued numbers. **Blocked on user confirming exact prefix strings and whether existing PV numbers need backfill.**

## Recent Updates (Feb 2026)

### Security Hardening Pass (Feb 2026)
- **SEC-001 fixed · Server-side RBAC on business mutations**: Added `require_write` + `require_approver` dependencies, `_can_create()` + `_can_approve()` helpers, and `_enforce_workflow()` that validates step/status transitions and strips 10 server-owned fields (approvedByName, approvedAt, submittedByName, etc.) from client input. Server stamps these from the authenticated user. Verified via curl: viewer with approve=false gets 403 on step 1→3 transition; SuperAdmin's `HACKER` spoof got overwritten with real name.
- **SEC-002 fixed · Payments protection**: `POST /api/payments/bulk` + `POST /api/snapshot` now require approver role, blanket `delete_many({})` replaced with per-id upsert so no logged-in user can wipe the ledger.
- **SEC-003 fixed · Secret rotation**: Rotated `JWT_SECRET` + `WEBHOOK_CRON_SECRET`. Old 30-day tokens invalidated — users must log in once. `test_credentials.md` no longer contains plaintext secrets.

### Nightly Backup Automation (Feb 2026)
- Daily 2 AM IST `.emergent/crons.yml` → `POST /api/cron/nightly-backup` (bearer-auth) → full 16-collection snapshot stored in `backups` Mongo collection (last 7 retained) + Resend email summary to SuperAdmin.

### HR + Reports (Feb 2026)
- Advance Receipt A4 printable (hrLetters.js `printAdvanceReceipt`)
- Pay Bill PDF export via html2pdf.js
- Advance Request toolbar: New / Save / Edit / Submit to Accounts / 📊 Adjust in Pay Bill / Delete
- Employee Advance Register double-count fixed (subtracts `autoAdvance` from Pay Bill advance)
- Repayment Mode select (Salary Deduction / EMI / Cash / Bank Transfer)
- Status Breakdown badges clickable with detail modal
- Simple delete (canDelete) replaces UTR-locked SuperAdminDelete; linked PV auto-cleanup
- Reports → Salary Bills tab: Approved HR Pay Bills Data Sheet with checkboxes, Download/Upload Decision XLSX, 1-Click Process, Bulk Excel, Bulk Bank Advice, Hold/Reject status pills

### Store.js Cross-Device Sync (Feb 2026)
- `advancePayBillStep` / `rejectAdvanceRequest` / `advanceLoanStep` now call backend API
- `_bg()` helper + `retryPendingSyncs()` queue + global Sonner toast on sync failure (App.js)
- `autoSyncFromCloud(10s throttle)` on HR page mount + focus + visibility change

## Core Modules
Vendor Registration · Bills · Payment Vouchers · Payments · BOQ · Work Orders · Expense Process · HR Management (Employees, Attendance, Pay Bills, Loans, Advance Requests, Recruitments, Exits) · Reports (Payment Vouchers & Due List, Salary Bills, Employee Advances, Aging, GST-TDS) · GM Dashboard · Users Management

## Key API Endpoints
### Backup / Restore (SuperAdmin only)
- `GET /api/admin/backup`, `POST /api/admin/restore`
- `GET/POST/DELETE /api/admin/nightly-backups[/trigger]`

### Cron
- `POST /api/cron/nightly-backup` (Bearer: `WEBHOOK_CRON_SECRET`)

### Business (RBAC)
- `/api/bills`, `/api/paybills`, `/api/advance_requests`, `/api/loans` — require_write + workflow validation on step/status transitions
- `/api/payments/bulk`, `/api/snapshot` POST — require_approver

## Env Variables (/app/backend/.env)
`MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `JWT_SECRET` (rotated), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `LEGACY_ADMIN_EMAILS`, `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME`, `WEBHOOK_CRON_SECRET` (rotated)

## Tech Stack
Frontend: React, Tailwind, xlsx, html2pdf.js, sonner, lucide-react
Backend: FastAPI, Motor, httpx, PyJWT, bcrypt

## Priorities / Roadmap

### P0 (next)
- Auto-reverse Pay Bill `advance+autoAdvance` on advance request delete
- HR Decision Audit History: log Hold/Reject actions in `pb.history`
- Clear Hold/Reject button (admin inline action)

### P1
- Login rate-limiting + stronger password policy (min 8, breakpoint on failures) · JWT revocation
- Advance Register Excel export with UTR + source + target month
- Store.js refactor (1800+ lines → modular)

### P2
- Combined Monthly Decision Report (Vendor + HR consolidated)
- Loan EMI Schedule Printable PDF
- Bulk PDF export (multiple months → zip)

## Documentation
- `/app/MIGRATION_GUIDE.md` — Backup / MongoDB Atlas / GitHub source backup
- `/app/memory/test_credentials.md` — login reference (no plaintext secrets)

## Known Workflow Rules
- Advance Request flow is 3-step terminal (max status 3 = Accounts Approved)
- Due List + Payment Vouchers merged tab with XLSX round-trip; Salary Bills has its own
- All deletes require `canDelete()` (Admin / SuperAdmin only); server verifies via require_admin dependencies on DELETE routes
- Pay Bills / Advance deletes also remove linked PV voucher to prevent duplicates
- Nightly backups retain last 7
- Business endpoint upserts: forward step/status transitions (step 1→2+ or status 1→2+) require approver role. Server stamps approvedByName / approvedAt / etc. — client values are ignored.
