import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Send, Ban, ExternalLink } from "lucide-react";
import { Card, Grid, Field, Inp, Sel, Btn, Table, Badge, inr, num } from "../crm/crmShared";
import { parseGstin } from "../../lib/gstin";
import { accGet, accPost, today, KPI, SubTabs, bal } from "./accShared";
import { can } from "../../lib/acl";

const INV_STEP = { 1: "Draft", 2: "Submitted", 3: "Approved", 4: "Sent to Client", 5: "Paid", 6: "Cancelled" };
const MODES = ["NEFT / RTGS", "Cheque", "UPI", "Cash", "DD"];
const blank = () => ({ clientId: "", invoiceId: "", date: today(), mode: "NEFT / RTGS", refNo: "", bankAccountId: "", amount: "", tdsDeducted: "", retentionHeld: "", narration: "" });

const useSales = () => {
  const [d, setD] = useState({ customers: [], invoices: [], receipts: [] });
  const load = () => Promise.all(["customers", "invoices", "receipts"].map(accGet)).then(([customers, invoices, receipts]) => setD({ customers, invoices, receipts })).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  return { ...d, load };
};

export const Sales = ({ accounts, entries, reload }) => {
  const nav = useNavigate();
  const [sub, setSub] = useState("cust");
  const { customers, invoices, receipts, load } = useSales();
  const [f, setF] = useState(blank);
  const debtors = accounts.find((a) => a.sysKey === "debtors");
  const outstanding = useMemo(() => {
    const m = {};
    entries.filter((e) => e.accountId === debtors?.id).forEach((e) => { m[e.party] = (m[e.party] || 0) + e.dr - e.cr; });
    return m;
  }, [entries, debtors]);
  const cname = (id) => (customers.find((c) => c.id === id) || {}).name || id || "—";
  const banks = accounts.filter((a) => a.isBank || a.isCash);
  const live = invoices.filter((i) => Number(i.step) >= 3 && Number(i.step) !== 6);
  const tot = (k) => live.reduce((s, i) => s + num(i[k]), 0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    try { const r = await accPost("receipts", f); toast.success(`${r.receiptNo} posted`); setF(blank()); load(); reload(); } catch (e) { toast.error(e.message); }
  };
  const cancel = async (r) => {
    if (!window.confirm(`Cancel receipt ${r.receiptNo}?`)) return;
    try { await accPost("receipts", { id: r.id, status: "Cancelled" }); load(); reload(); } catch (e) { toast.error(e.message); }
  };
  return (
    <>
      <SubTabs prefix="sales-sub" value={sub} onChange={setSub} tabs={[["cust", "Customer Master"], ["inv", "Sales Invoicing Dashboard"], ["rcpt", "Payment Receipts"]]} />
      {sub === "cust" && (
        <Card title={`Customer Master · ${customers.length}`} testid="cust-list" right={<Btn tone="ghost" data-testid="cust-open-crm" onClick={() => nav("/client-revenue")}><ExternalLink size={12} /> Naya client: Client & Revenue → Clients Master</Btn>}>
          <Table testid="cust-table" cols={["Customer", "GSTIN", "PAN", "State", "GST Applied", "Contact", "Outstanding"]}
            rows={customers.map((c) => [<b>{c.name}</b>, c.gst || "—", c.pan || "—", c.state || (c.gst ? parseGstin(c.gst).state || `Code ${c.gst.slice(0, 2)}` : "—"),
              <Badge text={c.taxType} tone={c.taxType === "IGST" ? "amber" : "green"} />, [c.contactPerson, c.mobile].filter(Boolean).join(" · ") || "—", <b data-testid={`cust-out-${c.id}`}>{bal(outstanding[c.id] || 0)}</b>])} />
        </Card>
      )}
      {sub === "inv" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 12 }}>
            <KPI testid="inv-kpi-taxable" label="Taxable Value" value={inr(tot("taxable"))} />
            <KPI testid="inv-kpi-cgst" label="CGST" value={inr(tot("cgst"))} tone="#0891b2" />
            <KPI testid="inv-kpi-sgst" label="SGST" value={inr(tot("sgst"))} tone="#0891b2" />
            <KPI testid="inv-kpi-igst" label="IGST" value={inr(tot("igst"))} tone="#d97706" />
            <KPI testid="inv-kpi-total" label="Invoice Total" value={inr(tot("total"))} tone="#1d4ed8" />
          </div>
          <Card title="Sales Invoices (UP client → CGST+SGST · other state → IGST)" testid="inv-list" right={<Btn data-testid="inv-new" onClick={() => nav("/client-revenue")}><ExternalLink size={12} /> New Tax Invoice</Btn>}>
            <Table testid="inv-table" cols={["Invoice No", "Date", "Customer", "Taxable", "CGST", "SGST", "IGST", "Total", "Status", "Ledger"]}
              rows={invoices.map((i) => [<b>{i.invoiceNo || i.refNo}</b>, i.invoiceDate, cname(i.clientId), inr(i.taxable), inr(i.cgst), inr(i.sgst), inr(i.igst), <b>{inr(i.total)}</b>,
                <Badge text={INV_STEP[i.step] || i.step} tone={Number(i.step) === 6 ? "red" : Number(i.step) >= 3 ? "green" : "slate"} />, Number(i.step) >= 3 && Number(i.step) !== 6 ? "Posted" : "—"])} />
          </Card>
        </>
      )}
      {sub === "rcpt" && (
        <>
          {can("accounting", "c") && (
            <Card title="Payment Receipt Entry" testid="rcpt-form">
              <Grid cols={4}>
                <Field label="Customer *"><Sel data-testid="rcpt-client" value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value, invoiceId: "" })} options={[{ v: "", l: "— Customer —" }, ...customers.map((c) => ({ v: c.id, l: c.name }))]} /></Field>
                <Field label="Against Invoice"><Sel data-testid="rcpt-invoice" value={f.invoiceId} onChange={set("invoiceId")} options={[{ v: "", l: "— On account —" }, ...live.filter((i) => i.clientId === f.clientId).map((i) => ({ v: i.id, l: `${i.invoiceNo || i.refNo} · ${inr(i.total)}` }))]} /></Field>
                <Field label="Receipt Date *"><Inp data-testid="rcpt-date" type="date" value={f.date} onChange={set("date")} /></Field>
                <Field label="Deposited In (Bank / Cash)"><Sel data-testid="rcpt-bank" value={f.bankAccountId} onChange={set("bankAccountId")} options={[{ v: "", l: "— Main Bank —" }, ...banks.map((a) => ({ v: a.id, l: a.name }))]} /></Field>
                <Field label="Mode"><Sel data-testid="rcpt-mode" value={f.mode} onChange={set("mode")} options={MODES} /></Field>
                <Field label="UTR / Cheque No"><Inp data-testid="rcpt-ref" value={f.refNo} onChange={set("refNo")} /></Field>
                <Field label="Amount Received (₹) *"><Inp data-testid="rcpt-amount" type="number" value={f.amount} onChange={set("amount")} /></Field>
                <Field label="TDS deducted by client (₹)"><Inp data-testid="rcpt-tds" type="number" value={f.tdsDeducted} onChange={set("tdsDeducted")} /></Field>
                <Field label="Retention held by client (₹)"><Inp data-testid="rcpt-retention" type="number" value={f.retentionHeld} onChange={set("retentionHeld")} /></Field>
                <Field label="Narration" span={3}><Inp data-testid="rcpt-narration" value={f.narration} onChange={set("narration")} /></Field>
              </Grid>
              <div style={{ marginTop: 10, fontSize: 12, color: "#0f766e", fontWeight: 700 }} data-testid="rcpt-posting">
                Posting: Dr Bank {inr(f.amount)} {num(f.tdsDeducted) ? `+ Dr TDS Receivable ${inr(f.tdsDeducted)} ` : ""}{num(f.retentionHeld) ? `+ Dr Retention Receivable ${inr(f.retentionHeld)} ` : ""}→ Cr Sundry Debtors {inr(num(f.amount) + num(f.tdsDeducted) + num(f.retentionHeld))}
              </div>
              <Btn tone="green" data-testid="rcpt-save" onClick={save} style={{ marginTop: 10 }}><Send size={13} /> Post Receipt</Btn>
            </Card>
          )}
          <Card title={`Receipt Register · ${receipts.length}`} testid="rcpt-list">
            <Table testid="rcpt-table" cols={["Receipt No", "Date", "Customer", "Mode / Ref", "Amount", "TDS", "Retention", "Status", ""]}
              rows={receipts.map((r) => [<b>{r.receiptNo}</b>, r.date, cname(r.clientId), `${r.mode || ""} ${r.refNo || ""}`, inr(r.amount), inr(r.tdsDeducted), inr(r.retentionHeld),
                <Badge text={r.status} tone={r.status === "Cancelled" ? "red" : "green"} />,
                r.status !== "Cancelled" && can("accounting", "a") ? <Btn tone="red" data-testid={`rcpt-cancel-${r.receiptNo}`} onClick={() => cancel(r)} style={{ padding: "4px 8px" }}><Ban size={12} /></Btn> : ""])} />
          </Card>
        </>
      )}
    </>
  );
};
