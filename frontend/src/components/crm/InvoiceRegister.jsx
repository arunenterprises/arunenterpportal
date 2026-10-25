import React, { useState } from "react";
import { Card, Grid, Field, Inp, Sel, Table, Badge, Btn, stepTone, inr, num, nameOf, today } from "./crmShared";
import { INV_STEPS } from "./Invoices";
import { canDelete as canApprove, currentUserEmail } from "../../lib/store";

const daysSince = (s) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : 0);
const fmt = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

// Invoice Register: who got which invoice, its status, payment and full tracking trail.
export const InvoiceRegister = ({ data, save }) => {
  const [q, setQ] = useState({ client: "", status: "", text: "" });
  const [open, setOpen] = useState("");
  const power = canApprove();
  const gstOf = (b) => num(b.igst) + num(b.cgst) + num(b.sgst);
  const upd = (b, k, v) => {
    if (String(b[k] || "") === String(v || "")) return;
    const n = { ...b, [k]: v };
    const st = Number(b.step);
    let action = `${k} updated`;
    if (n.utr && [3, 4].includes(st)) { n.step = 5; n.receivedDate = n.receivedDate || today(); n.receivedAmount = num(n.receivedAmount) || num(n.total); action = "Paid (UTR)"; }
    else if (!n.utr && st === 5) { n.step = n.sentAt ? 4 : 3; action = "UTR removed"; }
    else if (n.sentAt && st === 3) { n.step = 4; action = "Sent to Client"; }
    n.gstStatus = n.gstReceivedDate ? "Received" : "Pending";
    n.history = [...(b.history || []), { action, at: new Date().toISOString(), by: currentUserEmail() }];
    save("invoices", n, `${b.invoiceNo || b.refNo} update hua`);
  };
  const cell = (b, k, type = "text", w = 120) => (power && [3, 4, 5].includes(Number(b.step))
    ? <Inp key={`${b.id}-${k}-${b[k] || ""}`} data-testid={`invreg-${k}-${b.id}`} type={type} defaultValue={b[k] || ""} onBlur={(e) => upd(b, k, e.target.value.trim())} style={{ width: w, padding: "3px 6px", fontSize: 11.5 }} />
    : b[k] || "—");
  const rows = data.invoices.filter((b) => (!q.client || b.clientId === q.client) && (!q.status || String(b.step) === q.status)
    && (!q.text || `${b.refNo} ${b.invoiceNo} ${b.poNo} ${b.projectName}`.toLowerCase().includes(q.text.toLowerCase())));
  const live = data.invoices.filter((b) => Number(b.step) !== 6);
  const unpaid = data.invoices.filter((b) => [3, 4].includes(Number(b.step)));
  const sum = (a, k) => a.reduce((s, b) => s + num(b[k]), 0);
  return (
    <>
      <div data-testid="invreg-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 14 }}>
        {[["Total Invoices", `${live.length}${data.invoices.length - live.length ? ` (+${data.invoices.length - live.length} cancelled)` : ""}`], ["Total Value", inr(sum(live, "total"))], ["Unpaid (Approved / Sent)", `${unpaid.length} · ${inr(sum(unpaid, "total"))}`], ["Received", inr(sum(data.invoices.filter((b) => Number(b.step) === 5), "receivedAmount"))]].map(([l, v], i) => (
          <div key={l} data-testid={`invreg-kpi-${i}`} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#475569", textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{v}</div>
          </div>
        ))}
      </div>
      <Card testid="invreg-card" title={`Invoice Register (${rows.length})`}>
        <Grid cols={3}>
          <Field label="Client"><Sel data-testid="invreg-client" value={q.client} onChange={(e) => setQ({ ...q, client: e.target.value })} options={[{ v: "", l: "All clients" }, ...data.clients.map((c) => ({ v: c.id, l: c.name }))]} /></Field>
          <Field label="Status"><Sel data-testid="invreg-status" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })} options={[{ v: "", l: "All status" }, ...Object.entries(INV_STEPS).map(([v, l]) => ({ v, l }))]} /></Field>
          <Field label="Search (Ref / Invoice / PO / Project)"><Inp data-testid="invreg-search" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} /></Field>
        </Grid>
        <div style={{ marginTop: 12 }}>
          <Table testid="invreg-table" empty="Koi invoice nahi" cols={["Ref No", "Invoice No", "Date", "Given To (Client)", "PO No", "Total", "Sent On", "Paid On", "Client UTR", "Bill Status", "GST Amount", "GST Received Date", "GST Status", "Outstanding Days", ""]}
            rows={rows.slice().reverse().map((b) => [b.refNo || "—", b.invoiceNo || "—", b.invoiceDate, nameOf(data.clients, b.clientId), b.poNo || "—", inr(b.total),
              cell(b, "sentAt", "date"), cell(b, "receivedDate", "date"), cell(b, "utr", "text", 130),
              <Badge text={INV_STEPS[b.step]} tone={stepTone(b.step)} />,
              <b data-testid={`invreg-gst-${b.id}`}>{inr(gstOf(b))}</b>, cell(b, "gstReceivedDate", "date"),
              Number(b.step) === 6 ? "—" : <Badge text={b.gstReceivedDate ? "GST Received" : "GST Pending"} tone={b.gstReceivedDate ? "green" : "amber"} />,
              [3, 4].includes(Number(b.step)) ? <span style={{ color: daysSince(b.sentAt || b.invoiceDate) > 30 ? "#dc2626" : "#334155", fontWeight: 700 }}>{daysSince(b.sentAt || b.invoiceDate)}</span> : "—",
              <Btn tone="ghost" data-testid={`invreg-track-${b.id}`} onClick={() => setOpen(open === b.id ? "" : b.id)}>{open === b.id ? "Hide" : "Tracking"}</Btn>])} />
        </div>
        {open && (() => {
          const b = data.invoices.find((x) => x.id === open) || {};
          return (
            <div data-testid="invreg-timeline" style={{ marginTop: 12, border: "1px solid #dbeafe", background: "#f8fafc", borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Tracking · {b.invoiceNo || b.refNo}</div>
              {(b.history || []).length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>No history</div>}
              {(b.history || []).map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, padding: "4px 0", borderLeft: "3px solid #1e3a8a", paddingLeft: 10, marginBottom: 4 }}>
                  <b style={{ minWidth: 110 }}>{h.action}</b><span>{fmt(h.at)}</span><span style={{ color: "#475569" }}>by {h.by || "—"}</span>
                </div>
              ))}
              {b.approvedByName && <div style={{ fontSize: 12, color: "#166534", marginTop: 6 }}>Approved by {b.approvedByName} · {fmt(b.approvedAt)}</div>}
              {Number(b.step) === 6 && <div data-testid="invreg-cancel-reason" style={{ fontSize: 12, color: "#b91c1c", marginTop: 6, fontWeight: 700 }}>Cancelled on {b.cancelledAt} by {b.cancelledBy || "—"} · Reason: {b.cancelReason}</div>}
            </div>
          );
        })()}
      </Card>
    </>
  );
};

export default InvoiceRegister;
