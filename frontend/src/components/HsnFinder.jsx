import React, { useState } from "react";
import { Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { searchHsn } from "../lib/hsnData";

// Separate HSN / SAC search panel shown at the bottom of a tab. Click "Copy" and paste into the item's HSN/SAC box.
export const HsnFinder = () => {
  const [q, setQ] = useState("");
  const rows = q.trim() ? searchHsn(q, 15) : [];
  const copy = (code) => {
    try { navigator.clipboard.writeText(code); } catch { /* noop */ }
    toast.success(`${code} copied · item ke HSN/SAC box mein paste karein`);
  };
  return (
    <div className="section" data-testid="hsn-finder" style={{ marginTop: 14 }}>
      <div className="sec-head" style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /> HSN / SAC Code Search</div>
      <div className="sec-body">
        <input data-testid="hsn-finder-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code ya item ka naam likhein — e.g. cement, steel, 9954, painting"
          style={{ width: "100%", padding: "8px 10px", fontSize: 12.5, border: "1px solid #cbd5e1", borderRadius: 6, boxSizing: "border-box" }} />
        {q.trim() && (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table data-testid="hsn-finder-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "#f1f5f9" }}>{["Code", "Type", "Description", "GST %*", ""].map((h) => <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(([code, type, desc, gst]) => (
                  <tr key={code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 800, color: type === "SAC" ? "#7c3aed" : "#0369a1" }}>{code}</td>
                    <td style={{ padding: "5px 8px" }}>{type}</td>
                    <td style={{ padding: "5px 8px" }}>{desc}</td>
                    <td style={{ padding: "5px 8px" }}>{gst}%</td>
                    <td style={{ padding: "5px 8px" }}><button type="button" data-testid={`hsn-copy-${code}`} onClick={() => copy(code)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", fontSize: 11, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}><Copy size={11} /> Copy</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#94a3b8" }}>Koi code nahi mila</td></tr>}
              </tbody>
            </table>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>* GST % indicative (22-Sep-2025 rates) — bill se pehle verify karein</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HsnFinder;
