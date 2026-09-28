import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { UserPlus, Trash2, Key, ArrowLeft, Shield } from "lucide-react";
import { currentUserProfile, logout } from "../lib/store";
import { apiListUsers, apiRegisterUser, apiDeleteUser, apiChangePassword } from "../lib/api";

export default function UsersAdmin() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  // Create user form
  const [f, setF] = useState({ name: "", email: "", mobile: "", employee_id: "", designation: "", role: "User", password: "", password2: "" });

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

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", padding: 20 }}>
      <Toaster position="top-center" richColors />
      <div style={{ maxWidth: 1200, margin: "0 auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0b3d91", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0b3d91" }}>
            <Shield />
            <div>
              <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>ADMIN PANEL</div>
              <h2 style={{ margin: 0 }}>Users Management</h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button data-testid="btn-back-vendor" onClick={() => nav("/vendor")} style={{ padding: "6px 12px", background: "#e2e8f0", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ArrowLeft size={13} /> Back to App
            </button>
            <button data-testid="btn-logout-admin" onClick={() => { logout(); nav("/login"); }} style={{ padding: "6px 12px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
              Logout
            </button>
          </div>
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
                <option value="Admin">Admin</option>
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
                    <span style={{ padding: "2px 8px", fontSize: 10, fontWeight: 700, borderRadius: 999, background: u.role === "Admin" ? "#dbeafe" : "#e2e8f0", color: u.role === "Admin" ? "#1e40af" : "#334155" }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>
                    <button
                      data-testid={`user-changepw-${u.email}`}
                      onClick={() => handleChangePassword(u.email)}
                      style={{ padding: "3px 8px", fontSize: 10.5, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 4, cursor: "pointer", fontWeight: 600, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      <Key size={11} /> Password
                    </button>
                    <button
                      data-testid={`user-delete-${u.email}`}
                      onClick={() => handleDelete(u.email)}
                      style={{ padding: "3px 8px", fontSize: 10.5, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
