import React, { useMemo, useState, useEffect } from "react";
import { DateInput } from "../components/DateInput";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  FolderKanban, Plus, Save, Trash2, Edit3, CheckCircle2, Clock, AlertCircle,
  Users, Calendar, IndianRupee, FileText, LayoutGrid, List,
} from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import { currentUserProfile, currentRole, canApprove, canDelete, isSuperAdmin } from "../lib/store";
import { apiOpsList, apiOpsSave, apiOpsDelete } from "../lib/api";
import { OPS, PROJECT_FORMS } from "../components/ops/opsConfig";

// ---------- Local persistence (Project Management is a draft layout for now) ----------
const PM_KEY = "ae_vm_projects";
const getProjects = () => { try { return JSON.parse(localStorage.getItem(PM_KEY) || "[]"); } catch { return []; } };
const saveProjects = (list) => { try { localStorage.setItem(PM_KEY, JSON.stringify(list)); } catch { /* noop */ } };

const STATUS = [
  { k: "Planning",    color: "#64748b", bg: "#f1f5f9" },
  { k: "In Progress", color: "#0369a1", bg: "#dbeafe" },
  { k: "On Hold",     color: "#b45309", bg: "#fef3c7" },
  { k: "Completed",   color: "#15803d", bg: "#dcfce7" },
  { k: "Cancelled",   color: "#991b1b", bg: "#fee2e2" },
];
const PRIORITY = [
  { k: "Low",      color: "#64748b" },
  { k: "Medium",   color: "#0ea5e9" },
  { k: "High",     color: "#f59e0b" },
  { k: "Critical", color: "#dc2626" },
];

const uid = () => "pr_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const F = ({ label, children, span = 1 }) => (
  <div style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 10.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</label>
    {children}
  </div>
);
const inputS = { padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 5, outline: "none", background: "#fff" };

const emptyProject = () => ({
  id: "",
  code: "",
  name: "",
  client: "",
  siteLocation: "",
  manager: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  budget: 0,
  spent: 0,
  progress: 0,
  status: "Planning",
  priority: "Medium",
  description: "",
  forms: ["dpr", "indent"],
  milestones: [], // [{id, title, dueDate, done}]
  team: [], // [{id, name, role}]
  createdAt: "",
  updatedAt: "",
});

const Pill = ({ text, color, bg, size = "sm" }) => (
  <span style={{
    display: "inline-block", padding: size === "sm" ? "2px 10px" : "4px 14px",
    fontSize: size === "sm" ? 10 : 11.5, fontWeight: 800, letterSpacing: 0.3,
    background: bg || `${color}22`, color: color || "#334155", borderRadius: 999,
    border: `1px solid ${color}55`, textTransform: "uppercase",
  }}>{text}</span>
);

