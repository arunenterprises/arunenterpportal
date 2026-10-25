import { apiGetAcl } from "./api";
import { currentRole } from "./store";

export const ACL_DEPTS = [
  { k: "gm", l: "1. GM Dashboard" }, { k: "client", l: "2. Client & Revenue" }, { k: "hr", l: "3. HR & Labour" },
  { k: "procurement", l: "4. Procurement" }, { k: "accounts", l: "5. Accounts & Vouchers" }, { k: "site", l: "6. Project & Site" },
  { k: "qc", l: "7. QC & Safety" }, { k: "plant", l: "8. Plant & Machinery" }, { k: "reports", l: "9. Reports Management" }, { k: "admin", l: "10. System Management" },
];
export const ACL_ROLES = ["Admin", "GM", "Purchase", "Accounts", "Viewer", "User"];
export const OPS_DEPT = {
  projects: "site", dpr: "site", indent: "site", qc_test: "qc", safety_audit: "qc", machine: "plant", machine_log: "plant", diesel_log: "plant",
  booking: "client", demand_letter: "client", tender: "client", agreement: "client", geo_site: "hr", geo_att: "hr", labour: "hr", labour_att: "hr", labour_bill: "hr", abstract: "client",
};
const PATH_DEPT = [["/gm", "gm"], ["/client-revenue", "client"], ["/hr", "hr"], ["/vendor", "procurement"], ["/purchase", "procurement"], ["/bill", "accounts"], ["/final", "accounts"],
  ["/site", "site"], ["/project", "site"], ["/qc-safety", "qc"], ["/plant", "plant"], ["/reports-hub", "reports"], ["/users", "admin"]];
const KEY = "ae_acl_v1";

export const getAcl = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const aclCell = (m, role, dept) => ({ v: true, c: role !== "Viewer", a: ["Admin", "GM"].includes(role), ...((m[role] || {})[dept] || {}) });
export const can = (dept, op) => {
  const r = currentRole();
  if (r === "SuperAdmin" || !dept) return true;
  if (dept === "gm") return ["Admin", "GM"].includes(r);
  return !!aclCell(getAcl(), r, dept)[op];
};
export const deptOfPath = (p) => (PATH_DEPT.find(([x]) => p === x || p.startsWith(`${x}/`)) || [])[1];
export const loadAcl = () => apiGetAcl().then((d) => {
  localStorage.setItem(KEY, JSON.stringify(d.value || {}));
  window.dispatchEvent(new Event("ae-acl"));
  return d.value || {};
}).catch(() => getAcl());
