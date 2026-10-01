# Arun Enterprises — Vendor Management & HR System · PRD

## Original Problem Statement
Build a multi-page Vendor Management, Bill Processing, Expense Management, Purchase Management (BOQ/WO), General Manager Dashboard, Reports, User Management, and HR Management application for Arun Enterprises. Hindi/Hinglish user. Strict A4 Landscape layout for most pages, A4 Portrait for HR letters and Employee Application.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver). All API routes `/api/*`.
- **Frontend**: React + Tailwind + Shadcn UI. Cross-device sync via `/api/snapshot` + `/api/sync` endpoints.
- **State**: Hybrid — `localStorage` cache + cloud push/pull via `store.js`.
- **Print**: Strict `@page { size: A4 landscape; margin: 8mm }` globally; A4 Portrait for HR letters via `window.open` in `hrLetters.js`.
- **Auth**: JWT via `/api/auth/login`. Role-based + per-user permissions override (`permissions.{create,edit,submit,approve}` in auth profile, admin-editable via Users page tick/untick).

## Core Modules
1. **Vendor Registration** — Multi-step vendor onboarding with IFSC auto-fetch (Razorpay API).
2. **Purchase Management** — BOQ → Work Orders → auto-sync to external Vendor Portal.
3. **Bill Processing / Accounts** — Multi-step invoice approval.
4. **Expense Process** — Expense claims with voucher generation.
5. **General Manager Dashboard** — Centralized Pending Inbox for all approvals.
6. **Reports** — Cross-module reporting with Excel export.
7. **User Management** — Role + permission management (SuperAdmin / Admin / User).
8. **HR Management** — Complete HR module (details below).

## HR Management Module — Current Scope

### Tabs
- Dashboard · Celebrations banner (birthdays + anniversaries · 7-day window)
- **Employees** — Full Bio-Data Application Form (details below)
- Attendance · Monthly grid with cycle-click P/A/L/H/W/HL
- Leaves · Apply/Submit/Approve flow with auto-attendance marking
- Payroll Slip · Salary slip + Push monthly aggregate to Accounts
- Compliance · PF/ESIC/PT/TDS snapshot with Excel export
- Recruitment · Candidate funnel with Offer Letter PDF generation
- Exit & F&F · Resignation → Clearance → F&F → Experience + Relieving Letter PDFs

### Employee Application Form (A4 Portrait printable)

**Header Codes Row**: Temp Code (AE/TMP/XXXXXX/XXX) · Permanent EMP Code (AE/EMP/XXXXXX/YY-YY) · Status/Step · Revision

**Section Order**:
1. **Application Reference & Position** (header) — Advertisement No, Date of Filing, Project/Site, Location, Applied Post (dropdown: Manager / Site Incharge / Engineer / Mason / Helper / Peon / Cashier / etc), Allotted Designation, Department, Reporting Manager, Date of Joining (readonly, auto-fills on Final Approval), Employment Status
2. **A. Personal Details** — Left: Full Name, Father, Mother, Spouse, DOB, Gender, Marital, Blood Group, Nationality, Religion, Category, Aadhaar, PAN · Right: Passport Photo upload (120×150, ≤ 500KB)
3. **B. Contact Details** — Mobile, Alt Mobile, Email · Present Address card (Line / City / State dropdown — 36 Indian states/UTs / PIN 6-digit) · Permanent Address card with "Same as Present" checkbox
4. **C. Family Members** — Dynamic rows: Name, Relation (Father/Mother/Spouse/Son/Daughter/etc), DOB, Occupation, Contact
5. **D. References** — Compact 2 cards: Name + Mobile + Relationship
6. **E. Educational Qualifications** — Dynamic rows: Qualification, Board, Institute, Year, % / CGPA
7. **F. Previous Work Experience** — Dynamic rows: Company, Designation, From, To, Last Salary, Reason
8. **G. Bank & Statutory** — IFSC auto-fetch (Razorpay) + Account Type dropdown (Savings/Current/Salary/NRE/NRO) · Account No · auto-filled Bank/Branch/City/Address · PF/UAN/ESIC
9. **H. Salary Structure** — Basic / HRA / DA / Special / Bonus / Gross (auto)
10. **I. Documents Upload** — Multi-upload (≤500KB each): Aadhaar, PAN, Photo, Signature, Educational, Experience, etc. — categorized dropdown + View + Delete
11. **J. Declaration** — Declaration text + Place + Date · Right: Candidate Signature upload (≤500KB)
12. **K. All Employees** — Paginated list with Edit/Delete
13. **Bottom Workflow Button Bar** (full-width, clean · no header/footer titles):
    - 6 buttons: New / Save / Edited / Submitted / Approval / Print A4 (7th Re-Approve shows only when step=5)
    - **New / Save / Edited / Submitted / Print** → All (User / Admin / SuperAdmin)
    - **Approval / Re-Approve** → only Admin / SuperAdmin
    - Top actions strip removed — all actions consolidated at bottom

