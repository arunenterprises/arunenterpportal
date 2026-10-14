import {
  apiUpsertVendor, apiDeleteVendor, apiUpsertBill, apiDeleteBill, apiUpsertExpense, apiDeleteExpense, apiUpsertBOQ, apiUpsertWO, apiPushPayments, apiDeletePayment, apiDeletePaymentsBulk,
  apiDeleteBOQ, apiDeleteWO,
  apiUpsertEmployee, apiDeleteEmployee, apiUpsertAttendance,
  apiUpsertPayBill, apiDeletePayBill, apiUpsertLoan, apiDeleteLoan,
  apiUpsertAdvanceRequest, apiDeleteAdvanceRequest, apiResetHrFinancials,
  apiUpsertRecruitment, apiDeleteRecruitment, apiUpsertExit, apiDeleteExit,
  apiSetCounters, apiSetLogo, apiFetchSnapshot, apiPushSnapshot,
  apiLogin, apiRegister, setToken, clearToken, getToken,
} from "./api";
import { toast as _toast } from "sonner";

const KEYS = {
  VENDORS: "ae_vm_vendors",
  BILLS: "ae_vm_bills",
  PAYMENTS: "ae_vm_payments",
  EXPENSES: "ae_vm_expenses",
  BOQS: "ae_vm_boqs",
  WOS: "ae_vm_work_orders",
  EMPLOYEES: "ae_vm_employees",
  ATTENDANCE: "ae_vm_attendance",
  PAYBILLS: "ae_vm_paybills",
  LOANS: "ae_vm_loans",
  ADVANCE_REQS: "ae_vm_advance_requests",
  FOODING: "ae_vm_fooding",
  COUNTERS: "ae_vm_counters",
  AUTH: "ae_vm_auth",
  LOGO: "ae_vm_logo",
  USERS: "ae_vm_users",
};

// ---- Company logo ----
export const getLogo = () => {
  try { return localStorage.getItem(KEYS.LOGO) || ""; } catch { return ""; }
};
export const setLogo = (dataUrl) => {
  localStorage.setItem(KEYS.LOGO, dataUrl);
  if (getToken()) apiSetLogo(dataUrl).catch(() => {});
};
export const clearLogo = () => localStorage.removeItem(KEYS.LOGO);

// ---- Wipe local cache (used after admin "Reset All Data") ----
export const resetLocalCache = () => {
  [KEYS.VENDORS, KEYS.BILLS, KEYS.PAYMENTS, KEYS.EXPENSES, KEYS.BOQS, KEYS.WOS, KEYS.EMPLOYEES, KEYS.ATTENDANCE, KEYS.PAYBILLS, KEYS.COUNTERS, KEYS.LOGO, KEYS.USERS].forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
};

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- Company Details master (SuperAdmin-managed · used across letterhead / PV / prints) ----
export const DEFAULT_COMPANY = {
  name: "M/s ARUN ENTERPRISES",
  tagline: "OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY",
  pillLine: "Govt. Civil Work Contractor & General Order Supplier",
  address: "209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011",
  tollFree: "9429694552",
  email: "info@arunenterprises.online",
  website: "www.arunenterprises.com.in",
  gst: "",
  pan: "",
  cin: "",
  state: "Uttar Pradesh",
  bankName: "",
  bankAccountNo: "",
  bankIfsc: "",
  bankBranch: "",
};
const COMPANY_KEY = "ae_vm_company";
export const getCompany = () => {
  try {
    const raw = localStorage.getItem(COMPANY_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_COMPANY, ...stored };
  } catch {
    return DEFAULT_COMPANY;
  }
};
export const setCompanyLocal = (data) => {
  try { localStorage.setItem(COMPANY_KEY, JSON.stringify(data)); } catch {}
  try { window.dispatchEvent(new CustomEvent("ae-company-changed", { detail: data })); } catch {}
};

// ---- Financial Year (e.g. 2526) ----
// SuperAdmin / Admin can override via User Management → Financial Year card.
// The override is stored in localStorage key `ae_vm_active_fy` and synced via
// settings endpoint. If no override, auto-compute from current date.
const ACTIVE_FY_KEY = "ae_vm_active_fy";
export const getActiveFYOverride = () => {
  try { return (localStorage.getItem(ACTIVE_FY_KEY) || "").trim(); } catch { return ""; }
};
export const setActiveFYOverride = (fy) => {
  const v = (fy || "").trim();
  if (v) localStorage.setItem(ACTIVE_FY_KEY, v);
  else localStorage.removeItem(ACTIVE_FY_KEY);
  try { window.dispatchEvent(new CustomEvent("ae-fy-changed", { detail: { fy: v } })); } catch {}
};
// Normalize any supported FY string (2526 / 25-26 / 2025-2026) → 4-digit `2526`
const _normalizeFY = (s) => {
  const t = String(s || "").trim();
  if (!t) return "";
  if (/^\d{4}$/.test(t)) return t;
  if (/^\d{2}-\d{2}$/.test(t)) return t.replace("-", "");
  if (/^\d{4}-\d{4}$/.test(t)) return `${t.slice(2, 4)}${t.slice(7, 9)}`;
  return "";
};
export const getFY = (date = new Date()) => {
  const override = _normalizeFY(getActiveFYOverride());
  if (override) return override;
  const y = date.getFullYear();
  const m = date.getMonth();
  const startYY = m >= 3 ? y % 100 : (y - 1) % 100;
  const endYY = (startYY + 1) % 100;
  return `${String(startYY).padStart(2, "0")}${String(endYY).padStart(2, "0")}`;
};
// Hyphenated FY (e.g. 25-26) — used for human-readable EMP codes
export const getFYHyphen = (date = new Date()) => {
  const override = _normalizeFY(getActiveFYOverride());
  if (override) return `${override.slice(0, 2)}-${override.slice(2, 4)}`;
  const y = date.getFullYear();
  const m = date.getMonth();
  const startYY = m >= 3 ? y % 100 : (y - 1) % 100;
  const endYY = (startYY + 1) % 100;
  return `${String(startYY).padStart(2, "0")}-${String(endYY).padStart(2, "0")}`;
};
// FY options list for dropdown (last 3 → current → next 2 fiscal years)
export const listFYOptions = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startYY = m >= 3 ? y % 100 : (y - 1) % 100;
  const opts = [];
  for (let d = -3; d <= 2; d++) {
    const s = (startYY + d + 100) % 100;
    const e = (s + 1) % 100;
    opts.push(`${String(s).padStart(2, "0")}${String(e).padStart(2, "0")}`);
  }
  return opts;
};

// ---- Counters ----
export const getCounters = () =>
  read(KEYS.COUNTERS, { vendorSerial: 0, billSerial: 0, pvSerial: 0 });
export const saveCounters = (c) => {
  write(KEYS.COUNTERS, c);
  if (getToken()) apiSetCounters(c).catch(() => {});
};

// Temp Bill Ref: AE + 4-digit + FY (before final approval)
const buildTempBillRef = (serial) => `AE${String(serial).padStart(4, "0")}${getFY()}`;
// Permanent Bill No (Primary Key): BILL + 4-digit + FY (after final approval)
const buildPermanentBillNo = (serial) => `BILL${String(serial).padStart(4, "0")}${getFY()}`;

// Vendor Code: AE + 4-digit serial + JV + FY (e.g., AE0001JV2526)
const nextVendorCode = () => {
  const c = getCounters();
  c.vendorSerial = (c.vendorSerial || 0) + 1;
  saveCounters(c);
  return `AE${String(c.vendorSerial).padStart(4, "0")}JV${getFY()}`;
};

export const STEP_LABEL = {
  1: "Step 1: Creation",
  2: "Step 2: Checking & Verification",
  3: "Step 3: Final Approval",
};

export const BILL_STEP_LABEL = {
  1: "1. Submission",
  2: "2. WO Verify",
  3: "3. Accounts Check",
  4: "4. Mgmt Approval",
  5: "5. Payment Due List",
};

export const EXPENSE_STEP_LABEL = {
  1: "1. Draft",
  2: "2. Prepared",
  3: "3. Checked",
  4: "4. Approved & Paid",
};

// ---- Cross-user sync: Debounced full-snapshot push ----
// CROSS-USER DATA FIX (Feb 2026 round 2): All save* list-level mutators now
// trigger this debounced push so non-SuperAdmin saves actually reach the cloud
// (previously only singular upsert* functions pushed; bulk save* was local-only
// → data appeared only on the device that happened to also fire an upsert).
let _snapPushTimer = null;
const _schedulePush = () => {
  try {
    if (!getToken()) return;
    clearTimeout(_snapPushTimer);
    _snapPushTimer = setTimeout(() => {
      try {
        const payload = {
          vendors: JSON.parse(localStorage.getItem(KEYS.VENDORS) || "[]"),
          bills: JSON.parse(localStorage.getItem(KEYS.BILLS) || "[]"),
          payments: JSON.parse(localStorage.getItem(KEYS.PAYMENTS) || "[]"),
          expenses: JSON.parse(localStorage.getItem(KEYS.EXPENSES) || "[]"),
          boqs: JSON.parse(localStorage.getItem(KEYS.BOQS) || "[]"),
          work_orders: JSON.parse(localStorage.getItem(KEYS.WOS) || "[]"),
          employees: JSON.parse(localStorage.getItem(KEYS.EMPLOYEES) || "[]"),
          paybills: JSON.parse(localStorage.getItem(KEYS.PAYBILLS) || "[]"),
          loans: JSON.parse(localStorage.getItem(KEYS.LOANS) || "[]"),
          advance_requests: JSON.parse(localStorage.getItem(KEYS.ADVANCE_REQS) || "[]"),
          recruitments: JSON.parse(localStorage.getItem("ae_vm_recruitments") || "[]"),
          exits: JSON.parse(localStorage.getItem("ae_vm_exits") || "[]"),
        };
        apiPushSnapshot(payload).then(() => {
          try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch {}
        }).catch(() => {});
      } catch { /* ignore */ }
    }, 1500);
  } catch { /* ignore */ }
};

// ---- Expenses ----
const buildExpenseTempRef = (serial) => `EXR${String(serial).padStart(4, "0")}${getFY()}`;
const buildExpensePermNo = (serial) => `EXP${String(serial).padStart(4, "0")}${getFY()}`;

export const getExpenses = () => read(KEYS.EXPENSES, []);
export const saveExpenses = (list) => {
  write(KEYS.EXPENSES, list);
  _schedulePush();
};

