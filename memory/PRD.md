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
