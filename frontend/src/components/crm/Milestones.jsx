import React, { useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, uid, today, inr, num, crmNextNo, crmSave } from "./crmShared";
import { CrmActionBar } from "./CrmActionBar";

const blank = (contractId = "") => ({ id: "", contractId, title: "", pct: 0, dueDate: "", gstPct: 18, done: false, doneDate: "", billId: "" });

export const Milestones = ({ data, save, remove, reload }) => {
  const [f, setF] = useState(blank());
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const contract = data.contracts.find((c) => c.id === f.contractId);
  const list = data.milestones.filter((m) => !f.contractId || m.contractId === f.contractId);
  const usedPct = data.milestones.filter((m) => m.contractId === f.contractId && m.id !== f.id).reduce((s, m) => s + num(m.pct), 0);

  const onSave = async () => {
    if (!f.contractId || !f.title.trim() || !(num(f.pct) > 0)) return alert("Contract, title aur % zaroori hai");
    if (usedPct + num(f.pct) > 100) return alert(`Total milestones 100% se zyada nahi ho sakte (abhi ${usedPct}%)`);
    const out = await save("milestones", { ...f, id: f.id || uid("ms") }, "Milestone saved");
    if (out) setF(blank(f.contractId));
  };

  const complete = async (m) => {
    const k = data.contracts.find((c) => c.id === m.contractId);
    if (!k) return;
    if (!window.confirm(`"${m.title}" complete mark karein? Milestone bill draft ban jayega.`)) return;
    const amount = +(num(k.contractValue) * num(m.pct) / 100).toFixed(2);
    const billId = uid("ra");
    const raNo = await crmNextNo(`ra_${k.id}`, `RA/${k.contractNo}/`, 2);
    const line = { itemId: `ms_${m.id}`, code: "MS", description: `Milestone: ${m.title} (${m.pct}%)`, unit: "LS", rate: amount, gstPct: num(m.gstPct), prevQty: 0, curQty: 1 };
    const gst = +(amount * num(m.gstPct) / 100).toFixed(2);
    const ret = +(amount * num(k.retentionPct) / 100).toFixed(2);
    const tdsPct = k.tdsPct ?? 2;
    const tds = +(amount * num(tdsPct) / 100).toFixed(2);
    try {
      await crmSave("ra_bills", { id: billId, raNo, type: "Milestone", contractId: k.id, clientId: k.clientId, billDate: today(), lines: [line], mbIds: [], retentionPct: num(k.retentionPct), tdsPct, advanceRecovery: 0, otherDeduction: 0, step: 1, basic: amount, gstTotal: gst, gross: amount + gst, retentionAmt: ret, tdsAmt: tds, gstPayable: gst, net: +(amount + gst - ret - tds).toFixed(2), milestoneId: m.id });
      await crmSave("milestones", { ...m, done: true, doneDate: today(), billId });
      await reload();
      toast.success(`Milestone complete · Bill ${raNo} draft bana (RA Bills tab mein)`);
    } catch (e) { toast.error(e.message); }
  };

  const contractOpts = [{ v: "", l: "— Select contract —" }, ...data.contracts.map((c) => ({ v: c.id, l: `${c.contractNo} · ${c.projectName}` }))];
  return (
    <>
      <CrmActionBar name="ms" status={f.id ? `${f.title} · ${f.done ? "Done" : "Pending"}` : "New milestone"}
        labels={{ approve: "Complete & Bill" }}
        onNew={() => setF(blank(f.contractId))} onSave={!f.done ? onSave : null}
        onApprove={f.id && !f.done ? async () => { await complete(f); setF(blank(f.contractId)); } : null}
        onDelete={f.id && !f.done ? async () => { if (await remove("milestones", f.id)) setF(blank(f.contractId)); } : null}
        list={{ title: "Milestone Plan", cols: ["Contract", "Milestone", "%", "Amount", "GST %", "Target", "Status"], rows: list.map((m) => { const k = data.contracts.find((c) => c.id === m.contractId) || {}; return [k.contractNo, m.title, m.pct, num(k.contractValue) * num(m.pct) / 100, m.gstPct, m.dueDate, m.done ? `Done ${m.doneDate}` : "Pending"]; }) }} />
      <Card testid="ms-form" title="Milestone Billing Plan">
        <Grid cols={5}>
          <Field label="Contract *"><Sel data-testid="ms-contract" value={f.contractId} onChange={set("contractId")} options={contractOpts} /></Field>
          <Field label="Milestone *"><Inp data-testid="ms-title" value={f.title} onChange={set("title")} placeholder="Foundation / First floor" /></Field>
          <Field label="% of Contract *"><Inp data-testid="ms-pct" type="number" value={f.pct} onChange={set("pct")} /></Field>
          <Field label="GST %"><Inp data-testid="ms-gst" type="number" value={f.gstPct} onChange={set("gstPct")} /></Field>
          <Field label="Target Date"><Inp data-testid="ms-due" type="date" value={f.dueDate} onChange={set("dueDate")} /></Field>
        </Grid>
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {contract && <span style={{ fontSize: 12 }}>Contract value {inr(contract.contractValue)} · planned {usedPct + num(f.pct)}%</span>}
        </div>
      </Card>
      <Card title="Milestones">
        <Table testid="ms-table" cols={["Contract", "Milestone", "%", "Amount", "Target", "Status", "Actions"]}
          rows={list.map((m) => {
            const k = data.contracts.find((c) => c.id === m.contractId) || {};
            return [k.contractNo || "—", m.title, `${m.pct}%`, inr(num(k.contractValue) * num(m.pct) / 100), m.dueDate || "—",
              m.done ? <Badge text={`Done ${m.doneDate}`} tone="green" /> : <Badge text="Pending" tone="amber" />,
              <div style={{ display: "flex", gap: 6 }}>
                {!m.done && <Btn tone="green" data-testid={`ms-complete-${m.id}`} onClick={() => complete(m)}><CheckCircle2 size={12} /> Complete & Bill</Btn>}
                {!m.done && <Btn tone="ghost" data-testid={`ms-edit-${m.id}`} onClick={() => setF({ ...blank(), ...m })}>Edit</Btn>}
                {canDelete() && !m.done && <Btn tone="red" data-testid={`ms-del-${m.id}`} onClick={() => remove("milestones", m.id)}><Trash2 size={12} /></Btn>}
              </div>];
          })} />
      </Card>
    </>
  );
};
