import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X, ClipboardList, ShieldAlert, RefreshCw, TrendingUp } from "lucide-react";
import OpsModule from "../ops/OpsModule";
import { OPS } from "../ops/opsConfig";
import { apiOpsList, apiFraudBlocks, apiFraudRelease, apiFraudReconcile } from "../../lib/api";
import { getEmployees, getAttendance, getBills, getPayments, computeBill, currentRole } from "../../lib/store";

export const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 };
const th = { padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11 };
const td = { padding: 6, borderBottom: "1px solid #f1f5f9", fontSize: 11.5 };
const n = (v) => Number(v) || 0;
const today = () => new Date().toISOString().slice(0, 10);
const open = (r) => r.status !== "Rejected";
const sum = (a, f) => a.reduce((s, r) => s + n(f(r)), 0);

export const Kpi = ({ l, v, c, id, red }) => (
  <div style={{ ...card, borderTop: `3px solid ${c}`, background: red ? "#fef2f2" : "#fff" }} data-testid={`core-kpi-${id}`}>
    <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{l}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color: c, marginTop: 4 }}>{v}</div>
  </div>
);
const Kpis = ({ items }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))`, gap: 10, marginBottom: 12 }}>{items.map((k) => <Kpi key={k.id} {...k} />)}</div>
);
export const Bar = ({ pct, c }) => (
  <div style={{ minWidth: 110 }}><div style={{ height: 8, background: "#e2e8f0", borderRadius: 99 }}><div style={{ width: `${Math.min(100, n(pct))}%`, height: 8, background: c, borderRadius: 99 }} /></div><span style={{ fontSize: 10.5, fontWeight: 700 }}>{n(pct)}%</span></div>
);
const Chip = ({ t, c }) => <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: `${c}1a`, color: c, border: `1px solid ${c}55` }}>{t}</span>;
export const Grid = ({ title, icon: I = ClipboardList, cols, rows, id, span }) => (
  <div style={{ ...card, gridColumn: span ? "1 / -1" : undefined, overflowX: "auto" }} data-testid={`core-grid-${id}`}>
    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><I size={14} /> {title}</div>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead><tr>{cols.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>
        {!rows.length && <tr><td colSpan={cols.length} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>Abhi koi entry nahi</td></tr>}
        {rows.map((r, i) => <tr key={i} style={r.bg ? { background: r.bg } : undefined}>{r.cells.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
);

const FormModal = ({ kind, allowed, onClose }) => {
  const opts = OPS[kind].fields.find((f) => f.k === "discipline")?.options;
  const d = opts ? opts.filter((o) => allowed.includes(o)) : allowed;
  return (
    <div data-testid={`core-modal-${kind}`} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ background: "#f8fafc", borderRadius: 12, width: "min(1100px, 100%)", padding: 14, position: "relative" }}>
        <button data-testid="core-modal-close" onClick={onClose} style={{ position: "absolute", right: 10, top: 10, border: "none", background: "#fff", borderRadius: 99, padding: 6, cursor: "pointer" }}><X size={16} /></button>
        <OpsModule cfg={OPS[kind]} disc={d.length ? d : opts} />
      </div>
    </div>
  );
};

const latestPct = (p, work, pred = () => true) => {
  const latest = {};
  work.filter((w) => w.project === p.name && pred(w)).forEach((w) => { if (!latest[w.module] || (w.date || "") >= (latest[w.module].date || "")) latest[w.module] = w; });
  const v = Object.values(latest).map((w) => n(w.progressPct));
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : 0;
};
const modPct = (p, work, mod) => latestPct(p, work, (w) => w.module === mod);
const avg = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0);

export const FraudPanel = () => {
  const [rows, setRows] = useState([]);
  const load = () => apiFraudBlocks().then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);
  const gm = ["GM", "SuperAdmin"].includes(currentRole());
  const run = async () => { try { const r = await apiFraudReconcile(); toast.success(`${r.checked} stock entries check · ${r.activeBlocks} active block`); load(); } catch (e) { toast.error(e.message); } };
  const release = async (b) => {
    const remark = window.prompt(`${b.project} · ${b.material} block release ka kaaran likhein`);
    if (remark === null) return;
    try { await apiFraudRelease(b.id, remark); toast.success("Block released"); load(); } catch (e) { toast.error(e.message); }
  };
  const act = rows.filter((r) => r.active);
  return (
    <div style={{ ...card, borderLeft: "5px solid #dc2626", marginTop: 12 }} data-testid="fraud-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <ShieldAlert size={16} color="#dc2626" /><b style={{ fontSize: 13 }}>Anti-Fraud · Stock Variance Alerts ({act.length} active)</b>
        <button data-testid="fraud-run" onClick={run} style={{ marginLeft: "auto", padding: "6px 12px", border: "1px solid #dc2626", color: "#dc2626", background: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 11.5, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" }}><RefreshCw size={12} /> Reconcile Now</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Project", "Material", "Book", "Physical", "Variance", "Status", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>Koi variance alert nahi</td></tr>}
          {rows.slice(0, 15).map((b) => (
            <tr key={b.id} data-testid={`fraud-row-${b.id}`} style={{ background: b.active ? "#fef2f2" : undefined }}>
              <td style={td}>{b.date}</td><td style={td}>{b.project}</td><td style={td}>{b.material}</td><td style={td}>{b.bookClosing}</td><td style={td}>{b.physicalClosing}</td>
              <td style={{ ...td, fontWeight: 800, color: "#dc2626" }}>{b.variancePct}%</td>
              <td style={td}>{b.active ? <Chip t="INDENT BLOCKED" c="#dc2626" /> : <Chip t={`Released · ${b.releasedBy || ""}`} c="#16a34a" />}</td>
              <td style={td}>{b.active && gm && <button data-testid={`fraud-release-${b.id}`} onClick={() => release(b)} style={{ padding: "3px 10px", border: "none", background: "#0b1f4d", color: "#fff", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Release</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const KINDS = ["core_project", "core_progress", "core_escalation", "core_block", "core_drum", "core_substation", "core_equip_test", "core_amc", "core_hr_ticket", "core_payroll_freeze",
  "core_bg", "core_eot", "core_claim", "core_ra_bill", "indent", "proc_rfq", "proc_cs", "proc_po", "proc_grn", "labour", "geo_att", "agreement", "labour_bill"];

const civil = ({ d, c }) => {
  const P = d.core_project.filter((p) => p.discipline === "CIVIL");
  const W = d.core_progress.filter((w) => w.discipline === "CIVIL");
  const rows = P.map((p) => ({ ...p, pct: latestPct(p, W) }));
  return {
    kpis: [{ id: "running", l: "Core Projects Running", v: P.filter((p) => ["Running", "Active"].includes(p.pstatus)).length, c },
      { id: "value", l: "Contract Value", v: inr(sum(P, (p) => p.value)), c: "#15803d" }, { id: "avg", l: "Avg Progress", v: `${avg(rows.map((r) => r.pct))}%`, c: "#7c3aed" },
      { id: "open-esc", l: "Open Escalations", v: d.core_escalation.filter((e) => e.discipline === "CIVIL" && e.estatus !== "Resolved").length, c: "#dc2626", red: true }],
    forms: [["core_project", "Core Projects"], ["core_progress", "Working Form"], ["core_target", "Set Target / Send Issue"], ["core_escalation", "Escalation"]],
    grids: [{ id: "progress", title: "Project-wise Progress (DPR sync)", icon: TrendingUp, cols: ["Project", "Location", "Status", "Progress"], rows: rows.map((r) => ({ cells: [<b>{r.name}</b>, r.location || "—", r.pstatus || "—", <Bar pct={r.pct} c={c} />] })) },
      { id: "entries", title: "Latest Working Entries", cols: ["Doc No", "Module", "Aaj", "Cumulative", "%"], rows: W.slice(0, 10).map((w) => ({ cells: [w.docNo, w.module, `${w.todayQty} ${w.unit || ""}`, w.cumQty, w.progressPct] })) }],
  };
};

const ohe = ({ d, c }) => {
  const P = d.core_project.filter((p) => p.discipline === "OHE");
  const W = d.core_progress.filter((w) => w.discipline === "OHE");
  const km = (w) => ["Km"].includes(w.unit);
  const t = today();
  const overdue = d.core_block.filter((b) => b.bstatus === "Requested" && b.date < t).length + d.core_escalation.filter((e) => e.discipline === "OHE" && e.estatus !== "Resolved" && e.targetDate && e.targetDate < t).length;
  return {
    kpis: [{ id: "running", l: "Running OHE Projects", v: P.filter((p) => ["Running", "Active"].includes(p.pstatus)).length, c },
      { id: "value", l: "Cumulative OHE Contract Value", v: inr(sum(P, (p) => p.value)), c: "#15803d" },
      { id: "avg", l: "Avg Chainage Progress", v: `${avg(P.map((p) => latestPct(p, W, km)))}%`, c: "#7c3aed" },
      { id: "overdue", l: "Overdue Blocks / Escalations", v: overdue, c: "#dc2626", red: overdue > 0 }],
    forms: [["core_project", "Core Projects"], ["core_block", "Block Request (Power / Traffic)"], ["core_escalation", "Critical Delay Escalation"], ["core_drum", "Drum Entry"], ["core_progress", "Working Form"]],
    grids: [{ id: "km", title: "Km-wise Foundation & Wiring Progress", icon: TrendingUp, cols: ["Project", "Km", "Mast Foundation", "Catenary Wiring", "Contact Wire"],
      rows: P.map((p) => ({ cells: [<b>{p.name}</b>, `${p.kmFrom || "—"} – ${p.kmTo || "—"}`, <Bar pct={modPct(p, W, "Mast Foundation")} c={c} />, <Bar pct={modPct(p, W, "Catenary Wiring")} c="#0ea5e9" />, <Bar pct={modPct(p, W, "Contact Wire")} c="#7c3aed" />] })) },
      { id: "drum", title: "Copper Wire Drum Utilisation (Store vs Site)", cols: ["Drum", "Wire", "Store", "Site", "Balance", "Util %"],
        rows: d.core_drum.map((r) => ({ bg: n(r.balance) < 0 ? "#fef2f2" : undefined, cells: [r.drumNo, r.wireType, r.storeQty, r.siteConsumed, r.balance, <Bar pct={r.utilPct} c="#b45309" />] })) }],
  };
};

const elec = ({ d, c }) => {
  const S = d.core_substation;
  const t = today();
  return {
    kpis: [{ id: "ss", l: "Active Sub-stations (TSS/SP/SSP)", v: S.filter((s) => s.sstatus === "Active").length, c },
      { id: "asset", l: "Total Electrical Asset Value", v: inr(sum(S, (s) => s.assetValue)), c: "#15803d" },
      { id: "insp", l: "Pending Safety Inspections", v: S.filter((s) => s.inspStatus !== "Done").length, c: "#dc2626", red: true }],
    forms: [["core_project", "Core Projects"], ["core_equip_test", "Equipment Test"], ["core_amc", "AMC Schedule"], ["core_substation", "Sub-station"], ["core_progress", "Working Form"]],
    grids: [{ id: "tests", title: "Equipment Testing Log (IR / Earth Resistance)", cols: ["Date", "Equipment", "Tag", "Test", "Measured", "Result"],
      rows: d.core_equip_test.map((r) => ({ cells: [r.date, r.equipment, r.serialNo, r.testType, `${r.measured || ""} / ${r.limit || ""}`, <Chip t={r.result} c={r.result === "Pass" ? "#16a34a" : "#dc2626"} />] })) },
      { id: "amc", title: "Preventive Maintenance (AMC) Calendar", cols: ["Next Due", "Asset", "Location", "Frequency", "Status"],
        rows: [...d.core_amc].sort((a, b) => (a.nextDue || "").localeCompare(b.nextDue || "")).map((r) => ({ bg: r.astatus !== "Done" && r.nextDue < t ? "#fef2f2" : undefined, cells: [r.nextDue, r.asset, r.location, r.frequency, r.astatus !== "Done" && r.nextDue < t ? <Chip t="OVERDUE" c="#dc2626" /> : r.astatus] })) }],
  };
};

const proc = ({ d, c }) => {
  const m = today().slice(0, 7);
  const stage = (i) => {
    const po = d.proc_po.filter((p) => p.indentNo === i.docNo && open(p));
    const grn = d.proc_grn.filter((g) => po.some((p) => [p.docNo, p.permNo, p.tempNo].includes(g.poNo)) && open(g));
    const cs = d.proc_cs.filter((x) => x.indentNo === i.docNo && open(x));
    const rfq = d.proc_rfq.filter((x) => x.indentNo === i.docNo && open(x));
    const s = grn.length ? "GRN" : po.length ? "PO" : cs.length ? "CS" : rfq.length ? "RFQ" : "Indent";
    return [i.docNo, i.material, i.qty, rfq[0]?.docNo || "—", cs[0]?.docNo || "—", po[0]?.docNo || "—", sum(grn, (g) => g.acceptedQty), <Chip t={s} c={s === "GRN" ? "#16a34a" : "#d97706"} />];
  };
  return {
    kpis: [{ id: "indents", l: "Global Pending Indents", v: d.indent.filter((i) => !["Approved", "Rejected"].includes(i.status)).length, c: "#dc2626" },
      { id: "rfq", l: "Floating RFQs", v: d.proc_rfq.filter((r) => (r.rstatus || "Floating") === "Floating" && open(r)).length, c: "#d97706" },
      { id: "po", l: "Current Month PO Value", v: inr(sum(d.proc_po.filter((p) => p.status === "Approved" && (p.date || "").startsWith(m)), (p) => p.total)), c }],
    forms: [["proc_rfq", "RFQ"], ["proc_po", "PO Authorization"], ["proc_grn", "Store GRN"], ["stock_count", "Stock Register"]],
    grids: [{ id: "lifecycle", span: true, title: "Indent-to-PO Lifecycle", cols: ["Indent", "Material", "Qty", "RFQ", "CS", "PO", "GRN Qty", "Stage"], rows: d.indent.slice(0, 20).map((i) => ({ cells: stage(i) })) },
      { id: "cs", title: "Comparative Statement (CS) Approval Panel", cols: ["CS No", "Material", "L1 Vendor", "L1 Value", "Status"], rows: d.proc_cs.map((x) => ({ cells: [x.docNo, x.material, x.l1Vendor, inr(x.l1Total), x.status] })) },
      { id: "po-gate", title: "PO Authorization Gateway", cols: ["PO No", "Vendor", "Material", "Value", "Status"], rows: d.proc_po.filter((p) => p.status !== "Approved").map((p) => ({ cells: [p.docNo, p.vendorCode, p.material, inr(p.total), p.status] })) }],
    fraud: true,
  };
};

const hr = ({ d, c }) => {
  const emps = getEmployees().filter((e) => !/exit|left|resign|terminat/i.test(`${e.status || ""} ${e.empStatus || ""}`));
  const lab = d.labour.filter((l) => (l.lstatus || "Active") === "Active");
  const t = today();
  const key = `${t.slice(0, 4)}${t.slice(5, 7)}`;
  const att = getAttendance().filter((a) => String(a.id || "").endsWith(`_${key}`) && a.days && a.days[t.slice(8, 10)]);
  const marked = new Set(att.map((a) => a.empId));
  const geo = d.geo_att.filter((g) => (g.at || "").slice(0, 10) === t);
  const sites = Object.values(geo.reduce((m, g) => { const s = (m[g.siteName] = m[g.siteName] || { site: g.siteName, n: 0, last: "", lat: g.lat, lng: g.lng }); s.n += 1; if ((g.at || "") > s.last) s.last = g.at; return m; }, {}));
  return {
    kpis: [{ id: "manpower", l: "Total On-Site Manpower (Staff + Labour)", v: `${emps.length + lab.length}`, c },
      { id: "att", l: "Attendance Compliance (Today)", v: `${emps.length ? Math.round((emps.filter((e) => marked.has(e.id)).length / emps.length) * 100) : 0}%`, c: "#0369a1" },
      { id: "tickets", l: "Open HR Tickets", v: d.core_hr_ticket.filter((x) => x.tstatus !== "Closed").length, c: "#dc2626", red: true }],
    forms: [["core_payroll_freeze", "Payroll Freeze & Salary Release"], ["core_hr_ticket", "HR Ticket"]],
    grids: [{ id: "geo", title: "Live Site Manpower Geo-Mapping (Today)", cols: ["Site", "Present", "Last Check-in", "Location"],
      rows: sites.map((s) => ({ cells: [<b>{s.site}</b>, s.n, new Date(s.last).toLocaleTimeString("en-IN"), s.lat ? <a href={`https://maps.google.com/?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">Map</a> : "—"] })) },
      { id: "payroll", title: "Monthly Payroll Freeze (→ Accounts Manager)", cols: ["Doc", "Month", "Emp", "Net", "Status"], rows: d.core_payroll_freeze.map((p) => ({ cells: [p.docNo, p.month, p.employees, inr(p.netPayable), p.status === "Approved" ? <Chip t="FROZEN · Sent to Accounts" c="#16a34a" /> : p.status] })) }],
  };
};

