import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, HardHat, Wallet, Hourglass, BadgeCheck, TrendingUp, ListChecks, PieChart } from "lucide-react";
import { getVendors, getBills, getPayments, getExpenses, getEmployees, getBOQs, getWOs } from "../lib/store";
import { apiOpsList } from "../lib/api";

const C = { done: "#16a34a", pending: "#f59e0b", draft: "#94a3b8", rejected: "#dc2626" };
const L = { done: "Approved", pending: "Pending", draft: "Draft / Process", rejected: "Rejected" };
const DEPT = { 2: ["Client & Revenue", "#0ea5e9"], 3: ["HR & Labour", "#ec4899"], 4: ["Procurement", "#16a34a"], 5: ["Accounts", "#0d9488"], 6: ["Project & Site", "#f97316"], 7: ["QC & Safety", "#8b5cf6"], 8: ["Plant & Machinery", "#ca8a04"] };
const byStep = (pend, done) => (r) => { const s = Number(r.step) || 1; return s >= done ? "done" : s === pend ? "pending" : "draft"; };
const byStatus = (r) => ({ Approved: "done", Submitted: "pending", Rejected: "rejected" }[r.status] || "draft");
const projOf = (r) => r.project || r.projectSite || r.projectName || r.siteName || r.site || "";
const monthOf = (r) => String(r.approvedAt || r.approvalDate || r.gmApprovedAt || r.finalApprovedAt || r.updatedAt || r.createdAt || r.date || "").slice(0, 7);
const n = (v) => Number(v) || 0;
const amt = (r) => n(r.totalAmount) || n(r.total) || n(r.amount) || n(r.netPayable) || n(r.totalValue) || n(r.value) || n(r.grandTotal) || (n(r.basicAmount) + n(r.gstAmount));
const inr = (v) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)} L` : `₹${Math.round(v).toLocaleString("en-IN")}`);
const OPS_ROWS = [
  ["dpr", "DPR", "/site", 6], ["indent", "Material Indent", "/site", 6], ["qc_test", "QC Lab Tests", "/qc-safety", 7], ["safety_audit", "Safety Audits", "/qc-safety", 7],
  ["machine_log", "Running Hours", "/plant", 8], ["diesel_log", "Diesel Log", "/plant", 8], ["booking", "Bookings", "/client-revenue", 2], ["tender", "Tenders", "/client-revenue", 2],
  ["agreement", "Agreements", "/client-revenue", 2], ["labour_bill", "Wage Bills", "/hr", 3],
];
const months6 = () => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7); });
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "10px 14px", boxShadow: "0 1px 3px rgba(15,23,42,.05)", display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, overflow: "hidden" };
const Title = ({ icon: I, c, children, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
    <div style={{ fontWeight: 800, fontSize: 13.5, color: "#1e3a8a", display: "flex", alignItems: "center", gap: 7 }}><I size={15} color={c} />{children}</div>{right}
  </div>
);

const Kpi = ({ icon: I, bg, label, value, l1, l2, testid, onClick }) => (
  <button data-testid={testid} onClick={onClick} style={{ all: "unset", cursor: "pointer", background: bg, color: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 6px 16px rgba(15,23,42,.12)", transition: "transform .15s" }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}><I size={16} />{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, margin: "2px 0" }}>{value}</div>
    <div style={{ fontSize: 11, opacity: 0.92 }}>{l1} · {l2}</div>
  </button>
);

const smooth = (pts) => pts.map((p, i) => {
  if (!i) return `M${p[0]},${p[1]}`;
  const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p;
  return `C${p1[0] + (p[0] - p0[0]) / 6},${p1[1] + (p[1] - p0[1]) / 6} ${p[0] - (p3[0] - p1[0]) / 6},${p[1] - (p3[1] - p1[1]) / 6} ${p[0]},${p[1]}`;
}).join(" ");

const Trend = ({ rows }) => {
  const [mode, setMode] = useState("count");
  const months = months6();
  const series = Object.entries(DEPT).map(([d, [l, c]]) => {
    const recs = rows.filter((r) => String(r.d) === d).flatMap((r) => r.list.filter((x) => r.f(x) === "done"));
    return { d, l, c, v: months.map((m) => recs.filter((x) => monthOf(x) === m).reduce((s, x) => s + (mode === "amount" ? amt(x) : 1), 0)) };
  });
  const max = Math.max(1, ...series.flatMap((s) => s.v));
  const W = 640, H = 240, P = 44, x = (i) => P + (i * (W - P - 16)) / 5, y = (v) => H - 30 - (v / max) * (H - 50);
  const fmt = (v) => (mode === "amount" ? inr(v) : Math.round(v));
  const sw = (k, l) => <button data-testid={`trend-mode-${k}`} onClick={() => setMode(k)} style={{ padding: "4px 12px", border: "none", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer", background: mode === k ? "#1e3a8a" : "transparent", color: mode === k ? "#fff" : "#475569" }}>{l}</button>;
  return (
    <div style={{ ...card, gridRow: "span 3" }} data-testid="home-monthly-trend">
      <Title icon={TrendingUp} c="#0ea5e9" right={<div style={{ background: "#f1f5f9", borderRadius: 999, padding: 3 }}>{sw("count", "Entries")}{sw("amount", "₹ Amount")}</div>}>Monthly Approved Trend</Title>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", fontSize: 11.5, color: "#475569", marginBottom: 4 }}>
        {series.map((s) => <span key={s.d} data-testid={`trend-legend-${s.d}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: s.c, display: "inline-block" }} />{s.l}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", flex: 1, minHeight: 0 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={P} x2={W - 16} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" strokeDasharray="3 4" /><text x={P - 6} y={y(max * t) + 4} fontSize="10" fill="#94a3b8" textAnchor="end">{fmt(max * t)}</text></g>)}
        {months.map((m, i) => <text key={m} x={x(i)} y={H - 8} fontSize="11" fill="#64748b" textAnchor="middle">{new Date(`${m}-01`).toLocaleDateString("en-IN", { month: "short" })}</text>)}
        {series.map((s) => <path key={s.d} d={smooth(s.v.map((v, i) => [x(i), y(v)]))} fill="none" stroke={s.c} strokeWidth="2.5"><title>{`${s.l}: ${s.v.map(fmt).join(" → ")}`}</title></path>)}
      </svg>
    </div>
  );
};

