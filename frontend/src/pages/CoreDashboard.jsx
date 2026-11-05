import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { HardHat, Zap, Cable, ShoppingCart, Lock, AlertTriangle, FolderKanban, TrendingUp, ClipboardList, Users2, Scale, Wallet, Settings2, Plus, Trash2 } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import OpsModule from "../components/ops/OpsModule";
import { apiMe, apiOpsList, apiCoreConfigSave, apiCoreConfigHistory } from "../lib/api";
import { currentRole, getVendors, getBills, getWOs } from "../lib/store";
import { MEMBER_DISC, CORE_MEMBERS, CORE_DISC, CORE_MODULES, CORE_CUSTOM, OPS, loadCoreConfig } from "../components/ops/opsConfig";

const META0 = {
  "Member Civil": { icon: HardHat, c: "#b45309" },
  "Member OHE": { icon: Cable, c: "#1d4ed8" },
  "Member Electrical": { icon: Zap, c: "#7c3aed" },
  "Member Procurement": { icon: ShoppingCart, c: "#15803d" },
  "Member HR & Admin": { icon: Users2, c: "#db2777" },
  "Member Legal": { icon: Scale, c: "#475569" },
  "Member Financial": { icon: Wallet, c: "#0f766e" },
};
const META = new Proxy(META0, { get: (o, k) => o[k] || { icon: Users2, c: "#0369a1" } });
const inr = (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`;
const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 };
const th = { padding: 6, textAlign: "left", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 11 };
const td = { padding: 6, borderBottom: "1px solid #f1f5f9", fontSize: 11.5 };

const projectProgress = (p, work) => {
  const latest = {};
  work.filter((w) => w.project === p.name).forEach((w) => {
    if (!latest[w.module] || (w.date || "") >= (latest[w.module].date || "")) latest[w.module] = w;
  });
  const vals = Object.values(latest).map((w) => Number(w.progressPct) || 0);
  return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
};

const Kpi = ({ l, v, c, id }) => (
  <div style={{ ...card, borderTop: `3px solid ${c}` }} data-testid={`core-kpi-${id}`}>
    <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>{l}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color: c, marginTop: 4 }}>{v}</div>
  </div>
);

const ProcurementKpis = ({ indents }) => {
  const v = getVendors(), b = getBills(), w = getWOs();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
      <Kpi id="vendor-pending" l="Vendor Approval Pending" v={v.filter((x) => x.step === 2).length} c="#0ea5e9" />
      <Kpi id="wo-total" l="Work Orders" v={w.length} c="#15803d" />
      <Kpi id="bill-pending" l="Bills Pending" v={b.filter((x) => Number(x.step) < 5).length} c="#d97706" />
      <Kpi id="indent-pending" l="Material Indent Pending" v={indents.filter((x) => x.status !== "Approved" && x.status !== "Rejected").length} c="#dc2626" />
    </div>
  );
};

const MemberBoard = ({ member, data, go }) => {
  const disc = MEMBER_DISC[member];
  const m = META[member];
  const projects = data.projects.filter((p) => disc.includes(p.discipline));
  const work = data.work.filter((w) => disc.includes(w.discipline));
  const esc = data.esc.filter((e) => disc.includes(e.discipline));
  const open = esc.filter((e) => e.estatus !== "Resolved");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = open.filter((e) => e.targetDate && e.targetDate < today);
  const rows = projects.map((p) => ({ ...p, pct: projectProgress(p, work) }));
  const avg = rows.length ? (rows.reduce((a, r) => a + r.pct, 0) / rows.length).toFixed(1) : 0;
  return (
    <div data-testid={`core-board-${member.replace(/\s+/g, "-").toLowerCase()}`}>
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12, marginBottom: 12, borderLeft: `5px solid ${m.c}` }}>
        <m.icon size={26} color={m.c} />
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>{member} · Working Dashboard</div>
          <div style={{ fontSize: 12, color: "#475569" }}>Disciplines: {disc.join(" · ")}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button data-testid="core-open-working" onClick={() => go("core_progress")} style={{ padding: "7px 12px", background: m.c, color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center" }}><ClipboardList size={13} /> Working Form / Escalation</button>
        </div>
      </div>
      {member === "Member Procurement" && <ProcurementKpis indents={data.indents} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
        <Kpi id="projects" l="Core Projects" v={projects.length} c={m.c} />
        <Kpi id="running" l="Running" v={projects.filter((p) => p.pstatus === "Running").length} c="#0369a1" />
        <Kpi id="value" l="Contract Value" v={inr(projects.reduce((a, p) => a + (Number(p.value) || 0), 0))} c="#15803d" />
        <Kpi id="avg" l="Avg Progress" v={`${avg}%`} c="#7c3aed" />
        <Kpi id="open-esc" l="Open / Overdue Escalations" v={`${open.length} / ${overdue.length}`} c="#dc2626" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><TrendingUp size={14} /> Project-wise Progress</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Project</th><th style={th}>Disc.</th><th style={th}>Status</th><th style={th}>Progress</th></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>Abhi koi core project nahi</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} data-testid={`core-prj-${r.id}`}>
                  <td style={td}><b>{r.name}</b><div style={{ fontSize: 10, color: "#64748b" }}>{r.docNo} · {r.location || "—"}</div></td>
                  <td style={td}>{r.discipline}</td><td style={td}>{r.pstatus || "—"}</td>
                  <td style={{ ...td, minWidth: 140 }}><div style={{ height: 8, background: "#e2e8f0", borderRadius: 99 }}><div style={{ width: `${r.pct}%`, height: 8, background: m.c, borderRadius: 99 }} /></div><span style={{ fontSize: 10.5, fontWeight: 700 }}>{r.pct}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} color="#dc2626" /> Open Escalations</div>
          {!open.length && <div style={{ fontSize: 12, color: "#94a3b8" }}>Koi open escalation nahi</div>}
          {open.slice(0, 8).map((e) => (
            <div key={e.id} data-testid={`core-esc-${e.id}`} style={{ padding: "6px 8px", borderLeft: `3px solid ${e.targetDate && e.targetDate < today ? "#dc2626" : "#f59e0b"}`, background: "#f8fafc", marginBottom: 6, fontSize: 11.5 }}>
              <b>{e.issue}</b><div style={{ color: "#475569", fontSize: 10.5 }}>{e.project} · {e.priority} · {e.level} · {e.daysOpen || 0} din{e.suggested && e.suggested !== e.level ? ` · Escalate: ${e.suggested}` : ""}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><FolderKanban size={14} /> Latest Working Entries</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Doc No", "Date", "Project", "Module", "Aaj", "Cumulative", "%"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {!work.length && <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8" }}>Abhi koi entry nahi</td></tr>}
            {work.slice(0, 10).map((w) => <tr key={w.id}><td style={td}>{w.docNo}</td><td style={td}>{w.date}</td><td style={td}>{w.project}</td><td style={td}>{w.module}</td><td style={td}>{w.todayQty} {w.unit}</td><td style={td}>{w.cumQty}</td><td style={td}>{w.progressPct}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CoreSetup = ({ onSaved }) => {
  const [rows, setRows] = useState(() => Object.entries(MEMBER_DISC).map(([m, d]) => ({ m, d: d.join(", ") })));
  const [extra, setExtra] = useState(() => Object.entries(CORE_CUSTOM).flatMap(([d, ms]) => ms.map((m) => `${d} | ${m[0]} | ${m[1]}`)).join("\n"));
  const save = async () => {
    const members = {};
    rows.filter((r) => r.m.trim()).forEach((r) => { members[r.m.trim().startsWith("Member ") ? r.m.trim() : `Member ${r.m.trim()}`] = r.d.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean); });
    const modules = {};
    extra.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => { const [disc, mod, unit] = l.split("|").map((x) => (x || "").trim()); if (disc && mod) (modules[disc.toUpperCase()] = modules[disc.toUpperCase()] || []).push([mod, unit || "Nos"]); });
    try { await apiCoreConfigSave({ members, modules }); await loadCoreConfig(); toast.success("Core setup saved"); onSaved(); } catch (e) { toast.error(e.message); }
  };
  const inp = { padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12 };
  return (
    <div style={card} data-testid="core-setup">
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Core Members Setup (SuperAdmin)</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Naya member jodein: naam (jaise "Member Safety") aur uske discipline (comma se). Save ke baad yeh role User banate waqt bhi milega.</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 6, marginBottom: 6 }}>
          <input data-testid={`core-setup-member-${i}`} style={inp} value={r.m} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, m: e.target.value } : y)))} />
          <input data-testid={`core-setup-disc-${i}`} style={inp} value={r.d} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, d: e.target.value } : y)))} />
          <button data-testid={`core-setup-del-${i}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 6, cursor: "pointer" }}><Trash2 size={13} /></button>
        </div>
      ))}
      <button data-testid="core-setup-add" onClick={() => setRows((x) => [...x, { m: "Member ", d: "" }])} style={{ padding: "6px 12px", border: "1px dashed #1d4ed8", color: "#1d4ed8", background: "#fff", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}><Plus size={13} /> Member jodein</button>
      <div style={{ fontWeight: 800, fontSize: 12, margin: "14px 0 4px" }}>Naye discipline ke Modules (har line: DISCIPLINE | Module | Unit)</div>
      <div style={{ fontSize: 10.5, color: "#64748b", marginBottom: 4 }}>Built-in: {CORE_DISC.filter((d) => CORE_MODULES[d]).join(" · ")}</div>
      <textarea data-testid="core-setup-modules" rows={4} style={{ ...inp, width: "100%", boxSizing: "border-box" }} placeholder={"SAFETY | Safety Audit | Nos\nSAFETY | Toolbox Talk | Nos"} value={extra} onChange={(e) => setExtra(e.target.value)} />
      <div style={{ marginTop: 8 }}><button data-testid="core-setup-save" onClick={save} style={{ padding: "8px 16px", background: "#0b1f4d", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>Save Setup</button></div>
    </div>
  );
};

const SetupHistory = ({ rev }) => {
  const [h, setH] = useState([]);
  useEffect(() => { apiCoreConfigHistory().then(setH).catch(() => {}); }, [rev]);
  return (
    <div style={{ ...card, marginTop: 12 }} data-testid="core-setup-history">
      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Setup Change History</div>
      {!h.length && <div style={{ fontSize: 12, color: "#94a3b8" }}>Abhi koi badlav record nahi hua</div>}
      {h.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>Kab</th><th style={th}>Kisne</th><th style={th}>Kya badla</th></tr></thead>
          <tbody>
            {h.map((x) => (
              <tr key={x.id} data-testid={`core-hist-${x.id}`}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>{new Date(x.at).toLocaleString("en-IN")}</td>
                <td style={td}><b>{x.byName}</b><div style={{ fontSize: 10, color: "#64748b" }}>{x.by}</div></td>
                <td style={td}>{(x.changes || []).map((c, i) => <div key={i} style={{ color: c.startsWith("+") ? "#15803d" : c.startsWith("-") ? "#dc2626" : "#0f172a" }}>{c}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default function CoreDashboard() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [me, setMe] = useState(null);
  const [, setRev] = useState(0);
  const [histRev, setHistRev] = useState(0);
  const [data, setData] = useState({ projects: [], work: [], esc: [], indents: [] });
  const [tab, setTab] = useState("");
  const [sec, setSec] = useState(sp.get("kind") || "dash");
  const openId = sp.get("rid") || "";
  useEffect(() => { if (sp.get("kind")) setSec(sp.get("kind")); }, [sp]);
  const loadData = () => Promise.all(["core_project", "core_progress", "core_escalation", "indent"].map((k) => apiOpsList(k).catch(() => [])))
    .then(([projects, work, esc, indents]) => setData({ projects, work, esc, indents }));
  useEffect(() => {
    apiMe().then(setMe).catch(() => setMe({}));
    loadCoreConfig().then(() => setRev((v) => v + 1)).catch(() => {});
    loadData();
  }, []);
  const go = (k) => { setSec(k); nav(`/core-dashboard?kind=${k}`); };
  const tabs = (() => {
    if (!me) return [];
    const role = currentRole();
    if (role === "SuperAdmin" || role === "GM" || me.core_all) return [...CORE_MEMBERS];
    return MEMBER_DISC[me.role] ? [me.role] : [];
  })();
  const active = tabs.includes(tab) ? tab : tabs[0];
  const role = currentRole();
  const discAllowed = role === "SuperAdmin" || role === "GM" || me?.core_all ? CORE_DISC : MEMBER_DISC[me?.role] || [];
  const SECS = [["dash", "Dashboard"], ["core_project", "Core Projects"], ["core_progress", "Working Form"], ["core_escalation", "Escalation"], ["setup", "Core Setup"]];
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid="core-dashboard" style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 80px" }}>
        <ModuleHero tag="Core Committee" title="Core Committee Dashboard" subtitle="Member Civil · Member OHE · Member Electrical · Member Procurement — sirf GM aur assigned member" icon={FolderKanban} gradient="linear-gradient(135deg,#0b1f4d 0%,#1d4ed8 55%,#c81e2b 100%)" shadowRgba="29,78,216,.28" />
        {me && !tabs.length && OPS[sec] && openId && <div style={{ marginTop: 12 }} data-testid="core-assigned-work"><OpsModule cfg={OPS[sec]} openId={openId} /></div>}
        {me && !tabs.length && !(OPS[sec] && openId) && (
          <div data-testid="core-not-permitted" style={{ ...card, marginTop: 14, textAlign: "center", padding: 40 }}>
            <Lock size={30} color="#dc2626" /><div style={{ fontWeight: 800, marginTop: 8 }}>Not Permitted</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Yeh dashboard sirf GM, SuperAdmin aur assigned Core Member dekh sakte hain.</div>
          </div>
        )}
        {tabs.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
              {SECS.map(([k, l]) => (
                <button key={k} data-testid={`core-sec-${k}`} onClick={() => { if (k === "setup" && role !== "SuperAdmin") toast.error("Not Permitted — Core Setup sirf SuperAdmin ke liye"); if (k === "dash" || k === "setup") { setSec(k); nav("/core-dashboard"); } else go(k); }} style={{ padding: "8px 16px", background: sec === k ? "#0b1f4d" : "#fff", color: sec === k ? "#fff" : "#0b1f4d", border: "1px solid #0b1f4d55", borderRadius: 7, cursor: "pointer", fontWeight: 800, fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center" }}>{k === "setup" && (role === "SuperAdmin" ? <Settings2 size={13} /> : <Lock size={12} />)}{l}</button>
              ))}
            </div>
            {sec === "setup" && role === "SuperAdmin" && <div style={{ marginTop: 12 }}><CoreSetup onSaved={() => { setRev((v) => v + 1); setHistRev((v) => v + 1); }} /><SetupHistory rev={histRev} /></div>}
            {sec === "setup" && role !== "SuperAdmin" && (
              <div data-testid="core-setup-not-permitted" style={{ ...card, marginTop: 12, textAlign: "center", padding: 36 }}>
                <Lock size={28} color="#dc2626" /><div style={{ fontWeight: 800, marginTop: 8 }}>Not Permitted</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Core Setup sirf SuperAdmin ke liye hai.</div>
              </div>
            )}
            {OPS[sec] && <div style={{ marginTop: 12 }}><OpsModule cfg={OPS[sec]} disc={discAllowed} openId={openId} /></div>}
            {sec === "dash" && <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0", padding: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              {tabs.map((t) => (
                <button key={t} data-testid={`core-tab-${t.replace(/\s+/g, "-").toLowerCase()}`} onClick={() => setTab(t)} style={{ padding: "8px 16px", background: active === t ? META[t].c : `${META[t].c}14`, color: active === t ? "#fff" : META[t].c, border: `1px solid ${META[t].c}55`, borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{t}</button>
              ))}
            </div>
            <MemberBoard member={active} data={data} go={go} />
            </>}
          </>
        )}
      </div>
    </>
  );
}