const legal = ({ d, c }) => {
  const act = d.core_bg.filter((b) => b.bgstatus === "Active");
  const left = (x) => Math.ceil((new Date(x).getTime() - Date.now()) / 86400000);
  const soon = act.filter((b) => b.expiryDate && left(b.expiryDate) < 30);
  const tl = [...d.core_bg.map((b) => ({ dt: b.expiryDate, w: `BG ${b.bgNo} expiry`, p: b.projectName, a: b.amount })), ...d.agreement.map((a) => ({ dt: a.endDate, w: `${a.atype} end · ${a.party}`, p: a.project, a: a.value }))]
    .filter((x) => x.dt).sort((a, b) => a.dt.localeCompare(b.dt));
  return {
    kpis: [{ id: "bg", l: "Active BG / PG", v: act.length, c }, { id: "bg-30", l: "BGs Maturing < 30 Days", v: soon.length, c: "#dc2626", red: soon.length > 0 },
      { id: "claims", l: "Open Legal / Arbitration Claims", v: d.core_claim.filter((x) => x.cstatus !== "Closed").length, c: "#b45309" }],
    forms: [["core_bg", "Bank Guarantee"], ["core_eot", "EOT Application"], ["core_claim", "Legal Claim"]],
    grids: [{ id: "timeline", title: "Contract & BG Expiry Timeline", cols: ["Date", "Event", "Project", "Value", "Days"],
      rows: tl.map((x) => ({ bg: left(x.dt) < 30 && left(x.dt) >= 0 ? "#fef2f2" : undefined, cells: [x.dt, x.w, x.p || "—", inr(x.a), left(x.dt)] })) },
      { id: "eot", title: "Railway EOT Application Tracker", cols: ["EOT", "Project", "Original", "Requested", "Days", "Status"], rows: d.core_eot.map((e) => ({ cells: [e.eotNo || e.docNo, e.projectName, e.originalDate, e.requestedDate, e.days, e.estatus2] })) }],
  };
};

