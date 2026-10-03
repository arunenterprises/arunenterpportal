# Arun Enterprises — Vendor + HR Management System · PRD

## Architecture
- Backend: FastAPI + MongoDB. Frontend: React + Tailwind. Auth: JWT + per-user permissions.
- Print: `@page size: A4` with per-doc overrides via `window.open` in `hrLetters.js`.

## Recent Updates (Feb 2026 session)
- **Summary Dashboard · Approved Bills Data Sheet with multi-select (Oct 2026)** — Reports → Due List ke Summary Dashboard section me ab saari unpaid approved bills ki scrollable table + per-row checkboxes aur header "Select All" checkbox. Live counter: `SELECTED: n · ₹ amount`. Bulk action bar: **✓ Mark Selected PAY**, **⏸ Mark HOLD**, **✗ Mark REJECT**, **↺ Clear** — Admin/Accounts only. Rows highlight by decision colour (green/amber/red) + selection blue. Decision pill + Status pill per row.
- **Monthly Decision Sheet workflow (Oct 2026)** — Month selector drives Due List (Vendor Bills + Pay Bills consolidated) → **⬇ Download Decision XLSX** → fill offline → **⬆ Upload Decision XLSX** → **💼 Process → Single PVs** or **🖨 Print → Bulk Bank Advice**. Supports partial Pay Amount + Hold Reason per bill.
- **Monthly Payroll Summary** moved Home → HRManagement.
- **Advance Request 3-step terminal flow with targetMonth/targetYear → auto-adjust in Pay Bill advance column.**
- **`printBulkBankAdvice` (bankTransfer.js)** — New helper emitting A4-landscape consolidated vendor bank advice (Sr · Ref · Bill · Party · Code · Bank/Branch · A/C · IFSC · Amount) with totals + amount in words.
- **Monthly Payroll Summary** moved from Home to HRManagement (jahan ka data hai wahi).
- **Advance Request Workflow Simplified · 3-step terminal flow with targetMonth/targetYear + auto-adjust in Pay Bill advance column.**
- **HR Pay Bill History · Inline UTR Entry (Oct 2026)** — HR → Pay Bill tab ki history me ab UTR directly enter kar sakte hain (Admin/Accounts only). Input field pe focus loose hone pe ya Enter dabane pe auto-saves to linked PV. Already-entered UTR edit kar sakte hain via ✎ button.
- **Advance Request Workflow Simplified (Oct 2026)** — 3-step terminal flow with targetMonth/targetYear. Pay Bill `createPayBillDraft` auto-fills `advance` column from Accounts-approved advance requests matching empId + target month.
- **Backend · Scoped HR Reset + Delete Lockdown + UTR-aware SuperAdmin override** (Oct 2026 — detailed in earlier entries).
  - Status 1 Draft → Status 2 Submitted to Accounts → **Status 3 Accounts Approved · Auto-adjusted in Pay Bill** (TERMINAL)
  - Added `targetMonth` + `targetYear` fields on the request so Accounts-approved advances auto-populate in the correct month's Pay Bill `advance` column.
  - `advanceAdvanceRequestStep` capped at status 3; the deprecated status-4 PV generation is gone. BillProcessing AccountsAdvanceView shows "✓ Auto-adjusted in {Month}" tag instead of "Generate PV & Pay" button.
- **Pay Bill Advance Auto-Fill from Approved Advance Requests (Oct 2026)** — `createPayBillDraft(year, month)` now sums all Accounts-approved advance requests (status=3) matching `empId + targetYear + targetMonth` and pre-populates each line's `advance` column. Admin can still manually override; the auto-calculated amount is stored in `line.autoAdvance` for reference.
- **Backend · Scoped HR Reset Endpoint (Oct 2026)** — New `POST /api/admin/reset-hr-financials` (SuperAdmin only). Wipes ONLY `paybills` + `advance_requests` collections + HR-sourced payment vouchers (`PV/HR/*`, `PV/ADV/*`, `PV/HR-FNF/*`). Preserves employees, leaves, loans, recruitments, exits, vendors, vendor bills, vendor PVs.
- **UsersAdmin → "Reset HR Pay Bills + Advances" button (Oct 2026)** — New amber scoped reset panel visible only to SuperAdmin. Calls `resetHrFinancials()` which clears both local storage (paybills, advance_requests, HR PVs) AND the backend. Separate from the existing full "Reset All Data" danger-zone form.
- **Delete Function Lockdown · Admin / SuperAdmin Only (Oct 2026)** — Added `canDelete()` role-gate; all persistent record deletes across HR, Purchase, and Reports now Admin/SuperAdmin only. SuperAdmin 👑 Delete override is additionally UTR-aware — blocked with `🔒 Locked` label until linked PV has UTR entered.
- **Payment Process in Reports → Salary Bills (Oct 2026)** — Settled pay bill rows expose inline Bank Advice print, Excel export, and live-editable UTR field (auto-saves on blur).
  - HRManagement.jsx: Employee, Leave, Recruitment (header + row), Exit row, Pay Bill draft, Advance draft/row, Loan — all gated.
  - PurchaseManagement.jsx: BOQ (header + list) and WO (header + list) delete buttons — unified via `canDelete()`, approved-step DANGER confirm retained.
  - Reports.jsx: Non-approved Payment Voucher Delete buttons (3 locations) now gated to `canDelete()`.
  - Form-row removals (editable table line items) are intentionally NOT gated — those are data-entry UX, not persistent record deletions.
