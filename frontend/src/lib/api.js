// API client — talks to FastAPI backend for cross-device sync
const BASE = process.env.REACT_APP_BACKEND_URL;

const TOKEN_KEY = "ae_vm_jwt";

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
};
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const req = async (path, opts = {}) => {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const t = getToken();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
  if (res.status === 401 && t && path !== "/auth/login" && path !== "/auth/logout") {
    try { const j = await res.clone().json(); if (/doosre computer/i.test(j.detail || "")) sessionStorage.setItem("ae_kicked", new Date().toLocaleString("en-IN")); } catch {}
    clearToken();
    try { localStorage.removeItem("ae_vm_auth"); } catch {}
    if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail || msg; } catch {}
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json();
};

// ---- Auth ----
export const apiLogin = (identifier, password, otp_token, otp) =>
  req("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password, otp_token, otp }) });
export const apiGetUiButtons = () => req("/settings/ui-buttons");
export const apiGetPrintLayout = (doc) => req(`/settings/print-layout/${doc}`);
export const apiSetPrintLayout = (doc, value) => req(`/settings/print-layout/${doc}`, { method: "POST", body: JSON.stringify({ value }) });
export const apiSetUiButtons = (value) => req("/settings/ui-buttons", { method: "POST", body: JSON.stringify({ value }) });
export const apiAiWoTerms = (wo) => req("/ai/wo-terms", { method: "POST", body: JSON.stringify(wo) });
export const apiLogout = () => req("/auth/logout", { method: "POST" });
export const apiGetActiveFY = () => req("/settings/fy");
export const apiSetActiveFY = (fy) => req("/settings/fy", { method: "POST", body: JSON.stringify({ active_fy: fy }) });
export const apiGetCompany = () => req("/settings/company");
export const apiSetCompany = (company) => req("/settings/company", { method: "POST", body: JSON.stringify({ company }) });
export const apiListSessions = () => req("/users/sessions");
export const apiForceLogout = (email) => req(`/users/${encodeURIComponent(email)}/force_logout`, { method: "POST" });
export const apiAttendancePunch = () => req("/attendance/punch", { method: "POST" });
export const apiAttendanceToday = () => req("/attendance/today");

export const apiRegister = (email, password, name, role = "User", extra = {}) =>
  req("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email, password, name, role,
      mobile: extra.mobile || "",
      employee_id: extra.employeeId || "",
      designation: extra.designation || "",
    }),
  });

export const apiMe = () => req("/auth/me");

// ---- Data snapshot (fetch full state) ----
export const apiFetchSnapshot = () => req("/snapshot");
export const apiPushSnapshot = (data) =>
  req("/snapshot", { method: "POST", body: JSON.stringify(data) });

// Atomic server-side counter bump for new vendor approvals (Feb 2026 fix for
// "code resets to AE0001 on fresh/empty local store"). Backend uses MongoDB
// $inc + maxUsed-serial scan, guaranteeing monotonicity across every device.
export const apiNextVendorSerial = () =>
  req("/counters/next-vendor", { method: "POST", body: "{}" });
export const apiNextExpenseSerial = () =>
  req("/counters/next-expense", { method: "POST", body: "{}" });

// ---- Admin: Selective HR Financials reset (pay bills + advances + HR PVs) ----
export const apiResetHrFinancials = () =>
  req("/admin/reset-hr-financials", { method: "POST", body: "{}" });

// ---- Individual upserts ----
export const apiUpsertVendor = (v) =>
  req("/vendors", { method: "POST", body: JSON.stringify(v) });
