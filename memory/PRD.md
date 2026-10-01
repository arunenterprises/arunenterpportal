# Arun Enterprises — Vendor + HR Management System · PRD

## Architecture
- Backend: FastAPI + MongoDB. Frontend: React + Tailwind. Auth: JWT + per-user permissions.
- Print: `@page size: A4` with per-doc overrides via `window.open` in `hrLetters.js`.

## Recent Updates (Feb 2026 session)
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

### Advance Register (NEW)
- Live aggregation from all Pay Bills — per-employee advance ledger
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
