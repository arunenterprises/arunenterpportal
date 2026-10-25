import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCircle2, Save, KeyRound } from "lucide-react";
import { apiUpdateMyAccount, apiChangeMyPassword, apiMe } from "../lib/api";

const box = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, marginBottom: 16 };
const inp = { width: "100%", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13 };
const lbl = { fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4, display: "block" };
const btn = { display: "inline-flex", alignItems: "center", gap: 6, background: "#0f766e", color: "#fff", border: 0, borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" };

const Info = ({ k, v }) => (
  <div><span style={lbl}>{k}</span><div data-testid={`myacc-info-${k.toLowerCase().replace(/\s+/g, "-")}`} style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a" }}>{v || "—"}</div></div>
);

const ContactForm = ({ me }) => {
  const [f, setF] = useState({ email: me?.email || "", mobile: me?.mobile || "", current_password: "" });
  const go = async () => {
    if (!f.current_password) return toast.error("Current password bharein");
    try {
      const r = await apiUpdateMyAccount(f);
      toast.success("Details update ho gayi");
      if (r.relogin) { toast.info("Email badli hai — naye email se dobara login karein"); setTimeout(() => { localStorage.clear(); window.location.href = "/login"; }, 1500); }
      setF({ ...f, current_password: "" });
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Email & Mobile No Update</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div><label style={lbl}>Email ID</label><input data-testid="myacc-email" style={inp} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label style={lbl}>Mobile No</label><input data-testid="myacc-mobile" style={inp} maxLength={10} value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value.replace(/\D/g, "") })} /></div>
        <div><label style={lbl}>Current Password</label><input data-testid="myacc-cur-pass" type="password" style={inp} value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} /></div>
        <button data-testid="myacc-save" style={btn} onClick={go}><Save size={14} /> Save</button>
      </div>
    </div>
  );
};

const PasswordForm = () => {
  const [p, setP] = useState({ old: "", n1: "", n2: "" });
  const go = async () => {
    if (p.n1.length < 4) return toast.error("Naya password kam se kam 4 akshar");
    if (p.n1 !== p.n2) return toast.error("Dono naye password match nahi karte");
    try { await apiChangeMyPassword(p.old, p.n1); toast.success("Password badal gaya"); setP({ old: "", n1: "", n2: "" }); } catch (e) { toast.error(e.message); }
  };
  return (
    <div style={box}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Password Change</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div><label style={lbl}>Current Password</label><input data-testid="myacc-old-pass" type="password" style={inp} value={p.old} onChange={(e) => setP({ ...p, old: e.target.value })} /></div>
        <div><label style={lbl}>New Password</label><input data-testid="myacc-new-pass" type="password" style={inp} value={p.n1} onChange={(e) => setP({ ...p, n1: e.target.value })} /></div>
        <div><label style={lbl}>Confirm New Password</label><input data-testid="myacc-new-pass2" type="password" style={inp} value={p.n2} onChange={(e) => setP({ ...p, n2: e.target.value })} /></div>
        <button data-testid="myacc-pass-save" style={{ ...btn, background: "#1d4ed8" }} onClick={go}><KeyRound size={14} /> Change</button>
      </div>
    </div>
  );
};

export const MyAccount = () => {
  const [me, setMe] = useState(null);
  useEffect(() => { apiMe().then(setMe).catch(() => setMe({})); }, []);
  if (!me) return <div style={{ padding: 30 }}>Loading…</div>;
  return (
  <div data-testid="my-account-page" style={{ padding: "18px 24px", maxWidth: 1100 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <UserCircle2 size={30} color="#0f766e" />
      <div><div style={{ fontSize: 20, fontWeight: 900 }}>System Management · My Account</div><div style={{ fontSize: 12, color: "#64748b" }}>General view — aap sirf apna Email, Mobile No aur Password badal sakte hain</div></div>
    </div>
    <div style={{ ...box, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
      <Info k="Name" v={me?.name} /><Info k="Email ID" v={me?.email} /><Info k="Mobile No" v={me?.mobile} /><Info k="Role" v={me?.role} />
      <Info k="Employee ID" v={me?.employee_id} /><Info k="Designation" v={me?.designation} /><Info k="Department" v={me?.department} /><Info k="Status" v="Active" />
    </div>
    <ContactForm me={me} />
    <PasswordForm />
  </div>
  );
};
