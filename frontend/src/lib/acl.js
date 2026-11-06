import { apiGetAcl } from "./api";
import { currentRole, currentUserEmail, isAccountsManager } from "./store";

export const ACL_DEPTS = [
  { k: "gm", l: "1. GM Dashboard" }, { k: "client", l: "2. Client & Revenue Management" }, { k: "hr", l: "3. HR Management" },
  { k: "procurement", l: "4. Procurement Management" }, { k: "accounts", l: "5. Finance Management" }, { k: "accounting", l: "5. Finance · Accounting & Ledger" }, { k: "site", l: "6. Project Management" },
  { k: "qc", l: "7. QC & Safety Management" }, { k: "plant", l: "8. P & M Management" }, { k: "reports", l: "9. Reports Management" }, { k: "admin", l: "10. System Management" },
];
export const ACL_ROLES = ["Admin", "GM", "Purchase", "Accounts", "HR", "Viewer", "User", "Member Civil", "Member OHE", "Member Electrical", "Member Procurement", "Member HR & Admin", "Member Legal", "Member Financial", "Sr. Site Operation Manager", "Accounts Manager", "Purchase Manager"];
export const ACL_OPS = [["v", "View"], ["c", "Create"], ["e", "Edit"], ["d", "Delete"], ["a", "Approve"]];
// Sensitive widgets / columns SuperAdmin can hide per role or per user
export const MASK_ITEMS = [
  { k: "card:kpi-month-billing", l: "Card · Is Mahine ki Billing" },
  { k: "card:kpi-receivable", l: "Card · Baki Receivable" },
  { k: "card:kpi-retention", l: "Card · Retention Held" },
  { k: "card:kpi-tds", l: "Card · Total TDS Kata" },
  { k: "card:kpi-gst-payable", l: "Card · GST Payable (Govt.)" },
  { k: "card:gm-crm-kpi", l: "Card · GM Dashboard Client & Revenue money cards" },
  { k: "col:Net Payable", l: "Column · Net Payable" },
  { k: "col:TDS", l: "Column · TDS % / TDS Amount" },
  { k: "col:GST", l: "Column · GST / CGST / SGST / IGST" },
  { k: "col:Basic", l: "Column · Basic / Taxable" },
  { k: "col:Gross", l: "Column · Gross" },
  { k: "col:Amount", l: "Column · Amount / Total / Value" },
  { k: "col:Rate", l: "Column · Rate" },
];
export const OPS_DEPT = {
  projects: "site", dpr: "site", indent: "site", qc_test: "qc", safety_audit: "qc", machine: "plant", machine_log: "plant", diesel_log: "plant",
  booking: "client", demand_letter: "client", tender: "client", agreement: "client", geo_site: "hr", geo_att: "hr", labour: "hr", labour_att: "hr", labour_bill: "hr", abstract: "client",
  ...Object.fromEntries(["core_project", "core_progress", "core_escalation", "core_target", "core_block", "core_drum", "core_substation", "core_equip_test", "core_amc", "core_hr_ticket", "core_payroll_freeze", "core_bg", "core_eot", "core_claim", "core_ra_bill"].map((k) => [k, "site"])),
  ...Object.fromEntries(["proc_rfq", "proc_cs", "proc_po", "proc_grn", "proc_invoice", "stock_count"].map((k) => [k, "procurement"])),
};
const PATH_DEPT = [["/gm", "gm"], ["/client-revenue", "client"], ["/hr", "hr"], ["/vendor", "procurement"], ["/purchase", "procurement"], ["/bill", "accounts"], ["/final", "accounts"],
  ["/site", "site"], ["/project", "site"], ["/qc-safety", "qc"], ["/plant", "plant"], ["/reports-hub", "reports"], ["/users", "admin"]];
const KEY = "ae_acl_v1";

export const getAcl = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const ACC_DEF = (role) => { const full = ["GM", "Accounts Manager"].includes(role), mf = role === "Member Financial"; return { v: full || mf, c: full || mf, e: full || mf, d: full, a: full }; };
export const aclDefault = (role, dept) => dept === "accounting" ? ACC_DEF(role) : ({ v: dept === "gm" ? ["Admin", "GM"].includes(role) : true, c: role !== "Viewer", e: role !== "Viewer", d: role === "Admin", a: role === "Admin" });
export const aclRoleCell = (m, role, dept) => ({ ...aclDefault(role, dept), ...((m[role] || {})[dept] || {}) });
export const aclCell = (m, role, dept, email = "") => ({ ...aclRoleCell(m, role, dept), ...((((m._users || {})[email]) || {})[dept] || {}) });
export const can = (dept, op) => {
  const r = currentRole();
  if (r === "SuperAdmin" || !dept) return true;
  if (dept === "accounting" && op !== "d" && isAccountsManager()) return true;
  return !!aclCell(getAcl(), r, dept, currentUserEmail())[op];
};
export const maskedKeys = () => {
  const r = currentRole();
  if (r === "SuperAdmin") return [];
  const m = getAcl();
  const u = (m._userMask || {})[currentUserEmail()];
  return Array.isArray(u) ? u : ((m._mask || {})[r] || []);
};
export const deptOfPath = (p) => (PATH_DEPT.find(([x]) => p === x || p.startsWith(`${x}/`)) || [])[1];
export const loadAcl = () => apiGetAcl().then((d) => {
  localStorage.setItem(KEY, JSON.stringify(d.value || {}));
  window.dispatchEvent(new Event("ae-acl"));
  return d.value || {};
}).catch(() => getAcl());
