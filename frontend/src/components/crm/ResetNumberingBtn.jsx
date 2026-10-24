import React from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiResetNumbering } from "../../lib/api";
import { isSuperAdmin, currentUserEmail } from "../../lib/store";

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
