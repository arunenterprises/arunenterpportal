import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Crown, Handshake, Users, ShoppingCart, Landmark, HardHat, FlaskConical, Tractor, BarChart3, Settings, ChevronLeft, ChevronRight, Home } from "lucide-react";
import { getToken } from "../lib/api";

const ITEMS = [
  { n: 1, l: "GM Dashboard", to: "/gm", icon: Crown, c: "#f59e0b" },
  { n: 2, l: "Client & Revenue", to: "/client-revenue", icon: Handshake, c: "#38bdf8" },
  { n: 3, l: "HR & Labour", to: "/hr", icon: Users, c: "#f472b6" },
  { n: 4, l: "Procurement", to: "/purchase", icon: ShoppingCart, c: "#4ade80", subs: [{ l: "Vendor Registration", to: "/vendor" }, { l: "BOQ · WO · Bill Inward", to: "/purchase" }] },
  { n: 5, l: "Accounts & Vouchers", to: "/bill", icon: Landmark, c: "#2dd4bf", subs: [{ l: "Bills · Expenses · Fooding", to: "/bill" }, { l: "Payment Vouchers", to: "/final" }] },
  { n: 6, l: "Project & Site", to: "/site", icon: HardHat, c: "#fb923c", subs: [{ l: "DPR · Material Indent", to: "/site" }, { l: "Projects Register", to: "/project" }] },
  { n: 7, l: "QC & Safety", to: "/qc-safety", icon: FlaskConical, c: "#a78bfa" },
  { n: 8, l: "Plant & Machinery", to: "/plant", icon: Tractor, c: "#facc15" },
  { n: 9, l: "Reports Hub", to: "/reports-hub", icon: BarChart3, c: "#818cf8" },
  { n: 10, l: "System Admin", to: "/users", icon: Settings, c: "#94a3b8" },
];
const HIDE = ["/login", "/careers", "/jobs", "/vendor-portal"];

export const AppSidebar = () => {
  const loc = useLocation();
  const nav = useNavigate();
  const [mini, setMini] = useState(() => localStorage.getItem("ae_sidebar_mini") === "1");
  const show = !!getToken() && !HIDE.some((p) => loc.pathname.startsWith(p)) && loc.pathname !== "/";
  useEffect(() => {
    document.body.classList.toggle("has-sidebar", show);
    document.body.classList.toggle("sidebar-mini", show && mini);
    localStorage.setItem("ae_sidebar_mini", mini ? "1" : "0");
  }, [show, mini]);
  if (!show) return null;
  const at = (to) => loc.pathname === to;
  return (
    <aside data-testid="app-sidebar" className="app-sidebar no-print">
      <div style={{ display: "flex", alignItems: "center", justifyContent: mini ? "center" : "space-between", padding: "10px 10px 8px" }}>
        {!mini && <button data-testid="sidebar-home" onClick={() => nav("/home")} className="sb-home"><Home size={13} /> Home</button>}
        <button data-testid="sidebar-toggle" onClick={() => setMini(!mini)} className="sb-toggle" title={mini ? "Sidebar kholein" : "Sidebar chhota karein"}>{mini ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
      </div>
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const act = at(it.to) || (it.subs || []).some((s) => at(s.to));
        return (
          <div key={it.n}>
            <button data-testid={`sidebar-${it.n}`} onClick={() => nav(it.to)} title={it.l} className={`sb-item${act ? " active" : ""}`} style={{ "--c": it.c }}>
              <Icon size={16} color={it.c} />{!mini && <span>{it.n}. {it.l}</span>}
            </button>
            {!mini && act && it.subs && it.subs.map((s) => (
              <button key={s.to} data-testid={`sidebar-sub-${s.to.slice(1)}`} onClick={() => nav(s.to)} className={`sb-sub${at(s.to) ? " active" : ""}`}>{s.l}</button>
            ))}
          </div>
        );
      })}
    </aside>
  );
};
