import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, FilePlus2, Save, Send, CheckCircle2, Printer } from "lucide-react";
import { apiOpsList, apiOpsSave, apiOpsDelete } from "../../lib/api";
import { getCompany } from "../../lib/store";
import { can } from "../../lib/acl";

const n = (v) => Number(v) || 0;
const f2 = (v) => n(v).toFixed(2);
const uid = () => `abs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const line = () => ({ k: uid(), poPos: "", desc: "", code: "", uom: "", hsn: "", poQty: "", rate: "", prevQty: "", curQty: "" });
const blank = () => ({ id: uid(), status: "Draft", clientId: "", toText: "", poNo: "", poDate: "", invoiceNo: "", invoiceDate: "", periodFrom: "", periodTo: "", location: "", lines: [line()] });
const calc = (l) => {
  const cumQty = n(l.prevQty) + n(l.curQty);
  return { prevAmt: n(l.prevQty) * n(l.rate), curAmt: n(l.curQty) * n(l.rate), cumQty, cumAmt: cumQty * n(l.rate), bal: n(l.poQty) - cumQty };
};
const inp = { width: "100%", padding: "6px 7px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" };
const btn = (bg, off) => ({ padding: "7px 12px", background: off ? "#94a3b8" : bg, color: "#fff", border: "none", borderRadius: 5, cursor: off ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 });
const th = { padding: "6px 4px", border: "1px solid #94a3b8", background: "#f1f5f9", fontSize: 10.5, textAlign: "center" };
const td = { padding: 3, border: "1px solid #cbd5e1", fontSize: 11.5 };
const dmy = (d) => (d ? d.split("-").reverse().join("-") : "");

const printAbstract = (f, co) => {
  const w = window.open("", "_blank"); if (!w) return;
  const rows = f.lines.map((l, i) => { const c = calc(l); return `<tr><td>${i + 1}</td><td>${l.poPos}</td><td class=l>${l.desc}</td><td>${l.code}</td><td>${l.uom}</td><td>${l.hsn}</td><td>${f2(l.poQty)}</td><td>${f2(l.rate)}</td><td>${f2(l.prevQty)}</td><td class=r>${f2(c.prevAmt)}</td><td>${f2(l.curQty)}</td><td class=r>${f2(c.curAmt)}</td><td>${f2(c.cumQty)}</td><td class=r>${f2(c.cumAmt)}</td><td>${f2(c.bal)}</td></tr>`; }).join("");
  const t = f.lines.reduce((s, l) => { const c = calc(l); return { p: s.p + c.prevAmt, c: s.c + c.curAmt, u: s.u + c.cumAmt }; }, { p: 0, c: 0, u: 0 });
  const H = (a, b) => `<tr><td class=hl>${a}</td><td class=hv colspan=3>${b}</td></tr>`;
  w.document.write(`<html><head><title>Abstract ${f.permNo || f.tempNo || ""}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Calibri,Arial;font-size:11px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:4px;text-align:center}.l{text-align:left}.r{text-align:right}.hl{text-align:left;font-weight:700;width:18%}.hv{text-align:left;font-weight:700}</style></head><body>
  <div style="text-align:right;font-weight:700">ANNEXURE - "A"</div>
  <table><tr><th colspan=5 style="font-size:13px">ABSTRACT (Summery of Item Schedules)</th></tr>
  <tr><td rowspan=7 class=l style="vertical-align:top;width:22%;font-weight:700;white-space:pre-line">To,\n${f.toText}</td><td class=hl>PURCHASE ORDER NO:-</td><td class=hv>${f.poNo}</td><td class=hl style="width:8%">DATED:-</td><td class=hv style="width:14%">${dmy(f.poDate)}</td></tr>
  <tr><td class=hl>INVOICE NO.:-</td><td class=hv>${f.invoiceNo}</td><td class=hl>DATED:-</td><td class=hv>${dmy(f.invoiceDate)}</td></tr>
  ${H("WORK PERIOD:", `${dmy(f.periodFrom)} To ${dmy(f.periodTo)}`)}${H("CONTRACTOR NAME:-", co.name || "")}${H("LOCATION", f.location)}${H("PAN NO.:-", co.pan || "")}${H("GSTIN :-", co.gst || "")}</table>
  <table><tr><th>Sr. No.</th><th>PO Position No.</th><th>Item Description</th><th>Item Code No.</th><th>UOM</th><th>HSN Code</th><th>PO Qty.</th><th>PO Rate</th><th>Previous Qty.</th><th>Previous Amount</th><th>Current Qty.</th><th>Current Amount</th><th>Cumulative Qty.</th><th>Cumulative Amount</th><th>Balance Quantity</th></tr>${rows}
  <tr><td></td><td></td><td class=l><b>TOTAL</b></td><td colspan=6></td><td class=r><b>${f2(t.p)}</b></td><td></td><td class=r><b>${f2(t.c)}</b></td><td></td><td class=r><b>${f2(t.u)}</b></td><td></td></tr></table></body></html>`);
  w.document.close(); w.print();
};

export const Abstract = ({ data }) => {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank);
  const [locked, setLocked] = useState(false);
  const co = getCompany();
  const load = () => apiOpsList("abstract").then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const approved = f.status === "Approved";
  const ro = locked || approved || !can("client", "c");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const pickClient = (id) => {
    const c = (data.clients || []).find((x) => x.id === id) || {};
    setF((p) => ({ ...p, clientId: id, toText: c.id ? `The Project Manager,\n${c.name || ""}${c.address ? `,\n${c.address}` : ""}` : p.toText }));
  };
  const prevFor = (l) => rows.filter((r) => r.id !== f.id && r.poNo && r.poNo === f.poNo && r.status !== "Rejected")
    .reduce((s, r) => s + (r.lines || []).filter((x) => String(x.poPos) === String(l.poPos) && x.code === l.code).reduce((a, x) => a + n(x.curQty), 0), 0);
  const setLine = (i, k, v) => setF((p) => {
    const lines = p.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l));
    if (["poPos", "code"].includes(k) && p.poNo) { const pq = prevFor(lines[i]); if (pq) lines[i].prevQty = pq; }
    return { ...p, lines };
  });
  const tot = useMemo(() => f.lines.reduce((s, l) => { const c = calc(l); return { p: s.p + c.prevAmt, c: s.c + c.curAmt, u: s.u + c.cumAmt }; }, { p: 0, c: 0, u: 0 }), [f.lines]);
  const save = async (patch = {}, msg = "Saved") => {
    if (!f.toText.trim() || !f.poNo.trim()) { toast.error("Client (To) aur Purchase Order No bharein"); return; }
    const over = f.lines.find((l) => n(l.poQty) && calc(l).bal < 0);
    if (over && !window.confirm(`PO Pos ${over.poPos}: Cumulative qty PO qty se zyada hai. Phir bhi save karein?`)) return;
    try {
      const s = await apiOpsSave("abstract", { ...f, ...patch, project: f.location, totalCurrent: +tot.c.toFixed(2), totalCumulative: +tot.u.toFixed(2) });
      setF(s); setLocked(true); load(); toast.success(`${msg} · ${s.docNo}`);
    } catch (e) { toast.error(e.message); }
  };
  const del = async () => {
    if (!rows.some((r) => r.id === f.id) || !window.confirm(`Delete ${f.docNo}?`)) return;
    try { await apiOpsDelete("abstract", f.id); setF(blank()); setLocked(false); load(); toast.success("Deleted"); } catch (e) { toast.error(e.message); }
  };
  const H = ({ l, children }) => <div style={{ display: "flex", flexDirection: "column", gap: 3 }}><label style={{ fontSize: 10.5, fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>{l}</label>{children}</div>;
  const cols = ["Sr", "PO Pos", "Item Description", "Item Code", "UOM", "HSN", "PO Qty", "PO Rate", "Prev Qty", "Prev Amt", "Current Qty", "Current Amt", "Cumul. Qty", "Cumul. Amt", "Balance Qty", ""];

  return (
    <div data-testid="crm-abstract" style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "9px 14px", background: "#1e3a8a", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span>ABSTRACT (Summary of Item Schedules) · Annexure "A"</span>
          <span data-testid="abs-docno">{f.tempNo ? `Temp: ${f.tempNo}` : "Temp No: Save par"}{f.permNo ? ` · Permanent: ${f.permNo}` : ""} · {f.status}</span>
        </div>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "10px 12px" }}>
          <H l="Client (To) *"><select data-testid="abs-client" disabled={ro} value={f.clientId} onChange={(e) => pickClient(e.target.value)} style={inp}><option value="">— Select client —</option>{(data.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></H>
          <div style={{ gridColumn: "span 1", gridRow: "span 2" }}><H l="To (Address)"><textarea data-testid="abs-to" disabled={ro} rows={4} value={f.toText} onChange={(e) => set("toText", e.target.value)} style={inp} /></H></div>
          <H l="Purchase Order No *"><input data-testid="abs-po" disabled={ro} value={f.poNo} onChange={(e) => set("poNo", e.target.value)} style={inp} /></H>
          <H l="PO Dated"><input type="date" disabled={ro} value={f.poDate} onChange={(e) => set("poDate", e.target.value)} style={inp} /></H>
          <H l="Invoice No"><input data-testid="abs-inv" disabled={ro} list="abs-inv-list" value={f.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} style={inp} /><datalist id="abs-inv-list">{(data.invoices || []).map((i) => <option key={i.id} value={i.invoiceNo || i.refNo} />)}</datalist></H>
          <H l="Invoice Dated"><input type="date" disabled={ro} value={f.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} style={inp} /></H>
          <H l="Work Period From"><input type="date" disabled={ro} value={f.periodFrom} onChange={(e) => set("periodFrom", e.target.value)} style={inp} /></H>
          <H l="Work Period To"><input type="date" disabled={ro} value={f.periodTo} onChange={(e) => set("periodTo", e.target.value)} style={inp} /></H>
          <div style={{ gridColumn: "span 2" }}><H l="Location / Work"><input data-testid="abs-location" disabled={ro} value={f.location} onChange={(e) => set("location", e.target.value)} style={inp} /></H></div>
          <H l="Contractor · PAN · GSTIN (auto)"><input disabled value={`${co.name || ""} · ${co.pan || ""} · ${co.gst || ""}`} style={{ ...inp, background: "#f8fafc" }} /></H>
        </div>
        <div style={{ overflowX: "auto", padding: "0 14px 14px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
            <tbody>
              {f.lines.map((l, i) => { const c = calc(l); const I = (k, w, t = "text") => <input data-testid={`abs-l${i}-${k}`} type={t} disabled={ro} value={l[k]} onChange={(e) => setLine(i, k, e.target.value)} style={{ ...inp, minWidth: w }} />; return (
                <tr key={l.k}>
                  <td style={{ ...td, textAlign: "center" }}>{i + 1}</td><td style={td}>{I("poPos", 50)}</td><td style={td}>{I("desc", 170)}</td><td style={td}>{I("code", 90)}</td><td style={td}>{I("uom", 50)}</td><td style={td}>{I("hsn", 70)}</td>
                  <td style={td}>{I("poQty", 70, "number")}</td><td style={td}>{I("rate", 70, "number")}</td><td style={td}>{I("prevQty", 70, "number")}</td>
                  <td style={{ ...td, textAlign: "right" }}>{f2(c.prevAmt)}</td><td style={td}>{I("curQty", 70, "number")}</td><td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{f2(c.curAmt)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{f2(c.cumQty)}</td><td style={{ ...td, textAlign: "right" }}>{f2(c.cumAmt)}</td><td style={{ ...td, textAlign: "right", color: c.bal < 0 ? "#dc2626" : "#0f172a", fontWeight: 700 }}>{f2(c.bal)}</td>
                  <td style={td}>{!ro && f.lines.length > 1 && <button data-testid={`abs-l${i}-del`} onClick={() => setF((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626" }}><Trash2 size={13} /></button>}</td>
                </tr>
              ); })}
              <tr style={{ fontWeight: 900 }}><td style={td} colSpan={9}>TOTAL</td><td data-testid="abs-tot-prev" style={{ ...td, textAlign: "right" }}>{f2(tot.p)}</td><td style={td} /><td data-testid="abs-tot-cur" style={{ ...td, textAlign: "right" }}>{f2(tot.c)}</td><td style={td} /><td data-testid="abs-tot-cum" style={{ ...td, textAlign: "right" }}>{f2(tot.u)}</td><td style={td} colSpan={2} /></tr>
            </tbody>
          </table>
          {!ro && <button data-testid="abs-add-line" onClick={() => setF((p) => ({ ...p, lines: [...p.lines, line()] }))} style={{ ...btn("#0369a1"), marginTop: 8 }}><Plus size={13} /> Item jodein</button>}
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>Amount = Qty × PO Rate · Cumulative = Previous + Current · Balance = PO Qty − Cumulative · Same PO No + PO Pos + Item Code par pichhle Abstract ki qty apne-aap Previous Qty mein aati hai.</div>
        </div>
      </div>
      <div data-testid="abs-action-row" style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6 }}>
        <button data-testid="abs-new" onClick={() => { setF(blank()); setLocked(false); }} style={btn("#0369a1")}><FilePlus2 size={13} /> New</button>
        <button data-testid="abs-edit" onClick={() => setLocked(false)} disabled={approved && !can("client", "a")} style={btn("#eab308", approved && !can("client", "a"))}>Edit</button>
        <button data-testid="abs-save" disabled={ro} onClick={() => save()} style={btn("#16a34a", ro)}><Save size={13} /> Save</button>
        <button data-testid="abs-submit" disabled={approved} onClick={() => save({ status: "Submitted" }, "Submitted for approval")} style={btn("#7c3aed", approved)}><Send size={13} /> Submit</button>
        <button data-testid="abs-approve" disabled={approved || !can("client", "a")} onClick={() => save({ status: "Approved" }, "Approved")} style={btn("#15803d", approved || !can("client", "a"))}><CheckCircle2 size={13} /> Approve</button>
        <button data-testid="abs-delete" disabled={!can("client", "a")} onClick={del} style={btn("#991b1b", !can("client", "a"))}><Trash2 size={13} /> Delete</button>
        <button data-testid="abs-print" onClick={() => printAbstract(f, co)} style={btn("#0f172a")}><Printer size={13} /> Print (A4 Landscape)</button>
      </div>
      <div data-testid="abs-sheet" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "#f1f5f9", fontWeight: 800, fontSize: 12 }}>Abstract Register ({rows.length}) · Row click = Load</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead><tr>{["Permanent / Ref No", "Temp No", "PO No", "Invoice No", "Location", "Current Amt", "Cumulative Amt", "Status"].map((h) => <th key={h} style={{ padding: 6, textAlign: "left", background: "#f8fafc" }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} data-testid={`abs-row-${r.id}`} onClick={() => { setF({ ...blank(), ...r }); setLocked(true); }} style={{ cursor: "pointer", borderTop: "1px solid #f1f5f9" }}>
              <td style={{ padding: 6, fontWeight: 700 }}>{r.docNo}</td><td style={{ padding: 6 }}>{r.tempNo}</td><td style={{ padding: 6 }}>{r.poNo}</td><td style={{ padding: 6 }}>{r.invoiceNo}</td><td style={{ padding: 6 }}>{r.location}</td>
              <td style={{ padding: 6 }}>{f2(r.totalCurrent)}</td><td style={{ padding: 6 }}>{f2(r.totalCumulative)}</td><td style={{ padding: 6, fontWeight: 700 }}>{r.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};
