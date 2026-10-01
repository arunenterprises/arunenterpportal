# Arun Enterprises — Vendor + HR Management System · PRD

## Original Problem Statement
Multi-page Vendor Management, Bill Processing, Expense Management, Purchase Management (BOQ/WO), General Manager Dashboard, Reports, User Management, and HR Management for Arun Enterprises. Hindi/Hinglish user.

## Architecture
- Backend: FastAPI + MongoDB (Motor async). All API routes `/api/*`.
- Frontend: React + Tailwind. Hybrid localStorage + cloud sync via `/api/snapshot` + `/api/sync`.
- Auth: JWT, role-based + per-user permissions override (SuperAdmin/Admin/User).
- Print: Global `@page size: A4 landscape`; per-document `@page` overrides via `window.open` in `hrLetters.js`.

## Home — Organisation Structure (3-Tier · Full Width)
- **Tier 1 (Executive)**: General Manager — centered, 620px max, with pending badge
- **Tier 2 (Operating Departments)**: Vendor · Purchase · Accounts · **HR (shows live headcount X/Y)** · Reports — 5-column grid, full width
- **Tier 3 (System Admin · SuperAdmin only)**: User Management — centered red card
- Vertical SVG-style connectors between tiers · maxWidth 100% (removed A4 constraint)

## GM Dashboard — Consolidated Approval Inbox
- **11 KPI cards**: Vendors · BOQs · WOs · Bills · Expenses · Vouchers · HR Employees · HR Leaves · HR Recruitment · HR Exit & F&F · **HR Pay Bills**
- Full-width layout (maxWidth: 100%)
- 2 tabs: Pending Approval / Approved · Re-Approve
- 6 DeptGroups in pending inbox: Vendor · Purchase · Accounts · Expenses · Vouchers · **HR Management (5 sub-sections including Monthly Pay Bills)**
- HR approvals route to GM: Employee Final Approval, Leave Approval, Recruit Offer Release, Exit Finalization, **Pay Bill Approval**

## HR Management Module (9 tabs)
Dashboard · Employees · Attendance · Leaves · Payroll Slip · **Pay Bill** (NEW) · Compliance · Recruitment · Exit & F&F

### Employee Application Form (13 sections, bio-data, A4 Portrait)
Header codes · Application Reference & Position · A Personal (Photo top-right) · B Contact (3-col + structured addresses) · C Family · D References (compact 2) · E Education · F Experience · G Bank (IFSC auto-fetch) · H Salary · I Documents (≤500KB) · J Declaration (Signature bottom-right) · K All Employees · **Bottom Workflow Bar** (6-7 clean full-width buttons)

### Monthly Pay Bill (NEW)
- Month/Year picker + Create Draft (auto-compute from Attendance)
- Full employee grid with editable **Advance** + **Other Deductions** columns
- Live computed NET per employee + Grand Totals (Gross/Ded/Adv/NET)
- 4-step workflow: Draft → Submitted to GM → GM Approved → Settled & Paid
- Permissions: Create/Save/Submit → All · Approve → GM only
- Print A4 Landscape sheet with 18-column layout + 4-signature block
- Ref format: `AE/HR/PB/YYYY-MM`

### HR Print Generators (7 total, open via window.open)
Offer Letter · Experience Letter · Relieving Letter · Employee Application · Attendance Sheet · Leave Application · Payroll Slip · **Pay Bill Sheet (A4 Landscape)**

### WhatsApp Payslip Delivery (NEW · wa.me deep link)
- Button in Payroll Slip tab: "💬 Send on WhatsApp"
- Opens WhatsApp with pre-filled message (EMP code, Gross, Deductions, Net) and candidate's mobile
- No API keys required · uses `https://wa.me/91{mobile}?text=...`

### EMP Code: `AE/EMP/000NNN/YY-YY`

## Completed Work (Feb 2026 session · summary)
- Bio-Data Employee Form (13 sections) with Photo top-right + Signature bottom-right + 500KB upload
- EMP code hyphenated FY format
- 3-tier Home Organisation Structure with full-width layout + live headcount badge on HR
- GM Dashboard integration: 5 HR items routed through GM (Employees/Leaves/Recruits/Exits/**PayBills**)
- 11 KPI cards + 5-section HR Dept Group in GM inbox
- **Monthly Pay Bill module** with Advance adjustment, 4-step workflow, Print A4 Landscape
- **WhatsApp Payslip Delivery** via wa.me deep link
- 7 Print generators (Offer/Experience/Relieving/EmpApp/Attendance/Leave/Payroll/**PayBill**)
- Clean bottom workflow bar on Employee form · DOJ auto-fill on Final Approve · 500KB uploads

## Pending / Backlog
- P1: Refactor `store.js` (1420+ lines) → domain modules
- P2: Backend sync for Recruits + Exits + Leaves + PayBills
- P3: Pincode auto-fill · Signature pad · Govt ID OCR · Pay Bill history filters

## Infra Blocker
Production deployment stuck on AWS ECR quota (platform-side, not code).

## Credentials: `/app/memory/test_credentials.md`
