import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, inr } from "../crm/crmShared";
import { balances, bal, ageing, fyStart, today, SubTabs, exportXlsx, accOpts, PL_GROUPS } from "./accShared";
import { req } from "../../lib/api";

const amt = (v) => (Math.abs(v) < 0.005 ? "" : inr(Math.abs(v)));

const TrialBalance = ({ rows }) => {
  const r = rows.filter((a) => a.open || a.dr || a.cr);
  const t = r.reduce((s, a) => ({ dr: s.dr + Math.max(a.close, 0), cr: s.cr + Math.max(-a.close, 0) }), { dr: 0, cr: 0 });
  return (
    <Card title="Trial Balance" testid="rep-tb" right={<Btn tone="ghost" data-testid="tb-export" onClick={() => exportXlsx("Trial_Balance", r.map((a) => ({ Code: a.code, Account: a.name, Group: a.group, Opening: a.open, Debit: a.dr, Credit: a.cr, "Closing Dr": Math.max(a.close, 0), "Closing Cr": Math.max(-a.close, 0) })))}><Download size={12} /> Excel</Btn>}>
      <Table testid="tb-table" cols={["Code", "Account", "Group", "Opening", "Debit", "Credit", "Closing Dr", "Closing Cr"]}
        rows={[...r.map((a) => [a.code, a.name, a.group, bal(a.open), amt(a.dr), amt(a.cr), a.close > 0 ? inr(a.close) : "", a.close < 0 ? inr(-a.close) : ""]),
          [<b>TOTAL</b>, "", "", "", "", "", <b data-testid="tb-total-dr">{inr(t.dr)}</b>, <b data-testid="tb-total-cr">{inr(t.cr)}</b>]]} />
      <div data-testid="tb-status" style={{ marginTop: 8, fontWeight: 800, color: Math.abs(t.dr - t.cr) < 0.01 ? "#166534" : "#b91c1c" }}>
        {Math.abs(t.dr - t.cr) < 0.01 ? "Trial Balance tallied · Debit = Credit" : `Difference ${inr(Math.abs(t.dr - t.cr))} (opening balances check karein)`}
      </div>
    </Card>
  );
};

const Side = ({ title, items, total, testid }) => (
  <div style={{ flex: "1 1 320px", minWidth: 0 }} data-testid={testid}>
    <div style={{ fontWeight: 900, fontSize: 12.5, background: "#0f766e", color: "#fff", padding: "6px 10px", borderRadius: "8px 8px 0 0" }}>{title}</div>
    <Table cols={["Particulars", "Amount"]} rows={[...items.map(([l, v]) => [l, inr(v)]), [<b>Total</b>, <b data-testid={`${testid}-total`}>{inr(total)}</b>]]} />
  </div>
);

const ProfitLoss = ({ rows }) => {
  const inc = rows.filter((a) => a.group === "Income").map((a) => [a.name, a.cr - a.dr]).filter(([, v]) => v);
  const exp = rows.filter((a) => a.group === "Expenses").map((a) => [a.name, a.dr - a.cr]).filter(([, v]) => v);
  const ti = inc.reduce((s, [, v]) => s + v, 0), te = exp.reduce((s, [, v]) => s + v, 0), np = ti - te;
  return (
    <Card title="Profit & Loss Account" testid="rep-pl" right={<Btn tone="ghost" data-testid="pl-export" onClick={() => exportXlsx("Profit_Loss", [...exp.map(([l, v]) => ({ Side: "Expense", Particulars: l, Amount: v })), ...inc.map(([l, v]) => ({ Side: "Income", Particulars: l, Amount: v })), { Side: "", Particulars: "Net Profit / (Loss)", Amount: np }])}><Download size={12} /> Excel</Btn>}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Side testid="pl-exp" title="Expenses (Dr)" items={np >= 0 ? [...exp, ["Net Profit c/d", np]] : exp} total={Math.max(te + Math.max(np, 0), ti)} />
        <Side testid="pl-inc" title="Income (Cr)" items={np < 0 ? [...inc, ["Net Loss c/d", -np]] : inc} total={Math.max(ti + Math.max(-np, 0), te)} />
      </div>
      <div data-testid="pl-net" style={{ marginTop: 10, fontWeight: 900, fontSize: 14, color: np >= 0 ? "#166534" : "#b91c1c" }}>{np >= 0 ? "Net Profit" : "Net Loss"}: {inr(Math.abs(np))}</div>
    </Card>
  );
};

const BalanceSheet = ({ rows, to }) => {
  const np = rows.filter((a) => PL_GROUPS.includes(a.group)).reduce((s, a) => s - a.close, 0);
  const pick = (g, sign) => rows.filter((a) => a.group === g).map((a) => [a.name, sign * a.close]).filter(([, v]) => Math.abs(v) > 0.005);
  const assets = pick("Assets", 1), liab = [...pick("Equity", -1), ...pick("Liabilities", -1), ["Profit & Loss A/c (current)", np]];
  const ta = assets.reduce((s, [, v]) => s + v, 0), tl = liab.reduce((s, [, v]) => s + v, 0), diff = ta - tl;
  return (
    <Card title={`Balance Sheet as on ${to}`} testid="rep-bs" right={<Btn tone="ghost" data-testid="bs-export" onClick={() => exportXlsx("Balance_Sheet", [...liab.map(([l, v]) => ({ Side: "Liabilities", Particulars: l, Amount: v })), ...assets.map(([l, v]) => ({ Side: "Assets", Particulars: l, Amount: v }))])}><Download size={12} /> Excel</Btn>}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <Side testid="bs-liab" title="Capital & Liabilities" items={Math.abs(diff) > 0.01 ? [...liab, ["Difference in Opening Balances", diff]] : liab} total={tl + (Math.abs(diff) > 0.01 ? diff : 0)} />
        <Side testid="bs-assets" title="Assets" items={assets} total={ta} />
      </div>
    </Card>
  );
};

