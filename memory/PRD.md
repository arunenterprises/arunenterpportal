# Vendor Management — Arun Enterprises

## Original problem
3-page vendor management HTML app for Arun Enterprises. Every page has the same
7 workflow buttons (New, Save, Edit, Submit, Final Approval, Export JSON/Excel,
Print), A4 portrait layout with company header, and a linear approval workflow.

## User choices
- Storage: browser **localStorage** only (no backend)
- Auth: **user list with admin/admin@123 seed**; admin can create/delete users
- Exports: Excel + JSON + Print (all pages)
- Vendor code: temp `TMP-XXXXXXXX` (issued on first Save) → permanent `AE####JV####` after Final Approval
- Bill numbering: temp `AE####FY` (on draft) → permanent `BILL####FY` (primary key on Step 5)
- Bill fields: standard set + full multi-stage approval + Item & Work Scope breakdown

## Architecture
- React 19 SPA under `/app/frontend`; router: `react-router-dom`
- State: local component state + `localStorage` via `/src/lib/store.js`
- Excel: `xlsx` (SheetJS); JSON: browser Blob; Print: `@media print` A4 rules
- **All 7 workflow buttons + Search + Prev/Next nav + Upload Logo + Logout** live
  in a single fixed-bottom colored footer (`TopActionBar`), one row on desktop
- Corporate look: navy `#0b3d91` / `#1e3a8a` + gold accent, Georgia/Segoe serif

## What's implemented (Feb 2026 — iteration 10)
- Login (admin/**Arun2023@12** seed — updated Feb 2026, cloud-backed; admin can change via `/users`)
- **Page 1 — Vendor Registration**: temp ID issued on first save, permanent
  `AE####JV####` on Final Approval, expiry = approval + 2 years, project/site,
  contact + address (city/state/pincode), bank details, 3-substep workflow with
  role names, approval banner, colored A/B/C/... sections
- **Page 2 — Bill Processing**: 5-step workflow (Submission → WO Verify →
  Accounts Check → Mgmt Approval → Payment Due List), vendor autofill via Fetch
  button, Work Order + Item summary, **Item & Work Scope Breakdown** with
  add-row / delete / computed Amount / subtotal → Basic Amount, GST/TDS compute
  panel, multi-stage substeps with checker/purchaser/accountant/approver names,
  payment schedule with priority/mode/todo/release status, 4-signature row
- **Page 3 — Final Processing** (single A4): Summary Dashboard, Due List with
  overdue pill, **inline** Payment Voucher (D/E/F/G sections + signatures) and
  **User Management** with create/delete (admin-only, seed admin protected)
- **Footer bar** on every page: Search input + Search, Prev / Next page, New,
  Save, Edit, Submit, Final Approval, Export (JSON / Excel), Print, Upload Logo,
  Logout — all colored, one row, fixed to viewport bottom
- **Logo upload**: PNG/JPG/SVG/WEBP → base64 in localStorage → visible in every
  page header
- Print CSS with A4 page-break rules

## Test credentials
See `/app/memory/test_credentials.md`.

## Deferred / backlog
- Approved Voucher Excel export (single or multi-select) — **Done Feb 2026** (per-row checkbox + Select-All + green "📥 Export Approved to Excel" button in Payments Register header)
- Category Scope: Transportation & Loading/Unloading added; **Km** unit added — **Done Feb 2026**
- "Item Description (Summary)" → "**Item Summary**" label rename — **Done Feb 2026**
- "Previous Advance / Paid Amount" → "**Previous Bill & Amount**" (info only, not adjusted) — **Done Feb 2026**
- Billed Qty ≤ WO Qty clamp + per-row Balance column + cumulative WO/Billed/Balance/WO-Value totals — **Done Feb 2026**
- Work Order file upload (PDF/image, max 300 KB) + View link on Reports Due List (vendor-facing view) — **Done Feb 2026**
- UTR/Ref appears on Reports Due List (`due-utr-*`) — vendor sees UTR after voucher approval — **Done Feb 2026**
- HSN/SAC per-item field on Bill page — **Done Feb 2026**
- Approved Bill Re-Approve — **Done Feb 2026**
- Change Password from Admin Users panel — **Done Feb 2026**
- Reset All Data (Danger Zone) — **Done Feb 2026**
- Partial payments against a bill (multi-voucher allocation & live balance)
- Vendor directory listing with filters
- Aging buckets (0-30 / 31-60 / 61-90 / 90+) on due list
- Excel/JSON import to restore data across browsers
- Favicon replace (Arun logo)
- Print watermark (faint Arun logo)
- 1s splash-screen logo
