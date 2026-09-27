// LocalStorage-backed data store for Vendor Management
const KEYS = {
  VENDORS: "ae_vm_vendors",
  BILLS: "ae_vm_bills",
  PAYMENTS: "ae_vm_payments",
  COUNTERS: "ae_vm_counters",
  AUTH: "ae_vm_auth",
  LOGO: "ae_vm_logo",
};

// ---- Company logo ----
export const getLogo = () => {
  try { return localStorage.getItem(KEYS.LOGO) || ""; } catch { return ""; }
};
export const setLogo = (dataUrl) => localStorage.setItem(KEYS.LOGO, dataUrl);
export const clearLogo = () => localStorage.removeItem(KEYS.LOGO);

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
export const saveCounters = (c) => write(KEYS.COUNTERS, c);

// Temp Ref ID format: TMP-XXXXXXXX (8 hex chars)
const nextTempRef = () => {
  let s = "";
  const chars = "0123456789ABCDEF";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 16)];
  return `TMP-${s}`;
};

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

// ---- Vendors ----
export const getVendors = () => read(KEYS.VENDORS, []);
export const saveVendors = (list) => write(KEYS.VENDORS, list);

export const createVendorDraft = () => ({
  id: `v_${Date.now()}`,
  tempRefId: nextTempRef(),
  vendorCode: "",
  step: 1,
  // Project & Site
  projectCode: "",
  siteName: "",
  // Vendor basic
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
  return v;
};

export const findVendorByAny = (q) => {
  if (!q) return null;
  const term = q.trim().toLowerCase();
  const list = getVendors();
  return (
    list.find((v) => (v.vendorCode || "").toLowerCase() === term) ||
    list.find((v) => (v.tempRefId || "").toLowerCase() === term) ||
    list.find((v) => (v.firmName || "").toLowerCase().includes(term)) ||
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
  if (next.step === 1) {
    next.step = 2;
  } else if (next.step === 2) {
    next.step = 3;
    next.vendorCode = nextVendorCode();
    const today = new Date();
    next.approvalDate = today.toISOString().slice(0, 10);
    const exp = new Date(today);
    exp.setFullYear(exp.getFullYear() + 2);
    next.expiryDate = exp.toISOString().slice(0, 10);
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
  const serial = String(c.billSerial).padStart(4, "0");
  return {
    id: `b_${Date.now()}`,
    refNo: `BILL/${getFY()}/${serial}`,
    processRefId: `PRC-${getFY()}-${serial}`,
    processDate: new Date().toISOString().slice(0, 10),
    step: 1,
    vendorCode: "",
    vendorSnapshot: null,
    // Work Order
    workOrderNo: "",
    workOrderDate: "",
    projectCodeLocation: "",
    workScope: "",
    totalWOValue: 0,
    previousAdvance: 0,
    // Item (Quantity/UOM)
    itemDescription: "",
    quantity: 0,
    uom: "Nos",
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
  return b;
};

export const advanceBillStep = (b) => {
  const next = { ...b };
  if (next.step < 5) {
    next.step += 1;
    if (next.step === 5) next.approvalDate = new Date().toISOString().slice(0, 10);
  }
  upsertBill(next);
  return next;
};

// ---- Payment vouchers ----
export const getPayments = () => read(KEYS.PAYMENTS, []);
export const savePayments = (list) => write(KEYS.PAYMENTS, list);

export const nextPvNo = () => {
  const c = getCounters();
  c.pvSerial = (c.pvSerial || 0) + 1;
  saveCounters(c);
  return `PV/${getFY()}/${String(c.pvSerial).padStart(4, "0")}`;
};

// ---- Auth ----
const DEFAULT_ADMIN = { username: "admin", password: "admin@123" };
export const login = (u, p) => {
  const ok = u === DEFAULT_ADMIN.username && p === DEFAULT_ADMIN.password;
  if (ok) write(KEYS.AUTH, { user: u, at: Date.now() });
  return ok;
};
export const logout = () => localStorage.removeItem(KEYS.AUTH);
export const isAuthed = () => !!read(KEYS.AUTH, null);
export const currentUser = () => read(KEYS.AUTH, null)?.user || "";

// ---- Export helpers ----
export const exportJSON = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