- **UTR-Pending Lock on SuperAdmin Delete (Oct 2026)** — The reusable `SuperAdminDelete.jsx` component now accepts a `blockReason` prop. If a settled Pay Bill / paid Advance Request / F&F settlement's linked Payment Voucher does not yet have `utrNo`, the override Delete button renders as `🔒 Locked` (disabled + toast error on click). This prevents accidental deletion of settled records before the actual bank transfer UTR is recorded. Wired in: HR Pay Bill history row, HR Advance Request list, HR Exit row, BillProcessing Accounts Pay Bills / Advance / Exit settled sections, Reports Salary Bills + PV lists.
- **Payment Process in Reports → Salary Bills (Oct 2026)** — When Pay Bill reaches step 4, the Accounts Action cell now exposes the full payment process inline: `✓ PV: PV/HR/...` badge · `⬇ Excel` Bank Transfer sheet · `🖨 Bank Advice` A4-landscape bank advice (addressed to Branch Manager) · live-editable `UTR / Ref No` input (green when filled, red when pending, auto-saves on blur / Enter via `savePayments`). Status badge "⚠ UTR PENDING" shown until UTR entered.
- **HR Pay Bill History — Payment / UTR column + Bank Advice buttons (Oct 2026)** — Added "Payment / UTR" column in HR → Pay Bill → History table with badge: `⚠ AWAITING UTR` (red row + badge) vs `✓ UTR xxxx` (green). Also added `⬇ Excel` + `🖨 Bank Advice` buttons for GM-approved / Settled pay bills so HR can share bank advice directly without jumping to Accounts.
- **Window focus / visibility auto-refresh (Oct 2026)** — `PayBillTab` and `AdvanceRegisterTab` now listen to `window.focus` + `document.visibilitychange` to re-pull `getPayBills()` / `getAdvanceRequests()` / `getPayments()` when user returns from another tab or background — eliminates stale state after Accounts settlement.
- **Shared Bank Transfer utility (Oct 2026)** — Extracted `exportBankTransferXLSX` + `printBankTransferAdvice` from `BillProcessing.jsx` into new `/app/frontend/src/lib/bankTransfer.js` so both HR, Accounts, and Reports can share the same logic.
- **Agentic Edits (Oct 2026 — Current Session)**:
  - *HRManagement.jsx Payroll Slip tab*: Removed `💬 Send on WhatsApp` button + its `sendPayslipWhatsApp` import (unused). Remaining buttons `Print A4 Slip` + `📥 Pick from Approved Pay Bill` now aligned to **uniform size** (`minWidth: 220px`, same padding `8px 14px`, same font 12px, inline-flex center with 6px gap).
  - *BillProcessing.jsx — Accounts · Pay Bills Process view*: Fixed "Total Pay Bills" KPI card which previously only showed a count but no underlying data. KPI is now **clickable** (toggle `▼ VIEW` / `▲ HIDE`) and expands an **"All Pay Bills · Complete List"** section displaying every pay bill across all statuses (Draft/Submitted/GM-Approved/Settled) sorted by step desc with Ref No, Period, Employees, Gross, Deductions, Advance, Net Payable, Status + Linked PV. `KpiBox` component extended with optional `onClick` + `active` props and hover styling.
