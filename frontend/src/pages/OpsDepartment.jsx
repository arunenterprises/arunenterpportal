import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { FolderKanban } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";
import OpsModule from "../components/ops/OpsModule";
import { OPS, DEPTS } from "../components/ops/opsConfig";
import { QcNormsGuide } from "../components/ops/QcNormsGuide";

export default function OpsDepartment({ dept }) {
  const d = DEPTS[dept];
  const nav = useNavigate();
  const [tab, setTab] = useState(d.tabs[0]);
  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div data-testid={`dept-${dept}`} style={{ background: "#f1f5f9", minHeight: "calc(100vh - 56px)", padding: "18px clamp(10px, 2.5vw, 28px) 110px" }}>
        <ModuleHero tag={d.title} title={d.title} subtitle={d.sub} icon={d.icon} gradient={d.gradient} shadowRgba={d.shadow} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0", padding: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 }}>
          {d.projectsLink && (
            <button data-testid="dept-tab-projects" onClick={() => nav("/project")} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><FolderKanban size={13} /> Projects Register</button>
          )}
          {d.tabs.map((k) => (
            <React.Fragment key={k}>
            <button data-testid={`dept-tab-${k}`} onClick={() => setTab(k)} style={{ padding: "8px 16px", background: tab === k ? OPS[k].color : `${OPS[k].color}14`, color: tab === k ? "#fff" : OPS[k].color, border: `1px solid ${OPS[k].color}55`, borderRadius: 7, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{OPS[k].title}</button>
            {k === "qc_test" && <QcNormsGuide />}
            </React.Fragment>
          ))}
        </div>
        <OpsModule cfg={OPS[tab]} />
      </div>
    </>
  );
}
