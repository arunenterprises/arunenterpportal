import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import {
  Shield, Users2, FileText, Bell, ClipboardList, Settings, Key, Lock, Database,
  Eye, CheckCircle2, AlertTriangle, Clock, Plus, Search, Printer, Download,
  Activity, Server, Globe, Mail, Calendar, FolderCog, UserCog, BookOpen,
} from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import ModuleHero from "../components/ModuleHero";

// ============================================================================
// ADMIN DEPARTMENT · DRAFT LAYOUT
// NOTE: This is a VISUAL DRAFT only — not yet wired to backend / Home dashboard.
// Show to the user, collect approval, then integrate.
// ============================================================================

const inrN = (n) => Number(n || 0).toLocaleString("en-IN");

// --- Mock data (replaced with real API after approval) ---
const MOCK = {
  stats: {
    totalPolicies: 24,
    pendingApprovals: 7,
    announcements: 12,
    auditEvents: 1842,
    activeUsers: 18,
    systemHealth: "Healthy",
  },
  policies: [
    { id: "POL-001", title: "Leave Policy 2026", category: "HR", status: "Active", version: "v2.1", lastUpdated: "2026-01-15", owner: "Ashish Srivastava" },
    { id: "POL-002", title: "Procurement Code of Conduct", category: "Purchase", status: "Active", version: "v1.4", lastUpdated: "2025-11-02", owner: "GM" },
    { id: "POL-003", title: "Expense Reimbursement Rules", category: "Accounts", status: "Draft", version: "v3.0", lastUpdated: "2026-02-10", owner: "Accounts Manager" },
    { id: "POL-004", title: "Vendor Onboarding SOP", category: "Vendor", status: "Active", version: "v2.0", lastUpdated: "2025-12-20", owner: "Admin" },
    { id: "POL-005", title: "Data Backup & Retention", category: "IT", status: "Active", version: "v1.1", lastUpdated: "2026-01-08", owner: "SuperAdmin" },
  ],
  approvals: [
    { id: "APR-101", title: "New Policy: Overtime Compensation", requester: "HR Head", status: "Pending", submittedAt: "2026-02-12", priority: "High" },
    { id: "APR-102", title: "Vendor Blacklist Request · XYZ Constructions", requester: "Accounts Manager", status: "Pending", submittedAt: "2026-02-11", priority: "Medium" },
    { id: "APR-103", title: "Password Policy Update", requester: "SuperAdmin", status: "Pending", submittedAt: "2026-02-10", priority: "High" },
    { id: "APR-104", title: "Project E-101 Budget Revision", requester: "Project Manager", status: "Pending", submittedAt: "2026-02-09", priority: "Low" },
  ],
  announcements: [
    { id: "ANN-01", title: "Office Closed · Republic Day Observance", audience: "All Staff", publishedAt: "2026-01-25", status: "Published", pinned: true },
    { id: "ANN-02", title: "New Timesheet Submission Deadline", audience: "HR + Site Team", publishedAt: "2026-02-01", status: "Published", pinned: false },
    { id: "ANN-03", title: "System Maintenance Window · Feb 20", audience: "All Users", publishedAt: "2026-02-14", status: "Scheduled", pinned: true },
    { id: "ANN-04", title: "GST Rate Change Advisory", audience: "Accounts + Purchase", publishedAt: "2026-02-10", status: "Published", pinned: false },
  ],
  auditLog: [
    { id: "AUD-9821", at: "2026-02-14 11:42", user: "arunenterprises2023@gmail.com", action: "LOGIN", module: "Auth", ip: "203.0.113.42", result: "Success" },
    { id: "AUD-9820", at: "2026-02-14 11:35", user: "accounts@arun.com", action: "APPROVE_PV", module: "Accounts", ip: "203.0.113.56", result: "Success" },
    { id: "AUD-9819", at: "2026-02-14 10:58", user: "hr@arun.com", action: "DELETE_EMPLOYEE", module: "HR", ip: "203.0.113.21", result: "Blocked · Insufficient perms" },
    { id: "AUD-9818", at: "2026-02-14 10:12", user: "arunenterprises2023@gmail.com", action: "RESET_PASSWORD", module: "Users", ip: "203.0.113.42", result: "Success" },
    { id: "AUD-9817", at: "2026-02-14 09:55", user: "purchase@arun.com", action: "CREATE_BOQ", module: "Purchase", ip: "203.0.113.73", result: "Success" },
  ],
};

