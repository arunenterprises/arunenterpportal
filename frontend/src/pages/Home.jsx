import React from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Users, ShoppingCart, Wallet, UserCog } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import {
  currentUserProfile,
  isSuperAdmin,
  getVendors,
  getBills,
  getPayments,
  getExpenses,
} from "../lib/store";

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
    superOnly: false,
  },
  {
    id: "purchase",
    title: "Bill Processing",
    subtitle: "Invoices · Work Orders · Approvals",
    to: "/bill",
    icon: ShoppingCart,
    color: "#16a34a",
    dark: "#15803d",
    lines: [
      "Bill / Invoice processing",
      "Work order tracking + expiry",
      "Multi-item breakdown (HSN/SAC)",
      "5-step bill approval workflow",
    ],
    superOnly: false,
  },
  {
    id: "expense",
    title: "Expense Process",
    subtitle: "Petty Cash · Reimbursements",
    to: "/expense",
    icon: Wallet,
    color: "#f59e0b",
    dark: "#b45309",
    lines: [
      "Receipt upload + capture",
      "GST + TDS auto calculation",
      "4-step expense approval",
      "Auto Ref No. (AE-EXP-####)",
    ],
    superOnly: false,
  },
  {
    id: "reports",
    title: "Reports & Vouchers",
    subtitle: "Payment Vouchers · UTR · Excel",
    to: "/final",
    icon: UserCog,
    color: "#7c3aed",
    dark: "#5b21b6",
    lines: [
      "Payment voucher generation",
      "UTR / Bank reference tracking",
      "Due list & aging report",
      "Excel / JSON / Print export",
    ],
    superOnly: false,
  },
];

const DepartmentCard = ({ dept, onClick, badge }) => {
  const Icon = dept.icon;
  return (
    <button
      onClick={onClick}
      data-testid={`dept-card-${dept.id}`}
      className="dept-card"
      style={{
        background: `linear-gradient(135deg, ${dept.color} 0%, ${dept.dark} 100%)`,
        cursor: "pointer",
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
        <Icon size={36} strokeWidth={1.8} />
        <div>
          <div className="dept-title">{dept.title}</div>
          <div className="dept-sub">{dept.subtitle}</div>
        </div>
      </div>
      <ul className="dept-lines">
        {dept.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <div className="dept-cta">Open {dept.title} →</div>
    </button>
  );
};

export default function Home() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);

  const vendors = getVendors();
  const bills = getBills();
  const payments = getPayments();
  const expenses = getExpenses();

  const approvedVendors = vendors.filter((v) => v.step === 3).length;
  const approvedBills = bills.filter((b) => Number(b.step) === 5).length;
  const paidVouchers = payments.filter((p) => p.status === "Approved").length;
  const pendingVouchers = payments.filter((p) => p.status !== "Approved").length;

  const badges = {
    vendor: { text: `${approvedVendors}/${vendors.length}`, title: `${approvedVendors} approved of ${vendors.length} vendors` },
    purchase: { text: `${approvedBills}/${bills.length}`, title: `${approvedBills} approved of ${bills.length} bills` },
    expense: { text: `${expenses.length}`, title: `${expenses.length} expenses recorded` },
    reports: { text: `${paidVouchers}/${paidVouchers + pendingVouchers}`, title: `${paidVouchers} approved · ${pendingVouchers} pending vouchers` },
  };

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />

      <div className="app-shell">
        <div className="a4 home-a4" data-testid="home-a4">
          <Header formTitle="Departmental Control Panel" />

          <div className="dept-grid" data-testid="dept-grid">
            {DEPARTMENTS.map((d) => (
              <DepartmentCard
                key={d.id}
                dept={d}
                badge={badges[d.id]}
                onClick={() => nav(d.to)}
              />
            ))}
          </div>

          {superAdmin && (
            <div className="home-super-row" data-testid="home-super-row">
              <button
                className="super-btn"
                data-testid="btn-open-users"
                onClick={() => nav("/users")}
              >
                <UserCog size={16} /> User Management (SuperAdmin) →
              </button>
              <div className="super-note">
                Super Admin panel: employee onboarding, role assignment, password reset, logo upload, reset all data.
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
