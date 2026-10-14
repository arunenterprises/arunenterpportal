# PRD — Arun Enterprises ERP (Updated Feb 2026)

## Original Problem Statement
Multi-page ERP: Vendor / Bill / Expense / Purchase BOQ-WO / GM Approvals / HR Payroll / Users / Reports Hub. Cross-device data sync via FastAPI + MongoDB. Hindi/Hinglish UI.

## Owner / Personas
- **SuperAdmin:** `arunenterprises2023@gmail.com` — Ashish Srivastava — unrestricted.
- **Admin / GM / HR / Accounts / Purchase / User / Viewer** — role-gated with role-based defaults.

## Feb-2026 Session Changes (round 2)
1. ✅ **Reports Hub** (`/reports-hub`) · 12 department tabs + Weekly Fooding · FY/Month/Date filters · Print/PDF/Excel.
2. ✅ **Financial Year** card in `/users` admin page · SuperAdmin/Admin only · cloud synced.
3. ✅ **Company Master** card in `/users` · SuperAdmin only · dynamic letterhead/PV footer.
4. ✅ **Weekly Fooding** tab in Accounts dept with Submit → Accounts Manager Approve flow (not GM).
5. ✅ **Lookup / Auto-Load** feature on EMP code, BOQ no, WO no, Permanent Bill no — type + enter / 🔍 button.
6. ✅ **Module Hero** gradient banner (HR style) on every module (Vendor, Bill, Expense, Purchase, Project, Reports, Admin, Reports Hub, HR).
7. ✅ **Letterhead hidden on screen** · visible only in A4 portrait print.
8. ✅ **Dept-banner removed from GM** (duplicate with HeroHeader).
9. ✅ **Home sidebar overhaul** · Admin tile renamed from "User Management" → "Administrator" · subtitle/badges removed · "ERP · Workspace" centered.
10. ✅ **"K L Srivastava" → "Ashish Srivastava"** everywhere · "·V1" / "Razorpay IFSC" tags removed.
11. ✅ **Advance duplicate rule** — same empId + requestDate + amount triplet blocked.
12. ✅ **UTR save buttons** — "Save UTR" (HR Pay Bill rows) · "✓ Paid" (Reports PV action bar).
13. ✅ **Cross-user data visibility — ROOT CAUSE FIX (round 2 + 3):**
    - **Round 1 (backend):** `_can_create` role-based default; `/payments/bulk` + `/snapshot POST` use `require_write` (any writer, not approver).
    - **Round 2 (frontend):** every `save*` list-level mutator (saveVendors, saveBills, saveEmployees, saveBOQs, saveWOs, saveExpenses, savePayBills, saveLoans, saveAdvanceRequests, saveRecruitments, saveExits) now fires `_schedulePush()` → debounced 1.5s → `apiPushSnapshot` → cloud. Previously these were localStorage-only → non-SuperAdmin bulk mutations never left the device.
    - **Round 3 (backend gap):** `/snapshot POST` handler now also upserts `employees`, `boqs`, `work_orders`, `attendance` collections — previously silently dropped.
14. ✅ **Admin role elevated** — `apiUpdateUserRole` + `apiUpdateUserPermissions` endpoints switched from `require_super_admin` → `require_admin`. SuperAdmin ne jisko bhi "Admin" role diya hai woh ab user naam / role / permissions bhi update kar sakta hai (SuperAdmin ki tarah).
15. ✅ **AttendancePunchBar removed** — line 694 of HRManagement (user reported "function kaam nahi kar raha hai").

## Code Architecture
```
/app/
├── backend/
│   ├── server.py — RBAC + Snapshot push (full-collection upsert) + Company/FY settings
│   └── tests/backend_test.py — 20 pytest cases including round-2 cross-user tests
├── .emergent/crons.yml — Nightly backup 2 AM IST
└── frontend/src/
    ├── App.js — 8s autoSyncFromCloud polling
    ├── lib/
    │   ├── store.js — _schedulePush debounced snapshot push (NEW), FY/Company helpers
    │   └── api.js — apiGetActiveFY/Set, apiGetCompany/Set
    ├── components/
    │   ├── ModuleHero.jsx — Reusable gradient hero
    │   ├── Header.jsx — Dynamic letterhead reads getCompany()
    │   └── WeeklyFoodingTab.jsx — Submit → AM Approve flow
    └── pages/
        ├── Home.jsx — Centered sidebar · dept list only · Administrator tile
        ├── ReportsHub.jsx — 12 dept configs including Fooding
        ├── UsersAdmin.jsx — FinancialYearCard + CompanyMasterCard + user mgmt (Admin can now edit)
        ├── HRManagement.jsx — Lookup EMP, no AttendancePunchBar
        ├── PurchaseManagement.jsx — Lookup BOQ + WO
        ├── BillProcessing.jsx — Lookup Bill No + Weekly Fooding tab + V1 removed
        └── ReportsHub.jsx, Reports.jsx — Vouchers · Paid btn
```

## Pending / Future
- P2 — Mini KPI dashboard inside each dept page (user ask pending — a/b/c option)
- P2 — Project Management backend wiring
- P2 — Loan EMI PDF schedule
- P2 — Store.js / HRManagement.jsx / Reports.jsx refactor (file size)

## Credentials
See `/app/memory/test_credentials.md`.
