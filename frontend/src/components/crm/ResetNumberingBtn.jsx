import React from "react";
import { RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiResetNumbering, apiRenumber, apiRealignCounter, apiListCounters } from "../../lib/api";
import { isSuperAdmin, currentUserEmail, getCounters, saveCounters } from "../../lib/store";

const realign = async (key, label) => {
  const p = await apiRealignCounter(key, true);
  if (!window.confirm(`${label} counter: abhi ${p.current} → naya ${p.value} (sabse aakhri use hua number, ${p.records} records dekhe).\nKoi record nahi badlega. Agla naya number ${p.value + 1} hoga.\n\nRe-Align karein?`)) return null;
  const r = await apiRealignCounter(key);
  saveCounters({ ...getCounters(), [key]: r.value });
  toast.success(`${label} counter = ${r.value} · agla number ${r.value + 1}`);
  return r;
};

export const RealignCounterBtn = ({ series, label }) => {
  if (!isSuperAdmin(currentUserEmail())) return null;
  return (
    <button data-testid={`realign-${series}`} onClick={() => realign(series, label).catch((e) => toast.error(e.message))} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#7c2d12", color: "#fff", border: 0, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 10 }}>
      <Wrench size={12} /> Reset & Re-Align Counter
    </button>
  );
};

export const CounterRealignPanel = () => {
  const [rows, setRows] = React.useState([]);
  const load = () => apiListCounters().then(setRows).catch(() => setRows([]));
  React.useEffect(() => { load(); }, []);
  return (
    <div data-testid="counter-panel" style={{ background: "#fff", border: "1.5px solid #7c2d12", borderRadius: 10, padding: 14, margin: "14px 0" }}>
      <div style={{ fontWeight: 900, color: "#7c2d12", marginBottom: 4 }}>Number Counters · Reset & Re-Align (SuperAdmin)</div>
      <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 8 }}>Re-Align = counter ko sabse aakhri use hue number par set karna (records nahi badalte). MB / RA Bill ke liye unke register ka "Re-Align & Repair Numbers", Tax Invoice / Abstract ke liye "Clear All & Reset Counter" button hai.</div>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead><tr>{["Series", "Current Counter", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: 6, background: "#fff7ed", border: "1px solid #fed7aa" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key}><td style={{ padding: 6, border: "1px solid #fde2c8", fontWeight: 700 }}>{r.label}</td>
            <td data-testid={`counter-val-${r.key}`} style={{ padding: 6, border: "1px solid #fde2c8" }}>{r.value}</td>
            <td style={{ padding: 6, border: "1px solid #fde2c8" }}><button data-testid={`counter-realign-${r.key}`} onClick={() => realign(r.key, r.label).then(load).catch((e) => toast.error(e.message))} style={{ background: "#7c2d12", color: "#fff", border: 0, borderRadius: 5, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Re-Align</button></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
};

export const RenumberBtn = ({ target, label }) => {
  if (!isSuperAdmin(currentUserEmail())) return null;
  const run = async () => {
    const t = window.prompt(`${label} ke SAARE records ko tareekh ke kram se naye Temp / Permanent number milenge (purane number badal jayenge) aur counter theek hoga.\nPakka karne ke liye REPAIR likhein:`);
    if (t !== "REPAIR") return;
    try {
      const r = await apiRenumber(target);
      toast.success(`${r.renumbered} records ko naye number mile`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <button data-testid={`renumber-${target}`} onClick={run} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#7c2d12", color: "#fff", border: 0, borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
      <Wrench size={12} /> Re-Align & Repair Numbers
    </button>
  );
};

export const ResetNumberingBtn = ({ target, label }) => {
  if (!isSuperAdmin(currentUserEmail())) return null;
  const run = async () => {
    const t = window.prompt(`${label} ka SARA data hat jayega aur number counter shuru se reset hoga.\nPakka karne ke liye RESET likhein:`);
    if (t !== "RESET") return;
    try {
      const r = await apiResetNumbering(target);
      toast.success(`${r.deleted} record hataye, counter reset`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <button data-testid={`reset-numbering-${target}`} onClick={run} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#b91c1c", color: "#fff", border: 0, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 10 }}>
      <RotateCcw size={12} /> Clear All & Reset Counter
    </button>
  );
};
