import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity } from "lucide-react";
import { getVendors, getBills, getPayments, getExpenses, getEmployees, getBOQs, getWOs } from "../lib/store";
import { apiOpsList } from "../lib/api";

const C = { done: "#16a34a", pending: "#f59e0b", draft: "#94a3b8", rejected: "#dc2626" };
const L = { done: "Approved / Done", pending: "Pending Approval", draft: "Draft / In Process", rejected: "Rejected" };
const byStep = (pend, done) => (r) => { const s = Number(r.step) || 1; return s >= done ? "done" : s === pend ? "pending" : "draft"; };
const byStatus = (r) => ({ Approved: "done", Submitted: "pending", Rejected: "rejected" }[r.status] || "draft");
const OPS_ROWS = [
  ["dpr", "DPR", "/site", "6"], ["indent", "Material Indent", "/site", "6"], ["qc_test", "QC Lab Tests", "/qc-safety", "7"], ["safety_audit", "Safety Audits", "/qc-safety", "7"],
  ["machine_log", "Running Hours", "/plant", "8"], ["diesel_log", "Diesel Log", "/plant", "8"], ["booking", "Bookings", "/client-revenue", "2"], ["tender", "Tenders", "/client-revenue", "2"],
  ["agreement", "Agreements", "/client-revenue", "2"], ["labour_bill", "Wage Bills", "/hr", "3"],
];

export default function HomeProgressChart({ tick }) {
  const nav = useNavigate();
  const [ops, setOps] = useState({});
  useEffect(() => {
    Promise.all(OPS_ROWS.map(([k]) => apiOpsList(k).catch(() => []))).then((r) => setOps(Object.fromEntries(OPS_ROWS.map(([k], i) => [k, r[i]]))));
  }, [tick]);
  const rows = [
    { l: "Vendors", d: "4", to: "/purchase", list: getVendors(), f: byStep(2, 3) },
    { l: "BOQ", d: "4", to: "/purchase?tab=boq", list: getBOQs(), f: byStep(3, 4) },
    { l: "Work Orders", d: "4", to: "/purchase?tab=wo", list: getWOs(), f: byStep(3, 4) },
    { l: "Vendor Bills", d: "5", to: "/bill", list: getBills(), f: byStep(4, 5) },
    { l: "Expenses", d: "5", to: "/bill?view=expense", list: getExpenses(), f: byStep(3, 4) },
    { l: "Payment Vouchers", d: "5", to: "/final", list: getPayments(), f: byStatus },
    { l: "HR Employees", d: "3", to: "/hr", list: getEmployees(), f: byStep(4, 5) },
    ...OPS_ROWS.map(([k, l, to, d]) => ({ l, d, to, list: ops[k] || [], f: byStatus })),
  ].map((r) => {
    const c = { done: 0, pending: 0, draft: 0, rejected: 0 };
    r.list.forEach((x) => { c[r.f(x)] += 1; });
    return { ...r, c, total: r.list.length, pct: r.list.length ? Math.round((c.done / r.list.length) * 100) : 0 };
  });
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div data-testid="home-progress-chart" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.4 }}><Activity size={15} color="#4f46e5" /> Work Progress · Module-wise</div>
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
  );
}