const Ageing = ({ accounts, entries, to }) => {
  const [names, setNames] = useState({});
  useEffect(() => { req("/vendors").then((l) => setNames(Object.fromEntries((l || []).map((v) => [v.vendorCode, v.firmName])))).catch(() => {}); }, []);
  const cred = accounts.find((a) => a.sysKey === "creditors");
  const rows = useMemo(() => ageing(entries, cred?.id, to), [entries, cred, to]);
  const t = (k) => rows.reduce((s, r) => s + r[k], 0);
  return (
    <Card title={`Vendor Ageing as on ${to}`} testid="rep-ageing" right={<Btn tone="ghost" data-testid="ageing-export" onClick={() => exportXlsx("Vendor_Ageing", rows.map((r) => ({ Vendor: names[r.party] || r.party, Code: r.party, "0-30": r.b0, "31-60": r.b30, "61-90": r.b60, "90+": r.b90, Outstanding: r.total, Advance: r.advance })))}><Download size={12} /> Excel</Btn>}>
      <Table testid="ageing-table" cols={["Vendor", "0-30 days", "31-60 days", "61-90 days", "90+ days", "Total Outstanding", "Advance Paid"]}
        rows={[...rows.map((r) => [<span><b>{names[r.party] || r.party}</b> <span style={{ color: "#64748b" }}>{r.party}</span></span>, amt(r.b0), amt(r.b30), amt(r.b60), <span style={{ color: "#b91c1c" }}>{amt(r.b90)}</span>, <b>{inr(r.total)}</b>, amt(r.advance)]),
          [<b>TOTAL</b>, inr(t("b0")), inr(t("b30")), inr(t("b60")), inr(t("b90")), <b data-testid="ageing-total">{inr(t("total"))}</b>, inr(t("advance"))]]} />
    </Card>
  );
};

const Ledger = ({ accounts, entries, from, to }) => {
  const [acc, setAcc] = useState("");
  const [party, setParty] = useState("");
  const a = accounts.find((x) => x.id === acc);
  const list = entries.filter((e) => e.accountId === acc && (!party || String(e.party).toLowerCase().includes(party.toLowerCase())));
  const open = (a ? (a.openingType === "Cr" ? -1 : 1) * Number(a.opening || 0) : 0) + list.filter((e) => e.date < from).reduce((s, e) => s + e.dr - e.cr, 0);
  let run = open;
  const rows = list.filter((e) => e.date >= from && e.date <= to).sort((x, y) => x.date.localeCompare(y.date)).map((e) => { run += e.dr - e.cr; return [e.date, e.vno, e.source, e.party || "", e.narration, amt(e.dr), amt(e.cr), bal(run)]; });
  return (
    <Card title="Account Ledger" testid="rep-ledger" right={<>
      <Sel data-testid="ledger-account" value={acc} onChange={(e) => setAcc(e.target.value)} options={accOpts(accounts, "— Select Ledger —")} style={{ width: 260 }} />
      <Inp data-testid="ledger-party" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Party filter" style={{ width: 140 }} /></>}>
      <Table testid="ledger-table" empty="Ledger chunein" cols={["Date", "Voucher", "Source", "Party", "Narration", "Debit", "Credit", "Balance"]}
        rows={acc ? [["", "", "", "", <b>Opening Balance</b>, "", "", bal(open)], ...rows, ["", "", "", "", <b>Closing Balance</b>, "", "", <b data-testid="ledger-closing">{bal(run)}</b>]] : []} />
    </Card>
  );
};

export const FinReports = ({ accounts, entries }) => {
  const [sub, setSub] = useState("tb");
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(today());
  const rows = useMemo(() => balances(accounts, entries, from, to), [accounts, entries, from, to]);
  const bsRows = useMemo(() => balances(accounts, entries, "0000-01-01", to), [accounts, entries, to]);
  return (
    <>
      <Card testid="rep-filter" right={<Btn tone="ghost" data-testid="rep-print" onClick={() => window.print()}><Printer size={12} /> Print</Btn>}>
        <Grid cols={4}>
          <Field label="From Date"><Inp data-testid="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To Date"><Inp data-testid="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </Grid>
      </Card>
      <SubTabs prefix="rep-sub" value={sub} onChange={setSub} tabs={[["tb", "Trial Balance"], ["pl", "Profit & Loss"], ["bs", "Balance Sheet"], ["ageing", "Vendor Ageing"], ["ledger", "Ledger"]]} />
      {sub === "tb" && <TrialBalance rows={rows} />}
      {sub === "pl" && <ProfitLoss rows={rows} />}
      {sub === "bs" && <BalanceSheet rows={bsRows} to={to} />}
      {sub === "ageing" && <Ageing accounts={accounts} entries={entries} to={to} />}
      {sub === "ledger" && <Ledger accounts={accounts} entries={entries} from={from} to={to} />}
    </>
  );
};
