# PRD — Arun Enterprises ERP (Updated Feb 2026)

## Original Problem Statement
Multi-page ERP: Vendor / Bill / Expense / Purchase BOQ-WO / GM Approvals / HR Payroll / Users / Reports Hub. Cross-device data sync via FastAPI + MongoDB. Hindi/Hinglish UI.

## Owner / Personas
- **SuperAdmin:** `arunenterprises2023@gmail.com` — Ashish Srivastava — unrestricted.
- **Admin / GM / HR / Accounts / Purchase / User / Viewer** — role-gated with role-based defaults.

## Feb-2026 Session Changes (round 21 — Vendor Code Doctor repair utility)
- **Follow-up to round 20**: round 20 added prevention for FUTURE collisions, but existing records that had already collided (and been silently overwritten by the de-dup pass) needed a one-click repair. User asked "isko kese sahi kiya jaye" — this round delivers the Doctor.
- **New utility** `fixVendorCodeCollisions()` in `store.js`:
  - Groups vendors by `vendorCode`, finds every group with 2+ records.
  - Keeps the OLDEST record of each group (by `approvalDate → createdAt`).
  - Strips `vendorCode` from the rest + sets `step = 2` so they drop back into the GM Pending queue; the record also carries a `_codeStrippedReason` audit field for traceability.
  - Realigns `vendorSerial` counter to `max(current, maxUsedCode)` so no fresh approval can reissue a used serial.
  - Returns `{ collisions, stripped[], kept[], counterBefore, counterAfter, counterFixed }` for the toast.
- **New button** in `GeneralManager.jsx` next to the segmented tab bar — "**Vendor Code Doctor**" — gated to SuperAdmin only. One-click dialog with full Hindi explanation of what it does and the safety guarantee (no record deletion, only code strip + bounce-back to Step-2).
- Lint clean (0 errors). Smoke test confirms the Doctor button renders on GM dashboard for SuperAdmin.

## Feb-2026 Session Changes (round 20 — Vendor Code Collision & Data-Overwrite Fix)
- **Bug**: User reported critical data corruption — "humne ek naya vendor code create kiya aur uska new vendor code create kiya jo regular serial base hona chahiye parantu wo fir se new yani phir se starting main ban gaya aur purane vendor ka fitted data overwrite ho gaya". New vendor approval reused an already-issued code (`AE0001JV2627`) and the de-dup pass later deleted the older vendor record carrying the same code → silent data loss.
- **Root causes**:
  1. `syncFromCloud` wrote the remote counter block **verbatim** on top of local counters. If the remote snapshot carried a smaller `vendorSerial` (older device, lazy upload), the counter walked backwards and the next approval reissued a used code.
  2. `nextVendorCode()` trusted the counter blindly — never cross-checked against the actual `vendorCode` values already present in `localStorage`.
  3. `upsertVendor` had no collision guard, so a second vendor landing with the same code happily sat beside the original until the periodic `dedupeByKey(KEYS.VENDORS, v.vendorCode …)` pass dropped one of them.
- **Fix (3 layers of defence)**:
  1. **Monotonic counter** on sync — every counter now takes `Math.max(local, remote)` instead of being overwritten (`store.js:2152-2168`). Replay-safe across devices.
  2. **Serial scan** in `nextVendorCode()` — scans existing vendors for the highest `AE####JV` serial and bumps from `max(counter, maxUsed)+1`. Guarantees uniqueness even if the counter drifted (`store.js:159-173`).
  3. **Collision guard** in `advanceVendorStep()` — retries code generation up to 50 times if the fresh code already exists on another vendor id. Belt-and-suspenders.
  4. **Overwrite guard** in `upsertVendor()` — if an incoming vendor carries a `vendorCode` another id already owns, the code is stripped and the record is saved as a fresh un-coded draft (logged to console) instead of silently overwriting the sibling.
- Lint clean. The fix is defensive and backward-compatible — existing legitimate codes are untouched.

## Feb-2026 Session Changes (round 19 — UTR Save silently-failed fix)
- **Bug**: User reported "utr no dal kar save kiya fir bhi mang raha hai, utr save nahi ho raha hai". Green toast appeared ("UTR saved · AE/HR/PB/2026-09") but the input field re-appeared blank with the Save UTR button still visible — making the user re-enter the UTR.
- **Root cause**: `onSave` handler in `HRManagement.jsx` did `getPayments().map((pp) => pp.pvNo === p.linkedPvNo ? {...utrNo} : pp)`. When the linked PV was missing from the local `payments` array (sync race, de-dup migration drop, or any other glitch), `.map` returned the list unchanged — the UTR was never actually persisted anywhere, but the toast still fired. UI then re-rendered using the same (unchanged) payments → `hasUtr` stayed false → blank input re-appeared.
- **Fix**: Switched to `findIndex` + conditional branch. If PV exists → update utrNo + paidAt + status="Approved". If PV missing → defensively rebuild the PV in-place with the UTR already set (pvNo falls back to a fresh `GPV/HR/YYYY-MM/<rand>` identifier if `linkedPvNo` is also blank). Guarantees the save is never silent.

## Feb-2026 Session Changes (round 18 — Dept KPI Dashboards + Advance Dup verified)
- **Reports Hub KPI tiles**: added a live-filtered mini-dashboard above every department's data table — Total Records, Grand Total (when `amountKey` exists), Draft, Pending, Approved, Rejected buckets. Counts react to FY / Month / Date-range / Status / Search filters in real time. Non-zero tiles only (keeps the strip clean for empty states).
  - Classification uses `cfg.statusMap` entry order: first key → Draft, last key → Approved; anything matching `/reject/i` → Rejected; everything else → Pending.
  - All tiles carry `data-testid="rh-kpi-*"` for QA automation.
