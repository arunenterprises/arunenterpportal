import {
  apiUpsertVendor, apiUpsertBill, apiUpsertExpense, apiUpsertBOQ, apiUpsertWO, apiPushPayments,
  apiDeleteBOQ, apiDeleteWO,
  apiUpsertEmployee, apiDeleteEmployee, apiUpsertAttendance,
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
  EMPLOYEES: "ae_vm_employees",
  ATTENDANCE: "ae_vm_attendance",
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
  [KEYS.VENDORS, KEYS.BILLS, KEYS.PAYMENTS, KEYS.EXPENSES, KEYS.BOQS, KEYS.WOS, KEYS.EMPLOYEES, KEYS.ATTENDANCE, KEYS.COUNTERS, KEYS.LOGO, KEYS.USERS].forEach((k) => {
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
// Backward-compat aliases used by older code paths
export const canApproveAccounts = () => canApprove();
export const canApproveGM = () => canApprove();
export const isReadOnly = () => currentRole() === "Viewer";

// ==================== HR: EMPLOYEE MASTER ====================
export const EMPLOYEE_STEP_LABEL = {
  1: "1. Draft (HR Data Entry)",
  2: "2. Submitted for HR Verification",
  3: "3. Verified · Awaiting HR Manager",
  4: "4. Awaiting GM Final Approval",
  5: "5. Finalized · Permanent EMP Code Issued",
};

const buildEmpCode = (serial) => `EMP${String(serial).padStart(4, "0")}${getFY()}`;
const buildEmpTempCode = (serial) => `EMP-TMP-${String(serial).padStart(4, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

export const getEmployees = () => read(KEYS.EMPLOYEES, []);
export const saveEmployees = (list) => write(KEYS.EMPLOYEES, list);

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
    fullName: "", fatherName: "", dob: "", gender: "M", doj: new Date().toISOString().slice(0, 10),
    designation: "", department: "Operations",
    contactMobile: "", contactEmail: "", address: "",
    aadhaar: "", pan: "", bankName: "", bankAccount: "", ifsc: "",
    pfNo: "", esicNo: "", uan: "",
    ctcAnnual: 0, basic: 0, hra: 0, da: 0, special: 0, bonus: 0,
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
export const RECRUIT_STATUS = { 1: "Applied", 2: "Shortlisted", 3: "Interview", 4: "Offered", 5: "Joined", 6: "Rejected" };
const RECRUITS_KEY = "ae_vm_hr_recruits";
export const getRecruitments = () => read(RECRUITS_KEY, []);
export const saveRecruitments = (list) => write(RECRUITS_KEY, list);
export const createRecruitDraft = () => ({
  id: `rec_${Date.now()}`,
  position: "", department: "Operations",
  candidateName: "", candidateMobile: "", candidateEmail: "",
  experienceYears: 0, qualification: "",
  offerCTC: 0, offerDate: "",
  status: 1,
  remarks: "",
  createdBy: _me(), createdAt: new Date().toISOString(),
});
export const upsertRecruit = (r) => {
  const list = getRecruitments();
  const idx = list.findIndex((x) => x.id === r.id);
  if (idx >= 0) list[idx] = r; else list.push(r);
  saveRecruitments(list);
  return r;
};
export const deleteRecruit = (id) => { saveRecruitments(getRecruitments().filter((x) => x.id !== id)); };
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
export const EXIT_STATUS = { 1: "Resignation Submitted", 2: "Clearance Pending", 3: "F&F Calculated", 4: "Settled & Exited" };
const EXITS_KEY = "ae_vm_hr_exits";
export const getExits = () => read(EXITS_KEY, []);
export const saveExits = (list) => write(EXITS_KEY, list);
export const createExitDraft = (empId = "") => ({
  id: `ex_${Date.now()}`,
  empId,
  resignDate: new Date().toISOString().slice(0, 10),
  lastWorkingDay: "",
  reason: "",
  clearance: { hr: false, accounts: false, admin: false, it: false, store: false },
  pendingDues: 0, loanDeduction: 0, bonusDue: 0, leaveEncash: 0, gratuity: 0, noticeRecovery: 0,
  fnfNet: 0,
  status: 1,
  createdBy: _me(), createdAt: new Date().toISOString(),
});
export const upsertExit = (x) => {
  const list = getExits();
  const idx = list.findIndex((y) => y.id === x.id);
  // Auto-calc F&F
  x.fnfNet = (Number(x.pendingDues) || 0) + (Number(x.bonusDue) || 0) + (Number(x.leaveEncash) || 0) + (Number(x.gratuity) || 0) - (Number(x.loanDeduction) || 0) - (Number(x.noticeRecovery) || 0);
  // Auto-advance status
  const allCleared = x.clearance && Object.values(x.clearance).every((v) => v === true);
  if (allCleared && Number(x.status) < 3) x.status = 3;
  if (idx >= 0) list[idx] = x; else list.push(x);
  saveExits(list);
  return x;
};
export const deleteExit = (id) => { saveExits(getExits().filter((y) => y.id !== id)); };
export const finalizeExit = (id) => {
  const list = getExits();
  const idx = list.findIndex((y) => y.id === id);
  if (idx < 0) return;
  list[idx].status = 4;
  list[idx].settledAt = new Date().toISOString();
  saveExits(list);
  // Mark employee as Exited
  const emps = getEmployees();
  const empIdx = emps.findIndex((e) => e.id === list[idx].empId);
  if (empIdx >= 0) { emps[empIdx].status = "Exited"; emps[empIdx].exitedAt = new Date().toISOString(); saveEmployees(emps); if (getToken()) apiUpsertEmployee(emps[empIdx]).catch(() => {}); }
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
  if (snap.counters) write(KEYS.COUNTERS, {
    vendorSerial: snap.counters.vendorSerial || 0,
    billSerial: snap.counters.billSerial || 0,
    pvSerial: snap.counters.pvSerial || 0,
    expenseSerial: snap.counters.expenseSerial || 0,
    boqSerial: snap.counters.boqSerial || 0,
    woSerial: snap.counters.woSerial || 0,
    empSerial: snap.counters.empSerial || 0,
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
