import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { searchHsn } from "../lib/hsnData";

// HSN / SAC search input: type code or item name, pick from list. onPick(code, {type, desc, gst}).
export const HsnInput = ({ value, onChange, onPick, disabled, testid, style }) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const show = () => {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 2, left: Math.min(r.left, window.innerWidth - 380) });
    setOpen(true);
  };
  const results = open ? searchHsn(value) : [];
  return (
    <div style={{ position: "relative", ...(style || {}) }}>
      <input ref={ref} data-testid={testid} value={value || ""} disabled={disabled} readOnly={disabled} placeholder="HSN/SAC or item…"
        onFocus={show} onBlur={() => setTimeout(() => setOpen(false), 180)}
        onChange={(e) => { onChange(e.target.value); show(); }}
        style={{ width: "100%", padding: "5px 22px 5px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", textAlign: "left" }} />
      <Search size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
      {open && results.length > 0 && createPortal(
        <div data-testid={`${testid}-list`} style={{ position: "fixed", top: pos.top, left: pos.left, width: 370, maxHeight: 280, overflowY: "auto", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, boxShadow: "0 10px 24px rgba(15,23,42,.18)", zIndex: 9999 }}>
          {results.map(([code, type, desc, gst]) => (
            <button key={code} type="button" data-testid={`hsn-opt-${code}`} onMouseDown={(e) => { e.preventDefault(); onPick(code, { type, desc, gst }); setOpen(false); }}
              style={{ display: "flex", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderBottom: "1px solid #f1f5f9", background: "#fff", cursor: "pointer", fontSize: 11.5 }}>
              <b style={{ minWidth: 60, fontFamily: "monospace", color: type === "SAC" ? "#7c3aed" : "#0369a1" }}>{code}</b>
              <span style={{ flex: 1, color: "#0f172a" }}>{desc}</span>
              <span style={{ color: "#64748b", whiteSpace: "nowrap" }}>{type} · {gst}%</span>
            </button>
          ))}
          <div style={{ padding: "5px 10px", fontSize: 10, color: "#94a3b8" }}>GST % indicative — bill se pehle verify karein</div>
        </div>, document.body)}
    </div>
  );
};

export default HsnInput;
