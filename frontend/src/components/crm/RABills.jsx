import React, { useMemo, useState } from "react";
import { Wand2, Mail, IndianRupee, Printer } from "lucide-react";
import { toast } from "sonner";
import { canApprove, getCompany, getLogo, amountToWords, isSuperAdmin, currentUserEmail } from "../../lib/store";
import { CrmActionBar } from "./CrmActionBar";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, RA_STEPS, stepTone, uid, today, inr, num, nameOf, crmSave, crmDelete } from "./crmShared";
import { RenumberBtn } from "./ResetNumberingBtn";

export const computeRA = (b) => {
  const lines = (b.lines || []).map((l) => {
    const amount = +(num(l.curQty) * num(l.rate)).toFixed(2);
    return { ...l, amount, gst: +(amount * num(l.gstPct) / 100).toFixed(2) };
  });
  const basic = lines.reduce((s, l) => s + l.amount, 0);
  const gst = lines.reduce((s, l) => s + l.gst, 0);
  const retention = +(basic * num(b.retentionPct) / 100).toFixed(2);
  const tds = +(basic * num(b.tdsPct) / 100).toFixed(2);
  const net = +(basic + gst - retention - num(b.advanceRecovery) - num(b.otherDeduction) - tds).toFixed(2);
  return { lines, basic: +basic.toFixed(2), gst: +gst.toFixed(2), gross: +(basic + gst).toFixed(2), retention, tds, gstPayable: +gst.toFixed(2), net };
};

const blank = () => ({ id: "", raNo: "", type: "RA", contractId: "", billDate: today(), periodFrom: "", periodTo: "", lines: [], mbIds: [], retentionPct: 0, tdsPct: 2, advanceRecovery: 0, otherDeduction: 0, remarks: "", step: 1, receivedAmount: 0, receivedDate: "", receivedRef: "" });

const prevQtyFor = (bills, contractId, itemId, excludeId) =>
  bills.filter((b) => b.contractId === contractId && b.id !== excludeId).flatMap((b) => b.lines || []).filter((l) => l.itemId === itemId).reduce((s, l) => s + num(l.curQty), 0);

