import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Printer, FileText, Eye, X, Mail, IndianRupee, Pencil } from "lucide-react";
import { toast } from "sonner";
import { canDelete as canApprove, getCompany, getLogo, amountToWords, currentUser } from "../../lib/store";
import { CrmActionBar } from "./CrmActionBar";
import { enableLayoutEdit, LAYOUT_EDIT_HINT } from "../../lib/printLayoutEdit";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, stepTone, uid, today, inr, num, nameOf, crmNextNo } from "./crmShared";

export const INV_STEPS = { 1: "Draft", 2: "Submitted", 3: "Approved", 4: "Sent to Client", 5: "Paid", 6: "Cancelled" };
export const invLabel = (b) => b.invoiceNo || b.refNo || "—";
const r2 = (n) => +(Number(n) || 0).toFixed(2);
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\n/g, "<br/>");

export const fyCode = (d) => {
  const dt = new Date(d || Date.now());
  const y = dt.getMonth() >= 3 ? dt.getFullYear() : dt.getFullYear() - 1;
  return `${String(y).slice(2)}${String(y + 1).slice(2)}`;
};
const isUP = (c) => /^09/.test(String(c.gst || "").trim()) || /uttar\s*pradesh|^up$/i.test(String(c.state || "").trim());

export const computeInvoice = (inv, client = {}) => {
  const intra = isUP(client);
  const lines = (inv.lines || []).map((l) => {
    const taxable = r2(num(l.qty) * num(l.rate));
    const tax = taxable * num(l.gstPct) / 100;
    const igst = intra ? 0 : r2(tax);
    const cgst = intra ? r2(tax / 2) : 0;
    return { ...l, taxable, igst, cgst, sgst: cgst, total: r2(taxable + igst + cgst * 2) };
  });
  const sum = (k) => r2(lines.reduce((s, l) => s + l[k], 0));
  return { intra, lines, taxable: sum("taxable"), igst: sum("igst"), cgst: sum("cgst"), sgst: sum("sgst"), total: sum("total") };
};

const blankLine = () => ({ poPos: "", itemCode: "", description: "", hsn: "", qty: "", uom: "", rate: "", gstPct: 18 });
const blank = () => ({ id: "", refNo: "", invoiceNo: "", invoiceDate: today(), contractId: "", poNo: "", poDate: "", projectCode: "", projectName: "", projectManager: "", workPeriod: "", contractorLocation: "", billLocation: "", contractorCode: "", clientId: "", lines: [blankLine()], specialInstructions: "", signatoryName: "", signatoryDesignation: "", step: 1, history: [], sentAt: "", receivedAmount: "", receivedDate: "", utr: "" });

