import React, { useState } from "react";
import { Send, CheckCircle2, Trash2 } from "lucide-react";
import { canDelete as canApprove, canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, STEP_WF, stepTone, uid, today, num } from "./crmShared";
import { RenumberBtn } from "./ResetNumberingBtn";
import { CrmActionBar } from "./CrmActionBar";

const blank = (contractId = "") => ({ id: "", mbNo: "", contractId, itemId: "", date: today(), location: "", nos: 1, l: 0, b: 0, h: 0, manualQty: "", remarks: "", step: 1, raBillId: "" });
export const mbQty = (m) => (m.manualQty !== "" && m.manualQty != null ? num(m.manualQty) : +(num(m.nos || 1) * (num(m.l) || 1) * (num(m.b) || 1) * (num(m.h) || 1)).toFixed(3));

export const MBook = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const [bulk, setBulk] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const contract = data.contracts.find((c) => c.id === f.contractId);
  const items = contract?.items || [];
  const item = items.find((i) => i.id === f.itemId);

  const persist = async (rec, msg) => {
    const r = { ...rec, id: rec.id || uid("mb"), qty: mbQty(rec), unit: item?.unit || rec.unit, itemDesc: item?.description || rec.itemDesc };
    const out = await save("mb", r, msg);
    if (out) { setF(out); setEditing(false); }
  };
  const onSave = () => {
    if (!f.contractId || !f.itemId) return alert("Contract aur Item select karein");
    if (!(mbQty(f) > 0)) return alert("Quantity 0 se zyada honi chahiye");
    persist(f, "MB entry saved");
  };
  const advance = async (m, step) => { const o = await save("mb", { ...m, step }, step === 3 ? `${m.mbNo} approved` : `${m.mbNo} submitted`); if (o && o.id === f.id) setF(o); };
  const pickContract = (id) => {
    setF({ ...f, contractId: id, itemId: "" });
    const c = data.contracts.find((x) => x.id === id);
    setBulk(Object.fromEntries((c?.items || []).map((i) => [i.id, { on: true, qty: "" }])));
  };
  const mbSum = (itemId) => data.mb.filter((m) => m.contractId === f.contractId && m.itemId === itemId).reduce((s, m) => s + num(m.qty), 0);
  const doneQty = (itemId) => num((items.find((i) => i.id === itemId) || {}).prevClaimQty) + mbSum(itemId);
  const prevOf = (i) => (bulk[i.id]?.prev ?? "") !== "" ? num(bulk[i.id].prev) : doneQty(i.id);
  const saveBulk = async () => {
    const pick = items.filter((i) => bulk[i.id]?.on && num(bulk[i.id]?.qty) > 0);
    const prevChanged = items.filter((i) => (bulk[i.id]?.prev ?? "") !== "" && num(bulk[i.id].prev) !== doneQty(i.id));
    if (!pick.length && !prevChanged.length) return alert("Tick kiye items mein Qty bharein (0 se zyada)");
    setBusy(true);
    if (prevChanged.length) {
      const nextItems = items.map((i) => (prevChanged.includes(i) ? { ...i, prevClaimQty: +(num(bulk[i.id].prev) - mbSum(i.id)).toFixed(3) } : i));
      await save("contracts", { ...contract, items: nextItems }, null);
    }
    for (const i of pick) {
      const rec = { ...blank(f.contractId), date: f.date, location: f.location, itemId: i.id, manualQty: bulk[i.id].qty };
      await save("mb", { ...rec, id: uid("mb"), qty: num(bulk[i.id].qty), unit: i.unit, itemDesc: i.description }, null);
    }
    setBusy(false);
    setBulk(Object.fromEntries(items.map((i) => [i.id, { on: true, qty: "" }])));
    alert(`${pick.length} MB entries save ho gayi${prevChanged.length ? ` · ${prevChanged.length} items ki Previous Claim Qty update hui` : ""}`);
  };

  const contractOpts = [{ v: "", l: "— Select contract —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.contractNo} · ${c.projectName}` }))];
  const itemOpts = [{ v: "", l: "— Select item —" }, ...items.map((i) => ({ v: i.id, l: `${i.code ? i.code + " · " : ""}${i.description} (${i.unit})` }))];
  const locked = Number(f.step) > 1 || !editing;
  const st = Number(f.step);

  return (
    <>
      <CrmActionBar name="mb" status={f.id ? `${f.mbNo} · ${STEP_WF[f.step]}${f.raBillId ? " · Billed" : ""}` : "New MB entry"}
        labels={{ submit: "Submit to GM" }}
        onNew={() => { setF(blank(f.contractId)); setEditing(true); }} onSave={editing && st === 1 ? onSave : null}
        onEdit={f.id && !editing && st === 1 ? () => setEditing(true) : null}
        onSubmit={f.id && st === 1 ? () => advance(f, 2) : null} onApprove={f.id && st === 2 ? () => advance(f, 3) : null}
        onDelete={f.id && !f.raBillId ? async () => { if (await remove("mb", f.id)) setF(blank(f.contractId)); } : null}
        list={{ title: "Measurement Book", cols: ["MB No", "Date", "Contract", "Item", "Location", "Nos", "L", "B", "H", "Qty", "Unit", "Status"], rows: data.mb.map((m) => [m.mbNo, m.date, (data.contracts.find((c) => c.id === m.contractId) || {}).contractNo, m.itemDesc, m.location, m.nos, m.l, m.b, m.h, m.qty, m.unit, STEP_WF[m.step]]) }} />
      <Card testid="mb-form" title={f.id ? `MB Entry · ${f.mbNo} · ${STEP_WF[f.step]}` : "Measurement Book Entry"}>
        <Grid cols={4}>
          <Field label="Contract *"><Sel data-testid="mb-contract" disabled={locked} value={f.contractId} onChange={(e) => pickContract(e.target.value)} options={contractOpts} /></Field>
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
          {item && (() => { const done = data.mb.filter((m) => m.contractId === f.contractId && m.itemId === f.itemId && m.id !== f.id).reduce((s, m) => s + num(m.qty), 0); return (
            <span data-testid="mb-item-info" style={{ fontSize: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "4px 10px" }}>
              WO: <b>{contract.workOrderNo || contract.contractNo}</b> · HSN/SAC: <b>{item.code || "—"}</b> · Rate: <b>₹{num(item.rate)}</b> · BOQ Qty: <b>{num(item.qty)} {item.unit}</b> · Pehle napa: <b>{+done.toFixed(3)}</b> · Balance: <b style={{ color: num(item.qty) - done - mbQty(f) < 0 ? "#dc2626" : "#166534" }}>{+(num(item.qty) - done - mbQty(f)).toFixed(3)}</b>
            </span>); })()}
        </div>
      </Card>
      {!f.id && contract && items.length > 0 && (
        <Card testid="mb-bulk" title={`Sabhi Items · ${contract.workOrderNo || contract.contractNo} · jo is baar claim nahi karna uska tick hata dein`}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Btn tone="ghost" data-testid="mb-bulk-all" onClick={() => setBulk(Object.fromEntries(items.map((i) => [i.id, { ...bulk[i.id], on: true }])))}>Select All</Btn>
            <Btn tone="ghost" data-testid="mb-bulk-none" onClick={() => setBulk(Object.fromEntries(items.map((i) => [i.id, { ...bulk[i.id], on: false }])))}>Deselect All</Btn>
            <Btn tone="dark" data-testid="mb-bulk-save" disabled={busy} onClick={saveBulk}>{busy ? "Saving…" : `Save Selected (${items.filter((i) => bulk[i.id]?.on).length}) as MB`}</Btn>
          </div>
          <Table testid="mb-bulk-table" cols={["", "Sr No", "PO Pos", "Item Code", "Description", "Unit", "Rate", "BOQ Qty", "Previous Claim Qty", "Is baar Qty", "Balance"]}
            rows={items.map((i, k) => { const b = bulk[i.id] || { on: true, qty: "" }; const d = prevOf(i); return [
              <input type="checkbox" data-testid={`mb-bulk-chk-${i.id}`} checked={!!b.on} onChange={(e) => setBulk({ ...bulk, [i.id]: { ...b, on: e.target.checked } })} />,
              <span data-testid={`mb-bulk-sr-${i.id}`}>{i.srNo || k + 1}</span>, <span data-testid={`mb-bulk-pos-${i.id}`}>{i.poPos || k + 1}</span>, i.itemCode || "—", i.description, i.unit, `₹${num(i.rate)}`, num(i.qty),
              <Inp data-testid={`mb-bulk-prev-${i.id}`} type="number" value={b.prev ?? +doneQty(i.id).toFixed(3)} onChange={(e) => setBulk({ ...bulk, [i.id]: { ...b, prev: e.target.value } })} style={{ width: 90 }} />,
              <Inp data-testid={`mb-bulk-qty-${i.id}`} type="number" disabled={!b.on} value={b.qty} onChange={(e) => setBulk({ ...bulk, [i.id]: { ...b, qty: e.target.value } })} style={{ width: 90 }} />,
              <b data-testid={`mb-bulk-bal-${i.id}`} style={{ color: num(i.qty) - d - num(b.on ? b.qty : 0) < 0 ? "#b91c1c" : "#166534" }}>{+(num(i.qty) - d - num(b.on ? b.qty : 0)).toFixed(3)}</b>]; })} />
        </Card>
      )}
      <Card title={`Measurement Book (${data.mb.length})`} right={<RenumberBtn target="mb" label="Measurement Book" />}>
        <Table testid="mb-table" cols={["MB No", "Date", "Contract", "Item", "Location", "Qty", "Status", "Billed", "Actions"]}
          rows={data.mb.slice().reverse().map((m) => [m.mbNo, m.date, (data.contracts.find((c) => c.id === m.contractId) || {}).contractNo || "—", m.itemDesc, m.location || "—", `${m.qty} ${m.unit || ""}`,
            <Badge text={STEP_WF[m.step]} tone={stepTone(m.step)} />, m.raBillId ? <Badge text="Billed" tone="green" /> : "—",
            <div style={{ display: "flex", gap: 6 }}>
              <Btn tone="ghost" data-testid={`mb-view-${m.id}`} onClick={() => { setF({ ...blank(), ...m }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open</Btn>
              {Number(m.step) === 1 && <Btn tone="dark" data-testid={`mb-submit-${m.id}`} onClick={() => advance(m, 2)}><Send size={12} /> Submit</Btn>}
              {Number(m.step) === 2 && canApprove() && <Btn tone="green" data-testid={`mb-approve-${m.id}`} onClick={() => advance(m, 3)}><CheckCircle2 size={12} /> Approve</Btn>}
              {canDelete() && !m.raBillId && <Btn tone="red" data-testid={`mb-del-${m.id}`} onClick={() => remove("mb", m.id)}><Trash2 size={12} /></Btn>}
            </div>])} />
      </Card>
    </>
  );
};
