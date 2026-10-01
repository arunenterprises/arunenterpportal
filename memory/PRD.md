# Arun Enterprises — Vendor Management & HR System · PRD

## Original Problem Statement
Build a multi-page Vendor Management, Bill Processing, Expense Management, Purchase Management (BOQ/WO), General Manager Dashboard, Reports, User Management, and HR Management application for Arun Enterprises. Hindi/Hinglish user. Strict A4 Landscape layout for most pages, A4 Portrait for HR letters, A4 Landscape for Attendance Sheet.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async). All API routes `/api/*`.
- **Frontend**: React + Tailwind. Hybrid localStorage + cloud sync via `/api/snapshot` + `/api/sync`.
- **Print**: Global `@page size: A4 landscape`; per-document `@page` overrides via `window.open` in `hrLetters.js`.
- **Auth**: JWT, role-based + per-user permissions override.

## Core Modules
1. Vendor Registration · 2. Purchase Management (BOQ/WO) · 3. Bill Processing · 4. Expense Process · 5. General Manager Dashboard · 6. Reports · 7. User Management · 8. **HR Management**

## HR Management Module

### Tabs
- **Dashboard** — Celebrations banner (birthdays + anniversaries, 7-day window)
- **Employees** — Full Bio-Data Application Form with bottom workflow bar
- **Attendance** — Monthly grid + Export Excel + **Print A4 Landscape Sheet** (with letterhead, legend, signature block)
- **Leaves** — Apply/Submit/Approve flow + **Print Leave Application** letter per row (A4 Portrait)
- **Payroll Slip** — Salary slip + **Print A4 Portrait Slip** (letterhead, earnings/deductions tables, Net in words, Payroll Authorization 3-column signatures) + Push to Accounts
- **Compliance** — PF/ESIC/PT/TDS snapshot + Excel export
- **Recruitment** — Candidate funnel + Offer Letter PDF
- **Exit & F&F** — Resignation → Clearance → F&F + Experience Letter + Relieving Letter PDFs

### Employee Application Form (13 sections, A4 Portrait print)
Header codes · **Application Reference & Position** · A Personal (Photo top-right 130×160) · B Contact (3-col + structured addresses) · C Family · D References (compact 2) · E Education · F Experience · G Bank (IFSC auto-fetch + Account Type) · H Salary · I Documents (≤500KB) · J Declaration (Signature bottom-right) · K All Employees · **Bottom Workflow Bar** (6-7 full-width buttons: New / Save / Edited / Submitted / Approval / [Re-Approve] / Print A4)

### HR Letter Generators (all open in new window via `window.open`)
1. **Offer Letter** — A4 Portrait, detailed CTC breakup, 8 T&C clauses, signatory
2. **Experience Letter** — A4 Portrait, "To Whomsoever It May Concern" format
3. **Relieving Letter** — A4 Portrait, resignation acceptance, LWD, F&F amount
4. **Employee Application Form** — A4 Portrait with enhanced letterhead + 4-col HR Workflow signature block
5. **Attendance Sheet** — A4 Landscape, full month grid with colored day codes, P/A/L summary, legend, 3-col signatures
6. **Leave Application** — A4 Portrait formal letter format with HR Decision table
7. **Payroll Slip** — A4 Portrait with letterhead, Emp info table, split Earnings/Deductions tables, dark Net Pay bar, amount in words, 3-col Payroll Authorization signatures

### Permanent EMP Code format
`AE/EMP/000NNN/YY-YY` (6-digit serial, hyphenated FY via `getFYHyphen()`)

## Completed Work (This Session — Feb 2026)
- Bio-Data Employee Application form (10 sections → 13 with document upload, declaration, workflow bar)
- Expanded fields: advertisement no, filing date, project/site, location, applied post, structured addresses with 36-state dropdown, bank with Account Type + IFSC auto-fetch, documents multi-upload (≤500KB), photo + signature uploads
- EMP code format `AE/EMP/000NNN/YY-YY`
- Section reorganization: Job merged into Application Reference, 2-reference compact section
- Photo top-right (Section A), Signature bottom-right (Section J)
- Declaration moved below Documents (order: Salary → Documents → Declaration)
- Clean bottom workflow bar (no title/footer): New / Save / Edited / Submitted / Approval / [Re-Approve] / Print A4
- DOJ auto-fills on Final Approve
- Upload size cap 100KB → 500KB
- Enhanced print letterhead with phone + GSTIN + 4-col workflow signature block
- **Attendance Print A4 Landscape** with colored day codes + legend + signatures
- **Leave Application Print A4 Portrait** formal letter with HR Decision table
- **Payroll Slip Print A4 Portrait** with full letterhead + 3-col Payroll Authorization

## Pending / Backlog
- **P1**: Refactor `store.js` (1340+ lines) → split by domain
- **P2**: Backend sync for Recruits + Exits + Leaves (currently localStorage-only)
- **P3**: Pincode auto-fill via India Post API · Signature pad canvas · Govt ID OCR

## Known Infra Blocker
- Production deployment stuck on AWS ECR quota (platform issue, not code)

## Test Credentials
See `/app/memory/test_credentials.md`
