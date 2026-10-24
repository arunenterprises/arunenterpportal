import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Shield, LogIn } from "lucide-react";
import { login, currentUserProfile } from "../lib/store";
import AuthSplash from "../components/AuthSplash";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [splash, setSplash] = useState(null); // { name }
  const [kicked] = useState(() => { const v = sessionStorage.getItem("ae_kicked"); sessionStorage.removeItem("ae_kicked"); return v; });
  const nav = useNavigate();

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const ok = await login(u, p);
      if (ok) {
        const nm = currentUserProfile()?.name || u.split("@")[0] || "User";
        setSplash({ name: nm });
      } else {
        setErr("Invalid email or password. Please contact administrator if you don't have an account.");
      }
    } catch (ex) {
      // 409 = account already active on another device (single-session policy)
      const msg = ex.message || "Login failed";
      if (/already logged in/i.test(msg)) {
        setErr(`⚠ ${msg}`);
      } else {
        setErr(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap" data-testid="login-page">
      {splash && (
        <AuthSplash
          mode="welcome"
          userName={splash.name}
          onDone={() => nav("/home")}
        />
      )}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#0b3d91" }}>
          <Shield />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>ARUN ENTERPRISES</div>
            <h2 style={{ margin: 0 }}>Sign In</h2>
          </div>
        </div>

        {kicked && (
          <div data-testid="login-kicked-alert" style={{ marginTop: 12, padding: "10px 12px", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, color: "#92400e", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
            ⚠ Aapki ID kisi doosre computer / browser par login ki gayi hai, isliye yahan se logout ho gaya ({kicked}).<br />
            Agar yeh aapne nahi kiya, to turant password badlein ya Admin ko batayein.
          </div>
        )}

        <form onSubmit={submitLogin} data-testid="login-form" style={{ marginTop: 14 }}>
          <p className="hint" style={{ textAlign: "center" }}>Enter the email &amp; password provided by your administrator.</p>
          <label>Email</label>
          <input data-testid="login-username" value={u} onChange={(e) => setU(e.target.value)} placeholder="you@example.com" autoFocus />
          <label>Password</label>
          <input data-testid="login-password" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
          {err && <div className="err" data-testid="login-error">{err}</div>}
          <button className="submit" data-testid="login-submit" disabled={busy}>
            <LogIn size={18} />
            {busy ? "Signing in…" : "Sign In"}
          </button>
          <p className="hint" style={{ marginTop: 14, fontSize: 10.5, textAlign: "center" }}>
            Employee accounts are created only by the Admin.
          </p>
        </form>
      </div>
    </div>
  );
}
