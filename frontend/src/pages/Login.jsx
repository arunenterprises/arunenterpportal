import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { Shield, LogIn } from "lucide-react";
import { login } from "../lib/store";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
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
        setErr("Invalid email or password. Please contact administrator if you don't have an account.");
      }
    } catch (ex) {
      setErr(ex.message || "Login failed");
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
          <div className="hero-sub">Vendor Management &amp; Bill Processing Portal · Cloud Synced</div>
        </div>
      </div>

      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0b3d91" }}>
          <Shield />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>ARUN ENTERPRISES</div>
            <h2 style={{ margin: 0 }}>Sign In</h2>
          </div>
        </div>

        <form onSubmit={submitLogin} data-testid="login-form" style={{ marginTop: 14 }}>
          <p className="hint">Enter the email &amp; password provided by your administrator.</p>
          <label>Email</label>
          <input data-testid="login-username" value={u} onChange={(e) => setU(e.target.value)} placeholder="you@example.com" autoFocus />
          <label>Password</label>
          <input data-testid="login-password" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
          {err && <div className="err" data-testid="login-error">{err}</div>}
          <button className="submit" data-testid="login-submit" disabled={busy}>
            <LogIn size={13} style={{ verticalAlign: "middle", marginRight: 6 }} />
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="hint" style={{ marginTop: 14, fontSize: 10.5, textAlign: "center" }}>
            Employee accounts are created only by the Admin.
          </p>
        </form>
      </div>
    </div>
  );
}
