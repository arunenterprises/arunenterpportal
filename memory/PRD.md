# Arun Enterprises — Vendor + HR Management System · PRD

## Original Problem Statement
Multi-page Vendor Management, Bill Processing, Expense Management, Purchase Management (BOQ/WO), General Manager Dashboard, Reports, User Management, and HR Management for Arun Enterprises. Hindi/Hinglish user. Strict A4 Landscape layout for business docs, A4 Portrait for HR letters, A4 Landscape for Attendance Sheet.

## Architecture
- Backend: FastAPI + MongoDB (Motor async). All API routes `/api/*`.
- Frontend: React + Tailwind. Hybrid localStorage + cloud sync via `/api/snapshot` + `/api/sync`.
- Auth: JWT, role-based + per-user permissions override (SuperAdmin/Admin/User).

## Home — Organisation Structure (3-Tier)
- **Tier 1 (Executive · Approval Authority)**: General Manager card (centered, 560px max, with pending badge)
- **Tier 2 (Operating Departments)**: 5-column row — Vendor · Purchase · Accounts · HR · Reports
- **Tier 3 (System Administration · SuperAdmin only)**: User Management (centered, red)
- Vertical SVG-style connectors between tiers via gradient divs

## GM Dashboard — Consolidated Approval Inbox
- 10 KPI cards: Vendors · BOQs · WOs · Bills · Expenses · Vouchers + **HR Employees · HR Leaves · HR Recruitment · HR Exit & F&F**
- Full-width layout (maxWidth: 100%)
- 2 tabs: Pending Approval / Approved · Re-Approve
- 6 DeptGroups in pending inbox: Vendor · Purchase · Accounts · Expenses · Vouchers · **HR Management (4 sub-sections)**
- HR approvals route to GM: Employee Final Approval, Leave Approval, Recruit Offer Release, Exit Finalization

## HR Management Module
8 tabs: Dashboard · Employees · Attendance · Leaves · Payroll Slip · Compliance · Recruitment · Exit & F&F

### Employee Application Form (13 sections, bio-data style, A4 Portrait print)
Header codes · Application Reference & Position · A Personal (Photo top-right 130×160, ≤500KB) · B Contact (3-col + Present/Permanent addresses with 36-state dropdown) · C Family · D References (compact 2: Name/Mobile/Relationship) · E Education · F Experience · G Bank (IFSC auto-fetch + Account Type) · H Salary · I Documents (≤500KB) · J Declaration (Signature bottom-right) · K All Employees · **Bottom Workflow Bar** (6-7 clean full-width buttons: New / Save / Edited / Submitted / Approval / [Re-Approve] / Print A4)

### HR Print Generators (A4 Portrait/Landscape via window.open)
1. Offer Letter · 2. Experience Letter · 3. Relieving Letter · 4. Employee Application · 5. Attendance Sheet (Landscape) · 6. Leave Application · 7. Payroll Slip — all with enhanced letterhead + GSTIN + workflow signature blocks

### Permanent EMP Code: `AE/EMP/000NNN/YY-YY`

## Completed Work (Feb 2026 session)
- Bio-Data Application Form with Photo top-right, Signature bottom-right
- Section reorganization — Job merged into Application Reference · 2-reference compact · Documents before Declaration
- EMP code `AE/EMP/000NNN/YY-YY` (hyphenated FY)
- Bottom workflow bar — New/Save/Edited/Submitted/Approval/Re-Approve/Print (clean, no titles/footer)
- DOJ auto-fill on Final Approve · Upload size 500KB (photo/sig/docs)
- 7 Print generators (Offer/Experience/Relieving/Employee App/Attendance/Leave/Payroll)
- **HR integrated into GM Dashboard** — 4 new KpiCards + Dept Group #6 with 4 pending inbox sections
- **Home page redesigned to 3-tier Organisation Structure** (Executive → Departments → Admin)
- Full-width layouts (maxWidth: 100%) on HR + GM pages

## Pending / Backlog
- P1: Refactor `store.js` (1346 lines) → domain modules
- P2: Backend sync for Recruits + Exits + Leaves
- P3: Pincode auto-fill · Signature pad · Govt ID OCR · WhatsApp payslip delivery

## Infra Blocker
Production deployment stuck on AWS ECR quota (platform-side, not code).

## Credentials: see `/app/memory/test_credentials.md`
