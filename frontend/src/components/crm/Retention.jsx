import React, { useState } from "react";
import { canDelete as canApprove, canDelete } from "../../lib/store";
import { Card, Grid, Field, Inp, Sel, Btn, Table, uid, today, inr, num } from "./crmShared";
import { CrmActionBar } from "./CrmActionBar";

export const retentionSummary = (data) => data.contracts.map((k) => {
  const held = data.ra_bills.filter((b) => b.contractId === k.id && Number(b.step) >= 3).reduce((s, b) => s + num(b.retentionAmt), 0);
  const released = data.retention_releases.filter((r) => r.contractId === k.id).reduce((s, r) => s + num(r.amount), 0);
  return { k, held, released, balance: +(held - released).toFixed(2) };
});

export const Retention = ({ data, save, remove }) => {
  const [f, setF] = useState({ contractId: "", date: today(), amount: 0, ref: "", remarks: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rows = retentionSummary(data);
  const onSave = async () => {
    const row = rows.find((r) => r.k.id === f.contractId);
    if (!row || !(num(f.amount) > 0)) return alert("Contract aur amount zaroori hai");
    if (num(f.amount) > row.balance) return alert(`Release ${inr(row.balance)} se zyada nahi ho sakta`);
    const out = await save("retention_releases", { ...f, id: uid("rr"), amount: num(f.amount) }, "Retention release recorded");
    if (out) setF({ ...f, amount: 0, ref: "", remarks: "" });
  };
  return (
    <>
      <CrmActionBar name="ret" status="Retention register"
        onNew={() => setF({ contractId: "", date: today(), amount: 0, ref: "", remarks: "" })} onSave={canApprove() ? onSave : null}
        list={{ title: "Retention Money Register", cols: ["Contract", "Project", "Retention %", "Held", "Released", "Balance"], rows: rows.map((r) => [r.k.contractNo, r.k.projectName, r.k.retentionPct, r.held, r.released, r.balance]) }} />
      <Card title="Retention Money Register" testid="retention-card">
        <Table testid="retention-table" cols={["Contract", "Project", "Retention %", "Held (approved bills)", "Released", "Balance with Client"]}
          rows={rows.map((r) => [r.k.contractNo, r.k.projectName, `${r.k.retentionPct}%`, inr(r.held), inr(r.released), <b data-testid={`retention-balance-${r.k.id}`}>{inr(r.balance)}</b>])} />
      </Card>
      {canApprove() && (
        <Card title="Record Retention Release (project complete hone par)" testid="retention-release-form">
          <Grid cols={5}>
            <Field label="Contract"><Sel data-testid="rr-contract" value={f.contractId} onChange={set("contractId")} options={[{ v: "", l: "— Select —" }, ...rows.map((r) => ({ v: r.k.id, l: `${r.k.contractNo} · bal ${inr(r.balance)}` }))]} /></Field>
            <Field label="Date"><Inp data-testid="rr-date" type="date" value={f.date} onChange={set("date")} /></Field>
            <Field label="Amount (₹)"><Inp data-testid="rr-amount" type="number" value={f.amount} onChange={set("amount")} /></Field>
            <Field label="UTR / Ref"><Inp data-testid="rr-ref" value={f.ref} onChange={set("ref")} /></Field>
            <Field label="Remarks"><Inp data-testid="rr-remarks" value={f.remarks} onChange={set("remarks")} /></Field>
          </Grid>
        </Card>
      )}
      <Card title="Release History">
        <Table testid="rr-table" cols={["Date", "Contract", "Amount", "Ref", "Remarks", ""]}
          rows={data.retention_releases.map((r) => [r.date, (data.contracts.find((c) => c.id === r.contractId) || {}).contractNo || "—", inr(r.amount), r.ref || "—", r.remarks || "—",
            canDelete() ? <Btn tone="red" data-testid={`rr-del-${r.id}`} onClick={() => remove("retention_releases", r.id)}>Delete</Btn> : null])} />
      </Card>
    </>
  );
};
