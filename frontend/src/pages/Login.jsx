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
  const [cpass, setCpass] = useState("");
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
      await createUser({ name: cname, email: trimmedEmail, password: trimmedPass, role: crole });
      // Auto-sync (empty on new account is fine)
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
            <p className="hint">Register a new account. Your data will sync across devices via secure cloud.</p>
            <label>Full Name</label>
            <input data-testid="create-name" value={cname} onChange={(e) => setCname(e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />
            <label>Email</label>
            <input data-testid="create-username" type="email" value={cemail} onChange={(e) => setCemail(e.target.value)} placeholder="you@example.com" />
            <label>Password (min 4 chars)</label>
            <input data-testid="create-password" type="password" value={cpass} onChange={(e) => setCpass(e.target.value)} placeholder="••••••" />
            <label>Role</label>
            <select data-testid="create-role" value={crole} onChange={(e) => setCrole(e.target.value)}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
            <button className="submit" data-testid="create-submit" disabled={busy}>
              {busy ? "Creating…" : "Create Account"}
            </button>
            <p className="hint" style={{ marginTop: 12 }}>Already registered? <span style={{ color: "#1d4ed8", cursor: "pointer" }} onClick={() => setTab("login")} data-testid="switch-to-login">Sign in instead</span></p>
          </form>
        )}
      </div>
    </div>
  );
}
