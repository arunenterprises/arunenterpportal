// LocalStorage-backed data store for Vendor Management
const KEYS = {
  VENDORS: "ae_vm_vendors",
  BILLS: "ae_vm_bills",
  PAYMENTS: "ae_vm_payments",
  COUNTERS: "ae_vm_counters",
  AUTH: "ae_vm_auth",
};

const read = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// ---- Financial Year helper ----
export const getFY = (date = new Date()) => {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0=Jan
  // FY starts Apr (month 3)
  const startYY = m >= 3 ? y % 100 : (y - 1) % 100;
  const endYY = (startYY + 1) % 100;
  return `${String(startYY).padStart(2, "0")}${String(endYY).padStart(2, "0")}`;
};

// ---- Counters ----
export const getCounters = () =>
  read(KEYS.COUNTERS, { vendorSerial: 0, tempSerial: 0, billSerial: 0, pvSerial: 0 });
export const saveCounters = (c) => write(KEYS.COUNTERS, c);

const nextTempCode = () => {
  const c = getCounters();
  c.tempSerial = (c.tempSerial || 0) + 1;
  saveCounters(c);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const letter = letters[(c.tempSerial - 1) % 26];
  const num = String(((c.tempSerial - 1) % 9999) + 1).padStart(4, "0");
  return `${letter}${num}`;
};

const nextVendorCode = () => {
  const c = getCounters();
  c.vendorSerial = (c.vendorSerial || 0) + 1;
  saveCounters(c);
  const serial = String(c.vendorSerial).padStart(4, "0");
  return `AE${serial}JV${getFY()}`;
};

// ---- Vendors ----
export const getVendors = () => read(KEYS.VENDORS, []);
export const saveVendors = (list) => write(KEYS.VENDORS, list);

export const createVendorDraft = () => {
  const tempCode = nextTempCode();
  return {
    id: `v_${Date.now()}`,
    tempCode,
    vendorCode: "",
    status: "Draft", // Draft | Submitted | Approved
    // 1.x
    vendorType: "",
    project: "",
    location: "",
    // 2.x
    vendorName: "",
    concernPerson: "",
    panNo: "",
    businessType: "Registered",
    gstNo: "",
    // 3.x
    address: "",
    pinNo: "",
    email: "",
    phoneNo: "",
    aadhaarNo: "",
    // 4.x
    bankName: "",
    bankAddress: "",
    ifscCode: "",
    accountName: "",
    accountNumber: "",
    // workflow
    createdBy: "",
    checkedBy: "",
    preparedBy: "",
    approvedBy: "",
    approvalDate: "",
    expiryDate: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

export const upsertVendor = (v) => {
  const list = getVendors();
  const idx = list.findIndex((x) => x.id === v.id);
  v.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = v;
  else list.push(v);
  saveVendors(list);
  return v;
};

export const deleteVendorDraft = (id) => {
  const list = getVendors().filter((v) => !(v.id === id && v.status === "Draft"));
  saveVendors(list);
};

export const findVendorByCode = (code) => {
  if (!code) return null;
  const list = getVendors();
  return (
    list.find((v) => v.vendorCode === code) ||
    list.find((v) => v.tempCode === code) ||
    null
  );
};

export const approveVendor = (v) => {
  const code = nextVendorCode();
  v.vendorCode = code;
  v.status = "Approved";
  const now = new Date();
  v.approvalDate = now.toISOString().slice(0, 10);
  const exp = new Date(now);
  exp.setFullYear(exp.getFullYear() + 2);
  v.expiryDate = exp.toISOString().slice(0, 10);
  upsertVendor(v);
  return v;
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
    refNo: `BILL/${getFY()}/${String(c.billSerial).padStart(4, "0")}`,
    vendorCode: "",
    vendorSnapshot: null,
    billNo: "",
    billDate: new Date().toISOString().slice(0, 10),
    description: "",
    basicAmount: 0,
    gstSlab: 18,
    tdsRate: 2,
    dueDate: "",
    status: "Draft",
    createdBy: "",
    checkedBy: "",
    preparedBy: "",
    approvedBy: "",
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
  const netPayable = +(gross - tds).toFixed(2);
  return { basic, gst, gross, tds, netPayable };
};

export const upsertBill = (b) => {
  const list = getBills();
  const idx = list.findIndex((x) => x.id === b.id);
  b.updatedAt = new Date().toISOString();
  if (idx >= 0) list[idx] = b;
  else list.push(b);
  saveBills(list);
  return b;
};

export const deleteBillDraft = (id) => {
  const list = getBills().filter((b) => !(b.id === id && b.status === "Draft"));
  saveBills(list);
};

export const approveBill = (b) => {
  b.status = "Approved";
  b.approvalDate = new Date().toISOString().slice(0, 10);
  return upsertBill(b);
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
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
