import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, ArrowLeft, ArrowUpRight, Sun, Moon } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import { DEPT_ITEMS } from "../components/AppSidebar";
import { can } from "../lib/acl";
import { currentUserProfile, isSuperAdmin, currentRole, getVendors, getBills, getPayments, getExpenses, getEmployees, getCompany, getLogo } from "../lib/store";
import "./home3d.css";

const DESC = {
  gm: "Sab departments ka consolidated view aur final approval",
  client: "Work Order, MB, RA Bill, Tax Invoice aur Abstract",
  hr: "Employees, attendance, payroll aur recruitment",
  procurement: "Vendor, BOQ, Work Order aur vendor bills",
  accounts: "Bill verification, GST/TDS aur payment vouchers",
  site: "DPR, material indent aur site progress",
  qc: "Lab test reports aur daily safety audits",
  plant: "Machinery allocation, running hours aur diesel",
  reports: "Department-wise reports, Excel, PDF aur print",
  admin: "Users, roles, permissions aur backups",
};
const ANIM = [
  { rotate: [0, 360] }, { y: [0, -6, 0] }, { scale: [1, 1.15, 1] }, { rotate: [0, -12, 12, 0] }, { y: [0, -5, 0], rotate: [0, 6, 0] },
];
const SLABS = [...DEPT_ITEMS].reverse();

const Tower = ({ hot }) => (
  <div className="b3-tower" data-testid="b3-tower">
    {SLABS.map((it, i) => (
      <motion.div key={it.n} className={`b3-slab${hot === it.d ? " hot" : ""}`} style={{ "--c": it.c, "--z": `${(SLABS.length - i) * 22}px` }}
        initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + (SLABS.length - i) * 0.07, type: "spring", stiffness: 120, damping: 14 }}>
        <span className="b3-slab-in"><span className="b3-slab-top" /><span className="b3-slab-l" /><span className="b3-slab-r" /></span>
      </motion.div>
    ))}
  </div>
);

const Tile = ({ it, i, onOpen, onHot }) => {
  const ok = can(it.d, "v");
  const Icon = it.icon;
  return (
    <motion.button data-testid={`b3-tile-${it.d}`} disabled={!ok} onClick={() => onOpen(it.to)} onMouseEnter={() => onHot(it.d)} onMouseLeave={() => onHot(null)}
      className={`b3-tile${ok ? "" : " locked"}${i === 0 || i === 4 ? " wide" : ""}`} style={{ "--c": it.c }}
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.05, type: "spring", stiffness: 140, damping: 16 }}>
      <span className="b3-layer l2" /><span className="b3-layer l1" />
      <span className="b3-face">
        <span className="b3-tile-head">
          <motion.span className="b3-ico" animate={ANIM[i % ANIM.length]} transition={{ duration: i % 5 === 0 ? 9 : 3, repeat: Infinity, ease: i % 5 === 0 ? "linear" : "easeInOut" }}>
            <Icon size={22} strokeWidth={2.2} />
          </motion.span>
          <span className="b3-tag">{String(it.n).padStart(2, "0")}</span>
        </span>
        <span className="b3-tile-title">{it.l}</span>
        <span className="b3-tile-desc">{DESC[it.d]}</span>
        <span className="b3-tile-cta">{ok ? <>Open <ArrowUpRight size={14} /></> : <><Lock size={12} /> Not Permitted</>}</span>
      </span>
    </motion.button>
  );
};

export default function Home3D() {
  const nav = useNavigate();
  const [mode, setMode] = useState(() => localStorage.getItem("ae_home3d_mode") || "light");
  const [hot, setHot] = useState(null);
  const toggle = () => { const m = mode === "light" ? "dark" : "light"; setMode(m); localStorage.setItem("ae_home3d_mode", m); };
  const me = currentUserProfile();
  const sa = isSuperAdmin(me?.user);
  const name = sa ? "Ashish Srivastava" : (me?.name || me?.user?.split("@")[0] || "");
  const co = getCompany();
  const logo = getLogo() || "/arun-logo.jpg";
  const vendors = getVendors(), bills = getBills(), pays = getPayments(), exps = getExpenses(), emps = getEmployees();
  const pending = vendors.filter((v) => v.step === 2).length + bills.filter((b) => Number(b.step) === 4).length + pays.filter((p) => p.status === "Submitted").length + exps.filter((x) => Number(x.step) === 3).length;
  const stats = [
    ["Approved Vendors", vendors.filter((v) => v.step === 3).length, vendors.length, "#0ea5e9", "vendor"],
    ["Approved Bills", bills.filter((b) => Number(b.step) === 5).length, bills.length, "#10b981", "bills"],
    ["Approved Vouchers", pays.filter((p) => p.status === "Approved").length, pays.length, "#f59e0b", "vouchers"],
    ["HR Finalized", emps.filter((e) => Number(e.step) === 5).length, emps.length, "#ec4899", "hr"],
  ];
  return (
    <>
      <HomeNavBar />
      <div className={`b3-root b3-${mode}`} data-testid="home-3d-page">
        <div className="b3-blueprint" />
        <div className="b3-wrap">
          <div className="b3-topbar">
            <span className="b3-draft" data-testid="h3d-draft-badge">DRAFT 2 · PREVIEW</span>
            <div className="b3-actions">
              <button className="b3-pill" data-testid="theme-toggle-button" onClick={toggle}>{mode === "light" ? <><Moon size={14} /> Dark</> : <><Sun size={14} /> Light</>}</button>
              <button className="b3-pill" data-testid="h3d-back-btn" onClick={() => nav("/home")}><ArrowLeft size={14} /> Purana Home</button>
            </div>
          </div>
          <section className="b3-hero">
            <div className="b3-hero-left">
              <motion.div className="b3-brand" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                <img src={logo} alt="logo" className="b3-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div>
                  <div className="b3-kicker">Namaste, {name} · {sa ? "SuperAdmin" : (currentRole() || "User")}</div>
                  <h1 className="b3-h1" data-testid="h3d-company-name">{co.name}</h1>
                  <div className="b3-sub">{co.tagline}</div>
                </div>
              </motion.div>
              <div className="b3-kpis">
                <motion.div className="b3-pending" data-testid="h3d-pending" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <span>Pending Approvals</span><b>{pending}</b>
                </motion.div>
                {stats.map((s, i) => (
                  <motion.div key={s[0]} className="b3-kpi" style={{ "--c": s[3] }} data-testid={`kpi-${s[4]}-stat`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}>
                    <span>{s[0]}</span><b>{s[1]}<small> / {s[2]}</small></b>
                  </motion.div>
                ))}
              </div>
            </div>
            <Tower hot={hot} />
          </section>
          <div className="b3-section">Departments <span>· 10 modules</span></div>
          <div className="b3-tiles">{DEPT_ITEMS.map((it, i) => <Tile key={it.n} it={it} i={i} onOpen={nav} onHot={setHot} />)}</div>
        </div>
      </div>
    </>
  );
}