- **SuperAdmin-Only Delete Buttons across all approval records (NEW)** — Naya reusable `SuperAdminDelete.jsx` component (`/app/frontend/src/components/`) jo currentRole()==="SuperAdmin" check karta hai + detailed confirmation popup + localStorage audit log + onDelete callback. Wired in across:
  - **HRManagement.jsx**: Recruitment list (status ≥3) → `ae_vm_rec_delete_log`, Exit F&F list (status ≥3) → `ae_vm_exit_delete_log`, Advance Request list (status ≥3) → `ae_vm_adv_req_delete_log`, Pay Bill history (status ≥2, already present) → `ae_vm_pb_delete_log`
  - **BillProcessing.jsx (Accounts tabs)**: Advance "Paid" queue, Pay Bill "Settled" queue, Exit "Settled" queue — all with inline SA delete button
  - **Reports.jsx**: Salary Bills tab (step ≥3 SA delete already) + Payment Vouchers list (Approved PVs replace plain Delete with `SuperAdminDelete`; Draft/Submitted PVs still deletable by anyone with permission)
- All deletions log `{label, meta, deletedBy, deletedAt}` for audit. Linked Payment Vouchers remain in Payments after record delete (financial record safety).
- **Pay Bill · Bank Transfer Export** — In Accounts Dept → Pay Bills Process → Settled queue, har row par 2 export buttons:
  - **⬇ Excel**: Downloads `BankTransfer_{refNo}_{Month}{Year}.xlsx` with columns [Sr., EMP Code, Name, Designation, Dept, Bank Name, Branch, A/C No, IFSC, A/C Type, Net Amount] + total row. Header merged with company+pay-bill meta.
  - **🖨 Bank Advice**: A4 landscape printable advice addressed "To: The Branch Manager" with full transfer table, grand total, amount-in-words, instructions, and 3 signature boxes (HR / Accounts / Authorized Signatory). Opens in new window with auto-print.
  - Excluded (unticked) rows automatically skipped. Only employees with Net > 0 included.
