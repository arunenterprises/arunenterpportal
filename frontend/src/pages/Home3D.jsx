import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Lock, ArrowLeft, ArrowUpRight } from "lucide-react";
import HomeNavBar from "../components/HomeNavBar";
import { DEPT_ITEMS } from "../components/AppSidebar";
import { can } from "../lib/acl";
import { currentUserProfile, isSuperAdmin, currentRole, getVendors, getBills, getPayments, getExpenses, getEmployees, getCompany, getLogo } from "../lib/store";
import "./home3d.css";

const TiltCard = ({ it, i, onOpen }) => {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [14, -14]), { stiffness: 180, damping: 16 });
  const ry = useSpring(useTransform(mx, [0, 1], [-14, 14]), { stiffness: 180, damping: 16 });
  const ok = can(it.d, "v");
  const Icon = it.icon;
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const leave = () => { mx.set(0.5); my.set(0.5); };
  return (
    <motion.button
      ref={ref} data-testid={`h3d-card-${it.d}`} disabled={!ok} onClick={() => onOpen(it.to)}
      onMouseMove={move} onMouseLeave={leave}
      initial={{ opacity: 0, y: 40, rotateX: 25 }} animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: 0.08 * i, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ rotateX: rx, rotateY: ry, "--c": it.c }} className={`h3d-card${ok ? "" : " locked"}`}
    >
      <div className="h3d-card-glow" />
      <div className="h3d-num">{String(it.n).padStart(2, "0")}</div>
      <motion.div className="h3d-ico" animate={{ y: [0, -7, 0], rotateZ: [0, -4, 4, 0] }} transition={{ duration: 3.2 + (i % 3) * 0.5, repeat: Infinity, ease: "easeInOut" }}>
        <Icon size={30} strokeWidth={2} />
      </motion.div>
      <div className="h3d-title">{it.l}</div>
      <div className="h3d-cta">{ok ? <>Open <ArrowUpRight size={14} /></> : <><Lock size={12} /> Not Permitted</>}</div>
    </motion.button>
  );
};

const Stat = ({ label, value, total, c, i }) => (
  <motion.div className="h3d-stat" style={{ "--c": c }} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.07 }} data-testid={`h3d-stat-${i}`}>
    <div className="h3d-stat-l">{label}</div>
    <div className="h3d-stat-v">{value}{total !== undefined && <span> / {total}</span>}</div>
  </motion.div>
);

export default function Home3D() {
  const nav = useNavigate();
  const me = currentUserProfile();
  const sa = isSuperAdmin(me?.user);
  const name = sa ? "Ashish Srivastava" : (me?.name || me?.user?.split("@")[0] || "");
  const co = getCompany();
  const logo = getLogo() || "/arun-logo.jpg";
  const vendors = getVendors(), bills = getBills(), pays = getPayments(), exps = getExpenses(), emps = getEmployees();
  const pending = vendors.filter((v) => v.step === 2).length + bills.filter((b) => Number(b.step) === 4).length + pays.filter((p) => p.status === "Submitted").length + exps.filter((x) => Number(x.step) === 3).length;
  const stats = [
    ["Approved Vendors", vendors.filter((v) => v.step === 3).length, vendors.length, "#0ea5e9"],
    ["Approved Bills", bills.filter((b) => Number(b.step) === 5).length, bills.length, "#22c55e"],
    ["Approved Vouchers", pays.filter((p) => p.status === "Approved").length, pays.length, "#f59e0b"],
    ["HR Finalized", emps.filter((e) => Number(e.step) === 5).length, emps.length, "#ec4899"],
  ];
  return (
    <>
      <HomeNavBar />
      <div className="h3d-root" data-testid="home-3d-page">
        <div className="h3d-grid-floor" />
        <div className="h3d-orb o1" /><div className="h3d-orb o2" /><div className="h3d-orb o3" />
        <div className="h3d-wrap">
          <div className="h3d-topbar">
            <span className="h3d-draft" data-testid="h3d-draft-badge">DRAFT PREVIEW</span>
            <button className="h3d-back" data-testid="h3d-back-btn" onClick={() => nav("/home")}><ArrowLeft size={14} /> Purana Home</button>
          </div>
          <motion.header className="h3d-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <motion.div className="h3d-logo" animate={{ rotateY: [0, 12, -12, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}>
              <img src={logo} alt="logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            </motion.div>
            <div className="h3d-hero-txt">
              <div className="h3d-kicker">Namaste, {name} · {sa ? "SUPERADMIN" : (currentRole() || "USER")}</div>
              <h1 className="h3d-h1" data-testid="h3d-company-name">{co.name}</h1>
              <div className="h3d-tag">{co.tagline}</div>
            </div>
            <div className="h3d-pending" data-testid="h3d-pending">
              <div className="h3d-pending-l">Pending Approvals</div>
              <div className="h3d-pending-v">{pending}</div>
            </div>
          </motion.header>
          <div className="h3d-stats">{stats.map((s, i) => <Stat key={s[0]} label={s[0]} value={s[1]} total={s[2]} c={s[3]} i={i} />)}</div>
          <div className="h3d-section">Departments</div>
          <div className="h3d-cards">{DEPT_ITEMS.map((it, i) => <TiltCard key={it.n} it={it} i={i} onOpen={nav} />)}</div>
        </div>
      </div>
    </>
  );
}