export default function ProjectManagement() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const role = currentRole();
  const superAdmin = isSuperAdmin(me?.user);
  const writeAllowed = superAdmin || ["Admin", "GM", "Project"].includes(role);
  const deleteAllowed = canDelete();
  const approvalAllowed = canApprove();

  const [tick, setTick] = useState(0);
  const [view, setView] = useState("grid"); // grid | list
  const [filter, setFilter] = useState("all"); // all | Planning | In Progress ...
  const [editing, setEditing] = useState(null); // current project in form
  const [showForm, setShowForm] = useState(false);

  const projects = useMemo(() => getProjects(), [tick]);
  const filtered = useMemo(() => filter === "all" ? projects : projects.filter((p) => p.status === filter), [projects, filter]);

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((s, p) => s + Number(p.budget || 0), 0);
    const totalSpent = projects.reduce((s, p) => s + Number(p.spent || 0), 0);
    const inProgress = projects.filter((p) => p.status === "In Progress").length;
    const completed = projects.filter((p) => p.status === "Completed").length;
    return { total: projects.length, inProgress, completed, totalBudget, totalSpent, utilizationPct: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0 };
  }, [projects]);

  // Projects live on server (shared by all users); old browser-only projects are pushed up once.
  useEffect(() => {
    apiOpsList("projects").then((srv) => {
      const local = getProjects();
      const ids = new Set(srv.map((p) => p.id));
      local.filter((p) => !ids.has(p.id)).forEach((p) => apiOpsSave("projects", p).catch(() => {}));
      const m = new Map(local.map((p) => [p.id, p]));
      srv.forEach((p) => m.set(p.id, p));
      saveProjects([...m.values()]);
      setTick((t) => t + 1);
    }).catch(() => {});
  }, []);

  // Live refresh on cross-user sync
  useEffect(() => {
    const onSync = () => setTick((t) => t + 1);
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  // ---------- Actions ----------
  const startNew = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    const serial = (projects.length + 1).toString().padStart(4, "0");
    setEditing({ ...emptyProject(), id: uid(), code: `PRJ/${new Date().getFullYear()}/${serial}` });
    setShowForm(true);
  };
  const edit = (p) => { setEditing({ ...p }); setShowForm(true); };
  const close = () => { setEditing(null); setShowForm(false); };

  const saveProject = () => {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error("Project name required"); return; }
    if (!editing.manager?.trim()) { toast.error("Project manager required"); return; }
    const list = getProjects();
    const now = new Date().toISOString();
    const next = { ...editing, updatedAt: now, createdAt: editing.createdAt || now };
    const idx = list.findIndex((x) => x.id === next.id);
    if (idx >= 0) list[idx] = next; else list.push(next);
    saveProjects(list);
    apiOpsSave("projects", next).catch((e) => toast.error(`Server save failed: ${e.message}`));
    setTick((t) => t + 1);
    toast.success(`${next.code} saved`);
    close();
  };

  const removeProject = (id) => {
    if (!deleteAllowed) { toast.error("Only Admin / SuperAdmin can delete"); return; }
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (!window.confirm(`Delete project "${p.name}" (${p.code})?\n\nThis is permanent.`)) return;
    saveProjects(getProjects().filter((x) => x.id !== id));
    apiOpsDelete("projects", id).catch(() => {});
    setTick((t) => t + 1);
    toast.success(`${p.code} deleted`);
    if (editing?.id === id) close();
  };

  const addMilestone = () => {
    if (!editing) return;
    setEditing({ ...editing, milestones: [...(editing.milestones || []), { id: uid(), title: "", dueDate: "", done: false }] });
  };
  const updMilestone = (id, patch) => setEditing({ ...editing, milestones: editing.milestones.map((m) => m.id === id ? { ...m, ...patch } : m) });
  const delMilestone = (id) => setEditing({ ...editing, milestones: editing.milestones.filter((m) => m.id !== id) });

  const addTeam = () => setEditing({ ...editing, team: [...(editing.team || []), { id: uid(), name: "", role: "" }] });
  const updTeam = (id, patch) => setEditing({ ...editing, team: editing.team.map((t) => t.id === id ? { ...t, ...patch } : t) });
  const delTeam = (id) => setEditing({ ...editing, team: editing.team.filter((t) => t.id !== id) });

  // ---------- Seed / demo data (one-click layout preview) ----------
  const seedDemo = () => {
    if (!writeAllowed) { toast.error("Not permitted"); return; }
    const now = new Date();
    const toISO = (addDays = 0) => { const d = new Date(now); d.setDate(d.getDate() + addDays); return d.toISOString().slice(0, 10); };
    const samples = [
      {
        id: uid(), code: `PRJ/${now.getFullYear()}/0001`, name: "Office Interior Renovation",
        client: "Arun Enterprises HQ", siteLocation: "Lucknow · Hazratganj",
        manager: "Rajesh Kumar", startDate: toISO(-15), endDate: toISO(45),
        budget: 1200000, spent: 450000, progress: 42,
        status: "In Progress", priority: "High",
        description: "False ceiling, modular furniture, electrical rewiring and painting for 3rd floor office space.",
        milestones: [
          { id: uid(), title: "Site survey & measurements", dueDate: toISO(-10), done: true },
          { id: uid(), title: "Material procurement", dueDate: toISO(-3), done: true },
          { id: uid(), title: "False ceiling completion", dueDate: toISO(20), done: false },
          { id: uid(), title: "Furniture installation", dueDate: toISO(35), done: false },
          { id: uid(), title: "Final handover", dueDate: toISO(45), done: false },
        ],
        team: [
          { id: uid(), name: "Rajesh Kumar", role: "Project Manager" },
          { id: uid(), name: "Suresh Singh", role: "Site Engineer" },
          { id: uid(), name: "Ramesh Yadav", role: "Procurement Lead" },
        ],
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
      {
        id: uid(), code: `PRJ/${now.getFullYear()}/0002`, name: "Warehouse Expansion Phase II",
        client: "Internal · Logistics Division", siteLocation: "Kanpur Dehat",
        manager: "Priya Sharma", startDate: toISO(-45), endDate: toISO(-5),
        budget: 2800000, spent: 2650000, progress: 100,
        status: "Completed", priority: "Critical",
        description: "Expansion of main warehouse by 8,000 sqft including loading bay and sprinkler system.",
        milestones: [
          { id: uid(), title: "Foundation", dueDate: toISO(-40), done: true },
          { id: uid(), title: "Steel structure", dueDate: toISO(-25), done: true },
          { id: uid(), title: "Roofing & walls", dueDate: toISO(-15), done: true },
          { id: uid(), title: "Final inspection", dueDate: toISO(-5), done: true },
        ],
        team: [
          { id: uid(), name: "Priya Sharma", role: "Project Manager" },
          { id: uid(), name: "Vikas Mishra", role: "Civil Engineer" },
        ],
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
      {
        id: uid(), code: `PRJ/${now.getFullYear()}/0003`, name: "Factory Shed Painting",
        client: "Internal · Production", siteLocation: "Unnao Industrial Area",
        manager: "Amit Gupta", startDate: toISO(10), endDate: toISO(60),
        budget: 350000, spent: 0, progress: 0,
        status: "Planning", priority: "Medium",
        description: "Protective anti-rust painting of 4 production shed exteriors and interior walls.",
        milestones: [
          { id: uid(), title: "Vendor finalization", dueDate: toISO(5), done: false },
          { id: uid(), title: "Scaffolding setup", dueDate: toISO(15), done: false },
          { id: uid(), title: "Paint work completion", dueDate: toISO(55), done: false },
        ],
        team: [
          { id: uid(), name: "Amit Gupta", role: "Project Manager" },
        ],
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      },
    ];
    const existing = getProjects();
    saveProjects([...samples, ...existing]);
    setTick((t) => t + 1);
    toast.success(`3 sample projects loaded · layout preview ready`);
  };

  // ---------- Status / priority helpers ----------
  const statusMeta = (s) => STATUS.find((x) => x.k === s) || STATUS[0];
  const priorityMeta = (p) => PRIORITY.find((x) => x.k === p) || PRIORITY[0];

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />

      <div style={{ minHeight: "calc(100vh - 56px)", background: "#f1f5f9", padding: "14px 20px 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }} data-testid="project-mgmt-page">

          <div className="module-doc-header" style={{ background: "#fff", border: "1.5px solid #0f172a", borderRadius: 10, padding: "10px 18px", boxShadow: "0 2px 8px rgba(15,23,42,.06)" }}>
            <Header formTitle="Project Management Department" compact />
          </div>

          {/* Banner + KPIs */}
          <ModuleHero
            tag="Project Management"
            title="Projects · Milestones · Teams · Budget"
            subtitle={`${stats.total} total · ${stats.inProgress} in-progress · ${stats.completed} completed · ₹${Number(stats.totalBudget).toLocaleString("en-IN")} budget · ${stats.utilizationPct}% spent`}
            icon={FolderKanban}
            gradient="linear-gradient(135deg,#064e3b 0%,#0f766e 45%,#14b8a6 100%)"
            shadowRgba="6,78,59,.28"
            rightSlot={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <KpiTile color="#99f6e4" label="Total" value={stats.total} />
                <KpiTile color="#60a5fa" label="In Progress" value={stats.inProgress} />
                <KpiTile color="#86efac" label="Completed" value={stats.completed} />
              </div>
            }
          />
          {false && (
          <div style={{ background: "linear-gradient(135deg,#0f766e 0%,#115e59 60%,#064e3b 100%)", color: "#fff", borderRadius: 10, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "0 4px 12px rgba(6,78,59,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <FolderKanban size={32} />
              <div>
                <div style={{ fontSize: 10.5, letterSpacing: 2.5, color: "#99f6e4", fontWeight: 800, textTransform: "uppercase" }}>Department</div>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>Project Management</div>
                <div style={{ fontSize: 11, color: "#99f6e4" }}>Projects · Milestones · Teams · Budget</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <KpiTile color="#99f6e4" label="Total Projects" value={stats.total} />
              <KpiTile color="#60a5fa" label="In Progress" value={stats.inProgress} />
              <KpiTile color="#86efac" label="Completed" value={stats.completed} />
              <KpiTile color="#fde68a" label="Budget" value={`₹ ${Number(stats.totalBudget).toLocaleString("en-IN")}`} />
              <KpiTile color="#fca5a5" label="Spent" value={`₹ ${Number(stats.totalSpent).toLocaleString("en-IN")} · ${stats.utilizationPct}%`} />
            </div>
          </div>
          )}

          {/* Toolbar */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "10px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <button
              onClick={startNew}
              disabled={!writeAllowed}
              data-testid="pm-new"
              style={{ padding: "8px 14px", background: writeAllowed ? "linear-gradient(135deg,#0ea5e9,#0369a1)" : "#cbd5e1", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: writeAllowed ? "0 2px 6px rgba(14,165,233,.4)" : "none", textTransform: "uppercase" }}
            ><Plus size={14} /> New Project</button>

            <div style={{ display: "inline-flex", border: "1px solid #cbd5e1", borderRadius: 5, overflow: "hidden" }}>
              <button onClick={() => setView("grid")} data-testid="pm-view-grid" style={{ padding: "6px 12px", background: view === "grid" ? "#0f172a" : "#fff", color: view === "grid" ? "#fff" : "#334155", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><LayoutGrid size={12} /> Grid</button>
              <button onClick={() => setView("list")} data-testid="pm-view-list" style={{ padding: "6px 12px", background: view === "list" ? "#0f172a" : "#fff", color: view === "list" ? "#fff" : "#334155", border: "none", borderLeft: "1px solid #cbd5e1", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><List size={12} /> List</button>
            </div>

            <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", marginLeft: "auto" }}>
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All ({stats.total})</FilterChip>
              {STATUS.map((s) => {
                const n = projects.filter((p) => p.status === s.k).length;
                return <FilterChip key={s.k} active={filter === s.k} onClick={() => setFilter(s.k)} color={s.color} bg={s.bg}>{s.k} ({n})</FilterChip>;
              })}
            </div>
          </div>

          {/* Project list / grid */}
          {filtered.length === 0 ? (
            <EmptyState onCreate={writeAllowed ? startNew : null} onSeed={writeAllowed ? seedDemo : null} />
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }} data-testid="pm-grid">
              {filtered.map((p) => (
                <ProjectCard key={p.id} p={p} statusMeta={statusMeta} priorityMeta={priorityMeta} onEdit={() => edit(p)} onDelete={() => removeProject(p.id)} canDelete={deleteAllowed} canEdit={writeAllowed} />
              ))}
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }} data-testid="pm-list">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Code", "Name", "Client", "Manager", "Status", "Priority", "Progress", "Budget / Spent", "Due", "Action"].map((h) => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const s = statusMeta(p.status), pr = priorityMeta(p.priority);
                    return (
                      <tr key={p.id} style={{ background: i % 2 ? "#fafbfc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: "#0f766e" }}>{p.code}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 700 }}>{p.name}</td>
                        <td style={{ padding: "8px 12px" }}>{p.client || "—"}</td>
                        <td style={{ padding: "8px 12px" }}>{p.manager}</td>
                        <td style={{ padding: "8px 12px" }}><Pill text={p.status} color={s.color} bg={s.bg} /></td>
                        <td style={{ padding: "8px 12px" }}><Pill text={p.priority} color={pr.color} /></td>
                        <td style={{ padding: "8px 12px" }}><ProgressBar pct={Number(p.progress || 0)} /></td>
                        <td style={{ padding: "8px 12px", fontSize: 11 }}>₹ {Number(p.budget || 0).toLocaleString("en-IN")} / <b style={{ color: p.spent > p.budget ? "#dc2626" : "#15803d" }}>₹ {Number(p.spent || 0).toLocaleString("en-IN")}</b></td>
                        <td style={{ padding: "8px 12px", fontSize: 11 }}>{p.endDate || "—"}</td>
                        <td style={{ padding: "8px 12px", display: "inline-flex", gap: 4 }}>
                          <button onClick={() => edit(p)} data-testid={`pm-edit-${p.id}`} style={{ padding: "4px 10px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><Edit3 size={11} /> Edit</button>
                          {deleteAllowed && <button onClick={() => removeProject(p.id)} data-testid={`pm-del-${p.id}`} style={{ padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 20, cursor: "pointer", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><Trash2 size={11} /> Delete</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", padding: 8 }}>
            💡 Draft Layout · This module stores projects locally for now. Approvals + document attachments + cloud sync will be added once the data model is confirmed.
          </div>
        </div>
      </div>

      {/* Project form modal */}
      {showForm && editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }} onClick={close}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 980, maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.4)" }} data-testid="pm-form">
            <div style={{ padding: "14px 20px", background: "linear-gradient(135deg,#0f766e,#115e59)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, color: "#99f6e4", textTransform: "uppercase" }}>{editing.createdAt ? "Edit" : "New"} Project</div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>{editing.code} {editing.name && `· ${editing.name}`}</div>
              </div>
              <button onClick={close} style={{ padding: "6px 14px", background: "rgba(255,255,255,.2)", color: "#fff", border: "1px solid rgba(255,255,255,.4)", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 11 }}>Close</button>
            </div>

            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <F label="Project Code"><input value={editing.code} readOnly style={{ ...inputS, background: "#f8fafc", fontFamily: "monospace", fontWeight: 700 }} data-testid="pm-f-code" /></F>
              <F label="Project Name *" span={3}><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={inputS} data-testid="pm-f-name" placeholder="E.g. Office Interior Renovation" /></F>
              <F label="Client / Owner"><input value={editing.client} onChange={(e) => setEditing({ ...editing, client: e.target.value })} style={inputS} data-testid="pm-f-client" /></F>
              <F label="Site Location"><input value={editing.siteLocation} onChange={(e) => setEditing({ ...editing, siteLocation: e.target.value })} style={inputS} data-testid="pm-f-site" /></F>
              <F label="Project Manager *"><input value={editing.manager} onChange={(e) => setEditing({ ...editing, manager: e.target.value })} style={inputS} data-testid="pm-f-manager" /></F>
              <F label="Status">
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })} style={inputS} data-testid="pm-f-status">
                  {STATUS.map((s) => <option key={s.k}>{s.k}</option>)}
                </select>
              </F>
              <F label="Start Date"><DateInput type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} style={inputS} data-testid="pm-f-start" /></F>
              <F label="End Date"><DateInput type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} style={inputS} data-testid="pm-f-end" /></F>
              <F label="Priority">
                <select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value })} style={inputS} data-testid="pm-f-priority">
                  {PRIORITY.map((p) => <option key={p.k}>{p.k}</option>)}
                </select>
              </F>
              <F label="Progress %"><input type="number" min="0" max="100" value={editing.progress} onChange={(e) => setEditing({ ...editing, progress: +e.target.value })} style={inputS} data-testid="pm-f-progress" /></F>
              <F label="Budget (₹)"><input type="number" min="0" value={editing.budget} onChange={(e) => setEditing({ ...editing, budget: +e.target.value })} style={inputS} data-testid="pm-f-budget" /></F>
              <F label="Spent (₹)"><input type="number" min="0" value={editing.spent} onChange={(e) => setEditing({ ...editing, spent: +e.target.value })} style={inputS} data-testid="pm-f-spent" /></F>
              <F label="Petty Cash Float / Month (₹)"><input type="number" min="0" value={editing.pettyFloat || ""} onChange={(e) => setEditing({ ...editing, pettyFloat: +e.target.value })} style={inputS} data-testid="pm-f-petty-float" /></F>
              <F label="Description" span={4}><textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} style={{ ...inputS, resize: "vertical" }} data-testid="pm-f-desc" placeholder="Scope, deliverables, stakeholders..." /></F>
              <F label="Is project mein kaun se Process Forms khulenge (Project Management mein)" span={4}>
                <div data-testid="pm-f-forms" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {PROJECT_FORMS.map((k) => {
                    const on = (editing.forms || ["dpr", "indent"]).includes(k);
                    return (
                      <label key={k} data-testid={`pm-form-${k}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: `1px solid ${on ? OPS[k].color : "#cbd5e1"}`, background: on ? `${OPS[k].color}14` : "#fff", fontSize: 11.5, fontWeight: 700, color: on ? OPS[k].color : "#475569", cursor: "pointer" }}>
                        <input type="checkbox" checked={on} onChange={() => { const cur = editing.forms || ["dpr", "indent"]; setEditing({ ...editing, forms: on ? cur.filter((x) => x !== k) : [...cur, k] }); }} />
                        {OPS[k].title}
                      </label>
                    );
                  })}
                </div>
              </F>
            </div>

            {/* Milestones */}
            <Section title="Milestones" subtitle={`${editing.milestones?.length || 0} total · ${(editing.milestones || []).filter((m) => m.done).length} done`} action={<button onClick={addMilestone} style={pillBtn("#0ea5e9")}><Plus size={11} /> Add Milestone</button>} testid="pm-milestones">
              {editing.milestones?.length === 0 ? (
                <div style={emptyLineStyle}>Koi milestone nahi hai · "Add Milestone" se shuru karein</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thS}>#</th>
                      <th style={thS}>Milestone</th>
                      <th style={thS}>Due Date</th>
                      <th style={thS}>Done</th>
                      <th style={thS}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.milestones.map((m, i) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={tdS}>{i + 1}</td>
                        <td style={tdS}><input value={m.title} onChange={(e) => updMilestone(m.id, { title: e.target.value })} style={{ ...inputS, width: "100%", padding: "5px 8px" }} data-testid={`pm-ms-title-${i}`} placeholder="E.g. Site handover" /></td>
                        <td style={tdS}><DateInput type="date" value={m.dueDate} onChange={(e) => updMilestone(m.id, { dueDate: e.target.value })} style={{ ...inputS, padding: "5px 8px" }} data-testid={`pm-ms-due-${i}`} /></td>
                        <td style={tdS}><input type="checkbox" checked={m.done} onChange={(e) => updMilestone(m.id, { done: e.target.checked })} data-testid={`pm-ms-done-${i}`} style={{ width: 18, height: 18 }} /></td>
                        <td style={tdS}><button onClick={() => delMilestone(m.id)} style={{ padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            {/* Team */}
            <Section title="Team" subtitle={`${editing.team?.length || 0} member${editing.team?.length === 1 ? "" : "s"}`} action={<button onClick={addTeam} style={pillBtn("#8b5cf6")}><Plus size={11} /> Add Team Member</button>} testid="pm-team">
              {editing.team?.length === 0 ? (
                <div style={emptyLineStyle}>Koi team member nahi · "Add Team Member" se naam add karein</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {editing.team.map((t, i) => (
                    <div key={t.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 8, border: "1px solid #e2e8f0", borderRadius: 5, background: "#f8fafc" }}>
                      <input value={t.name} onChange={(e) => updTeam(t.id, { name: e.target.value })} placeholder="Name" style={{ ...inputS, padding: "5px 8px", fontWeight: 700 }} data-testid={`pm-tm-name-${i}`} />
                      <input value={t.role} onChange={(e) => updTeam(t.id, { role: e.target.value })} placeholder="Role (e.g. Site Engineer)" style={{ ...inputS, padding: "5px 8px", fontSize: 11 }} data-testid={`pm-tm-role-${i}`} />
                      <button onClick={() => delTeam(t.id)} style={{ padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700, marginTop: 2 }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Form action bar */}
            <div style={{ padding: "14px 20px", background: "linear-gradient(135deg,#0f172a,#1e293b)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 10.5, color: "#fbbf24", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", marginRight: 8 }}>Actions ·</div>
              <button onClick={saveProject} disabled={!writeAllowed} data-testid="pm-save" style={{ padding: "8px 16px", background: writeAllowed ? "linear-gradient(135deg,#22c55e,#15803d)" : "#475569", color: "#fff", border: "none", borderRadius: 5, cursor: writeAllowed ? "pointer" : "not-allowed", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: writeAllowed ? "0 2px 6px rgba(34,197,94,.4)" : "none", textTransform: "uppercase" }}><Save size={13} /> Save</button>
              {editing.id && projects.find((p) => p.id === editing.id) && deleteAllowed && (
                <button onClick={() => removeProject(editing.id)} data-testid="pm-form-delete" style={{ padding: "8px 16px", background: "linear-gradient(135deg,#ef4444,#b91c1c)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(239,68,68,.4)", textTransform: "uppercase" }}><Trash2 size={13} /> Delete</button>
              )}
              <button onClick={close} data-testid="pm-cancel" style={{ padding: "8px 16px", background: "linear-gradient(135deg,#64748b,#475569)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 800, fontSize: 12, marginLeft: "auto", textTransform: "uppercase" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Sub-components ----------
const KpiTile = ({ color, label, value }) => (
  <div style={{ padding: "8px 14px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, minWidth: 110 }}>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{value}</div>
  </div>
);

const FilterChip = ({ active, onClick, color, bg, children }) => (
  <button onClick={onClick} data-testid={`pm-filter-${String(children).split(" ")[0].toLowerCase()}`} style={{
    padding: "5px 11px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, border: `1px solid ${active ? (color || "#0f172a") : "#cbd5e1"}`,
    background: active ? (bg || "#0f172a") : "#fff",
    color: active ? (color || "#fff") : "#334155",
    cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.3,
  }}>{children}</button>
);

const ProgressBar = ({ pct }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 110 }}>
    <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: pct >= 100 ? "#15803d" : pct > 60 ? "#0ea5e9" : pct > 30 ? "#f59e0b" : "#dc2626", transition: "width .3s" }} />
    </div>
    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#334155", minWidth: 28, textAlign: "right" }}>{pct}%</span>
  </div>
);

const ProjectCard = ({ p, statusMeta, priorityMeta, onEdit, onDelete, canDelete, canEdit }) => {
  const s = statusMeta(p.status), pr = priorityMeta(p.priority);
  const overBudget = Number(p.spent || 0) > Number(p.budget || 0) && Number(p.budget || 0) > 0;
  const doneMs = (p.milestones || []).filter((m) => m.done).length;
  return (
    <div data-testid={`pm-card-${p.id}`} style={{ background: "#fff", border: `1px solid ${s.color}44`, borderTop: `4px solid ${s.color}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,.06)" }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "#0f766e", fontWeight: 800, letterSpacing: 0.5 }}>{p.code}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginTop: 2, lineHeight: 1.25 }}>{p.name}</div>
            {p.client && <div style={{ fontSize: 11, color: "#64748b" }}>Client · {p.client}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
            <Pill text={p.status} color={s.color} bg={s.bg} />
            <Pill text={p.priority} color={pr.color} />
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
          <div><Users size={11} /> <b>{p.manager}</b></div>
          <div><Calendar size={11} /> {p.startDate || "—"} → {p.endDate || "—"}</div>
          <div><IndianRupee size={11} /> ₹ {Number(p.budget || 0).toLocaleString("en-IN")}</div>
          <div style={{ color: overBudget ? "#dc2626" : "#15803d" }}><IndianRupee size={11} /> ₹ {Number(p.spent || 0).toLocaleString("en-IN")} {overBudget && <AlertCircle size={11} />}</div>
          <div><FileText size={11} /> Milestones: <b>{doneMs}/{(p.milestones || []).length}</b></div>
          <div><CheckCircle2 size={11} /> Team: <b>{(p.team || []).length}</b></div>
        </div>

        <div style={{ marginTop: 10 }}>
          <ProgressBar pct={Number(p.progress || 0)} />
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          {canEdit && <button onClick={onEdit} style={{ flex: 1, padding: "6px 10px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Edit3 size={11} /> Open</button>}
          {canDelete && <button onClick={onDelete} style={{ padding: "6px 10px", background: "linear-gradient(135deg,#ef4444,#b91c1c)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><Trash2 size={11} /> Delete</button>}
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ onCreate, onSeed }) => (
  <div style={{ padding: 40, textAlign: "center", background: "#fff", border: "2px dashed #cbd5e1", borderRadius: 10 }}>
    <FolderKanban size={48} style={{ margin: "0 auto 10px", display: "block", color: "#94a3b8" }} />
    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Abhi tak koi project nahi hai</div>
    <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 14 }}>Pehla project add karein, ya sample projects load karke layout preview dekhein</div>
    <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
      {onCreate && <button onClick={onCreate} data-testid="pm-empty-create" style={{ padding: "9px 20px", background: "linear-gradient(135deg,#0ea5e9,#0369a1)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(14,165,233,.4)" }}><Plus size={14} /> Add First Project</button>}
      {onSeed && <button onClick={onSeed} data-testid="pm-empty-seed" style={{ padding: "9px 20px", background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 6px rgba(245,158,11,.4)" }}>🎨 Load Sample Projects (Layout Preview)</button>}
    </div>
  </div>
);

const Section = ({ title, subtitle, action, children, testid }) => (
  <div data-testid={testid} style={{ padding: "0 20px 16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "2px solid #e2e8f0", marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Section</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10.5, color: "#64748b" }}>{subtitle}</div>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const pillBtn = (bg) => ({ padding: "5px 12px", background: bg, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 });
const emptyLineStyle = { padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 11.5, background: "#f8fafc", borderRadius: 5, border: "1px dashed #cbd5e1" };
const thS = { padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#0f172a", borderBottom: "1px solid #e2e8f0", textTransform: "uppercase", letterSpacing: 0.3 };
const tdS = { padding: "6px 10px" };
