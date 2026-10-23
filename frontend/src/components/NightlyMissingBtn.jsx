import React, { useState } from "react";
import { toast } from "sonner";
import { X, Search, RotateCcw } from "lucide-react";
import { apiNightlyMissing, apiNightlyRestoreMissing } from "../lib/api";

const LBL = { bills: "Bill", boqs: "BOQ", work_orders: "Work Order", payments: "Payment Voucher", paybills: "Pay Bill", advance_requests: "Advance", vendors: "Vendor", employees: "Employee", expenses: "Expense", fooding: "Fooding", loans: "Loan" };
const sm = (bg, c = "#fff") => ({ padding: "3px 10px", fontSize: 10, background: bg, color: c, border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, marginRight: 4, display: "inline-flex", alignItems: "center", gap: 3 });

export const NightlyMissingBtn = ({ id }) => {
  const [items, setItems] = useState(null);
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const check = async () => {
    try { const r = await apiNightlyMissing(id); setItems(r.items); setSel(Object.fromEntries(r.items.map((i) => [i.id, true]))); if (!r.count) toast.success("Koi record gayab nahi · sab surakshit hai"); }
    catch (e) { toast.error(e.message); }
  };
  const restore = async () => {
    const ids = Object.keys(sel).filter((k) => sel[k]);
    if (!ids.length || !window.confirm(`${ids.length} record wapas laayein? Maujooda data nahi badlega.`)) return;
    setBusy(true);
    try { const r = await apiNightlyRestoreMissing(id, ids); toast.success(`${r.total} record wapas aa gaye`); await check(); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <>
      <button data-testid={`nightly-missing-${id}`} onClick={check} style={sm("#0f766e")}><Search size={10} /> Missing Check</button>
      {items && items.length > 0 && (
        <div data-testid="nightly-missing-modal" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 14 }}>
          <div style={{ background: "#fff", borderRadius: 10, width: "min(900px,100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden", textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #e2e8f0" }}>
              <b style={{ flex: 1, fontSize: 14 }}>Backup mein hai, abhi gayab · {items.length} record</b>
              <button data-testid="nightly-restore-btn" disabled={busy} onClick={restore} style={{ ...sm("#15803d"), padding: "7px 14px", fontSize: 12 }}><RotateCcw size={13} /> {busy ? "Restoring…" : "Selected wapas laayein"}</button>
              <button data-testid="nightly-missing-close" onClick={() => setItems(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ background: "#f1f5f9" }}>{["", "Type", "Ref No", "Name", "Amount"].map((h) => <th key={h} style={{ padding: 6, textAlign: "left" }}>{h}</th>)}</tr></thead>
                <tbody>{items.map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 6 }}><input type="checkbox" data-testid={`nightly-missing-chk-${i.id}`} checked={!!sel[i.id]} onChange={(e) => setSel((p) => ({ ...p, [i.id]: e.target.checked }))} /></td>
                    <td style={{ padding: 6, fontWeight: 700 }}>{LBL[i.collection] || i.collection}</td>
                    <td style={{ padding: 6, fontFamily: "monospace" }}>{i.ref || i.id}</td>
                    <td style={{ padding: 6 }}>{String(i.name).slice(0, 60)}</td>
                    <td style={{ padding: 6 }}>{i.amount}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
