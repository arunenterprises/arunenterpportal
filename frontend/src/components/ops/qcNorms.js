const T = (test, min, max, unit) => ({ test, min, max, unit });

export const QC_TESTS = {
  Cement: [T("Initial Setting Time", 30, null, "min"), T("Final Setting Time", null, 600, "min"), T("Fineness (Blaine)", 225, null, "m²/kg"),
    T("Soundness – Le Chatelier", null, 10, "mm"), T("Soundness – Autoclave", null, 0.8, "%"),
    T("Compressive 3 day – OPC 43", 23, null, "N/mm²"), T("Compressive 7 day – OPC 43", 33, null, "N/mm²"), T("Compressive 28 day – OPC 43", 43, null, "N/mm²"),
    T("Compressive 3 day – OPC 53", 27, null, "N/mm²"), T("Compressive 7 day – OPC 53", 37, null, "N/mm²"), T("Compressive 28 day – OPC 53", 53, null, "N/mm²")],
  Sand: [T("Passing 75 µ – Natural sand", null, 3, "%"), T("Passing 75 µ – Crushed sand", null, 15, "%"), T("Fineness Modulus", 2.3, 3.1, "")],
  Aggregate: [T("Aggregate Impact Value – Wearing", null, 30, "%"), T("Aggregate Impact Value – Other", null, 45, "%"),
    T("Aggregate Crushing Value – Wearing", null, 30, "%"), T("Aggregate Crushing Value – Other", null, 45, "%"),
    T("Los Angeles Abrasion – Wearing", null, 30, "%"), T("Los Angeles Abrasion – Other", null, 50, "%"),
    T("Flakiness + Elongation (combined)", null, 40, "%"), T("Water Absorption", null, 2, "%")],
  "Concrete Cube": [T("Slump – PCC / lightly reinforced", 25, 75, "mm"), T("Slump – RCC", 50, 100, "mm"), T("Slump – Heavily reinforced / pumped", 75, 100, "mm"),
    T("Cube 28 day individual – M20", 16, null, "N/mm²"), T("Cube 28 day individual – M25", 21, null, "N/mm²"), T("Cube 28 day individual – M30", 26, null, "N/mm²"),
    T("Cube 28 day mean of 4 – M20", 24, null, "N/mm²"), T("Cube 28 day mean of 4 – M25", 29, null, "N/mm²"), T("Cube 28 day mean of 4 – M30", 34, null, "N/mm²")],
  "Steel / TMT": [T("Yield Strength – Fe 415", 415, null, "N/mm²"), T("UTS – Fe 415", 485, null, "N/mm²"), T("Elongation – Fe 415", 14.5, null, "%"),
    T("Yield Strength – Fe 500", 500, null, "N/mm²"), T("UTS – Fe 500", 545, null, "N/mm²"), T("Elongation – Fe 500", 12, null, "%"),
    T("Yield Strength – Fe 500D", 500, null, "N/mm²"), T("UTS – Fe 500D", 565, null, "N/mm²"), T("Elongation – Fe 500D", 16, null, "%")],
  Brick: [T("Compressive Strength", 3.5, null, "N/mm²"), T("Water Absorption", null, 20, "%")],
  Soil: [T("Field Dry Density – Embankment (% MDD)", 95, null, "%"), T("Field Dry Density – Subgrade (% MDD)", 97, null, "%")],
};

const spec = (t) => (t.min != null && t.max != null ? `${t.min} – ${t.max} ${t.unit}` : t.min != null ? `≥ ${t.min} ${t.unit}` : `≤ ${t.max} ${t.unit}`).trim();

export const qcCalc = (r) => {
  const t = (QC_TESTS[r.material] || []).find((x) => x.test === r.testName);
  if (!t) return {};
  const out = { specified: spec(t) };
  const o = parseFloat(String(r.observed ?? "").replace(/[^\d.-]/g, ""));
  if (!Number.isNaN(o) && r.result !== "Retest") out.result = (t.min == null || o >= t.min) && (t.max == null || o <= t.max) ? "Pass" : "Fail";
  return out;
};