// Section pages
const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: Activity, color: "#4f46e5" },
  { id: "policies", label: "Policies & SOPs", icon: BookOpen, color: "#0369a1" },
  { id: "approvals", label: "Admin Approvals", icon: ClipboardList, color: "#be185d" },
  { id: "announcements", label: "Announcements", icon: Bell, color: "#d97706" },
  { id: "audit", label: "Audit Log", icon: FileText, color: "#15803d" },
  { id: "settings", label: "System Settings", icon: Settings, color: "#334155" },
  { id: "licences", label: "Licences & Compliance", icon: Shield, color: "#7c3aed" },
  { id: "assets", label: "Asset Register", icon: FolderCog, color: "#dc2626" },
];

const AdminDepartmentDraft = () => {
  const nav = useNavigate();
  const [active, setActive] = useState("dashboard");

  const Section = ({ id, children }) => (active === id ? <div data-testid={`admin-section-${id}`}>{children}</div> : null);

  const StatCard = ({ icon: Icon, label, value, tone, trend }) => (
    <div style={{ background: "#fff", border: `1.5px solid ${tone}`, borderRadius: 10, padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 4px rgba(15,23,42,.05)" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${tone}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={tone} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{value}</div>
        {trend && <div style={{ fontSize: 10, color: tone, fontWeight: 700, marginTop: 2 }}>{trend}</div>}
      </div>
    </div>
  );

  return (
    <>
      <HomeNavBar />
      <Toaster position="top-right" richColors />
      <main style={{ padding: 18, maxWidth: 1500, margin: "0 auto" }}>
        {/* DRAFT banner */}
        <div data-testid="admin-draft-banner" style={{ background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)", border: "2px dashed #d97706", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={20} color="#92400e" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#78350f", letterSpacing: 0.5, textTransform: "uppercase" }}>DRAFT LAYOUT · Review Only</div>
            <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>Yeh "Admin Department" module ka visual draft hai. Approval ke baad hi Home dashboard me add aur backend wire karenge.</div>
          </div>
          <button onClick={() => nav("/home")} style={{ padding: "6px 12px", background: "#fff", color: "#78350f", border: "1.5px solid #d97706", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11 }}>← Back to Home</button>
        </div>

        <ModuleHero
          tag="Admin Department · DRAFT"
          title="Policies · Approvals · Announcements · Audit"
          subtitle="Central admin hub · Governance · Compliance · System configuration · Asset tracking"
          icon={Shield}
          gradient="linear-gradient(135deg,#1e1b4b 0%,#4338ca 45%,#7c3aed 100%)"
          shadowRgba="67,56,202,.28"
        />

        {/* Section nav */}
        <div data-testid="admin-section-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 6, background: "#f1f5f9", padding: 8, borderRadius: 6, marginBottom: 14, border: "1px solid #e2e8f0" }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                data-testid={`admin-tab-${s.id}`}
                onClick={() => setActive(s.id)}
                style={{ padding: "7px 12px", background: isActive ? s.color : "#fff", color: isActive ? "#fff" : "#334155", border: `1.5px solid ${isActive ? s.color : "#cbd5e1"}`, borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <Icon size={13} /> {s.label}
              </button>
            );
          })}
        </div>

        {/* ============ DASHBOARD ============ */}
        <Section id="dashboard">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard icon={BookOpen} label="Policies & SOPs" value={MOCK.stats.totalPolicies} tone="#0369a1" trend="↑ 2 new this month" />
            <StatCard icon={ClipboardList} label="Pending Approvals" value={MOCK.stats.pendingApprovals} tone="#be185d" trend="3 high priority" />
            <StatCard icon={Bell} label="Announcements" value={MOCK.stats.announcements} tone="#d97706" trend="2 pinned" />
            <StatCard icon={FileText} label="Audit Events" value={inrN(MOCK.stats.auditEvents)} tone="#15803d" trend="Last 30 days" />
            <StatCard icon={Users2} label="Active Users" value={MOCK.stats.activeUsers} tone="#4f46e5" trend="↑ 1 today" />
            <StatCard icon={Server} label="System Health" value={MOCK.stats.systemHealth} tone="#16a34a" trend="All services green" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <div style={{ padding: "10px 14px", background: "#f8fafc", fontSize: 11, letterSpacing: 1.2, fontWeight: 800, textTransform: "uppercase", color: "#334155", borderBottom: "1px solid #e2e8f0" }}>Recent Admin Approvals</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {["Ref", "Title", "Requester", "Priority", "Submitted"].map((h) => <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {MOCK.approvals.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: 700, color: "#4338ca" }}>{a.id}</td>
                      <td style={{ padding: "6px 10px" }}>{a.title}</td>
                      <td style={{ padding: "6px 10px", color: "#475569" }}>{a.requester}</td>
                      <td style={{ padding: "6px 10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: { High: "#fee2e2", Medium: "#fef3c7", Low: "#e0e7ff" }[a.priority], color: { High: "#991b1b", Medium: "#92400e", Low: "#3730a3" }[a.priority] }}>{a.priority}</span>
                      </td>
                      <td style={{ padding: "6px 10px", color: "#64748b" }}>{a.submittedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <div style={{ padding: "10px 14px", background: "#f8fafc", fontSize: 11, letterSpacing: 1.2, fontWeight: 800, textTransform: "uppercase", color: "#334155", borderBottom: "1px solid #e2e8f0" }}>Latest Announcements</div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {MOCK.announcements.map((a) => (
                  <div key={a.id} style={{ padding: 10, background: a.pinned ? "#fef9c3" : "#f8fafc", border: a.pinned ? "1px solid #facc15" : "1px solid #e2e8f0", borderRadius: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {a.pinned && <span title="Pinned">📌</span>}
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", flex: 1 }}>{a.title}</div>
                      <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: 9.5, fontWeight: 800, background: a.status === "Published" ? "#dcfce7" : "#e0e7ff", color: a.status === "Published" ? "#166534" : "#3730a3" }}>{a.status}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 3 }}>{a.audience} · {a.publishedAt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ============ POLICIES ============ */}
        <Section id="policies">
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <button style={btnPrimary}><Plus size={13} /> New Policy</button>
            <input placeholder="Search policies by title / category / owner…" style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
            <select style={{ ...inputStyle, width: 150 }}><option>All Categories</option><option>HR</option><option>Accounts</option><option>Purchase</option><option>Vendor</option><option>IT</option></select>
            <button style={btnSecondary}><Printer size={13} /> Print</button>
            <button style={btnSecondary}><Download size={13} /> Export</button>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead><tr style={{ background: "#1e293b", color: "#fff" }}>
                {["Policy ID", "Title", "Category", "Version", "Status", "Last Updated", "Owner", "Actions"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {MOCK.policies.map((p, i) => (
                  <tr key={p.id} style={{ background: i % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: "#4338ca" }}>{p.id}</td>
                    <td style={tdStyle}>{p.title}</td>
                    <td style={tdStyle}><span style={{ padding: "2px 7px", background: "#e0e7ff", color: "#3730a3", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{p.category}</span></td>
                    <td style={{ ...tdStyle, fontFamily: "monospace" }}>{p.version}</td>
                    <td style={tdStyle}><span style={{ padding: "2px 7px", background: p.status === "Active" ? "#dcfce7" : "#fef3c7", color: p.status === "Active" ? "#166534" : "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{p.status}</span></td>
                    <td style={tdStyle}>{p.lastUpdated}</td>
                    <td style={tdStyle}>{p.owner}</td>
                    <td style={tdStyle}>
                      <button style={{ padding: "3px 8px", background: "#0369a1", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}><Eye size={10} /> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ============ APPROVALS ============ */}
        <Section id="approvals">
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead><tr style={{ background: "#be185d", color: "#fff" }}>
                {["Request ID", "Title", "Requester", "Submitted", "Priority", "Status", "Actions"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {MOCK.approvals.map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700 }}>{a.id}</td>
                    <td style={tdStyle}>{a.title}</td>
                    <td style={tdStyle}>{a.requester}</td>
                    <td style={tdStyle}>{a.submittedAt}</td>
                    <td style={tdStyle}><span style={{ padding: "2px 7px", background: { High: "#fee2e2", Medium: "#fef3c7", Low: "#e0e7ff" }[a.priority], color: { High: "#991b1b", Medium: "#92400e", Low: "#3730a3" }[a.priority], borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{a.priority}</span></td>
                    <td style={tdStyle}><span style={{ padding: "2px 7px", background: "#fef3c7", color: "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{a.status}</span></td>
                    <td style={tdStyle}>
                      <button style={{ padding: "3px 8px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginRight: 4 }}>✓ Approve</button>
                      <button style={{ padding: "3px 8px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>✗ Reject</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ============ ANNOUNCEMENTS ============ */}
        <Section id="announcements">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button style={btnPrimary}><Plus size={13} /> New Announcement</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {MOCK.announcements.map((a) => (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, position: "relative" }}>
                {a.pinned && <div style={{ position: "absolute", top: 10, right: 10 }}>📌</div>}
                <div style={{ fontSize: 10, letterSpacing: 1, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>{a.audience}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{a.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10.5 }}>
                  <span style={{ color: "#64748b" }}>{a.publishedAt}</span>
                  <span style={{ padding: "1px 7px", background: a.status === "Published" ? "#dcfce7" : "#e0e7ff", color: a.status === "Published" ? "#166534" : "#3730a3", borderRadius: 10, fontWeight: 800 }}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ============ AUDIT LOG ============ */}
        <Section id="audit">
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input placeholder="Filter by user / IP / action…" style={{ ...inputStyle, flex: 1, minWidth: 240 }} />
            <input type="date" style={{ ...inputStyle, width: 160 }} />
            <select style={{ ...inputStyle, width: 150 }}><option>All Modules</option><option>Auth</option><option>Accounts</option><option>HR</option><option>Users</option><option>Purchase</option></select>
            <button style={btnSecondary}><Download size={13} /> Export CSV</button>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead><tr style={{ background: "#15803d", color: "#fff" }}>
                {["Event ID", "Timestamp", "User", "Action", "Module", "IP Address", "Result"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {MOCK.auditLog.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: "#15803d" }}>{e.id}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10.5 }}>{e.at}</td>
                    <td style={{ ...tdStyle, fontSize: 10.5 }}>{e.user}</td>
                    <td style={tdStyle}><span style={{ padding: "1px 7px", background: "#e0e7ff", color: "#3730a3", borderRadius: 10, fontSize: 10, fontWeight: 800, fontFamily: "monospace" }}>{e.action}</span></td>
                    <td style={tdStyle}>{e.module}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 10.5 }}>{e.ip}</td>
                    <td style={tdStyle}><span style={{ padding: "1px 7px", background: e.result === "Success" ? "#dcfce7" : "#fee2e2", color: e.result === "Success" ? "#166534" : "#991b1b", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{e.result}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ============ SYSTEM SETTINGS ============ */}
        <Section id="settings">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <SettingCard icon={Globe} title="General" items={["Company name & logo", "Default currency · INR", "Date format · DD-MM-YYYY", "Timezone · Asia/Kolkata"]} />
            <SettingCard icon={Key} title="Security" items={["Password policy", "2FA · Required for Admins", "Session timeout · 60 min", "Single-session enforcement · ON"]} />
            <SettingCard icon={Database} title="Backup & Restore" items={["Nightly auto backup · 2 AM IST", "Last 7 backups retained", "Last run · 2026-02-14 02:00 · ✓", "Email on failure · ON"]} />
            <SettingCard icon={Mail} title="Email / Notifications" items={["Resend provider · Connected", "Daily digest to GM · ON", "Backup failure alerts · ON", "SMTP fallback · OFF"]} />
            <SettingCard icon={Calendar} title="Financial Year" items={["Active FY · 2025-2026", "Code format · AE####JV2526", "Switch FY · Admin only", "History preserved · ON"]} />
            <SettingCard icon={UserCog} title="Roles & Permissions" items={["Roles · SuperAdmin · Admin · GM · HR · Accounts · Purchase · User · Viewer", "Default perms by role", "Per-user overrides supported", "Audit all role changes"]} />
          </div>
        </Section>

        {/* ============ LICENCES ============ */}
        <Section id="licences">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {[
              { name: "GST Registration", no: "09AADFA2316H1ZU", expiry: "2027-03-31", status: "Active" },
              { name: "MSME Udyam", no: "UDYAM-UP-00-XXXXXX", expiry: "N/A (perpetual)", status: "Active" },
              { name: "PF Code", no: "DLCPM0001234000", expiry: "N/A", status: "Active" },
              { name: "ESIC Code", no: "22000012340000999", expiry: "N/A", status: "Active" },
              { name: "Shop & Establishment", no: "DL-SE-2024-5678", expiry: "2026-12-31", status: "Expiring Soon" },
              { name: "Trade Licence · NCR", no: "NDMC/TL/2025/8870", expiry: "2026-06-30", status: "Expiring Soon" },
            ].map((l) => (
              <div key={l.no} style={{ background: "#fff", border: `1.5px solid ${l.status === "Active" ? "#16a34a" : "#f59e0b"}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{l.name}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", marginTop: 4, color: "#0f172a" }}>{l.no}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 10.5, color: "#64748b" }}>Expiry: {l.expiry}</span>
                  <span style={{ padding: "1px 8px", background: l.status === "Active" ? "#dcfce7" : "#fef3c7", color: l.status === "Active" ? "#166534" : "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{l.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ============ ASSETS ============ */}
        <Section id="assets">
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button style={btnPrimary}><Plus size={13} /> Add Asset</button>
            <input placeholder="Search by asset / assigned to / location…" style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <table style={tableStyle}>
              <thead><tr style={{ background: "#dc2626", color: "#fff" }}>
                {["Asset ID", "Name / Model", "Category", "Assigned To", "Location", "Purchase Dt", "Value (₹)", "Status"].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  { id: "AST-00123", name: "Dell Latitude 5540", cat: "Laptop", to: "Ashish Srivastava", loc: "HO · Noida", dt: "2025-07-14", val: 95000, st: "In Use" },
                  { id: "AST-00124", name: "HP LaserJet M404", cat: "Printer", to: "Accounts", loc: "HO · Noida", dt: "2024-11-20", val: 32000, st: "In Use" },
                  { id: "AST-00125", name: "Hikvision 4-Ch DVR", cat: "CCTV", to: "Site E-101", loc: "NCR/G&B", dt: "2025-03-01", val: 18500, st: "In Use" },
                  { id: "AST-00126", name: "Honda Activa 6G", cat: "Vehicle", to: "Field Supervisor", loc: "Noida", dt: "2024-05-10", val: 85000, st: "Service Due" },
                ].map((a, i) => (
                  <tr key={a.id} style={{ background: i % 2 ? "#f8fafc" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{a.id}</td>
                    <td style={tdStyle}>{a.name}</td>
                    <td style={tdStyle}>{a.cat}</td>
                    <td style={tdStyle}>{a.to}</td>
                    <td style={tdStyle}>{a.loc}</td>
                    <td style={tdStyle}>{a.dt}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#166534", fontFamily: "monospace" }}>₹ {inrN(a.val)}</td>
                    <td style={tdStyle}><span style={{ padding: "1px 7px", background: a.st === "In Use" ? "#dcfce7" : "#fef3c7", color: a.st === "In Use" ? "#166534" : "#92400e", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>{a.st}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Approval request bar */}
        <div data-testid="admin-approval-bar" style={{ marginTop: 20, padding: 14, background: "linear-gradient(135deg,#1e1b4b,#4338ca)", color: "#fff", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#c7d2fe", fontWeight: 800, textTransform: "uppercase" }}>Draft Approval</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>Yeh layout approve karein taaki Admin Department ko Home dashboard + backend se wire kar sakoon</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => toast.info("Please share your feedback / changes needed")} style={{ padding: "9px 18px", background: "#fff", color: "#1e1b4b", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>📝 Request Changes</button>
            <button onClick={() => toast.success("Draft marked for approval · tell E1 to proceed with integration")} style={{ padding: "9px 20px", background: "linear-gradient(135deg,#16a34a,#14532d)", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, boxShadow: "0 2px 6px rgba(22,163,74,.4)" }}>✓ Approve Draft</button>
          </div>
        </div>
      </main>
    </>
  );
};

// --- shared tiny components ---
const SettingCard = ({ icon: Icon, title, items }) => (
  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} color="#4338ca" /></div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{title}</div>
    </div>
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
      {items.map((t, i) => <li key={i} style={{ fontSize: 11.5, color: "#475569", display: "flex", gap: 6, alignItems: "flex-start" }}><CheckCircle2 size={11} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} /> {t}</li>)}
    </ul>
  </div>
);

// --- shared styles ---
const inputStyle = { padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, background: "#fff", height: 30, outline: "none" };
const btnPrimary = { padding: "7px 14px", background: "#4338ca", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 };
const btnSecondary = { padding: "7px 14px", background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", fontWeight: 700, fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: 11.5 };
const thStyle = { padding: "7px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: "2px solid rgba(255,255,255,.2)" };
const tdStyle = { padding: "6px 10px", fontSize: 11.5, color: "#0f172a" };

export default AdminDepartmentDraft;
