# Vendor Management — Arun Enterprises

## Original Problem Statement
3-page vendor management HTML app for Arun Enterprises. Every page has the same
7-button footer (New, Save, Edit, Submit, Final Approval, Export JSON/Excel, Print)
and A4 portrait layout with company header. Data lives 2 years from approval.

- Page 1 — Vendor Registration: temp code (letter + 4 digits) on create; on Final
  Approval becomes permanent `AE + 4-digit serial + JV + FY` (e.g. AE0001JV2526),
  never deleted. Auto Expiry = Approval + 2 years.
- Page 2 — Bill Processing: enter vendor code → autofill snapshot; capture bill
  with GST slab (0/5/12/18/28) and TDS; compute Gross & Net Payable.
- Page 3 — Reports: due list (Excel), summary dashboard, payment voucher export.

## User Choices
- Storage: browser **localStorage** only (no backend)
- Auth: simple admin login (admin / admin@123)
- Exports: Excel + JSON + Print
- Vendor code format: `AE0001JV2526`
- Bill fields: standard (Bill No, Date, Amount, GST slab, TDS, Net, Due Date)

## Architecture
- React 19 SPA under `/app/frontend`
- Router: `react-router-dom` with `RequireAuth` gate
- State: local component state + `localStorage` via `/src/lib/store.js`
- Excel: `xlsx` (SheetJS); JSON: browser Blob; Print: `@media print` A4 rules
- Corporate document look: navy `#0b3d91` + gold accent, Georgia/Cambria serif
- Every input has `data-testid`

## What's Implemented (Feb 2026)
- Login page (admin/admin@123) with route protection
- Page 1 Vendor Registration (all fields 1.1–4.5, workflow, temp→permanent code)
- Page 2 Bill Processing (vendor autofill, GST/TDS/Net compute, workflow)
- Page 3 Reports (summary dashboard, due list, payment voucher, Excel 3-sheet)
- Global 7-button footer with Export split menu (JSON/Excel)
- Print-friendly A4 CSS with page-break rules
- Sonner toasts, DRAFT/SUBMITTED/APPROVED stamps

## Test Credentials
See `/app/memory/test_credentials.md`.

## P0 Backlog
- Payment recording against a bill (partial payments, allocations)
- Vendor list / search directory page
- Data backup / import (upload the JSON export back into the app)

## P1 Backlog
- Aging buckets (0-30 / 31-60 / 61-90 / 90+) on due list
- Bulk import of vendors via Excel
- Dark theme + logo upload
