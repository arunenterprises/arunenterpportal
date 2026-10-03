# Arun Enterprises — Vendor + HR Management System · PRD

## Architecture
- Backend: FastAPI + MongoDB. Frontend: React + Tailwind. Auth: JWT + per-user permissions.
- Email: Emergent Resend proxy (platform-managed, no Resend account required).
- Scheduler: Emergent platform crons via `.emergent/crons.yml`.
- Print: `@page size: A4` via `window.open` in `hrLetters.js`; PDF via `html2pdf.js`.

## Recent Updates (Feb 2026 session)
- **Nightly Backup Automation (Feb 2026)** — Daily 2 AM IST (`.emergent/crons.yml`) hits `POST /api/cron/nightly-backup` (bearer-auth with `WEBHOOK_CRON_SECRET`), generates full snapshot of 16 collections, stores in `backups` Mongo collection (last 7 retained), and emails SuperAdmin a summary via Emergent Resend proxy. UsersAdmin.jsx shows "Nightly Backups" list panel with Refresh / Run Backup Now / Download / Delete buttons.
- **Advance Receipt Printable (Feb 2026)** — `printAdvanceReceipt()` in `hrLetters.js` emits A4 Portrait receipt (header, employee details, amount in words, repayment mode, UTR, declaration, 3-signature block). "🧾 Receipt" button in HR Advance Request row appears next to UTR input once UTR is filled.
- **Pay Bill PDF Export (Feb 2026)** — `exportPayBillPDF()` uses `html2pdf.js` to download A4 landscape Pay Bill with all employee rows, totals, 4-signatory block. Wired as "⬇ PDF" button in HR Pay Bill history.
- **Backup & Restore System (Feb 2026)** — `GET /api/admin/backup` (full JSON of 16 collections including password hashes) + `POST /api/admin/restore` (upsert or wipe-and-replace mode). SuperAdmin-only. UsersAdmin.jsx "Backup & Restore" blue panel. `/app/MIGRATION_GUIDE.md` documents complete MongoDB Atlas migration.
- **Employee Advances · Status Badges Clickable (Feb 2026)** — ✓ Settled / ⚡ Auto-Adjusted / ⏳ In Pay Bill badges each open a modal showing per-line Source · RefNo · Month · Amount · Stage breakdown.
- **Repayment Mode Field (Feb 2026)** — Advance Request form now has Repayment Mode select (Salary Deduction / EMI / Cash / Bank Transfer) + EMI Months when applicable. Register table shows colored pill.
- **Advance UTR Inline Fill + Receipt (Feb 2026)** — Payment/UTR cell in advance request list is an inline input (auto-save on blur/Enter) once status ≥ 3; red→green visual flip; "🧾 Receipt" print button appears when filled.
- **Advance Register Double-Count Fix (Feb 2026)** — `getAdvanceRegister()` now subtracts `autoAdvance` from Pay Bill advance (manual portion only) + uses target month/year for On-Demand request so same amount is counted once.
- **HR Advance / Pay Bill Simple Delete (Feb 2026)** — Replaced SuperAdminDelete (UTR-locked) with canDelete-gated "Delete Pay Bills" / "Del + Voucher" buttons that also remove linked PV voucher from payments.
- **HR Pay Bills in Reports Approved Bills Sheet (Feb 2026)** — "All Approved Bills" dashboard in Reports now includes HR Pay Bills (step 3 or step 4 awaiting UTR) with orange styling, checkboxes, "HR · Awaiting Settlement" / "UTR Pending" status pills.
- **Advance Payment Vouchers moved to Employee Advances tab (Feb 2026)** — PV/ADV/* removed from main vouchers data sheet (vendorPayments filter) and shown in Employee Advances tab with simple delete button.
- **Reports Tab Merger · Payment Vouchers & Due List Preparation (Oct 2026)** — Full workflow (Summary Dashboard + Monthly Decision Sheet XLSX round-trip + Bulk/Single Bank Advice).
- **Bill Preview Modal + Click-to-View (Oct 2026)**.
- **Delete Function Lockdown · Admin/SuperAdmin Only (Oct 2026)** — `canDelete()` role-gate across all pages.

## Core Modules
- Vendor Registration · Master · Bills · Payment Vouchers · Payments
- Purchase Management (BOQ · Work Orders)
- Expense Process
- HR Management (Employees, Attendance, Pay Bills, Loans, Advance Requests, Recruitments, Exits)
- Reports (Payment Vouchers & Due List, Salary Bills, Employee Advances, Aging, GST-TDS)
- GM Dashboard
- Users Management (SuperAdmin: Backup, Restore, Nightly Backups, HR Reset, Full Reset)

## Key DB Schema
`users`, `employees`, `work_orders`, `vendors`, `bills`, `paybills`, `advances` → `advance_requests`, `loans`, `recruitments`, `exits`, `payments`, `attendance`, `expenses`, `boqs`, `counters`, `settings`, `backups`, `backup_runs`

## Key API Endpoints
### Backup / Restore (SuperAdmin only)
- `GET /api/admin/backup` — Full JSON snapshot
- `POST /api/admin/restore` — Upsert or wipe-and-replace
- `GET /api/admin/nightly-backups` — List last 7 nightly backups
- `GET /api/admin/nightly-backups/{id}/download` — Full JSON of a specific backup
- `DELETE /api/admin/nightly-backups/{id}` — Delete a specific backup
- `POST /api/admin/nightly-backups/trigger` — Manually run the nightly backup flow

### Cron (platform-authenticated)
- `POST /api/cron/nightly-backup` — Bearer: `WEBHOOK_CRON_SECRET` · scheduled 2 AM IST

### Resend Email (internal only, called from `_run_nightly_backup`)
Uses `_send_email()` with Emergent proxy at `https://integrations.emergentagent.com/api/v1/email/send`

## Env Variables (backend/.env)
- `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `JWT_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `LEGACY_ADMIN_EMAILS`
- `EMERGENT_EMAIL_KEY`, `EMAIL_FROM_NAME` (platform-managed Resend)
- `WEBHOOK_CRON_SECRET` (cron bearer)
- Optional: `EMAIL_REPLY_TO`

## Tech Stack
- Frontend: React, Tailwind, xlsx, html2pdf.js, sonner, lucide-react
- Backend: FastAPI, Motor (async Mongo), httpx (async HTTP), PyJWT, bcrypt

## Priorities / Roadmap

### P0 (next session)
- Automatic reversal of Pay Bill `autoAdvance` + `advance` column when linked advance request is deleted
- Advance Register Excel export with UTR column

### P1
- Advance ledger running balance (Opening · Granted · Recovered · Closing)
- Store.js refactor (currently 1800+ lines)
- Loan EMI Schedule Printable PDF

### P2
- Keyboard shortcuts (Ctrl+N for new advance / pay bill)
- Draft auto-save after 30s idle
- Bulk PDF export (multiple months → zip)
- HRManagement.jsx + Reports.jsx component modularization

## Documentation
- `/app/MIGRATION_GUIDE.md` — Backup / MongoDB Atlas migration / GitHub source backup walkthrough
- `/app/memory/test_credentials.md` — SuperAdmin login + cron secret

## Known Workflow Rules
- Advance Request flow is **3-step terminal**: Draft → Submitted to Accounts → Accounts Approved · Auto-adjusted in Pay Bill (status max 3, status 4 deprecated)
- Due List + Payment Vouchers merged into one tab with XLSX round-trip
- All deletes require `canDelete()` (Admin / SuperAdmin only)
- Nightly backups retain last 7, older auto-deleted
- Pay Bills + Advance delete auto-removes linked PV voucher to prevent duplicates
