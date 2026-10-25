import React from "react";
import { RotateCcw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { apiResetNumbering, apiRenumber } from "../../lib/api";
import { isSuperAdmin, currentUserEmail } from "../../lib/store";

export const RenumberBtn = ({ target, label }) => {
  if (!isSuperAdmin(currentUserEmail())) return null;
  const run = async () => {
    const t = window.prompt(`${label} ke SAARE records ko tareekh ke kram se naye Temp / Permanent number milenge (purane number badal jayenge) aur counter theek hoga.\nPakka karne ke liye REPAIR likhein:`);
    if (t !== "REPAIR") return;
    try {
      const r = await apiRenumber(target);
      toast.success(`${r.renumbered} records ko naye number mile`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <button data-testid={`renumber-${target}`} onClick={run} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#7c2d12", color: "#fff", border: 0, borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
      <Wrench size={12} /> Re-Align & Repair Numbers
    </button>
  );
};

export const ResetNumberingBtn = ({ target, label }) => {
  if (!isSuperAdmin(currentUserEmail())) return null;
  const run = async () => {
    const t = window.prompt(`${label} ka SARA data hat jayega aur number counter shuru se reset hoga.\nPakka karne ke liye RESET likhein:`);
    if (t !== "RESET") return;
    try {
      const r = await apiResetNumbering(target);
      toast.success(`${r.deleted} record hataye, counter reset`);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) { toast.error(e.message); }
  };
  return (
    <button data-testid={`reset-numbering-${target}`} onClick={run} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#b91c1c", color: "#fff", border: 0, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: 10 }}>
      <RotateCcw size={12} /> Clear All & Reset Counter
    </button>
  );
};
