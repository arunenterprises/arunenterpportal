import React, { useEffect, useState } from "react";

/**
 * One-shot 1-second brand splash shown once per browser session on the very
 * first mount of the App shell. After it fades out it never re-appears until
 * the tab is fully closed (sessionStorage flag).
 */
const SplashScreen = () => {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem("ae_splash_shown"); } catch { return true; }
  });

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem("ae_splash_shown", "1"); } catch {}
    const t = setTimeout(() => setShow(false), 1000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      data-testid="splash-screen"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "linear-gradient(135deg, #0b1a4d 0%, #1e3a8a 55%, #0d9488 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 18,
        animation: "aeSplashFadeOut 0.35s ease 0.72s forwards",
      }}
    >
      <img
        src="/arun-logo.jpg"
        alt="Arun Enterprises"
        style={{
          width: 128, height: 128, borderRadius: 22, objectFit: "cover",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          animation: "aeSplashPulse 0.85s cubic-bezier(.34,1.56,.64,1) both",
          background: "#fff",
        }}
      />
      <div style={{ color: "#fff", fontWeight: 800, letterSpacing: 4, fontSize: 22 }}>
        ARUN ENTERPRISES
      </div>
      <div style={{ color: "#c7d2fe", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
        Vendor · Purchase · Accounts Portal
      </div>
      <style>{`
        @keyframes aeSplashPulse {
          0%   { transform: scale(0.55) rotate(-6deg); opacity: 0; }
          55%  { transform: scale(1.08) rotate(2deg);  opacity: 1; }
          100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
        }
        @keyframes aeSplashFadeOut {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