- **Advance Duplicate Rule verified** (already correctly implemented in `store.js:upsertAdvanceRequest`): throws when `empId + requestDate + amount` all three match on a non-rejected row. Different date OR different amount → allowed. No code change needed; functional spec matched.

## Feb-2026 Session Changes (round 17 — Reports Hub Inline View + Fallback IDs + Lint fix)
- **CRITICAL BLOCKER FIX**: `oxlint` was failing on `/app/frontend/src/lib/bankTransfer.js` lines 130-133 — `printBulkBankAdvice()` referenced an undefined `pb` variable in the signature block (function parameter is `items`, no single pay-bill context). Replaced the dynamic names with static "— to be signed —" placeholders (handwritten on the paper copy).
- **"—" / missing-data issue in Reports Hub**: added `fallbackKey` to primary ID columns so drafts show their temp-ref instead of em-dash:
  - Bills: `permanentBillNo` → fallback `refNo`
  - Expenses: `permanentExpenseNo` → fallback `refNo`
  - BOQ: `boqNo` → fallback `tempRefId`
  - Work Orders: `woNo` → fallback `tempRefId`
  Updated `getCellValue()` to resolve the fallback and the UI cell renderer to properly distinguish empty vs. zero (`v === null || v === undefined || v === ""`).
- **"View" + "View All" inline buttons** (agentic edit directive): added two separate buttons with distinct behaviour, both render the full biodata directly inside the datasheet (no new tab):
  - **View**: renders only the checkbox-selected rows below the table (requires at least 1 selection).
  - **View All**: toggles rendering of every filtered row below the table.
  - Each table row also has a per-row eye icon that expands that single record's biodata inline directly below its row.
- Extracted the biodata CSS into a namespaced `BIODATA_CSS` constant (classes prefixed with `.rh-ibi`) that both the print-window and the in-page `dangerouslySetInnerHTML` panel reuse — no duplication, no leakage into the rest of the React tree.
- **Filter-bar layout fix** (agentic edit directive "layout proper set kijiye"): split the previously-overflowing single-row grid into two rows — row 1 holds the 6 filter inputs (`repeat(6, minmax(120px, 1fr))`), row 2 holds the Sync / View / View All / Clear buttons with proper breathing room and a dashed separator.
- **Verified**: Login → `/reports-hub` → Bills tab shows BILL00202627 correctly, "View All (3)" opens inline biodata panel ("INLINE BIODATA · ALL 3 RECORD(S)"), "Hide All" toggles back cleanly. Lint = 0 errors.

## Feb-2026 Session Changes (round 16 — Reports Hub Column Schema Alignment)
- **CRITICAL FIX**: Reports Hub tabs were showing "—" / 0 / numeric status for most fields because the DEPT_CONFIG column keys didn't match the actual data schema in store.js. 5 tabs (Bills, Payments, Expenses, BOQ, Work Orders) had incorrect field names and status maps.
- Fixed per-tab:
  - **Bills Register**: `tempRef→refNo`, `vendorFirmName→vendorSnapshot.firmName` (via new `_vendorFirm` computed), `invoiceNo→billNo`, amount computed via basic+gst-tds, 6-step status map
  - **Payment Vouchers**: `date→pvDate`, removed non-existent `billRef`+`mode`, added `source` + `paidAt`
  - **Expense Register**: `expenseNo→permanentExpenseNo` + `refNo`, `expenseDate→date`, `paidTo→paidToName`, computed `netPayable` amount, 4-step status (EXPENSE_STEP_LABEL)
  - **BOQ Register**: `boqDate→date`, `projectCode→projectSite`, `siteName→clientName`, `totalAmount→total`, 4-step status
  - **Work Orders**: `projectCode→tempRefId`, `totalAmount→total`, added `expiryDate`, 5-step status, fixed `getWorkOrders→getWOs` import
- Added new `getCellValue` computed branches: `_vendorFirm`, `_billAmount`, `_expenseAmount`, enhanced `_lineCount` to handle `items[]` too (for BOQ/WO).
- Added **Sync button** (RefreshCw spinner) in filter row that pulls fresh snapshot from backend on-demand + auto-silent sync on tab change.
- Bug: `createBalanceDraft is not defined` runtime error prevented the Pay Bill tab from opening after the "+ Balance Pay Bill" feature was added. The earlier search_replace that defined the helper function had failed silently; only the UI button and store-level function had been added.
- Fix: Added the missing `createBalanceDraft()` wrapper inside PayBillsManager calling `createSupplementaryPayBillDraft(year, month)` → `upsertPayBill` → toast confirms count + net.
- Verified: Pay Bill tab now opens, "+ Balance Pay Bill · Oct 2026" button visible in Pay Bill History header, no console errors.

## Feb-2026 Session Changes (round 14 — Full Access auto-elevates to Admin role)
- Toggling **FULL ACCESS** in the Register New Employee form now auto-sets role to **Admin** (and reverts to User on uncheck if the dropdown is still at Admin). An inline "+ ADMIN" pill was added next to the FULL ACCESS pill to make the behavior visible.
- Prevents SuperAdmin from forgetting to pick Admin role when granting full powers.

