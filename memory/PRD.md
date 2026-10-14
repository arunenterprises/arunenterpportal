# PRD — Arun Enterprises ERP (Updated Feb 2026)

## Original Problem Statement
Multi-page ERP for Vendor Management, Bill Processing, Expense Management, Purchase (BOQ/WO), General Manager approvals, HR Management (Attendance, Payroll, Advances, Loans, Exit F&F), User Management, Reports/Vouchers, and now a Reports Hub. Cross-device data synchronization via FastAPI + MongoDB cloud backend. Hindi/Hinglish UI friendly, Indian company context.

## User Personas
- **SuperAdmin (owner)** — arunenterprises2023@gmail.com — Ashish Srivastava — unrestricted access, FY admin, backup/restore, user management, final approver.
- **Admin / GM / Accounts / Purchase / HR / User** — role-gated access to respective modules; approvals routed to GM/Accounts/Admin per module.
- **Viewer** — read-only.

## Core Requirements (Current State · Feb 2026)
1. **Vendor Register, Bill Processing, Expense Register, BOQ/WO Purchase, HR (Payroll + Advances + Loans + Exits + Recruitment), Payment Vouchers** — all live with 3-step workflows (Draft → Submitted → Approved).
2. **Cross-user real-time sync** via 8-second polling + ae-sync-done event; backend MongoDB authoritative.
3. **Single-session enforcement** per user with Active Sessions audit log + Force Logout for admins.
4. **Attendance Punch** restricted to 09:10-09:30 IST, moved into HR → Attendance tab.
5. **Advance → Pay Bill auto-adjustment** flow (HR → Accounts Approve → Pay Bill advance column auto-populated).
6. **GM Dashboard** as centralized approval hub for all 11 module sections.

## Feb-2026 Session Changes (user asks)
1. ✅ **Reports Hub (NEW)** at `/reports-hub` — 12 department tabs, filters (FY/Month/Date range/Status/Search), Print A4, PDF, Excel. Dashboard tile with NEW badge, in sidebar order.
2. ✅ **Financial Year selection** card in `/users` (SuperAdmin/Admin only). Sets active FY via `POST /api/settings/fy`; synced via snapshot. Overrides getFY/getFYHyphen for all new code generation.
3. ✅ **Cross-user data visibility BUG fix** — root cause: backend `_can_create` required explicit permissions map; non-SuperAdmin users without perms got 403 on every write endpoint; saves failed silently. Fix: `_can_create` now defaults to true for all roles except Viewer; `/payments/bulk` + `/snapshot POST` changed from `require_approver` → `require_write`.
4. ✅ **Rename** "Reports & Vouchers" → "Vouchers" in Home sidebar card.
5. ✅ **Rename** SuperAdmin display name `K L Srivastava` → `Ashish Srivastava` (store.js APPROVER_NAME, backend .env ADMIN_NAME, HomeNavBar override, hrLetters.js SIGNATORY, BillProcessing print footer).
6. ✅ **Advance Register duplicate rule** restored: block only when `(empId + requestDate + amount)` triplet already exists; different date OR different amount is allowed. Error surfaced via toast.
7. ✅ **Save UTR button** in HR Pay Bill rows (UtrSaveInput component).
8. ✅ **Previous Month Ref** strip + Prev NET column in Pay Bill editor.
9. ✅ **Paid button** in Reports.jsx bottom action bar (saves UTR + stamps paidAt).
10. ✅ **HomeNavBar display name** override for SuperAdmin → "Ashish Srivastava".

## Code Architecture
```
/app/
├── backend/
│   ├── server.py          · RBAC, Auth, Session tracking, FY settings endpoints
│   └── tests/backend_test.py
├── .emergent/crons.yml    · Nightly backup at 2 AM IST
└── frontend/src/
    ├── App.js             · Global 8s sync polling
    ├── lib/
    │   ├── store.js       · 1960+ lines — getFY (with override), FY helpers, API wrappers
    │   └── api.js         · apiGetActiveFY, apiSetActiveFY added
    └── pages/
        ├── Home.jsx       · Left sidebar + Reports Hub tile
        ├── ReportsHub.jsx · NEW 520 lines — 12 dept tabs + filters + exports
        ├── UsersAdmin.jsx · FinancialYearCard added
        ├── HRManagement.jsx · Advance duplicate guard; UtrSaveInput; Prev Month Ref
        ├── Reports.jsx    · ✓ Paid button in bottom actions
        ├── BillProcessing.jsx · Signatory updated
        └── ProjectManagement.jsx · (draft layout)
```

## Pending / Future
- P2 — Project Management backend wiring (currently local mocking).
- P2 — Loan EMI schedule printable PDF.
- P2 — Refactor store.js (>1900 lines), HRManagement.jsx (>2800 lines), Reports.jsx (>2100 lines).
- P3 — Fix minor React warnings in ReportsHub (`<span>` in `<option>` hydration; duplicate key in a map).

## Credentials
See `/app/memory/test_credentials.md`.
