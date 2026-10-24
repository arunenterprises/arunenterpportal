import React, { useEffect, useState } from "react";
import { ArrowUpToLine, ArrowDownToLine, Minus } from "lucide-react";

const KEY = "strip_pos_v1";
const MODES = [["bottom", "Neeche chipki", ArrowDownToLine], ["top", "Upar chipki", ArrowUpToLine], ["normal", "Normal", Minus]];

// Keeps every module's action-button strip visible (pinned bottom / top) so users never scroll past the data sheet to reach buttons.
export const ActionStripToggle = () => {
  const [mode, setMode] = useState(() => localStorage.getItem(KEY) || "bottom");
  const [has, setHas] = useState(false);
  useEffect(() => { document.body.dataset.strip = mode; localStorage.setItem(KEY, mode); }, [mode]);
  useEffect(() => {
    const check = () => setHas(!!document.querySelector('[data-testid$="-action-row"], [data-testid="pv-bottom-actions"]'));
    check();
    const t = setInterval(check, 1500);
    return () => clearInterval(t);
  }, []);
  if (!has) return null;
  return (
    <div className="bd-ui" data-testid="strip-toggle" style={{ position: "fixed", right: 10, top: 56, zIndex: 9990, display: "flex", gap: 2, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 999, padding: 2, boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
      {MODES.map(([m, l, Icon]) => (
        <button key={m} className="bd-ui" data-testid={`strip-mode-${m}`} title={l} onClick={() => setMode(m)}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", fontSize: 10, fontWeight: 700, border: "none", borderRadius: 999, cursor: "pointer", background: mode === m ? "#0f766e" : "transparent", color: mode === m ? "#fff" : "#334155" }}>
          <Icon size={11} /> {l}
        </button>
      ))}
    </div>
  );
};

export default ActionStripToggle;