## Feb-2026 Session Changes (round 13 — Multiple Pay Bills per Month)
- **Balance / Supplementary Pay Bill** support — `createSupplementaryPayBillDraft(year, month)` creates a 2nd/3rd/Nth pay bill in the same month with refNo suffix `AE/HR/PB/YYYY-MM/BAL-N` + `isSupplementary: true` + `supplementarySeq: N`.
- **Candidate pool** auto-filters: employees who are NOT yet included (non-excluded) in any prior bill for the same month — covers "excluded from primary" + "newly joined after primary ran".
- UI: new amber "+ Balance Pay Bill · {Month} {Year}" button in Pay Bill History header. Toast confirms count + net.
- `dedupeAllStores` key for PAYBILLS switched to `refNo` (unique per supplementary) from `monthKey` — supplementary bills no longer collapse into primary during de-dup migration.

## Feb-2026 Session Changes (round 12 — UTR Lock after Save)
- HR Pay Bills register: **UTR save hone ke baad re-fill nahi hoga**. The pencil-edit button next to each saved UTR is now gated to **SuperAdmin override only** (previously any approver could edit).
- Confirmation prompt now reads: "SuperAdmin override · Edit UTR for … Normal flow: UTR save ke baad re-fill nahi hota. Yeh SuperAdmin ka exceptional override hai (galat UTR correct karne ke liye)."
- Added `isSuperAdmin, currentUserEmail` imports to HRManagement.jsx.

## Feb-2026 Session Changes (round 11 — SuperAdmin-Assigned Access Powers)
Per directive "SuperAdmin deside karega …power ye system REGISTER NEW EMPLOYEE main kijiye":
- **Backend `RegisterBody`** extended with `permissions` dict + `is_accounts_approver` + `is_full_access` flags. Saved on user doc at `/api/auth/register` and surfaced in `/api/auth/login` payload.
- **Register New Employee form** (UsersAdmin.jsx) now shows an **ACCESS POWERS** panel with:
  - High-level toggles: **FULL ACCESS** (red pill — grants all CRUD + approve) and **APPROVER** (green pill — grants Weekly Fooding / Advance Request / PV re-approve sign-off power).
  - Fine-grained CRUD toggles: Create / Edit / Submit / Approve (auto-locked ON when FULL ACCESS is checked).
- **`isAccountsManager()`** now honors `profile.is_accounts_approver` OR `profile.is_full_access` dynamically — SuperAdmin can grant/revoke approver power at any user without hard-coding emails. Previous whitelist still works as fallback.
- Verified end-to-end: Divya Srivastava registered with `is_accounts_approver=true` — login payload returns the flag, and signatures will stamp "Divya Srivastava".

## Feb-2026 Session Changes (round 10 — Komal Account Verified)
- Komal Srivastava account registered via admin API: email `komal.srivastava@arunenterprises.online`, password `Komal2026@12`, role Admin, designation "Accounts Manager", name "Komal Srivastava".
- Login verified in-browser: landing shows "Namaste, Komal Srivastava 👋".
- `isAccountsManager()` returns `true` for Komal (both via `ACCOUNTS_MANAGER_EMAILS` whitelist AND via designation match — belt-and-braces).
- Weekly Fooding Approve button is reachable for her — only disabled by the status gate ("Pehle Submit karein") not the permission gate.
- `currentUser()` returns "Komal Srivastava" (profile.name is set, email-check bypassed) → her approvals print under her own name.
- Credentials saved to `/app/memory/test_credentials.md`.

## Feb-2026 Session Changes (round 9 — Signature Layout Flip + Email-free Names)
- **Signature layout flipped** on every print surface (Reports Hub, Bulk NEFT advice, Bank Transfer advice × 2, Weekly Fooding print): **Name on top → signature line → Role below** (per user directive 14-Oct-2026).
- **Email never prints on signatures** — `currentUser()` now rejects any `name`/`full_name` value containing "@" and falls through to employee_id → canonical "Ashish Srivastava" for super admin → Title-Cased email prefix. Raw email address is never exposed in print output.
- Empty signature slots show "— to be signed —" uniformly.

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

## 2026-10-21 — Client & Revenue Management follow-ups (iterations 30–34)
- Renamed "Client & Revenue Management"; navy/blue theme; workflow strip; Reports tab + Reports Hub (7 CRM tabs, ?dept= param).
- AI Work Order import (Gemini 3.1 Pro via EMERGENT_LLM_KEY, POST /api/crm/parse-work-order) → preview → fills contract (items, qty, rate, GST, WO type, client).
- Single TDS (194C) per RA bill; GST payable = bill GST; dashboard KPIs + bill-wise TDS/GST table.
- Fixed bottom action bar (New/Save/Edit/Submit/Final Approval/Delete/Excel/Print) on all CRM tabs; Edit open to all users; Approve/Delete only SuperAdmin + Admin (backend _crm_power).
- Client Registration form (like Vendor): temp ID → permanent CL/#### on approval; IFSC auto bank details; offline GSTIN decode (checksum, PAN, State) for Client + Vendor (lib/gstin.js).
- Work Order Type Supply / Service / Composite with compliance defaults (TDS, retention) + notes.
- HSN/SAC search panel (components/HsnFinder.jsx, lib/hsnData.js, rates indicative post 22-Sep-2025) at bottom of Vendor Bill, BOQ, WO, Contracts, Change Orders.
- RA bill print: company letterhead with logo (fallback /arun-logo.jpg), GSTIN/PAN, bank details, 4 signature blocks.
- Vendor bill split: Purchase "New Vendor Bill Creation" (/bill-create, mode=create, submit → Reference No) and Accounts "Vendor Bill Process" (/bill, fetch by Ref No, item cross-verification required before submit). Expenses tab moved from Purchase to Accounts. /bill no longer consumes a bill serial on open.
- GM Dashboard: Client & Revenue panel (KPIs + pending approvals list).
- Removed duplicate global Toaster (toasts showed twice).
- Backlog: GST name/address lookup needs paid GST API key; Client Portal; RA bill Excel per contract; recurring "Duplicate process numbers removed" toast on /bill (server duplicate row).

