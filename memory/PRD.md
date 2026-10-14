# PRD — Arun Enterprises ERP (Updated Feb 2026)

## Original Problem Statement
Multi-page ERP: Vendor / Bill / Expense / Purchase BOQ-WO / GM Approvals / HR Payroll / Users / Reports Hub. Cross-device data sync via FastAPI + MongoDB. Hindi/Hinglish UI.

## Owner / Personas
- **SuperAdmin:** `arunenterprises2023@gmail.com` — Ashish Srivastava — unrestricted.
- **Admin / GM / HR / Accounts / Purchase / User / Viewer** — role-gated with role-based defaults.

## Feb-2026 Session Changes (round 8 — Final Sign Panel Redesign + Clean Biodata)
- **Signature panel** across all Reports Hub prints is now dynamic **Created By · Prepared By · Checked By · Approved By** — each column filled from the record's own metadata (`createdByName`, `preparedByName`/`submittedByName`, `checkedByName`/`verifiedByName`/`settledByName`, `approvedByName`/`finalApprovedByName`/`gmApprovedByName`). Falls back to the printing user when a field is empty.
- **"Sr. Operation Manager" removed from ALL print surfaces** — bank advices, bulk NEFT advice, HR letters, Reports Hub signature panel. (Will be re-added ONLY to New Bill / New Vendor / New Purchase Order creation prints when those flows are built out separately.)
- **Default Print Mode** changed from "Summary + Full Biodata" (which showed each record TWICE) to **"Summary Only · 1 row per record"** — ek process = ek bar.
- **Weekly Fooding approver** now records the ACTUAL logged-in user (`currentUser()`) instead of hardcoded `APPROVER_NAME`. Komal's approvals will print under her own name.
- **Weekly Fooding print signature block** switched to the new 4-column pattern.
- **BillProcessing bulk NEFT advice** foot: 4-column pattern (Created / Prepared / Checked / Approved) replacing the old "Authorized Signatory · Ashish · Sr. Operation Manager".
- **bankTransfer.js** both NEFT advice blocks: 4-column pattern — no "Sr. Operation Manager" / Director references.
- **currentUser()** now returns a human DISPLAY NAME (profile.name → full_name → employee_id → Title-Cased email prefix → "Ashish Srivastava" for super admin). Prevents raw email appearing on signatures.
- **Biodata card** always hides image-type fields (`photoUrl`, `signatureUrl`, etc.) from the text grid — only populated images show in the dedicated "Photo & Signature" strip (prevents "Photo URL · —" placeholder rows).

## Feb-2026 Session Changes (round 7 — Komal Srivastava as Accounts Manager Approver)
- Added `ACCOUNTS_MANAGER_EMAILS` whitelist in `store.js` seeded with `komal.srivastava@arunenterprises.online`.
- `isAccountsManager()` now returns `true` for:
  1. SuperAdmin (always)
  2. Any user whose stored profile designation is "Accounts Manager" (case-insensitive)
  3. Any email in `ACCOUNTS_MANAGER_EMAILS` (whitelist)
- Downstream approvers that automatically got the new power via `isAccountsManager()`:
  - **Weekly Fooding Tab** (`WeeklyFoodingTab.jsx`) — Approve button
  - **HR Management · Advance Request approval** (`HRManagement.jsx` line 1778)

## Feb-2026 Session Changes (round 6 — Employee Photo & Signature as Images in Reports Hub)
- **Reports Hub · Employee Master** on-screen table now shows **Photo (40px)** and **Signature (28px contain)** as real `<img>` thumbnails, not raw data-URL text.
- Full Biodata print pages render a dedicated **"PHOTO & SIGNATURE"** strip above record details — displays each image at 85×100 (photo) / 150×60 (signature) with "Image not available" fallback.
- Compact biodata (2-per-page) also displays photo + signature as mini-tiles above the field grid.
- Summary table print renders `<img>` cells for image columns (never raw URL).
- Excel export writes `<attached>` placeholder for image columns to keep workbook size sane.
- Generic image detection: `isImageKey()` + `isImageValue()` so any field named `*photo*` / `*signature*` / `*avatar*` (or any `data:image/...` value) gets rendered as an image anywhere in Reports Hub.

## Feb-2026 Session Changes (round 5 — Duplicate Process Numbers Fixed)
- **CRITICAL BUG FIX**: Same PV/HR/... number was appearing 5× in Payment Vouchers register. Root cause: `advancePayBillStep` + `advanceExitStep` pushed a new PV every time step 4 transition fired (no idempotency check), and `payments.length+1` suffix produced different serials each push.
- **Fixes applied**:
  1. `advancePayBillStep` + `advanceExitStep` now check for existing PV (by `id` or `sourceRef`) before inserting — reuse existing PV number on repeat transitions.
  2. PV serial switched from `payments.length+1` to central `pvSerial` counter (`getCounters()`) to prevent collisions.
  3. `getPayments()` now returns de-duplicated list (collapses rows with same pvNo).
  4. **Universal de-dup migration `dedupeAllStores()`** — scans every major collection (payments, bills, vendors, expenses, BOQs, WOs, paybills, employees, advance-requests, loans) and keeps the first occurrence of each unique process number. Runs on Home mount + after every cross-user sync.
  5. Reports Hub `rawRows` performs defensive display-time de-dup as last line of defense.
- **ProjectManagement**: Removed duplicate `.module-dept-banner` row (ModuleHero already shows the dept header).

## Feb-2026 Session Changes (round 4 — Printable Designations & Bill Delete)
- **Printable Signatories (role-free policy):** ROLES (`SuperAdmin` / `Admin`) are no longer printed anywhere. Only DESIGNATIONS appear on paper.
  - **Ashish Srivastava** → `Sr. Operation Manager` (was `Director`) — SuperAdmin on-screen only.
  - **K L Srivastava** → `General Manager` (Admin role, on-screen only).
- Files updated: `hrLetters.js` (SIGNATORY designation + authority line), `bankTransfer.js` (both NEFT advice signatures now show K L Srivastava · GM + Ashish Srivastava · Sr. Operation Manager), `ReportsHub.jsx` (4-column signature panel: Prepared/Checked/GM/Sr. Operation Manager), `BillProcessing.jsx` bank-advice footer.
- **Bill Processing — Delete button** added to action row (`data-testid="bill-btn-delete"`). Rule: can delete own draft/submitted bills; approved bills (step=5) deletion restricted to SuperAdmin only. Confirmation + toast + state reset included.
- **Bill Processing — JMC & Abstract upload** section (3B) added between Invoice and Multi-Stage Approval. Max 500 KB each, PDF/Image, blue (JMC) + green (Abstract) themed upload tiles with download/remove parity.

## Feb-2026 Session Changes (round 3 — Reports Hub Full Biodata Print)
- **Reports Hub Print A4/PDF upgraded** with 4 print modes:
  1. **Summary + Full Biodata** (default) — Page 1 summary table (landscape), then one A4 portrait page per record with letterhead + all fields + line-items table + signatures.
  2. **Summary Only** — classic landscape register.
  3. **Full Biodata (1 per page)** — portrait, one record = one A4, with company letterhead on every page.
  4. **Compact (2 per page)** — portrait, 2 records per A4 with mini-biodata cards.
- Universal biodata builder dynamically introspects any record: pretty-labels camelCase keys, auto-detects amount/date fields, renders nested line-items (bills items, boq items, wo items, pay bill lines, fooding lines) as a bordered table with running totals.
- Print mode selector added next to Print/PDF/Excel buttons (`data-testid="rh-print-mode"`).

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
