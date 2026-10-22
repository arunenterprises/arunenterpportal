import React from "react";
import { Monitor } from "lucide-react";

const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
const isTablet = /iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
const smallScreen = typeof window !== "undefined" && Math.min(window.screen.width, window.screen.height) < 600;
export const isPhone = !isTablet && (/iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini|IEMobile|Mobi/i.test(ua) || (touch && smallScreen));

// Full-screen notice shown instead of the ERP on mobile phones (tablets & computers allowed).
export const MobileBlock = () => (
  <div data-testid="mobile-block" style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg,#0b1f4d,#1e3a8a 60%,#0891b2)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, gap: 16, zIndex: 99999 }}>
    <img src="/arun-logo.jpg" alt="logo" style={{ width: 90, height: 90, objectFit: "contain", background: "#fff", borderRadius: 16, padding: 6 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
    <Monitor size={46} />
    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: .5 }}>ARUN ENTERPRISES ERP</div>
    <div data-testid="mobile-block-msg" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>Yeh software sirf Computer / Laptop par chalega.</div>
    <div style={{ fontSize: 13, opacity: .85, lineHeight: 1.5 }}>Mobile par ERP open nahi hota. Kripya Computer, Laptop ya Tablet ka use karein.</div>
  </div>
);
