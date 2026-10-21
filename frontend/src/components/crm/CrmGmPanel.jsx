import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Handshake, ArrowRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { loadCrmCache, crmCache, crmCacheReady, crmSave, inr, num, nameOf, RA_STEPS } from "./crmShared";
import { retentionSummary } from "./Retention";
import { canDelete as crmPower } from "../../lib/store";

// GM Dashboard section for Client & Revenue Management.
const stepCount = (a) => ({ pending: a.filter((x) => Number(x.step) === 2).length, approved: a.filter((x) => Number(x.step) >= 3).length, total: a.length });
export const crmGmCounts = (d) => ({
  leads: { pending: d.leads.filter((l) => !["Won", "Lost"].includes(l.status)).length, approved: d.leads.filter((l) => l.status === "Won").length, total: d.leads.length },
  clients: stepCount(d.clients),
  mb: stepCount(d.mb),
  ra: stepCount(d.ra_bills),
  co: stepCount(d.change_orders),
});

const daysSince = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : 0);
export const overdueRA = (d) => d.ra_bills.filter((b) => Number(b.step) === 4 && daysSince(b.sentAt || b.billDate) > 30);

const btn = (bg) => ({ padding: "3px 9px", fontSize: 11, background: bg, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, marginRight: 4 });

export const CrmGmPanel = ({ index = 7 }) => {
  const nav = useNavigate();
  const [d, setD] = useState(() => (crmCacheReady() ? { ...crmCache } : null));
  const [busy, setBusy] = useState("");
  const reload = () => loadCrmCache().then((c) => setD({ ...c })).catch(() => {});
  useEffect(() => { reload(); }, []);
  if (!d) return null;
  const power = crmPower();
  const act = async (name, rec, step, label) => {
    if (step === 1 && !window.confirm(`${label} reject karke Draft mein wapas bhejna hai?`)) return;
    setBusy(rec.id);
    try {
      await crmSave(name, { ...rec, step, ...(step === 1 ? { rejectedAt: new Date().toISOString() } : {}) });
      toast.success(`${label} ${step === 3 ? "approved" : "rejected"}`);
      await reload();
    } catch (e) { toast.error(e.message); }
    setBusy("");
  };
  const month = new Date().toISOString().slice(0, 7);
  const approved = d.ra_bills.filter((b) => Number(b.step) >= 3);
  const overdue = overdueRA(d);
  const kpis = [
    ["Open Leads", d.leads.filter((l) => !["Won", "Lost"].includes(l.status)).length],
    ["Is Mahine ki Billing", inr(approved.filter((b) => String(b.billDate).startsWith(month)).reduce((s, b) => s + num(b.net), 0))],
    ["Baki Receivable", inr(d.ra_bills.filter((b) => [3, 4].includes(Number(b.step))).reduce((s, b) => s + num(b.net), 0))],
    ["Retention Held", inr(retentionSummary(d).reduce((s, r) => s + r.balance, 0))],
    ["TDS Kata", inr(approved.reduce((s, b) => s + num(b.tdsAmt), 0))],
    ["GST Payable", inr(approved.reduce((s, b) => s + num(b.gstTotal), 0))],
  ];
  const pend = [
    ...d.clients.filter((c) => Number(c.step) === 2).map((c) => ({ cells: ["Client Registration", c.tempRefId || c.clientCode, c.name, "—"] })),
    ...d.mb.filter((m) => Number(m.step) === 2).map((m) => ({ cells: ["Measurement Book", m.mbNo, m.itemDesc, `${m.qty} ${m.unit || ""}`], name: "mb", rec: m, label: m.mbNo })),
    ...d.ra_bills.filter((b) => Number(b.step) === 2).map((b) => ({ cells: ["RA / Milestone Bill", b.raNo, nameOf(d.clients, b.clientId), inr(b.net)], name: "ra_bills", rec: b, label: b.raNo })),
    ...d.change_orders.filter((c) => Number(c.step) === 2).map((c) => ({ cells: ["Change Order", c.coNo, c.description, inr(c.value)] })),
  ];
  return (
    <div data-testid="gm-crm-panel" style={{ marginTop: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: "#1e3a8a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, boxShadow: "0 2px 6px #1e3a8a55" }}>{index}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", letterSpacing: .5, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}><Handshake size={14} /> Client &amp; Revenue Management</div>
        {overdue.length > 0 && <span data-testid="gm-crm-overdue-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", background: "#dc2626", color: "#fff", borderRadius: 999, fontSize: 10.5, fontWeight: 800 }}><AlertTriangle size={11} /> {overdue.length} payment 30+ din late</span>}
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
        {overdue.length > 0 && (
          <div data-testid="gm-crm-overdue" style={{ margin: "0 12px 12px", border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#b91c1c", marginBottom: 4 }}>Receivable Alert · Client payment 30+ din se baaki</div>
            {overdue.map((b) => (
              <div key={b.id} data-testid={`gm-crm-overdue-${b.id}`} style={{ fontSize: 12, color: "#7f1d1d", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <b>{b.raNo}</b><span>{nameOf(d.clients, b.clientId)}</span><span>{inr(b.net)}</span><span>{daysSince(b.sentAt || b.billDate)} din</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: "0 12px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#1e3a8a", marginBottom: 6 }}>Pending Approval ({pend.length}) · SuperAdmin / Admin</div>
          <div style={{ overflowX: "auto" }}>
            <table data-testid="gm-crm-pending" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "#f1f5f9" }}>{["Type", "No", "Details", "Amount / Qty", "Action"].map((h) => <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}</tr></thead>
              <tbody>
                {pend.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {r.cells.map((c, j) => <td key={j} style={{ padding: "6px 8px" }}>{c}</td>)}
                    <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
                      {r.rec && power && <>
                        <button data-testid={`gm-crm-approve-${i}`} disabled={busy === r.rec.id} onClick={() => act(r.name, r.rec, 3, r.label)} style={btn("#16a34a")}><CheckCircle2 size={12} /> Approve</button>
                        <button data-testid={`gm-crm-reject-${i}`} disabled={busy === r.rec.id} onClick={() => act(r.name, r.rec, 1, r.label)} style={btn("#f59e0b")}><XCircle size={12} /> Reject</button>
                      </>}
                      <button data-testid={`gm-crm-go-${i}`} onClick={() => nav("/client-revenue")} style={btn("#1e3a8a")}>Review</button>
                    </td>
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
