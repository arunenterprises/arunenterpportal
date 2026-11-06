import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { FolderKanban } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import OpsModule from "../components/ops/OpsModule";
import { OPS, DEPTS } from "../components/ops/opsConfig";
import { apiOpsList } from "../lib/api";
import { QcNormsGuide } from "../components/ops/QcNormsGuide";
import { DeptTabs } from "../components/DeptTabs";
import ProjectManagement from "./ProjectManagement";

export default function OpsDepartment({ dept }) {
  const d = DEPTS[dept];
  const isSite = dept === "site";
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(() => (isSite ? localStorage.getItem("ae_site_project") || "" : ""));
  useEffect(() => { if (isSite) apiOpsList("projects").then(setProjects).catch(() => {}); }, [isSite]);
  const proj = projects.find((p) => p.id === pid);
  const tabs = isSite && proj ? (proj.forms?.length ? proj.forms : d.tabs).filter((k) => OPS[k]) : d.tabs;
  const [tab, setTab] = useState(() => (d.projectsLink && new URLSearchParams(window.location.search).get("view") === "projects" ? "projects" : d.tabs[0]));
  const showReg = d.projectsLink && tab === "projects";
  const active = showReg ? "projects" : tabs.includes(tab) ? tab : tabs[0];
  const pick = (id) => { setPid(id); localStorage.setItem("ae_site_project", id); };
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid={`dept-${dept}`} style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 110px" }}>
        <ModuleHero tag={d.title} title={d.title} subtitle={d.sub} icon={d.icon} gradient={d.gradient} shadowRgba={d.shadow} />
        {isSite && (
          <div data-testid="site-project-picker" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "14px 0 0", padding: "10px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
            <b style={{ fontSize: 12 }}>Project chunein:</b>
            <select data-testid="site-project-select" value={pid} onChange={(e) => pick(e.target.value)} style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5, minWidth: 320 }}>
              <option value="">— Sabhi projects (DPR + Indent) —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
            {proj && <span data-testid="site-project-forms" style={{ fontSize: 11, color: "#475569" }}>Is project ke form: <b>{tabs.map((k) => OPS[k].title).join(" · ")}</b> (Projects Register mein badlein)</span>}
          </div>
        )}
        <DeptTabs idPrefix="dept-tab" tone={OPS[active]?.color || "#0f766e"} active={active} style={{ margin: "14px 0" }}
          onSelect={(k) => { setTab(k); window.history.replaceState(null, "", k === "projects" ? "/site?view=projects" : "/site"); }}
          tabs={[...(d.projectsLink ? [{ id: "projects", label: "Projects Register", icon: FolderKanban }] : []), ...tabs.map((k) => ({ id: k, label: OPS[k].title }))]} />
        {tabs.includes("qc_test") && <QcNormsGuide />}
        {showReg ? <ProjectManagement embedded /> : <OpsModule cfg={OPS[active]} preset={proj ? { project: proj.name } : null} />}
      </div>
    </>
  );
}
