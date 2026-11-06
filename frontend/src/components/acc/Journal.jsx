import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Send, Ban } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, inr, num } from "../crm/crmShared";
import { accGet, accPost, accOpts, accLabel, today } from "./accShared";
import { can } from "../../lib/acl";

const line = () => ({ accountId: "", side: "Dr", amount: "", party: "" });
const blank = () => ({ id: "", date: today(), voucherType: "Journal", narration: "", lines: [line(), { ...line(), side: "Cr" }] });
const TYPES = ["Journal", "Contra", "Payment Adjustment", "Receipt Adjustment", "Opening Entry", "Provision", "Depreciation"];

export const Journal = ({ accounts, reload }) => {
  const [f, setF] = useState(blank);
  const [list, setList] = useState([]);
  const load = () => accGet("journals").then(setList).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const setL = (i, k, v) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) });
  const dr = f.lines.filter((l) => l.side === "Dr").reduce((s, l) => s + num(l.amount), 0);
  const cr = f.lines.filter((l) => l.side === "Cr").reduce((s, l) => s + num(l.amount), 0);
  const diff = +(dr - cr).toFixed(2);
  const post = async () => {
    if (diff !== 0) { toast.error(`Debit aur Credit barabar nahi · Difference ${inr(Math.abs(diff))}`); return; }
    try {
      const out = await accPost("journals", { ...f, lines: f.lines.filter((l) => l.accountId || num(l.amount)).map((l) => ({ accountId: l.accountId, party: l.party, dr: l.side === "Dr" ? num(l.amount) : 0, cr: l.side === "Cr" ? num(l.amount) : 0 })) });
      toast.success(`${out.voucherNo} posted`); setF(blank()); load(); reload();
    } catch (e) { toast.error(e.message); }
  };
  const cancel = async (j) => {
    if (!window.confirm(`Cancel ${j.voucherNo}? Ledger se entry hat jayegi.`)) return;
    try { await accPost("journals", { ...j, status: "Cancelled" }); toast.success("Cancelled"); load(); reload(); } catch (e) { toast.error(e.message); }
  };
  const name = (id) => accLabel(accounts.find((a) => a.id === id));
  return (
    <>
      <Card title="Journal Entry (Double Entry Voucher)" testid="jv-form">
        <Grid cols={4}>
          <Field label="Voucher Date *"><Inp data-testid="jv-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Voucher Type"><Sel data-testid="jv-type" value={f.voucherType} onChange={(e) => setF({ ...f, voucherType: e.target.value })} options={TYPES} /></Field>
          <Field label="Narration *" span={2}><Inp data-testid="jv-narration" value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} placeholder="Being ... (entry ka kaaran)" /></Field>
        </Grid>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12 }} data-testid="jv-lines">
          <thead><tr style={{ background: "#f0fdfa" }}>{["#", "Dr / Cr", "Ledger Account", "Party / Sub-ledger", "Debit (₹)", "Credit (₹)", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: 6, fontSize: 10.5, color: "#115e59" }}>{h}</th>)}</tr></thead>
          <tbody>
            {f.lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 4, width: 24 }}>{i + 1}</td>
                <td style={{ padding: 4, width: 110 }}><Sel data-testid={`jv-side-${i}`} value={l.side} onChange={(e) => setL(i, "side", e.target.value)} options={[{ v: "Dr", l: "Dr" }, { v: "Cr", l: "Cr" }]} /></td>
                <td style={{ padding: 4 }}><Sel data-testid={`jv-acc-${i}`} value={l.accountId} onChange={(e) => setL(i, "accountId", e.target.value)} options={accOpts(accounts)} /></td>
                <td style={{ padding: 4, width: 170 }}><Inp data-testid={`jv-party-${i}`} value={l.party} onChange={(e) => setL(i, "party", e.target.value)} placeholder="Vendor / Client code (optional)" /></td>
                <td style={{ padding: 4, width: 130 }}>{l.side === "Dr" && <Inp data-testid={`jv-dr-${i}`} type="number" value={l.amount} onChange={(e) => setL(i, "amount", e.target.value)} />}</td>
                <td style={{ padding: 4, width: 130 }}>{l.side === "Cr" && <Inp data-testid={`jv-cr-${i}`} type="number" value={l.amount} onChange={(e) => setL(i, "amount", e.target.value)} />}</td>
                <td style={{ padding: 4, width: 36 }}>{f.lines.length > 2 && <Btn tone="red" data-testid={`jv-del-${i}`} onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })} style={{ padding: "4px 7px" }}><Trash2 size={12} /></Btn>}</td>
              </tr>
            ))}
            <tr style={{ background: "#f8fafc", fontWeight: 800 }}>
              <td colSpan={4} style={{ padding: 6, textAlign: "right" }}>Total {diff !== 0 && <span data-testid="jv-diff" style={{ color: "#b91c1c", marginLeft: 8 }}>Difference {inr(Math.abs(diff))}</span>}</td>
              <td style={{ padding: 6 }} data-testid="jv-total-dr">{inr(dr)}</td><td style={{ padding: 6 }} data-testid="jv-total-cr">{inr(cr)}</td><td />
            </tr>
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn tone="ghost" data-testid="jv-add-line" onClick={() => setF({ ...f, lines: [...f.lines, line()] })}><Plus size={13} /> Add Line</Btn>
          {can("accounting", "c") && <Btn tone="green" data-testid="jv-post" disabled={diff !== 0 || !dr} onClick={post}><Send size={13} /> Post Voucher</Btn>}
        </div>
      </Card>
      <Card title={`Journal Register · ${list.length}`} testid="jv-list">
        <Table testid="jv-table" cols={["Voucher No", "Date", "Type", "Narration", "Debit Ledgers", "Credit Ledgers", "Amount", "Status", ""]}
          rows={list.map((j) => [<b>{j.voucherNo}</b>, j.date, j.voucherType, j.narration,
            j.lines.filter((l) => l.dr).map((l) => name(l.accountId)).join(", "), j.lines.filter((l) => l.cr).map((l) => name(l.accountId)).join(", "),
            inr(j.lines.reduce((s, l) => s + num(l.dr), 0)), <Badge text={j.status} tone={j.status === "Cancelled" ? "red" : "green"} />,
            j.status !== "Cancelled" && can("accounting", "a") ? <Btn tone="red" data-testid={`jv-cancel-${j.voucherNo}`} onClick={() => cancel(j)} style={{ padding: "4px 8px" }}><Ban size={12} /> Cancel</Btn> : ""])} />
      </Card>
    </>
  );
};
