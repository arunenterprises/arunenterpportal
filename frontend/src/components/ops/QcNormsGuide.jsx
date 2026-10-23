import React, { useState } from "react";
import { BookOpenCheck, X, ChevronLeft, ChevronRight } from "lucide-react";

const NORMS = [
  { m: "Cement (OPC 43 / 53)", code: "IS 269:2015 · IS 4031", rows: [
    ["Initial Setting Time", "≥ 30 min"], ["Final Setting Time", "≤ 600 min"], ["Fineness (Blaine)", "≥ 225 m²/kg"],
    ["Soundness – Le Chatelier", "≤ 10 mm"], ["Soundness – Autoclave", "≤ 0.8 %"],
    ["Compressive 3 day", "OPC 43: ≥ 23 · OPC 53: ≥ 27 N/mm²"], ["Compressive 7 day", "OPC 43: ≥ 33 · OPC 53: ≥ 37 N/mm²"], ["Compressive 28 day", "OPC 43: ≥ 43 · OPC 53: ≥ 53 N/mm²"]] },
  { m: "Fine Aggregate (Sand)", code: "IS 383:2016 · IS 2386", rows: [
    ["Passing 75 µ – Natural sand", "≤ 3 %"], ["Passing 75 µ – Crushed sand", "≤ 15 %"], ["Grading Zone", "Zone I – IV (Zone II preferred for RCC)"], ["Fineness Modulus (typical)", "2.3 – 3.1"]] },
  { m: "Coarse Aggregate", code: "IS 383:2016 · IS 2386", rows: [
    ["Aggregate Impact Value", "≤ 30 % (wearing) · ≤ 45 % (other)"], ["Aggregate Crushing Value", "≤ 30 % (wearing) · ≤ 45 % (other)"],
    ["Los Angeles Abrasion", "≤ 30 % (wearing) · ≤ 50 % (other)"], ["Flakiness + Elongation (combined)", "≤ 40 %"], ["Water Absorption (typical)", "≤ 2 %"]] },
  { m: "Concrete", code: "IS 456:2000 · IS 516 · IS 1199", rows: [
    ["Slump – PCC / lightly reinforced", "25 – 75 mm"], ["Slump – RCC beams, slabs, columns", "50 – 100 mm"], ["Slump – Heavily reinforced / pumped", "75 – 100 mm"],
    ["Cube 28 day – mean of 4 (M20+)", "≥ fck + 0.825·S or fck + 4 (jo zyada)"], ["Cube 28 day – individual (M20+)", "≥ fck − 4 N/mm²"],
    ["Cube 7 day (typical guide)", "≈ 65 – 70 % of fck"]] },
  { m: "Steel – TMT Bars", code: "IS 1786:2008", rows: [
    ["Fe 415 – Yield / UTS / Elong.", "≥ 415 · ≥ 485 (≥1.10×YS) · ≥ 14.5 %"], ["Fe 500 – Yield / UTS / Elong.", "≥ 500 · ≥ 545 (≥1.08×YS) · ≥ 12 %"],
    ["Fe 500D – Yield / UTS / Elong.", "≥ 500 · ≥ 565 (≥1.10×YS) · ≥ 16 %"], ["Bend & Rebend", "Koi crack nahi (Pass)"]] },
  { m: "Bricks (Burnt Clay)", code: "IS 1077 · IS 3495", rows: [
    ["Compressive Strength", "≥ 3.5 N/mm² (class ke hisab se)"], ["Water Absorption", "≤ 20 % (class 12.5 tak) · ≤ 15 % (higher class)"], ["Efflorescence", "Slight se zyada nahi"]] },
  { m: "Water for Construction", code: "IS 456:2000 cl. 5.4", rows: [
    ["pH", "≥ 6"], ["Chlorides", "≤ 2000 mg/l (PCC) · ≤ 500 mg/l (RCC)"], ["Sulphates (SO₃)", "≤ 400 mg/l"], ["Organic / Inorganic solids", "≤ 200 / ≤ 3000 mg/l"]] },
  { m: "Soil / Earthwork", code: "IS 2720 · MoRTH (typical spec)", rows: [
    ["Field Dry Density – Embankment", "≥ 95 % of MDD"], ["Field Dry Density – Subgrade", "≥ 97 % of MDD"]] },
];

