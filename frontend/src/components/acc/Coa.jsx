import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2, Pencil } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge } from "../crm/crmShared";
import { accPost, accDel, balances, bal, today } from "./accShared";
import { can } from "../../lib/acl";

const GROUPS = ["Assets", "Liabilities", "Equity", "Income", "Expenses"];
const blank = () => ({ id: "", code: "", name: "", group: "Expenses", subGroup: "", opening: 0, openingType: "Dr" });

export const Coa = ({ accounts, entries, reload }) => {
  const [f, setF] = useState(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => balances(accounts, entries, "0000-01-01", today()), [accounts, entries]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { await accPost("accounts", f); toast.success(`${f.code} · ${f.name} saved`); setF(null); reload(); } catch (e) { toast.error(e.message); }
  };
  const del = async (a) => {
    if (!window.confirm(`Delete account ${a.code} · ${a.name}?`)) return;
    try { await accDel(`accounts/${a.id}`); toast.success("Deleted"); reload(); } catch (e) { toast.error(e.message); }
  };
  const shown = rows.filter((a) => !q || `${a.code} ${a.name} ${a.group} ${a.subGroup}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      {f && (
        <Card title={f.id ? `Edit Account · ${f.code}` : "New Ledger Account"} testid="coa-form">
          <Grid cols={4}>
            <Field label="Account Code *"><Inp data-testid="coa-code" value={f.code} onChange={set("code")} placeholder="e.g. 5210" /></Field>
            <Field label="Account Name *" span={2}><Inp data-testid="coa-name" value={f.name} onChange={set("name")} placeholder="e.g. Diesel & Fuel Expense" /></Field>
            <Field label="Group *"><Sel data-testid="coa-group" value={f.group} onChange={set("group")} disabled={f.system} options={GROUPS} /></Field>
            <Field label="Sub Group"><Inp data-testid="coa-subgroup" value={f.subGroup || ""} onChange={set("subGroup")} placeholder="e.g. Indirect Expenses" /></Field>
            <Field label="Opening Balance (₹)"><Inp data-testid="coa-opening" type="number" value={f.opening} onChange={set("opening")} /></Field>
            <Field label="Dr / Cr"><Sel data-testid="coa-opening-type" value={f.openingType || "Dr"} onChange={set("openingType")} options={["Dr", "Cr"]} /></Field>
          </Grid>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn tone="green" data-testid="coa-save" onClick={save}><Save size={13} /> Save Account</Btn>
            <Btn tone="ghost" data-testid="coa-cancel" onClick={() => setF(null)}>Cancel</Btn>
          </div>
        </Card>
      )}
      <Card title={`Chart of Accounts · ${accounts.length} ledgers`} testid="coa-list"
        right={<><Inp data-testid="coa-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code / name / group" style={{ width: 220 }} />
          {can("accounting", "c") && <Btn data-testid="coa-new" onClick={() => setF(blank())}><Plus size={13} /> New Account</Btn>}</>}>
        <Table testid="coa-table" cols={["Code", "Account Name", "Group", "Sub Group", "Opening", "Balance (today)", ""]}
          rows={shown.map((a) => [<b style={{ fontFamily: "monospace" }}>{a.code}</b>, <span>{a.name} {a.system && <Badge text="System" tone="blue" />}</span>, a.group, a.subGroup || "—",
            `${Number(a.opening || 0).toLocaleString("en-IN")} ${a.openingType || "Dr"}`, <b data-testid={`coa-bal-${a.code}`}>{bal(a.close)}</b>,
            <span style={{ display: "flex", gap: 4 }}>
              {can("accounting", "e") && <Btn tone="ghost" data-testid={`coa-edit-${a.code}`} onClick={() => setF({ ...a })} style={{ padding: "4px 8px" }}><Pencil size={12} /></Btn>}
              {!a.system && can("accounting", "d") && <Btn tone="red" data-testid={`coa-del-${a.code}`} onClick={() => del(a)} style={{ padding: "4px 8px" }}><Trash2 size={12} /></Btn>}
            </span>])} />
      </Card>
    </>
  );
};
