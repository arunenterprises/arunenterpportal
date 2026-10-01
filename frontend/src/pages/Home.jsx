import React from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Users, ShoppingCart, Landmark, Briefcase, FileBarChart, UserCog, UserCheck } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import {
  currentUserProfile,
  isSuperAdmin,
  currentRole,
  getVendors,
  getBills,
  getPayments,
  getExpenses,
} from "../lib/store";

const ALL_ROLES = ["SuperAdmin", "Admin", "GM", "Purchase", "Accounts", "Viewer", "User"];

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
    roles: ["SuperAdmin"],
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

  const badges = {
    vendor: { text: `${approvedVendors}/${vendors.length}`, title: `${approvedVendors} approved of ${vendors.length} vendors` },
    purchase: { text: `${expenses.length + bills.length}`, title: `${bills.length} bills · ${expenses.length} expenses in the pipeline` },
    accounts: { text: `${approvedBills}/${bills.length}`, title: `${approvedBills} approved of ${bills.length} bills` },
    gm: { text: `${pendingApprovals} pending`, title: `${pendingApprovals} items pending GM final approval` },
    reports: { text: `${paidVouchers}/${payments.length}`, title: `${paidVouchers} approved vouchers of ${payments.length}` },
    users: null,
  };

  // Every authed user sees all department cards on Home so they can navigate to
  // read-only / creator-tier pages. Per-page RBAC gates what they can DO inside.
  // Only the "User Management" tile stays SuperAdmin-only.
  const visibleDepts = DEPARTMENTS.filter((d) => {
    if (d.id === "users") return superAdmin;
    return true;
  });

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />

      <div className="app-shell">
        <div className="a4 home-a4" data-testid="home-a4">
          <Header formTitle="Organisation Control Panel" />

          {/* ---------- TIER 1 — Executive (GM) ---------- */}
          <div data-testid="org-tier-1" style={{ display: "flex", justifyContent: "center", margin: "6px 0 0" }}>
            <div style={{ width: "min(560px, 100%)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#5b21b6", letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center", marginBottom: 6 }}>Executive · Approval Authority</div>
              {(() => {
                const gm = DEPARTMENTS.find((d) => d.id === "gm");
                const allowed = gm.roles.includes(role) || superAdmin;
                return <DepartmentCard dept={gm} badge={badges.gm} allowed={allowed} onClick={() => allowed && nav(gm.to)} />;
              })()}
            </div>
          </div>

          {/* Connector line */}
          <div aria-hidden style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
            <div style={{ width: 2, height: 22, background: "linear-gradient(to bottom, #7c3aed, #cbd5e1)" }} />
          </div>
          <div aria-hidden style={{ height: 2, background: "linear-gradient(to right, transparent 8%, #cbd5e1 15%, #cbd5e1 85%, transparent 92%)", margin: "0 4%" }} />

          {/* ---------- TIER 2 — Operating Departments ---------- */}
          <div data-testid="org-tier-2" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#0f172a", letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>Operating Departments</div>
            <div className="dept-grid" data-testid="dept-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {["vendor", "purchase", "accounts", "hr", "reports"].map((id) => {
                const d = DEPARTMENTS.find((x) => x.id === id);
                if (!d) return null;
                const allowed = d.roles.includes(role) || superAdmin;
                return (
                  <DepartmentCard
                    key={d.id}
                    dept={d}
                    badge={badges[d.id]}
                    allowed={allowed}
                    onClick={() => { if (allowed) nav(d.to); }}
                  />
                );
              })}
            </div>
          </div>

          {/* ---------- TIER 3 — Administration (SuperAdmin only) ---------- */}
          {superAdmin && (
            <>
              <div aria-hidden style={{ display: "flex", justifyContent: "center", margin: "10px 0 4px" }}>
                <div style={{ width: 2, height: 20, background: "linear-gradient(to bottom, #cbd5e1, #dc2626)" }} />
              </div>
              <div data-testid="org-tier-3" style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ width: "min(560px, 100%)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#991b1b", letterSpacing: 1.5, textTransform: "uppercase", textAlign: "center", marginBottom: 6 }}>System Administration · SuperAdmin</div>
                  {(() => {
                    const u = DEPARTMENTS.find((d) => d.id === "users");
                    return <DepartmentCard dept={u} badge={badges.users} allowed={true} onClick={() => nav(u.to)} />;
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
