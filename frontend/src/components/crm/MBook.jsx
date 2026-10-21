import React, { useState } from "react";
import { Save, Send, CheckCircle2, Trash2, Plus } from "lucide-react";
import { canApprove, canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, STEP_WF, stepTone, uid, today, num, crmNextNo } from "./crmShared";

const blank = (contractId = "") => ({ id: "", mbNo: "", contractId, itemId: "", date: today(), location: "", nos: 1, l: 0, b: 0, h: 0, manualQty: "", remarks: "", step: 1, raBillId: "" });
export const mbQty = (m) => (m.manualQty !== "" && m.manualQty != null ? num(m.manualQty) : +(num(m.nos || 1) * (num(m.l) || 1) * (num(m.b) || 1) * (num(m.h) || 1)).toFixed(3));

export const MBook = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const contract = data.contracts.find((c) => c.id === f.contractId);
  const items = contract?.items || [];
  const item = items.find((i) => i.id === f.itemId);

  const persist = async (rec, msg) => {
    const r = { ...rec, id: rec.id || uid("mb"), mbNo: rec.mbNo || await crmNextNo("mb", "MB/"), qty: mbQty(rec), unit: item?.unit || rec.unit, itemDesc: item?.description || rec.itemDesc };
    const out = await save("mb", r, msg);
    if (out) setF(out);
  };
  const onSave = () => {
    if (!f.contractId || !f.itemId) return alert("Contract aur Item select karein");
    if (!(mbQty(f) > 0)) return alert("Quantity 0 se zyada honi chahiye");
    persist(f, "MB entry saved");
  };
  const advance = (m, step) => save("mb", { ...m, step }, step === 3 ? `${m.mbNo} approved` : `${m.mbNo} submitted`);

  const contractOpts = [{ v: "", l: "— Select contract —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.contractNo} · ${c.projectName}` }))];
  const itemOpts = [{ v: "", l: "— Select item —" }, ...items.map((i) => ({ v: i.id, l: `${i.code ? i.code + " · " : ""}${i.description} (${i.unit})` }))];
  const locked = Number(f.step) > 1;

  return (
    <>
      <Card testid="mb-form" title={f.id ? `MB Entry · ${f.mbNo} · ${STEP_WF[f.step]}` : "Measurement Book Entry"} right={<Btn tone="ghost" data-testid="mb-new-btn" onClick={() => setF(blank(f.contractId))}><Plus size={14} /> New</Btn>}>
        <Grid cols={4}>
          <Field label="Contract *"><Sel data-testid="mb-contract" disabled={locked} value={f.contractId} onChange={(e) => setF({ ...f, contractId: e.target.value, itemId: "" })} options={contractOpts} /></Field>
          <Field label="Item *" span={2}><Sel data-testid="mb-item" disabled={locked} value={f.itemId} onChange={set("itemId")} options={itemOpts} /></Field>
          <Field label="Date"><Inp data-testid="mb-date" type="date" disabled={locked} value={f.date} onChange={set("date")} /></Field>
          <Field label="Location / Chainage"><Inp data-testid="mb-location" disabled={locked} value={f.location} onChange={set("location")} /></Field>
          <Field label="Nos"><Inp data-testid="mb-nos" type="number" disabled={locked} value={f.nos} onChange={set("nos")} /></Field>
          <Field label="Length (L)"><Inp data-testid="mb-l" type="number" disabled={locked} value={f.l} onChange={set("l")} /></Field>
          <Field label="Breadth (B)"><Inp data-testid="mb-b" type="number" disabled={locked} value={f.b} onChange={set("b")} /></Field>
          <Field label="Height / Depth (H)"><Inp data-testid="mb-h" type="number" disabled={locked} value={f.h} onChange={set("h")} /></Field>
          <Field label="Direct Qty (optional)"><Inp data-testid="mb-manual-qty" type="number" disabled={locked} value={f.manualQty} onChange={set("manualQty")} placeholder="L×B×H ki jagah" /></Field>
          <Field label="Remarks" span={2}><Inp data-testid="mb-remarks" disabled={locked} value={f.remarks} onChange={set("remarks")} /></Field>
        </Grid>
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span data-testid="mb-qty-display" style={{ fontWeight: 800, fontSize: 13 }}>Quantity: {mbQty(f)} {item?.unit || ""}</span>
          {!locked && <Btn data-testid="mb-save-btn" onClick={onSave}><Save size={14} /> Save</Btn>}
        </div>
      </Card>
      <Card title={`Measurement Book (${data.mb.length})`}>
        <Table testid="mb-table" cols={["MB No", "Date", "Contract", "Item", "Location", "Qty", "Status", "Billed", "Actions"]}
          rows={data.mb.slice().reverse().map((m) => [m.mbNo, m.date, (data.contracts.find((c) => c.id === m.contractId) || {}).contractNo || "—", m.itemDesc, m.location || "—", `${m.qty} ${m.unit || ""}`,
            <Badge text={STEP_WF[m.step]} tone={stepTone(m.step)} />, m.raBillId ? <Badge text="Billed" tone="green" /> : "—",
            <div style={{ display: "flex", gap: 6 }}>
              <Btn tone="ghost" data-testid={`mb-view-${m.id}`} onClick={() => setF({ ...blank(), ...m })}>View</Btn>
              {Number(m.step) === 1 && <Btn tone="dark" data-testid={`mb-submit-${m.id}`} onClick={() => advance(m, 2)}><Send size={12} /> Submit</Btn>}
              {Number(m.step) === 2 && canApprove() && <Btn tone="green" data-testid={`mb-approve-${m.id}`} onClick={() => advance(m, 3)}><CheckCircle2 size={12} /> Approve</Btn>}
              {canDelete() && !m.raBillId && <Btn tone="red" data-testid={`mb-del-${m.id}`} onClick={() => remove("mb", m.id)}><Trash2 size={12} /></Btn>}
            </div>])} />
      </Card>
    </>
  );
};
