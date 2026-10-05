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

## Centralized Approval + Duplicate Prevention (Feb 2026 · Implemented)
- **Module-level Approve removed**: Reports.jsx Section D action bar "Approval" button converted to "📤 Submit to GM" (purple) — triggers Submit on Draft and shows info toast on Submitted. Direct approval only via GM Dashboard now.
- **Advance Request duplicate guard**: `upsertAdvanceRequest` in store.js blocks dup entry on same (empId + requestDate + amount) when amount > 0 and status !== Rejected. Throws + toasts "Duplicate · advance REF already exists for X on DATE with amount Y".
- **Vendor Voucher duplicate**: `generateVoucher` in Reports.jsx already blocks on `billId` match + fallback `vendorCode + billNo`. Error message now: "Duplicate · voucher REF already exists for this bill. Open existing voucher instead."
- **PayBill duplicate**: Already idempotent via `monthKey` check in `createPayBillDraft` (store.js line 1395) — if approved paybill exists for month+year, returns existing unchanged.

## Three Critical Updates (Feb 2026 · Preview Ready · NOT Published)

### 1. Project Management hidden from Home
- Removed `"project"` from the Home `ORDER` array so the card no longer renders. The route (`/project`) + full page layout stay intact for approval preview. Will be re-enabled once user approves.

### 2. Single-Session Enforcement + Session Tracking (Login Audit)
**Backend (`server.py`)** — new endpoints:
- `POST /api/auth/login` enhanced: on login, writes `current_session { active, login_at, ip, user_agent, location }` + `last_login_at` to the user doc. If an existing session is < 10 hours old AND active (and user is not SuperAdmin), returns `409` "Already logged in from <ip> at <timestamp>".
- `POST /api/auth/logout` — clears `current_session.active`.
- `GET /api/users/sessions` — returns all users with session info (Admin / SuperAdmin only).
- `POST /api/users/{email}/force_logout` — Admin can forcibly clear another user's session.
- `POST /api/attendance/punch` — only accepts between 09:10–09:30 IST, one entry per user per day.
- `GET /api/attendance/today` — my punch + all punches today.

**Frontend**:
- `api.js`: `apiLogout`, `apiListSessions`, `apiForceLogout`, `apiAttendancePunch`, `apiAttendanceToday`.
- `store.js`: `logout()` now fires `apiLogout` before clearing local token.
- `Login.jsx`: Handles `409` gracefully with ⚠ warning message.
- `UsersAdmin.jsx`: New **Active Sessions** section (Admin / SuperAdmin only) — shows every user's status (ONLINE / offline pill), name/email, role, designation, login time (UTC), IP, device/browser, with **Force Logout** action. Auto-refreshes every 15 s + on `ae-sync-done`.
- Removed non-working Logout button from UsersAdmin header (was no-op per user feedback).

### 3. Attendance Punch Widget (All Users · 09:10–09:30 IST)
- New `AttendancePunchWidget` on Home page, visible to every user, polls `/api/attendance/today` every 30 s + shows current IST, today's total punches, user's own punch status.
- When within window (09:10–09:30 IST) and user hasn't punched today → bright amber "👉 Punch In Now" button.
- When punched → turns green with ✓ and shows punch time IST.
- When outside window → slate grey "⏳ Window Closed".
- Server enforces one-per-day in `attendance_punches` collection.

### Pending user action
- Awaiting user go-ahead to deploy. All three features compile clean locally and backend restarted successfully.

## Real-Time Cross-User Sync — Full Coverage + Advance Approval Policy (Feb 2026 · Pending Deploy)

### Problem reported
SuperAdmin's actions were visible to all users, but Admin / regular users' actions didn't propagate real-time to SuperAdmin or each other. Advance Request approval was open to all approver roles instead of only the Accounts Manager designation.

### Real-time sync — Added `ae-sync-done` listener to all major pages
Previously only GeneralManager.jsx listened to the global 8-second sync pulse (dispatched from App.js). Other pages stayed stale between page mounts. Added listeners that bump the page's local refresh state:
- `Reports.jsx` → bumps `refresh`
- `VendorRegistration.jsx` → bumps `refresh`
- `BillProcessing.jsx` → bumps both `refresh` and `rev`
- `ExpenseProcess.jsx` → bumps `refresh`
- `PurchaseManagement.jsx` → calls `refresh()`
- `UsersAdmin.jsx` → re-runs `load()` + `loadNightly()`
- `Home.jsx` → bumps internal syncTick so badges update
- `HRManagement.jsx` (AdvanceRegisterTab) → calls `refresh()`

Impact: Any user's commit on device A appears on all other users' already-open pages within ~8s, no manual refresh needed.

### Advance Request approval → Accounts Manager designation only
- Added `isAccountsManager()` helper in `store.js` — checks `currentUserProfile().designation` for "Accounts Manager" (case-insensitive, hyphen/space variants). SuperAdmin always allowed as emergency override.
- `HRManagement.jsx` `AdvanceRegisterTab` now uses `isAccountsManager()` for `approveAllowed` instead of the generic prop. Admin/User no longer sees Approve/Reject buttons on Advance Requests unless their profile designation is Accounts Manager.
- No published yet · awaiting user go-ahead.