## 2026-10-21 — New Department: Client & Revenue (CRM + RA Billing)
- User request (verbatim, Hindi): CRM (Lead tracking, Client portal, Communication) + Billing & Revenue (RA Billing & MB, Milestone billing, Retention money, Change order / extra work) "dono department ko merge karke ek new department banakar drafting dijiye dekhne bad is software main implement kijiye".
- User choices: full draft; Client Portal NOT needed now; GST % per item; RA Bill approval by GM/SuperAdmin.
- Route `/client-revenue`, Home card "Client & Revenue". Page `pages/ClientRevenue.jsx`, components `components/crm/*`.
- Tabs: Dashboard KPIs, Leads & Enquiry (follow-ups, convert to client), Clients, Communication log (attachments ≤500KB), Contracts/Rates (items with per-item GST, retention %, mobilization advance + recovery %), Measurement Book (Nos×L×B×H, Draft→Submitted→GM Approved), RA Bills (generate from approved MB, prev/this/upto-date qty, retention, advance recovery, net; Draft→Submitted→GM Approved→Sent→Payment Received; print), Milestones (Complete & Bill → milestone bill draft), Retention register + releases, Change Orders (approval adds extra item to contract).
- Backend: server-backed (no localStorage) `/api/crm/{name}` GET/POST, DELETE (admin), `/api/crm/next-number/{kind}` atomic serials (LD/, CL/, CT/, MB/, CO/, RA/<contract>/NN). Non-approvers limited to steps 1–2 and cannot edit approved records; retention release approver-only with balance check.
- Tested: iteration_29 (frontend all flows pass); approval-bypass issues fixed afterwards and verified by backend pytest.
- Backlog: Client Portal (later), comms list without base64 payload, RA bill Excel export.


## 2026-10-21 — Data Loss / Disappearing Records Fix
- Root cause 1: 8-sec auto-sync replaced local lists with server snapshot → unsynced bills/expenses/BOQ/WO vanished. Now merge (`_mergeFromServer` in store.js) keeps unsynced + newer local records, honours server deletes via `<key>__synced_ids`.
- Root cause 2: POST /api/snapshot reset counters to 0 when none sent (→ vendor code AE0001 repeats, duplicate numbers). Now counters only move forward ($max) in /snapshot and /counters.
- Root cause 3: stale devices overwrote newer records. `_merge_upsert` skips older `updatedAt`.
- Weekly Fooding now cloud-synced (POST/DELETE /api/fooding, in snapshot).
- Snapshot push runs workflow collections through `_enforce_workflow` (no approval bypass); creators can submit step 1→2.
- Immediate sync on app load; localStorage quota errors toast instead of silently failing.
- Tested: iteration_28 + backend pytest 15/15 pass.
- Backlog: server-side atomic serials for BOQ/WO/Bill/Expense numbers (avoid cross-device duplicates & gaps); updatedAt guard on single-record endpoints; fooding approval server-side check.


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

## 2026-10-21 — GM Dashboard: Client & Revenue alignment
- KPI grid me 5 CRM verticals (Leads, Clients, Measurement Book, RA Bills, Change Orders) — same KpiCard style as other departments.
- CrmGmPanel moved to bottom as Dept #7 (numbered strip like other DeptGroups), coloured header bar (#1e3a8a) + "Open module" pill, same as InboxSection.


## 2026-10-21 — Data visibility + department tab consistency
- Expenses: frontend dedupe now by id (was refNo → hid 10 prod records sharing EXR temp refs). Server atomic `/api/counters/next-expense` for refs; no serial consumed on page open; failed expense/bill saves queued for retry.
- Fooding: prod has 2 records (verified present); tab reads them correctly after sync.
- GM: CRM direct Approve/Reject (MB, RA) for SuperAdmin/Admin; Receivable Alert red badge for RA bills Sent to Client > 30 days (sentAt stamped); CRM cache in localStorage → instant render.
- Accounts: Expenses embedded as tab in /bill (/expense redirects), shared AccountsTabs, one hero/colour, no scroll jump, ?view= URL.
- Purchase: Vendor Bill Creation embedded as tab (/bill-create → /purchase?tab=billing), no approval button, uniform hero/colours.
- Bill form labels single-line with ellipsis (aligned inputs).


## 2026-10-22 — Security audit fixes + AI Work Order
- AI Generate Work Order (Purchase > WO, next to Final Approval): GPT (gpt-5.6-terra, Emergent key) via POST /api/ai/wo-terms → editable modal (Detailed Scope + Additional T&C that must not repeat company defaults) → Save to WO (aiScopeOfWork, aiTerms) / Export PDF (sections A-1 and D added in woPrint.js).
- SEC-001 XSS: ReportsHub escapes all values/keys/refs/status/signatures/image URLs (cards, biodata, summary print).
- SEC-002: get_current_user rejects tokens when current_session.active is false (logout/force-logout revoke); frontend 401 → /login.
- SEC-003: logout clears all ae_* localStorage (except logo) when nothing is pending sync.
- SEC-004: non-approvers cannot change financial fields of approved (step>=3) records nor demote them.
- Login rate limit 5 fails / 15 min per identifier (429); fooding delete admin-only.
- Note: SuperAdmin logout on one device ends SuperAdmin sessions on all devices.