export const Invoices = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const [preview, setPreview] = useState(null);
  const client = data.clients.find((c) => c.id === f.clientId) || {};
  const t = useMemo(() => computeInvoice(f, client), [f, client]);
  const st = Number(f.step);
  const locked = st >= 2 || !editing;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setLine = (i, k, v) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  const persist = async (rec, msg, action) => {
    const r = { ...rec, id: rec.id || uid("inv") };
    const fy = fyCode(r.invoiceDate);
    if (!r.refNo) r.refNo = await crmNextNo(`invref_${fy}`, `INV-REF/${fy}/`, 4);
    r.history = [...(r.history || []), { action: action || (rec.id ? "Edited" : "Created"), at: new Date().toISOString(), by: currentUser() }];
    const c = computeInvoice(r, data.clients.find((x) => x.id === r.clientId) || {});
    Object.assign(r, { lines: r.lines.filter((l) => l.description || num(l.qty)), taxable: c.taxable, igst: c.igst, cgst: c.cgst, sgst: c.sgst, total: c.total });
    const out = await save("invoices", r, msg);
    if (out) { setF(out); setEditing(false); }
    return out;
  };
  const onSave = () => {
    if (!f.clientId) return toast.error("Bill To: client select karein");
    if (!f.lines.some((l) => l.description && num(l.qty) && num(l.rate))) return toast.error("Kam se kam ek item (description, qty, rate) bharein");
    persist(f, "Invoice saved");
  };
  const move = async (step, extra = {}) => {
    const out = await persist({ ...f, ...extra, step }, null, INV_STEPS[step]);
    if (out) toast.success(`${invLabel(out)} → ${INV_STEPS[step]}`);
  };
  const del = async () => { if (await remove("invoices", f.id)) { setF(blank()); setEditing(true); } };

  const clientOpts = [{ v: "", l: "— Select client —" }, ...data.clients.map((c) => ({ v: c.id, l: `${c.clientCode || c.tempRefId || ""} · ${c.name}` }))];
  const woOpts = [{ v: "", l: "— Select Work Order —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.workOrderNo || c.contractNo} · ${c.projectName}` }))];
  const pickWO = (id) => {
    const c = data.contracts.find((x) => x.id === id);
    if (!c) return setF({ ...f, contractId: "" });
    const lines = (c.items || []).filter((i) => i.description).map((i, k) => ({ ...blankLine(), poPos: String(k + 1), itemCode: i.itemCode || (/^\d{4,8}$/.test(String(i.code || "").trim()) ? "" : i.code || ""), description: i.description, hsn: /^\d{4,8}$/.test(String(i.code || "").trim()) ? i.code : "", uom: i.unit || "", rate: num(i.rate), gstPct: num(i.gstPct) || 18, qty: "" }));
    setF({ ...f, contractId: id, clientId: c.clientId || f.clientId, poNo: c.workOrderNo || f.poNo, poDate: c.workOrderDate || f.poDate, projectName: c.projectName || f.projectName, projectCode: f.projectCode || c.contractNo || "", billLocation: c.siteLocation || f.billLocation, lines: lines.length ? lines : f.lines });
    toast.success(`${lines.length} items Work Order se aa gaye · sirf Qty bharein`);
  };
  const inp = (i, k, w, type = "text") => <Inp data-testid={`inv-line-${k}-${i}`} type={type} disabled={locked} value={f.lines[i][k]} onChange={(e) => setLine(i, k, e.target.value)} style={{ width: w }} />;
  return (
    <>
      <CrmActionBar name="inv" status={f.id ? `${invLabel(f)} · ${INV_STEPS[st]} · ${editing && st < 2 ? "Editing" : "View"}` : "New Tax Invoice"}
        labels={{ submit: "Submit for Approval", approve: "Final Approval" }}
        onNew={() => { setF(blank()); setEditing(true); }} onSave={editing && st < 2 ? onSave : null}
        onEdit={f.id && !editing && st < 2 ? () => setEditing(true) : null}
        onSubmit={f.id && st === 1 && !editing ? () => move(2) : null} onApprove={f.id && st === 2 ? () => move(3) : null}
        onDelete={f.id && !f.invoiceNo ? del : null}
        list={{ title: "Client Tax Invoice Register", cols: ["Ref No", "Invoice No", "Date", "Client", "PO No", "Project", "Taxable", "IGST", "CGST", "SGST", "Total", "Status"], rows: data.invoices.map((b) => [b.refNo, b.invoiceNo || "", b.invoiceDate, nameOf(data.clients, b.clientId), b.poNo, b.projectName, num(b.taxable), num(b.igst), num(b.cgst), num(b.sgst), num(b.total), INV_STEPS[b.step]]) }} />
      <Card testid="inv-form" title={f.id ? `Tax Invoice · Reference No: ${f.refNo}${f.invoiceNo ? ` · Invoice No: ${f.invoiceNo}` : " · Invoice No approval par milega"} · ${INV_STEPS[st]}` : "New Tax Invoice · Reference No: Save karte hi milega"}>
        <Grid cols={4}>
          <Field label="Reference No"><Inp data-testid="inv-ref-no" disabled value={f.refNo || "Auto — Save par"} style={{ fontWeight: 800, color: "#1e3a8a" }} /></Field>
          <Field label="Permanent Invoice No"><Inp data-testid="inv-perm-no" disabled value={f.invoiceNo || "Approval ke baad"} style={{ fontWeight: 800, color: "#166534" }} /></Field>
        </Grid>
        <div style={{ height: 12 }} />
        <Grid cols={4}>
          <Field label="Work Order (auto-fill)"><Sel data-testid="inv-wo" disabled={locked} value={f.contractId || ""} onChange={(e) => pickWO(e.target.value)} options={woOpts} /></Field>
          <Field label="Bill To (Client) *"><Sel data-testid="inv-client" disabled={locked} value={f.clientId} onChange={set("clientId")} options={clientOpts} /></Field>
          <Field label="Invoice Date"><Inp data-testid="inv-date" type="date" disabled={locked} value={f.invoiceDate} onChange={set("invoiceDate")} /></Field>
          <Field label="PO No"><Inp data-testid="inv-po-no" disabled={locked} value={f.poNo} onChange={set("poNo")} /></Field>
          <Field label="PO Date"><Inp data-testid="inv-po-date" type="date" disabled={locked} value={f.poDate} onChange={set("poDate")} /></Field>
          <Field label="Project Code"><Inp data-testid="inv-project-code" disabled={locked} value={f.projectCode} onChange={set("projectCode")} /></Field>
          <Field label="Project Name"><Inp data-testid="inv-project-name" disabled={locked} value={f.projectName} onChange={set("projectName")} /></Field>
          <Field label="Project Manager"><Inp data-testid="inv-pm" disabled={locked} value={f.projectManager} onChange={set("projectManager")} /></Field>
          <Field label="Work Period"><Inp data-testid="inv-period" disabled={locked} value={f.workPeriod} onChange={set("workPeriod")} /></Field>
          <Field label="Location (Contractor side)"><Inp data-testid="inv-loc-contractor" disabled={locked} value={f.contractorLocation} onChange={set("contractorLocation")} /></Field>
          <Field label="Location (Bill To side)"><Inp data-testid="inv-loc-bill" disabled={locked} value={f.billLocation} onChange={set("billLocation")} /></Field>
          <Field label="Contractor / Vendor Code (at client)"><Inp data-testid="inv-contractor-code" disabled={locked} value={f.contractorCode} onChange={set("contractorCode")} /></Field>
          <Field label="Tax Type"><Inp data-testid="inv-tax-type" disabled value={f.clientId ? (t.intra ? "CGST + SGST (Uttar Pradesh)" : "IGST (Other State)") : "— client select karein —"} /></Field>
        </Grid>
        {f.clientId && <div data-testid="inv-billto" style={{ marginTop: 10, fontSize: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10 }}><b>{client.name}</b> · {client.address || "—"} {client.city} {client.state} {client.pincode} · PAN: {client.pan || "—"} · GSTIN: {client.gst || "—"}</div>}
        <div style={{ marginTop: 12 }}>
          <Table testid="inv-lines-table" cols={["PO Pos", "Item Code", "Description", "HSN", "Qty", "UOM", "Rate", "GST %", "Taxable", t.intra ? "CGST+SGST" : "IGST", "Total", ""]}
            rows={t.lines.map((l, i) => [inp(i, "poPos", 60), inp(i, "itemCode", 90), inp(i, "description", 220), inp(i, "hsn", 80), inp(i, "qty", 80, "number"), inp(i, "uom", 60), inp(i, "rate", 90, "number"), inp(i, "gstPct", 60, "number"),
              inr(l.taxable), inr(t.intra ? l.cgst + l.sgst : l.igst), inr(l.total),
              !locked && f.lines.length > 1 ? <Btn tone="red" data-testid={`inv-line-del-${i}`} onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}><Trash2 size={12} /></Btn> : ""])} />
          {!locked && <Btn tone="ghost" data-testid="inv-add-line" style={{ marginTop: 8 }} onClick={() => setF({ ...f, lines: [...f.lines, blankLine()] })}><Plus size={13} /> Add Item</Btn>}
        </div>
        <Grid cols={3}>
          <Field label="Special Instructions" span={3}><Inp data-testid="inv-instructions" disabled={locked} value={f.specialInstructions} onChange={set("specialInstructions")} /></Field>
          <Field label="Name of Signatory"><Inp data-testid="inv-signatory" disabled={locked} value={f.signatoryName} onChange={set("signatoryName")} /></Field>
          <Field label="Designation / Status"><Inp data-testid="inv-designation" disabled={locked} value={f.signatoryDesignation} onChange={set("signatoryDesignation")} /></Field>
        </Grid>
        <div data-testid="inv-totals" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, background: "#eff6ff", padding: 12, borderRadius: 8, fontSize: 12 }}>
          <div>Taxable: <b>{inr(t.taxable)}</b></div><div>IGST: <b>{inr(t.igst)}</b></div><div>CGST: <b>{inr(t.cgst)}</b></div><div>SGST: <b>{inr(t.sgst)}</b></div>
          <div data-testid="inv-total" style={{ color: "#1e3a8a" }}>Total Invoice: <b>{inr(t.total)}</b></div>
        </div>
        {f.id && (
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn tone="brand" data-testid="inv-preview-btn" onClick={() => setPreview(true)}><Eye size={14} /> Preview Invoice</Btn>
            <Btn tone="dark" data-testid="inv-print-with" onClick={() => printInvoice(f, t, client, true)}><Printer size={14} /> Print (with Company Details)</Btn>
            <Btn tone="ghost" data-testid="inv-print-without" onClick={() => printInvoice(f, t, client, false)}><FileText size={14} /> Print on Letterhead (without Company Details)</Btn>
            {st < 3 && <span style={{ fontSize: 11, color: "#92400e", alignSelf: "center" }}>Note: Permanent Invoice No approval ke baad milega — tabhi final copy client ko dein.</span>}
            {st === 3 && canApprove() && <Btn tone="dark" data-testid="inv-sent-btn" onClick={() => move(4, { sentAt: today() })}><Mail size={14} /> Mark Sent to Client</Btn>}
            {[3, 4].includes(st) && canApprove() && <Btn tone="red" data-testid="inv-cancel-btn" onClick={() => {
              const reason = (window.prompt(`${f.invoiceNo} cancel karne ka kaaran likhein:`) || "").trim();
              if (!reason) { toast.error("Cancel ke liye kaaran zaroori hai"); return; }
              move(6, { cancelReason: reason, cancelledAt: today(), cancelledBy: currentUser() });
            }}><X size={14} /> Cancel Invoice</Btn>}
          </div>
        )}
        {f.id && st === 4 && canApprove() && (
          <div data-testid="inv-payment-box" style={{ marginTop: 12, padding: 12, border: "1px dashed #86efac", borderRadius: 8 }}>
            <Grid cols={4}>
              <Field label="Amount Received (₹)"><Inp data-testid="inv-recv-amt" type="number" value={f.receivedAmount} placeholder={String(t.total)} onChange={(e) => setF({ ...f, receivedAmount: e.target.value })} /></Field>
              <Field label="Payment Date"><Inp data-testid="inv-recv-date" type="date" value={f.receivedDate} onChange={(e) => setF({ ...f, receivedDate: e.target.value })} /></Field>
              <Field label="UTR / Cheque No"><Inp data-testid="inv-recv-utr" value={f.utr} onChange={(e) => setF({ ...f, utr: e.target.value })} /></Field>
              <Field label=" "><Btn tone="green" data-testid="inv-paid-btn" onClick={() => { if (!f.utr) return toast.error("UTR / Cheque No bharein"); move(5, { receivedAmount: num(f.receivedAmount) || t.total, receivedDate: f.receivedDate || today() }); }}><IndianRupee size={14} /> Mark Paid</Btn></Field>
            </Grid>
          </div>
        )}
        {f.id && st === 5 && <div data-testid="inv-paid-info" style={{ marginTop: 12, fontSize: 12, color: "#166534", fontWeight: 700 }}>Paid — {inr(f.receivedAmount)} on {f.receivedDate} · UTR {f.utr}</div>}
        {f.id && st === 6 && <div data-testid="inv-cancel-info" style={{ marginTop: 12, fontSize: 12, color: "#b91c1c", fontWeight: 700, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10 }}>CANCELLED — {f.cancelledAt} by {f.cancelledBy || "—"} · Reason: {f.cancelReason}</div>}
      </Card>
      {preview && <InvoicePreview inv={f} t={t} client={client} onClose={() => setPreview(null)} />}
      <Card title={`Client Tax Invoices (${data.invoices.length})`}>
        <Table testid="inv-table" cols={["Ref No", "Invoice No", "Date", "Client", "PO No", "Taxable", "GST", "Total", "Status", ""]}
          rows={data.invoices.slice().reverse().map((b) => [b.refNo || "—", b.invoiceNo || "—", b.invoiceDate, nameOf(data.clients, b.clientId), b.poNo || "—", inr(b.taxable), inr(num(b.igst) + num(b.cgst) + num(b.sgst)), inr(b.total),
            <Badge text={INV_STEPS[b.step]} tone={stepTone(b.step)} />,
            <Btn tone="ghost" data-testid={`inv-open-${b.id}`} onClick={() => { setF({ ...blank(), ...b, lines: b.lines?.length ? b.lines : [blankLine()] }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open</Btn>])} />
      </Card>
    </>
  );
};

const fmtD = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "");
const n2 = (v) => (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const buildInvoiceHtml = (inv, t, client, withCompany, autoPrint = true) => {
  const co = getCompany();
  const gstin = co.gst || "09ABWFM0611J1ZY";
  const pan = co.pan || "ABWFM0611J";
  const logo = getLogo() || `${window.location.origin}/arun-logo.jpg`;
  const pct = (l, k) => (k === "igst" ? (t.intra ? "" : `${num(l.gstPct)}%`) : (t.intra ? `${num(l.gstPct) / 2}%` : ""));
  const amt = (v) => (v ? n2(v) : "");
  const rows = t.lines.map((l) => `<tr><td class=c>${esc(l.poPos)}</td><td class=c>${esc(l.itemCode)}</td><td>${esc(l.description)}</td><td class=c>${esc(l.hsn)}</td><td class=c>${esc(l.qty)}</td><td class=c>${esc(l.uom)}</td><td class=r>${n2(l.rate)}</td><td class=r>${n2(l.taxable)}</td><td class=c>${pct(l, "igst")}</td><td class=r>${amt(l.igst)}</td><td class=c>${pct(l, "cgst")}</td><td class=r>${amt(l.cgst)}</td><td class=c>${pct(l, "sgst")}</td><td class=r>${amt(l.sgst)}</td><td class=r>${n2(l.total)}</td></tr>`).join("");
  const head = withCompany
    ? `<div class=hdr><img src="${esc(logo)}" onerror="this.style.display='none'"/><div class=hc><div class=hn>${esc(co.name)}</div>${co.tagline ? `<div class=ht>${esc(co.tagline)}</div>` : ""}${co.pillLine ? `<div class=hp>${esc(co.pillLine)}</div>` : ""}<div class=hd>${esc(co.address)}</div><div class=hd>${[co.tollFree && "Mob: " + co.tollFree, co.email && "Email: " + co.email, co.website].filter(Boolean).map(esc).join(" · ")}</div><div class=hd><b>GSTIN: ${esc(gstin)} · PAN: ${esc(pan)}</b></div></div><div style="width:70px"></div></div>`
    : `<div style="height:75mm"></div>`;
  const cAddr = String(co.address || "").split(",").map((s) => s.trim()).filter(Boolean).map(esc).join(",<br/>");
  const invNoTxt = inv.invoiceNo || `${inv.refNo || ""} (Draft — pending approval)`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(invNoTxt)}</title><style>
  @page{size:A4 portrait;margin:10mm}html{background:#e2e8f0}body{font-family:Calibri,Arial,sans-serif;font-size:9px;color:#000;margin:0 auto;width:190mm;background:#fff;position:relative}
  @media screen{body{padding:10mm;box-sizing:content-box;min-height:277mm;margin:10px auto;box-shadow:0 2px 12px rgba(0,0,0,.2)}}
  .cxl{position:absolute;top:45%;left:0;right:0;text-align:center;font-size:90px;font-weight:900;color:rgba(220,38,38,.22);transform:rotate(-30deg);pointer-events:none;z-index:5}
  table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #000;padding:2px 3px;vertical-align:top;word-wrap:break-word}th{font-weight:400;text-align:center;vertical-align:middle;font-size:8px}
  .c{text-align:center}.r{text-align:right}.b{font-weight:700}.u{text-decoration:underline;font-weight:700}.nb td{border-top:none;border-bottom:none}
  .ttl{text-align:center;font-size:13px;font-weight:700;padding:4px}
  .hdr{display:flex;align-items:center;gap:10px;border-bottom:2.5px solid #c81e2b;padding-bottom:5px;margin-bottom:6px}.hdr img{width:70px;height:60px;object-fit:contain}.hc{flex:1;text-align:center}.hn{font-size:18px;font-weight:900;color:#c81e2b}.ht{font-size:8.5px;font-weight:700;letter-spacing:1px}.hp{display:inline-block;margin:2px 0;padding:1px 10px;background:#0ea5e9;color:#fff;border-radius:10px;font-size:8.5px;font-weight:700}.hd{font-size:8.5px}
  .sig{height:115px;position:relative}.sig div{position:absolute;right:6px;text-align:right;font-weight:700;font-size:9.5px}
  </style></head><body>${Number(inv.step) === 6 ? `<div class=cxl>CANCELLED</div>` : ""}${head}
  <table>
  <tr><td colspan=15 class=ttl>TAX INVOICE</td></tr>
  <tr><td colspan=2 class=b>Invoice No :</td><td colspan=2 class=b>${esc(invNoTxt)}</td><td colspan=3 class=b>Invoice Date</td><td colspan=8>${fmtD(inv.invoiceDate)}</td></tr>
  <tr><td colspan=2 class=b>PO No :</td><td colspan=2 class=b>${esc(inv.poNo)}</td><td colspan=3 class=b>PO Date</td><td colspan=8>${fmtD(inv.poDate)}</td></tr>
  <tr><td colspan=2 class=b>Project Code :</td><td colspan=2 class=b>${esc(inv.projectCode)}</td><td colspan=3 class=b>Project Name</td><td colspan=8>${esc(inv.projectName)}</td></tr>
  <tr><td colspan=2 class=b>Project Manager :</td><td colspan=2 class=b>${esc(inv.projectManager)}</td><td colspan=3 class=b>Work Period</td><td colspan=8>${esc(inv.workPeriod)}</td></tr>
  <tr><td colspan=2 class=b>Location</td><td colspan=2>${esc(inv.contractorLocation)}</td><td colspan=3 class=b>Location</td><td colspan=8>${esc(inv.billLocation)}</td></tr>
  <tr><td colspan=4><span class=u>CONTRACTOR NAME &amp; ADDRESS :</span><br/><b>${esc(inv.contractorCode)}</b><br/><br/>${esc(String(co.name || "").replace(/^M\/s\s*/i, ""))},<br/>${cAddr}<br/>PAN: ${esc(pan)}</td>
      <td colspan=11><span class=u>BILL TO :</span><br/><b>${esc(client.name)}</b><br/><br/>${esc(client.address)}${client.city ? ",<br/>" + esc(client.city) : ""}${client.pincode ? " - " + esc(client.pincode) : ""}<br/>STATE: ${esc(String(client.state || "").toUpperCase())}<br/>PAN: ${esc(client.pan)}</td></tr>
  <tr><td colspan=4>GSTIN : ${esc(gstin)}</td><td colspan=11>GSTIN : ${esc(client.gst)}</td></tr>
  <tr><th rowspan=2 style="width:6%">PO Pos. No</th><th rowspan=2 style="width:7%">Item Code</th><th rowspan=2 style="width:17%">Item Description</th><th rowspan=2 style="width:6%">HSN Code</th><th rowspan=2 style="width:5.5%">Qty</th><th rowspan=2 style="width:4.5%">UOM</th><th rowspan=2 style="width:7%">Basic per Item (Rs)</th><th rowspan=2 style="width:8%">Taxable Amt (Rs)</th><th colspan=2>IGST</th><th colspan=2>CGST</th><th colspan=2>SGST</th><th rowspan=2 style="width:8.5%">Total Amt (Rs)</th></tr>
  <tr><th style="width:4%">Rate</th><th style="width:6.5%">Amount</th><th style="width:4%">Rate</th><th style="width:6.5%">Amount</th><th style="width:4%">Rate</th><th style="width:6.5%">Amount</th></tr>
  ${rows}
  <tr class=b><td></td><td colspan=2 class=c>Sub Total</td><td></td><td></td><td></td><td></td><td class=r>${n2(t.taxable)}</td><td></td><td class=r>${n2(t.igst)}</td><td></td><td class=r>${n2(t.cgst)}</td><td></td><td class=r>${n2(t.sgst)}</td><td class=r>${n2(t.total)}</td></tr>
  <tr><td rowspan=2></td><td colspan=13>Total Invoice Value (In figure):</td><td class="r b">${n2(t.total)}</td></tr>
  <tr><td colspan=14 class=b>Net Amount Payable (in words)- ${esc(amountToWords(t.total))}</td></tr>
  <tr><td colspan=15 style="border-bottom:none;font-size:12px">Special Instructions : ${esc(inv.specialInstructions)}</td></tr>
  <tr><td colspan=15 class=sig style="border-top:none"><div style="top:58px">Signature</div><div style="top:80px">${esc(inv.signatoryName) || "Name of Signatory"}</div><div style="top:100px">${esc(inv.signatoryDesignation) || "Designation / Status"}</div></td></tr>
  </table>${autoPrint ? "<script>window.onload=()=>window.print()</script>" : ""}</body></html>`;
};

export const printInvoice = (inv, t, client, withCompany) => {
  const w = window.open("", "_blank");
  if (!w) { alert("Pop-up allow karein"); return; }
  w.document.write(buildInvoiceHtml(inv, t, client, withCompany));
  w.document.close();
};

const InvoicePreview = ({ inv, t, client, onClose }) => {
  const [withCo, setWithCo] = useState(true);
  const [edit, setEdit] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [margin, setMargin] = useState(10);
  const ref = useRef(null);
  const allowed = canApprove();
  const apply = () => {
    const d = ref.current?.contentDocument;
    if (!d?.body) return;
    d.body.contentEditable = edit ? "true" : "false";
    let s = d.getElementById("ae-adjust");
    if (!s) { s = d.createElement("style"); s.id = "ae-adjust"; d.head.appendChild(s); }
    s.textContent = `body{zoom:${zoom}%}@page{margin:${margin}mm}${edit ? "body{outline:2px dashed #f59e0b;outline-offset:-6px}" : ""}`;
    enableLayoutEdit(d, edit);
  };
  useEffect(apply);
  const ctl = { padding: "4px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 5, width: 64 };
  return (
    <div data-testid="inv-preview-modal" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "min(1200px,100%)", height: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
          <b style={{ fontSize: 14, flex: 1 }}>Invoice Preview · {invLabel(inv)}</b>
          <Btn tone={withCo ? "dark" : "ghost"} data-testid="inv-preview-with" onClick={() => setWithCo(true)}>With Company Details</Btn>
          <Btn tone={!withCo ? "dark" : "ghost"} data-testid="inv-preview-without" onClick={() => setWithCo(false)}>Without (Letterhead)</Btn>
          {allowed && <Btn tone={edit ? "brand" : "ghost"} data-testid="inv-preview-edit" onClick={() => setEdit(!edit)}><Pencil size={13} /> {edit ? "Editing ON" : "Edit Layout / Data"}</Btn>}
          {allowed && <label style={{ fontSize: 11.5, fontWeight: 700 }}>Size % <input data-testid="inv-preview-zoom" type="number" min="60" max="140" value={zoom} onChange={(e) => setZoom(Number(e.target.value) || 100)} style={ctl} /></label>}
          {allowed && <label style={{ fontSize: 11.5, fontWeight: 700 }}>Margin mm <input data-testid="inv-preview-margin" type="number" min="0" max="30" value={margin} onChange={(e) => setMargin(Number(e.target.value) || 0)} style={ctl} /></label>}
          <Btn tone="brand" data-testid="inv-preview-print" onClick={() => (allowed ? ref.current?.contentWindow?.print() : printInvoice(inv, t, client, withCo))}><Printer size={13} /> Print</Btn>
          <button data-testid="inv-preview-close" onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        {edit && <div style={{ padding: "5px 14px", background: "#fef3c7", fontSize: 11.5, fontWeight: 700, color: "#92400e" }}>{LAYOUT_EDIT_HINT}</div>}
        <iframe ref={ref} onLoad={apply} title="invoice-preview" data-testid="inv-preview-frame" srcDoc={buildInvoiceHtml(inv, t, client, withCo, false)} style={{ flex: 1, border: 0, background: "#f1f5f9" }} />
      </div>
    </div>
  );
};
