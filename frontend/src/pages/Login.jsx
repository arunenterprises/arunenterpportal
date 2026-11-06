import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Shield, LogIn, RefreshCw } from "lucide-react";
import { login, currentUserProfile, currentRole } from "../lib/store";
import { apiCaptcha } from "../lib/api";
const SA_EMAIL = "arunenterprises2023@gmail.com";
import AuthSplash from "../components/AuthSplash";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [splash, setSplash] = useState(null); // { name }
  const [kicked] = useState(() => { const v = sessionStorage.getItem("ae_kicked"); sessionStorage.removeItem("ae_kicked"); return v; });
  const [idle] = useState(() => { const v = sessionStorage.getItem("ae_idle"); sessionStorage.removeItem("ae_idle"); return v; });
  const nav = useNavigate();

  const [otpInfo, setOtpInfo] = useState(null);
  const [otp, setOtp] = useState("");
  const [left, setLeft] = useState(0);
  const [cap, setCap] = useState(null);
  const [capText, setCapText] = useState("");
  const needCap = u.trim().toLowerCase() !== SA_EMAIL && !otpInfo;
  const newCap = () => { setCapText(""); apiCaptcha().then(setCap).catch(() => setCap(null)); };
  useEffect(() => { newCap(); }, []);
  useEffect(() => {
    if (!otpInfo) return undefined;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((otpInfo.until - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [otpInfo]);

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr("");
    if (needCap && capText.trim().length < 5) { setErr("Captcha bharein"); return; }
    setBusy(true);
    try {
      const r = await login(u, p, otpInfo?.otp_token, otpInfo ? otp : undefined, needCap ? cap?.captcha_id : undefined, needCap ? capText : undefined);
      if (r.otp) {
        setOtpInfo({ ...r.otp, until: Date.now() + (r.otp.valid_seconds || 180) * 1000 });
        setOtp("");
        setLeft(r.otp.valid_seconds || 180);
      } else if (r.ok) {
        const nm = currentUserProfile()?.name || u.split("@")[0] || "User";
        setSplash({ name: nm });
      }
    } catch (ex) {
      const msg = ex.message || "Login failed";
      if (/expire|Dobara login/i.test(msg)) { setOtpInfo(null); setOtp(""); }
      newCap();
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };
  const resend = () => { setOtpInfo(null); setOtp(""); newCap(); toastHint(); };
  const toastHint = () => setErr("Naya OTP ke liye naya captcha bhar kar Sign In dabayein");

  return (
    <div className="login-wrap" data-testid="login-page">
      {splash && (
        <AuthSplash
          mode="welcome"
          userName={splash.name}
          onDone={() => nav(currentRole() === "SuperAdmin" ? "/home" : "/my-tasks")}
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
        {idle && (
          <div data-testid="login-idle-alert" style={{ marginTop: 12, padding: "10px 12px", background: "#e0f2fe", border: "1px solid #38bdf8", borderRadius: 8, color: "#075985", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
            ⏱ 15 minute tak koi kaam nahi hua, isliye suraksha ke liye aap logout ho gaye ({idle}). Dobara login karein.
          </div>
        )}

        <form onSubmit={submitLogin} data-testid="login-form" style={{ marginTop: 14 }}>
          <p className="hint" style={{ textAlign: "center" }}>Enter the email &amp; password provided by your administrator.</p>
          <label>Email</label>
          <input data-testid="login-username" disabled={!!otpInfo} value={u} onChange={(e) => setU(e.target.value)} placeholder="you@example.com" autoFocus />
          <label>Password</label>
          <input data-testid="login-password" disabled={!!otpInfo} type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
          {needCap && (
            <div data-testid="login-captcha-box" style={{ marginTop: 6 }}>
              <label>Captcha</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {cap ? <img data-testid="login-captcha-img" src={cap.image} alt="captcha" style={{ height: 46, borderRadius: 6, border: "1px solid #c7d2fe", userSelect: "none" }} draggable={false} /> : <span style={{ fontSize: 12 }}>Loading…</span>}
                <button type="button" data-testid="login-captcha-refresh" onClick={newCap} title="Naya captcha" style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 6, padding: 8, cursor: "pointer" }}><RefreshCw size={15} /></button>
              </div>
              <input data-testid="login-captcha" value={capText} onChange={(e) => setCapText(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))} placeholder="Upar ke 5 akshar likhein" autoComplete="off" style={{ marginTop: 6, letterSpacing: 4, fontWeight: 800 }} />
            </div>
          )}
          {otpInfo && (
            <div data-testid="login-otp-box" style={{ marginTop: 10, padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e3a8a" }}>OTP aapki registered email {otpInfo.mobile} par bheja gaya hai (Inbox / Spam dekhein)</div>
              <input data-testid="login-otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit OTP" inputMode="numeric" autoFocus style={{ marginTop: 8, letterSpacing: 6, fontSize: 18, textAlign: "center", fontWeight: 800 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
                <span data-testid="login-otp-timer" style={{ color: left > 0 ? "#166534" : "#dc2626", fontWeight: 700 }}>{left > 0 ? `Valid: ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "OTP expire ho gaya"}</span>
                <button type="button" data-testid="login-otp-resend" onClick={resend} style={{ background: "none", border: "none", color: "#1d4ed8", fontWeight: 700, cursor: "pointer" }}>Naya OTP bhejein</button>
              </div>
            </div>
          )}
          {err && <div className="err" data-testid="login-error">{err}</div>}
          <button className="submit" data-testid="login-submit" disabled={busy || (otpInfo && (otp.length !== 6 || left === 0))}>
            <LogIn size={18} />
            {busy ? "Please wait…" : otpInfo ? "Verify OTP & Sign In" : "Sign In"}
          </button>
          <p className="hint" style={{ marginTop: 14, fontSize: 10.5, textAlign: "center" }}>
            Employee accounts are created only by the Admin.
          </p>
        </form>
      </div>
    </div>
  );
}
