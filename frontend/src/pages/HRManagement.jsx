import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  UserPlus, Users2, Calendar, IndianRupee, FileText, Award, LogOut,
  UserCheck, ClipboardList, Clock, GraduationCap, Sparkles, Construction,
} from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";

// -----------------------------------------------------------------------------
//  HR Management — Draft blueprint (v0.1)
//  Purpose: preview UI + planned modules. Non-functional placeholder.
// -----------------------------------------------------------------------------

const MODULES = [
  {
    id: "employees",
    title: "Employee Master",
    subtitle: "Onboarding · Profile · Documents",
    icon: UserPlus,
    tone: "#0369a1",
    lines: [
      "Personal + contact + emergency details",
      "Aadhaar / PAN / Bank / PF / ESIC",
      "Photo, joining letter, offer letter uploads",
      "Auto Employee Code (EMP####/JV{FY})",
    ],
  },
  {
    id: "attendance",
    title: "Attendance & Leave",
    subtitle: "Daily punch · Leave workflow",
    icon: Calendar,
    tone: "#0ea5e9",
    lines: [
      "Daily attendance register (In/Out)",
      "Leave application → HR → Manager approval",
      "Auto CL / SL / EL balance tracker",
      "Public holiday calendar + weekly-off rules",
    ],
  },
  {
    id: "payroll",
    title: "Payroll & Salary",
    subtitle: "Monthly slip · CTC · Deductions",
    icon: IndianRupee,
    tone: "#16a34a",
    lines: [
      "Monthly salary slip auto-generate",
      "Basic + HRA + DA + Special + Bonus",
      "PF / ESIC / TDS / Prof.Tax deductions",
      "PDF slip + Excel payroll register",
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Docs",
    subtitle: "PF · ESIC · TDS returns",
    icon: FileText,
    tone: "#f59e0b",
    lines: [
      "Monthly PF/ESIC challan tracker",
      "Quarterly TDS filing (24Q) reminders",
      "Employee-wise Form 16 archive",
      "Statutory return status dashboard",
    ],
  },
  {
    id: "recruitment",
    title: "Recruitment & Offers",
    subtitle: "Vacancy · Candidate · Offer",
    icon: Users2,
    tone: "#7c3aed",
    lines: [
      "Open positions + JD templates",
      "Candidate pipeline (Applied → Interview → Offer)",
      "Offer letter builder + digital signature",
      "Joining checklist → auto-onboard to Employee Master",
    ],
  },
  {
    id: "performance",
    title: "Performance & Growth",
    subtitle: "Appraisal · KRA · Training",
    icon: Award,
    tone: "#dc2626",
    lines: [
      "Half-yearly / annual appraisal cycle",
      "KRA / KPI setting & self review",
      "Training programme calendar",
      "Promotion / increment letter templates",
    ],
  },
  {
    id: "shift",
    title: "Shift & Roster",
    subtitle: "Shift planning · Overtime",
    icon: Clock,
    tone: "#0d9488",
    lines: [
      "Weekly / monthly shift roster builder",
      "Overtime request & approval",
      "Site-wise deployment tracker",
      "Auto shift-allowance calculation",
    ],
  },
  {
    id: "documents",
    title: "Document Vault",
    subtitle: "Central file store",
    icon: ClipboardList,
    tone: "#6d28d9",
    lines: [
      "Per-employee document folders",
      "Expiry alerts (contract / visa / certs)",
      "Version history & audit log",
      "Bulk download for statutory audits",
    ],
  },
  {
    id: "training",
    title: "Training & LMS",
    subtitle: "Programmes · Certificates",
    icon: GraduationCap,
    tone: "#059669",
    lines: [
      "Programme catalogue + enrolment",
      "Attendance + completion certificates",
      "Skill matrix per employee",
      "Renewal alerts for mandatory trainings",
    ],
  },
  {
    id: "exit",
    title: "Exit & F&F",
    subtitle: "Resignation → Clearance → F&F",
    icon: LogOut,
    tone: "#991b1b",
    lines: [
      "Resignation letter capture",
      "Multi-dept clearance workflow",
      "Full & Final settlement calculator",
      "Experience + relieving letter auto-print",
    ],
  },
];

// -----------------------------------------------------------------------------
const ModuleCard = ({ mod, onClick }) => {
  const Icon = mod.icon;
  return (
    <button
      onClick={onClick}
      data-testid={`hr-module-${mod.id}`}
      style={{
        textAlign: "left", padding: 16, background: "#fff",
        border: "1.5px dashed #cbd5e1", borderRadius: 12,
        cursor: "pointer", boxShadow: "0 1px 3px rgba(15,23,42,.04)",
        transition: "all .18s ease", position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = mod.tone;
        e.currentTarget.style.boxShadow = `0 8px 20px ${mod.tone}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "#cbd5e1";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(15,23,42,.04)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10,
          background: `${mod.tone}18`, color: mod.tone,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", letterSpacing: .2 }}>{mod.title}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{mod.subtitle}</div>
        </div>
        <span style={{
          padding: "2px 8px", fontSize: 9.5, fontWeight: 800,
          background: "#fef3c7", color: "#92400e",
          border: "1px solid #fcd34d", borderRadius: 999,
          letterSpacing: .3, textTransform: "uppercase",
        }}>Draft</span>
      </div>
      <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 11.5, color: "#334155", lineHeight: 1.55 }}>
        {mod.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </button>
  );
};

// -----------------------------------------------------------------------------
export default function HRManagement() {
  const nav = useNavigate();
  const [active, setActive] = useState(null);

  const openMod = (id) => {
    setActive(id);
    toast.info("Yeh module abhi draft me hai — jaldi hi live hoga");
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 40 }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 20px" }} data-testid="hr-page">

          {/* HERO */}
          <div style={{
            background: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 45%, #db2777 100%)",
            color: "#fff", borderRadius: 14, padding: 22,
            boxShadow: "0 10px 40px rgba(76,29,149,.28)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", right: -30, top: -30, opacity: .08,
              transform: "rotate(-12deg)", pointerEvents: "none",
            }}>
              <Users2 size={220} />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 13,
                  background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(255,255,255,.28)",
                }}>
                  <UserCheck size={28} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, letterSpacing: 3, color: "#fbcfe8", fontWeight: 700, textTransform: "uppercase" }}>
                    New Department · Draft Preview
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2, letterSpacing: .3 }}>
                    HR Management Portal
                  </div>
                  <div style={{ fontSize: 11.5, color: "#fce7f3", marginTop: 4 }}>
                    Employees · Attendance · Payroll · Compliance · Recruitment · Exit — planned scope.
                  </div>
                </div>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)",
                borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 700, letterSpacing: .5,
              }}>
                <Construction size={13} /> WORK IN PROGRESS
              </div>
            </div>
          </div>

          {/* DRAFT STAMP + DESCRIPTION */}
          <div style={{
            marginTop: 14, padding: "12px 16px",
            background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 10,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 12, color: "#475569",
          }}>
            <Sparkles size={16} style={{ color: "#7c3aed" }} />
            <div>
              <b style={{ color: "#0f172a" }}>Yeh HR Management ka blueprint hai.</b>
              &nbsp;Har card ek planned sub-module hai. Card par click karne se preview open hoga. Final flow abhi finalise ho raha hai — aapke feedback ke baad live version banega.
            </div>
          </div>

          {/* MODULE GRID */}
          <div style={{
            marginTop: 16, display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12,
          }} data-testid="hr-module-grid">
            {MODULES.map((m) => (
              <ModuleCard key={m.id} mod={m} onClick={() => openMod(m.id)} />
            ))}
          </div>

          {/* PLANNED WORKFLOW SKETCH */}
          <div style={{
            marginTop: 22, padding: 18, background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 12,
            boxShadow: "0 1px 3px rgba(15,23,42,.04)",
          }} data-testid="hr-workflow-sketch">
            <div style={{ fontSize: 12, fontWeight: 800, color: "#4c1d95", letterSpacing: .5, textTransform: "uppercase", marginBottom: 12 }}>
              Planned end-to-end workflow (draft)
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Vacancy Post", tone: "#0369a1" },
                { label: "Candidate Interview", tone: "#7c3aed" },
                { label: "Offer Letter", tone: "#0ea5e9" },
                { label: "Onboard → Emp Master", tone: "#16a34a" },
                { label: "Attendance + Payroll", tone: "#f59e0b" },
                { label: "Appraisal + Promotion", tone: "#dc2626" },
                { label: "Exit + F&F", tone: "#991b1b" },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div style={{
                    padding: "8px 14px", background: `${s.tone}12`, color: s.tone,
                    border: `1.5px dashed ${s.tone}`, borderRadius: 999,
                    fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    {i + 1}. {s.label}
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, minWidth: 12, height: 2, background: "linear-gradient(to right,#cbd5e1,#e2e8f0)" }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* FOOTER NOTE */}
          <div style={{
            marginTop: 12, padding: "10px 14px",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
            fontSize: 11.5, color: "#64748b", textAlign: "center",
          }}>
            Selected module: <b style={{ color: "#0f172a" }}>{active ? MODULES.find((m) => m.id === active)?.title : "— none yet —"}</b>. Full functionality is on the roadmap after design approval.
          </div>
        </div>
      </div>
    </>
  );
}