### HR Letter Generators (A4 Portrait · window.open)
- **Offer Letter** — Recruitment tab, status ≥ Offered. Letterhead (logo + name + tagline + address + Tel/Email/Web + GSTIN), Ref No AE/HR/OL/YYYY/XXXXX, candidate addressee, CTC breakup table (Basic 50% / HRA 20% / DA 10% / Special 15% / Bonus 5% + Employer PF 12% + Gratuity 4.81% = Total CTC), 8 T&C clauses, signatory K.L. Srivastava · Director, candidate acceptance block.
- **Experience Letter** — Exit tab, finalized. "TO WHOMSOEVER IT MAY CONCERN", Ref AE/HR/EXP/YYYY/XXXXXX, name/EMP code, tenure DOJ→LWD, 4 standard paragraphs, signatory.
- **Relieving Letter** — Exit tab, finalized. Ref AE/HR/REL/YYYY/XXXXXX, addressee block, resignation acceptance, LWD, F&F amount, acknowledgement block, signatory.
- **Employee Application Form (A4 Portrait)** — "Print A4 Portrait" button in form. Enhanced letterhead on top (name + tagline + full address + phone + email + web + GSTIN) + consolidated reference box + Photo embedded + all sections rendered as tables + Declaration with signature image + 4-column **"HR Workflow & Approval Chain"** table at bottom (Prepared By / Verified By / Department Manager / Authorized Signatory with names + designations + dates).

## Completed Work (This Session — Feb 2026)
- 2026-02-01: Bio-Data Employee Application form (10 sections) + Offer/Experience/Relieving letter generators
- 2026-02-01: Field expansions — advertisementNo, dateOfFiling, projectSite, location, appliedPost, photoUrl, signatureUrl, structured addresses with 36-state dropdown, bank with Account Type + IFSC auto-fetch, documents multi-upload (≤500KB)
- 2026-02-01: EMP code format → `AE/EMP/000NNN/YY-YY` (hyphenated FY via new `getFYHyphen()` helper)
- 2026-02-01: Section reorganization — Job fields merged into Application Reference, compact 2-reference section
- 2026-02-01: Section A layout — Personal fields LEFT (3-col grid), Photo TOP-RIGHT (130×160 bordered); Section I Declaration — content LEFT, Signature upload BOTTOM-RIGHT
- 2026-02-01: Reordered — Declaration moved BELOW Documents (I. Documents → J. Declaration → K. All Employees)
- 2026-02-01: Bottom full-width workflow button bar — New / Save / Edited / Submitted (All roles) / Approval (Admin+SuperAdmin only) with inline permission note
- 2026-02-01: Enhanced Print PDF letterhead (phone + GSTIN) + 4-col "HR Workflow & Approval Chain" table at footer with auto-filled names
- 2026-02-01: DOJ auto-fills with today's date on Final Approve
- 2026-02-01: Upload size limit raised 100KB → 500KB (photo + signature + documents)
- 2026-02-01: Fixed Exit Tab history visibility when no active employees · Approve button properly disabled for non-approvers in UI style

## Pending / Backlog (P1 → P3)
- **P1**: Refactor `/app/frontend/src/lib/store.js` (1340+ lines) → split into `auth_store.js`, `hr_store.js`, `vendor_store.js`, `api_client.js`
- **P2**: Backend sync for Recruits + Exits (currently localStorage-only — not shared across users)
- **P2**: Server-side validation for Employee Application fields + Aadhaar/PAN format validation
- **P3**: Signature pad (draw on canvas) as alternative to image upload
- **P3**: Pincode → City/State auto-fill via India Post API
- **P3**: Government ID OCR auto-fill for Aadhaar/PAN fields

## Known Infra Blocker
- Production deployment stuck on AWS ECR limit (`customers-app` repo = 100K image cap). Platform-side issue, not code.

## Test Credentials
See `/app/memory/test_credentials.md`