export const RABills = ({ data, save, reload }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const contract = data.contracts.find((c) => c.id === f.contractId);
  const t = useMemo(() => computeRA(f), [f]);
  const isSA = isSuperAdmin(currentUserEmail());
  const reEdit = isSA && Number(f.step) === 3;
  const locked = (Number(f.step) >= 3 && !reEdit) || !editing;

  const generate = () => {
    if (!contract) return alert("Contract select karein");
    const mbs = data.mb.filter((m) => m.contractId === contract.id && Number(m.step) === 3 && !m.raBillId);
    if (!mbs.length) return toast.error("Is contract ki koi approved, un-billed MB entry nahi hai");
    const byItem = {};
    mbs.forEach((m) => { byItem[m.itemId] = (byItem[m.itemId] || 0) + num(m.qty); });
    const lines = Object.entries(byItem).map(([itemId, qty]) => {
      const it = (contract.items || []).find((i) => i.id === itemId) || {};
      return { itemId, code: it.code || "", description: it.description || "", unit: it.unit || "", rate: num(it.rate), gstPct: num(it.gstPct), prevQty: +(num(it.prevClaimQty) + prevQtyFor(data.ra_bills, contract.id, itemId, f.id)).toFixed(3), curQty: +qty.toFixed(3) };
    });
    const basic = lines.reduce((s, l) => s + l.curQty * l.rate, 0);
    const recovered = data.ra_bills.filter((b) => b.contractId === contract.id && b.id !== f.id).reduce((s, b) => s + num(b.advanceRecovery), 0);
    const advRec = Math.max(0, Math.min(basic * num(contract.advanceRecoveryPct) / 100, num(contract.advanceAmount) - recovered));
    setF({ ...f, lines, mbIds: mbs.map((m) => m.id), retentionPct: num(contract.retentionPct), tdsPct: contract.tdsPct ?? 2, advanceRecovery: +advRec.toFixed(2) });
    toast.success(`${mbs.length} MB entries se ${lines.length} items load hue`);
  };
  const loadWO = () => {
    if (!contract) return alert("Contract select karein");
    const lines = (contract.items || []).filter((i) => i.description).map((it) => ({ itemId: it.id, code: it.code || "", description: it.description, unit: it.unit || "", rate: num(it.rate), gstPct: num(it.gstPct), prevQty: +(num(it.prevClaimQty) + prevQtyFor(data.ra_bills, contract.id, it.id, f.id)).toFixed(3), curQty: 0 }));
    setF({ ...f, lines, mbIds: [], retentionPct: num(contract.retentionPct), tdsPct: contract.tdsPct ?? 2 });
    toast.success(`${lines.length} Work Order items aa gaye · This Bill Qty bharein`);
  };

  const persist = async (rec, msg) => {
    const r = { ...rec, id: rec.id || uid("ra") };
    const c = computeRA(r);
    Object.assign(r, { basic: c.basic, gstTotal: c.gst, gross: c.gross, retentionAmt: c.retention, tdsAmt: c.tds, gstPayable: c.gstPayable, net: c.net, clientId: (contract || {}).clientId || r.clientId });
    const out = await save("ra_bills", r, msg);
    if (!out) return;
    const toMark = data.mb.filter((m) => (r.mbIds || []).includes(m.id) && m.raBillId !== r.id);
    if (toMark.length) { await Promise.all(toMark.map((m) => crmSave("mb", { ...m, raBillId: r.id }))); await reload(); }
    setF(out);
    setEditing(false);
  };
  const onSave = () => {
    if (!f.contractId || !f.lines.length) return alert("Contract select karke MB / Work Order se items load karein");
    persist(f, "RA Bill saved");
  };
  const reapprove = () => {
    if (!window.confirm(`${f.raNo} approved hai. Badlav save karke dobara approve karein?`)) return;
    persist({ ...f, step: 3, reapprovedBy: currentUserEmail(), reapprovedAt: new Date().toISOString(), history: [...(f.history || []), { action: "Edited & Re-approved", at: new Date().toISOString(), by: currentUserEmail() }] }, `${f.raNo} edit karke dobara approve hua`);
  };
  const move = (b, step, extra = {}) => persist({ ...b, ...extra, step }, `${b.raNo} → ${RA_STEPS[step]}`);
  const del = async (b) => {
    if (!window.confirm(`Delete ${b.raNo}?${Number(b.step) >= 3 ? " Yeh approved/payment bill hai — pakka delete karein?" : ""}`)) return;
    await Promise.all(data.mb.filter((m) => m.raBillId === b.id).map((m) => crmSave("mb", { ...m, raBillId: "" })));
    const ms = data.milestones.find((m) => m.billId === b.id);
    if (ms) await crmSave("milestones", { ...ms, done: false, doneDate: "", billId: "" });
    try { await crmDelete("ra_bills", b.id); toast.success("Deleted"); } catch (e) { toast.error(e.message); }
    await reload(); setF(blank());
  };
  const setLine = (i, k, v) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });

  const contractOpts = [{ v: "", l: "— Select contract —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.contractNo} · ${c.projectName}` }))];
  const st = Number(f.step);
  return (
    <>
      <CrmActionBar name="ra" status={f.id ? `${f.raNo} · ${RA_STEPS[f.step]} · ${editing && st < 3 ? "Editing" : "View"}` : "New RA bill"}
        labels={{ submit: "Submit to GM", approve: "GM Final Approval", save: reEdit ? "Save & Re-approve" : "Save", edit: reEdit ? "Edit & Re-approve" : "Edit" }}
        onNew={() => { setF(blank()); setEditing(true); }} onSave={editing && st < 3 ? onSave : editing && reEdit ? reapprove : null}
        onEdit={f.id && !editing && (st < 3 || reEdit) ? () => setEditing(true) : null}
        onSubmit={f.id && st === 1 ? () => move(f, 2) : null} onApprove={f.id && st === 2 ? () => move(f, 3) : null}
        onDelete={f.id ? () => del(f) : null}
        list={{ title: "RA / Milestone Bill Register", cols: ["Bill No", "Type", "Date", "Client", "Contract", "Basic", "GST", "TDS", "GST Payable", "Retention", "Net", "Status"], rows: data.ra_bills.map((b) => [b.raNo, b.type, b.billDate, nameOf(data.clients, b.clientId), (data.contracts.find((c) => c.id === b.contractId) || {}).contractNo, num(b.basic), num(b.gstTotal), num(b.tdsAmt), num(b.gstTotal), num(b.retentionAmt), num(b.net), RA_STEPS[b.step]]) }} />
      <Card testid="ra-form" title={f.id ? `${f.type === "Milestone" ? "Milestone Bill" : "RA Bill"} · ${f.raNo} · ${RA_STEPS[f.step]}` : "New RA Bill (Running Account)"}>
        <Grid cols={4}>
          <Field label="Contract *"><Sel data-testid="ra-contract" disabled={!!f.id} value={f.contractId} onChange={(e) => setF({ ...blank(), contractId: e.target.value })} options={contractOpts} /></Field>
          <Field label="Bill Date"><Inp data-testid="ra-date" type="date" disabled={locked} value={f.billDate} onChange={set("billDate")} /></Field>
          <Field label="Period From"><Inp data-testid="ra-from" type="date" disabled={locked} value={f.periodFrom} onChange={set("periodFrom")} /></Field>
          <Field label="Period To"><Inp data-testid="ra-to" type="date" disabled={locked} value={f.periodTo} onChange={set("periodTo")} /></Field>
        </Grid>
        {!f.id && f.type === "RA" && <div style={{ display: "flex", gap: 8, marginTop: 12 }}><Btn tone="dark" data-testid="ra-generate-btn" onClick={generate}><Wand2 size={14} /> Generate from approved MB</Btn><Btn tone="ghost" data-testid="ra-load-wo-btn" onClick={loadWO}>Load Work Order Items</Btn></div>}
        <div style={{ marginTop: 12 }}>
          <Table testid="ra-lines-table" empty="MB se items generate karein" cols={["Sr No", "PO Pos", "Item", "Unit", "Rate", "Prev Qty", "This Bill Qty", "Upto Date Qty", "GST %", "Amount", "GST"]}
            rows={t.lines.map((l, i) => [<span data-testid={`ra-line-sr-${i}`}>{(() => { const its = contract?.items || []; const k = its.findIndex((x) => x.id === l.itemId); return k >= 0 ? its[k].srNo || k + 1 : i + 1; })()}</span>, <span data-testid={`ra-line-pos-${i}`}>{(() => { const its = contract?.items || []; const k = its.findIndex((x) => x.id === l.itemId); return k >= 0 ? its[k].poPos || k + 1 : "—"; })()}</span>, `${l.code ? l.code + " · " : ""}${l.description}`, l.unit, inr(l.rate), !locked ? <Inp data-testid={`ra-line-prev-${i}`} type="number" value={f.lines[i].prevQty} onChange={(e) => setLine(i, "prevQty", e.target.value)} style={{ width: 80 }} /> : l.prevQty, !locked && !(f.mbIds || []).length ? <Inp data-testid={`ra-line-qty-${i}`} type="number" value={f.lines[i].curQty} onChange={(e) => setLine(i, "curQty", e.target.value)} style={{ width: 80 }} /> : l.curQty, +(num(l.prevQty) + num(l.curQty)).toFixed(3),
              <Inp data-testid={`ra-line-gst-${i}`} type="number" disabled={locked} value={f.lines[i].gstPct} onChange={(e) => setLine(i, "gstPct", e.target.value)} style={{ width: 70 }} />,
              inr(l.amount), inr(l.gst)])} />
        </div>
        <Grid cols={4}>
          <Field label="Retention %"><Inp data-testid="ra-retention-pct" type="number" disabled={locked} value={f.retentionPct} onChange={set("retentionPct")} /></Field>
          <Field label="Advance Recovery (₹)"><Inp data-testid="ra-adv-rec" type="number" disabled={locked} value={f.advanceRecovery} onChange={set("advanceRecovery")} /></Field>
          <Field label="Other Deduction (₹)"><Inp data-testid="ra-other-ded" type="number" disabled={locked} value={f.otherDeduction} onChange={set("otherDeduction")} /></Field>
          <Field label="Remarks"><Inp data-testid="ra-remarks" disabled={locked} value={f.remarks} onChange={set("remarks")} /></Field>
          <Field label="TDS % (194C)"><Inp data-testid="ra-tds-pct" type="number" disabled={locked} value={f.tdsPct} onChange={set("tdsPct")} /></Field>
        </Grid>
        <div data-testid="ra-totals" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, background: "#eff6ff", padding: 12, borderRadius: 8, fontSize: 12 }}>
          <div>Basic: <b>{inr(t.basic)}</b></div><div>GST: <b>{inr(t.gst)}</b></div><div>Gross: <b>{inr(t.gross)}</b></div>
          <div>Retention: <b>-{inr(t.retention)}</b></div><div>Adv. Recovery: <b>-{inr(f.advanceRecovery)}</b></div>
          <div data-testid="ra-tds">TDS Kata ({num(f.tdsPct)}%): <b>-{inr(t.tds)}</b></div>
          <div data-testid="ra-gst-payable" style={{ color: "#b91c1c" }}>GST Payable (Govt.): <b>{inr(t.gstPayable)}</b></div>
          <div data-testid="ra-net" style={{ color: "#1e3a8a" }}>Net Payable: <b>{inr(t.net)}</b></div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {f.id && st === 3 && canApprove() && <Btn tone="dark" data-testid="ra-sent-btn" onClick={() => move(f, 4, { sentAt: today() })}><Mail size={14} /> Mark Sent to Client</Btn>}
          {f.id && <Btn tone="ghost" data-testid="ra-print-btn" onClick={() => printRA(f, t, contract, data)}><Printer size={14} /> Print Bill</Btn>}
        </div>
        {f.id && Number(f.step) === 4 && canApprove() && (
          <div style={{ marginTop: 12, padding: 12, border: "1px dashed #86efac", borderRadius: 8 }}>
            <Grid cols={4}>
              <Field label="Amount Received (₹)"><Inp data-testid="ra-recv-amt" type="number" value={f.receivedAmount || t.net} onChange={set("receivedAmount")} /></Field>
              <Field label="Received Date"><Inp data-testid="ra-recv-date" type="date" value={f.receivedDate} onChange={set("receivedDate")} /></Field>
              <Field label="UTR / Cheque Ref"><Inp data-testid="ra-recv-ref" value={f.receivedRef} onChange={set("receivedRef")} /></Field>
              <Field label=" "><Btn tone="green" data-testid="ra-received-btn" onClick={() => move(f, 5, { receivedAmount: num(f.receivedAmount) || t.net, receivedDate: f.receivedDate || today() })}><IndianRupee size={14} /> Payment Received</Btn></Field>
            </Grid>
          </div>
        )}
      </Card>
      <Card title={`RA / Milestone Bills (${data.ra_bills.length})`} right={<RenumberBtn target="ra_bills" label="RA Bill" />}>
        <Table testid="ra-table" cols={["Bill No", "Type", "Date", "Client", "Contract", "Gross", "GST Payable", "TDS", "Net", "Status", ""]}
          rows={data.ra_bills.slice().reverse().map((b) => [b.raNo, b.type, b.billDate, nameOf(data.clients, b.clientId), (data.contracts.find((c) => c.id === b.contractId) || {}).contractNo || "—",
            inr(b.gross), inr(b.gstTotal), inr(b.tdsAmt), inr(b.net), <Badge text={RA_STEPS[b.step]} tone={stepTone(b.step)} />,
            <Btn tone="ghost" data-testid={`ra-open-${b.id}`} onClick={() => { setF({ ...blank(), ...b }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open</Btn>])} />
      </Card>
    </>
  );
};

const printRA = (b, t, contract, data) => {
  const co = getCompany();
  const client = data.clients.find((c) => c.id === (contract || {}).clientId) || {};
  const rows = t.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${l.code || ""}</td><td>${l.description}</td><td>${l.unit}</td><td class=r>${l.prevQty}</td><td class=r>${l.curQty}</td><td class=r>${+(num(l.prevQty) + num(l.curQty)).toFixed(3)}</td><td class=r>${inr(l.rate)}</td><td class=r>${l.gstPct}%</td><td class=r>${inr(l.amount)}</td></tr>`).join("");
  const logo = getLogo() || `${window.location.origin}/arun-logo.jpg`;
  const WOT = { Supply: "Supply (Material)", Service: "Service / Works Contract", Composite: "Supply + Service (Composite)" };
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${b.raNo}</title><style>body{font-family:Arial;font-size:12px;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #333;padding:5px}th{background:#eee}.r{text-align:right}h2,h3{margin:4px 0;text-align:center}.sig{display:flex;justify-content:space-between;margin-top:70px}.sig div{border-top:1px solid #333;padding-top:4px;min-width:170px;text-align:center}.hdr{display:flex;align-items:center;gap:16px;border-bottom:3px double #1e3a8a;padding-bottom:8px}.hdr img{height:78px;max-width:150px;object-fit:contain}.hdr .c{flex:1;text-align:center}.hdr .n{font-size:22px;font-weight:900;color:#1e3a8a;letter-spacing:.5px}.hdr .t{font-size:11px;font-style:italic}.hdr .p{display:inline-block;margin:3px 0;padding:2px 10px;border:1px solid #1e3a8a;border-radius:10px;font-size:11px;font-weight:700}.hdr .d{font-size:11px}@media print{@page{size:A4;margin:12mm}}</style></head><body>
  <div class=hdr>${logo ? `<img src="${logo}"/>` : ""}<div class=c><div class=n>${co.name || ""}</div>${co.tagline ? `<div class=t>${co.tagline}</div>` : ""}${co.pillLine ? `<div class=p>${co.pillLine}</div>` : ""}<div class=d>${co.address || ""}</div><div class=d>${[co.tollFree && "Mob: " + co.tollFree, co.email && "Email: " + co.email, co.website].filter(Boolean).join(" · ")}</div><div class=d><b>${[co.gst && "GSTIN: " + co.gst, co.pan && "PAN: " + co.pan, co.state && "State: " + co.state].filter(Boolean).join(" · ")}</b></div></div>${logo ? `<div style="width:150px"></div>` : ""}</div>
  <h3>${b.type === "Milestone" ? "MILESTONE BILL" : "RUNNING ACCOUNT (RA) BILL"} — ${b.raNo}</h3>
  <table style="margin:10px 0"><tr><td><b>Client:</b> ${client.name || ""}<br/>${client.address || ""}<br/>GSTIN: ${client.gst || "—"}</td><td><b>Contract:</b> ${(contract || {}).contractNo || ""}<br/><b>Project:</b> ${(contract || {}).projectName || ""}<br/><b>Bill Date:</b> ${b.billDate} ${b.periodFrom ? `<br/><b>Period:</b> ${b.periodFrom} to ${b.periodTo}` : ""}${(contract || {}).workOrderNo ? `<br/><b>Client WO:</b> ${contract.workOrderNo}` : ""}${(contract || {}).woType ? `<br/><b>WO Type:</b> ${WOT[contract.woType] || contract.woType}` : ""}</td></tr></table>
  <table><tr><th>#</th><th>HSN/SAC</th><th>Item</th><th>Unit</th><th>Prev Qty</th><th>This Bill</th><th>Upto Date</th><th>Rate</th><th>GST</th><th>Amount</th></tr>${rows}
  <tr><td colspan=9 class=r>Basic Amount</td><td class=r>${inr(t.basic)}</td></tr>
  <tr><td colspan=9 class=r>Add: GST</td><td class=r>${inr(t.gst)}</td></tr>
  <tr><td colspan=9 class=r>Less: Retention (${b.retentionPct}%)</td><td class=r>${inr(t.retention)}</td></tr>
  <tr><td colspan=9 class=r>Less: Advance Recovery</td><td class=r>${inr(b.advanceRecovery)}</td></tr>
  <tr><td colspan=9 class=r>Less: Other Deduction</td><td class=r>${inr(b.otherDeduction)}</td></tr>
  <tr><td colspan=9 class=r>Less: TDS (${num(b.tdsPct)}%)</td><td class=r>${inr(t.tds)}</td></tr>
  <tr><th colspan=9 class=r>NET PAYABLE</th><th class=r>${inr(t.net)}</th></tr></table>
  <p><b>In words:</b> ${amountToWords(t.net)}</p>
  <p><b>TDS deducted:</b> ${inr(t.tds)} &nbsp; · &nbsp; <b>GST payable to Govt.:</b> ${inr(t.gstPayable)}</p>
  ${co.bankName ? `<p><b>Payment to:</b> ${co.name} · ${co.bankName}${co.bankBranch ? ", " + co.bankBranch : ""} · A/c ${co.bankAccountNo || ""} · IFSC ${co.bankIfsc || ""}</p>` : ""}
  <div class=sig><div>Prepared By<br/>${b.createdByName || ""}</div><div>Approved By (GM)<br/>${b.approvedByName || ""}</div><div>Client / Engineer-in-Charge<br/>Signature &amp; Seal</div><div>For ${co.name || ""}<br/>Authorised Signatory</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
};
