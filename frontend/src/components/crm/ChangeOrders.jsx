import React, { useState } from "react";
import { Send, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { canDelete as canApprove, canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, STEP_WF, stepTone, uid, today, inr, num, crmNextNo, crmSave } from "./crmShared";
import { CrmActionBar } from "./CrmActionBar";
import HsnInput from "../HsnInput";

const blank = () => ({ id: "", coNo: "", contractId: "", date: today(), description: "", reason: "", unit: "Nos", qty: 0, rate: 0, gstPct: 18, step: 1 });

export const ChangeOrders = ({ data, save, remove, reload }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const locked = Number(f.step) > 1 || !editing;
  const value = num(f.qty) * num(f.rate);

  const persist = async (rec, msg) => {
    const r = { ...rec, id: rec.id || uid("co"), coNo: rec.coNo || await crmNextNo("co", "CO/"), value: num(rec.qty) * num(rec.rate) };
    const out = await save("change_orders", r, msg);
    if (out) { setF(out); setEditing(false); }
    return out;
  };
  const onSave = () => {
    if (!f.contractId || !f.description.trim() || !(value > 0)) return alert("Contract, description, qty aur rate zaroori hai");
    persist(f, "Change order saved");
  };
  const approve = async (co) => {
    const out = await persist({ ...co, step: 3 }, `${co.coNo} approved`);
    if (!out) return;
    const k = data.contracts.find((c) => c.id === co.contractId);
    if (!k || (k.items || []).some((i) => i.coId === co.id)) return;
    const item = { id: uid("it"), code: co.hsn || co.coNo, description: `[Extra] ${co.description}`, unit: co.unit, qty: num(co.qty), rate: num(co.rate), gstPct: num(co.gstPct), fromCO: true, coId: co.id };
    try {
      await crmSave("contracts", { ...k, items: [...(k.items || []), item] });
      await reload();
      toast.success("Extra item contract mein jud gaya · ab MB entry karke RA Bill mein le sakte hain");
    } catch (e) { toast.error(e.message); }
  };

  const contractOpts = [{ v: "", l: "— Select contract —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.contractNo} · ${c.projectName}` }))];
  return (
    <>
      <CrmActionBar name="co" status={f.id ? `${f.coNo} · ${STEP_WF[f.step]}` : "New change order"}
        labels={{ submit: "Submit to GM" }}
        onNew={() => { setF(blank()); setEditing(true); }} onSave={editing && Number(f.step) === 1 ? onSave : null}
        onEdit={f.id && !editing && Number(f.step) === 1 ? () => setEditing(true) : null}
        onSubmit={f.id && Number(f.step) === 1 ? () => persist({ ...f, step: 2 }, `${f.coNo} submitted`) : null}
        onApprove={f.id && Number(f.step) === 2 ? () => approve(f) : null}
        onDelete={f.id && Number(f.step) < 3 ? async () => { if (await remove("change_orders", f.id)) setF(blank()); } : null}
        list={{ title: "Change Order Register", cols: ["CO No", "Date", "Contract", "Description", "Reason", "Unit", "Qty", "Rate", "GST %", "Value", "Status"], rows: data.change_orders.map((c) => [c.coNo, c.date, (data.contracts.find((k) => k.id === c.contractId) || {}).contractNo, c.description, c.reason, c.unit, c.qty, c.rate, c.gstPct, num(c.value), STEP_WF[c.step]]) }} />
      <Card testid="co-form" title={f.id ? `Change Order · ${f.coNo} · ${STEP_WF[f.step]}` : "New Change Order / Extra Work"}>
        <Grid cols={4}>
          <Field label="Contract *"><Sel data-testid="co-contract" disabled={locked} value={f.contractId} onChange={set("contractId")} options={contractOpts} /></Field>
          <Field label="Date"><Inp data-testid="co-date" type="date" disabled={locked} value={f.date} onChange={set("date")} /></Field>
          <Field label="Extra Work Description *" span={2}><Inp data-testid="co-desc" disabled={locked} value={f.description} onChange={set("description")} /></Field>
          <Field label="Client Demand / Reason" span={2}><Inp data-testid="co-reason" disabled={locked} value={f.reason} onChange={set("reason")} /></Field>
          <Field label="Unit"><Inp data-testid="co-unit" disabled={locked} value={f.unit} onChange={set("unit")} /></Field>
          <Field label="HSN / SAC"><HsnInput value={f.hsn} disabled={locked} testid="co-hsn" onChange={(v) => setF({ ...f, hsn: v })} onPick={(code, rec) => setF({ ...f, hsn: code, gstPct: rec.gst })} /></Field>
          <Field label="Qty (budget)"><Inp data-testid="co-qty" type="number" disabled={locked} value={f.qty} onChange={set("qty")} /></Field>
          <Field label="Rate (₹)"><Inp data-testid="co-rate" type="number" disabled={locked} value={f.rate} onChange={set("rate")} /></Field>
          <Field label="GST %"><Inp data-testid="co-gst" type="number" disabled={locked} value={f.gstPct} onChange={set("gstPct")} /></Field>
          <Field label="Budget Value"><div data-testid="co-value" style={{ fontWeight: 800, paddingTop: 6 }}>{inr(value)}</div></Field>
        </Grid>
      </Card>
      <Card title={`Change Orders (${data.change_orders.length})`}>
        <Table testid="co-table" cols={["CO No", "Date", "Contract", "Description", "Value", "Status", "Actions"]}
          rows={data.change_orders.slice().reverse().map((c) => [c.coNo, c.date, (data.contracts.find((k) => k.id === c.contractId) || {}).contractNo || "—", c.description, inr(c.value),
            <Badge text={STEP_WF[c.step]} tone={stepTone(c.step)} />,
            <div style={{ display: "flex", gap: 6 }}>
              <Btn tone="ghost" data-testid={`co-view-${c.id}`} onClick={() => { setF({ ...blank(), ...c }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open</Btn>
              {Number(c.step) === 1 && <Btn tone="dark" data-testid={`co-submit-${c.id}`} onClick={() => persist({ ...c, step: 2 }, `${c.coNo} submitted`)}><Send size={12} /> Submit</Btn>}
              {Number(c.step) === 2 && canApprove() && <Btn tone="green" data-testid={`co-approve-${c.id}`} onClick={() => approve(c)}><CheckCircle2 size={12} /> Approve</Btn>}
              {canDelete() && Number(c.step) < 3 && <Btn tone="red" data-testid={`co-del-${c.id}`} onClick={() => remove("change_orders", c.id)}><Trash2 size={12} /></Btn>}
            </div>])} />
      </Card>
    </>
  );
};
