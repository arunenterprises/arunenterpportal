// LocalStorage-backed data store for Vendor Management (+ cloud sync via /api)
import {
  apiUpsertVendor, apiUpsertBill, apiPushPayments,
  apiSetCounters, apiSetLogo, apiFetchSnapshot, apiPushSnapshot,
  apiLogin, apiRegister, setToken, clearToken, getToken,
} from "./api";

const KEYS = {
  VENDORS: "ae_vm_vendors",
  BILLS: "ae_vm_bills",
  PAYMENTS: "ae_vm_payments",
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
  if (next.step === 1) {
    next.step = 2;
  } else if (next.step === 2) {
    next.step = 3;
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
  if (next.step < 5) {
    next.step += 1;
    if (next.step === 5) {
      next.approvalDate = new Date().toISOString().slice(0, 10);
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
export const createUser = async ({ name, email, username, password, role = "User" }) => {
  // Accepts either email or username; if only username provided, treat as email
  const identifier = (email || username || "").trim().toLowerCase();
  if (!identifier) throw new Error("Email is required");
  if (!identifier.includes("@")) throw new Error("Please use a valid email address");
  const trimmedPass = (password || "").trim();
  const trimmedName = (name || "").trim();
  if (!trimmedName) throw new Error("Full name is required");
  if (trimmedPass.length < 4) throw new Error("Password must be at least 4 characters");
  const { token, user } = await apiRegister(identifier, trimmedPass, trimmedName, role);
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

// ---- Cloud Sync helpers ----
export const syncFromCloud = async () => {
  const snap = await apiFetchSnapshot();
  if (Array.isArray(snap.vendors)) write(KEYS.VENDORS, snap.vendors);
  if (Array.isArray(snap.bills)) write(KEYS.BILLS, snap.bills);
  if (Array.isArray(snap.payments)) write(KEYS.PAYMENTS, snap.payments);
  if (snap.counters) write(KEYS.COUNTERS, { vendorSerial: snap.counters.vendorSerial || 0, billSerial: snap.counters.billSerial || 0, pvSerial: snap.counters.pvSerial || 0 });
  if (snap.logo) localStorage.setItem(KEYS.LOGO, snap.logo);
  return snap;
};

export const syncToCloud = async () => {
  const payload = {
    vendors: read(KEYS.VENDORS, []),
    bills: read(KEYS.BILLS, []),
    payments: read(KEYS.PAYMENTS, []),
    counters: read(KEYS.COUNTERS, { vendorSerial: 0, billSerial: 0, pvSerial: 0 }),
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
