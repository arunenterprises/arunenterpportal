import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { UserPlus, Trash2, Key, ArrowLeft, Shield, Lock, AlertTriangle, Download, Upload, Database, Moon, RefreshCw } from "lucide-react";
import { currentUserProfile, logout, resetLocalCache, resetHrFinancials, listFYOptions, getActiveFYOverride, setActiveFYOverride, getCompany, setCompanyLocal, DEFAULT_COMPANY } from "../lib/store";
import { apiListUsers, apiRegisterUser, apiDeleteUser, apiChangePassword, apiChangeMyPassword, apiResetData, apiUpdateUserPermissions, apiUpdateUserRole, apiDownloadBackup, apiRestoreBackup, apiListNightlyBackups, apiDownloadNightlyBackup, apiDeleteNightlyBackup, apiTriggerNightlyBackup, apiListSessions, apiForceLogout, apiGetActiveFY, apiSetActiveFY, apiGetCompany, apiSetCompany } from "../lib/api";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import AuthSplash from "../components/AuthSplash";

const SUPER_ADMIN_EMAIL = "arunenterprises2023@gmail.com";
const isSuperAdmin = (email) => (email || "").toLowerCase().trim() === SUPER_ADMIN_EMAIL;

// ---- Company Master card (SuperAdmin ONLY) ----
const COMPANY_FIELDS = [
  { key: "name", label: "Company Name *", span: 2, required: true },
  { key: "tagline", label: "Tagline", span: 2 },
  { key: "pillLine", label: "Business Line", span: 2 },
  { key: "address", label: "Registered Address", span: 3 },
  { key: "state", label: "State" },
  { key: "tollFree", label: "Toll-Free / Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "gst", label: "GST No." },
  { key: "pan", label: "PAN No." },
  { key: "cin", label: "CIN / Reg. No." },
  { key: "bankName", label: "Bank Name" },
  { key: "bankAccountNo", label: "Bank Account No." },
  { key: "bankIfsc", label: "Bank IFSC" },
  { key: "bankBranch", label: "Bank Branch" },
];
const CompanyMasterCard = ({ isSuper }) => {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_COMPANY, ...getCompany() }));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGetCompany();
        if (r.company) {
          setCompanyLocal(r.company);
          setDraft({ ...DEFAULT_COMPANY, ...r.company });
          setDirty(false);
        }
      } catch { /* ignore */ }
    })();
    const onSync = () => { setDraft({ ...DEFAULT_COMPANY, ...getCompany() }); };
    window.addEventListener("ae-company-changed", onSync);
    return () => window.removeEventListener("ae-company-changed", onSync);
  }, []);

  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true); };

  const save = async () => {
    if (!isSuper) return toast.error("Only SuperAdmin can update Company Master");
    if (!draft.name?.trim()) return toast.error("Company name is required");
    setBusy(true);
    try {
      const r = await apiSetCompany(draft);
      setCompanyLocal(r.company || draft);
      setDraft({ ...DEFAULT_COMPANY, ...(r.company || draft) });
      setDirty(false);
      toast.success("✓ Company Master updated · letterhead sync across all devices");
    } catch (ex) {
      toast.error(ex.message || "Save failed");
    } finally { setBusy(false); }
  };

  const resetForm = () => { setDraft({ ...DEFAULT_COMPANY, ...getCompany() }); setDirty(false); };
  const resetDefaults = () => {
    if (!window.confirm("Reset all fields to original defaults? Click Save to persist.")) return;
    setDraft({ ...DEFAULT_COMPANY }); setDirty(true);
  };

  if (!isSuper) return null;
  return (
    <div data-testid="company-master-card" style={{ marginTop: 18, border: "1.5px solid #86efac", borderRadius: 6, background: "#f0fdf4" }}>
      <div style={{ background: "#bbf7d0", padding: "7px 12px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#166534", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", justifyContent: "space-between" }}>
        <span>🏢 Company Master · SuperAdmin</span>
        {dirty && <span style={{ padding: "1px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>UNSAVED CHANGES</span>}
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {COMPANY_FIELDS.map((f) => (
          <div key={f.key} style={{ gridColumn: `span ${f.span || 1}` }}>
            <label style={{ fontSize: 10, color: "#166534", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 3 }}>{f.label}</label>
            <input
              data-testid={`cm-${f.key}`}
              value={draft[f.key] || ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={DEFAULT_COMPANY[f.key] || f.label}
              style={{ width: "100%", padding: "7px 10px", border: `1.5px solid ${dirty ? "#fcd34d" : "#86efac"}`, borderRadius: 4, fontSize: 11.5, fontWeight: 600, background: "#fff", color: "#0f172a", fontFamily: ["gst", "pan", "bankAccountNo", "bankIfsc", "cin"].includes(f.key) ? "monospace" : "inherit" }}
            />
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid #86efac", background: "#dcfce7", display: "flex", gap: 8, alignItems: "center" }}>
        <button data-testid="cm-save" onClick={save} disabled={busy || !dirty} style={{ padding: "9px 18px", background: busy || !dirty ? "#94a3b8" : "linear-gradient(135deg,#16a34a,#14532d)", color: "#fff", border: "none", borderRadius: 5, cursor: busy || !dirty ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase", boxShadow: busy || !dirty ? "none" : "0 2px 6px rgba(22,163,74,.4)" }}>{busy ? "Saving…" : "💾 Save Company Master"}</button>
        <button data-testid="cm-reset" onClick={resetForm} disabled={!dirty} style={{ padding: "9px 14px", background: !dirty ? "#cbd5e1" : "#fff", color: !dirty ? "#64748b" : "#166534", border: `1.5px solid ${!dirty ? "#cbd5e1" : "#86efac"}`, borderRadius: 5, cursor: !dirty ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11 }}>↶ Revert Changes</button>
        <button data-testid="cm-defaults" onClick={resetDefaults} style={{ padding: "9px 14px", background: "#fff", color: "#78350f", border: "1.5px solid #fcd34d", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11 }}>⌂ Reset to Defaults</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10.5, color: "#166534", fontStyle: "italic" }}>💡 Saved changes appear on company letterhead, PV footer, bank advice & printed reports across all devices.</div>
      </div>
    </div>
  );
};

// ---- Financial Year management card (SuperAdmin / Admin only) ----
const FinancialYearCard = ({ isAdmin }) => {
  const [current, setCurrent] = useState(getActiveFYOverride() || "");
  const [draft, setDraft] = useState(getActiveFYOverride() || "");
  const [busy, setBusy] = useState(false);
  const options = listFYOptions();
  const prettyFY = (fy) => (fy && fy.length === 4) ? `20${fy.slice(0, 2)} - 20${fy.slice(2, 4)}` : fy || "—";

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGetActiveFY();
        const v = (r.active_fy || "").trim();
        if (v) { setActiveFYOverride(v); setCurrent(v); setDraft(v); }
      } catch (e) { /* ignore */ }
    })();
    const onFy = () => { const v = getActiveFYOverride(); setCurrent(v); setDraft(v); };
    window.addEventListener("ae-fy-changed", onFy);
    return () => window.removeEventListener("ae-fy-changed", onFy);
  }, []);

  const save = async () => {
    if (!isAdmin) return toast.error("Only SuperAdmin / Admin can change FY");
    setBusy(true);
    try {
      await apiSetActiveFY(draft);
      setActiveFYOverride(draft);
      setCurrent(draft);
      toast.success(draft ? `Active Financial Year set to FY ${prettyFY(draft)} · All new codes will use this` : "FY override cleared · will auto-compute from date");
    } catch (ex) {
      toast.error(ex.message || "FY save failed");
    } finally { setBusy(false); }
  };

  if (!isAdmin) return null;
  return (
    <div data-testid="fy-card" style={{ marginTop: 18, border: "1.5px solid #a5b4fc", borderRadius: 6, background: "#eef2ff" }}>
      <div style={{ background: "#c7d2fe", padding: "6px 12px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#3730a3", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase" }}>
        📅 Financial Year · SuperAdmin / Admin
      </div>
      <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1.4fr 1.4fr auto auto", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 10.5, color: "#3730a3", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Current Active FY</label>
          <div data-testid="fy-current" style={{ marginTop: 4, padding: "8px 10px", background: "#fff", border: "1.5px solid #a5b4fc", borderRadius: 5, fontWeight: 900, color: "#3730a3", fontSize: 13 }}>{current ? `FY ${prettyFY(current)}` : "Auto (current date)"}</div>
        </div>
        <div>
          <label style={{ fontSize: 10.5, color: "#3730a3", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Set Active FY *</label>
          <select data-testid="fy-select" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ marginTop: 4, width: "100%", padding: "8px 10px", border: "1.5px solid #a5b4fc", borderRadius: 5, fontSize: 12, fontWeight: 700, background: "#fff" }}>
            <option value="">— Auto (current date) —</option>
            {options.map((fy) => <option key={fy} value={fy}>FY {prettyFY(fy)}</option>)}
          </select>
        </div>
        <button data-testid="fy-save" onClick={save} disabled={busy || draft === current} style={{ padding: "9px 16px", background: busy || draft === current ? "#94a3b8" : "linear-gradient(135deg,#4f46e5,#3730a3)", color: "#fff", border: "none", borderRadius: 5, cursor: busy || draft === current ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase", boxShadow: busy || draft === current ? "none" : "0 2px 6px rgba(79,70,229,.4)" }}>{busy ? "Saving…" : "Save FY"}</button>
        <button data-testid="fy-clear" onClick={() => setDraft("")} disabled={!draft} style={{ padding: "9px 14px", background: !draft ? "#cbd5e1" : "#fff", color: !draft ? "#64748b" : "#3730a3", border: `1.5px solid ${!draft ? "#cbd5e1" : "#a5b4fc"}`, borderRadius: 5, cursor: !draft ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 11 }}>Reset</button>
      </div>
      <div style={{ padding: "0 12px 10px", fontSize: 10.5, color: "#4338ca", fontStyle: "italic" }}>
        💡 Changing FY affects all new Vendor Codes, Bill Nos, Payment Vouchers, Advance Refs, Employee Codes. Existing records keep their original FY. Setting syncs to all users within ~8 seconds.
      </div>
    </div>
  );
};

// ---- Active Sessions Section (Feb 2026 · user request) ----
// Shows every user's current login state with IP, user-agent, and login time.
// Admin can force-logout any user to free their single-session lock.
const ActiveSessionsSection = ({ meEmail }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiListSessions();
      setRows(r.items || []);
    } catch (ex) {
      toast.error(ex.message || "Could not load sessions");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // auto-refresh every 15s
    const onSync = () => load();
    window.addEventListener("ae-sync-done", onSync);
    return () => { clearInterval(t); window.removeEventListener("ae-sync-done", onSync); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kick = async (email) => {
    if (!window.confirm(`Force-logout ${email}?\n\nTheir token will be cleared on next action and they can re-login.`)) return;
    try {
      await apiForceLogout(email);
      toast.success(`${email} forcibly logged out`);
      await load();
    } catch (ex) { toast.error(ex.message || "Force-logout failed"); }
  };

  const active = rows.filter((r) => r.active);
  return (
    <div data-testid="active-sessions-section" style={{ marginTop: 16, border: "1.5px solid #86efac", borderRadius: 6, background: "#f0fdf4" }}>
      <div style={{ background: "#dcfce7", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#166534", display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>🟢 ACTIVE SESSIONS · {active.length} ONLINE / {rows.length} TOTAL · ADMIN &amp; SUPERADMIN ONLY</span>
        <button onClick={load} style={{ padding: "3px 10px", background: "#166534", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>↻ Refresh</button>
      </div>
      <div style={{ padding: 10, overflowX: "auto" }}>
        {loading ? (<div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 10 }}>Loading…</div>) : rows.length === 0 ? (<div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: 10 }}>No session data</div>) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#dcfce7" }}>
                {["Status", "User", "Role", "Designation", "Login Time (UTC)", "IP Address", "Device / Browser", "Action"].map((h) => (
                  <th key={h} style={{ padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#166534", borderBottom: "1px solid #86efac", textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.email} style={{ background: i % 2 ? "#f0fdf4" : "#fff", borderBottom: "1px solid #d1fae5" }}>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ display: "inline-block", padding: "1px 8px", background: r.active ? "#15803d" : "#94a3b8", color: "#fff", fontSize: 9.5, fontWeight: 800, borderRadius: 999, letterSpacing: 0.3 }}>{r.active ? "ONLINE" : "offline"}</span>
                  </td>
                  <td style={{ padding: "6px 10px" }}><b>{r.name}</b><br/><span style={{ fontSize: 10, color: "#64748b" }}>{r.email}</span></td>
                  <td style={{ padding: "6px 10px", fontSize: 10.5, fontWeight: 700 }}>{r.role || "User"}</td>
                  <td style={{ padding: "6px 10px", fontSize: 10.5 }}>{r.designation || "—"}</td>
                  <td style={{ padding: "6px 10px", fontSize: 10.5, fontFamily: "monospace" }}>{r.login_at ? r.login_at.slice(0, 19).replace("T", " ") : "—"}</td>
                  <td style={{ padding: "6px 10px", fontSize: 10.5, fontFamily: "monospace" }}>{r.ip || "—"}</td>
                  <td style={{ padding: "6px 10px", fontSize: 9.5, color: "#475569", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.user_agent}>{r.user_agent || "—"}</td>
                  <td style={{ padding: "6px 10px" }}>
                    {r.active && r.email !== meEmail && (
                      <button onClick={() => kick(r.email)} data-testid={`sess-kick-${r.email}`} style={{ padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Force Logout</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};


// Static role → permissions matrix used purely for display in the Users list.
// Actual enforcement is done by canCreate / canApprove in store.js.
const rolePerms = (email, role) => {
  const isSA = (email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const r = isSA ? "SuperAdmin" : role || "User";
  const base = { create: false, edit: false, submit: false, approve: false };
  if (r === "SuperAdmin" || r === "Admin" || r === "GM") return { create: true, edit: true, submit: true, approve: true };
  if (r === "Purchase" || r === "Accounts" || r === "User") return { create: true, edit: true, submit: true, approve: false };
  if (r === "Viewer") return base;
  return base;
};

// Effective per-user permissions: custom overrides win over role defaults.
const effectivePerms = (u) => {
  if (u?.permissions && typeof u.permissions === "object") {
    const def = rolePerms(u.email, u.role);
    return {
      create: typeof u.permissions.create === "boolean" ? u.permissions.create : def.create,
      edit: typeof u.permissions.edit === "boolean" ? u.permissions.edit : def.edit,
      submit: typeof u.permissions.submit === "boolean" ? u.permissions.submit : def.submit,
      approve: typeof u.permissions.approve === "boolean" ? u.permissions.approve : def.approve,
    };
  }
  return rolePerms(u?.email, u?.role);
};

const PermChip = ({ label, on, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={disabled ? "Only Super Admin can toggle" : `Click to ${on ? "revoke" : "grant"} ${label}`}
    style={{
      padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 4, marginRight: 3, marginBottom: 3,
      background: on ? "#dcfce7" : "#f1f5f9", color: on ? "#166534" : "#94a3b8",
      border: `1px solid ${on ? "#86efac" : "#cbd5e1"}`, letterSpacing: .3, whiteSpace: "nowrap",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? .8 : 1,
      transition: "all .15s ease",
    }}
  >{on ? "✓" : "✕"} {label}</button>
);

export default function UsersAdmin() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [goodbye, setGoodbye] = useState(null);
  // Create user form (incl. per-user access powers assigned by SuperAdmin at registration)
  const [f, setF] = useState({
    name: "", email: "", mobile: "", employee_id: "", designation: "", role: "User",
    password: "", password2: "",
    // Access powers (Feb-2026 — "superadmin deside karega …power" directive)
    is_full_access: false,     // all permissions = true
    is_accounts_approver: false, // can approve Weekly Fooding / Advance Request / etc.
    perm_create: true, perm_edit: true, perm_submit: true, perm_approve: false,
  });
  // Self change-password form
  const [pw, setPw] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  // Reset data
  const [resetBusy, setResetBusy] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [wipeUsers, setWipeUsers] = useState(false);
  // Backup / Restore
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreWipe, setRestoreWipe] = useState(false);
  // Nightly backups
  const [nightlyList, setNightlyList] = useState([]);
  const [nightlyBusy, setNightlyBusy] = useState(false);
  const [triggerBusy, setTriggerBusy] = useState(false);

  const loadNightly = async () => {
    try {
      const r = await apiListNightlyBackups();
      setNightlyList(r.items || []);
    } catch (e) { /* non-superadmins get 403 — ignore silently */ }
  };

  const load = async () => {
    try {
      const list = await apiListUsers();
      setUsers(list);
    } catch (e) {
      toast.error(e.message);
      if (e.message?.includes("Admin access")) nav("/vendor");
    }
  };

  useEffect(() => {
    if (!isSuperAdmin(me?.user) && (me?.role || "").toLowerCase() !== "admin") {
      toast.error("Admin access required");
      nav("/vendor");
      return;
    }
    load();
    if (isSuperAdmin(me?.user)) loadNightly();
    // REAL-TIME CROSS-USER SYNC: refresh user list on every ae-sync-done pulse.
    const onSync = () => { load(); if (isSuperAdmin(me?.user)) loadNightly(); };
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  const setField = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submitCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (!f.name.trim()) throw new Error("Full Name is required");
      if (!f.email.trim() || !f.email.includes("@")) throw new Error("Valid Email is required");
      if (!/^\d{10}$/.test(f.mobile.trim())) throw new Error("Mobile No must be exactly 10 digits");
      if (!f.employee_id.trim()) throw new Error("Employee ID is required");
      if (!f.designation.trim()) throw new Error("Designation is required");
      if ((f.password || "").trim().length < 4) throw new Error("Password min 4 chars");
      if (f.password !== f.password2) throw new Error("Passwords do not match");
      await apiRegisterUser({
        email: f.email.trim().toLowerCase(),
        name: f.name.trim(),
        password: f.password.trim(),
        role: f.role,
        mobile: f.mobile.trim(),
        employee_id: f.employee_id.trim(),
        designation: f.designation.trim(),
        is_full_access: !!f.is_full_access,
        is_accounts_approver: !!f.is_accounts_approver,
        permissions: {
          create: !!f.perm_create,
          edit: !!f.perm_edit,
          submit: !!f.perm_submit,
          approve: !!f.perm_approve,
        },
      });
      toast.success(`Employee "${f.name}" created · ${f.is_full_access ? "FULL ACCESS" : f.role}${f.is_accounts_approver ? " · Approver" : ""}`);
      setF({ name: "", email: "", mobile: "", employee_id: "", designation: "", role: "User", password: "", password2: "", is_full_access: false, is_accounts_approver: false, perm_create: true, perm_edit: true, perm_submit: true, perm_approve: false });
      await load();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (email) => {
    if (!window.confirm(`Delete employee ${email}?`)) return;
    try {
      await apiDeleteUser(email);
      toast.success("Employee deleted");
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const handleChangePassword = async (email) => {
    const np = window.prompt(`New password for ${email} (min 4 chars):`);
    if (!np) return;
    try {
      await apiChangePassword(email, np);
      toast.success("Password updated");
    } catch (e) { toast.error(e.message); }
  };

  const submitMyPassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      if (!pw.old_password.trim()) throw new Error("Current password is required");
      if ((pw.new_password || "").trim().length < 4) throw new Error("New password min 4 chars");
      if (pw.new_password !== pw.confirm) throw new Error("New passwords do not match");
      if (pw.old_password === pw.new_password) throw new Error("New password must be different from current");
      await apiChangeMyPassword(pw.old_password.trim(), pw.new_password.trim());
      toast.success("Your password has been updated");
      setPw({ old_password: "", new_password: "", confirm: "" });
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setPwBusy(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupBusy(true);
    try {
      const data = await apiDownloadBackup();
      const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ae-erp-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const totalDocs = Object.values(data.collections || {}).reduce((n, arr) => n + (arr?.length || 0), 0);
      toast.success(`Backup downloaded · ${totalDocs} records across ${Object.keys(data.collections || {}).length} collections`);
    } catch (ex) {
      toast.error(`Backup failed: ${ex.message}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm(`Restore from "${file.name}"?\n\n${restoreWipe ? "⚠ WIPE existing data first, then restore." : "Upsert into existing data (merge by id)."}\n\nSuperAdmin account preserved either way.`)) return;
    setRestoreBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const collections = parsed.collections || parsed;
      if (!collections || typeof collections !== "object") throw new Error("Invalid backup file — no collections found");
      const r = await apiRestoreBackup(collections, restoreWipe);
      const restored = Object.entries(r.restored || {}).map(([k, v]) => `${k}:${v}`).join(" · ");
      toast.success(`Restore done · ${restored || "no changes"}`);
      resetLocalCache();
      setTimeout(() => window.location.reload(), 1500);
    } catch (ex) {
      toast.error(`Restore failed: ${ex.message}`);
    } finally {
      setRestoreBusy(false);
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (resetPhrase.trim() !== "RESET") {
      toast.error('Type RESET (in caps) to confirm');
      return;
    }
    const scope = wipeUsers ? "all data + non-admin users" : "all vendors, bills, payments";
    if (!window.confirm(`This will permanently delete ${scope}. Continue?`)) return;
    setResetBusy(true);
    try {
      const r = await apiResetData(wipeUsers);
      resetLocalCache();
      toast.success(`Reset done · vendors:${r.vendors} bills:${r.bills} payments:${r.payments}${wipeUsers ? ` users:${r.users_removed}` : ""}`);
      setResetPhrase("");
      setWipeUsers(false);
      await load();
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", padding: 20 }}>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div style={{ maxWidth: 1200, margin: "0 auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 20 }}>
        <ModuleHero
          tag={isSuperAdmin(me?.user) ? "Administrator · SuperAdmin" : "Administrator · Admin"}
          title="Employees · Roles · Permissions · FY"
          subtitle="Create users · Reset passwords · Active sessions · Backup / Restore · Financial Year"
          icon={Shield}
          gradient="linear-gradient(135deg,#7f1d1d 0%,#991b1b 45%,#e11d48 100%)"
          shadowRgba="153,27,27,.28"
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0b3d91", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0b3d91" }}>
            <Shield />
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>
                {isSuperAdmin(me?.user) ? "SUPER ADMIN PANEL" : "ADMIN PANEL"}
              </div>
              <h2 style={{ margin: 0 }}>
                {isSuperAdmin(me?.user) ? "Super Admin — Users Management" : "Users Management"}
              </h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button data-testid="btn-back-vendor" onClick={() => nav("/vendor")} style={{ padding: "6px 12px", background: "#e2e8f0", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowLeft size={13} /> Back to App
            </button>
          </div>
        </div>

        {/* Change My Password */}
        <FinancialYearCard isAdmin={isSuperAdmin(me?.user) || (me?.role || "").toLowerCase() === "admin"} />
        <CompanyMasterCard isSuper={isSuperAdmin(me?.user)} />
        <div style={{ marginTop: 18, border: "1px solid #cbd5e1", borderRadius: 6 }}>
          <div style={{ background: "#fef9c3", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#854d0e", display: "flex", alignItems: "center", gap: 6 }}>
            <Lock size={12} /> CHANGE MY PASSWORD ({me?.user})
          </div>
          <form onSubmit={submitMyPassword} style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Current Password *</label>
              <input
                data-testid="self-pw-old"
                type="password"
                value={pw.old_password}
                onChange={(e) => setPw((p) => ({ ...p, old_password: e.target.value }))}
                placeholder="current password"
                style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, marginTop: 2 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>New Password *</label>
              <input
                data-testid="self-pw-new"
                type="password"
                value={pw.new_password}
                onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))}
                placeholder="min 4 chars"
                style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, marginTop: 2 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Confirm New *</label>
              <input
                data-testid="self-pw-confirm"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="re-type new"
                style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, marginTop: 2 }}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                type="submit"
                data-testid="self-pw-submit"
                disabled={pwBusy}
                style={{ padding: "8px 16px", background: "#d97706", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Key size={13} /> {pwBusy ? "Updating…" : "Update My Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Create user form */}
        <div style={{ marginTop: 18, border: "1px solid #cbd5e1", borderRadius: 6 }}>
          <div style={{ background: "#f1f5f9", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#0b3d91" }}>
            REGISTER NEW EMPLOYEE
          </div>
          <form onSubmit={submitCreate} style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              ["name", "Full Name *", "e.g. Rahul Sharma", "text"],
              ["email", "Email ID *", "you@example.com", "email"],
              ["mobile", "Mobile No *", "10-digit", "text"],
              ["employee_id", "Employee ID *", "AE-EMP-001", "text"],
              ["designation", "Designation *", "Purchase Manager", "text"],
              ["password", "Password *", "min 4 chars", "password"],
              ["password2", "Confirm Password *", "re-type", "password"],
            ].map(([k, lbl, ph, tp]) => (
              <div key={k}>
                <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>{lbl}</label>
                <input
                  data-testid={`admin-create-${k}`}
                  type={tp}
                  value={f[k]}
                  onChange={(e) => setField(k, k === "mobile" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value)}
                  placeholder={ph}
                  style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, marginTop: 2 }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Role</label>
              <select
                data-testid="admin-create-role"
                value={f.role}
                onChange={(e) => setField("role", e.target.value)}
                style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, marginTop: 2 }}
              >
                <option value="User">User</option>
                <option value="Viewer">Viewer (read-only)</option>
                <option value="Purchase">Purchase (create only)</option>
                <option value="Accounts">Accounts (check + approve)</option>
                <option value="GM">General Manager (all + final approve)</option>
                <option value="Admin">Admin (full access)</option>
              </select>
              {/* Live permissions preview for the selected role */}
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 2 }} data-testid="admin-role-perms-preview">
                {(() => {
                  const p = rolePerms(f.email, f.role);
                  return (
                    <>
                      <PermChip label="Create" on={p.create} />
                      <PermChip label="Edit" on={p.edit} />
                      <PermChip label="Submit (Under-Approval)" on={p.submit} />
                      <PermChip label="Approve" on={p.approve} />
                    </>
                  );
                })()}
              </div>
            </div>
            {/* ---- ACCESS POWERS — assigned by SuperAdmin at registration time ---- */}
            <div style={{ gridColumn: "1 / -1", marginTop: 8, padding: 10, background: "#fff7ed", border: "1.5px solid #fdba74", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .6, color: "#9a3412", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Key size={13} /> Access Powers · SuperAdmin assigns at registration time
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {/* LEFT · High-level power toggles */}
                <div style={{ padding: 8, background: "#fff", border: "1px solid #fdba74", borderRadius: 5 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>⚡ High-level power</div>
                  <label data-testid="power-full-access" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                    <input type="checkbox" checked={f.is_full_access} onChange={(e) => {
                      const on = e.target.checked;
                      setF((p) => ({ ...p, is_full_access: on, perm_create: on || p.perm_create, perm_edit: on || p.perm_edit, perm_submit: on || p.perm_submit, perm_approve: on ? true : p.perm_approve }));
                    }} style={{ width: 15, height: 15 }} />
                    <span style={{ display: "inline-block", padding: "2px 8px", background: "#fef2f2", color: "#991b1b", borderRadius: 10, fontSize: 10, fontWeight: 800, letterSpacing: .3 }}>FULL ACCESS</span>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 500 }}>— all powers (create · edit · submit · approve)</span>
                  </label>
                  <label data-testid="power-approver" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#0f172a" }}>
                    <input type="checkbox" checked={f.is_accounts_approver} onChange={(e) => setF((p) => ({ ...p, is_accounts_approver: e.target.checked, perm_approve: e.target.checked ? true : p.perm_approve }))} style={{ width: 15, height: 15 }} />
                    <span style={{ display: "inline-block", padding: "2px 8px", background: "#ecfdf5", color: "#065f46", borderRadius: 10, fontSize: 10, fontWeight: 800, letterSpacing: .3 }}>APPROVER</span>
                    <span style={{ color: "#64748b", fontSize: 11, fontWeight: 500 }}>— Weekly Fooding · Advance Request · PV re-approve</span>
                  </label>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic", marginTop: 4 }}>Admin role (from dropdown above) separately grants Users-Admin screen access.</div>
                </div>
                {/* RIGHT · Fine-grained CRUD toggles */}
                <div style={{ padding: 8, background: "#fff", border: "1px solid #fdba74", borderRadius: 5 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>🔧 Fine-grained permissions</div>
                  {[
                    ["perm_create", "Create (new records)"],
                    ["perm_edit", "Edit (existing records)"],
                    ["perm_submit", "Submit (send under-approval)"],
                    ["perm_approve", "Approve / Final Approve"],
                  ].map(([k, lbl]) => (
                    <label key={k} data-testid={`perm-${k}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", cursor: "pointer", fontSize: 12, color: "#0f172a" }}>
                      <input type="checkbox" checked={f[k]} disabled={f.is_full_access} onChange={(e) => setField(k, e.target.checked)} style={{ width: 14, height: 14 }} />
                      <span style={{ fontWeight: 600 }}>{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
              <button
                type="submit"
                data-testid="admin-create-submit"
                disabled={busy}
                style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <UserPlus size={14} /> {busy ? "Creating…" : "Register Employee"}
              </button>
            </div>
          </form>
        </div>

        {/* Users list */}
        <div style={{ marginTop: 16, border: "1px solid #cbd5e1", borderRadius: 6 }}>
          <div style={{ background: "#f1f5f9", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#0b3d91" }}>
            REGISTERED EMPLOYEES ({users.length})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Name</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Email</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Mobile</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Emp ID</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Designation</th>
                <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>Role</th>
                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Permissions</th>
                <th style={{ padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} data-testid={`user-row-${u.email}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "5px 8px" }}>{u.name}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{u.email}</td>
                  <td style={{ padding: "5px 8px" }}>{u.mobile || "—"}</td>
                  <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{u.employee_id || "—"}</td>
                  <td style={{ padding: "5px 8px" }}>{u.designation || "—"}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>
                    {isSuperAdmin(u.email) ? (
                      <span
                        data-testid={`user-role-${u.email}`}
                        style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: "#f3e8ff", color: "#6b21a8", border: "1px solid #d8b4fe", letterSpacing: 0.4 }}
                        title="Primary Super Admin — full access including Reset All Data"
                      >
                        SUPERADMIN
                      </span>
                    ) : isSuperAdmin(me?.user) ? (
                      <select
                        data-testid={`user-role-${u.email}`}
                        value={u.role || "User"}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          if (newRole === (u.role || "User")) return;
                          if (!window.confirm(`Change role for ${u.name} (${u.email}) from ${(u.role || "User")} → ${newRole}?\n\nNote: Permissions will be reset to the new role's defaults.`)) return;
                          try {
                            await apiUpdateUserRole(u.email, newRole);
                            toast.success(`${u.name} is now ${newRole}`);
                            await load();
                          } catch (ex) { toast.error(ex.message); }
                        }}
                        style={{ padding: "3px 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 999, background: u.role === "Admin" ? "#dbeafe" : "#e2e8f0", color: u.role === "Admin" ? "#1e40af" : "#334155", border: "1px solid #cbd5e1", cursor: "pointer", textTransform: "uppercase" }}
                        title="Change user role · SuperAdmin only"
                      >
                        {["User", "Admin", "Accounts", "GM", "HR", "Viewer"].map((r) => (
                          <option key={r} value={r}>{r.toUpperCase()}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        data-testid={`user-role-${u.email}`}
                        style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: u.role === "Admin" ? "#dbeafe" : "#e2e8f0", color: u.role === "Admin" ? "#1e40af" : "#334155" }}
                      >
                        {(u.role || "User").toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "5px 8px" }} data-testid={`user-perms-${u.email}`}>
                    {(() => {
                      const p = effectivePerms(u);
                      const canToggle = isSuperAdmin(me?.user) && !isSuperAdmin(u.email);
                      const togglePerm = async (key) => {
                        if (!canToggle) return;
                        try {
                          const next = { ...p, [key]: !p[key] };
                          await apiUpdateUserPermissions(u.email, { [key]: next[key] });
                          toast.success(`${key.toUpperCase()} ${next[key] ? "granted" : "revoked"} for ${u.name}`);
                          await load();
                        } catch (ex) { toast.error(ex.message); }
                      };
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                          <PermChip label="Create"  on={p.create}  disabled={!canToggle} onClick={() => togglePerm("create")} />
                          <PermChip label="Edit"    on={p.edit}    disabled={!canToggle} onClick={() => togglePerm("edit")} />
                          <PermChip label="Submit"  on={p.submit}  disabled={!canToggle} onClick={() => togglePerm("submit")} />
                          <PermChip label="Approve" on={p.approve} disabled={!canToggle} onClick={() => togglePerm("approve")} />
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>
                    {isSuperAdmin(me?.user) && (
                      <button
                        data-testid={`user-changepw-${u.email}`}
                        onClick={() => handleChangePassword(u.email)}
                        style={{ padding: "3px 8px", fontSize: 10.5, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4, cursor: "pointer", fontWeight: 600, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 3 }}
                        title="Change this user's password (Super Admin only)"
                      >
                        <Key size={11} /> Password
                      </button>
                    )}
                    {!isSuperAdmin(u.email) && isSuperAdmin(me?.user) && (
                      <button
                        data-testid={`user-delete-${u.email}`}
                        onClick={() => handleDelete(u.email)}
                        style={{ padding: "3px 8px", fontSize: 10.5, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                        title="Delete this user (Super Admin only)"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    )}
                    {!isSuperAdmin(me?.user) && (
                      <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>read-only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active Sessions (Admin / SuperAdmin only) · IP + Location + Login Time */}
        <ActiveSessionsSection meEmail={me?.user} />

        {/* Backup & Restore (SUPER ADMIN ONLY) */}
        {isSuperAdmin(me?.user) && (
          <div style={{ marginTop: 16, border: "1.5px solid #93c5fd", borderRadius: 6, background: "#eff6ff" }}>
            <div style={{ background: "#dbeafe", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
              <Database size={12} /> BACKUP & RESTORE · SUPER ADMIN ONLY
            </div>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 14, alignItems: "start" }}>
              <div style={{ fontSize: 11.5, color: "#1e3a8a", lineHeight: 1.6 }}>
                <b>Download Backup</b>: Poora database (vendors · bills · pay bills · employees · payments · counters) ek JSON file me milega. Weekly download karke Google Drive ya USB me safe rakho.
                <br/><b>Restore</b>: Backup JSON upload karo — purane naye MongoDB cluster par shift karne ke liye bhi yahi use hoga.
                <br/><a href="/MIGRATION_GUIDE.md" target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", textDecoration: "underline", fontWeight: 600 }}>📖 Complete Migration Guide dekho</a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  data-testid="btn-download-backup"
                  onClick={handleDownloadBackup}
                  disabled={backupBusy}
                  style={{ padding: "10px 14px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, cursor: backupBusy ? "wait" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                >
                  <Download size={14} /> {backupBusy ? "Preparing…" : "Download Backup (JSON)"}
                </button>
                <div style={{ fontSize: 10, color: "#475569", textAlign: "center" }}>
                  Includes: users, vendors, bills, payments, pay bills, employees, counters, logo
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 11, color: "#1e3a8a", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    data-testid="restore-wipe-first"
                    type="checkbox"
                    checked={restoreWipe}
                    onChange={(e) => setRestoreWipe(e.target.checked)}
                  />
                  Wipe existing data first (clean restore)
                </label>
                <label
                  data-testid="btn-restore-backup"
                  style={{ padding: "10px 14px", background: restoreBusy ? "#9ca3af" : "#0f766e", color: "#fff", border: "none", borderRadius: 5, cursor: restoreBusy ? "wait" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                >
                  <Upload size={14} /> {restoreBusy ? "Restoring…" : "Restore Backup (Upload JSON)"}
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleRestoreBackup}
                    disabled={restoreBusy}
                    style={{ display: "none" }}
                  />
                </label>
                <div style={{ fontSize: 10, color: "#475569", textAlign: "center" }}>
                  SuperAdmin account is always preserved
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nightly Backups (SUPER ADMIN ONLY) — scheduled daily 2 AM IST via .emergent/crons.yml */}
        {isSuperAdmin(me?.user) && (
          <div style={{ marginTop: 16, border: "1.5px solid #a5b4fc", borderRadius: 6, background: "#eef2ff" }}>
            <div style={{ background: "#e0e7ff", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#3730a3", display: "flex", alignItems: "center", gap: 6 }}>
              <Moon size={12} /> NIGHTLY BACKUPS · DAILY 2 AM IST · AUTO EMAIL TO SUPERADMIN · LAST 7 RETAINED
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 11.5, color: "#1e3a8a", lineHeight: 1.6 }}>
                  <b>Automatic flow</b>: Har raat 2 AM IST par full backup generate hota hai, server par store hota hai, aur <b>{SUPER_ADMIN_EMAIL}</b> par summary email send ho jati hai. Last {7} backups retained — purane auto-delete.
                </div>
                <div style={{ display: "inline-flex", gap: 6 }}>
                  <button
                    data-testid="btn-refresh-nightly"
                    onClick={async () => { setNightlyBusy(true); await loadNightly(); setNightlyBusy(false); }}
                    disabled={nightlyBusy}
                    style={{ padding: "6px 12px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 4, cursor: nightlyBusy ? "wait" : "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}
                  ><RefreshCw size={12} /> {nightlyBusy ? "Loading…" : "Refresh"}</button>
                  <button
                    data-testid="btn-trigger-nightly"
                    onClick={async () => {
                      if (!window.confirm("Trigger a nightly backup NOW (manual run)?\n\nSame flow as the 2 AM cron: generates backup, stores it, emails SuperAdmin.")) return;
                      setTriggerBusy(true);
                      try {
                        await apiTriggerNightlyBackup();
                        toast.success("Backup triggered — refreshing list in 3 seconds…");
                        setTimeout(() => { loadNightly(); setTriggerBusy(false); }, 3000);
                      } catch (e) { toast.error(`Trigger failed: ${e.message}`); setTriggerBusy(false); }
                    }}
                    disabled={triggerBusy}
                    style={{ padding: "6px 12px", background: triggerBusy ? "#9ca3af" : "#7c3aed", color: "#fff", border: "none", borderRadius: 4, cursor: triggerBusy ? "wait" : "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}
                  ><Moon size={12} /> {triggerBusy ? "Running…" : "Run Backup Now"}</button>
                </div>
              </div>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #c7d2fe", borderRadius: 5, background: "#fff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#eef2ff", position: "sticky", top: 0 }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #c7d2fe" }}>Backup ID</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid #c7d2fe" }}>Generated At (UTC)</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", borderBottom: "1px solid #c7d2fe" }}>Records</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: "1px solid #c7d2fe" }}>Collections</th>
                      <th style={{ padding: "6px 10px", textAlign: "center", borderBottom: "1px solid #c7d2fe" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nightlyList.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>No nightly backups yet · First one auto-runs tonight at 2 AM IST (or click "Run Backup Now" to test).</td></tr>
                    ) : nightlyList.map((nb) => (
                      <tr key={nb.id} data-testid={`nightly-row-${nb.id}`}>
                        <td style={{ padding: "5px 10px", fontFamily: "monospace", fontSize: 10, fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>{nb.id}</td>
                        <td style={{ padding: "5px 10px", borderBottom: "1px solid #e2e8f0" }}>{(nb.generated_at || "").replace("T", " ").slice(0, 19)}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 700, borderBottom: "1px solid #e2e8f0" }}>{nb.total_records}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>{Object.keys(nb.collection_counts || {}).length}</td>
                        <td style={{ padding: "5px 10px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                          <button
                            data-testid={`nightly-dl-${nb.id}`}
                            onClick={async () => {
                              try {
                                const full = await apiDownloadNightlyBackup(nb.id);
                                const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url; a.download = `${nb.id}.json`;
                                document.body.appendChild(a); a.click(); a.remove();
                                URL.revokeObjectURL(url);
                                toast.success(`Downloaded ${nb.id}`);
                              } catch (e) { toast.error(`Download failed: ${e.message}`); }
                            }}
                            style={{ padding: "3px 10px", fontSize: 10, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, marginRight: 4 }}
                          >⬇ Download</button>
                          <button
                            data-testid={`nightly-del-${nb.id}`}
                            onClick={async () => {
                              if (!window.confirm(`Delete nightly backup ${nb.id}?`)) return;
                              try { await apiDeleteNightlyBackup(nb.id); toast.success("Deleted"); loadNightly(); }
                              catch (e) { toast.error(`Delete failed: ${e.message}`); }
                            }}
                            style={{ padding: "3px 10px", fontSize: 10, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}
                          >🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone - Reset all data (SUPER ADMIN ONLY) */}
        {isSuperAdmin(me?.user) && (
        <div style={{ marginTop: 16, border: "1.5px solid #fca5a5", borderRadius: 6, background: "#fef2f2" }}>
          <div style={{ background: "#fee2e2", padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#991b1b", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={12} /> DANGER ZONE — RESET ALL DATA · SUPER ADMIN ONLY
          </div>
          <form onSubmit={submitReset} style={{ padding: 12, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <div style={{ fontSize: 11, color: "#7f1d1d", lineHeight: 1.5 }}>
              Yeh permanently delete karega: <b>vendors, bills, payments, counters, logo</b>.
              <br />Optionally non-admin employees bhi delete kar sakte hain. Admin account safe rahega.
              <br />Confirm karne ke liye niche box me <b>RESET</b> type karein.
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Type "RESET" to confirm *</label>
              <input
                data-testid="reset-confirm-phrase"
                value={resetPhrase}
                onChange={(e) => setResetPhrase(e.target.value)}
                placeholder="RESET"
                style={{ width: "100%", padding: "6px 8px", border: "1px solid #fca5a5", borderRadius: 4, fontSize: 12, marginTop: 2, background: "#fff" }}
              />
            </div>
            <label style={{ fontSize: 11, color: "#7f1d1d", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <input
                data-testid="reset-wipe-users"
                type="checkbox"
                checked={wipeUsers}
                onChange={(e) => setWipeUsers(e.target.checked)}
              />
              Also delete non-admin employees
            </label>
            <div style={{ textAlign: "right" }}>
              <button
                type="submit"
                data-testid="reset-data-submit"
                disabled={resetBusy || resetPhrase.trim() !== "RESET"}
                style={{ padding: "8px 16px", background: resetPhrase.trim() === "RESET" ? "#dc2626" : "#fca5a5", color: "#fff", border: "none", borderRadius: 5, cursor: resetPhrase.trim() === "RESET" ? "pointer" : "not-allowed", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Trash2 size={13} /> {resetBusy ? "Resetting…" : "Reset All Data"}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* HR-only Reset — safer scoped reset for pay bills + advance requests + HR PVs */}
        {isSuperAdmin(me?.email) && (
          <div style={{ marginTop: 16, padding: 16, background: "#fef3c7", border: "1.5px solid #f59e0b", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#78350f", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={14} /> SuperAdmin · Reset HR Pay Bills + Advances (SCOPED)
            </div>
            <div style={{ fontSize: 11, color: "#78350f", marginBottom: 10, lineHeight: 1.6 }}>
              Sirf <b>Pay Bills</b>, <b>Advance Requests</b> aur HR-sourced <b>Payment Vouchers</b> (PV/HR/*, PV/ADV/*, PV/HR-FNF/*) ko clear karega.
              <br/><b>Preserved:</b> Employees · Attendance · Leaves · Loans · Recruitments · Exits · Vendors · Vendor Bills · Vendor PVs — sab safe rahenge.
            </div>
            <button
              data-testid="reset-hr-financials"
              onClick={async () => {
                if (!window.confirm("⚠ Reset HR Pay Bills + Advances?\n\nSaare pay bills, advance requests aur HR PVs delete ho jayenge.\nEmployees aur Vendors data safe rahega.\n\nContinue?")) return;
                try {
                  const res = await resetHrFinancials();
                  toast.success(`HR financials reset · ${res.paybills_removed ?? 0} pay bills · ${res.advance_requests_removed ?? 0} advances · ${res.hr_payment_vouchers_removed ?? 0} PVs removed`);
                  setTimeout(() => window.location.reload(), 1500);
                } catch (e) {
                  toast.error(`Reset failed: ${e.message || e}`);
                }
              }}
              style={{ padding: "8px 16px", background: "#b45309", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Trash2 size={13} /> Reset HR Pay Bills + Advances
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