const Donut = ({ title, icon, c, parts, testid, money }) => {
  const total = parts.reduce((s, p) => s + p.v, 0);
  const R = 70, CIR = 2 * Math.PI * R;
  let off = 0;
  return (
    <div style={card} data-testid={testid}>
      <Title icon={icon} c={c}>{title}</Title>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minHeight: 0 }}>
        <svg viewBox="0 0 180 180" style={{ height: "100%", maxHeight: 120, aspectRatio: "1", flexShrink: 0 }}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#f1f5f9" strokeWidth="30" />
          {total > 0 && parts.filter((p) => p.v > 0).map((p) => {
            const len = (p.v / total) * CIR;
            const el = <circle key={p.l} cx="90" cy="90" r={R} fill="none" stroke={p.c} strokeWidth="30" strokeDasharray={`${Math.max(0, len - 3)} ${CIR}`} strokeDashoffset={-off} transform="rotate(-90 90 90)"><title>{`${p.l}: ${money ? inr(p.v) : p.v}`}</title></circle>;
            off += len; return el;
          })}
          <text x="90" y="88" textAnchor="middle" fontSize={money ? 13 : 20} fontWeight="900" fill="#0f172a">{money ? inr(total) : total}</text>
          <text x="90" y="106" textAnchor="middle" fontSize="10" fill="#64748b">Total</text>
        </svg>
        <div style={{ flex: 1, minWidth: 120, display: "grid", gap: 2, alignSelf: "stretch", alignContent: "center", overflowY: "auto", minHeight: 0 }}>
          {parts.map((p) => <div key={p.l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}><i style={{ width: 11, height: 11, borderRadius: 3, background: p.c, display: "inline-block" }} /><span style={{ flex: 1, color: "#334155" }}>{p.l} :</span><b>{money ? inr(p.v) : p.v}</b></div>)}
        </div>
      </div>
    </div>
  );
};

