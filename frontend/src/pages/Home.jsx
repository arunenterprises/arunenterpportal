import React from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Users, ShoppingCart, Wallet, UserCog, LogOut, Home as HomeIcon } from "lucide-react";
import Header from "../components/Header";
import { logout, currentUser, currentUserProfile, isSuperAdmin } from "../lib/store";

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
    title: "Purchase Management",
    subtitle: "Bills · Work Orders · Expenses",
    to: "/bill",
    icon: ShoppingCart,
    color: "#16a34a",
    dark: "#15803d",
    lines: [
      "Bill / Invoice processing",
      "Work order tracking + expiry",
      "Multi-item breakdown (HSN/SAC)",
      "Expense process (linked)",
    ],
    superOnly: false,
  },
  {
    id: "account",
    title: "Account Management",
    subtitle: "Payment Vouchers · UTR · Reports",
    to: "/final",
    icon: Wallet,
    color: "#f59e0b",
    dark: "#b45309",
    lines: [
      "Payment voucher generation",
      "UTR / Bank ref tracking",
      "Due list & aging",
      "Excel / JSON exports",
    ],
    superOnly: false,
  },
  {
    id: "users",
    title: "User Management",
    subtitle: "Employees · Roles · Passwords",
    to: "/users",
    icon: UserCog,
    color: "#7c3aed",
    dark: "#5b21b6",
    lines: [
      "Employee onboarding",
      "Role-based access (Admin / User)",
      "Password management",
      "Super Admin: Reset All Data",
    ],
    superOnly: true,
  },
];

const DepartmentCard = ({ dept, onClick, disabled }) => {
  const Icon = dept.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={`dept-card-${dept.id}`}
      className="dept-card"
      style={{
        background: `linear-gradient(135deg, ${dept.color} 0%, ${dept.dark} 100%)`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div className="dept-card-header">
        <Icon size={44} strokeWidth={1.8} />
        <div>
          <div className="dept-title">{dept.title}</div>
          <div className="dept-sub">{dept.subtitle}</div>
        </div>
      </div>
      <ul className="dept-lines">
        {dept.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
      <div className="dept-cta">
        {disabled ? "🔒 Super Admin Only" : `Open ${dept.title} →`}
      </div>
    </button>
  );
};

const FlowDiagram = () => (
  <svg viewBox="0 0 900 340" xmlns="http://www.w3.org/2000/svg" data-testid="flow-diagram"
    style={{ width: "100%", maxWidth: 900, height: "auto", background: "#fafafa", borderRadius: 8, border: "1px solid #e2e8f0" }}>
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#334155" />
      </marker>
    </defs>

    {/* Title */}
    <text x="450" y="24" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">
      Arun Enterprises · Departmental Workflow
    </text>

    {/* Vendor box */}
    <g>
      <rect x="30" y="60" width="180" height="100" rx="10" fill="#0ea5e9" />
      <text x="120" y="90" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">1. VENDOR</text>
      <text x="120" y="108" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">MANAGEMENT</text>
      <text x="120" y="132" textAnchor="middle" fontSize="10" fill="#e0f2fe">Register &amp; approve</text>
      <text x="120" y="146" textAnchor="middle" fontSize="10" fill="#e0f2fe">vendor / party</text>
    </g>

    {/* Purchase box */}
    <g>
      <rect x="260" y="60" width="180" height="100" rx="10" fill="#16a34a" />
      <text x="350" y="90" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">2. PURCHASE</text>
      <text x="350" y="108" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">MANAGEMENT</text>
      <text x="350" y="132" textAnchor="middle" fontSize="10" fill="#dcfce7">Bills · WO · Expenses</text>
      <text x="350" y="146" textAnchor="middle" fontSize="10" fill="#dcfce7">against approved vendors</text>
    </g>

    {/* Account box */}
    <g>
      <rect x="490" y="60" width="180" height="100" rx="10" fill="#f59e0b" />
      <text x="580" y="90" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">3. ACCOUNT</text>
      <text x="580" y="108" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">MANAGEMENT</text>
      <text x="580" y="132" textAnchor="middle" fontSize="10" fill="#fef3c7">Vouchers · UTR · Reports</text>
      <text x="580" y="146" textAnchor="middle" fontSize="10" fill="#fef3c7">on approved bills</text>
    </g>

    {/* Users box (below, spanning across) */}
    <g>
      <rect x="260" y="230" width="410" height="80" rx="10" fill="#7c3aed" />
      <text x="465" y="258" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">4. USER MANAGEMENT (Super Admin)</text>
      <text x="465" y="278" textAnchor="middle" fontSize="10" fill="#ede9fe">Grants roles &amp; permissions to actors of all 3 departments</text>
      <text x="465" y="294" textAnchor="middle" fontSize="10" fill="#ede9fe">Password reset · Employee register · Reset All Data</text>
    </g>

    {/* Arrows */}
    {/* Vendor → Purchase */}
    <line x1="215" y1="110" x2="255" y2="110" stroke="#334155" strokeWidth="2" markerEnd="url(#arr)" />
    <text x="235" y="102" textAnchor="middle" fontSize="9" fill="#334155">creates</text>

    {/* Purchase → Account */}
    <line x1="445" y1="110" x2="485" y2="110" stroke="#334155" strokeWidth="2" markerEnd="url(#arr)" />
    <text x="465" y="102" textAnchor="middle" fontSize="9" fill="#334155">approves</text>

    {/* Account → Vendor (payment feedback loop) */}
    <path d="M580,160 Q580,200 400,205 Q120,210 120,160" fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arr)" />
    <text x="380" y="200" textAnchor="middle" fontSize="9" fill="#64748b" fontStyle="italic">pays vendor (voucher + UTR)</text>

    {/* Users → each dept (permission arrows) */}
    <line x1="350" y1="230" x2="350" y2="165" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arr)" />
    <line x1="580" y1="230" x2="580" y2="165" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arr)" />
    <path d="M265,240 Q140,210 120,165" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arr)" />
    <text x="700" y="230" fontSize="9" fill="#7c3aed" fontStyle="italic">permissions</text>

    {/* Right box: outputs */}
    <g>
      <rect x="720" y="60" width="150" height="100" rx="10" fill="#0f172a" />
      <text x="795" y="92" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">Outputs</text>
      <text x="795" y="115" textAnchor="middle" fontSize="10" fill="#cbd5e1">📄 PDF / Print</text>
      <text x="795" y="132" textAnchor="middle" fontSize="10" fill="#cbd5e1">📊 Excel export</text>
      <text x="795" y="149" textAnchor="middle" fontSize="10" fill="#cbd5e1">🔗 JSON backup</text>
    </g>
    <line x1="675" y1="110" x2="715" y2="110" stroke="#334155" strokeWidth="2" markerEnd="url(#arr)" />
  </svg>
);

