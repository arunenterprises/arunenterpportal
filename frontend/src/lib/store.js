// LocalStorage-backed data store for Vendor Management (+ cloud sync via /api)
import {
  apiUpsertVendor, apiUpsertBill, apiUpsertExpense, apiUpsertBOQ, apiUpsertWO, apiPushPayments,
  apiSetCounters, apiSetLogo, apiFetchSnapshot, apiPushSnapshot,
  apiLogin, apiRegister, setToken, clearToken, getToken,
} from "./api";

const KEYS = {
  VENDORS: "ae_vm_vendors",
  BILLS: "ae_vm_bills",
  PAYMENTS: "ae_vm_payments",
  EXPENSES: "ae_vm_expenses",
  BOQS: "ae_vm_boqs",
  WOS: "ae_vm_work_orders",
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
  [KEYS.VENDORS, KEYS.BILLS, KEYS.PAYMENTS, KEYS.EXPENSES, KEYS.COUNTERS, KEYS.LOGO, KEYS.USERS].forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
};

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- Financial Year (e.g. 2526) ----
export const getFY = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  const startYY = m >= 3 ? y % 100 : (y - 1) % 100;
  const endYY = (startYY + 1) % 100;
  return `${String(startYY).padStart(2, "0")}${String(endYY).padStart(2, "0")}`;
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

// ---- Expenses ----
const buildExpenseTempRef = (serial) => `EXR${String(serial).padStart(4, "0")}${getFY()}`;
const buildExpensePermNo = (serial) => `EXP${String(serial).padStart(4, "0")}${getFY()}`;

