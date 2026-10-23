import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FolderKanban, Wallet, HardHat, TrendingUp, AlertTriangle, ListChecks, Eye, Check, X } from "lucide-react";
import { apiOpsList, apiOpsSave } from "../lib/api";
import { OPS } from "./ops/opsConfig";

const OPS_ROUTE = { dpr: "/site", indent: "/site", qc_test: "/qc-safety", safety_audit: "/qc-safety", machine: "/plant", machine_log: "/plant", diesel_log: "/plant", booking: "/client-revenue", demand_letter: "/client-revenue", tender: "/client-revenue", agreement: "/client-revenue", labour_bill: "/hr" };
const today = () => new Date().toISOString().slice(0, 10);
const inr = (v) => `₹${Math.round(Number(v) || 0).toLocaleString("en-IN")}`;
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 };
const head = { fontSize: 12, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 };
const sb = (bg) => ({ padding: "4px 10px", background: bg, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 });

const Tile = ({ icon: Icon, label, value, sub, c, testid }) => (
  <div data-testid={testid} style={{ ...card, borderLeft: `5px solid ${c}`, display: "flex", gap: 12, alignItems: "center" }}>
    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${c}1a`, display: "grid", placeItems: "center" }}><Icon size={20} color={c} /></div>
    <div><div style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>{value}</div><div style={{ fontSize: 11, color: "#64748b" }}>{sub}</div></div>
  </div>
);

export default function GmMasterView({ approvals, expenses, canDo, tick }) {
  const nav = useNavigate();
  const [proj, setProj] = useState("all");
  const [d, setD] = useState({ projects: [] });
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const kinds = ["projects", "geo_att", "labour_att", ...Object.keys(OPS_ROUTE)];
    Promise.all(kinds.map((k) => apiOpsList(k).catch(() => []))).then((r) => setD(Object.fromEntries(kinds.map((k, i) => [k, r[i]]))));
  }, [tick, rev]);
  const pf = (r) => proj === "all" || (r.project || "") === proj;
  const t = today();
  const active = (d.projects || []).filter((p) => !["Completed", "Cancelled"].includes(p.status));
  const todayExp = expenses.filter((x) => x.date === t).reduce((s, x) => s + (Number(x.basicAmount) || 0) + (Number(x.gstAmount) || 0), 0);
  const labour = (d.dpr || []).filter((r) => r.date === t && pf(r)).reduce((s, r) => s + (Number(r.labourTotal) || 0), 0) + (d.geo_att || []).filter((r) => (r.at || "").slice(0, 10) === t).length + (d.labour_att || []).filter((r) => r.date === t && pf(r)).reduce((s, r) => s + (Number(r.present) || 0), 0);
  const progress = (d.projects || []).filter((p) => proj === "all" || p.name === proj).map((p) => {
    const last = (d.dpr || []).filter((r) => r.project === p.name && r.progressPct !== "").sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    return { name: p.name, pct: Math.min(100, Number(last?.progressPct ?? p.progress) || 0) };
  });
  const opsItems = Object.keys(OPS_ROUTE).flatMap((k) => (d[k] || []).filter((r) => r.status === "Submitted" && pf(r)).map((r) => ({
    key: `${k}-${r.id}`, type: OPS[k].title, no: r.docNo, party: r.project || r.clientName || r.party || r.machineCode || "", amt: r.totalAmount || r.total || r.totalValue || r.value || r.estValue || "",
    view: () => nav(OPS_ROUTE[k]),
    ok: async () => { try { await apiOpsSave(k, { ...r, status: "Approved" }); toast.success(`${r.docNo} approved`); setRev((v) => v + 1); } catch (e) { toast.error(e.message); } },
    no2: async () => { const why = window.prompt("Reject reason:"); if (why == null) return; try { await apiOpsSave(k, { ...r, status: "Rejected", rejectReason: why || "Rejected" }); toast.success(`${r.docNo} rejected`); setRev((v) => v + 1); } catch (e) { toast.error(e.message); } },
  })));
  const all = [...approvals, ...opsItems];
  const alerts = useMemo(() => {
    const a = [];
    const cnt = (type) => approvals.filter((x) => x.type === type).length;
    ["Voucher", "Bill", "Work Order", "Expense"].forEach((ty) => cnt(ty) && a.push({ c: "#d97706", m: `${cnt(ty)} ${ty}(s) Pending GM Approval` }));
    (d.qc_test || []).filter((r) => r.result === "Fail" && pf(r)).slice(0, 5).forEach((r) => a.push({ c: "#dc2626", m: `Material Quality Test Failed · ${r.material} · ${r.project}` }));
    (d.diesel_log || []).filter((r) => OPS.diesel_log.alert(r) && pf(r)).slice(0, 5).forEach((r) => a.push({ c: "#9a3412", m: `Diesel chori shak · ${r.machineCode} · ${r.excess} Ltr extra (${r.date})` }));
    (d.safety_audit || []).filter((r) => OPS.safety_audit.alert(r) && pf(r)).slice(0, 5).forEach((r) => a.push({ c: "#b91c1c", m: `Safety: ${OPS.safety_audit.alert(r)} · ${r.project} (${r.date})` }));
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvals, d, proj]);

  return (
    <div data-testid="gm-master-view" style={{ marginTop: 16, display: "grid", gap: 12 }}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px" }}>
        <b style={{ fontSize: 13 }}>M/S ARUN ENTERPRISES · Master View</b>
        <label style={{ fontSize: 12, fontWeight: 700, marginLeft: "auto" }}>Project Selector:{" "}
          <select data-testid="gm-project-selector" value={proj} onChange={(e) => setProj(e.target.value)} style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #cbd5e1" }}>
            <option value="all">All Projects</option>{(d.projects || []).map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        <Tile testid="gm-tile-projects" icon={FolderKanban} label="Active Projects" value={String(active.length).padStart(2, "0")} sub={`${(d.projects || []).length} total projects`} c="#0369a1" />
        <Tile testid="gm-tile-expenses" icon={Wallet} label="Today's Expenses" value={inr(todayExp)} sub={`${expenses.filter((x) => x.date === t).length} expense entries aaj`} c="#d97706" />
        <Tile testid="gm-tile-labour" icon={HardHat} label="Total Labour On-Site" value={labour} sub="Aaj ki DPR + Geo + Labour attendance" c="#15803d" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 12 }}>
        <div style={card} data-testid="gm-progress-tracker">
          <div style={head}><TrendingUp size={15} color="#0369a1" /> Live Project Progress Tracker</div>
          {!progress.length && <div style={{ fontSize: 12, color: "#94a3b8" }}>Projects Register mein project jodein</div>}
          {progress.map((p) => (
            <div key={p.name} style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 7 }}>
              <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div style={{ height: 12, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${p.pct}%`, height: "100%", background: p.pct >= 75 ? "#16a34a" : p.pct >= 40 ? "#0ea5e9" : "#f59e0b" }} /></div>
              <span style={{ fontWeight: 700 }}>{p.pct}% Done</span>
            </div>
          ))}
        </div>
        <div style={card} data-testid="gm-critical-alerts">
          <div style={head}><AlertTriangle size={15} color="#dc2626" /> Critical Action Required Alerts</div>
          {!alerts.length && <div style={{ fontSize: 12, color: "#15803d", fontWeight: 700 }}>Sab theek hai — koi critical alert nahi</div>}
          {alerts.map((a, i) => <div key={i} style={{ fontSize: 12, padding: "5px 8px", marginBottom: 5, borderLeft: `4px solid ${a.c}`, background: `${a.c}0f`, fontWeight: 600 }}>{a.m}</div>)}
        </div>
      </div>
      <div style={card} data-testid="gm-approval-grid">
        <div style={head}><ListChecks size={15} color="#7c3aed" /> Pending Approvals · One-Click Action Grid ({all.length})</div>
        {!all.length && <div style={{ fontSize: 12, color: "#94a3b8" }}>Koi pending approval nahi</div>}
        <div style={{ maxHeight: 340, overflowY: "auto" }}>
          {all.map((x) => (
            <div key={x.key} data-testid={`gm-appr-${x.key}`} style={{ display: "grid", gridTemplateColumns: "150px 1fr 120px auto", gap: 8, alignItems: "center", fontSize: 12, padding: "6px 4px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontWeight: 800, color: "#7c3aed" }}>{x.type}</span>
              <span><b>{x.no}</b> {x.party && `· ${x.party}`}</span>
              <span style={{ fontWeight: 700 }}>{x.amt !== "" && x.amt != null ? inr(x.amt) : ""}</span>
              <span style={{ display: "inline-flex", gap: 5 }}>
                <button data-testid={`gm-appr-view-${x.key}`} onClick={x.view} style={sb("#0369a1")}><Eye size={12} /> View</button>
                {canDo && <button data-testid={`gm-appr-ok-${x.key}`} onClick={x.ok} style={sb("#16a34a")}><Check size={12} /> Approve</button>}
                {canDo && <button data-testid={`gm-appr-no-${x.key}`} onClick={x.no2} style={sb("#dc2626")}><X size={12} /> Reject</button>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
