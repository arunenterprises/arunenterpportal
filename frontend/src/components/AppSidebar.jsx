import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Gauge, BadgeIndianRupee, UsersRound, PackageSearch, Calculator, Construction, ShieldCheck, Truck, PieChart, KeyRound, ChevronLeft, ChevronRight, Home, Lock } from "lucide-react";
import { getToken } from "../lib/api";
import { can, deptOfPath, loadAcl } from "../lib/acl";

const ITEMS = [
  { n: 1, l: "GM Dashboard", to: "/gm", d: "gm", icon: Gauge, c: "#f59e0b" },
  { n: 2, l: "Client & Revenue", to: "/client-revenue", d: "client", icon: BadgeIndianRupee, c: "#0ea5e9" },
  { n: 3, l: "HR & Labour", to: "/hr", d: "hr", icon: UsersRound, c: "#ec4899" },
  { n: 4, l: "Procurement", to: "/purchase", d: "procurement", icon: PackageSearch, c: "#22c55e" },
  { n: 5, l: "Accounts & Vouchers", to: "/bill", d: "accounts", icon: Calculator, c: "#14b8a6", subs: [{ l: "Bills · Expenses · Fooding", to: "/bill" }, { l: "Payment Vouchers", to: "/final" }] },
  { n: 6, l: "Project & Site", to: "/site", d: "site", icon: Construction, c: "#f97316", subs: [{ l: "DPR · Material Indent", to: "/site" }, { l: "Projects Register", to: "/project" }] },
  { n: 7, l: "QC & Safety", to: "/qc-safety", d: "qc", icon: ShieldCheck, c: "#8b5cf6" },
  { n: 8, l: "Plant & Machinery", to: "/plant", d: "plant", icon: Truck, c: "#eab308" },
  { n: 9, l: "Reports Hub", to: "/reports-hub", d: "reports", icon: PieChart, c: "#6366f1" },
  { n: 10, l: "System Admin", to: "/users", d: "admin", icon: KeyRound, c: "#64748b" },
];
const NO_BAR = ["/login", "/careers", "/jobs", "/vendor-portal", "/home"];

const useAclRev = () => {
  const [, setRev] = useState(0);
  useEffect(() => {
    const on = () => setRev((v) => v + 1);
    window.addEventListener("ae-acl", on);
    return () => window.removeEventListener("ae-acl", on);
  }, []);
};

export const DeptNavList = ({ mini = false, showSubs = true }) => {
  const loc = useLocation();
  const nav = useNavigate();
  useAclRev();
  const at = (to) => loc.pathname === to;
  return ITEMS.map((it) => {
    const Icon = it.icon;
    const ok = can(it.d, "v");
    const act = at(it.to) || (it.subs || []).some((s) => at(s.to));
    return (
      <div key={it.n}>
        <button data-testid={`sidebar-${it.n}`} disabled={!ok} onClick={() => nav(it.to)} title={ok ? it.l : `${it.l} · permission nahi`} className={`sb-item${act ? " active" : ""}`} style={{ "--c": it.c, opacity: ok ? 1 : 0.4 }}>
          <span className="sb-ico" style={{ background: `linear-gradient(135deg, ${it.c}, ${it.c}99)` }}><Icon size={15} color="#fff" strokeWidth={2.2} /></span>
          {!mini && <span>{it.n}. {it.l}</span>}
          {!mini && !ok && <Lock size={11} style={{ marginLeft: "auto" }} />}
        </button>
        {showSubs && !mini && act && it.subs && it.subs.filter((s) => s.to !== it.to).map((s) => (
          <button key={s.to} data-testid={`sidebar-sub-${s.to.slice(1)}`} onClick={() => nav(s.to)} className={`sb-sub${at(s.to) ? " active" : ""}`}>{s.l}</button>
        ))}
      </div>
    );
  });
};

export const AppSidebar = () => {
  const loc = useLocation();
  const nav = useNavigate();
  const [mini, setMini] = useState(() => localStorage.getItem("ae_sidebar_mini") === "1");
  const show = !!getToken() && loc.pathname !== "/" && !NO_BAR.some((p) => loc.pathname.startsWith(p));
  useEffect(() => {
    document.body.classList.toggle("has-sidebar", show);
    document.body.classList.toggle("sidebar-mini", show && mini);
    localStorage.setItem("ae_sidebar_mini", mini ? "1" : "0");
  }, [show, mini]);
  if (!show) return null;
  return (
    <aside data-testid="app-sidebar" className="app-sidebar no-print">
      <div style={{ display: "flex", alignItems: "center", justifyContent: mini ? "center" : "space-between", padding: "10px 10px 8px" }}>
        {!mini && <button data-testid="sidebar-home" onClick={() => nav("/home")} className="sb-home"><Home size={13} /> Home</button>}
        <button data-testid="sidebar-toggle" onClick={() => setMini(!mini)} className="sb-toggle" title={mini ? "Sidebar kholein" : "Sidebar chhota karein"}>{mini ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
      </div>
      <DeptNavList mini={mini} />
    </aside>
  );
};

export const AclGate = () => {
  const loc = useLocation();
  const nav = useNavigate();
  useAclRev();
  const authed = !!getToken() && !["/login", "/careers", "/jobs", "/vendor-portal"].some((p) => loc.pathname.startsWith(p));
  useEffect(() => { if (authed) loadAcl(); }, [authed, loc.pathname]);
  if (!authed || can(deptOfPath(loc.pathname), "v")) return null;
  return (
    <div data-testid="acl-blocked" style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(241,245,249,.97)", display: "grid", placeItems: "center" }}>
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 28, textAlign: "center", boxShadow: "0 10px 30px rgba(15,23,42,.12)" }}>
        <Lock size={34} color="#dc2626" />
        <div style={{ fontSize: 18, fontWeight: 900, margin: "8px 0 4px" }}>Is department ki permission nahi hai</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 14 }}>SuperAdmin se System Admin → Permissions mein "View" tick karwayein.</div>
        <button data-testid="acl-blocked-home" onClick={() => nav("/home")} style={{ padding: "8px 18px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, cursor: "pointer" }}>Home par jayein</button>
      </div>
    </div>
  );
};