export default function Home() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const superAdmin = isSuperAdmin(me?.user);
  const doLogout = () => { logout(); nav("/login"); };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="home-shell">
        <div className="home-topbar">
          <div className="home-brand">
            <HomeIcon size={16} /> <span>ARUN ENTERPRISES · Control Panel</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#334155" }}>
              👤 <b>{me?.name || currentUser()}</b>
              <span style={{ marginLeft: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700, borderRadius: 999,
                background: superAdmin ? "#f3e8ff" : "#dbeafe",
                color: superAdmin ? "#6b21a8" : "#1e40af",
                letterSpacing: 0.4 }}>
                {superAdmin ? "SUPERADMIN" : (me?.role || "User").toUpperCase()}
              </span>
            </span>
            <button
              onClick={doLogout}
              data-testid="btn-logout"
              style={{ padding: "6px 14px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>

        <Header formTitle="Departmental Control Panel" />

        <div className="dept-grid" data-testid="dept-grid">
          {DEPARTMENTS.map((d) => (
            <DepartmentCard
              key={d.id}
              dept={d}
              disabled={d.superOnly && !superAdmin}
              onClick={() => {
                if (d.superOnly && !superAdmin) return;
                nav(d.to);
              }}
            />
          ))}
        </div>

        <div className="home-flow" data-testid="home-flow">
          <div className="home-flow-title">🗺️ System Flow · Department Interconnection</div>
          <FlowDiagram />
          <div className="home-flow-legend">
            <b>How they link:</b> Vendor Management me approved vendors → Purchase Management me un vendors ke against Bills / Work Orders / Expenses create hote hain → Account Management me un approved bills ke Payment Vouchers + UTR track hote hain aur reports generate hote hain. User Management (SuperAdmin only) sabhi 3 departments ke actors ko roles + permissions issue karta hai.
          </div>
        </div>
      </div>
    </>
  );
}
