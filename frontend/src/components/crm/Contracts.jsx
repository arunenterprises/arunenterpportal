import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, uid, today, inr, num, nameOf, crmNextNo } from "./crmShared";
import { WorkOrderImport } from "./WorkOrderImport";
import { CrmActionBar, FormLock } from "./CrmActionBar";

const blankItem = () => ({ id: uid("it"), code: "", description: "", unit: "Cum", qty: 0, rate: 0, gstPct: 18 });
const blank = () => ({ id: "", contractNo: "", clientId: "", projectName: "", siteLocation: "", startDate: today(), completionDate: "", workOrderNo: "", workOrderDate: "", scopeOfWork: "", contractValue: 0, retentionPct: 5, tdsPct: 2, advanceAmount: 0, advanceRecoveryPct: 10, items: [blankItem()], newClient: null, woFileName: "", woFileData: "" });
export const itemsValue = (items) => (items || []).reduce((s, i) => s + num(i.qty) * num(i.rate), 0);

export const Contracts = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setItem = (id, k, v) => setF({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, [k]: v } : i)) });
  const applyWO = (p, file, dataUrl) => {
    const nm = String(p.clientName || "").trim().toLowerCase();
    const match = nm && data.clients.find((c) => c.name.toLowerCase().includes(nm) || nm.includes(c.name.toLowerCase()) || (p.clientGst && c.gst === p.clientGst));
    const items = (p.items || []).filter((i) => i.description).map((i) => ({ ...blankItem(), code: i.code || "", description: i.description, unit: i.unit || "Nos", qty: num(i.qty), rate: num(i.rate), gstPct: num(i.gstPct) || num(p.defaultGstPct) || 18 }));
    setF((x) => ({
      ...x,
      clientId: match ? match.id : x.clientId,
      newClient: !match && p.clientName ? { name: p.clientName, address: p.clientAddress || "", gst: p.clientGst || "", pan: p.clientPan || "", contactPerson: p.contactPerson || "", mobile: p.clientMobile || "", email: p.clientEmail || "" } : null,
      projectName: p.projectName || x.projectName, siteLocation: p.siteLocation || x.siteLocation,
      startDate: p.startDate || x.startDate, completionDate: p.completionDate || x.completionDate,
      workOrderNo: p.workOrderNo || x.workOrderNo, workOrderDate: p.workOrderDate || x.workOrderDate, scopeOfWork: p.scopeOfWork || x.scopeOfWork,
      contractValue: num(p.contractValue) || itemsValue(items), retentionPct: num(p.retentionPct) || x.retentionPct,
      advanceAmount: num(p.advanceAmount) || x.advanceAmount, advanceRecoveryPct: num(p.advanceRecoveryPct) || x.advanceRecoveryPct,
      items: items.length ? items : x.items,
      woFileName: file.size <= 2 * 1024 * 1024 ? file.name : "", woFileData: file.size <= 2 * 1024 * 1024 ? dataUrl : "",
    }));
  };
  const onSave = async () => {
    let clientId = f.clientId;
    if (!clientId && f.newClient) {
      const c = await save("clients", { id: uid("cl"), tempRefId: `TMP-CL-${Date.now().toString().slice(-6)}`, step: 1, clientCode: "", ...f.newClient }, `Naya client "${f.newClient.name}" bana`);
      if (!c) return;
      clientId = c.id;
    }
    if (!clientId || !f.projectName.trim()) return alert("Client aur Project name zaroori hai");
    const rec = { ...f, clientId, newClient: null, id: f.id || uid("ct"), contractNo: f.contractNo || await crmNextNo("contract", "CT/") };
    if (!num(rec.contractValue)) rec.contractValue = itemsValue(rec.items);
    const out = await save("contracts", rec, `Contract ${rec.contractNo} saved`);
    if (out) { setF(out); setEditing(false); }
  };
  const clientOpts = [{ v: "", l: "— Select client —" }, ...data.clients.map((c) => ({ v: c.id, l: `${c.clientCode || c.tempRefId || ""} · ${c.name}` }))];
  return (
    <>
      <CrmActionBar name="contract" status={f.id ? `${f.contractNo} · ${editing ? "Editing" : "View"}` : "New contract"}
        onNew={() => { setF(blank()); setEditing(true); }} onSave={editing ? onSave : null} onEdit={f.id && !editing ? () => setEditing(true) : null}
        onDelete={f.id ? async () => { if (await remove("contracts", f.id)) setF(blank()); } : null}
        list={{ title: "Contract Register", cols: ["Contract No", "Client WO", "Client", "Project", "Value", "Retention %", "TDS %", "Items"], rows: data.contracts.map((k) => [k.contractNo, k.workOrderNo, nameOf(data.clients, k.clientId), k.projectName, num(k.contractValue), k.retentionPct, k.tdsPct, (k.items || []).length]) }} />
      <Card testid="contract-form" title={f.id ? `Contract · ${f.contractNo}` : "New Contract / Work Order"}>
        <FormLock editing={editing}>
        {!f.id && <WorkOrderImport onApply={applyWO} />}
        <Grid cols={4}>
          <Field label="Client *">
            <Sel data-testid="contract-client" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value, newClient: e.target.value ? null : f.newClient })} options={clientOpts} />
            {!f.clientId && f.newClient && <span data-testid="contract-new-client-note" style={{ fontSize: 11, color: "#0891b2", fontWeight: 700 }}>Naya client save par banega: {f.newClient.name}</span>}
          </Field>
          <Field label="Project Name *"><Inp data-testid="contract-project" value={f.projectName} onChange={set("projectName")} /></Field>
          <Field label="Site Location"><Inp data-testid="contract-site" value={f.siteLocation} onChange={set("siteLocation")} /></Field>
          <Field label="Start Date"><Inp data-testid="contract-start" type="date" value={f.startDate} onChange={set("startDate")} /></Field>
          <Field label="Contract Value (₹)"><Inp data-testid="contract-value" type="number" value={f.contractValue} onChange={set("contractValue")} placeholder="blank = items total" /></Field>
          <Field label="Retention %"><Inp data-testid="contract-retention" type="number" value={f.retentionPct} onChange={set("retentionPct")} /></Field>
          <Field label="Mobilization Advance (₹)"><Inp data-testid="contract-advance" type="number" value={f.advanceAmount} onChange={set("advanceAmount")} /></Field>
          <Field label="Advance Recovery % / bill"><Inp data-testid="contract-adv-rec" type="number" value={f.advanceRecoveryPct} onChange={set("advanceRecoveryPct")} /></Field>
          <Field label="Client WO No"><Inp data-testid="contract-wo-no" value={f.workOrderNo} onChange={set("workOrderNo")} /></Field>
          <Field label="TDS % (194C)"><Inp data-testid="contract-tds-pct" type="number" value={f.tdsPct ?? 2} onChange={set("tdsPct")} /></Field>
          <Field label="WO Date"><Inp data-testid="contract-wo-date" type="date" value={f.workOrderDate} onChange={set("workOrderDate")} /></Field>
          <Field label="Completion Date"><Inp data-testid="contract-completion" type="date" value={f.completionDate} onChange={set("completionDate")} /></Field>
          <Field label="WO File">{f.woFileData ? <a data-testid="contract-wo-file" href={f.woFileData} download={f.woFileName} style={{ fontSize: 12, paddingTop: 6 }}>{f.woFileName}</a> : <span style={{ fontSize: 12, color: "#94a3b8", paddingTop: 6 }}>—</span>}</Field>
          <Field label="Scope of Work" span={4}><Inp data-testid="contract-scope" value={f.scopeOfWork} onChange={set("scopeOfWork")} /></Field>
        </Grid>
        <div style={{ marginTop: 14, fontSize: 11, fontWeight: 800 }}>CONTRACT ITEMS (BOQ RATES)</div>
        <Table testid="contract-items-table" cols={["Item Code", "Description", "Unit", "BOQ Qty", "Rate", "GST %", "Amount", ""]}
          rows={f.items.map((i) => [
            <Inp value={i.code} onChange={(e) => setItem(i.id, "code", e.target.value)} style={{ width: 80 }} />,
            <Inp data-testid="contract-item-desc" value={i.description} onChange={(e) => setItem(i.id, "description", e.target.value)} style={{ minWidth: 200 }} />,
            <Inp value={i.unit} onChange={(e) => setItem(i.id, "unit", e.target.value)} style={{ width: 70 }} />,
            <Inp data-testid="contract-item-qty" type="number" value={i.qty} onChange={(e) => setItem(i.id, "qty", e.target.value)} style={{ width: 90 }} />,
            <Inp data-testid="contract-item-rate" type="number" value={i.rate} onChange={(e) => setItem(i.id, "rate", e.target.value)} style={{ width: 100 }} />,
            <Inp data-testid="contract-item-gst" type="number" value={i.gstPct} onChange={(e) => setItem(i.id, "gstPct", e.target.value)} style={{ width: 70 }} />,
            inr(num(i.qty) * num(i.rate)) + (i.fromCO ? " (CO)" : ""),
            <Btn tone="red" onClick={() => setF({ ...f, items: f.items.filter((x) => x.id !== i.id) })}><Trash2 size={12} /></Btn>,
          ])} />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Btn tone="ghost" data-testid="contract-add-item" onClick={() => setF({ ...f, items: [...f.items, blankItem()] })}><Plus size={13} /> Add Item</Btn>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Items Total: {inr(itemsValue(f.items))}</span>
        </div>
        </FormLock>
      </Card>
      <Card title={`Contracts (${data.contracts.length})`}>
        <Table testid="contracts-table" cols={["Contract No", "Client WO", "Client", "Project", "Value", "Retention %", "Items", "Actions"]}
          rows={data.contracts.map((k) => [k.contractNo, k.workOrderNo || "—", nameOf(data.clients, k.clientId), k.projectName, inr(k.contractValue), `${k.retentionPct}%`, (k.items || []).length,
            <div style={{ display: "flex", gap: 6 }}>
              <Btn tone="ghost" data-testid={`contract-edit-${k.id}`} onClick={() => { setF({ ...blank(), ...k }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open</Btn>
              {canDelete() && <Btn tone="red" data-testid={`contract-del-${k.id}`} onClick={() => remove("contracts", k.id)}><Trash2 size={13} /></Btn>}
            </div>])} />
      </Card>
    </>
  );
};