export default function HomeProgressChart({ tick }) {
  const nav = useNavigate();
  const [ops, setOps] = useState({});
  const [proj, setProj] = useState("all");
  useEffect(() => {
    const kinds = [...OPS_ROWS.map(([k]) => k), "projects", "labour_att", "geo_att"];
    Promise.all(kinds.map((k) => apiOpsList(k).catch(() => []))).then((r) => setOps(Object.fromEntries(kinds.map((k, i) => [k, r[i]]))));
  }, [tick]);
  const base = useMemo(() => [
    { l: "Vendors", d: 4, to: "/purchase", list: getVendors(), f: byStep(2, 3), noProj: true },
    { l: "BOQ", d: 4, to: "/purchase?tab=boq", list: getBOQs(), f: byStep(3, 4) },
    { l: "Work Orders", d: 4, to: "/purchase?tab=wo", list: getWOs(), f: byStep(3, 4) },
    { l: "Vendor Bills", d: 5, to: "/bill", list: getBills(), f: byStep(4, 5) },
    { l: "Expenses", d: 5, to: "/bill?view=expense", list: getExpenses(), f: byStep(3, 4) },
    { l: "Payment Vouchers", d: 5, to: "/final", list: getPayments(), f: byStatus },
    { l: "HR Employees", d: 3, to: "/hr", list: getEmployees(), f: byStep(4, 5), noProj: true },
    ...OPS_ROWS.map(([k, l, to, d]) => ({ l, d, to, list: ops[k] || [], f: byStatus })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [ops, tick]);
  const projects = useMemo(() => [...new Set([...(ops.projects || []).map((p) => p.name), ...base.flatMap((r) => r.list.map(projOf))].filter(Boolean))].sort(), [ops, base]);
  const pf = (x) => proj === "all" || projOf(x) === proj;
  const rows = base.filter((r) => proj === "all" || !r.noProj).map((r) => {
    const list = r.list.filter(pf);
    const c = { done: 0, pending: 0, draft: 0, rejected: 0 };
    const a = { done: 0, pending: 0, draft: 0, rejected: 0 };
    list.forEach((x) => { const k = r.f(x); c[k] += 1; a[k] += amt(x); });
    return { ...r, list, c, a, total: list.length, pct: list.length ? Math.round((c.done / list.length) * 100) : 0 };
  });
  const sum = (k, by = "c") => rows.reduce((s, r) => s + r[by][k], 0);
  const today = new Date().toISOString().slice(0, 10), thisMonth = today.slice(0, 7);
  const dpr = (ops.dpr || []).filter(pf);
  const labour = dpr.filter((r) => r.date === today).reduce((s, r) => s + n(r.labourTotal), 0)
    + (ops.labour_att || []).filter((r) => r.date === today && pf(r)).reduce((s, r) => s + n(r.present), 0)
    + (ops.geo_att || []).filter((r) => (r.at || "").slice(0, 10) === today && pf(r)).length;
  const exps = getExpenses().filter(pf);
  const approvedMonth = rows.reduce((s, r) => s + r.list.filter((x) => r.f(x) === "done" && monthOf(x) === thisMonth).length, 0);
  const maxT = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div data-testid="home-dashboard" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", minHeight: 0 }}>
      <div style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 14px", flexShrink: 0 }}>
        <b style={{ fontSize: 14, color: "#1e3a8a" }}>Dashboard · {proj === "all" ? "Sabhi Projects" : proj}</b>
        <select data-testid="progress-project-selector" value={proj} onChange={(e) => setProj(e.target.value)} style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 700 }}>
          <option value="all">All Projects / Sites</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div data-testid="project-snapshot" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, flexShrink: 0 }}>
        <Kpi testid="snap-dpr" icon={ClipboardList} bg="#1d4ed8" label="DPR Reports" value={dpr.length} l1={`${dpr.filter((r) => r.date === today).length} aaj submit hui`} l2={`${dpr.filter((r) => r.status === "Submitted").length} approval baki`} onClick={() => nav("/site")} />
        <Kpi testid="snap-labour" icon={HardHat} bg="#16a34a" label="Labour On-Site" value={labour} l1="Aaj ki DPR + attendance" l2={`${(ops.labour_att || []).filter(pf).length} attendance sheets`} onClick={() => nav("/hr")} />
        <Kpi testid="snap-expenses" icon={Wallet} bg="#f59e0b" label="Expenses" value={inr(exps.reduce((s, x) => s + amt(x), 0))} l1={`${exps.length} entries`} l2={`${exps.filter((x) => (x.date || "").startsWith(thisMonth)).length} is mahine`} onClick={() => nav("/bill?view=expense")} />
        <Kpi testid="snap-pending" icon={Hourglass} bg="#9333ea" label="Pending Approvals" value={sum("pending")} l1={`${inr(sum("pending", "a"))} ka kaam`} l2={`${sum("draft")} draft / process mein`} onClick={() => nav("/gm")} />
        <Kpi testid="snap-approved" icon={BadgeCheck} bg="#db2777" label="Approved (Is Mahine)" value={approvedMonth} l1={`Kul approved: ${sum("done")}`} l2={`${sum("rejected")} rejected`} onClick={() => nav("/reports-hub")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr) minmax(0,.9fr)", gridTemplateRows: "repeat(3, minmax(0,1fr))", gap: 10, flex: 1, minHeight: 360 }}>
        <Trend rows={rows} />
        <div style={{ ...card, gridRow: "span 3" }} data-testid="home-progress-chart">
          <Title icon={ListChecks} c="#4f46e5">Module-wise Work Progress</Title>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 80px", fontSize: 11, fontWeight: 800, color: "#475569", background: "#f1f5f9", padding: "5px 10px", borderRadius: 6, marginBottom: 4, flexShrink: 0 }}><span>Module</span><span>Progress</span><span style={{ textAlign: "right" }}>Done</span></div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {rows.map((r) => (
              <button key={r.l} data-testid={`progress-row-${r.l.toLowerCase().replace(/\W+/g, "-")}`} onClick={() => nav(r.to)} title={`${r.c.done} approved · ${r.c.pending} pending · ${r.c.draft} draft · ${r.c.rejected} rejected`}
                style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 1.2fr 80px", alignItems: "center", gap: 8, padding: "7px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, width: "100%", boxSizing: "border-box" }}>
                <span><b style={{ color: "#0f172a" }}>{r.l}</b><br /><span style={{ fontSize: 10.5, color: DEPT[r.d][1], fontWeight: 700 }}>{DEPT[r.d][0]}</span></span>
                <div style={{ height: 10, background: "#f1f5f9", borderRadius: 999, overflow: "hidden", display: "flex", width: `${Math.max(8, (r.total / maxT) * 100)}%` }}>
                  {["done", "pending", "draft", "rejected"].map((k) => r.c[k] > 0 && <div key={k} style={{ width: `${(r.c[k] / r.total) * 100}%`, background: C[k] }} />)}
                </div>
                <span style={{ textAlign: "right", fontWeight: 700, color: r.total ? "#0f172a" : "#94a3b8" }}>{r.total ? `${r.c.done}/${r.total}` : "—"}</span>
              </button>
            ))}
          </div>
        </div>
        <Donut testid="donut-status" title="Approval Status" icon={PieChart} c="#16a34a" parts={Object.keys(C).map((k) => ({ l: L[k], c: C[k], v: sum(k) }))} />
        <Donut testid="donut-dept" title="Department-wise Entries" icon={PieChart} c="#8b5cf6" parts={Object.entries(DEPT).map(([d, [l, c]]) => ({ l, c, v: rows.filter((r) => String(r.d) === d).reduce((s, r) => s + r.total, 0) }))} />
        <Donut testid="donut-amount" title="Amount Status" icon={PieChart} c="#f59e0b" money parts={Object.keys(C).map((k) => ({ l: L[k], c: C[k], v: sum(k, "a") }))} />
      </div>
    </div>
  );
}
