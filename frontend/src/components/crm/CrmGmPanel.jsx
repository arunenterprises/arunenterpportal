import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, ArrowRight } from "lucide-react";
import { loadCrmCache, inr, num, nameOf, RA_STEPS } from "./crmShared";
import { retentionSummary } from "./Retention";

// GM Dashboard section for Client & Revenue Management.
export const CrmGmPanel = () => {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => { loadCrmCache().then((c) => setD({ ...c })).catch(() => setD(null)); }, []);
  if (!d) return null;
  const month = new Date().toISOString().slice(0, 7);
  const approved = d.ra_bills.filter((b) => Number(b.step) >= 3);
  const kpis = [
    ["Open Leads", d.leads.filter((l) => !["Won", "Lost"].includes(l.status)).length],
    ["Is Mahine ki Billing", inr(approved.filter((b) => String(b.billDate).startsWith(month)).reduce((s, b) => s + num(b.net), 0))],
    ["Baki Receivable", inr(d.ra_bills.filter((b) => [3, 4].includes(Number(b.step))).reduce((s, b) => s + num(b.net), 0))],
    ["Retention Held", inr(retentionSummary(d).reduce((s, r) => s + r.balance, 0))],
    ["TDS Kata", inr(approved.reduce((s, b) => s + num(b.tdsAmt), 0))],
    ["GST Payable", inr(approved.reduce((s, b) => s + num(b.gstTotal), 0))],
  ];
  const pend = [
    ...d.clients.filter((c) => Number(c.step) === 2).map((c) => ["Client Registration", c.tempRefId || c.clientCode, c.name, "—"]),
    ...d.mb.filter((m) => Number(m.step) === 2).map((m) => ["Measurement Book", m.mbNo, m.itemDesc, `${m.qty} ${m.unit || ""}`]),
    ...d.ra_bills.filter((b) => Number(b.step) === 2).map((b) => ["RA / Milestone Bill", b.raNo, nameOf(d.clients, b.clientId), inr(b.net)]),
    ...d.change_orders.filter((c) => Number(c.step) === 2).map((c) => ["Change Order", c.coNo, c.description, inr(c.value)]),
  ];
  return (
    <div data-testid="gm-crm-panel" style={{ marginTop: 16, background: "#fff", border: "1px solid #dbeafe", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "linear-gradient(135deg,#0b1f4d 0%,#1e3a8a 55%,#0891b2 100%)", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, fontSize: 14, letterSpacing: .4 }}><Handshake size={18} /> CLIENT &amp; REVENUE MANAGEMENT</div>
        <button data-testid="gm-crm-open" onClick={() => nav("/client-revenue")} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#1e3a8a", border: "none", borderRadius: 6, padding: "6px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>Open <ArrowRight size={13} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, padding: 12 }}>
        {kpis.map(([l, v], i) => (
          <div key={l} data-testid={`gm-crm-kpi-${i}`} style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", marginBottom: 6 }}>Pending Approval ({pend.length}) · SuperAdmin / Admin</div>
        <div style={{ overflowX: "auto" }}>
          <table data-testid="gm-crm-pending" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ background: "#f1f5f9" }}>{["Type", "No", "Details", "Amount / Qty", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}</tr></thead>
            <tbody>
              {pend.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {r.map((c, j) => <td key={j} style={{ padding: "6px 8px" }}>{c}</td>)}
                  <td style={{ padding: "6px 8px" }}><button data-testid={`gm-crm-go-${i}`} onClick={() => nav("/client-revenue")} style={{ padding: "3px 10px", fontSize: 11, background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}>Review</button></td>
                </tr>
              ))}
              {pend.length === 0 && <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "#94a3b8" }}>Koi pending approval nahi · {RA_STEPS[5]} bills: {d.ra_bills.filter((b) => Number(b.step) === 5).length}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CrmGmPanel;