## 2026-10-22 — Client Tax Invoice (CRM)
- New tab "Client Tax Invoice" (separate from RA Bills) in Client & Revenue: user's sample TAX INVOICE format, manual items, Bill To = client select, auto CGST+SGST (UP / GSTIN 09) else IGST.
- Number on Save: A/E/INV/00049/2627 (5-digit serial per FY counter `crm.inv_<FY>`, floor 48 → first 00049; FY from invoice date, changes 1 April).
- Workflow New/Save/Edit/Submit/Approval (SuperAdmin/Admin)/Delete/Excel/Print; print with company letterhead or without (75mm blank top for printed letterhead).
- Dashboard strip steps 10/11/12 (Invoice Draft/Approval/Approved); GM panel lists submitted invoices with Approve/Reject.
- Purchase WO action row single line, centred; "Final Approval (issue WO No.)" renamed "Approval".

## 2026-10-22 — Invoice lock, payment, preview, register
- Save → Reference No INV-REF/<FY>/0001 (kept by server once set); Approval → server assigns permanent A/E/INV/000NN/<FY> (client-sent invoiceNo ignored).
- Server lock: non-admin cannot change/revert invoice at step ≥ 2; approved (numbered) invoices cannot be deleted.
- Steps: Draft → Submitted → Approved → Sent to Client → Paid (amount, date, UTR required).
- Preview modal (iframe) with/without company letterhead + print.
- New tab "Invoice Register": KPIs, client/status/search filters, sent/paid/UTR/outstanding days, tracking timeline (history incl. GM approve/reject).
- Workflow strip 13 Invoice Sent / 14 Invoice Paid; GM panel "Unpaid Client Invoices" list (red > 30 days).



## 2026-10-22 — Invoice cancel, A4 portrait, speed, mobile block, Button Designer, Paper setting
- Invoice Cancel (Admin, from Approved/Sent, reason required; server sets cancelledBy/At; number kept; step 6 Cancelled; locked; CANCELLED watermark; register KPIs exclude).
- Invoice preview/print A4 portrait (190mm body, fixed table layout), letterhead mode 75mm top.
- Speed: GET /api/crm-all (one call) + localStorage cache → Client & Revenue and GM render instantly.
- CRM tabs individually coloured; tab "Tax Invoice"; dashboard tiles/strip/tabs single line.
- Mobile phones blocked (MobileBlock.jsx; tablets/desktop allowed).
- Button Designer (SuperAdmin): pick any button → size/font/radius/min-width/margin for this button / page / whole app; saved in settings key ui_buttons (GET/POST /api/settings/ui-buttons) and applied for all users via injected CSS (body[data-route]).
- Reports Hub Paper Setting: size A4/A3/Letter/Legal, orientation Auto/Portrait/Landscape, margin, font %; per report or all reports (localStorage rh_paper_v1).


## 2026-10-22 — Designer: Page Layout mode + draggable toggle
- Designer toggle draggable (pointer) + resizable (wheel / −/+/↺), position in localStorage bd_toggle_v1.
- "Page Layout" mode: pick any element → font, width %, padding, margin, bg/text colour, hide; saved in ui_buttons.elements ('<route>|<css path from nearest data-testid>'), applied per page for all users. Saved-changes list per page with remove (to unhide), "↑ Bada hissa chunein" parent picker, reset page.


## 2026-10-22 — Local folder data save + pinned action strips
- store.js read/write: in-memory fallback when browser storage is full (data still shows from server sync).
- LocalFolderBackup.jsx (Home page panel, every user): pick folder/drive (File System Access API, Chrome/Edge) → ARUN_ERP_DATA/latest/<collection>.json + history/ERP_Backup_<date>.json. SuperAdmin saves ALL users' data (/api/admin/backup); other users save own snapshot under user_<email>/. Auto every 1/5/15/30/60 min + after each sync while ERP is open; SuperAdmin restore-from-file (merge).
- ActionStripToggle: every module's action-button strip pinned to bottom (default) / top / normal (localStorage strip_pos_v1); BOQ row got data-testid boq-action-row.
- Not verified by testing agent (customer asked to avoid testing cost).



## 2026-10-23 — Daily Sync, Desktop Sync App, Daily Sync Report
- LocalFolderBackup: "Daily Sync Now" + "Roz raat Daily Sync" (default 10-11 PM) → ARUN_ERP_DATA/daily_sync/Daily_Sync_<date>_<time>.json, reminder toast if permission missing.
- BACKUP_COLLECTIONS now include fooding + all crm_* collections.
- Desktop Sync App (components/DesktopSyncApp.jsx): SuperAdmin downloads ERP_Sync.ps1 (embedded URL + sync key) + Install_ERP_Sync.bat (Windows Task Scheduler, every 30 min). Backend: POST /api/admin/sync-key (SA, sha256 hash in settings.desktop_sync_key), GET /api/sync-agent/backup (X-Sync-Key header).
- Daily Sync Report: db.sync_reports per IST date counts on each full backup; GET /api/admin/sync-report shows +new per day.

## 2026-10-23 — Fooding employee fix + name search, buttons above data sheets
- WeeklyFoodingTab: employees loaded from /api/employees (merged with local) so dropdown never empties; Employee Name field has name search (wf-name-list) that auto-fills Employee ID + designation.
- Action row shown right after form, above data sheet (wrapper flex-column + order:-1): Expenses, Vendor Bill Process, Vendor Registration, HR Employees. BOQ / Work Order rows were already above their sheets.



