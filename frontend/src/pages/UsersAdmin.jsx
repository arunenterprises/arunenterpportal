import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { UserPlus, Trash2, Key, ArrowLeft, Shield, Lock, AlertTriangle } from "lucide-react";
import { currentUserProfile, logout, resetLocalCache } from "../lib/store";
import { apiListUsers, apiRegisterUser, apiDeleteUser, apiChangePassword, apiChangeMyPassword, apiResetData } from "../lib/api";
import HomeNavBar from "../components/HomeNavBar";

const SUPER_ADMIN_EMAIL = "arunenterprises2023@gmail.com";
const isSuperAdmin = (email) => (email || "").toLowerCase().trim() === SUPER_ADMIN_EMAIL;

export default function UsersAdmin() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  // Create user form
  const [f, setF] = useState({ name: "", email: "", mobile: "", employee_id: "", designation: "", role: "User", password: "", password2: "" });
  // Self change-password form
  const [pw, setPw] = useState({ old_password: "", new_password: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  // Reset data
  const [resetBusy, setResetBusy] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [wipeUsers, setWipeUsers] = useState(false);

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
    if ((me?.role || "").toLowerCase() !== "admin") {
      toast.error("Admin access required");
      nav("/vendor");
      return;
    }
    load();
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
      });
      toast.success(`Employee "${f.name}" created`);
      setF({ name: "", email: "", mobile: "", employee_id: "", designation: "", role: "User", password: "", password2: "" });
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
            <button data-testid="btn-logout-admin" onClick={() => { logout(); nav("/login"); }} style={{ padding: "9px 18px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>
              Logout
            </button>
          </div>
        </div>

        {/* Change My Password */}
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
                    ) : (
                      <span
                        data-testid={`user-role-${u.email}`}
                        style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: u.role === "Admin" ? "#dbeafe" : "#e2e8f0", color: u.role === "Admin" ? "#1e40af" : "#334155" }}
                      >
                        {(u.role || "User").toUpperCase()}
                      </span>
                    )}
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
      </div>
    </div>
  );
}