export const getExpenses = () => read(KEYS.EXPENSES, []);
export const saveExpenses = (list) => {
  write(KEYS.EXPENSES, list);
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
export const saveBOQs = (list) => write(KEYS.BOQS, list);

export const createBOQDraft = () => {
  const c = getCounters();
  c.boqSerial = (c.boqSerial || 0) + 1;
  saveCounters(c);
  return {
    id: `boq_${Date.now()}`,
    boqSerial: c.boqSerial,
    boqNo: buildBOQNo(c.boqSerial),
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

export const advanceBOQStep = (b) => {
  const next = { ...b };
  const approver = _me();
  if (next.step < 4) {
    next.step += 1;
    if (next.step === 3 && !next.submittedDate) {
      next.submittedDate = new Date().toISOString().slice(0, 10);
    }
    if (next.step === 4 && approver) {
      next.approvedByName = approver;
      next.approvalDate = new Date().toISOString().slice(0, 10);
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
  "Lot", "Job", "Lump", "Lumpsum", "LS", "Trip", "Load", "Truck", "Tanker", "Container", "Consignment", "Batch", "Session", "Round", "Cycle",
  // Building materials (India-specific)
  "Brass", "Ghan Ft", "Ghan Mtr", "Rft", "Rmtr", "Sqm-Mtr", "Cu Mtr-Km", "Ton-Km",
  // Rebar / steel
  "Rod", "Bar", "Angle", "Channel", "Plate", "Strip", "Wire",
  // Cement / concrete
  "Cement Bag", "50Kg Bag", "25Kg Bag", "Mix", "Cum Concrete",
  // Electrical / mechanical / energy
  "KW", "KWH", "MW", "MWH", "HP", "Amp", "Volt", "KVA", "MVA", "KVAR", "MVAR", "Watt", "Unit (Elec.)",
  // Pressure / flow
  "Bar", "PSI", "Pa", "kPa", "MPa", "LPM", "LPS", "CFM", "CFS",
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
export const saveWOs = (list) => write(KEYS.WOS, list);

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
  return w;
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
export const saveVendors = (list) => write(KEYS.VENDORS, list);

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
export const saveBills = (list) => write(KEYS.BILLS, list);

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
export const getPayments = () => read(KEYS.PAYMENTS, []);
export const savePayments = (list) => {
  write(KEYS.PAYMENTS, list);
  if (getToken()) apiPushPayments(list).catch(() => {});
};

export const nextPvNo = () => {
  const c = getCounters();
  c.pvSerial = (c.pvSerial || 0) + 1;
  saveCounters(c);
  return `PV/${getFY()}/${String(c.pvSerial).padStart(4, "0")}`;
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
    write(KEYS.AUTH, { user: user.email, name: user.name, role: user.role, at: Date.now() });
    // Pull cloud snapshot after successful login so this device has latest data
    try { await syncFromCloud(); } catch (e) { /* silent — offline OK */ }
    return true;
  } catch (e) {
    return false;
  }
};

export const logout = () => {
  localStorage.removeItem(KEYS.AUTH);
  clearToken();
};
export const isAuthed = () => !!read(KEYS.AUTH, null) && !!getToken();
export const currentUser = () => read(KEYS.AUTH, null)?.user || "";
export const currentUserProfile = () => read(KEYS.AUTH, null);

// ---- Permission model ----
// Primary Super Admin — has ALL powers including Final Approval / Re-Approval / Reset All Data
export const SUPER_ADMIN_EMAIL = "arunenterprises2023@gmail.com";
// Designated Final Approver — the only "role: Admin" user (besides Super Admin) allowed
// to perform Final Approval / Re-Approval on Vendors, Bills and Payment Vouchers.
export const APPROVER_EMAIL = "kl.srivastava@arunenterprises.online";
// Canonical display name used everywhere Final Approval / Re-Approval signs off
export const APPROVER_NAME = "K L Srivastava";

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
export const canCreate = () => {
  const r = currentRole();
  return r !== "Viewer";
};
export const canEdit = () => canCreate();
export const canSubmit = () => canCreate();
export const canDownload = () => true; // everyone (including Viewer) can download
export const canApprove = () => {
  const r = currentRole();
  return ["SuperAdmin", "Admin"].includes(r);
};
// Backward-compat aliases used by older code paths
export const canApproveAccounts = () => canApprove();
export const canApproveGM = () => canApprove();
export const isReadOnly = () => currentRole() === "Viewer";

// ---- Cloud Sync helpers ----
export const syncFromCloud = async () => {
  const snap = await apiFetchSnapshot();
  if (Array.isArray(snap.vendors)) write(KEYS.VENDORS, snap.vendors);
  if (Array.isArray(snap.bills)) write(KEYS.BILLS, snap.bills);
  if (Array.isArray(snap.payments)) write(KEYS.PAYMENTS, snap.payments);
  if (Array.isArray(snap.expenses)) write(KEYS.EXPENSES, snap.expenses);
  if (Array.isArray(snap.boqs)) write(KEYS.BOQS, snap.boqs);
  if (Array.isArray(snap.work_orders)) write(KEYS.WOS, snap.work_orders);
  if (snap.counters) write(KEYS.COUNTERS, {
    vendorSerial: snap.counters.vendorSerial || 0,
    billSerial: snap.counters.billSerial || 0,
    pvSerial: snap.counters.pvSerial || 0,
    expenseSerial: snap.counters.expenseSerial || 0,
    boqSerial: snap.counters.boqSerial || 0,
    woSerial: snap.counters.woSerial || 0,
  });
  if (snap.logo) localStorage.setItem(KEYS.LOGO, snap.logo);
  return snap;
};

export const syncToCloud = async () => {
  const payload = {
    vendors: read(KEYS.VENDORS, []),
    bills: read(KEYS.BILLS, []),
    payments: read(KEYS.PAYMENTS, []),
    expenses: read(KEYS.EXPENSES, []),
    boqs: read(KEYS.BOQS, []),
    counters: read(KEYS.COUNTERS, { vendorSerial: 0, billSerial: 0, pvSerial: 0, expenseSerial: 0, boqSerial: 0 }),
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