- **Security Patch · RBAC** — All DELETE routes now gated to `require_admin` (not just `get_current_user`): `/vendors`, `/bills`, `/employees`, `/expenses`, `/boqs`, `/work_orders`, `/paybills`, `/loans`, `/advance_requests`, `/recruitments`, `/exits`. Only Admin-role users can delete business data. Verified: unauthed=401, user=403, admin=200. `JWT_SECRET` + `ADMIN_PASSWORD` already load from env with no defaults (fail-fast on missing).
- **Pay Bill Bulk Approve (NEW)** — `AccountsPayBillView` ab checkbox selection support karta hai har `PayBillSection` queue mein: "Select All" master + per-row checkbox. Jab 1+ rows selected hon, floating bulk action bar dikhta hai with: `GM Approve Selected (N)` for submitted + `Settle Selected (N)` for approved. Each bulk action iterates and calls `advancePayBillStep` serially — auto PV generation per bill.
- **Careers / Advertisement Portal (NEW)** — Public no-auth page at `/careers` (+ `/jobs` redirect) listing all GM-approved (status 3-4) recruitment requisitions. Beautiful card-based layout with: position, dept, vacancies, qualification/experience/CTC grid, "Apply via Email" button that opens pre-filled mailto. Backend endpoint `GET /api/public/recruitments` filters status ≥3 and skips joined/closed, exposing only public-safe fields. "🔗 Copy Careers Portal Link" button added in RecruitTab (status ≥3) for sharing.
- **Backend DB Sync for HR Financials** — Added 5 MongoDB collections with REST endpoints: `paybills`, `loans`, `advance_requests`, `recruitments`, `exits`. Extended `GET /api/snapshot` + `POST /api/snapshot` to include all 5. All HR CRUD functions in `store.js` (`upsertPayBill`, `upsertLoan`, `upsertAdvanceRequest`, `upsertRecruit`, `upsertExit` + their delete counterparts) now fire-and-forget sync to cloud via new `apiUpsertXxx`/`apiDeleteXxx` helpers in `api.js`. Login triggers full snapshot fetch so a device gets latest state from any other device.
- **Pay Bill Employee Selection (NEW)** — `PayBillTab` adds a mode toggle: **All Employees** (default — every finalized active employee) vs **Selective** (all deselected on draft create, user ticks who to include). Checkbox column added to table header + each row with "Select All" master checkbox. Excluded rows render grey/50% opacity and are **skipped from totals calculation** in `upsertPayBill` (new `active = lines.filter(l => !l.excluded)` filter). Store now tracks `includedCount` + `selectionMode` on pay bill doc.
- **Advertisement/Vacancy Notice Print (NEW)** — `printAdvertisementNotice(r)` in `hrLetters.js` opens A4 portrait notice with: letterhead, red "ADVERTISEMENT · VACANCY NOTICE" banner, Advertisement No ref row, position/vacancy highlights, qualification/experience/CTC grid, "How to Apply" box (email + subject format + toll free), signatory block, and a diagonal "APPROVED" watermark (only shown when status ≥ 3 GM-approved). Buttons wired: "Print Advertisement" in RecruitTab main action bar + "📢 Ad" quick button in each row.
- **Header cleanup** — Removed `GSTIN` and `PAN` pills from `Header.jsx` top-row. Mobile now labelled "**Toll Free:** 9429694552".
- **Payslip System-Generated Note** — Payroll Slip tab now shows a yellow dashed "⚙️ This is a System-Generated Payslip · Signature Not Required" banner instead of plain-grey text.
- **Recruitment Requisition Workflow (NEW)** — `RecruitTab` revamped from candidate-tracker to full requisition flow: Draft → Save → Edit → Submit to GM → GM Approve (auto-generates `ADV{NNNN}-{FY}` Advertisement No + fills `gmApprovedAt` date) → Offered → Joined. Added fields: `requisitionDate`, `vacancies`, `experienceRequired`, `qualificationRequired`, `budgetCTC`, `reasonForHire`, `targetJoinDate`. Candidate details section unlocks only after GM approval. Reject with reason supported. Store: new `advanceRecruitStep` + `rejectRecruit` + `nextAdvertisementNo` (counter `adsSerial`). Deletion blocked after GM approval.
- **ID Card Company Contact** — COMPANY now includes `email: info@arunenterprises.online` and `mobile: 9429694552`. Back of ID Card (both HTML print template + live preview) shows company email + company mobile + company landline (removed per-employee email). Emergency fallback updated to `9429694552`.
- **Accounts Department · Top Switcher (NEW)** — `BillProcessing.jsx` ab 4 top tabs serve karta hai: [Vendor Bills] · [Advance Reg.] · [Pay Bills Process] · [Exit & F&F]. Each HR-sourced tab shows pending/approved/paid queues with role-gated Approve/Settle/Reject actions. Auto PV generation on settle:
  - Advance Reg: Status 2 (Submitted) → Accounts Approve → Status 3 → Generate PV & Pay → Status 4 (`PV/ADV/{FY}/N`)
  - Pay Bills: Status 2 (Submitted to GM) → GM Approve → Status 3 → Settle → Status 4 (`PV/HR/{Y-M}/N`)
  - Exit & F&F: Status 3 (GM Approved · Pending Accounts) → Settle → Status 4 (`PV/HR-FNF/{Y}/N`)
- **Login/Logout full-page splash** — `AuthSplash.jsx` component renders a colorful gradient overlay with floating emoji particles, animated gradient title + progress bar. Login shows "Welcome to ARUN ENTERPRISES ERP, {name}" for ~2.2s then navigates to /home; Logout shows "BYE-BYE, {name}" for ~1.8s then clears auth + navigates to /login. Rendered via `createPortal(document.body)` so it covers any page. Wired into: `Login.jsx`, `HomeNavBar.jsx`, `TopNav.jsx`, `TopActionBar.jsx`, `UsersAdmin.jsx`.
- **BillProcessing switcher tabs** — 3-way top switcher (`activeView` state): [Vendor Bills] | [HR Payroll] | [Employee Advance]. Only one view renders at a time (true React conditional, not display:none). Scrolls to top on tab click. Tested E2E — 100% pass (iteration_25.json).
- **Header formTitle** on Bill Processing simplified to just "ACCOUNTS DEPARTMENT".
- **Vendor Portal (critical fix)** — Previously `VendorPortalWO.jsx` read WO from device-local `getWOs()` so shared link showed empty on any other browser/device. NOW:
  - New public backend endpoint `GET /api/public/work_orders/{wo_id}` — returns WO (with vendor snapshot) only if `vendorPortalPublished=true`, no auth required.
  - `VendorPortalWO.jsx` fetches from backend via REACT_APP_BACKEND_URL + public endpoint.
  - Publish button in PurchaseManagement now `await apiUpsertWO(updated)` before copying the share link, ensuring the vendor can see the latest WO on any device.
  - Share URL points to `https://vendor-portal-458.emergent.host/vendor-portal/wo/{id}` (user-specified live domain).
