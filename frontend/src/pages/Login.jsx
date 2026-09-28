import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, createUser, syncFromCloud } from "../lib/store";
import { Shield, UserPlus, LogIn, Cloud } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function Login() {
  const [tab, setTab] = useState("login"); // "login" | "create"
  // Login state
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Create-user state
  const [cname, setCname] = useState("");
  const [cemail, setCemail] = useState("");
  const [cmobile, setCmobile] = useState("");
  const [cempid, setCempid] = useState("");
  const [cdesig, setCdesig] = useState("");
  const [cpass, setCpass] = useState("");
  const [cpass2, setCpass2] = useState("");
  const [crole, setCrole] = useState("User");
  const nav = useNavigate();

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const ok = await login(u, p);
      if (ok) {
        toast.success("Signed in · Cloud data synced");
        nav("/vendor");
      } else {
        setErr("Invalid email or password. Please try again.");
      }
    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const trimmedEmail = (cemail || "").trim().toLowerCase();
      const trimmedPass = (cpass || "").trim();
      const trimmedPass2 = (cpass2 || "").trim();
      if (!cname.trim()) throw new Error("Full Name is required");
      if (!trimmedEmail) throw new Error("Email is required");
      if (!cmobile.trim()) throw new Error("Mobile No is required");
      if (!/^\d{10}$/.test(cmobile.trim())) throw new Error("Mobile No must be exactly 10 digits");
      if (!cempid.trim()) throw new Error("Employee ID is required");
      if (!cdesig.trim()) throw new Error("Designation is required");
      if (trimmedPass.length < 4) throw new Error("Password must be at least 4 characters");
      if (trimmedPass !== trimmedPass2) throw new Error("Passwords do not match");
      await createUser({
        name: cname, email: trimmedEmail, password: trimmedPass, role: crole,
        mobile: cmobile.trim(), employeeId: cempid.trim(), designation: cdesig.trim(),
      });
      try { await syncFromCloud(); } catch {}
      toast.success(`Account created · Signed in as ${trimmedEmail}`);
      nav("/vendor");
    } catch (ex) {
      toast.error(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap" data-testid="login-page">
      <Toaster position="top-center" richColors />
      <div className="hero-banner" data-testid="hero-banner">
        <div className="hero-logo hero-logo-image">
          <img src="https://customer-assets-rejwkqb3.emergentagent.net/job_vendor-workflow-sys/artifacts/l29ur9ov_Logo.jpg" alt="Arun Enterprises" />
        </div>
        <div className="hero-text">
          <div className="hero-eyebrow">ARUN ENTERPRISES</div>
          <h1 className="hero-title">Welcome to Arun Enterprises</h1>
          <div className="hero-sub">Vendor Management &amp; Bill Processing Portal · <Cloud size={12} style={{verticalAlign:"middle"}}/> Cloud Synced</div>
        </div>
      </div>

      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0b3d91" }}>
          <Shield />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>ARUN ENTERPRISES</div>
            <h2 style={{ margin: 0 }}>Vendor Management</h2>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs" data-testid="auth-tabs">
          <button
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => setTab("login")}
            data-testid="tab-login"
          >
            <LogIn size={13} /> Sign In
          </button>
          <button
            className={`auth-tab ${tab === "create" ? "active" : ""}`}
            onClick={() => setTab("create")}
            data-testid="tab-create"
          >
            <UserPlus size={13} /> Create Account
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={submitLogin} data-testid="login-form">
            <p className="hint">Sign in with your email address to access data across all your devices.</p>
            <label>Email</label>
            <input data-testid="login-username" value={u} onChange={(e) => setU(e.target.value)} placeholder="you@example.com" autoFocus />
            <label>Password</label>
            <input data-testid="login-password" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
            {err && <div className="err" data-testid="login-error">{err}</div>}
            <button className="submit" data-testid="login-submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCreate} data-testid="create-form">
            <p className="hint">Register a new employee account. Your data will sync across devices via secure cloud.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label>Full Name <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-name" value={cname} onChange={(e) => setCname(e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />
              </div>
              <div>
                <label>Email ID <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-username" type="email" value={cemail} onChange={(e) => setCemail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label>Mobile No <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-mobile" value={cmobile} onChange={(e) => setCmobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile" />
              </div>
              <div>
                <label>Employee ID <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-empid" value={cempid} onChange={(e) => setCempid(e.target.value)} placeholder="e.g. AE-EMP-001" />
              </div>
              <div>
                <label>Designation <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-designation" value={cdesig} onChange={(e) => setCdesig(e.target.value)} placeholder="e.g. Purchase Manager" />
              </div>
              <div>
                <label>Role</label>
                <select data-testid="create-role" value={crole} onChange={(e) => setCrole(e.target.value)}>
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <label>Password <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-password" type="password" value={cpass} onChange={(e) => setCpass(e.target.value)} placeholder="min 4 chars" />
              </div>
              <div>
                <label>Confirm Password <span style={{ color: "#dc2626" }}>*</span></label>
                <input data-testid="create-password2" type="password" value={cpass2} onChange={(e) => setCpass2(e.target.value)} placeholder="re-type password" />
              </div>
            </div>
            <button className="submit" data-testid="create-submit" disabled={busy} style={{ marginTop: 12 }}>
              {busy ? "Creating…" : "Create Account"}
            </button>
            <p className="hint" style={{ marginTop: 12 }}>Already registered? <span style={{ color: "#1d4ed8", cursor: "pointer" }} onClick={() => setTab("login")} data-testid="switch-to-login">Sign in instead</span></p>
          </form>
        )}
      </div>
    </div>
  );
}
