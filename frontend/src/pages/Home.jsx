import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Users, ShoppingCart, Landmark, Briefcase, FileBarChart, UserCog, UserCheck, FolderKanban, Clock, CheckCircle2 } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import { toast } from "sonner";
import { apiAttendancePunch, apiAttendanceToday } from "../lib/api";
import {
  currentUserProfile,
  isSuperAdmin,
  currentRole,
  getVendors,
  getBills,
  getPayments,
  getExpenses,
  getEmployees,
} from "../lib/store";

const ALL_ROLES = ["SuperAdmin", "Admin", "GM", "Purchase", "Accounts", "Viewer", "User"];

// ---- Attendance Punch Widget (Feb 2026 · all users, window 09:10-09:30 IST) ----
const AttendancePunchWidget = () => {
  const [state, setState] = useState({ loading: true, myPunch: null, totalToday: 0, inWindow: false, nowIst: "" });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const r = await apiAttendanceToday();
      // Compute IST now + window check client-side (server is authoritative on actual punch)
      const nowUtc = new Date();
      const nowIst = new Date(nowUtc.getTime() + (5 * 60 + 30) * 60 * 1000);
      const mod = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
      const inWindow = mod >= 9 * 60 + 10 && mod <= 9 * 60 + 30;
      setState({ loading: false, myPunch: r.my_punch, totalToday: (r.all || []).length, inWindow, nowIst: `${String(nowIst.getUTCHours()).padStart(2, "0")}:${String(nowIst.getUTCMinutes()).padStart(2, "0")}` });
    } catch (e) {
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  const punch = async () => {
    setBusy(true);
    try {
      const r = await apiAttendancePunch();
      toast.success(`Punched at ${r.punch?.punch_time_ist} IST ✓`);
      await refresh();
    } catch (ex) {
      toast.error(ex.message || "Punch failed");
    } finally {
      setBusy(false);
    }
  };

  const punched = !!state.myPunch;
  const bgGrad = punched ? "linear-gradient(135deg,#15803d,#166534)" : state.inWindow ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#334155,#1e293b)";

  return (
    <div data-testid="attendance-widget" style={{ background: bgGrad, color: "#fff", borderRadius: 8, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, boxShadow: "0 3px 10px rgba(15,23,42,.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Clock size={26} />
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", opacity: 0.85 }}>Daily Attendance</div>
          <div style={{ fontSize: 15, fontWeight: 900 }}>{punched ? `✓ Punched at ${state.myPunch.punch_time_ist} IST` : state.inWindow ? "Punch window OPEN · 09:10 – 09:30 IST" : "Punch window: 09:10 – 09:30 IST"}</div>
          <div style={{ fontSize: 10.5, opacity: 0.85 }}>Current IST: <b>{state.nowIst}</b> · Today's punches: <b>{state.totalToday}</b></div>
        </div>
      </div>
      {!punched && (
        <button data-testid="attendance-punch-btn" onClick={punch} disabled={busy || !state.inWindow} style={{ padding: "9px 20px", background: state.inWindow ? "#fff" : "rgba(255,255,255,.2)", color: state.inWindow ? "#d97706" : "#fff", border: state.inWindow ? "none" : "1px solid rgba(255,255,255,.4)", borderRadius: 6, cursor: state.inWindow && !busy ? "pointer" : "not-allowed", fontWeight: 900, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase", boxShadow: state.inWindow ? "0 2px 8px rgba(0,0,0,.3)" : "none" }}>
          {busy ? "Punching..." : state.inWindow ? "👉 Punch In Now" : "⏳ Window Closed"}
        </button>
      )}
      {punched && <CheckCircle2 size={28} />}
    </div>
  );
};

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
    subtitle: "BOQ · WO · Billing · Expense (Create)",
    to: "/purchase",
    icon: ShoppingCart,
    color: "#16a34a",
    dark: "#15803d",
    lines: [
      "BOQ: create → prepare → submit",
      "Work Order: create → submit",
      "Billing: create + WO + invoice attach",
      "Expense: create → submit",
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
      "All Purchase bills + vendor bills",
      "GST + TDS calculation, compliance",
      "Bill / Expense approval + re-approval",
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
    title: "Reports & Vouchers",
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
    id: "users",
    title: "User Management",
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

  // REAL-TIME CROSS-USER SYNC: re-render badges when App.js dispatches ae-sync-done.
  const [, setSyncTick] = useState(0);
  useEffect(() => {
    const onSync = () => setSyncTick((v) => v + 1);
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

  // Fresh flat alignment per user request (Feb 2026):
  // GM → HR → VENDOR → PURCHASE → ACCOUNTS → REPORTS & VOUCHERS → USER MANAGEMENT
  // Project Management hidden until user approves the layout — route still works
  // for preview but card removed from home grid per user request (Feb 2026).
  const ORDER = ["gm", "hr", "vendor", "purchase", "accounts", "reports", "users"];
  const visibleDepts = ORDER
    .map((id) => DEPARTMENTS.find((d) => d.id === id))
    .filter((d) => d && (d.id !== "users" || superAdmin || role === "Admin"));

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />

      <div className="home-fit" style={{ minHeight: "calc(100vh - 56px)", background: "#f1f5f9", padding: "14px 20px 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }} data-testid="home-page">

          {/* Centered Letterhead */}
          <div style={{ background: "#fff", border: "1.5px solid #0f172a", borderRadius: 10, padding: "10px 18px", boxShadow: "0 2px 8px rgba(15,23,42,.06)" }}>
            <Header formTitle="" compact />
          </div>

          {/* Organisation banner */}
          <div style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #5b21b6 50%, #be185d 100%)", color: "#fff", borderRadius: 8, padding: "12px 20px", textAlign: "center", boxShadow: "0 3px 10px rgba(91,33,182,.22)" }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3, textTransform: "uppercase" }}>Department</div>
          </div>

          {/* Attendance Punch widget — all users (window: 09:10 - 09:30 IST) */}
          <AttendancePunchWidget />

          {/* Flat department grid in user-specified order */}
          <div
            data-testid="dept-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`,
              gap: 14,
              alignItems: "stretch",
            }}
          >
            {visibleDepts.map((d) => {
              const allowed = d.roles.includes(role) || superAdmin;
              return (
                <div key={d.id} style={{ display: "flex", flexDirection: "column" }}>
                  <DepartmentCard dept={d} badge={badges[d.id]} allowed={allowed} onClick={() => { if (allowed) nav(d.to); }} />
                </div>
              );
            })}
          </div>

          {superAdmin && (
            <div style={{ marginTop: 2, padding: "8px 14px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11, color: "#64748b", textAlign: "center" }}>
              💡 <b>SuperAdmin view</b> · aapke paas sabhi 7 modules ka access hai · User Management last card hai.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