## 2026-10-23 — New ERP blueprint (10 departments) · Phase 1
- Global left sidebar (components/AppSidebar.jsx) on every logged-in page incl. Home & GM: 1 GM · 2 Client & Rev · 3 HR & Labour · 4 Procurement · 5 Accounts & Vouchers · 6 Project & Site · 7 QC & Safety · 8 Plant & Machinery · 9 Reports Hub · 10 System Admin; collapsible (ae_sidebar_mini).
- Generic server-side module API: /api/ops/{kind} GET/POST, DELETE /api/ops/{kind}/{id} (Admin/SA). Kinds: projects, dpr, indent, qc_test, safety_audit, machine, machine_log, diesel_log, booking, demand_letter, tender, agreement, geo_site, geo_att. Doc No AE/<PFX>/00001/<FY>; status Draft→Submitted→Approved/Rejected (approve/reject + approved edits only Admin/SA). ops_* in backups.
- components/ops/OpsModule.jsx + opsConfig.js (form → action row → data sheet, Excel/Print, alerts: QC Fail, Safety incident/low score, Diesel chori >10% over norm).
- New pages (OpsDepartment.jsx): /site (DPR, Material Indent), /qc-safety, /plant. Home cards added.
- Client & Revenue new tabs: Booking, Demand Letter, Tenders (Govt/Private), Legal Agreements.
- HR: Geo Attendance tab (GeoAttendance.jsx) — admin sets site lat/lng/radius; GPS attendance blocked outside radius.
- GM: GmMasterView (Project selector, Active Projects, Today's Expenses, Labour on-site, Progress tracker, Critical alerts, One-click approval grid incl. legacy Bills/Vouchers/WOs/Expenses + all ops Submitted).
- Projects Register now synced to server (ops_projects); old browser-only projects auto-pushed once.
- Reports Hub: all new ops modules added as report sources.
- Local Folder panel visible only to SuperAdmin.
- Pending (Phase 2): ACL matrix in System Admin, Labour daily wages/auto-payroll link, 3-way match in bill audit.


## 2026-10-23 — ACL Matrix, Labour Wages, Home/Sidebar
- ACL: settings.acl {role:{dept:{v,c,a}}}; GET/POST /api/settings/acl (POST SuperAdmin). Defaults: view all, create all except Viewer, approve Admin+GM. lib/acl.js (can, deptOfPath, loadAcl); AclMatrix in System Admin (SA only); AclGate blocks pages without View; sidebar locks; backend ops_upsert enforces create/approve per dept. Legacy modules: only View enforced (their approve still uses old canApprove).
- Labour & Wages (HR tab, LabourWages.jsx): Labour Master (ops labour), Daily Labour Attendance P/H/A + OT (ops labour_att), Monthly Wage Bill = man-days × wage + OT × rate (ops labour_bill, Submit → GM approval grid), print.
- Sidebar: new icons; global bar hidden on /home — Home's own left Departments list shows same 1-10 list (DeptNavList); duplicate sub-links removed.

## 2026-10-23 — Sub-tabs merged, legacy ACL, Home quick tiles
- Sidebar has no sub-links; Accounts tab bar got "Payment Vouchers" (→ /final, which also shows AccountsTabs); Procurement tabs: Vendor Registration → BOQ → WO → Bill Creation; Project & Site page has Projects Register tab first. Sidebar active state via deptOfPath.
- Legacy permissions: store.canCreate / canApprove now also check ACL tick for the department of the current page (frontend only; legacy snapshot backend not ACL-enforced).
- Home quick tiles: Aaj ki DPR, Labour On-Site, Pending Wage Bills. Local Folder panel moved to System Admin (SA only). Sidebar icons restyled.


## 2026-10-23 — Progress chart, Server permission lock, Wage PV
- Home: HomeProgressChart — module-wise stacked bars (Approved / Pending / Draft / Rejected) for Vendors, BOQ, WO, Bills, Expenses, PVs, HR + all new ops modules; click opens module.
- Server ACL lock for old modules: ACL_COLL_DEPT + _acl_guard/_acl_filter on vendors, bills, payments/bulk, employees, attendance, expenses, boqs, work_orders, HR CRUD (paybills/loans/advances/recruit/exits), fooding, and /snapshot push (blocked items silently dropped). Verified: Admin with procurement c=false → POST /api/vendors 403, expenses 200.
- Wage Bill → "Payment Voucher banayein" (approved bills): creates PV (id pv_wage_<billId>, nextPvNo, status Submitted) in Accounts; bill stores linkedPvNo.



## 2026-10-23 — Progress chart project filter + monthly trend
- HomeProgressChart: project selector (names from Projects Register + project/projectSite fields); Vendors & HR rows hidden when a project is chosen. Monthly Progress Trend card: last 6 months, one line per department (2-8), approved records counted by approvedAt/approvalDate/gmApprovedAt/updatedAt month.

## 2026-10-23 — Home dashboard restyle (customer reference image)
- HomeProgressChart rewritten: project selector bar → Project Snapshot (5 solid KPI cards: DPR, Labour on-site, Expenses ₹, Pending approvals, Approved this month) → Smooth-curve Monthly Approved Trend with Entries / ₹ Amount switch + Module-wise progress table → 3 donuts (Approval Status, Department-wise Entries, Amount Status). Old Home quick tiles removed (covered by snapshot).

## 2026-10-23 — GM Dashboard cleanup
- Removed per-module pending/approved sections (Vendor Mgmt, BOQ & WO, Bills, Expenses, PV, HR…), Pending/Approved tabs, CRM GM panel and footer from GeneralManager.jsx. GM page now: Hero → Master View (project selector, tiles, progress, alerts, one-click approval grid) → KPI grid → Vendor Code Doctor (SA). Module access via sidebar.


## 2026-10-23 — Unified AE numbering + invoice preview edit
- Format AE/<4-letter code>/<T temp>NNNN/<FY>. Temp on save, Permanent on approval (new records only; old numbers untouched; Vendor Code & Tax Invoice formats unchanged).
- Legacy (store.js aeNo): BILL, EXPN, BOQS (temp + perm), WORK, PYMT (toApprovedPvNo strips T), EMPL (temp+perm), RCRT, ADVR. Not changed: HR Pay Bills monthly refs, CRM MB/RA/Contract numbers (crmNextNo).
- Ops server: tempNo / permNo / docNo, 4-letter codes (PRJT, DPRS, INDT, QCTS, SAFE, MACH, RUNH, DESL, BOOK, DMND, TNDR, AGMT, GEOS, GATT, LABR, LATT, WAGE); OpsModule shows Temp + Permanent.
- Tax Invoice serial start changed to 0040 ($max 39 — only effective if fewer than 40 already issued this FY).
- Invoice Preview: Admin/SA "Edit Layout / Data" (contentEditable, size %, margin mm, resizable columns; print uses edited preview; saved invoice unchanged).
- Pending: ABSTRACT (Summary of Item Schedules) form in Client & Revenue — waiting for customer's photo.

## 2026-10-23 — ABSTRACT (Summary of Item Schedules)
- Client & Revenue tab "Abstract" (components/crm/Abstract.jsx, ops kind abstract / ABST, dept client): To (client auto address), PO No/date, Invoice No/date, work period, location, contractor/PAN/GSTIN from Company Master; lines PO Pos, desc, item code, UOM, HSN, PO qty, rate, prev qty (auto from earlier abstracts of same PO+pos+code), current qty → prev/current/cumulative amounts, cumulative qty, balance; totals; New/Edit/Save/Submit/Approve/Delete/Print (Annexure "A", A4 landscape).




## 2026-10-24 Updates
- Approve/Reject/Cross-Verify hidden unless canApprove(); Delete hidden unless Admin/SuperAdmin (body classes ae-no-approve / ae-no-delete via AclGate + App.css).
- dedupeAllStores now only removes exact same-id duplicates; storage-full toast removed; big lists moved to IndexedDB (hydrateStore in index.js).
- Nightly backup Missing Check + restore-missing; /api/admin/fix-duplicate-numbers (SuperAdmin, dry-run first).
- Abstract: print preview, WO/Invoice/Client auto-fill, previous cumulative auto; CRM WO auto-fill in MB/RA/Tax Invoice; print-preview mouse layout editing (lib/printLayoutEdit.js).
- QC norms guide + auto Pass/Fail (ops/qcNorms.js). SuperAdmin vendor delete in Vendor Registration sheet.
- Home fit-to-screen + company banner; sidebar navy theme, bigger icons.
- Login: session takeover (sid in JWT), old device alert; idle auto-logout 10 min (non-SuperAdmin); 2-step EMAIL OTP (6 digit, 3 min, subject "Welcome to ERP ARUN ENTERPRISES") via managed email for all except SuperAdmin.
- Backlog: saved print layouts; login history; logout warning popup.


## 2026-10-25 updates
- CRM: RA Bill auto-fill dropdown in Tax Invoice; Sr No + PO Pos fields on Work Order items (flow to MB/RA/Invoice/Abstract); MB Previous Claim Qty editable (stored as contract item prevClaimQty); Abstract Previous = last Abstract cumulative; RA Bill Prev Qty editable.
- SuperAdmin: Edit & Re-approve for approved RA Bills and Approved/Sent/Paid Invoices; Clear All & Reset Counter (Invoices/Abstract, backup in purged_backup); MB/RA Temp+Permanent numbering (AE/MB/T0001/2627 → AE/MB/0001/2627) + "Re-Align & Repair Numbers" (POST /api/admin/renumber/{mb|ra_bills}); ops delete rolls counters back.
- Invoice Register inline Sent On / Paid On / Client UTR (UTR → Paid) + GST Amount / GST Received Date / GST Status.
- Renamed departments "… Management" in sidebar, heroes, Reports; GM Dashboard default only GM/Admin/SuperAdmin; non-admin System Management = My Account (POST /api/users/me/update for email/mobile, password change).
- Reports Management grouped by department.
- DD/MM/YYYY everywhere: components/DateInput.jsx (all date boxes), lib/displayEngine.js (table text + print windows).
- RBAC (docs at /app/docs/RBAC.md): View/Create/Edit/Delete/Approve per role + per-user override (_users), card/column masking (_mask/_userMask); backend _acl_ok/_rbac/_need enforced on crm/ops/legacy create-edit-delete-approve and crm/ops GET (view); frontend sidebar hide + RequireAuth guard + store helpers. Defaults: Delete/Approve = Admin only.
- Backlog: month inputs (type=month) still browser format; legacy collection GETs not view-checked server-side; Invoice/Abstract reports in Reports Management.


## 2026-11-03 updates
- Login OTP: email only (SMS removed from login flow), SuperAdmin bypass; idle auto-logout 15 min (not SuperAdmin).
- Payment Vouchers: Approved → UTR + Paid Date → "Mark Paid" = FINAL PAID (paidFinal) – backend ignores later edits, blocks delete, snapshot merge skips; reset endpoints keep paidFinal vouchers.
- HR Advance Reg toolbar moved above form.
- SuperAdmin counter Re-Align: GET /api/admin/counters, POST /api/admin/realign-counter/{key}?dry=1 (preview, then apply) for legacy series; panel in System Management + button in Payments Register. Refuses if number format not recognised.
- Known: other browsers' local counters may push a counter back up (monotonic merge).


## 2026-11-03
- Removed unused emergentintegrations + litellm from backend/requirements.txt (code no longer imports them; AI uses GEMINI_API_KEY via google-genai) so VPS `pip install -r requirements.txt` works.
- New DRAFT 3D Home page at /home-3d (pages/Home3D.jsx + home3d.css): dark navy + company red glow, mouse-tilt 3D department cards (ACL-aware via can()), floating animated icons, animated grid floor/orbs. Old /home unchanged; button "Naya 3D Home Draft dekhein" on old Home opens it. Pending: user approval to make it the default Home.
- Draft 1 rejected by user. Draft 2 (same /home-3d): "Architectural Blueprint" concept with Light/Dark toggle (saved in localStorage ae_home3d_mode), isometric 3D tower of 10 coloured slabs (slab lifts when its department tile is hovered), layered-slab department tiles with Hindi descriptions, per-icon animations, Outfit/Manrope fonts. Tower hidden below 1200px width.
- HR salary fix (user choices: actual month days, Leave unpaid, PF/ESIC on earned): store `paidDaysOf` (P/W/HL=1, H=0.5, A/L/blank=0); computeSalary earned = gross × paidDays/daysInMonth (full month ⇒ exact gross for 28/30/31), PF 12% of earned basic, ESIC 0.75% of earned (gross ≤ 21k), PT 200 if gross>10k & earned>0. Pay Bill draft lines: basic/hra/etc now from employee (was 0), net includes advance/other, statutory overrides kept only if paid days unchanged. Payslip label "Paid Days (P+W+HL+½H)".
- Verified Pay Bill (Nov 2026, preview) with temporary TEST employee (Gross 20000, Basic 10000; 30-day month: 5 W, 1 HL, 1 A, 1 L, 1 H): Paid 27.5/30, Gross ₹18,333, PF 1100, ESIC 137, PT 200, Net ₹16,896 — matches rule. Test employee/attendance/paybill deleted.
- Core Committee + rename + print polish (verified iteration_47/48, 100% after fixes): app name `arunerpportal` (index.html title, package.json name, FastAPI title). OPS kinds core_project (CPRJ), core_progress (CWRK, Working Form with module catalog per discipline, auto unit/cum/%), core_escalation (CESC, L1–L4, auto daysOpen + suggested level, OVERDUE/ESCALATE alerts) under Project Management (/site). Roles Member Civil/OHE/Electrical(PSI+E&M)/Procurement(P&M); backend `_core_disc` = SuperAdmin/GM/core_all → all, member → own disciplines, others → none (list/upsert/delete enforced). PATCH /api/users/{email}/core-access (SuperAdmin) + CORE: OWN/ALL toggle in Users table. /core-dashboard (CoreDashboard.jsx) member-wise boards; members land there after login; Home + /site buttons. Reports Hub "6. Project Management" includes 3 core reports. lib/printKit.js patches window.open: replaces .lh/.hdr header with /letterhead-header.jpg (scanned letterhead, Mob 9429694552) and forces #000 table borders; ReportsHub buildLetterhead + OpsModule print use letterheadImg.
- Finance Payments Register layout fix: page widened (.a4 → 100%/max 1480 on /final), table in horizontal scroll, date input 120px, UTR wraps, PAID (FINAL) cell compact (UTR + Paid DD/MM/YYYY), locked action shown as short "🔒 Locked" pill.
- Tasks/Notifications/Core expansion (iterations 49–50): members Member HR & Admin/Legal/Financial + SuperAdmin "Core Setup" (settings.core_config, dynamic members & custom discipline modules); sidebar "My Tasks" + "Core Committee" above GM; /core-dashboard sections Dashboard/Projects/Working/Escalation/Setup; assigning core_progress/core_escalation (assignedTo email) auto-creates Task + in-app + email notification deep-linking to the record (assignee can open/save it); /my-tasks (seniors = SuperAdmin/GM/Admin/Members assign with department default templates; assignee Save/Start/Submit; senior Done/Reject/Reopen/Delete); bell in navbar; non-SuperAdmin login → /my-tasks; Reports Hub "Core Management" group. Project Management: core items removed; Projects Register per-project form checkboxes (PROJECT_FORMS); /site project picker shows only that project's forms with project prefilled/filtered. HR Pay Bill: editable Gross (kept on refresh via grossEdited) + Edit button (reopen submitted/approved bill to Draft, Admin/SuperAdmin).
- Live login 401 RCA: prod admin password_hash never matched changed ADMIN_PASSWORD secret (seed skipped existing admin). Fix: seed_admin re-syncs password_hash from ADMIN_PASSWORD only when that secret value changes (HMAC fingerprint `env_pw_fp` keyed by JWT_SECRET); in-app changes survive restarts. Verified in preview (re-sync once, not on 2nd restart, login OK). Redeploy queued.
- VPS guide PDF regenerated: removed --extra-index-url from pip steps, added note that requirements has no Emergent private packages, added AI confirmation (both AI features on google-genai + GEMINI_API_KEY). Redeploy queued; live-login issue sent to deployer for RCA (result pending).
- User chose to keep the OLD Home page: /home-3d draft route, files and preview button removed. Added right-to-left auto-running company-name ticker (full CAPS, pauses on hover) below Home company banner (`.co-ticker` in App.css).
- SuperAdmin power alignment: backend `_is_super_admin` = ADMIN_EMAIL OR role "SuperAdmin" (used by require_super_admin, require_admin, OTP skip, single-session, password change). Role "SuperAdmin" assignable only by a SuperAdmin (register + role change). Frontend store `isSuperAdmin` = primary email OR signed-in user's role SuperAdmin; UsersAdmin role dropdowns include SuperAdmin; primary account role stays locked. Verified via curl (role-SuperAdmin test user: no OTP, /users 200, /admin/counters 200; test user deleted).

