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
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.detail || msg; } catch {}
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json();
};

// ---- Auth ----
export const apiLogin = (identifier, password) =>
  req("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });

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

// ---- Users management (admin only) ----
export const apiListUsers = () => req("/users");
export const apiRegisterUser = (body) =>
  req("/auth/register", { method: "POST", body: JSON.stringify(body) });
export const apiDeleteUser = (email) =>
  req(`/users/${encodeURIComponent(email)}`, { method: "DELETE" });
export const apiChangePassword = (email, new_password) =>
  req("/users/change-password", { method: "POST", body: JSON.stringify({ email, new_password }) });
export const apiChangeMyPassword = (old_password, new_password) =>
  req("/users/change-password", { method: "POST", body: JSON.stringify({ old_password, new_password }) });

export const apiGetCounters = () => req("/counters");
export const apiSetCounters = (c) =>
  req("/counters", { method: "POST", body: JSON.stringify(c) });

export const apiGetLogo = () => req("/logo");
export const apiSetLogo = (logo) =>
  req("/logo", { method: "POST", body: JSON.stringify({ logo }) });

// ---- Danger zone (admin only) ----
export const apiResetData = (wipe_users = false) =>
  req("/admin/reset-data", { method: "POST", body: JSON.stringify({ wipe_users }) });
