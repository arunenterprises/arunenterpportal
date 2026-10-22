import React, { useState } from "react";
import { toast } from "sonner";
import { Sparkles, X, Printer, Save, RefreshCw } from "lucide-react";
import { apiAiWoTerms } from "../lib/api";
import { printWorkOrder } from "../lib/woPrint";

const ta = { width: "100%", padding: 8, border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontFamily: "inherit", lineHeight: 1.45 };
const btn = (bg) => ({ padding: "7px 12px", background: bg, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 });

// AI-generated Scope of Work + extra T&C for a Work Order; review/edit, then save or export PDF.
export const AiWoButton = ({ wo, onApply }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ aiScopeOfWork: "", aiTerms: "" });

  const generate = async () => {
    if (!(wo.items || []).some((i) => i.description)) { toast.error("Pehle line items add karein"); return; }
    setBusy(true);
    try {
      const r = await apiAiWoTerms(wo);
      setDraft({ aiScopeOfWork: r.scopeOfWork, aiTerms: r.aiTerms });
      setOpen(true);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const start = () => {
    if (wo.aiScopeOfWork || wo.aiTerms) { setDraft({ aiScopeOfWork: wo.aiScopeOfWork || "", aiTerms: wo.aiTerms || "" }); setOpen(true); return; }
    generate();
  };

  return (
    <>
      <button data-testid="wo-btn-ai" onClick={start} disabled={busy} style={{ ...btn("#7c3aed"), opacity: busy ? .6 : 1 }}>
        <Sparkles size={13} /> {busy ? "AI likh raha hai…" : "AI Generate Work Order"}
      </button>
      {open && (
        <div data-testid="wo-ai-modal" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 10, width: "min(900px,100%)", maxHeight: "92vh", overflow: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#4c1d95", display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={16} /> AI Work Order · Review &amp; Edit</div>
              <button data-testid="wo-ai-close" onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <label style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>DETAILED SCOPE OF WORK</label>
            <textarea data-testid="wo-ai-scope" value={draft.aiScopeOfWork} onChange={(e) => setDraft((d) => ({ ...d, aiScopeOfWork: e.target.value }))} style={{ ...ta, minHeight: 180 }} />
            <label style={{ fontSize: 11, fontWeight: 800, color: "#475569", display: "block", marginTop: 10 }}>ADDITIONAL TERMS &amp; CONDITIONS (aapke default terms ke alawa)</label>
            <textarea data-testid="wo-ai-terms" value={draft.aiTerms} onChange={(e) => setDraft((d) => ({ ...d, aiTerms: e.target.value }))} style={{ ...ta, minHeight: 220 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
              <button data-testid="wo-ai-regenerate" onClick={generate} disabled={busy} style={btn("#64748b")}><RefreshCw size={13} /> {busy ? "Generating…" : "Regenerate"}</button>
              <button data-testid="wo-ai-save" onClick={() => { onApply(draft); toast.success("AI text Work Order mein save ho gaya"); setOpen(false); }} style={btn("#16a34a")}><Save size={13} /> Save to WO</button>
              <button data-testid="wo-ai-export" onClick={() => { onApply(draft); printWorkOrder({ ...wo, ...draft }); }} style={btn("#0f172a")}><Printer size={13} /> Export PDF</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiWoButton;
