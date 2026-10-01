import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, PartyPopper, Hand, Rocket } from "lucide-react";

/**
 * AuthSplash — Full-screen colorful splash shown on login (mode="welcome")
 * or on logout (mode="goodbye"). Auto-dismisses after `duration` ms and
 * calls onDone(). Designed to feel celebratory with gradient background,
 * floating emoji particles, and animated primary title.
 */
const AuthSplash = ({ mode = "welcome", userName = "User", duration, onDone }) => {
  const isWelcome = mode === "welcome";
  const d = typeof duration === "number" ? duration : (isWelcome ? 2200 : 1800);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(false), d - 350);
    const t2 = setTimeout(() => { if (onDone) onDone(); }, d);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [d, onDone]);

  const bg = isWelcome
    ? "linear-gradient(135deg,#4f46e5 0%,#0ea5e9 45%,#10b981 100%)"
    : "linear-gradient(135deg,#be185d 0%,#f59e0b 55%,#ef4444 100%)";

  const emojis = isWelcome
    ? ["🎉", "✨", "🚀", "💼", "📊", "🏢", "⭐", "🌟", "💫", "🎊"]
    : ["👋", "💛", "🌙", "✨", "🫶", "☕", "💐", "🌸", "👐", "💫"];

  const particles = Array.from({ length: 22 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    dur: 3 + Math.random() * 2.5,
    size: 20 + Math.random() * 30,
    emoji: emojis[i % emojis.length],
    rot: Math.random() * 360,
  }));

  const title = isWelcome ? "Welcome to ARUN ENTERPRISES ERP" : "BYE-BYE";
  const subtitle = isWelcome
    ? `Have a productive day, ${userName}!`
    : `See you soon, ${userName}!`;
  const Icon = isWelcome ? Rocket : Hand;

  return createPortal(
    <div
      data-testid={`auth-splash-${mode}`}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        transition: "opacity .35s ease-out",
      }}
    >
      {/* Floating emoji particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: -60,
            fontSize: p.size,
            animation: `splash-float ${p.dur}s linear ${p.delay}s infinite`,
            transform: `rotate(${p.rot}deg)`,
            opacity: 0.85,
            textShadow: "0 2px 8px rgba(0,0,0,.25)",
            pointerEvents: "none",
          }}
        >
          {p.emoji}
        </div>
      ))}

      {/* Radial soft glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 40%, rgba(255,255,255,.25), rgba(255,255,255,0) 60%)",
        pointerEvents: "none",
      }} />

      {/* Center card */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          color: "#fff",
          padding: "40px 60px",
          background: "rgba(255,255,255,.08)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,.25)",
          boxShadow: "0 30px 80px rgba(0,0,0,.35)",
          maxWidth: 760,
          width: "88%",
          animation: "splash-pop .55s cubic-bezier(.2,1.3,.4,1) both",
        }}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 92, height: 92, borderRadius: "50%",
          background: isWelcome ? "linear-gradient(135deg,#fde68a,#f59e0b)" : "linear-gradient(135deg,#fecaca,#ef4444)",
          marginBottom: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,.3)",
          animation: "splash-bounce 1.4s ease-in-out infinite",
        }}>
          <Icon size={46} color="#fff" strokeWidth={2.4} />
        </div>

        {isWelcome ? (
          <>
            <div style={{ fontSize: 11, letterSpacing: 6, fontWeight: 800, opacity: .9, marginBottom: 8 }}>
              <Sparkles size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />
              ARUN ENTERPRISES
            </div>
            <h1 style={{
              margin: 0,
              fontSize: "clamp(26px, 4.4vw, 48px)",
              fontWeight: 900,
              letterSpacing: .5,
              lineHeight: 1.1,
              textShadow: "0 2px 10px rgba(0,0,0,.25)",
            }}>
              Welcome to <span style={{
                background: "linear-gradient(90deg,#fde68a,#fff,#fde68a)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundSize: "200% 100%",
                animation: "splash-shimmer 2s linear infinite",
              }}>ARUN ENTERPRISES ERP</span>
            </h1>
            <div style={{ marginTop: 14, fontSize: 20, fontWeight: 700, opacity: .95 }}>
              Hello, <span style={{ color: "#fde68a" }}>{userName}</span> <PartyPopper size={20} style={{ display: "inline", verticalAlign: -3, marginLeft: 4 }} />
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: .85, letterSpacing: 1 }}>Signed in · Loading your workspace…</div>
          </>
        ) : (
          <>
            <h1 style={{
              margin: 0,
              fontSize: "clamp(44px, 7vw, 92px)",
              fontWeight: 900,
              letterSpacing: 4,
              lineHeight: 1,
              textShadow: "0 2px 14px rgba(0,0,0,.3)",
              background: "linear-gradient(90deg,#fff,#fde68a,#fff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundSize: "200% 100%",
              animation: "splash-shimmer 1.6s linear infinite",
            }}>BYE-BYE</h1>
            <div style={{ marginTop: 18, fontSize: 22, fontWeight: 800, opacity: .95 }}>
              See you soon, <span style={{ color: "#fde68a" }}>{userName}</span> 👋
            </div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: .85, letterSpacing: 1 }}>Logging you out safely…</div>
          </>
        )}

        <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 160, height: 4, background: "rgba(255,255,255,.3)", borderRadius: 999, overflow: "hidden",
          }}>
            <div style={{
              width: "40%", height: "100%",
              background: "linear-gradient(90deg,#fde68a,#fff,#fde68a)",
              borderRadius: 999,
              animation: `splash-progress ${d}ms linear forwards`,
            }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes splash-float {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; }
          10% { opacity: .9; }
          100% { transform: translateY(-110vh) rotate(540deg); opacity: 0; }
        }
        @keyframes splash-pop {
          0% { transform: scale(.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes splash-bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes splash-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default AuthSplash;