const fin = ({ d, c }) => {
  const pays = getPayments();
  const paid = (id) => sum(pays.filter((p) => p.billId === id && (p.paidFinal || p.status === "Approved")), (p) => p.amount);
  const payable = sum(getBills().filter((b) => n(b.step) >= 5), (b) => Math.max(0, computeBill(b).netPayable - paid(b.id)));
  const cnt = (f) => pays.filter(f).length;
  const pl = Object.values([...d.core_ra_bill.map((r) => [r.projectName, n(r.passed), 0]), ...d.proc_po.filter((p) => p.status === "Approved").map((p) => [p.project, 0, n(p.total)]), ...d.labour_bill.map((l) => [l.project, 0, n(l.totalAmount)])]
    .reduce((m, [p, r, x]) => { if (!p) return m; const o = (m[p] = m[p] || { p, r: 0, x: 0 }); o.r += r; o.x += x; return m; }, {}));
  const mx = Math.max(1, ...pl.map((o) => Math.max(o.r, o.x)));
  return {
    kpis: [{ id: "recv", l: "Outstanding Client Receivables", v: inr(sum(d.core_ra_bill, (r) => r.outstanding)), c, red: true },
      { id: "payables", l: "Total Vendor Payables", v: inr(payable), c: "#b45309" },
      { id: "pv", l: "Vouchers Matrix (Draft / Approved / Final Paid)", v: `${cnt((p) => !p.paidFinal && p.status !== "Approved")} / ${cnt((p) => !p.paidFinal && p.status === "Approved")} / ${cnt((p) => p.paidFinal)}`, c: "#0369a1" }],
    forms: [["core_ra_bill", "RA Bill / MB Entry"], ["proc_invoice", "3-Way Match (PO + GRN + Bill)"], ["core_payroll_freeze", "Payroll Release Review"]],
    links: [["Vendor Bill Process", "/bill"], ["Expenses", "/bill?view=expense"], ["Advance Reg.", "/bill?view=advance"], ["Pay Bills Process", "/bill?view=paybill"], ["Weekly Fooding", "/bill?view=fooding"], ["Exit & F&F", "/bill?view=exit"], ["Payment Vouchers & Due List", "/final"], ["Finance Requisitions", "/requisitions"]],
    grids: [{ id: "ra", span: true, title: "Railway RA Billing & MB Reconciliation Matrix", cols: ["RA No", "MB No", "Project", "Claimed", "Passed", "TDS", "SD", "Net", "Claimed − Passed", "Outstanding"],
      rows: d.core_ra_bill.map((r) => ({ bg: n(r.diff) > 0 ? "#fff7ed" : undefined, cells: [r.raNo, r.mbNo, r.projectName, inr(r.claimed), inr(r.passed), inr(r.tds), inr(r.sd), inr(r.net), inr(r.diff), inr(r.outstanding)] })) },
      { id: "pl", span: true, title: "Project-wise P&L (Revenue = RA Passed · Cost = PO + Labour)", icon: TrendingUp, cols: ["Project", "Revenue vs Cost", "P&L"],
        rows: pl.map((o) => ({ cells: [<b>{o.p}</b>, <div style={{ minWidth: 220 }}><div style={{ height: 8, width: `${(o.r / mx) * 100}%`, background: "#16a34a", borderRadius: 99, marginBottom: 3 }} /><div style={{ height: 8, width: `${(o.x / mx) * 100}%`, background: "#dc2626", borderRadius: 99 }} /><span style={{ fontSize: 10 }}>{inr(o.r)} / {inr(o.x)}</span></div>, <b style={{ color: o.r - o.x >= 0 ? "#16a34a" : "#dc2626" }}>{inr(o.r - o.x)}</b>] })) }],
  };
};

