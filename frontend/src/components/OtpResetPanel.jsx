import React, { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { apiOtpReset } from "../lib/api";

export const OtpResetPanel = ({ users }) => {
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!sel) return toast.error("User chunein");
    if (!window.confirm(`${sel} ka Login OTP reset karein? Agle 30 minute mein yeh user ek baar bina OTP ke login kar payega.`)) return;
    setBusy(true);
    try { await apiOtpReset(sel); toast.success(`${sel} · OTP reset ho gaya · ab bina OTP ek baar login kar sakta hai (30 min)`); setSel(""); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div data-testid="otp-reset-panel" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8, padding: "10px 14px", margin: "12px 0" }}>
      <KeyRound size={18} color="#c2410c" />
      <b style={{ fontSize: 13, color: "#9a3412" }}>Login OTP Reset</b>
      <select data-testid="otp-reset-user" value={sel} onChange={(e) => setSel(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #fdba74", fontSize: 12.5, minWidth: 280 }}>
        <option value="">— User chunein —</option>
        {users.map((u) => <option key={u.email} value={u.email}>{u.name || u.email} · {u.email}</option>)}
      </select>
      <button data-testid="otp-reset-btn" disabled={busy} onClick={run} style={{ padding: "7px 14px", background: "#c2410c", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{busy ? "Resetting…" : "Reset OTP & Allow Login"}</button>
      <span style={{ fontSize: 11, color: "#9a3412" }}>OTP / email na aaye to: user chunein → Reset → user 30 minute mein ek baar sirf password se login karega</span>
    </div>
  );
};
