import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { FolderKanban } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import OpsModule from "../components/ops/OpsModule";
import { OPS, DEPTS } from "../components/ops/opsConfig";
import { apiOpsList } from "../lib/api";
import { QcNormsGuide } from "../components/ops/QcNormsGuide";

export default function OpsDepartment({ dept }) {
  const d = DEPTS[dept];
  const nav = useNavigate();
  const isSite = dept === "site";
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(() => (isSite ? localStorage.getItem("ae_site_project") || "" : ""));
  useEffect(() => { if (isSite) apiOpsList("projects").then(setProjects).catch(() => {}); }, [isSite]);
  const proj = projects.find((p) => p.id === pid);
  const tabs = isSite && proj ? (proj.forms?.length ? proj.forms : d.tabs).filter((k) => OPS[k]) : d.tabs;
  const [tab, setTab] = useState(d.tabs[0]);
  const active = tabs.includes(tab) ? tab : tabs[0];
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
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0", padding: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
          {d.projectsLink && (
            <button data-testid="dept-tab-projects" onClick={() => nav("/project")} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><FolderKanban size={13} /> Projects Register</button>
          )}
          {tabs.map((k) => (
            <React.Fragment key={k}>
            <button data-testid={`dept-tab-${k}`} onClick={() => setTab(k)} style={{ padding: "8px 16px", background: active === k ? OPS[k].color : `${OPS[k].color}14`, color: active === k ? "#fff" : OPS[k].color, border: `1px solid ${OPS[k].color}55`, borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{OPS[k].title}</button>
            {k === "qc_test" && <QcNormsGuide />}
            </React.Fragment>
          ))}
        </div>
        <OpsModule cfg={OPS[active]} preset={proj ? { project: proj.name } : null} />
      </div>
    </>
  );
}
