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
    if (login(u.trim(), p)) {
      nav("/vendor");
    } else {
      const list = (typeof window !== "undefined")
        ? JSON.parse(localStorage.getItem("ae_vm_users") || "[]").map((x) => x.username).join(", ")
        : "";
      setErr(`Invalid credentials. Registered users: ${list || "admin"}`);
    }
  };

  const submitCreate = (e) => {
    e.preventDefault();
    try {
      createUser({ name: cname, username: cuser, password: cpass, role: crole });
      toast.success(`User "${cuser}" created — you can log in now`);
      // Prefill login and switch tab
      setU(cuser);
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
        <div className="hero-logo">
          <div className="hero-mark">AE</div>
        </div>
        <div className="hero-text">
          <div className="hero-eyebrow">ARUN ENTERPRISES</div>
          <h1 className="hero-title">Welcome to Arun Enterprises</h1>
          <div className="hero-sub">Vendor Management &amp; Bill Processing Portal</div>
          <div className="hero-nav">
            <a href="https://www.arunenterprises.com.in" target="_blank" rel="noreferrer">Home</a>
            <a href="https://www.arunenterprises.com.in/about-us.php" target="_blank" rel="noreferrer">About Us</a>
            <a href="https://www.arunenterprises.com.in/services.php" target="_blank" rel="noreferrer">Services</a>
            <a href="https://www.arunenterprises.com.in/projects.php" target="_blank" rel="noreferrer">Projects</a>
            <a href="https://www.arunenterprises.com.in/contact.php" target="_blank" rel="noreferrer">Contact</a>
          </div>
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
