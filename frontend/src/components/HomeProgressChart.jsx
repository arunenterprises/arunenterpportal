import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, TrendingUp } from "lucide-react";
import { getVendors, getBills, getPayments, getExpenses, getEmployees, getBOQs, getWOs } from "../lib/store";
import { apiOpsList } from "../lib/api";

const C = { done: "#16a34a", pending: "#f59e0b", draft: "#94a3b8", rejected: "#dc2626" };
const L = { done: "Approved / Done", pending: "Pending Approval", draft: "Draft / In Process", rejected: "Rejected" };
const DEPT = { 2: ["Client & Revenue", "#0ea5e9"], 3: ["HR & Labour", "#ec4899"], 4: ["Procurement", "#22c55e"], 5: ["Accounts", "#14b8a6"], 6: ["Project & Site", "#f97316"], 7: ["QC & Safety", "#8b5cf6"], 8: ["Plant & Machinery", "#eab308"] };
const byStep = (pend, done) => (r) => { const s = Number(r.step) || 1; return s >= done ? "done" : s === pend ? "pending" : "draft"; };
const byStatus = (r) => ({ Approved: "done", Submitted: "pending", Rejected: "rejected" }[r.status] || "draft");
const projOf = (r) => r.project || r.projectSite || r.projectName || r.siteName || r.site || "";
const monthOf = (r) => String(r.approvedAt || r.approvalDate || r.gmApprovedAt || r.finalApprovedAt || r.updatedAt || r.createdAt || r.date || "").slice(0, 7);
const OPS_ROWS = [
  ["dpr", "DPR", "/site", 6], ["indent", "Material Indent", "/site", 6], ["qc_test", "QC Lab Tests", "/qc-safety", 7], ["safety_audit", "Safety Audits", "/qc-safety", 7],
  ["machine_log", "Running Hours", "/plant", 8], ["diesel_log", "Diesel Log", "/plant", 8], ["booking", "Bookings", "/client-revenue", 2], ["tender", "Tenders", "/client-revenue", 2],
  ["agreement", "Agreements", "/client-revenue", 2], ["labour_bill", "Wage Bills", "/hr", 3],
];
const lastMonths = (n) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return d.toISOString().slice(0, 7); });
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 };
const head = { fontWeight: 900, fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.4 };

const Trend = ({ rows }) => {
  const months = lastMonths(6);
  const series = Object.entries(DEPT).map(([d, [l, c]]) => {
    const recs = rows.filter((r) => String(r.d) === d).flatMap((r) => r.list.filter((x) => r.f(x) === "done"));
    return { d, l, c, v: months.map((m) => recs.filter((x) => monthOf(x) === m).length) };
  });
  const max = Math.max(1, ...series.flatMap((s) => s.v));
  const W = 640, H = 170, P = 28, x = (i) => P + (i * (W - 2 * P)) / (months.length - 1), y = (v) => H - P - (v / max) * (H - 2 * P);
  return (
    <div style={card} data-testid="home-monthly-trend">
      <div style={{ ...head, marginBottom: 10 }}><TrendingUp size={15} color="#0ea5e9" /> Monthly Progress Trend · Department-wise Approved Kaam</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 220px", gap: 16, alignItems: "center" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 190 }}>
          {[0, 0.5, 1].map((t) => <g key={t}><line x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} stroke="#e2e8f0" /><text x={4} y={y(max * t) + 4} fontSize="10" fill="#94a3b8">{Math.round(max * t)}</text></g>)}
          {months.map((m, i) => <text key={m} x={x(i)} y={H - 8} fontSize="10" fill="#64748b" textAnchor="middle">{new Date(`${m}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</text>)}
          {series.map((s) => (
            <g key={s.d}>
              <polyline fill="none" stroke={s.c} strokeWidth="2.5" points={s.v.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
              {s.v.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.c}><title>{`${s.l} · ${months[i]} · ${v} approved`}</title></circle>)}
            </g>
          ))}
        </svg>
        <div style={{ display: "grid", gap: 5, fontSize: 11.5 }}>
          {series.map((s) => (
            <div key={s.d} data-testid={`trend-legend-${s.d}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 12, height: 4, borderRadius: 2, background: s.c, display: "inline-block" }} />
              <b style={{ flex: 1 }}>{s.l}</b><span style={{ fontWeight: 800 }}>{s.v[s.v.length - 1]}</span><span style={{ color: "#94a3b8" }}>is mahine</span>
            </div>
          ))}
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
    const kinds = [...OPS_ROWS.map(([k]) => k), "projects"];
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
  const rows = base.filter((r) => proj === "all" || !r.noProj).map((r) => {
    const list = proj === "all" ? r.list : r.list.filter((x) => projOf(x) === proj);
    const c = { done: 0, pending: 0, draft: 0, rejected: 0 };
    list.forEach((x) => { c[r.f(x)] += 1; });
    return { ...r, list, c, total: list.length, pct: list.length ? Math.round((c.done / list.length) * 100) : 0 };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <>
      <div data-testid="home-progress-chart" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div style={head}><Activity size={15} color="#4f46e5" /> Work Progress · Module-wise</div>
          <select data-testid="progress-project-selector" value={proj} onChange={(e) => setProj(e.target.value)} style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, fontWeight: 700 }}>
            <option value="all">All Projects / Sites</option>{projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: "flex", gap: 12, fontSize: 11, fontWeight: 700 }}>{Object.keys(C).map((k) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: C[k], display: "inline-block" }} />{L[k]}</span>)}</div>
        </div>
        <div style={{ display: "grid", gap: 7 }}>
          {rows.map((r) => (
            <button key={r.l} data-testid={`progress-row-${r.l.toLowerCase().replace(/\W+/g, "-")}`} onClick={() => nav(r.to)} title={`${r.c.done} done · ${r.c.pending} pending · ${r.c.draft} draft · ${r.c.rejected} rejected`}
              style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "30px 150px 1fr 120px", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>D{r.d}</span>
              <b style={{ color: "#0f172a" }}>{r.l}</b>
              <div style={{ height: 14, background: "#f1f5f9", borderRadius: 999, overflow: "hidden", display: "flex", width: `${Math.max(6, (r.total / max) * 100)}%`, transition: "width .4s ease" }}>
                {["done", "pending", "draft", "rejected"].map((k) => r.c[k] > 0 && <div key={k} style={{ width: `${(r.c[k] / r.total) * 100}%`, background: C[k] }} />)}
              </div>
              <span style={{ fontWeight: 700, color: "#334155", textAlign: "right" }}>{r.total ? `${r.c.done}/${r.total} · ${r.pct}%` : "Abhi koi entry nahi"}</span>
            </button>
          ))}
        </div>
      </div>
      <Trend rows={rows} />
    </>
  );
}