- **Reports.jsx bug fix** — PV breakup `pv.basic.toFixed()` crashed for HR-auto-generated PVs (which only have `amount`). Now defaults missing fields to 0 safely.

## Home — Organisation Structure (3-Tier · Full Width)
1. **Centered Letterhead** (company logo + branding, bordered card)
2. **"ORGANISATION STRUCTURE" banner** (gradient blue→purple→pink background)
3. **Tier 1 (Executive · Approval Authority)**: General Manager card centered with pending badge
4. **Tier 2 (Operating Departments)**: Vendor · Purchase · Accounts · HR · Reports — 5-col with name labels + live headcount on HR
5. **Tier 3 (SuperAdmin only)**: User Management
- Gradient connectors between tiers with 5-vertical-stub drop-downs

## GM Dashboard
- **11 KPI cards** incl. HR Pay Bills + Live HR headcount
- 6 DeptGroups in pending inbox: Vendor · Purchase · Accounts · Expenses · Vouchers · HR (5 sub-sections)

## HR Management (11 tabs)
Dashboard · Employees · Attendance · Leaves · Payroll Slip · Pay Bill · **Advance Register** · **Loan Mgmt.** · Compliance · Recruitment · Exit & F&F

### Monthly Pay Bill
- Month/Year picker + Auto-compute from Attendance for finalized employees
- Editable Advance + Other Deductions · Live NET recalc · Grand totals
- 4-step workflow: Draft → Submitted to GM → GM Approved → **Settled** (auto-creates Payment Voucher)
- Print A4 Landscape with 4-signature block

### Advance Register + On-Demand Advance Request (Feb 2026)
- **Advance Request flow (NEW)**: HR creates request (employee / date / amount / reason / repayment mode: Lumpsum or EMI) → Submit to Accounts → Accounts Approve → Generate PV & Pay (auto-creates `PV/ADV/{FY}/N` in Payment Vouchers). Reject with reason supported at both approve stages.
- Status: 1 Draft · 2 Submitted to Accounts · 3 Accounts Approved · 4 Paid (PV generated) · 5 Rejected
- Store: `ae_vm_advance_requests` localStorage key. CRUD: `getAdvanceRequests`, `createAdvanceRequestDraft`, `upsertAdvanceRequest`, `advanceAdvanceRequestStep`, `rejectAdvanceRequest`, `deleteAdvanceRequest`.
- Advance Register now unifies: PayBill advance deductions + Accounts-approved on-demand advances (marked with ⚡ icon, blue chip).
- Backend MongoDB sync still pending (P0 - Issue 3 in handoff).
- Shows monthly entries + Total Advance Granted summary at top
- Yellow-amber themed table (matches advance highlight colour)

### Loan Management (NEW)
- 6-stage workflow: Draft → Submitted → GM Approved → Disbursed → Fully Repaid → Written Off
- Auto EMI compute (principal, interest %, tenure) with India-standard formula
- Loan types: Personal / Medical / Festival / Housing / Education / Vehicle
- Outstanding + Paid EMIs tracker · Linked to active employees only
- `getActiveLoanEMI(empId)` helper for future auto-deduction in pay bills

### PayBill → Payment Voucher (NEW auto-link)
- When Pay Bill moves to step 4 (Settled & Paid), a Payment Voucher is auto-created in `payments` store
- PV No format: `PV/HR/YYYY-MM/N`, Vendor "AE-HR-PAYROLL", amount = Pay Bill totalNet
- `linkedPvNo` stored on the Pay Bill + history entry logged

### WhatsApp Payslip Delivery
- "💬 Send on WhatsApp" in Payroll Slip tab via `wa.me/91{mobile}?text=…`

### 8 HR Print Generators
Offer / Experience / Relieving / Employee Application / Attendance / Leave / Payroll Slip / Pay Bill Sheet

## Pending / Backlog
- P1: Refactor `store.js` (1550+ lines)
- P2: Backend sync for Recruits + Exits + Leaves + PayBills + Loans
- P3: Auto-deduct active loan EMI in Pay Bill lines · Loan EMI schedule printable

## Infra Blocker
Deploy stuck on AWS ECR quota (platform).

## Credentials: `/app/memory/test_credentials.md`
