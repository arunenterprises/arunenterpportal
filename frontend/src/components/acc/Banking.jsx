import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, inr, num } from "../crm/crmShared";
import { accGet, accPost, balances, bal, today, KPI, SubTabs } from "./accShared";
import { can } from "../../lib/acl";

const blank = (cash) => ({ id: "", code: "", name: "", group: "Assets", subGroup: "Cash & Bank", isBank: !cash, isCash: !!cash, bankName: "", accountNo: "", ifsc: "", branch: "", opening: 0, openingType: "Dr" });

const BankMaster = ({ banks, reload }) => {
  const [f, setF] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { await accPost("accounts", f); toast.success(`${f.name} saved`); setF(null); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <>
      {f && (
        <Card title={f.id ? `Edit · ${f.name}` : f.isCash ? "New Cash Account" : "New Bank Account"} testid="bank-form">
          <Grid cols={4}>
            <Field label="Ledger Code *"><Inp data-testid="bank-code" value={f.code} onChange={set("code")} placeholder="e.g. 1011" /></Field>
            <Field label="Ledger Name *"><Inp data-testid="bank-name" value={f.name} onChange={set("name")} placeholder="e.g. SBI Current A/c" /></Field>
            {f.isBank && <>
              <Field label="Bank Name"><Inp data-testid="bank-bankname" value={f.bankName || ""} onChange={set("bankName")} /></Field>
              <Field label="Account No"><Inp data-testid="bank-accno" value={f.accountNo || ""} onChange={set("accountNo")} /></Field>
              <Field label="IFSC"><Inp data-testid="bank-ifsc" value={f.ifsc || ""} onChange={(e) => setF({ ...f, ifsc: e.target.value.toUpperCase() })} /></Field>
              <Field label="Branch"><Inp data-testid="bank-branch" value={f.branch || ""} onChange={set("branch")} /></Field>
            </>}
            <Field label="Opening Balance (₹)"><Inp data-testid="bank-opening" type="number" value={f.opening} onChange={set("opening")} /></Field>
            <Field label="Dr / Cr"><Sel data-testid="bank-opening-type" value={f.openingType} onChange={set("openingType")} options={["Dr", "Cr"]} /></Field>
          </Grid>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn tone="green" data-testid="bank-save" onClick={save}><Save size={13} /> Save</Btn>
            <Btn tone="ghost" data-testid="bank-cancel" onClick={() => setF(null)}>Cancel</Btn>
          </div>
        </Card>
      )}
      <Card title="Bank & Cash Master" testid="bank-list" right={can("accounting", "c") && <>
        <Btn data-testid="bank-new" onClick={() => setF(blank(false))}><Plus size={13} /> Bank Account</Btn>
        <Btn tone="ghost" data-testid="cash-new" onClick={() => setF(blank(true))}><Plus size={13} /> Cash Account</Btn></>}>
        <Table testid="bank-table" cols={["Code", "Ledger", "Type", "Bank / A/c No", "IFSC", "Book Balance", ""]}
          rows={banks.map((a) => [a.code, <b>{a.name}</b>, <Badge text={a.isCash ? "Cash" : "Bank"} tone={a.isCash ? "amber" : "blue"} />, [a.bankName, a.accountNo].filter(Boolean).join(" · ") || "—", a.ifsc || "—",
            <b data-testid={`bank-bal-${a.code}`}>{bal(a.close)}</b>, can("accounting", "e") ? <Btn tone="ghost" data-testid={`bank-edit-${a.code}`} onClick={() => setF({ ...a })} style={{ padding: "4px 8px" }}>Edit</Btn> : ""])} />
      </Card>
    </>
  );
};

const Brs = ({ banks, entries }) => {
  const [acc, setAcc] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [clr, setClr] = useState({});
  useEffect(() => { accGet("brs").then((l) => setClr(Object.fromEntries(l.map((x) => [x.key, x])))).catch((e) => toast.error(e.message)); }, []);
  const a = banks.find((b) => b.id === (acc || banks.find((x) => x.isBank)?.id));
  const rows = useMemo(() => entries.filter((e) => e.accountId === a?.id && e.date <= asOf).sort((x, y) => x.date.localeCompare(y.date)), [entries, a, asOf]);
  const k = (e) => `${e.key}|${e.accountId}`;
  const cleared = (e) => clr[k(e)]?.clearDate && clr[k(e)].clearDate <= asOf;
  const save = async (e, clearDate, bankRef = clr[k(e)]?.bankRef || "") => {
    try { const r = await accPost("brs", { key: k(e), clearDate, bankRef }); setClr((c) => ({ ...c, [r.key]: r })); } catch (er) { toast.error(er.message); }
  };
  const books = (a ? (a.openingType === "Cr" ? -1 : 1) * num(a.opening) : 0) + rows.reduce((s, e) => s + e.dr - e.cr, 0);
  const unDep = rows.filter((e) => e.dr && !cleared(e)).reduce((s, e) => s + e.dr, 0);
  const unPay = rows.filter((e) => e.cr && !cleared(e)).reduce((s, e) => s + e.cr, 0);
  return (
    <Card title="Bank Reconciliation Statement" testid="brs" right={<>
      <Sel data-testid="brs-account" value={a?.id || ""} onChange={(e) => setAcc(e.target.value)} options={banks.map((b) => ({ v: b.id, l: b.name }))} style={{ width: 220 }} />
      <Inp data-testid="brs-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ width: 150 }} /></>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 12 }}>
        <KPI testid="brs-books" label="Balance as per Books" value={bal(books)} />
        <KPI testid="brs-undep" label="Less: Deposits not cleared" value={inr(unDep)} tone="#d97706" />
        <KPI testid="brs-unpay" label="Add: Payments not presented" value={inr(unPay)} tone="#d97706" />
        <KPI testid="brs-bank" label="Balance as per Bank" value={bal(books - unDep + unPay)} tone="#1d4ed8" />
      </div>
      <Table testid="brs-table" cols={["Date", "Voucher", "Source", "Narration", "Deposit (Dr)", "Withdrawal (Cr)", "Bank Clearing Date", "Bank Ref", "Status"]}
        rows={rows.map((e, i) => [e.date, e.vno, e.source, e.narration, e.dr ? inr(e.dr) : "", e.cr ? inr(e.cr) : "",
          <Inp data-testid={`brs-clear-${i}`} type="date" value={clr[k(e)]?.clearDate || ""} disabled={!can("accounting", "e")} onChange={(ev) => save(e, ev.target.value)} style={{ width: 140 }} />,
          <Inp data-testid={`brs-ref-${i}`} defaultValue={clr[k(e)]?.bankRef || ""} disabled={!can("accounting", "e")} onBlur={(ev) => ev.target.value !== (clr[k(e)]?.bankRef || "") && save(e, clr[k(e)]?.clearDate || "", ev.target.value)} style={{ width: 120 }} />,
          <Badge text={cleared(e) ? "Cleared" : "Pending"} tone={cleared(e) ? "green" : "amber"} />])} />
    </Card>
  );
};

export const Banking = ({ accounts, entries, reload }) => {
  const [sub, setSub] = useState("master");
  const banks = useMemo(() => balances(accounts.filter((a) => a.isBank || a.isCash), entries, "0000-01-01", today()), [accounts, entries]);
  return (
    <>
      <SubTabs prefix="bank-sub" value={sub} onChange={setSub} tabs={[["master", "Bank / Cash Master"], ["brs", "Bank Reconciliation (BRS)"]]} />
      {sub === "master" ? <BankMaster banks={banks} reload={reload} /> : <Brs banks={banks} entries={entries} />}
    </>
  );
};
