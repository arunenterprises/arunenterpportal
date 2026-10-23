import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Users, ShoppingCart, Landmark, Briefcase, FileBarChart, UserCog, UserCheck, FolderKanban, BarChart3, Handshake, HardHat, FlaskConical, Tractor } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import { DeptNavList } from "../components/AppSidebar";
import HomeProgressChart from "../components/HomeProgressChart";
import {
  currentUserProfile,
  isSuperAdmin,
  currentRole,
  getVendors,
  getBills,
  getPayments,
  getExpenses,
  getEmployees,
  dedupeAllStores,
} from "../lib/store";

const ALL_ROLES = ["SuperAdmin", "Admin", "GM", "Purchase", "Accounts", "Viewer", "User"];

const DepartmentCard_END_MARKER = null;

const DEPARTMENTS = [
  {
    id: "vendor",
    title: "Vendor Management",
    subtitle: "KYC · Registration · Approval",
    to: "/vendor",
    icon: Users,
    color: "#0ea5e9",
    dark: "#0369a1",
    lines: [
      "Vendor registration + KYC docs",
      "3-step approval workflow",
      "Auto Vendor Code (AE####JV{FY})",
      "IFSC auto-fill bank details",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "purchase",
    title: "Purchase Management",
    subtitle: "BOQ · WO · New Vendor Bill Creation",
    to: "/purchase",
    icon: ShoppingCart,
    color: "#16a34a",
    dark: "#15803d",
    lines: [
      "BOQ: create → prepare → submit",
      "Work Order: create → submit",
      "New Vendor Bill: vendor select → feed → submit (Ref No)",
      "HSN / SAC code search",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "accounts",
    title: "Accounts Department",
    subtitle: "Bills · GST · TDS · Approvals",
    to: "/bill",
    icon: Landmark,
    color: "#f59e0b",
    dark: "#b45309",
    lines: [
      "Vendor Bill Process: Ref No fetch + cross-verify",
      "GST + TDS calculation, compliance",
      "Bill / Expense approval + Expenses tab",
      "Payment voucher preparation",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "gm",
    title: "General Manager",
    subtitle: "Consolidated view · Final Approval",
    to: "/gm",
    icon: Briefcase,
    color: "#7c3aed",
    dark: "#5b21b6",
    lines: [
      "All-department consolidated dashboard",
      "Approval inbox (vendor / bill / voucher / expense)",
      "Final Approval + Re-Approval",
      "Reports across departments",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "hr",
    title: "HR Management",
    subtitle: "Employees · Attendance · Payroll (Draft)",
    to: "/hr",
    icon: UserCheck,
    color: "#db2777",
    dark: "#9d174d",
    lines: [
      "Employee master + KYC vault",
      "Attendance · Leave · Shift roster",
      "Payroll · PF · ESIC · TDS",
      "Recruitment · Appraisal · Exit F&F",
    ],
    roles: ALL_ROLES,
    badge: "DRAFT",
  },
  {
    id: "reports",
    title: "Vouchers",
    subtitle: "Payment Vouchers · UTR · Excel",
    to: "/final",
    icon: FileBarChart,
    color: "#0d9488",
    dark: "#115e59",
    lines: [
      "Payment voucher generation",
      "UTR / Bank reference tracking",
      "Due list & aging report",
      "Excel / JSON / Print export",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "project",
    title: "Project Management",
    subtitle: "Projects · Milestones · Teams · Budget",
    to: "/project",
    icon: FolderKanban,
    color: "#0f766e",
    dark: "#115e59",
    lines: [
      "Project register with code & status",
      "Milestones tracking · due dates",
      "Team allocation · roles",
      "Budget vs spent · progress %",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "site_ops",
    title: "Project & Site Management",
    subtitle: "DPR · Material Indent / Issue",
    to: "/site",
    icon: HardHat,
    color: "#b45309",
    dark: "#78350f",
    lines: ["Daily Progress Report (DPR)", "Labour count · progress %", "Material Indent · Issue · Balance", "GM Approval · Excel · Print"],
    roles: ALL_ROLES,
    badge: "NEW",
  },
  {
    id: "qc_safety",
    title: "QC & Safety Management",
    subtitle: "Lab Tests · Site Safety Audits",
    to: "/qc-safety",
    icon: FlaskConical,
    color: "#7c3aed",
    dark: "#4c1d95",
    lines: ["Material lab test reports", "Pass / Fail alert to GM", "Daily site safety audit", "Incident · near-miss · score"],
    roles: ALL_ROLES,
    badge: "NEW",
  },
  {
    id: "plant",
    title: "Plant & Machinery (P&M)",
    subtitle: "Allocation · Running Hours · Diesel",
    to: "/plant",
    icon: Tractor,
    color: "#a16207",
    dark: "#422006",
    lines: ["Machinery register & allocation", "Running hours log", "Diesel issue vs norm", "Diesel chori alert"],
    roles: ALL_ROLES,
    badge: "NEW",
  },
  {
    id: "client_revenue",
    title: "Client & Revenue Management",
    subtitle: "CRM · MB · RA Bills · Retention",
    to: "/client-revenue",
    icon: Handshake,
    color: "#1e3a8a",
    dark: "#0b1f4d",
    lines: [
      "Leads · enquiries · follow-ups",
      "Client master · communication log",
      "Measurement Book → RA Bills",
      "Milestones · retention · change orders",
    ],
    roles: ALL_ROLES,
  },
  {
    id: "reports_hub",
    title: "Reports Hub",
    subtitle: "Dept-wise · FY · Month · Print · Excel · PDF",
    to: "/reports-hub",
    icon: BarChart3,
    color: "#4f46e5",
    dark: "#3730a3",
    lines: [
      "Vendor · Bill · PV · Expense · BOQ · WO",
      "HR Pay Bill · Advance · Loan · Exits",
      "FY / Month / Date-range filters",
      "Print A4 · Excel · PDF export",
    ],
    roles: ALL_ROLES,
    badge: "NEW",
  },
  {
    id: "users",
    title: "Administrator",
    subtitle: "Employees · Roles · Passwords",
    to: "/users",
    icon: UserCog,
    color: "#dc2626",
    dark: "#991b1b",
    lines: [
      "Employee onboarding",
      "Role assignment (Admin / GM / Purchase / …)",
      "Password reset",
      "Super Admin: Reset All Data",
    ],
    roles: ["SuperAdmin", "Admin"],
  },
];

const DepartmentCard = ({ dept, onClick, badge, allowed }) => {
  const Icon = dept.icon;
  return (
    <button
      onClick={onClick}
      disabled={!allowed}
      data-testid={`dept-card-${dept.id}`}
      className="dept-card"
      style={{
        background: `linear-gradient(135deg, ${dept.color} 0%, ${dept.dark} 100%)`,
        cursor: allowed ? "pointer" : "not-allowed",
        opacity: allowed ? 1 : .55,
        position: "relative",
      }}
    >
      {badge && (
        <div
          data-testid={`dept-badge-${dept.id}`}
          style={{
            position: "absolute", top: 8, right: 10,
            background: "rgba(255,255,255,.22)",
            padding: "2px 8px", borderRadius: 999,
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3,
            border: "1px solid rgba(255,255,255,.35)",
          }}
          title={badge.title}
        >
          {badge.text}
        </div>
      )}
      <div className="dept-card-header" style={{ paddingRight: 60 }}>
        <Icon size={34} strokeWidth={1.8} />
        <div>
          <div className="dept-title">{dept.title}</div>
          <div className="dept-sub">{dept.subtitle}</div>
        </div>
      </div>
      <ul className="dept-lines">
        {dept.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <div className="dept-cta">{allowed ? `Open ${dept.title} →` : "🔒 Not permitted"}</div>
    </button>
  );
};

export default function Home() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);
  const role = currentRole();
  // Display name for the currently-logged-in user ONLY. SuperAdmin ko fixed
  // 'Ashish Srivastava' dikhao, baaki har user ke liye uska own registered name
  // (ya email prefix as last-resort). Never fall back to generic 'User' label.
  const displayName = superAdmin
    ? "Ashish Srivastava"
    : (me?.name || me?.user?.split("@")[0] || "");

  // REAL-TIME CROSS-USER SYNC: re-render badges when App.js dispatches ae-sync-done.
  const [syncTick, setSyncTick] = useState(0);
  useEffect(() => {
    const onSync = () => setSyncTick((v) => v + 1);
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  // ONE-SHOT universal de-dup on landing — removes repeated process numbers
  // across every module (bills, PV, vendors, expenses, BOQ, WO, pay-bills,
  // employees, advance requests, loans). Also runs after every cross-user sync
  // so dupes imported from the cloud snapshot get collapsed too.
  useEffect(() => {
    try { dedupeAllStores(); } catch {}
    const onSync = () => { try { dedupeAllStores(); setSyncTick((v) => v + 1); } catch {} };
    window.addEventListener("ae-sync-done", onSync);
    return () => window.removeEventListener("ae-sync-done", onSync);
  }, []);

  const vendors = getVendors();
  const bills = getBills();
  const payments = getPayments();
  const expenses = getExpenses();

  const approvedVendors = vendors.filter((v) => v.step === 3).length;
  const approvedBills = bills.filter((b) => Number(b.step) === 5).length;
  const paidVouchers = payments.filter((p) => p.status === "Approved").length;
  const pendingVouchers = payments.filter((p) => p.status !== "Approved").length;
  const pendingApprovals =
    vendors.filter((v) => v.step === 2).length +
    bills.filter((b) => Number(b.step) === 4).length +
    payments.filter((p) => p.status === "Submitted").length +
    expenses.filter((x) => Number(x.step) === 3).length;

  const hrEmpsList = getEmployees();
  const hrEmps = hrEmpsList.length;
  const hrFinalized = hrEmpsList.filter((e) => Number(e.step) === 5).length;

  const badges = {
    vendor: { text: `${approvedVendors}/${vendors.length}`, title: `${approvedVendors} approved of ${vendors.length} vendors` },
    purchase: { text: `${expenses.length + bills.length}`, title: `${bills.length} bills · ${expenses.length} expenses in the pipeline` },
    accounts: { text: `${approvedBills}/${bills.length}`, title: `${approvedBills} approved of ${bills.length} bills` },
    gm: { text: `${pendingApprovals} pending`, title: `${pendingApprovals} items pending GM final approval` },
    hr: { text: `${hrFinalized}/${hrEmps}`, title: `${hrFinalized} finalized of ${hrEmps} employees · live headcount` },
    reports: { text: `${paidVouchers}/${payments.length}`, title: `${paidVouchers} approved vouchers of ${payments.length}` },
    users: null,
  };

  // Draft left-sidebar layout (Feb 2026 · user request): menu on left, dashboard on right.
  // Previous flat grid preserved commented inside render for easy rollback.
  const ORDER = ["gm", "client_revenue", "hr", "vendor", "purchase", "accounts", "reports", "reports_hub", "project", "users"];
  const visibleDepts = ORDER
    .map((id) => DEPARTMENTS.find((d) => d.id === id))
    .filter((d) => d && (d.id !== "users" || superAdmin || role === "Admin"));

  const totalApprovedAmount = payments.filter((p) => p.status === "Approved").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingAmount = payments.filter((p) => p.status !== "Approved").reduce((s, p) => s + Number(p.amount || 0), 0);

  const sidebarBg = "linear-gradient(180deg,#0b1f4d 0%,#13306e 55%,#1e3a8a 100%)";

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />

      <div data-testid="home-page" style={{ display: "flex", minHeight: "calc(100vh - 56px)", background: "#f1f5f9" }}>

        {/* ============== LEFT SIDEBAR ============== */}
        <aside data-testid="home-sidebar" style={{ width: 260, flexShrink: 0, background: sidebarBg, color: "#fff", padding: "14px 0", display: "flex", flexDirection: "column", boxShadow: "2px 0 8px rgba(15,23,42,.1)" }}>
          {/* Brand */}
          <div style={{ padding: "0 18px 14px", borderBottom: "1px solid rgba(255,255,255,.08)", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5, color: "#fff", textAlign: "center" }}>ERP · Workspace</div>
          </div>

          {/* User info */}
          <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#fff", fontSize: 14 }}>
              {(displayName || me?.user || "?").slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div data-testid="sidebar-user-name" style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName || me?.user}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{superAdmin ? "SUPERADMIN" : (role || "USER")}</div>
            </div>
          </div>

          {/* Menu label */}
          <div style={{ padding: "12px 18px 6px", fontSize: 9, letterSpacing: 2, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>Departments</div>

          {/* Menu items */}
          <nav className="home-deptnav" data-testid="home-dept-nav" style={{ flex: 1, overflowY: "auto", padding: "0 6px" }}>
            <DeptNavList showSubs={false} />
          </nav>
        </aside>

        {/* ============== RIGHT MAIN CONTENT ============== */}
        <main style={{ flex: 1, padding: "18px 24px 28px", overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 1400, margin: "0 auto" }}>

            {/* Letterhead */}
            <div style={{ background: "#fff", border: "1.5px solid #0f172a", borderRadius: 10, padding: "10px 18px", boxShadow: "0 2px 8px rgba(15,23,42,.06)" }}>
              <Header formTitle="" compact />
            </div>

            {/* Welcome banner */}
            <div style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#5b21b6 50%,#be185d 100%)", color: "#fff", borderRadius: 10, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, boxShadow: "0 4px 12px rgba(91,33,182,.22)" }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: 2.5, color: "#e9d5ff", fontWeight: 800, textTransform: "uppercase" }}>Welcome back</div>
                <div data-testid="welcome-user-name" style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.3 }}>Namaste, {displayName || me?.user || "User"} 👋</div>
                <div style={{ fontSize: 11, color: "#fde68a", marginTop: 2 }}>Aaj ke pending approvals · live KPI · recent activity niche hai</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: "#e9d5ff", fontWeight: 800, textTransform: "uppercase" }}>Pending Approvals</div>
                <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{pendingApprovals}</div>
                <div style={{ fontSize: 10.5, color: "#fde68a" }}>across all departments</div>
              </div>
            </div>


            {/* KPI tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }} data-testid="home-kpis">
              <Kpi title="Approved Vendors" value={approvedVendors} total={vendors.length} color="#0369a1" />
              <Kpi title="Approved Bills" value={approvedBills} total={bills.length} color="#16a34a" />
              <Kpi title="Approved Vouchers" value={paidVouchers} total={payments.length} color="#7c3aed" />
              <Kpi title="HR Finalized" value={hrFinalized} total={hrEmps} color="#db2777" />
              <Kpi title="Approved ₹" value={`₹${Math.round(totalApprovedAmount / 100000)}L`} subtitle={`of ₹${Math.round((totalApprovedAmount + pendingAmount) / 100000)}L`} color="#059669" />
            </div>


            <HomeProgressChart tick={syncTick} />
          </div>
        </main>
      </div>
    </>
  );
}

// KPI tile for home dashboard
const Kpi = ({ title, value, total, subtitle, color }) => (
  <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderLeft: `4px solid ${color}`, borderRadius: 8, padding: "10px 14px", boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
    <div style={{ fontSize: 9.5, letterSpacing: 1.5, color: "#64748b", fontWeight: 800, textTransform: "uppercase" }}>{title}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.1, marginTop: 2 }}>{value}{total !== undefined && <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}> / {total}</span>}</div>
    {subtitle && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{subtitle}</div>}
  </div>
);
