import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, createUser } from "../lib/store";
import { Shield, UserPlus, LogIn } from "lucide-react";
import { toast, Toaster } from "sonner";

export default function Login() {
  const [tab, setTab] = useState("login"); // "login" | "create"
  // Login state
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  // Create-user state
  const [cname, setCname] = useState("");
  const [cuser, setCuser] = useState("");
  const [cpass, setCpass] = useState("");
  const [crole, setCrole] = useState("User");
  const nav = useNavigate();

  const submitLogin = (e) => {
    e.preventDefault();
    if (login(u, p)) {
      nav("/vendor");
    } else {
      const list = (typeof window !== "undefined")
        ? JSON.parse(localStorage.getItem("ae_vm_users") || "[]").map((x) => x.username).join(", ")
        : "";
      setErr(`Invalid credentials. Registered users: ${list || "admin"}. Tip: passwords are case-sensitive, spaces are trimmed.`);
    }
  };

  const submitCreate = (e) => {
    e.preventDefault();
    try {
      const trimmedPass = (cpass || "").trim();
      const trimmedUser = (cuser || "").trim();
      createUser({ name: cname, username: trimmedUser, password: trimmedPass, role: crole });
      toast.success(`User "${trimmedUser}" created — you can log in now with password: ${trimmedPass}`);
      // Prefill login and switch tab
      setU(trimmedUser);
      setP("");
      setCname(""); setCuser(""); setCpass(""); setCrole("User");
      setTab("login");
    } catch (ex) {
      toast.error(ex.message);
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
          <div className="hero-sub">Vendor Management &amp; Bill Processing Portal</div>
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
            <UserPlus size={13} /> Create User
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={submitLogin} data-testid="login-form">
            <p className="hint">Sign in with your administrator credentials to continue.</p>
            <label>Username</label>
            <input data-testid="login-username" value={u} onChange={(e) => setU(e.target.value)} placeholder="admin" autoFocus />
            <label>Password</label>
            <input data-testid="login-password" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
            {err && <div className="err" data-testid="login-error">{err}</div>}
            <button className="submit" data-testid="login-submit">Sign in</button>
            <p className="hint" style={{ marginTop: 12 }}>Default: <b>admin</b> / <b>admin@123</b></p>
          </form>
        ) : (
          <form onSubmit={submitCreate} data-testid="create-form">
            <p className="hint">Register a new user. They can log in immediately.</p>
            <label>Full Name</label>
            <input data-testid="create-name" value={cname} onChange={(e) => setCname(e.target.value)} placeholder="e.g. Rahul Sharma" autoFocus />
            <label>Username</label>
            <input data-testid="create-username" value={cuser} onChange={(e) => setCuser(e.target.value)} placeholder="e.g. rahul.sharma" />
            <label>Password (min 4 chars)</label>
            <input data-testid="create-password" type="password" value={cpass} onChange={(e) => setCpass(e.target.value)} placeholder="••••••" />
            <label>Role</label>
            <select data-testid="create-role" value={crole} onChange={(e) => setCrole(e.target.value)}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
            <button className="submit" data-testid="create-submit">Create User</button>
            <p className="hint" style={{ marginTop: 12 }}>Already registered? <span style={{ color: "#1d4ed8", cursor: "pointer" }} onClick={() => setTab("login")} data-testid="switch-to-login">Sign in instead</span></p>
          </form>
        )}
      </div>
    </div>
  );
}
