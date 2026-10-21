import React from "react";

/**
 * ModuleHero — Consistent gradient hero banner for every module screen.
 * Matches the HR Management hero style user approved (Feb 2026).
 *
 * Props:
 *   tag        : small uppercase label on top (e.g. "VENDOR MANAGEMENT · V1")
 *   title      : large bold department action line (e.g. "Registration · KYC · Approval")
 *   subtitle   : short description below title
 *   icon       : lucide-react icon component (will render inside the rounded square)
 *   bgIcon     : (optional) same or related icon for the watermark on the right
 *   gradient   : CSS gradient string. Defaults to HR purple → pink.
 *   shadowRgba : rgba shadow colour tuned to the gradient
 */
const ModuleHero = ({
  tag,
  title,
  subtitle,
  icon: Icon,
  bgIcon,
  gradient = "linear-gradient(135deg, #4c1d95 0%, #5b21b6 45%, #db2777 100%)",
  shadowRgba = "76,29,149,.28",
  rightSlot = null,
}) => {
  const BgIcon = bgIcon || Icon;
  return (
    <div
      data-testid="module-hero"
      style={{
        background: gradient,
        color: "#fff",
        borderRadius: 14,
        padding: 22,
        boxShadow: `0 10px 40px rgba(${shadowRgba})`,
        position: "relative",
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      {BgIcon && (
        <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.08, pointerEvents: "none" }} aria-hidden>
          <BgIcon size={220} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {Icon && (
            <div style={{ width: 52, height: 52, borderRadius: 13, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={28} />
            </div>
          )}
          <div>
            {tag && <div style={{ fontSize: 20, letterSpacing: 1.2, color: "#fff", fontWeight: 900, textTransform: "uppercase" }}>{tag}</div>}
            {title && <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, marginTop: 3, color: "rgba(255,255,255,.9)" }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.82)", marginTop: 4, letterSpacing: 0.2 }}>{subtitle}</div>}
          </div>
        </div>
        {rightSlot && <div style={{ marginLeft: "auto" }}>{rightSlot}</div>}
      </div>
    </div>
  );
};

export default ModuleHero;