## Project Management Department (Feb 2026 · Layout Implemented)
- **New page**: `/app/frontend/src/pages/ProjectManagement.jsx` (~440 lines) — Project register with teal/emerald branding, grid + list views, 5 status types (Planning / In Progress / On Hold / Completed / Cancelled), 4 priority levels, filter chips with counts, KPI banner (Total / In Progress / Completed / Budget / Spent + Utilization %).
- **Project form**: Code auto-generated `PRJ/{YYYY}/{XXXX}`, fields for Name / Client / Site / Manager / Dates / Status / Priority / Progress / Budget / Spent / Description. Milestones sub-table (title / due date / done checkbox). Team sub-grid (name / role).
- **Routing**: `/project` route added in `App.js`.
- **Home.jsx**: New card inserted between "Reports & Vouchers" and "User Management" with FolderKanban icon + teal gradient. Visible to all roles (per-page RBAC gates write actions).
- **Local persistence** for now (`ae_vm_projects` localStorage key); cloud sync + approvals + document attachments to be wired next.
- **Real-time sync**: Page listens for `ae-sync-done` to auto-refresh.

## Real-Time Cross-User Sync + Admin User Management (Feb 2026 · Implemented)
### Real-time sync (every ~8s while tab visible)
- **App.js**: Added global `useEffect` with `setInterval(tick, 8000)` while `document.visibilityState === "visible"`. Calls `autoSyncFromCloud(5000)` and dispatches `ae-sync-done` custom event on successful snapshot pull. On tab focus → immediate catch-up sync. On tab hidden → polling paused.
- **GeneralManager.jsx**: Added `useEffect` listener for `ae-sync-done` that bumps the `tick` state — inboxes re-render automatically within 8s of another user's approve/reject/delete action.
- Impact: Admin on device A approves → User on device B sees change within 8s without manual refresh (vs manual refresh/log out+in before).

### Admin → User Management access
- **Home.jsx**: Admin role is now included in "users" card `roles` (`["SuperAdmin", "Admin"]`), so Admin sees User Management card on Home.
- **UsersAdmin.jsx**: Already permitted Admin login (line 98) — no backend change needed. Role change dropdown still SuperAdmin only (via `isSuperAdmin(me?.user)` check).

## Home Screen Flat Layout (Feb 2026 · Implemented)
- Reordered modules per user spec: **GM → HR → VENDOR → PURCHASE → ACCOUNTS → REPORTS & VOUCHERS → USER MANAGEMENT (SuperAdmin only)**
- Removed 3-tier hierarchy (Executive / Operating / System Admin) — now single flat `auto-fit minmax(240px, 1fr)` responsive grid where all cards sit in the specified order and wrap naturally on narrow screens.
- Banner updated: "Department Modules" with the module name trail in gold.
- SuperAdmin footer helper strip retained.

## Role Change Permission (Feb 2026 · Implemented)
- **Backend**: Added `PATCH /api/users/{email}/role` endpoint (`require_super_admin`). Accepts `{role: "User|Admin|Accounts|GM|HR|Viewer"}`. Resets permissions to new role defaults. Primary ADMIN_EMAIL locked.
- **Frontend `api.js`**: Exported `apiUpdateUserRole(email, role)`.
- **UsersAdmin.jsx**: Replaced static role pill with inline `<select>` dropdown (SuperAdmin only) for non-primary users. Confirms + calls API + reloads list on change. Non-SuperAdmin viewers still see the static pill.

## HRManagement UI Polish (Feb 2026)
- Advance Request section action toolbar moved from top header to bottom with navy gradient background + prominent gradient-colored buttons (New / Save / Edit / Submit to Accounts / Adjust in Pay Bill / Accounts Approve / Reject / Delete).
- Inner form action bar (duplicated buttons under form card) removed entirely — all actions now consolidated in the single bottom bar. Approved status pill + Reject reason inline input retained.

## Pending Requirements (Noted · Awaiting Specifics)

### Centralized Approval + Duplicate Prevention (Feb 2026 · user requested, note)
- **All approvals route only via GM Dashboard**: Currently approvals happen in both individual modules (Vendor/Bill/PayBill/Reports) AND GM Dashboard. User wants single entry point — GM Dashboard only. Individual module "Approve" buttons should be removed or converted to view-only for non-GM users; only GM/SuperAdmin can approve from the Dashboard.
- **No duplicate voucher creation**: Across PV/GPV/PN/Advance Pay/Bill/PayBill — one voucher per unique amount+entity. Attempting duplicate must raise toast "Duplicate error · voucher already exists" or "Not permitted".
- **Blocking questions**:
  - Dedup key: `vendorCode + amount` ya `vendorCode + billRefNo + amount` ya `vendorCode + billRefNo` (ignore amount)?
  - Same amount for different vendors allowed? (Expected: yes.)
  - For PayBill: dedup by `empId + month + year`?
  - For Advance: dedup by `empId + requestDate` or allow multiple on same day?
  - Approvals centralization: remove module-level Approve buttons entirely OR hide them except for GM role?

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
