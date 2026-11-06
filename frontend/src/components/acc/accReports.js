import { accGet, balances, ageing, fyStart, today, PL_GROUPS, bal } from "./accShared";
import { req } from "../../lib/api";
import { can } from "../../lib/acl";

// Accounting statements & registers for Reports Management
const C = { entries: [], accounts: [], tax: { tds: [], gstIn: [], gstOut: [] }, journals: [], receipts: [], vendors: {}, clients: {} };
let RANGE = { from: fyStart(), to: today() };
const inr = (v) => (Math.abs(Number(v) || 0) < 0.005 ? "" : (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export const loadAccCache = async () => {
  if (!can("accounting", "v")) return;
  const [e, tax, journals, receipts, vendors, customers] = await Promise.all([accGet("entries"), accGet("tax"), accGet("journals"), accGet("receipts"), req("/vendors").catch(() => []), accGet("customers").catch(() => [])]);
  Object.assign(C, e, { tax, journals, receipts, vendors: Object.fromEntries((vendors || []).map((v) => [v.vendorCode, v.firmName])), clients: Object.fromEntries(customers.map((c) => [c.id, c.name])) });
};

export const setAccRange = (fy, from, to) => {
  const f = fy ? `20${fy.slice(0, 2)}-04-01` : fyStart();
  const t = fy ? `20${fy.slice(2)}-03-31` : today();
  RANGE = { from: from || f, to: to || (t > today() ? today() : t) };
};

const accName = (id) => (C.accounts.find((a) => a.id === id) || {}).name || id;
const party = (p) => C.vendors[p] || C.clients[p] || p || "";
const stmt = (rows) => rows.map((r, i) => ({ id: `r${i}`, _asOf: RANGE.to, ...r }));
const col = (key, label, right, width = 130) => ({ key, label, right, width });

const tbRows = () => {
  const r = balances(C.accounts, C.entries, RANGE.from, RANGE.to).filter((a) => a.open || a.dr || a.cr);
  const dr = r.reduce((s, a) => s + Math.max(a.close, 0), 0), cr = r.reduce((s, a) => s + Math.max(-a.close, 0), 0);
  return stmt([...r.map((a) => ({ code: a.code, name: a.name, group: a.group, open: bal(a.open), dr: inr(a.dr), cr: inr(a.cr), cdr: inr(Math.max(a.close, 0)), ccr: inr(Math.max(-a.close, 0)) })),
    { code: "", name: Math.abs(dr - cr) < 0.01 ? "TOTAL · Tallied" : "TOTAL · Difference", group: "", open: "", dr: "", cr: "", cdr: inr(dr), ccr: inr(cr) }]);
};

const plRows = () => {
  const r = balances(C.accounts, C.entries, RANGE.from, RANGE.to);
  const inc = r.filter((a) => a.group === "Income" && (a.dr || a.cr)), exp = r.filter((a) => a.group === "Expenses" && (a.dr || a.cr));
  const ti = inc.reduce((s, a) => s + a.cr - a.dr, 0), te = exp.reduce((s, a) => s + a.dr - a.cr, 0);
  return stmt([...inc.map((a) => ({ side: "Income", name: a.name, _amount: a.cr - a.dr })), { side: "Income", name: "Total Income", _amount: ti },
    ...exp.map((a) => ({ side: "Expenses", name: a.name, _amount: a.dr - a.cr })), { side: "Expenses", name: "Total Expenses", _amount: te },
    { side: "Result", name: ti - te >= 0 ? "Net Profit" : "Net Loss", _amount: ti - te }]);
};

const bsRows = () => {
  const r = balances(C.accounts, C.entries, "0000-01-01", RANGE.to);
  const np = r.filter((a) => PL_GROUPS.includes(a.group)).reduce((s, a) => s - a.close, 0);
  const pick = (g, sign) => r.filter((a) => a.group === g && Math.abs(a.close) > 0.005).map((a) => ({ side: g === "Assets" ? "Assets" : "Capital & Liabilities", name: a.name, _amount: sign * a.close }));
  const liab = [...pick("Equity", -1), ...pick("Liabilities", -1), { side: "Capital & Liabilities", name: "Profit & Loss A/c (current)", _amount: np }];
  const assets = pick("Assets", 1);
  const diff = assets.reduce((s, x) => s + x._amount, 0) - liab.reduce((s, x) => s + x._amount, 0);
  if (Math.abs(diff) > 0.01) liab.push({ side: "Capital & Liabilities", name: "Difference in Opening Balances", _amount: diff });
  return stmt([...liab, ...assets]);
};

const ageRows = () => {
  const cred = C.accounts.find((a) => a.sysKey === "creditors");
  return stmt(ageing(C.entries, cred?.id, RANGE.to).map((r) => ({ vendor: party(r.party), code: r.party, b0: inr(r.b0), b30: inr(r.b30), b60: inr(r.b60), b90: inr(r.b90), _amount: r.total, adv: inr(r.advance) })));
};

const ST = (id, title, fetch, columns, amount = null) => ({ id, title, icon: "", fetch, dateKey: "_asOf", amountKey: amount, columns, statusKey: null });
const REG = (id, title, fetch, dateKey, columns, amount = "_amount") => ({ id, title, icon: "", fetch, dateKey, amountKey: amount, columns, statusKey: null });

export const ACC_DEPTS = [
  ST("acc_tb", "Trial Balance", tbRows, [col("code", "Code", false, 80), col("name", "Account", false, 220), col("group", "Group"), col("open", "Opening", true), col("dr", "Debit", true), col("cr", "Credit", true), col("cdr", "Closing Dr", true), col("ccr", "Closing Cr", true)]),
  ST("acc_pl", "Profit & Loss A/c", plRows, [col("side", "Side"), col("name", "Particulars", false, 260), col("_amount", "Amount (₹)", true)]),
  ST("acc_bs", "Balance Sheet", bsRows, [col("side", "Side", false, 170), col("name", "Particulars", false, 260), col("_amount", "Amount (₹)", true)]),
  ST("acc_ageing", "Vendor Ageing", ageRows, [col("vendor", "Vendor", false, 200), col("code", "Code"), col("b0", "0-30 days", true), col("b30", "31-60 days", true), col("b60", "61-90 days", true), col("b90", "90+ days", true), col("_amount", "Outstanding", true), col("adv", "Advance", true)], "_amount"),
  REG("acc_daybook", "Day Book / Ledger", () => C.entries.map((e, i) => ({ id: `${e.key}-${i}`, date: e.date, vno: e.vno, source: e.source, account: accName(e.accountId), party: party(e.party), narration: e.narration, dr: inr(e.dr), cr: inr(e.cr), _amount: e.dr })),
    "date", [col("date", "Date", false, 95), col("vno", "Voucher"), col("source", "Source"), col("account", "Account", false, 200), col("party", "Party"), col("narration", "Narration", false, 240), col("dr", "Debit", true), col("cr", "Credit", true)]),
  REG("acc_journals", "Journal Register", () => C.journals.map((j) => ({ id: j.id, date: j.date, voucherNo: j.voucherNo, voucherType: j.voucherType, narration: j.narration, drAcc: j.lines.filter((l) => l.dr).map((l) => accName(l.accountId)).join(", "), crAcc: j.lines.filter((l) => l.cr).map((l) => accName(l.accountId)).join(", "), _amount: j.lines.reduce((s, l) => s + (Number(l.dr) || 0), 0), st: j.status })),
    "date", [col("voucherNo", "Voucher No"), col("date", "Date", false, 95), col("voucherType", "Type"), col("narration", "Narration", false, 220), col("drAcc", "Debit Ledgers", false, 180), col("crAcc", "Credit Ledgers", false, 180), col("_amount", "Amount", true), col("st", "Status")]),
  REG("acc_receipts", "Payment Receipts", () => C.receipts.map((r) => ({ id: r.id, receiptNo: r.receiptNo, date: r.date, client: party(r.clientId), mode: `${r.mode || ""} ${r.refNo || ""}`, _amount: r.amount, tds: inr(r.tdsDeducted), ret: inr(r.retentionHeld), st: r.status })),
    "date", [col("receiptNo", "Receipt No"), col("date", "Date", false, 95), col("client", "Customer", false, 200), col("mode", "Mode / Ref"), col("_amount", "Amount", true), col("tds", "TDS", true), col("ret", "Retention", true), col("st", "Status")]),
  REG("acc_tds", "TDS Register (Sections)", () => C.tax.tds.map((r) => ({ id: r.key, date: r.date, refNo: r.refNo, vendor: r.vendor || r.vendorCode, pan: r.pan, section: r.section, basic: inr(r.basic), rate: `${r.rate}%`, _amount: r.tds })),
    "date", [col("date", "Date", false, 95), col("refNo", "Bill Ref"), col("vendor", "Vendor", false, 200), col("pan", "PAN"), col("section", "Section"), col("basic", "Basic", true), col("rate", "Rate", true), col("_amount", "TDS (₹)", true)]),
  REG("acc_gst_in", "GST Input (ITC)", () => C.tax.gstIn.map((r) => ({ id: r.key, date: r.date, refNo: r.refNo, vendor: r.vendor || r.vendorCode, gstin: r.gstin, cgst: inr(r.cgst), sgst: inr(r.sgst), igst: inr(r.igst), _amount: r.gst, m: r.matched ? "Matched" : "Pending" })),
    "date", [col("date", "Date", false, 95), col("refNo", "Bill Ref"), col("vendor", "Vendor", false, 200), col("gstin", "GSTIN"), col("cgst", "CGST", true), col("sgst", "SGST", true), col("igst", "IGST", true), col("_amount", "Total GST", true), col("m", "2B Match")]),
  REG("acc_gst_out", "GST Output (Sales)", () => C.tax.gstOut.map((r, i) => ({ id: `o${i}`, date: r.date, invoiceNo: r.invoiceNo, client: party(r.clientId), taxable: inr(r.taxable), cgst: inr(r.cgst), sgst: inr(r.sgst), igst: inr(r.igst), _amount: r.cgst + r.sgst + r.igst })),
    "date", [col("date", "Date", false, 95), col("invoiceNo", "Invoice No"), col("client", "Customer", false, 200), col("taxable", "Taxable", true), col("cgst", "CGST", true), col("sgst", "SGST", true), col("igst", "IGST", true), col("_amount", "Total GST", true)]),
];
export const ACC_IDS = ACC_DEPTS.map((d) => d.id);