export const createExpenseDraft = () => {
  const c = getCounters();
  c.expenseSerial = (c.expenseSerial || 0) + 1;
  saveCounters(c);
  return {
    id: `x_${Date.now()}`,
    expenseSerial: c.expenseSerial,
    refNo: buildExpenseTempRef(c.expenseSerial),
    permanentExpenseNo: "",
    step: 1,
    date: new Date().toISOString().slice(0, 10),
    category: "Office Expense",
    description: "",
    paidToName: "",
    paymentMode: "Cash",
    // Amount
    basicAmount: 0,
    gstSlab: 0,
    tdsRate: 0,
    otherDeductions: 0,
    // File
    receiptFile: null,
    // Approvals
    preparedByName: "",
    checkedByName: "",
    approvedByName: "",
    approvalDate: "",
    remarks: "",
    // Meta
    revision: 0,
    history: [],
    createdByName: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const computeExpense = (e) => {
  const basic = Number(e.basicAmount) || 0;
  const gst = +(basic * (Number(e.gstSlab) || 0) / 100).toFixed(2);
  const gross = +(basic + gst).toFixed(2);
  const tds = +(basic * (Number(e.tdsRate) || 0) / 100).toFixed(2);
  const other = Number(e.otherDeductions) || 0;
  const netPayable = +(gross - tds - other).toFixed(2);
  return { basic, gst, gross, tds, other, netPayable };
};

export const upsertExpense = (e) => {
  const list = getExpenses();
  const idx = list.findIndex((x) => x.id === e.id);
  e.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = e; else list.push(e);
  saveExpenses(list);
  if (getToken()) apiUpsertExpense(e).catch(() => {});
  return e;
};

export const advanceExpenseStep = (e) => {
  const next = { ...e };
  const approver = _me();
  if (next.step < 4) {
    next.step += 1;
    if (next.step === 4) {
      next.approvalDate = new Date().toISOString().slice(0, 10);
      if (approver) next.approvedByName = approver;
      if (!next.permanentExpenseNo && next.expenseSerial) {
        next.permanentExpenseNo = buildExpensePermNo(next.expenseSerial);
      }
    }
  }
  upsertExpense(next);
  return next;
};

// ---- BOQ (Purchase Management — Bill of Quantity) ----
export const BOQ_STEP_LABEL = {
  1: "1. Draft",
  2: "2. Prepared",
  3: "3. Submitted (→ Accounts)",
  4: "4. Approved",
};

const buildBOQNo = (serial) => `BOQ${String(serial).padStart(4, "0")}${getFY()}`;

export const getBOQs = () => read(KEYS.BOQS, []);
export const saveBOQs = (list) => { write(KEYS.BOQS, list); _schedulePush(); };

export const createBOQDraft = () => {
  const c = getCounters();
  c.boqSerial = (c.boqSerial || 0) + 1;
  saveCounters(c);
  return {
    id: `boq_${Date.now()}`,
    boqSerial: c.boqSerial,
    // Permanent BOQ No is issued only on approval (step === 4).
    // Until then a temp reference identifies the draft.
    boqNo: "",
    tempRefId: `TEMP-BOQ-${String(c.boqSerial).padStart(4, "0")}`,
    step: 1,
    date: new Date().toISOString().slice(0, 10),
    projectSite: "",
    clientName: "",
    refNo: "",
    items: [
      { id: `it_${Date.now()}`, description: "", qty: 0, unit: "Nos", rate: 0, amount: 0 },
    ],
    total: 0,
    attachmentName: "",
    attachmentData: "",
    preparedBy: _me(),
    submittedDate: "",
    remarks: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const computeBOQTotal = (b) => {
  const items = Array.isArray(b.items) ? b.items : [];
  return items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
};

export const upsertBOQ = (b) => {
  const list = getBOQs();
  const idx = list.findIndex((x) => x.id === b.id);
  b.updatedAt = new Date().toISOString();
  b.total = computeBOQTotal(b);
  if (idx >= 0) list[idx] = b; else list.push(b);
  saveBOQs(list);
  if (getToken()) apiUpsertBOQ(b).catch(() => {});
  return b;
};

export const deleteBOQ = (id) => {
  const list = getBOQs().filter((x) => x.id !== id);
  saveBOQs(list);
  if (getToken()) apiDeleteBOQ(id).catch(() => {});
  return list;
};

export const advanceBOQStep = (b) => {
  const next = { ...b };
  const approver = _me();
  if (next.step < 4) {
    next.step += 1;
    if (next.step === 3 && !next.submittedDate) {
      next.submittedDate = new Date().toISOString().slice(0, 10);
    }
    if (next.step === 4) {
      // Issue permanent BOQ No on approval (auto-generate + green in UI)
      if (!next.boqNo) {
        // Use existing boqSerial if present, else allocate a fresh one
        let serial = Number(next.boqSerial) || 0;
        if (!serial) {
          const c = getCounters();
          c.boqSerial = (c.boqSerial || 0) + 1;
          saveCounters(c);
          serial = c.boqSerial;
          next.boqSerial = serial;
        }
        next.boqNo = buildBOQNo(serial);
      }
      if (approver) {
        next.approvedByName = approver;
        next.approvalDate = new Date().toISOString().slice(0, 10);
      }
    }
  }
  return upsertBOQ(next);
};

// ---- Work Orders (Purchase Management) ----
export const WO_STEP_LABEL = {
  1: "1. Draft (Create)",
  2: "2. Prepared",
  3: "3. Submitted (→ Accounts / GM)",
  4: "4. Approved (WO No. issued)",
};

const buildWONo = (serial) => `AE${String(serial).padStart(6, "0")}JV${getFY()}`;
export const UNITS_DEFAULT = [
  // Count / piece
  "Nos", "No.", "Pcs", "Piece", "Each", "Ea", "Set", "Pair", "Unit", "Dozen", "Gross", "Score", "Item",
  // Weight
  "Kg", "Kilogram", "Gram", "gm", "mg", "Quintal", "Qtl", "Tonne", "Ton", "MT", "LB", "Pound", "Ounce", "Oz", "Carat",
  // Length
  "mm", "cm", "Mtr", "Meter", "Km", "Inch", "in", "Feet", "Ft", "Yard", "Yd", "Mile", "RMT", "Running Mtr", "Running Ft", "Furlong",
  // Area
  "Sq.mm", "Sq.cm", "Sq.Mtr", "Sqm", "Sq.Ft", "Sft", "Sq.Yard", "Sq.Inch", "Sq.Km", "Acre", "Hectare", "Bigha", "Kattha", "Marla",
  // Volume
  "Cu.mm", "Cu.cm", "Cu.Mtr", "Cum", "Cu.Ft", "Cft", "Cu.Yard", "Cu.Inch", "Ltr", "Litre", "ML", "Millilitre", "Gallon", "Barrel", "Pint",
  // Time & labour
  "Sec", "Min", "Hour", "Hr", "Day", "Week", "Month", "Year", "Shift", "Man-Day", "Man-Hour", "Man-Month", "Man-Year",
  // Packaging
  "Bag", "Box", "Carton", "Crate", "Roll", "Bundle", "Coil", "Drum", "Can", "Bottle", "Pack", "Packet", "Case", "Pallet", "Sack", "Sheet", "Reel", "Tin", "Container", "Truckload",
  // Trade / bulk / project
  "Lot", "Job", "Lump", "Lumpsum", "LS", "Trip", "Load", "Truck", "Tanker", "Consignment", "Batch", "Session", "Round", "Cycle",
  // Building materials (India-specific)
  "Brass", "Ghan Ft", "Ghan Mtr", "Rft", "Rmtr", "Sqm-Mtr", "Cu Mtr-Km", "Ton-Km",
  // Rebar / steel
  "Rod", "Bar", "Angle", "Channel", "Plate", "Strip", "Wire",
  // Cement / concrete
  "Cement Bag", "50Kg Bag", "25Kg Bag", "Mix", "Cum Concrete",
  // Electrical / mechanical / energy
  "KW", "KWH", "MW", "MWH", "HP", "Amp", "Volt", "KVA", "MVA", "KVAR", "MVAR", "Watt", "Unit (Elec.)",
  // Pressure / flow
  "PSI", "Pa", "kPa", "MPa", "LPM", "LPS", "CFM", "CFS",
  // Temperature ref
  "°C", "°F",
  // Data / IT
  "MB", "GB", "TB", "License", "User (License)", "Seat", "Node",
  // Percentage / ratio / misc
  "%", "Per 100", "Per 1000", "Ratio", "As per Actual", "AS-Actual", "Contract",
  // Service / travel
  "Km-Trip", "Km-Ride", "Km-Ton", "Passenger-Km", "Seat-Km",
];

export const getWOs = () => read(KEYS.WOS, []);
export const saveWOs = (list) => { write(KEYS.WOS, list); _schedulePush(); };

export const createWODraft = (fromBoq = null) => {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const exp = new Date();
  exp.setFullYear(exp.getFullYear() + 1);
  const items = fromBoq && Array.isArray(fromBoq.items) && fromBoq.items.length > 0
    ? fromBoq.items.map((it) => ({ id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, description: it.description, qty: it.qty, unit: it.unit, rate: it.rate, amount: it.amount }))
    : [{ id: `it_${Date.now()}`, description: "", qty: 0, unit: "Nos", rate: 0, amount: 0 }];
  return {
    id: `wo_${Date.now()}`,
    // WO No is issued only on approval
    woNo: "",
    woSerial: 0,
    step: 1,
    woDate: today,
    expiryDate: exp.toISOString().slice(0, 10),
    boqRefId: fromBoq?.id || "",
    boqRefNo: fromBoq?.boqNo || "",
    projectSite: fromBoq?.projectSite || "",
    clientName: fromBoq?.clientName || "",
    vendorCode: "",
    vendorName: "",
    scopeOfWork: "",
    items,
    total: items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    gstSlab: 18,
    paymentTerms: "50% advance on WO issue, 50% on completion",
    deliveryTerms: "Delivery at site within 30 days of WO date",
    retentionPct: 5,
    penaltyClause: "1% per week delay, max 10% of total value",
    warrantyClause: "12 months warranty from date of commissioning",
    termsAndConditions: "1. Prices are inclusive of packing & forwarding.\n2. Rates are firm and no escalation is allowed.\n3. All statutory taxes shall be extra as applicable.\n4. Any dispute shall be subject to Prayagraj jurisdiction.\n5. Vendor to submit tax invoice as per GST regulations.",
    attachmentName: "",
    attachmentData: "",
    preparedBy: _me(),
    submittedDate: "",
    approvedByName: "",
    approvalDate: "",
    remarks: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

export const computeWOTotal = (w) => {
  const items = Array.isArray(w.items) ? w.items : [];
  return items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
};

export const upsertWO = (w) => {
  const list = getWOs();
  const idx = list.findIndex((x) => x.id === w.id);
  w.updatedAt = new Date().toISOString();
  w.total = computeWOTotal(w);
  if (idx >= 0) list[idx] = w; else list.push(w);
  saveWOs(list);
  if (getToken()) apiUpsertWO(w).catch(() => {});
  // External: auto-sync approved Work Orders to the Vendor Portal
  if (Number(w.step) >= 4 && w.woNo) _syncWOToVendorPortal(w);
  return w;
};

export const deleteWO = (id) => {
  const list = getWOs().filter((x) => x.id !== id);
  saveWOs(list);
  if (getToken()) apiDeleteWO(id).catch(() => {});
  return list;
};

// Fire-and-forget POST to the external Vendor Portal so vendors see live WOs.
// Endpoint can be overridden via REACT_APP_VENDOR_PORTAL_URL.
const _vendorPortalUrl = (typeof process !== "undefined" && process.env && process.env.REACT_APP_VENDOR_PORTAL_URL)
  || "https://vendor-portal-458.emergent.host";
const _syncWOToVendorPortal = (wo) => {
  try {
    fetch(`${_vendorPortalUrl}/api/work_orders/sync`, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "arun-enterprises",
        id: wo.id,
        woNo: wo.woNo,
        boqRefNo: wo.boqRefNo || "",
        vendorCode: wo.vendorCode || "",
        vendorName: wo.vendorName || "",
        projectSite: wo.projectSite || "",
        scopeOfWork: wo.scopeOfWork || "",
        woDate: wo.woDate || "",
        expiryDate: wo.expiryDate || "",
        total: Number(wo.total) || 0,
        items: wo.items || [],
        approvedByName: wo.approvedByName || "",
        approvalDate: wo.approvalDate || "",
        step: Number(wo.step) || 0,
        syncedAt: new Date().toISOString(),
      }),
    }).catch(() => { /* silent — portal offline OK */ });
  } catch { /* silent */ }
};

export const advanceWOStep = (w) => {
  const next = { ...w };
  const approver = _me();
  if (next.step < 4) {
    next.step += 1;
    if (next.step === 3 && !next.submittedDate) {
      next.submittedDate = new Date().toISOString().slice(0, 10);
    }
    if (next.step === 4) {
      // Issue permanent Work Order number + fresh expiry from approval date
      const c = getCounters();
      c.woSerial = (c.woSerial || 0) + 1;
      saveCounters(c);
      next.woSerial = c.woSerial;
      next.woNo = buildWONo(c.woSerial);
      const approvalDate = new Date();
      next.approvalDate = approvalDate.toISOString().slice(0, 10);
      if (!next.expiryDate) {
        const exp = new Date(approvalDate);
        exp.setFullYear(exp.getFullYear() + 1);
        next.expiryDate = exp.toISOString().slice(0, 10);
      }
      if (approver) next.approvedByName = approver;
    }
  }
  return upsertWO(next);
};

export const reapproveWO = (w) => {
  const next = { ...w, approvedByName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() };
  return upsertWO(next);
};

// ---- Date formatting helper ----
// Convert an ISO YYYY-MM-DD (or full ISO) to DD/MM/YYYY for display.
// Returns "" if input is falsy; returns raw value if unparseable.
export const fmtDMY = (iso) => {
  if (!iso) return "";
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

// ---- Re-approval helpers (bump approver name + approvalDate on already-approved items) ----
// Auto-fill approver name ONLY for SuperAdmin / Admin — for User/Viewer/GM/etc we save empty
// (approval gating already blocks non-approvers, but this ensures the DB field also stays clean).
const _me = () => {
  const p = read(KEYS.AUTH, null) || {};
  const role = isSuperAdmin(p.user) ? "SuperAdmin" : (p.role || "User");
  if (role !== "SuperAdmin" && role !== "Admin") return "";
  return (p.name || p.user || "").trim();
};
export const reapproveVendor = (v) => {
  const next = { ...v, approvedByName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() };
  return upsertVendor(next);
};
export const reapproveBill = (b) => {
  const next = { ...b, approverName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() };
  return upsertBill(next);
};
export const reapproveExpense = (e) => {
  const next = { ...e, approvedByName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() };
  return upsertExpense(next);
};
export const reapproveBOQ = (b) => {
  const next = { ...b, approvedByName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() };
  return upsertBOQ(next);
};
export const reapproveVoucher = (p) => {
  const list = getPayments().map((x) => x.id === p.id
    ? { ...x, approvedByName: _me(), approvalDate: new Date().toISOString().slice(0, 10), reapprovedAt: new Date().toISOString() }
    : x);
  savePayments(list);
  return list.find((x) => x.id === p.id);
};

// ---- Vendors ----
export const getVendors = () => {
  // Normalize legacy vendors with missing/invalid step to step 1 (Draft)
  const list = read(KEYS.VENDORS, []);
  let changed = false;
  const fixed = list.map((v) => {
    if (![1, 2, 3].includes(v.step)) { changed = true; return { ...v, step: 1 }; }
    return v;
  });
  if (changed) write(KEYS.VENDORS, fixed);
  return fixed;
};
export const saveVendors = (list) => { write(KEYS.VENDORS, list); _schedulePush(); };

// Generate a Temp Ref ID: TMP-XXXXXXXX (8 hex chars)
export const generateTempRefId = () => {
  let s = "";
  const chars = "0123456789ABCDEF";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 16)];
  return `TMP-${s}`;
};

export const createVendorDraft = () => ({
  id: `v_${Date.now()}`,
  tempRefId: "",
  vendorCode: "",
  step: 1,
  // Project & Site
  projectCode: "",
  siteName: "",
  // Vendor basic
  vendorType: "Vendor",
  firmName: "",
  contactPerson: "",
  mobileNo: "",
  email: "",
  gstNo: "",
  panNo: "",
  streetAddress: "",
  city: "",
  state: "",
  pincode: "",
  // Bank
  bankName: "",
  branchName: "",
  ifscCode: "",
  bankAddress: "",
  bankCity: "",
  bankState: "",
  accountHolder: "",
  accountNumber: "",
  accountType: "Current Account",
  // Workflow
  createdByName: "",
  creationDate: new Date().toISOString().slice(0, 10),
  checkedByName: "",
  preparedByName: "",
  approvedByName: "",
  approvalDate: "",
  expiryDate: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const upsertVendor = (v) => {
  const list = getVendors();
  const idx = list.findIndex((x) => x.id === v.id);
  v.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = v; else list.push(v);
  saveVendors(list);
  // fire-and-forget cloud sync
  if (getToken()) apiUpsertVendor(v).catch(() => {});
  return v;
};

export const findVendorByAny = (q) => {
  if (!q) return null;
  const term = q.trim().toLowerCase();
  if (!term) return null;
  const list = getVendors();
  return (
    list.find((v) => (v.vendorCode || "").toLowerCase() === term) ||
    list.find((v) => (v.tempRefId || "").toLowerCase() === term) ||
    list.find((v) => (v.vendorCode || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.tempRefId || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.firmName || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.contactPerson || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.mobileNo || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.panNo || "").toLowerCase().includes(term)) ||
    list.find((v) => (v.gstNo || "").toLowerCase().includes(term)) ||
    null
  );
};

// Backwards-compat used elsewhere
export const findVendorByCode = (code) => {
  if (!code) return null;
  const list = getVendors();
  return (
    list.find((v) => v.vendorCode === code) ||
    list.find((v) => v.tempRefId === code) ||
    null
  );
};

export const advanceVendorStep = (v) => {
  const next = { ...v };
  const approver = _me();
  if (next.step === 1) {
    next.step = 2;
  } else if (next.step === 2) {
    next.step = 3;
    if (approver) next.approvedByName = approver;
    // Preserve existing vendorCode on Re-Approval; only generate a new one for first approval
    if (!next.vendorCode) {
      next.vendorCode = nextVendorCode();
      const today = new Date();
      next.approvalDate = today.toISOString().slice(0, 10);
      const exp = new Date(today);
      exp.setFullYear(exp.getFullYear() + 2);
      next.expiryDate = exp.toISOString().slice(0, 10);
    } else {
      // Re-Approval: keep vendorCode & expiryDate, only refresh approvalDate
      next.approvalDate = new Date().toISOString().slice(0, 10);
    }
  }
  upsertVendor(next);
  return next;
};

// ---- Bills ----
export const getBills = () => read(KEYS.BILLS, []);
export const saveBills = (list) => { write(KEYS.BILLS, list); _schedulePush(); };

export const createBillDraft = () => {
  const c = getCounters();
  c.billSerial = (c.billSerial || 0) + 1;
  saveCounters(c);
  return {
    id: `b_${Date.now()}`,
    billSerial: c.billSerial,
    refNo: buildTempBillRef(c.billSerial),      // AE0001{FY} (active till approval)
    permanentBillNo: "",                          // BILL0001{FY} (generated on final approval — primary key)
    processDate: new Date().toISOString().slice(0, 10),
    step: 1,
    vendorCode: "",
    vendorSnapshot: null,
    // Work Order
    workOrderNo: "",
    workOrderDate: "",
    workOrderExpiryDate: "",
    projectCodeLocation: "",
    workScope: "",
    totalWOValue: 0,
    previousAdvance: 0,
    // Item (Quantity/UOM)
    itemDescription: "",
    quantity: 0,
    uom: "Nos",
    // Item & Work Scope Breakdown Details
    items: [],
    // Bill
    billNo: "",
    billDate: new Date().toISOString().slice(0, 10),
    basicAmount: 0,
    gstSlab: 18,
    tdsRate: 2,
    otherDeductions: 0,
    dueDate: "",
    // Approvals (5-step)
    siteInchargeName: "",
    measurementStatus: "Verified & OK",
    purchaseInchargeName: "",
    woRateStatus: "Matched with WO",
    accountInchargeName: "",
    gstTdsCheck: "TDS & GST Verified",
    approverName: "",
    approvalStatus: "Approved For Payment",
    // Payment schedule
    scheduledDueDate: "",
    priorityLevel: "High Priority (Immediate)",
    paymentMode: "RTGS / NEFT Bank Transfer",
    todoNotes: "",
    finalReleaseStatus: "Added to Due List (Unpaid)",
    // Meta
    createdByName: "",
    approvalDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const computeBill = (b) => {
  const basic = Number(b.basicAmount) || 0;
  const gst = +(basic * (Number(b.gstSlab) || 0) / 100).toFixed(2);
  const gross = +(basic + gst).toFixed(2);
  const tds = +(basic * (Number(b.tdsRate) || 0) / 100).toFixed(2);
  const other = Number(b.otherDeductions) || 0;
  const netPayable = +(gross - tds - other).toFixed(2);
  return { basic, gst, gross, tds, other, netPayable };
};

export const upsertBill = (b) => {
  const list = getBills();
  const idx = list.findIndex((x) => x.id === b.id);
  b.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = b; else list.push(b);
  saveBills(list);
  if (getToken()) apiUpsertBill(b).catch(() => {});
  return b;
};

export const advanceBillStep = (b) => {
  const next = { ...b };
  const approver = _me();
  if (next.step < 5) {
    next.step += 1;
    if (next.step === 5) {
      next.approvalDate = new Date().toISOString().slice(0, 10);
      if (approver) next.approverName = approver;
      if (!next.permanentBillNo && next.billSerial) {
        next.permanentBillNo = buildPermanentBillNo(next.billSerial);
      }
    }
  }
  upsertBill(next);
  return next;
};

// ---- Payment vouchers ----
// Returns payments with DUPLICATE pvNo rows collapsed to the first occurrence.
// Defensive against legacy data where the auto-PV generator previously inserted
// the same voucher multiple times (e.g. repeated step-4 transitions on Pay Bills).
export const getPayments = () => {
  const raw = read(KEYS.PAYMENTS, []);
  const seen = new Set();
  const deduped = [];
  for (const p of raw) {
    const key = p?.pvNo || p?.id;
    if (!key) { deduped.push(p); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped;
};
// Permanently removes any duplicate pvNo entries in the backing store.
// Called once on app boot (see migration below) to clean legacy duplicates.
export const dedupePaymentsStore = () => {
  const raw = read(KEYS.PAYMENTS, []);
  const seen = new Set();
  const clean = [];
  let removed = 0;
  for (const p of raw) {
    const key = p?.pvNo;
    if (!key) { clean.push(p); continue; }
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    clean.push(p);
  }
  if (removed > 0) {
    write(KEYS.PAYMENTS, clean);
    if (getToken()) apiPushPayments(clean).catch(() => {});
    try { console.info(`[payments] Removed ${removed} duplicate voucher(s)`); } catch {}
  }
  return removed;
};

// ---------------------------------------------------------------------------
// UNIVERSAL de-dup migration — one process number appears once (per module).
// Scans every major collection and keeps the FIRST occurrence of each unique
// identifier (vendorCode / permanentBillNo / refNo / expenseNo / boqNo /
// woNo / monthKey / empCode / pvNo). Called on app boot to clean legacy data.
// Returns total number of rows removed.
// ---------------------------------------------------------------------------
export const dedupeAllStores = () => {
  const dedupeByKey = (storeKey, keyFn, label) => {
    try {
      const raw = read(storeKey, []);
      if (!Array.isArray(raw) || raw.length === 0) return 0;
      const seen = new Set();
      const clean = [];
      let removed = 0;
      for (const row of raw) {
        const k = keyFn(row);
        if (!k) { clean.push(row); continue; }
        if (seen.has(k)) { removed++; continue; }
        seen.add(k);
        clean.push(row);
      }
      if (removed > 0) {
        write(storeKey, clean);
        try { console.info(`[${label}] removed ${removed} duplicate row(s)`); } catch {}
      }
      return removed;
    } catch { return 0; }
  };
  let total = 0;
  total += dedupeByKey(KEYS.PAYMENTS,  (p) => p?.pvNo,                                                  "payments");
  total += dedupeByKey(KEYS.BILLS,     (b) => b?.permanentBillNo || b?.refNo,                           "bills");
  total += dedupeByKey(KEYS.VENDORS,   (v) => v?.vendorCode || v?.tempRefId,                            "vendors");
  total += dedupeByKey(KEYS.EXPENSES,  (e) => e?.expenseNo || e?.refNo,                                 "expenses");
  total += dedupeByKey(KEYS.BOQS,      (b) => b?.boqNo || b?.refNo,                                     "boqs");
  total += dedupeByKey(KEYS.WOS,       (w) => w?.woNo || w?.refNo,                                      "wos");
  total += dedupeByKey(KEYS.PAYBILLS,  (p) => p?.monthKey || p?.refNo,                                  "paybills");
  total += dedupeByKey(KEYS.EMPLOYEES, (e) => e?.empCode,                                               "employees");
  total += dedupeByKey(KEYS.ADVANCE_REQS, (r) => r?.refNo,                                              "advance-requests");
  total += dedupeByKey(KEYS.LOANS,     (l) => l?.id,                                                    "loans");
  if (total > 0 && getToken()) {
    // Push cleaned snapshot so backend reflects reality (prevents re-sync of dupes)
    _schedulePush();
  }
  return total;
};
export const savePayments = (list) => {
  // ZOMBIE RESURRECTION FIX — reconcile deletes before upserting:
  // compare old vs new pvNo set and send DELETE for records that disappeared.
  // Without this, a client-side delete / GPV→PN rename only upserted survivors;
  // the obsolete record remained in the cloud and reappeared on next sync.
  try {
    const prev = read(KEYS.PAYMENTS, []);
    const nextIds = new Set(list.map((x) => x.pvNo).filter(Boolean));
    const removed = prev.map((x) => x.pvNo).filter((p) => p && !nextIds.has(p));
    if (removed.length && getToken()) {
      apiDeletePaymentsBulk(removed).catch(() => {});
    }
  } catch (_e) { /* non-fatal */ }
  write(KEYS.PAYMENTS, list);
  if (getToken()) apiPushPayments(list).catch(() => {});
};

// Explicit single-voucher delete with cloud reconciliation.
// Prefer this over `savePayments(filtered)` for deletes — guarantees backend removal.
export const deletePaymentCloud = (pvNo) => {
  const list = read(KEYS.PAYMENTS, []).filter((x) => x.pvNo !== pvNo);
  write(KEYS.PAYMENTS, list);
  if (getToken()) apiDeletePayment(pvNo).catch(() => {});
  if (getToken()) apiPushPayments(list).catch(() => {});
  return list;
};

// GPV = Generated Payment Voucher (draft prefix shown in Section D "Generate Register").
// On Approval the prefix is replaced with PN (Payment Number) in Reports.handleApprove.
// After approval it appears in the Payments Register with PN/... series.
export const nextPvNo = () => {
  const c = getCounters();
  c.pvSerial = (c.pvSerial || 0) + 1;
  saveCounters(c);
  return `GPV/${getFY()}/${String(c.pvSerial).padStart(4, "0")}`;
};

// On approval, convert draft GPV prefix → final PN prefix (same serial retained).
// Keeps legacy PV/... records untouched for backward compatibility.
export const toApprovedPvNo = (draftNo) => {
  const s = String(draftNo || "");
  if (s.startsWith("GPV/")) return "PN/" + s.slice(4);
  return s; // legacy PV/... or already PN/... — leave as-is
};

// ---- Bills lookup helpers ----
export const getBillsForVendor = (vendorCode) => {
  if (!vendorCode) return [];
  return getBills().filter((b) => b.vendorCode === vendorCode);
};
export const getPaymentsForVendor = (vendorCode) => {
  if (!vendorCode) return [];
  return getPayments().filter((p) => p.vendorCode === vendorCode);
};
export const vendorAccountSummary = (vendorCode) => {
  const bills = getBillsForVendor(vendorCode);
  const payments = getPaymentsForVendor(vendorCode);
  const approvedBills = bills.filter((b) => b.step === 5);
  const totalBilled = approvedBills.reduce((s, b) => s + computeBill(b).netPayable, 0);
  const totalPaid = payments
    .filter((p) => p.status === "Approved")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalOutstanding = +(totalBilled - totalPaid).toFixed(2);
  return {
    totalBillsRaised: bills.length,
    approvedBillsCount: approvedBills.length,
    totalBilled: +totalBilled.toFixed(2),
    totalPaid: +totalPaid.toFixed(2),
    totalOutstanding,
  };
};

// ---- Auth & Users (cloud-backed via /api/auth) ----
export const createUser = async ({ name, email, username, password, role = "User", mobile = "", employeeId = "", designation = "" }) => {
  // Accepts either email or username; if only username provided, treat as email
  const identifier = (email || username || "").trim().toLowerCase();
  if (!identifier) throw new Error("Email is required");
  if (!identifier.includes("@")) throw new Error("Please use a valid email address");
  const trimmedPass = (password || "").trim();
  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new Error("Full name is required");
  if (trimmedPass.length < 4) throw new Error("Password must be at least 4 characters");
  const { token, user } = await apiRegister(identifier, trimmedPass, trimmedName, role, {
    mobile: (mobile || "").trim(),
    employeeId: (employeeId || "").trim(),
    designation: (designation || "").trim(),
  });
  setToken(token);
  write(KEYS.AUTH, { user: user.email, name: user.name, role: user.role, at: Date.now() });
  return user;
};

export const login = async (u, p) => {
  const identifier = (u || "").trim();
  const password = (p || "").trim();
  try {
    const { token, user } = await apiLogin(identifier, password);
    setToken(token);
    write(KEYS.AUTH, {
      user: user.email, name: user.name, role: user.role,
      permissions: user.permissions || null,
      at: Date.now(),
    });
    // Pull cloud snapshot after successful login so this device has latest data
    try { await syncFromCloud(); } catch (e) { /* silent — offline OK */ }
    return true;
  } catch (e) {
    return false;
  }
};

export const logout = async () => {
  try {
    const { apiLogout } = await import("./api");
    apiLogout().catch(() => {});
  } catch (_e) { /* noop */ }
  localStorage.removeItem(KEYS.AUTH);
  clearToken();
};
export const isAuthed = () => !!read(KEYS.AUTH, null) && !!getToken();
// Returns the logged-in user's display name (never the raw email).
// Falls back order: profile.name (if NOT email-like) → full_name (if NOT email-like)
// → employee_id → "Ashish Srivastava" for super admin → Title-Cased email prefix → "".
const _looksLikeEmail = (s) => typeof s === "string" && s.includes("@");
export const currentUser = () => {
  const auth = read(KEYS.AUTH, null);
  if (!auth) return "";
  const name = String(auth.name || "").trim();
  if (name && !_looksLikeEmail(name)) return name;
  const fullName = String(auth.full_name || "").trim();
  if (fullName && !_looksLikeEmail(fullName)) return fullName;
  const empId = String(auth.employee_id || "").trim();
  if (empId) return empId;
  const email = auth.user || "";
  // Super admin → canonical name
  if (email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL) return "Ashish Srivastava";
  // Return Title-Cased email-prefix (before @) as last-resort display label — never the full email
  return email.includes("@") ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : email;
};
export const currentUserProfile = () => read(KEYS.AUTH, null);

// ---- Permission model ----
// Primary Super Admin — has ALL powers including Final Approval / Re-Approval / Reset All Data
export const SUPER_ADMIN_EMAIL = "arunenterprises2023@gmail.com";
// Designated Final Approver — the only "role: Admin" user (besides Super Admin) allowed
// to perform Final Approval / Re-Approval on Vendors, Bills and Payment Vouchers.
export const APPROVER_EMAIL = "kl.srivastava@arunenterprises.online";
// Canonical display name used everywhere Final Approval / Re-Approval signs off
export const APPROVER_NAME = "Ashish Srivastava";
// Dedicated Accounts Manager — Komal Srivastava (Admin role). Approves Weekly Fooding,
// Advance Requests, and other Accounts-flow approvals even if her stored profile
// designation ever drifts.  Case-insensitive email match (Feb-2026 user request).
export const ACCOUNTS_MANAGER_EMAILS = [
  "komal.srivastava@arunenterprises.online",
];
export const ACCOUNTS_MANAGER_NAME = "Komal Srivastava";

// All roles supported in the app. SuperAdmin is not assignable — it is fixed to
// the SUPER_ADMIN_EMAIL constant above.
export const ROLES = ["Admin", "GM", "Purchase", "Accounts", "Viewer", "User"];

export const isSuperAdmin = (email) =>
  (email || "").toLowerCase().trim() === SUPER_ADMIN_EMAIL;
export const canFinalApprove = (email) => {
  const e = (email || "").toLowerCase().trim();
  return e === SUPER_ADMIN_EMAIL || e === APPROVER_EMAIL;
};
export const currentUserEmail = () => (read(KEYS.AUTH, null)?.user || "").toLowerCase().trim();

// Effective role for the currently signed-in user. SuperAdmin is derived from email,
// everything else is read from the stored profile role.
export const currentRole = () => {
  const p = read(KEYS.AUTH, null) || {};
  if (isSuperAdmin(p.user)) return "SuperAdmin";
  return (p.role || "User");
};

// Two-tier permission model (as per user rules):
// - User / Purchase / Accounts / GM (creator-tier): Create / Edit / Submit / Download
// - Admin / SuperAdmin (approver-tier): everything above + Final Approval / Re-Approval
// - Viewer: read-only + download
// If a per-user override exists in auth profile (`permissions` map), it wins over the role default.
const _myPerms = () => {
  const p = read(KEYS.AUTH, null) || {};
  return p.permissions && typeof p.permissions === "object" ? p.permissions : null;
};
export const canCreate = () => {
  if (isSuperAdmin(currentUserEmail())) return true;
  const p = _myPerms();
  if (p && typeof p.create === "boolean") return p.create;
  return currentRole() !== "Viewer";
};
export const canEdit = () => {
  if (isSuperAdmin(currentUserEmail())) return true;
  const p = _myPerms();
  if (p && typeof p.edit === "boolean") return p.edit;
  return canCreate();
};
export const canSubmit = () => {
  if (isSuperAdmin(currentUserEmail())) return true;
  const p = _myPerms();
  if (p && typeof p.submit === "boolean") return p.submit;
  return canCreate();
};
export const canDownload = () => true; // everyone (including Viewer) can download
export const canApprove = () => {
  if (isSuperAdmin(currentUserEmail())) return true;
  const p = _myPerms();
  if (p && typeof p.approve === "boolean") return p.approve;
  const r = currentRole();
  return ["SuperAdmin", "Admin"].includes(r);
};
// Deleting an already-approved (step >= 4) document is a destructive action
// reserved for SuperAdmin and Admin role only. Per-user permission overrides
// cannot grant this capability — role is the sole gate.
export const canDeleteApproved = () => {
  const r = currentRole();
  return r === "SuperAdmin" || r === "Admin";
};
// Universal delete gate for ALL persistent record deletions (employee, bill,
// vendor, recruit, exit, advance, loan, PV, BOQ, WO, etc.) across every
// department/section. STRICTLY role-based: Admin / SuperAdmin only, bypasses
// any per-user permission grant. Form-row (line-item) removals during data
// entry are NOT gated by this.
export const canDelete = () => {
  const r = currentRole();
  return r === "SuperAdmin" || r === "Admin";
};
// Backward-compat aliases used by older code paths
export const canApproveAccounts = () => canApprove();
export const canApproveGM = () => canApprove();

// Advance Request / Weekly Fooding approval policy (Feb 2026 · user request):
// Allowed approvers:
//   1. SuperAdmin (always)
//   2. Any user whose stored profile designation === "Accounts Manager" (case-insensitive)
//   3. Specific whitelisted emails in ACCOUNTS_MANAGER_EMAILS (e.g. Komal Srivastava)
export const isAccountsManager = () => {
  const p = currentUserProfile();
  if (!p) return false;
  const email = (p.user || "").toLowerCase().trim();
  if (isSuperAdmin(email)) return true;
  if (ACCOUNTS_MANAGER_EMAILS.map((x) => x.toLowerCase().trim()).includes(email)) return true;
  const d = String(p.designation || "").toLowerCase().trim();
  return d === "accounts manager" || d === "account manager" || d === "accountsmanager" || d === "accounts-manager";
};
export const isReadOnly = () => currentRole() === "Viewer";

// ==================== HR: EMPLOYEE MASTER ====================
export const EMPLOYEE_STEP_LABEL = {
  1: "1. Draft (HR Data Entry)",
  2: "2. Submitted for HR Verification",
  3: "3. Verified · Awaiting HR Manager",
  4: "4. Awaiting GM Final Approval",
  5: "5. Finalized · Permanent EMP Code Issued",
};

const buildEmpCode = (serial) => `AE/EMP/${String(serial).padStart(6, "0")}/${getFYHyphen()}`;
const buildEmpTempCode = (serial) => `AE/TMP/${String(serial).padStart(6, "0")}/${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

export const getEmployees = () => read(KEYS.EMPLOYEES, []);
export const saveEmployees = (list) => { write(KEYS.EMPLOYEES, list); _schedulePush(); };

export const createEmployeeDraft = () => {
  const c = getCounters();
  c.empSerial = (c.empSerial || 0) + 1;
  saveCounters(c);
  return {
    id: `emp_${Date.now()}`,
    empSerial: c.empSerial,
    tempCode: buildEmpTempCode(c.empSerial), // alpha+numeric temp code
    empCode: "", // permanent — issued at step 5 approval
    step: 1,
    // Application Reference (top of form)
    advertisementNo: "", dateOfFiling: new Date().toISOString().slice(0, 10),
    projectSite: "", location: "", appliedPost: "",
    // Photo & Signature
    photoUrl: "", signatureUrl: "",
    // Personal
    fullName: "", fatherName: "", motherName: "", spouseName: "",
    dob: "", gender: "M", maritalStatus: "Single", bloodGroup: "", nationality: "Indian", religion: "", category: "General",
    // Job
    doj: new Date().toISOString().slice(0, 10),
    designation: "", department: "Operations", reportingManager: "",
    // Contact
    contactMobile: "", contactAltMobile: "", contactEmail: "",
    // Structured addresses
    presentLine: "", presentCity: "", presentState: "", presentPincode: "",
    permanentLine: "", permanentCity: "", permanentState: "", permanentPincode: "",
    sameAsPresent: false,
    // Legacy fallback
    presentAddress: "", permanentAddress: "", address: "",
    // KYC
    aadhaar: "", pan: "",
    // Bank (expanded with IFSC auto-fill)
    bankName: "", bankBranch: "", bankCity: "", bankAddress: "",
    bankAccount: "", bankAccountType: "Savings", ifsc: "",
    // Statutory
    pfNo: "", esicNo: "", uan: "",
    // Salary
    ctcAnnual: 0, basic: 0, hra: 0, da: 0, special: 0, bonus: 0,
    // Dynamic sections
    familyMembers: [], educations: [], experiences: [], references: [],
    documents: [], // {type, name, dataUrl, sizeKB}
    // Declaration
    declarationDate: new Date().toISOString().slice(0, 10),
    declarationPlace: "",
    createdByName: _me(), checkedByName: "", verifiedByName: "", approvedByName: "", finalizedByName: "",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    submittedAt: "", checkedAt: "", verifiedAt: "", approvedAt: "", finalizedAt: "",
    remarks: "", history: [], revision: 0,
    status: "Active",
  };
};

export const upsertEmployee = (e) => {
  const list = getEmployees();
  const idx = list.findIndex((x) => x.id === e.id);
  e.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = e; else list.push(e);
  saveEmployees(list);
  if (getToken()) apiUpsertEmployee(e).catch(() => {});
  return e;
};

export const deleteEmployee = (id) => {
  const list = getEmployees().filter((x) => x.id !== id);
  saveEmployees(list);
  if (getToken()) apiDeleteEmployee(id).catch(() => {});
  return list;
};

export const advanceEmployeeStep = (e) => {
  const next = { ...e };
  const actor = _me();
  const now = new Date().toISOString();
  if (Number(next.step) < 5) {
    next.step = Number(next.step) + 1;
    if (next.step === 2) { next.submittedAt = now; }
    if (next.step === 3) { next.verifiedAt = now; if (!next.verifiedByName && actor) next.verifiedByName = actor; }
    if (next.step === 4) { next.checkedAt = now; if (!next.checkedByName && actor) next.checkedByName = actor; }
    if (next.step === 5) {
      // Issue permanent EMP code
      if (!next.empCode) {
        let serial = Number(next.empSerial) || 0;
        if (!serial) {
          const c = getCounters();
          c.empSerial = (c.empSerial || 0) + 1;
          saveCounters(c);
          serial = c.empSerial;
          next.empSerial = serial;
        }
        next.empCode = buildEmpCode(serial);
      }
      next.finalizedAt = now;
      if (!next.finalizedByName && actor) next.finalizedByName = actor;
      if (!next.approvedByName && actor) next.approvedByName = actor;
      if (!next.approvedAt) next.approvedAt = now;
    }
  }
  return upsertEmployee(next);
};

export const reapproveEmployee = (e) => {
  const next = { ...e };
  const actor = _me();
  next.revision = (Number(next.revision) || 0) + 1;
  const history = Array.isArray(next.history) ? next.history : [];
  history.push({ action: "Re-Approved", by: actor, at: new Date().toISOString() });
  next.history = history;
  next.approvedByName = actor || next.approvedByName;
  next.approvedAt = new Date().toISOString();
  return upsertEmployee(next);
};

// Compute monthly gross / deductions / net for an employee
export const computeSalary = (e, opts = {}) => {
  const daysInMonth = opts.daysInMonth || 30;
  const daysPresent = opts.daysPresent ?? daysInMonth;
  const basic = Number(e.basic) || 0;
  const hra = Number(e.hra) || 0;
  const da = Number(e.da) || 0;
  const special = Number(e.special) || 0;
  const bonus = Number(e.bonus) || 0;
  const gross = basic + hra + da + special + bonus;
  const perDay = daysInMonth > 0 ? gross / daysInMonth : 0;
  const earned = Math.round(perDay * daysPresent);
  const pf = Math.round(basic * 0.12); // 12% of basic
  const esic = gross <= 21000 ? Math.round(gross * 0.0075) : 0; // 0.75% if gross ≤ 21k
  const proftax = gross > 10000 ? 200 : 0;
  const tds = Math.round((earned * 0.0) || 0); // placeholder — user can override
  const deductions = pf + esic + proftax + tds;
  const net = Math.max(0, earned - deductions);
  return { gross, earned, pf, esic, proftax, tds, deductions, net, daysInMonth, daysPresent };
};

// ==================== HR: ATTENDANCE ====================
// A single attendance record covers ONE month for ONE employee:
// { id: "att_{empId}_{YYYYMM}", empId, year, month, days: { "01": "P", "02": "A", "03": "L", ... } }
export const getAttendance = () => read(KEYS.ATTENDANCE, []);
export const saveAttendance = (list) => write(KEYS.ATTENDANCE, list);

export const getMonthAttendance = (empId, year, month) => {
  const key = `att_${empId}_${year}${String(month).padStart(2, "0")}`;
  return getAttendance().find((a) => a.id === key) || { id: key, empId, year, month, days: {} };
};

export const upsertAttendance = (a) => {
  const list = getAttendance();
  const idx = list.findIndex((x) => x.id === a.id);
  a.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = a; else list.push(a);
  saveAttendance(list);
  if (getToken()) apiUpsertAttendance(a).catch(() => {});
  return a;
};

// ==================== HR: LEAVE APPLICATIONS ====================
export const LEAVE_TYPES = ["CL", "SL", "EL", "LWP", "Comp-Off"];
export const LEAVE_STATUS = { 1: "Draft", 2: "Submitted", 3: "Approved", 4: "Rejected" };
const LEAVES_KEY = "ae_vm_hr_leaves";
export const getLeaves = () => read(LEAVES_KEY, []);
export const saveLeaves = (list) => write(LEAVES_KEY, list);
export const createLeaveDraft = (empId = "") => ({
  id: `lv_${Date.now()}`,
  empId,
  type: "CL",
  from: new Date().toISOString().slice(0, 10),
  to: new Date().toISOString().slice(0, 10),
  days: 1,
  reason: "",
  status: 1,
  appliedBy: _me(),
  approvedBy: "",
  approvedAt: "",
  createdAt: new Date().toISOString(),
});
export const upsertLeave = (l) => {
  const list = getLeaves();
  const idx = list.findIndex((x) => x.id === l.id);
  if (idx >= 0) list[idx] = l; else list.push(l);
  saveLeaves(list);
  return l;
};
export const deleteLeave = (id) => { saveLeaves(getLeaves().filter((x) => x.id !== id)); };
export const approveLeave = (id, approve = true) => {
  const list = getLeaves();
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return;
  list[idx].status = approve ? 3 : 4;
  list[idx].approvedBy = _me();
  list[idx].approvedAt = new Date().toISOString();
  saveLeaves(list);
  // Auto-mark attendance days as "L" when approved
  if (approve) {
    const lv = list[idx];
    const from = new Date(lv.from); const to = new Date(lv.to);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear(), m = d.getMonth() + 1, dd = String(d.getDate()).padStart(2, "0");
      const rec = getMonthAttendance(lv.empId, y, m);
      rec.days[dd] = "L";
      upsertAttendance(rec);
    }
  }
};

// ==================== HR: RECRUITMENT ====================
// Workflow: 1 Draft → 2 Submitted to GM → 3 GM Approved (Advertisement Published) → 4 Offered → 5 Joined → 6 Rejected
export const RECRUIT_STATUS = { 1: "Draft", 2: "Submitted to GM", 3: "GM Approved · Published", 4: "Offered", 5: "Joined", 6: "Rejected" };
const RECRUITS_KEY = "ae_vm_hr_recruits";
export const getRecruitments = () => read(RECRUITS_KEY, []);
export const saveRecruitments = (list) => { write(RECRUITS_KEY, list); _schedulePush(); };
// Advertisement No: ADV + 4-digit serial + FY (e.g., ADV0001-2526)
const nextAdvertisementNo = () => {
  const c = getCounters();
  c.adsSerial = (c.adsSerial || 0) + 1;
  saveCounters(c);
  return `ADV${String(c.adsSerial).padStart(4, "0")}-${getFY()}`;
};
export const createRecruitDraft = () => ({
  id: `rec_${Date.now()}`,
  advertisementNo: "", // auto on GM approval
  requisitionDate: new Date().toISOString().slice(0, 10),
  position: "", department: "Operations",
  vacancies: 1,
  experienceRequired: "", qualificationRequired: "",
  budgetCTC: 0,
  reasonForHire: "", targetJoinDate: "",
  // Candidate fields (filled after advert runs)
  candidateName: "", candidateMobile: "", candidateEmail: "",
  experienceYears: 0, qualification: "",
  offerCTC: 0, offerDate: "",
  status: 1,
  remarks: "",
  gmApprovedByName: "", gmApprovedAt: "",
  submittedByName: "", submittedAt: "",
  createdBy: _me(), createdByName: _me(), createdAt: new Date().toISOString(),
  history: [],
});
export const upsertRecruit = (r) => {
  const list = getRecruitments();
  const idx = list.findIndex((x) => x.id === r.id);
  const next = { ...r, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = next; else list.push(next);
  saveRecruitments(list);
  if (getToken()) apiUpsertRecruitment(next).catch(() => {});
  return next;
};
// Advance workflow: Draft(1) → Submitted(2) → GM Approved(3) → Offered(4) → Joined(5)
export const advanceRecruitStep = (r) => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...r, status: Math.min(5, (Number(r.status) || 1) + 1), updatedAt: now };
  next.history = [...(r.history || [])];
  if (next.status === 2) { next.submittedByName = me; next.submittedAt = now; next.history.push({ action: "Submitted to GM", at: now, by: me }); }
  if (next.status === 3) {
    next.gmApprovedByName = me;
    next.gmApprovedAt = now;
    if (!next.advertisementNo) next.advertisementNo = nextAdvertisementNo();
    next.history.push({ action: `GM Approved · Advertisement ${next.advertisementNo} published`, at: now, by: me });
  }
  if (next.status === 4) { next.offeredByName = me; next.offeredAt = now; next.history.push({ action: "Offer Letter Issued", at: now, by: me }); }
  saveRecruitments(getRecruitments().map((x) => x.id === next.id ? next : x));
  return next;
};
export const rejectRecruit = (r, reason = "") => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...r, status: 6, rejectReason: reason, rejectedByName: me, rejectedAt: now, updatedAt: now };
  next.history = [...(r.history || []), { action: `Rejected: ${reason || "—"}`, at: now, by: me }];
  saveRecruitments(getRecruitments().map((x) => x.id === next.id ? next : x));
  return next;
};
export const deleteRecruit = (id) => { saveRecruitments(getRecruitments().filter((x) => x.id !== id)); if (getToken()) apiDeleteRecruitment(id).catch(() => {}); };
// Convert accepted offer → auto-create employee draft
export const convertRecruitToEmployee = (r) => {
  const emp = createEmployeeDraft();
  emp.fullName = r.candidateName;
  emp.designation = r.position;
  emp.department = r.department;
  emp.contactMobile = r.candidateMobile;
  emp.contactEmail = r.candidateEmail;
  emp.ctcAnnual = r.offerCTC;
  emp.basic = Math.round(r.offerCTC * 0.5 / 12);
  emp.hra = Math.round(r.offerCTC * 0.2 / 12);
  emp.da = Math.round(r.offerCTC * 0.1 / 12);
  emp.special = Math.round(r.offerCTC * 0.2 / 12);
  emp.doj = new Date().toISOString().slice(0, 10);
  const saved = upsertEmployee(emp);
  // Mark recruit as joined
  const list = getRecruitments();
  const idx = list.findIndex((x) => x.id === r.id);
  if (idx >= 0) { list[idx].status = 5; list[idx].joinedEmpId = saved.id; saveRecruitments(list); }
  return saved;
};

// ==================== HR: EXIT & F&F ====================
// Workflow: 1 Draft → 2 Submitted to GM → 3 GM Approved (Pending Accounts) → 4 Settled & Paid
export const EXIT_STATUS = { 1: "Draft", 2: "Submitted to GM", 3: "GM Approved · Pending Accounts", 4: "Settled & Paid" };
const EXITS_KEY = "ae_vm_hr_exits";
export const getExits = () => read(EXITS_KEY, []);
export const saveExits = (list) => { write(EXITS_KEY, list); _schedulePush(); };
export const createExitDraft = (empId = "") => ({
  id: `ex_${Date.now()}`,
  empId,
  resignDate: new Date().toISOString().slice(0, 10),
  lastWorkingDay: "",
  reason: "",
  clearance: { hr: false, accounts: false, admin: false, it: false, store: false, project: false },
  pendingDues: 0, loanDeduction: 0, bonusDue: 0, leaveEncash: 0, gratuity: 0, noticeRecovery: 0,
  fnfNet: 0,
  status: 1,
  history: [],
  createdBy: _me(), createdAt: new Date().toISOString(),
});
export const upsertExit = (x) => {
  const list = getExits();
  const idx = list.findIndex((y) => y.id === x.id);
  // Auto-calc F&F
  x.fnfNet = (Number(x.pendingDues) || 0) + (Number(x.bonusDue) || 0) + (Number(x.leaveEncash) || 0) + (Number(x.gratuity) || 0) - (Number(x.loanDeduction) || 0) - (Number(x.noticeRecovery) || 0);
  x.updatedAt = new Date().toISOString();
  // Enrich with employee snapshot for easier display
  const emp = getEmployees().find((e) => e.id === x.empId);
  if (emp) { x.empCode = emp.empCode; x.empName = emp.fullName; x.department = emp.department; }
  if (idx >= 0) list[idx] = x; else list.push(x);
  saveExits(list);
  if (getToken()) apiUpsertExit(x).catch(() => {});
  return x;
};
export const deleteExit = (id) => { saveExits(getExits().filter((y) => y.id !== id)); if (getToken()) apiDeleteExit(id).catch(() => {}); };
// Advance Exit through workflow steps; on step 4 auto-create Payment Voucher & mark employee Exited
export const advanceExitStep = (x) => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...x, status: Math.min(4, (Number(x.status) || 1) + 1), updatedAt: now };
  next.history = [...(x.history || [])];
  if (next.status === 2) { next.submittedByName = me; next.submittedAt = now; next.history.push({ action: "Submitted to GM", at: now, by: me }); }
  if (next.status === 3) { next.gmApprovedByName = me; next.gmApprovedAt = now; next.history.push({ action: "GM Approved · Sent to Accounts", at: now, by: me }); }
  if (next.status === 4) {
    next.settledByName = me; next.settledAt = now;
    next.history.push({ action: "Settled & Paid by Accounts", at: now, by: me });
    // Auto-generate Payment Voucher for F&F payout (IDEMPOTENT — never duplicates)
    try {
      const payments = getPayments();
      const pvId = `pv_fnf_${next.id}`;
      const existing = payments.find((p) => p.id === pvId || p.sourceRef === next.id);
      if (existing) {
        // Already created — reuse the existing PV and skip insert
        next.linkedPvNo = existing.pvNo;
        next.history.push({ action: `Payment Voucher ${existing.pvNo} already exists · reused`, at: now, by: me });
      } else {
        const pvNo = `GPV/HR-FNF/${new Date().getFullYear()}/${payments.length + 1}`;
        const pv = {
          id: pvId,
          pvNo,
          pvDate: now.slice(0, 10),
          source: "HR Exit F&F",
          sourceRef: next.id,
          vendorCode: "AE-HR-FNF",
          vendorSnapshot: { firmName: `F&F Payout · ${next.empName || next.empCode || "Employee"}` },
          amount: Number(next.fnfNet) || 0,
          remarks: `Auto-generated from Exit F&F · ${next.empCode || ""} ${next.empName || ""} · LWD ${next.lastWorkingDay || "—"}`,
          status: "Submitted",
          createdByName: me,
          createdAt: now,
        };
        payments.push(pv);
        savePayments(payments);
        next.linkedPvNo = pvNo;
        next.history.push({ action: `Auto-created Payment Voucher ${pvNo}`, at: now, by: me });
      }
    } catch (e) { /* ignore */ }
    // Mark employee as Exited
    const emps = getEmployees();
    const empIdx = emps.findIndex((e) => e.id === next.empId);
    if (empIdx >= 0) { emps[empIdx].status = "Exited"; emps[empIdx].exitedAt = now; saveEmployees(emps); if (getToken()) apiUpsertEmployee(emps[empIdx]).catch(() => {}); }
  }
  saveExits(getExits().map((y) => y.id === next.id ? next : y));
  return next;
};
// Backward-compatible helper: finalize = push to settled (step 4)
export const finalizeExit = (id) => {
  const list = getExits();
  const x = list.find((y) => y.id === id);
  if (!x) return;
  // Fast-forward through remaining steps up to 4
  let cur = x;
  while (Number(cur.status) < 4) cur = advanceExitStep(cur);
  return cur;
};

// ==================== HR: COMPLIANCE SNAPSHOT ====================
// Derived live from employees + attendance for a given month.
export const getComplianceSnapshot = (year, month) => {
  const emps = getEmployees().filter((e) => Number(e.step) === 5 && (e.status || "Active") === "Active");
  const daysInMonth = new Date(year, month, 0).getDate();
  let totalPF = 0, totalESIC = 0, totalPT = 0, totalTDS = 0, totalGross = 0, totalNet = 0;
  const rows = emps.map((e) => {
    const att = getMonthAttendance(e.id, year, month);
    const daysPresent = Object.values(att.days || {}).filter((s) => s === "P" || s === "H").length;
    const s = computeSalary(e, { daysInMonth, daysPresent });
    totalPF += s.pf; totalESIC += s.esic; totalPT += s.proftax; totalTDS += s.tds; totalGross += s.gross; totalNet += s.net;
    return { empCode: e.empCode, name: e.fullName, uan: e.uan, esicNo: e.esicNo, pfNo: e.pfNo, pan: e.pan, ...s };
  });
  return { year, month, employeeCount: emps.length, totalPF, totalESIC, totalPT, totalTDS, totalGross, totalNet, rows };
};

// ==================== HR: CELEBRATIONS HELPERS ====================

// --- Monthly Pay Bill (HR → GM approval) ---
export const PAYBILL_STATUS = { 1: "Draft", 2: "Submitted to GM", 3: "GM Approved", 4: "Settled & Paid" };

// Legacy cleanup: remove old HR-INTERNAL / isPayrollBill entries from the Bills table.
// HR Pay Bills now live in the dedicated `paybills` collection; these legacy rows were created
// by the old sendPayrollToAccounts flow and should no longer appear in Vendor Bills.
export const purgeLegacyPayrollBills = () => {
  const bills = getBills();
  const kept = bills.filter((b) => !b.isPayrollBill && b.vendorCode !== "HR-INTERNAL");
  const removed = bills.length - kept.length;
  if (removed > 0) {
    saveBills(kept);
    // Mirror delete to backend
    bills.forEach((b) => { if ((b.isPayrollBill || b.vendorCode === "HR-INTERNAL") && getToken()) apiDeleteBill?.(b.id).catch(() => {}); });
  }
  return removed;
};

export const getPayBills = () => read(KEYS.PAYBILLS, []);
export const savePayBills = (list) => { write(KEYS.PAYBILLS, list); _schedulePush(); };

export const createPayBillDraft = (year, month) => {
  const emps = getEmployees().filter((e) => Number(e.step) === 5 && e.empCode && (e.status || "Active") === "Active");
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthKey = `${year}${String(month).padStart(2, "0")}`;
  // IDEMPOTENT: if a PayBill already exists for this month, respect its stage.
  // - If approved/settled (step >= 2): return it unchanged — do NOT auto-overwrite data user already processed.
  // - If still Draft (step === 1): keep same id + refNo + createdAt, just refresh lines from latest attendance/salary.
  const existing = getPayBills().find((p) => p.monthKey === monthKey);
  if (existing && Number(existing.step) >= 2) return existing;
  // Sum Accounts-approved advance requests for this month per employee (auto-adjust in Pay Bill)
  const advReqs = getAdvanceRequests();
  const approvedAdvFor = (empId) => advReqs
    .filter((r) => Number(r.status) === 3 && r.empId === empId && Number(r.targetYear) === Number(year) && Number(r.targetMonth) === Number(month))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const lines = emps.map((e) => {
    const att = getMonthAttendance(e.id, year, month);
    const daysPresent = Object.values(att.days || {}).filter((s) => s === "P" || s === "H").length;
    const s = computeSalary(e, { daysInMonth, daysPresent });
    // Preserve manually-edited values from existing draft line (if present) so admin edits persist across refresh.
    const prev = existing?.lines?.find((l) => l.empId === e.id);
    const autoAdv = approvedAdvFor(e.id);
    return {
      _id: `l_${e.id}`,
      empId: e.id, empCode: e.empCode, name: e.fullName,
      department: e.department, designation: e.designation,
      daysInMonth, daysPresent,
      basic: s.basic || 0, hra: s.hra || 0, da: s.da || 0, special: s.special || 0, bonus: s.bonus || 0,
      gross: s.earned || 0,
      pf: prev?.pf ?? (s.pf || 0),
      esic: prev?.esic ?? (s.esic || 0),
      proftax: prev?.proftax ?? (s.proftax || 0),
      tds: prev?.tds ?? (s.tds || 0),
      // Auto-fill advance from Accounts-approved advance requests for THIS month,
      // unless admin has already manually overridden on existing draft.
      advance: prev?.advance ?? autoAdv,
      autoAdvance: autoAdv,
      otherDeductions: prev?.otherDeductions ?? 0,
      net: s.net || 0,
      excluded: prev?.excluded ?? false,
    };
  });
  return {
    id: existing?.id || `pb_${monthKey}_${Date.now()}`,
    year, month,
    monthKey,
    refNo: existing?.refNo || `AE/HR/PB/${year}-${String(month).padStart(2, "0")}`,
    lines,
    totalGross: lines.reduce((a, l) => a + (l.gross || 0), 0),
    totalDeductions: lines.reduce((a, l) => a + (l.pf || 0) + (l.esic || 0) + (l.proftax || 0) + (l.tds || 0) + (l.otherDeductions || 0), 0),
    totalAdvance: 0,
    totalNet: lines.reduce((a, l) => a + (l.net || 0), 0),
    step: 1,
    createdByName: existing?.createdByName || _me() || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    history: existing?.history || [{ action: "Draft created", at: new Date().toISOString(), by: _me() }],
  };
};

export const upsertPayBill = (pb) => {
  const recalc = pb.lines.map((l) => ({
    ...l,
    net: Math.max(0, (Number(l.gross) || 0) - (Number(l.pf) || 0) - (Number(l.esic) || 0) - (Number(l.proftax) || 0) - (Number(l.tds) || 0) - (Number(l.otherDeductions) || 0) - (Number(l.advance) || 0)),
  }));
  // EXCLUDED lines are not counted in totals (selective mode support)
  const active = recalc.filter((l) => !l.excluded);
  const totGross = active.reduce((a, l) => a + (Number(l.gross) || 0), 0);
  const totAdv = active.reduce((a, l) => a + (Number(l.advance) || 0), 0);
  const totDed = active.reduce((a, l) => a + (Number(l.pf) || 0) + (Number(l.esic) || 0) + (Number(l.proftax) || 0) + (Number(l.tds) || 0) + (Number(l.otherDeductions) || 0), 0);
  const updated = {
    ...pb, lines: recalc,
    totalGross: totGross, totalDeductions: totDed, totalAdvance: totAdv,
    totalNet: totGross - totDed - totAdv,
    includedCount: active.length,
    updatedAt: new Date().toISOString(),
  };
  const list = getPayBills();
  const idx = list.findIndex((x) => x.id === updated.id);
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  savePayBills(list);
  if (getToken()) apiUpsertPayBill(updated).catch(() => {});
  return updated;
};

// ---- Background sync helper — logs failures to a retry queue so data loss is visible ----
const PENDING_SYNC_KEY = "ae_vm_pending_sync";
const _loadPendingSync = () => { try { return JSON.parse(localStorage.getItem(PENDING_SYNC_KEY) || "[]"); } catch { return []; } };
const _savePendingSync = (q) => { try { localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(q.slice(-50))); } catch {} };
export const getPendingSyncCount = () => _loadPendingSync().length;
const _bg = (fnName, args, promise) => {
  if (!promise || typeof promise.catch !== "function") return promise;
  return promise.catch((err) => {
    const q = _loadPendingSync();
    q.push({ fnName, args, at: new Date().toISOString(), err: String(err?.message || err) });
    _savePendingSync(q);
    try { console.error(`[sync-failed] ${fnName}`, err); } catch {}
    try { window.dispatchEvent(new CustomEvent("ae-sync-failed", { detail: { fnName, err: String(err?.message || err) } })); } catch {}
  });
};

// Retry all pending failed syncs (called on login, visibility change, manual refresh)
export const retryPendingSyncs = async () => {
  const q = _loadPendingSync();
  if (!q.length) return { retried: 0, remaining: 0 };
  const stillPending = [];
  let retried = 0;
  for (const item of q) {
    try {
      // Only safe idempotent retries: upsert operations (not deletes)
      if (item.fnName === "apiUpsertPayBill") { await apiUpsertPayBill(item.args[0]); retried += 1; }
      else if (item.fnName === "apiUpsertAdvanceRequest") { await apiUpsertAdvanceRequest(item.args[0]); retried += 1; }
      else if (item.fnName === "apiUpsertLoan") { await apiUpsertLoan(item.args[0]); retried += 1; }
      else stillPending.push(item);
    } catch (e) {
      stillPending.push(item);
    }
  }
  _savePendingSync(stillPending);
  return { retried, remaining: stillPending.length };
};

export const advancePayBillStep = (pb) => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...pb, step: Math.min(4, (Number(pb.step) || 1) + 1), updatedAt: now };
  if (next.step === 2) { next.submittedByName = me; next.submittedAt = now; next.history = [...(pb.history || []), { action: "Submitted to GM", at: now, by: me }]; }
  if (next.step === 3) { next.approvedByName = me; next.approvedAt = now; next.history = [...(pb.history || []), { action: "Approved by GM", at: now, by: me }]; }
  if (next.step === 4) {
    next.settledByName = me; next.settledAt = now;
    next.history = [...(pb.history || []), { action: "Settled & paid", at: now, by: me }];
    // ---- Auto-generate Payment Voucher for the net salary payout (IDEMPOTENT) ----
    try {
      const payments = getPayments();
      const pvId = `pv_pb_${pb.id}`;
      const existing = payments.find((p) => p.id === pvId || p.sourceRef === pb.refNo);
      if (existing) {
        // PV already exists for this pay bill — reuse and skip insert to prevent duplicates
        next.linkedPvNo = existing.pvNo;
        next.history.push({ action: `Payment Voucher ${existing.pvNo} already exists · reused`, at: now, by: me });
      } else {
        const monthName = new Date(pb.year, pb.month - 1).toLocaleString("en-IN", { month: "long" });
        // Use PV counter (not payments.length — that collides if other PVs were inserted meanwhile)
        const c = getCounters();
        c.pvSerial = (c.pvSerial || 0) + 1;
        saveCounters(c);
        const pvNo = `GPV/HR/${pb.year}-${String(pb.month).padStart(2, "0")}/${c.pvSerial}`;
        const pv = {
          id: pvId,
          pvNo,
          pvDate: now.slice(0, 10),
          source: "HR Pay Bill",
          sourceRef: pb.refNo,
          vendorCode: "AE-HR-PAYROLL",
          vendorSnapshot: { firmName: `Payroll Payout · ${monthName} ${pb.year}` },
          amount: pb.totalNet || 0,
          remarks: `Auto-generated from Pay Bill ${pb.refNo} · ${pb.lines?.length || 0} employees · Net ₹${(pb.totalNet || 0).toLocaleString("en-IN")}`,
          status: "Submitted",
          createdByName: me,
          createdAt: now,
        };
        payments.push(pv);
        savePayments(payments);
        next.linkedPvNo = pvNo;
        next.history.push({ action: `Auto-created Payment Voucher ${pvNo}`, at: now, by: me });
      }
    } catch (e) { /* ignore */ }
  }
  const list = getPayBills().map((x) => x.id === next.id ? next : x);
  savePayBills(list);
  // ** CRITICAL FIX **: persist status transitions to backend so re-login shows correct state
  if (getToken()) _bg("apiUpsertPayBill", [next], apiUpsertPayBill(next));
  return next;
};

export const deletePayBill = (id) => { savePayBills(getPayBills().filter((x) => x.id !== id)); if (getToken()) apiDeletePayBill(id).catch(() => {}); };

// --- Core entity cloud-reconciled deletes (vendor / bill / expense) ---
// Added for GM Dashboard delete buttons · ensures backend DELETE is called so
// the record doesn't resurrect on next cross-device cloud sync.
export const deleteVendor = (id) => {
  write(KEYS.VENDORS, getVendors().filter((v) => v.id !== id));
  if (getToken()) apiDeleteVendor(id).catch(() => {});
};
export const deleteBill = (id) => {
  write(KEYS.BILLS, getBills().filter((b) => b.id !== id));
  if (getToken()) apiDeleteBill(id).catch(() => {});
};
export const deleteExpense = (id) => {
  write(KEYS.EXPENSES, getExpenses().filter((e) => e.id !== id));
  if (getToken()) apiDeleteExpense(id).catch(() => {});
};

// --- Advance Register (per-employee aggregated across all pay bills + paid on-demand advance requests) ---
export const getAdvanceRegister = () => {
  const bills = getPayBills();
  const emps = getEmployees();
  const reqs = getAdvanceRequests();
  const map = {};
  const ensure = (empId, empCode, name) => {
    if (!map[empId]) {
      const e = emps.find((x) => x.id === empId);
      map[empId] = { empId, empCode: empCode || e?.empCode, name: name || e?.fullName, department: e?.department, lines: [], totalAdvance: 0 };
    }
    return map[empId];
  };
  bills.forEach((pb) => {
    (pb.lines || []).forEach((l) => {
      // Only the MANUAL portion of pay-bill advance (minus the auto-adjusted amount
      // which is already counted via the On-Demand advance request below).
      // Prevents double-counting when an approved advance request auto-fills Pay Bill.
      const manualAdv = Number(l.advance || 0) - Number(l.autoAdvance || 0);
      if (manualAdv <= 0) return;
      const row = ensure(l.empId, l.empCode, l.name);
      row.lines.push({ source: "PayBill", year: pb.year, month: pb.month, refNo: pb.refNo, amount: manualAdv, step: pb.step });
      row.totalAdvance += manualAdv;
    });
  });
  reqs.forEach((r) => {
    if (Number(r.status) < 3) return; // only Accounts-approved or paid show in register
    const row = ensure(r.empId, r.empCode, r.empName);
    row.lines.push({ source: "On-Demand", year: Number(r.targetYear) || new Date(r.requestDate || Date.now()).getFullYear(), month: Number(r.targetMonth) || new Date(r.requestDate || Date.now()).getMonth() + 1, refNo: r.refNo, amount: Number(r.amount), step: r.status });
    row.totalAdvance += Number(r.amount);
  });
  return Object.values(map).sort((a, b) => b.totalAdvance - a.totalAdvance);
};

// --- Advance on Demand (HR → Accounts → Paid flow) ---
export const ADVANCE_REQ_STATUS = { 1: "Draft", 2: "Submitted to Accounts", 3: "Accounts Approved · Auto-adjusted in Pay Bill", 5: "Rejected" };
export const getAdvanceRequests = () => read(KEYS.ADVANCE_REQS, []);
export const saveAdvanceRequests = (list) => { write(KEYS.ADVANCE_REQS, list); _schedulePush(); };
export const createAdvanceRequestDraft = (empId = "") => {
  const emp = getEmployees().find((e) => e.id === empId) || {};
  const seq = getAdvanceRequests().length + 1;
  const now = new Date();
  return {
    id: `ar_${Date.now()}`,
    refNo: `ADV/${getFY()}/${String(seq).padStart(4, "0")}`,
    empId: emp.id || "", empCode: emp.empCode || "", empName: emp.fullName || "",
    department: emp.department || "", designation: emp.designation || "",
    requestDate: now.toISOString().slice(0, 10),
    targetMonth: now.getMonth() + 1,
    targetYear: now.getFullYear(),
    amount: 0,
    reason: "",
    repaymentMode: "Salary Deduction",
    emiMonths: 1,
    status: 1,
    rejectReason: "",
    requestedByName: _me() || "", createdAt: new Date().toISOString(),
    history: [],
  };
};
export const upsertAdvanceRequest = (r) => {
  const list = getAdvanceRequests();
  // Duplicate rule (Feb 2026 · user request):
  // Same employee + same requestDate + same amount combination => BLOCK (prevents accidental double entry on same day).
  // Different date OR different amount => ALLOWED (even if other field matches).
  const isNew = !list.find((x) => x.id === r.id);
  if (isNew) {
    const dup = list.find((x) =>
      x.empId === r.empId &&
      String(x.requestDate) === String(r.requestDate) &&
      Number(x.amount) === Number(r.amount) &&
      Number(x.status) !== 5 /* ignore rejected */
    );
    if (dup) {
      throw new Error(`Duplicate advance request · Same employee ko ${r.requestDate} par ₹${Number(r.amount).toLocaleString("en-IN")} ka advance already exist hai (${dup.refNo}). Date ya amount change karein.`);
    }
  }
  const updated = { ...r, updatedAt: new Date().toISOString() };
  const idx = list.findIndex((x) => x.id === updated.id);
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  saveAdvanceRequests(list);
  if (getToken()) apiUpsertAdvanceRequest(updated).catch(() => {});
  return updated;
};
// Simplified flow (per user requirement — Oct 2026):
//   1 Draft → 2 Submitted to Accounts → 3 Accounts Approved (TERMINAL)
// No PV / bank-details / GM step. The approved amount auto-populates in the
// target month's Pay Bill `advance` column via createPayBillDraft().
export const advanceAdvanceRequestStep = (r) => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...r, status: Math.min(3, (Number(r.status) || 1) + 1), updatedAt: now };
  if (next.status === 2) { next.submittedByName = me; next.submittedAt = now; next.history = [...(r.history || []), { action: "Submitted to Accounts", at: now, by: me }]; }
  if (next.status === 3) { next.approvedByName = me; next.approvedAt = now; next.history = [...(r.history || []), { action: `Accounts Approved · Will auto-adjust in Pay Bill ${new Date(r.targetYear || new Date().getFullYear(), (r.targetMonth || new Date().getMonth() + 1) - 1).toLocaleString("en", { month: "long", year: "numeric" })}`, at: now, by: me }]; }
  saveAdvanceRequests(getAdvanceRequests().map((x) => x.id === next.id ? next : x));
  if (getToken()) apiUpsertAdvanceRequest(next).catch(() => {});
  return next;
};
export const rejectAdvanceRequest = (r, reason = "") => {
  const now = new Date().toISOString();
  const me = _me();
  const next = { ...r, status: 5, rejectReason: reason, rejectedByName: me, rejectedAt: now, updatedAt: now };
  next.history = [...(r.history || []), { action: `Rejected: ${reason || "—"}`, at: now, by: me }];
  saveAdvanceRequests(getAdvanceRequests().map((x) => x.id === next.id ? next : x));
  // ** CRITICAL FIX **: persist rejection to backend
  if (getToken()) _bg("apiUpsertAdvanceRequest", [next], apiUpsertAdvanceRequest(next));
  return next;
};
export const deleteAdvanceRequest = (id) => { saveAdvanceRequests(getAdvanceRequests().filter((x) => x.id !== id)); if (getToken()) apiDeleteAdvanceRequest(id).catch(() => {}); };

// --- Loan Management ---
export const LOAN_STATUS = { 1: "Draft", 2: "Submitted", 3: "GM Approved", 4: "Disbursed", 5: "Fully Repaid", 6: "Written Off" };
export const getLoans = () => read(KEYS.LOANS || "ae_vm_loans", []);
export const saveLoans = (list) => { write(KEYS.LOANS || "ae_vm_loans", list); _schedulePush(); };
export const createLoanDraft = (empId = "") => {
  const emp = getEmployees().find((e) => e.id === empId) || {};
  return {
    id: `ln_${Date.now()}`,
    empId: emp.id || "", empCode: emp.empCode || "", empName: emp.fullName || "",
    department: emp.department || "", designation: emp.designation || "",
    loanType: "Personal", principal: 0, interestRate: 0, tenureMonths: 12,
    emiAmount: 0, startMonth: new Date().toISOString().slice(0, 7),
    purpose: "", outstanding: 0, paidEMIs: 0, paidAmount: 0,
    status: 1,
    createdByName: _me() || "", createdAt: new Date().toISOString(),
    emiHistory: [], // {month, amount, paidViaPayBillRef}
  };
};
export const computeLoanEMI = (principal, rate, tenure) => {
  const P = Number(principal) || 0;
  const n = Number(tenure) || 1;
  const r = (Number(rate) || 0) / 100 / 12;
  if (r === 0) return Math.round(P / n);
  return Math.round(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
};
export const upsertLoan = (l) => {
  const emi = computeLoanEMI(l.principal, l.interestRate, l.tenureMonths);
  const outstanding = Math.max(0, (Number(l.principal) || 0) - (Number(l.paidAmount) || 0));
  const updated = { ...l, emiAmount: emi, outstanding, updatedAt: new Date().toISOString() };
  const list = getLoans();
  const idx = list.findIndex((x) => x.id === updated.id);
  if (idx >= 0) list[idx] = updated; else list.push(updated);
  saveLoans(list);
  if (getToken()) apiUpsertLoan(updated).catch(() => {});
  return updated;
};
export const advanceLoanStep = (l) => {
  const now = new Date().toISOString();
  const next = { ...l, status: Math.min(6, (Number(l.status) || 1) + 1), updatedAt: now };
  if (next.status === 4) { next.disbursedAt = now; next.outstanding = next.principal; }
  saveLoans(getLoans().map((x) => x.id === next.id ? next : x));
  // ** CRITICAL FIX **: persist loan status transitions to backend
  if (getToken()) _bg("apiUpsertLoan", [next], apiUpsertLoan(next));
  return next;
};
export const deleteLoan = (id) => { saveLoans(getLoans().filter((x) => x.id !== id)); if (getToken()) apiDeleteLoan(id).catch(() => {}); };
// Get active loans for an employee (status 4 = Disbursed = EMI deductions ongoing)
export const getActiveLoanEMI = (empId) => {
  const l = getLoans().find((x) => x.empId === empId && Number(x.status) === 4 && x.outstanding > 0);
  if (!l) return 0;
  return Math.min(l.emiAmount || 0, l.outstanding || 0);
};

export const sendPayrollToAccounts = (year, month, attendanceMap = {}) => {
  const emps = getEmployees().filter((e) => Number(e.step) === 5 && e.empCode && (e.status || "Active") === "Active");
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  let gross = 0, pf = 0, esic = 0, proftax = 0, tds = 0, net = 0;
  const rows = emps.map((e) => {
    const attKey = `att_${e.id}_${year}${String(month).padStart(2, "0")}`;
    const att = attendanceMap[attKey] || getMonthAttendance(e.id, year, month);
    const daysPresent = Object.values(att.days || {}).filter((s) => s === "P" || s === "H").length;
    const salary = computeSalary(e, { daysInMonth, daysPresent });
    gross += salary.gross; pf += salary.pf; esic += salary.esic; proftax += salary.proftax; tds += salary.tds; net += salary.net;
    return { empCode: e.empCode, name: e.fullName, ...salary };
  });
  const billId = `bill_hr_${monthStr}_${Date.now()}`;
  const bill = {
    id: billId,
    step: 4, // awaiting GM final approval
    tempRefId: `HR-PAY-${monthStr}`,
    permanentBillNo: "",
    refNo: `HR-PAY-${monthStr}`,
    date: new Date().toISOString().slice(0, 10),
    vendorCode: "HR-INTERNAL",
    vendorSnapshot: { firmName: "HR Payroll — Internal", vendorCode: "HR-INTERNAL" },
    workOrderNo: "",
    projectCodeLocation: "Head Office",
    workScope: `Monthly Payroll for ${monthStr} — ${emps.length} employees`,
    basicAmount: net,
    totalWOValue: gross,
    items: rows.map((r, i) => ({
      id: `it_${i}`, categoryScope: "Salary", description: `${r.name} (${r.empCode})`,
      hsn: "", woQty: 1, unit: "Month", woRate: r.net, billedQty: 1,
    })),
    siteInchargeName: "HR", purchaseInchargeName: "HR", accountInchargeName: "Accounts",
    approverName: "", history: [{ action: "Payroll pushed by HR", at: new Date().toISOString(), by: _me() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPayrollBill: true,
    payrollSummary: { year, month, employeeCount: emps.length, gross, pf, esic, proftax, tds, net, rows },
  };
  const bills = read(KEYS.BILLS, []);
  bills.push(bill);
  write(KEYS.BILLS, bills);
  if (getToken()) apiUpsertBill(bill).catch(() => {});
  return bill;
};


// ---- Cloud Sync helpers ----
export const syncFromCloud = async () => {
  const snap = await apiFetchSnapshot();
  if (Array.isArray(snap.vendors)) write(KEYS.VENDORS, snap.vendors);
  if (Array.isArray(snap.bills)) write(KEYS.BILLS, snap.bills);
  if (Array.isArray(snap.payments)) write(KEYS.PAYMENTS, snap.payments);
  if (Array.isArray(snap.expenses)) write(KEYS.EXPENSES, snap.expenses);
  if (Array.isArray(snap.boqs)) write(KEYS.BOQS, snap.boqs);
  if (Array.isArray(snap.work_orders)) write(KEYS.WOS, snap.work_orders);
  if (Array.isArray(snap.employees)) write(KEYS.EMPLOYEES, snap.employees);
  if (Array.isArray(snap.attendance)) write(KEYS.ATTENDANCE, snap.attendance);
  if (Array.isArray(snap.paybills)) write(KEYS.PAYBILLS, snap.paybills);
  if (Array.isArray(snap.payBills)) write(KEYS.PAYBILLS, snap.payBills); // legacy key fallback
  if (Array.isArray(snap.loans)) write(KEYS.LOANS, snap.loans);
  if (Array.isArray(snap.advance_requests)) write(KEYS.ADVANCE_REQS, snap.advance_requests);
  if (Array.isArray(snap.recruitments)) write(RECRUITS_KEY, snap.recruitments);
  if (Array.isArray(snap.exits)) write(EXITS_KEY, snap.exits);
  if (snap.counters) write(KEYS.COUNTERS, {
    vendorSerial: snap.counters.vendorSerial || 0,
    billSerial: snap.counters.billSerial || 0,
    pvSerial: snap.counters.pvSerial || 0,
    expenseSerial: snap.counters.expenseSerial || 0,
    boqSerial: snap.counters.boqSerial || 0,
    woSerial: snap.counters.woSerial || 0,
    empSerial: snap.counters.empSerial || 0,
    adsSerial: snap.counters.adsSerial || 0,
  });
  if (snap.logo) localStorage.setItem(KEYS.LOGO, snap.logo);
  if (snap.company && typeof snap.company === "object") {
    try { localStorage.setItem(COMPANY_KEY, JSON.stringify(snap.company)); window.dispatchEvent(new CustomEvent("ae-company-changed", { detail: snap.company })); } catch {}
  }
  // Sync Active FY override from cloud (admin-set)
  if (typeof snap.active_fy === "string") {
    const norm = _normalizeFY(snap.active_fy);
    if (norm) localStorage.setItem(ACTIVE_FY_KEY, norm);
    else localStorage.removeItem(ACTIVE_FY_KEY);
  }
  // Fire window event so React components can refresh their useMemo state
  try { window.dispatchEvent(new CustomEvent("ae-sync-done")); } catch {}
  return snap;
};

// Throttled auto-refresh — safe to call on page load / window focus / visibility change
let _lastSync = 0;
export const autoSyncFromCloud = async (minIntervalMs = 10000) => {
  if (!getToken()) return null;
  const now = Date.now();
  if (now - _lastSync < minIntervalMs) return null;
  _lastSync = now;
  try {
    await retryPendingSyncs();
    return await syncFromCloud();
  } catch (e) {
    try { console.error("[auto-sync]", e); } catch {}
    return null;
  }
};

// ---- Admin: Reset HR Pay Bills + Advances (preserves Employees, Vendors, Bills) ----
export const resetHrFinancials = async () => {
  // Local wipe first — pay bills, advance requests, HR-sourced PVs
  savePayBills([]);
  saveAdvanceRequests([]);
  const payments = getPayments();
  const kept = payments.filter((p) => {
    const pv = String(p.pvNo || "");
    return !(pv.startsWith("PV/HR/") || pv.startsWith("PV/ADV/") || pv.startsWith("PV/HR-FNF/"));
  });
  savePayments(kept);
  // Backend wipe
  if (getToken()) {
    try { return await apiResetHrFinancials(); } catch (e) { return { ok: false, error: String(e) }; }
  }
  return { ok: true, local_only: true };
};

export const syncToCloud = async () => {
  const payload = {
    vendors: read(KEYS.VENDORS, []),
    bills: read(KEYS.BILLS, []),
    payments: read(KEYS.PAYMENTS, []),
    expenses: read(KEYS.EXPENSES, []),
    boqs: read(KEYS.BOQS, []),
    paybills: read(KEYS.PAYBILLS, []),
    loans: read(KEYS.LOANS, []),
    advance_requests: read(KEYS.ADVANCE_REQS, []),
    recruitments: read(RECRUITS_KEY, []),
    exits: read(EXITS_KEY, []),
    counters: read(KEYS.COUNTERS, { vendorSerial: 0, billSerial: 0, pvSerial: 0, expenseSerial: 0, boqSerial: 0, adsSerial: 0 }),
    logo: localStorage.getItem(KEYS.LOGO) || "",
  };
  return await apiPushSnapshot(payload);
};

// ---- Number to Words (Indian numbering system: Lakh / Crore) ----
export const amountToWords = (num) => {
  const n = Math.abs(Number(num) || 0);
  if (n === 0) return "Rupees Zero Only";
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigit = (x) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
  const threeDigit = (x) => {
    const h = Math.floor(x / 100), r = x % 100;
    return (h ? a[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigit(r) : "");
  };
  const toWords = (x) => {
    if (x === 0) return "";
    const cr = Math.floor(x / 10000000); x %= 10000000;
    const lk = Math.floor(x / 100000); x %= 100000;
    const th = Math.floor(x / 1000); x %= 1000;
    const hu = x;
    let out = "";
    if (cr) out += twoDigit(cr) + " Crore ";
    if (lk) out += twoDigit(lk) + " Lakh ";
    if (th) out += twoDigit(th) + " Thousand ";
    if (hu) out += threeDigit(hu);
    return out.trim();
  };
  let result = "Rupees " + (toWords(rupees) || "Zero");
  if (paise) result += " and " + toWords(paise) + " Paise";
  return result + " Only";
};

// ---- Export helpers ----
export const exportJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
