import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, ArrowRight } from "lucide-react";
import { loadCrmCache, inr, num, nameOf, RA_STEPS } from "./crmShared";
import { retentionSummary } from "./Retention";

// GM Dashboard section for Client & Revenue Management.
const stepCount = (a) => ({ pending: a.filter((x) => Number(x.step) === 2).length, approved: a.filter((x) => Number(x.step) >= 3).length, total: a.length });
export const crmGmCounts = (d) => ({
  leads: { pending: d.leads.filter((l) => !["Won", "Lost"].includes(l.status)).length, approved: d.leads.filter((l) => l.status === "Won").length, total: d.leads.length },
  clients: stepCount(d.clients),
  mb: stepCount(d.mb),
  ra: stepCount(d.ra_bills),
  co: stepCount(d.change_orders),
});

export const CrmGmPanel = ({ index = 7 }) => {
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
    <div data-testid="gm-crm-panel" style={{ marginTop: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#1e3a8a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, boxShadow: "0 2px 6px #1e3a8a55" }}>{index}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", letterSpacing: .5, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}><Handshake size={14} /> Client &amp; Revenue Management</div>
        <div style={{ flex: 1, height: 1, background: "linear-gradient(to right, #e2e8f0, transparent)" }} />
      </div>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.05)" }}>
      <div data-testid="gm-crm-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", background: "#1e3a8a", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, letterSpacing: .5, textTransform: "uppercase" }}>
          <Handshake size={15} /> Client &amp; Revenue pending
          <span style={{ marginLeft: 4, padding: "1px 8px", background: "rgba(255,255,255,.22)", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{pend.length}</span>
        </div>
        <button data-testid="gm-crm-open" onClick={() => nav("/client-revenue")} style={{ padding: "5px 12px", background: "rgba(255,255,255,.22)", color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 20, cursor: "pointer", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>Open module <ArrowRight size={11} /></button>
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
    </div>
  );
};

export default CrmGmPanel;