const TOUR = [
  ["1. Project & Material chunein", "Form mein Project / Site aur Material likhein jiska test ho raha hai (jaise Cement, Sand, Cube)."],
  ["2. Sample ID & Lab", "Sample ID aur Lab ka naam bharein — taki report track ho sake."],
  ["3. Specified Value", "Is guide ke 'Norms' table se us test ki IS value dekh kar 'Specified Value' mein likhein."],
  ["4. Observed Value", "Lab mein jo result aaya woh 'Observed Value' mein bharein."],
  ["5. Result", "Observed value norm ke andar hai to Pass, bahar hai to Fail, dobara test chahiye to Retest chunein."],
  ["6. Save → Submit", "Save karke Submit karein. Approve / Reject sirf Approver karega."],
];

const td = { padding: "6px 8px", borderBottom: "1px solid #ede9fe", fontSize: 12 };

const Tour = () => {
  const [i, setI] = useState(0);
  return (
    <div data-testid="qc-tour" style={{ padding: 18 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>{TOUR.map((_, j) => <div key={j} style={{ flex: 1, height: 5, borderRadius: 3, background: j <= i ? "#7c3aed" : "#e9d5ff" }} />)}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#4c1d95" }}>{TOUR[i][0]}</div>
      <div style={{ fontSize: 13.5, color: "#334155", marginTop: 6, minHeight: 44 }}>{TOUR[i][1]}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <button data-testid="qc-tour-prev" disabled={!i} onClick={() => setI(i - 1)} style={nb(!i)}><ChevronLeft size={14} /> Pichhla</button>
        <button data-testid="qc-tour-next" disabled={i === TOUR.length - 1} onClick={() => setI(i + 1)} style={nb(i === TOUR.length - 1)}>Agla <ChevronRight size={14} /></button>
      </div>
    </div>
  );
};
const nb = (off) => ({ padding: "7px 14px", background: off ? "#cbd5e1" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: off ? "default" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 });

export const QcNormsGuide = () => {
  const [open, setOpen] = useState(null);
  const tb = (k) => ({ padding: "6px 12px", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer", background: open === k ? "#7c3aed" : "#f3e8ff", color: open === k ? "#fff" : "#6d28d9" });
  return (
    <>
      <button data-testid="qc-norms-btn" onClick={() => setOpen("norms")} style={{ padding: "8px 14px", background: "#fff", color: "#6d28d9", border: "1px dashed #7c3aed", borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><BookOpenCheck size={14} /> Norms & Default Values</button>
      {open && (
        <div data-testid="qc-guide-modal" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 14 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "min(980px,100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#faf5ff", borderBottom: "1px solid #e9d5ff" }}>
              <b style={{ flex: 1, fontSize: 14, color: "#4c1d95" }}>Lab Technician Guide · View only</b>
              <button data-testid="qc-guide-tab-norms" onClick={() => setOpen("norms")} style={tb("norms")}>Norms</button>
              <button data-testid="qc-guide-tab-tour" onClick={() => setOpen("tour")} style={tb("tour")}>Guided Tour</button>
              <button data-testid="qc-guide-close" onClick={() => setOpen(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {open === "tour" ? <Tour /> : (
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gridAutoRows: "max-content", alignItems: "start", gap: 12 }}>
                {NORMS.map((g) => (
                  <div key={g.m} data-testid={`qc-norm-${g.m.split(" ")[0].toLowerCase()}`} style={{ border: "1px solid #e9d5ff", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "7px 10px", background: "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 12.5 }}>{g.m} <span style={{ fontWeight: 600, opacity: 0.85, fontSize: 11 }}>· {g.code}</span></div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>{g.rows.map(([a, b]) => <tr key={a}><td style={{ ...td, fontWeight: 700, width: "48%" }}>{a}</td><td style={td}>{b}</td></tr>)}</tbody></table>
                  </div>
                ))}
                <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#64748b" }}>Yeh values sirf reference ke liye hain. Project specification / client tender ya latest IS amendment alag ho to wahi final maana jayega.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