export const apiDeleteVendor = (id) =>
  req(`/vendors/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertBill = (b) =>
  req("/bills", { method: "POST", body: JSON.stringify(b) });
export const apiDeleteBill = (id) =>
  req(`/bills/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertExpense = (x) =>
  req("/expenses", { method: "POST", body: JSON.stringify(x) });
export const apiDeleteExpense = (id) =>
  req(`/expenses/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertFooding = (r) =>
  req("/fooding", { method: "POST", body: JSON.stringify(r) });
export const apiDeleteFooding = (id) =>
  req(`/fooding/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertBOQ = (b) =>
  req("/boqs", { method: "POST", body: JSON.stringify(b) });
export const apiDeleteBOQ = (id) =>
  req(`/boqs/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiListBOQs = () => req("/boqs");

export const apiUpsertWO = (w) =>
  req("/work_orders", { method: "POST", body: JSON.stringify(w) });
export const apiDeleteWO = (id) =>
  req(`/work_orders/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiListWOs = () => req("/work_orders");

export const apiPushPayments = (items) =>
  req("/payments/bulk", { method: "POST", body: JSON.stringify({ items }) });
export const apiDeletePayment = (pvNo) =>
  req(`/payments/${encodeURIComponent(pvNo).replace(/%2F/g, "/")}`, { method: "DELETE" });
export const apiDeletePaymentsBulk = (pvNos) =>
  req("/payments/delete_bulk", { method: "POST", body: JSON.stringify({ pvNos }) });

// ---- HR: Employees & Attendance ----
export const apiListEmployees = () => req("/employees");
export const apiUpsertEmployee = (e) =>
  req("/employees", { method: "POST", body: JSON.stringify(e) });
export const apiDeleteEmployee = (id) =>
  req(`/employees/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiListAttendance = () => req("/attendance");
export const apiUpsertAttendance = (a) =>
  req("/attendance", { method: "POST", body: JSON.stringify(a) });

// ---- HR: PayBills · Loans · Advance Requests · Recruitments · Exits ----
export const apiUpsertPayBill = (pb) =>
  req("/paybills", { method: "POST", body: JSON.stringify(pb) });
export const apiDeletePayBill = (id) =>
  req(`/paybills/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertLoan = (ln) =>
  req("/loans", { method: "POST", body: JSON.stringify(ln) });
export const apiDeleteLoan = (id) =>
  req(`/loans/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertAdvanceRequest = (ar) =>
  req("/advance_requests", { method: "POST", body: JSON.stringify(ar) });
export const apiDeleteAdvanceRequest = (id) =>
  req(`/advance_requests/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertRecruitment = (r) =>
  req("/recruitments", { method: "POST", body: JSON.stringify(r) });
export const apiDeleteRecruitment = (id) =>
  req(`/recruitments/${encodeURIComponent(id)}`, { method: "DELETE" });

export const apiUpsertExit = (x) =>
  req("/exits", { method: "POST", body: JSON.stringify(x) });
export const apiDeleteExit = (id) =>
  req(`/exits/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---- Users management (admin only) ----
export const apiListUsers = () => req("/users");
export const apiOtpReset = (email) => req(`/admin/users/${encodeURIComponent(email)}/otp-reset`, { method: "POST", body: "{}" });

export const apiRegisterUser = (body) =>
  req("/auth/register", { method: "POST", body: JSON.stringify(body) });
export const apiDeleteUser = (email) =>
  req(`/users/${encodeURIComponent(email)}`, { method: "DELETE" });
export const apiChangePassword = (email, new_password) =>
  req("/users/change-password", { method: "POST", body: JSON.stringify({ email, new_password }) });
export const apiUpdateMyAccount = (body) =>
  req("/users/me/update", { method: "POST", body: JSON.stringify(body) });
export const apiChangeMyPassword = (old_password, new_password) =>
  req("/users/change-password", { method: "POST", body: JSON.stringify({ old_password, new_password }) });
export const apiUpdateUserPermissions = (email, permissions) =>
  req(`/users/${encodeURIComponent(email)}/permissions`, { method: "PATCH", body: JSON.stringify(permissions) });
export const apiUpdateUserRole = (email, role) =>
  req(`/users/${encodeURIComponent(email)}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
export const apiSetCoreAccess = (email, core_all) =>
  req(`/users/${encodeURIComponent(email)}/core-access`, { method: "PATCH", body: JSON.stringify({ core_all }) });

export const apiGetCounters = () => req("/counters");
export const apiSetCounters = (c) =>
  req("/counters", { method: "POST", body: JSON.stringify(c) });

export const apiGetLogo = () => req("/logo");
export const apiSetLogo = (logo) =>
  req("/logo", { method: "POST", body: JSON.stringify({ logo }) });

// ---- Danger zone (admin only) ----
export const apiResetData = (wipe_users = false) =>
  req("/admin/reset-data", { method: "POST", body: JSON.stringify({ wipe_users }) });

// ---- Backup & Restore (Super Admin only) ----
export const apiDownloadBackup = () => req("/admin/backup");
export const apiGetAcl = () => req("/settings/acl");
export const apiSetAcl = (value) => req("/settings/acl", { method: "POST", body: JSON.stringify({ value }) });
export const apiOpsList = (kind) => req(`/ops/${kind}`);
export const apiOpsSave = (kind, doc) => req(`/ops/${kind}`, { method: "POST", body: JSON.stringify(doc) });
export const apiResetNumbering = (target) => req(`/admin/reset-numbering/${target}`, { method: "POST" });
export const apiRenumber = (target) => req(`/admin/renumber/${target}`, { method: "POST" });
export const apiListCounters = () => req("/admin/counters");
export const apiRealignCounter = (key, dry = false) => req(`/admin/realign-counter/${key}${dry ? "?dry=1" : ""}`, { method: "POST" });
export const apiOpsDelete = (kind, id) => req(`/ops/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiNewSyncKey = () => req("/admin/sync-key", { method: "POST" });
export const apiSyncReport = () => req("/admin/sync-report");
export const apiRestoreBackup = (collections, wipe_existing = false) =>
  req("/admin/restore", {
    method: "POST",
    body: JSON.stringify({ collections, wipe_existing }),
  });

// ---- Nightly Backups (Super Admin only) ----
export const apiListNightlyBackups = () => req("/admin/nightly-backups");
export const apiDownloadNightlyBackup = (id) =>
  req(`/admin/nightly-backups/${encodeURIComponent(id)}/download`);
export const apiDeleteNightlyBackup = (id) =>
  req(`/admin/nightly-backups/${encodeURIComponent(id)}`, { method: "DELETE" });
export const apiTriggerNightlyBackup = () =>
  req("/admin/nightly-backups/trigger", { method: "POST", body: "{}" });

export const apiNightlyMissing = (id) => req(`/admin/nightly-backups/${encodeURIComponent(id)}/missing`);
export const apiNightlyRestoreMissing = (id, ids) =>
  req(`/admin/nightly-backups/${encodeURIComponent(id)}/restore-missing`, { method: "POST", body: JSON.stringify({ ids }) });
export const apiFixDuplicateNumbers = (dry_run) => req("/admin/fix-duplicate-numbers", { method: "POST", body: JSON.stringify({ dry_run }) });
export const apiCoreConfig = () => req("/core/config");
export const apiCoreConfigSave = (cfg) => req("/core/config", { method: "PUT", body: JSON.stringify(cfg) });
export const apiCoreConfigHistory = () => req("/core/config/history");
export const apiUserDirectory = () => req("/users/directory");
export const apiNotifications = () => req("/notifications");
export const apiNotifRead = (id) => req(`/notifications/${id}/read`, { method: "POST" });
export const apiNotifReadAll = () => req("/notifications/read-all", { method: "POST" });
export const apiTasks = (scope = "mine") => req(`/tasks?scope=${scope}`);
export const apiTaskCreate = (t) => req("/tasks", { method: "POST", body: JSON.stringify(t) });
export const apiTaskUpdate = (id, patch) => req(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const apiTaskDelete = (id) => req(`/tasks/${id}`, { method: "DELETE" });