export const BOARDS = { "Member Civil": civil, "Member OHE": ohe, "Member Electrical": elec, "Member Procurement": proc, "Member HR & Admin": hr, "Member Legal": legal, "Member Financial": fin };

export default function SpecBoard({ member, meta, allowed }) {
  const [d, setD] = useState(null);
  const [modal, setModal] = useState("");
  const nav = useNavigate();
  const load = () => Promise.all(KINDS.map((k) => apiOpsList(k).catch(() => []))).then((r) => setD(Object.fromEntries(KINDS.map((k, i) => [k, r[i]]))));
  useEffect(() => { load(); }, []);
  if (!d) return <div style={card}>Loading…</div>;
  const b = BOARDS[member]({ d, c: meta.c });
  return (
    <div data-testid={`core-board-${member.replace(/[^a-z]+/gi, "-").toLowerCase()}`}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 12, borderLeft: `5px solid ${meta.c}`, flexWrap: "wrap" }}>
        <meta.icon size={26} color={meta.c} />
        <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>{member} · Working Dashboard</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {b.forms.map(([k, l]) => <button key={k} data-testid={`core-form-btn-${k}`} onClick={() => setModal(k)} style={{ padding: "7px 12px", background: meta.c, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" }}><ClipboardList size={13} /> {l}</button>)}
        </div>
      </div>
      {b.links && (
        <div style={{ ...card, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }} data-testid="core-fin-links">
          <b style={{ fontSize: 12, marginRight: 6 }}>Financial Functions:</b>
          {b.links.map(([l, p]) => <button key={p} data-testid={`core-link-${l.replace(/[^a-z]+/gi, "-").toLowerCase()}`} onClick={() => nav(p)} style={{ padding: "6px 12px", border: `1px solid ${meta.c}`, color: meta.c, background: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>{l}</button>)}
        </div>
      )}
      <Kpis items={b.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>{b.grids.map((g) => <Grid key={g.id} {...g} />)}</div>
      {b.fraud && <FraudPanel />}
      {modal && <FormModal kind={modal} allowed={allowed} onClose={() => { setModal(""); load(); }} />}
    </div>
  );
}
