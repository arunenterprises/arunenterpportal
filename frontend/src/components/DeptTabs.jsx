import React from "react";

// Shared department tab bar (Finance Management style): one row, equal width, active tab filled
export const DeptTabs = ({ tabs, active, onSelect, tone = "#065f46", testid, idPrefix, style }) => (
  <div data-testid={testid} style={{ display: "flex", gap: 4, margin: "10px 0 12px", padding: 4, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, flexWrap: "nowrap", ...style }}>
    {tabs.map((t) => {
      const Icon = t.icon; const on = active === t.id; const c = t.tone || tone;
      const tid = /\s/.test(String(t.id)) ? String(t.id).replace(/\s+/g, "-").toLowerCase() : t.id;
      return (
        <button key={t.id} data-testid={`${idPrefix}-${tid}`} onClick={() => onSelect(t.id, t)} title={t.label}
          style={{ flex: "1 1 0", minWidth: 0, minHeight: 54, padding: "7px 4px", background: on ? c : "#fff", color: on ? "#fff" : "#334155", border: `1px solid ${on ? c : "#e2e8f0"}`, borderRadius: 6, cursor: "pointer",
            fontWeight: 700, fontSize: 12.5, lineHeight: 1.2, letterSpacing: .1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, transition: "background-color .15s, color .15s" }}>
          {Icon && <Icon size={15} />} <span>{t.label}</span>
        </button>
      );
    })}
  </div>
);

export default DeptTabs;
