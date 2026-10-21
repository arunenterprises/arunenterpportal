import React, { useState } from "react";
import { FileUp, Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn, Table, inr, num, crmParseWorkOrder } from "./crmShared";

const HEAD = [["workOrderNo", "WO No"], ["workOrderDate", "WO Date"], ["clientName", "Client"], ["clientGst", "Client GSTIN"], ["projectName", "Project"], ["siteLocation", "Site"],
  ["startDate", "Start"], ["completionDate", "Completion"], ["contractValue", "Contract Value"], ["retentionPct", "Retention %"], ["advanceAmount", "Advance"], ["defaultGstPct", "GST %"]];

export const WorkOrderImport = ({ onApply }) => {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Sirf PDF / JPG / PNG");
    if (file.size > 15 * 1024 * 1024) return toast.error("File 15 MB se chhoti honi chahiye");
    setBusy(true);
    try {
      const out = await crmParseWorkOrder(file);
      setRes({ ...out, file });
      toast.success(`${(out.parsed.items || []).length} items mile · check karke apply karein`);
    } catch (err) { toast.error(err.message); }
    setBusy(false);
  };
  const apply = () => { onApply(res.parsed, res.file, res.dataUrl); setRes(null); toast.success("Work order ka data form mein bhar gaya · check karke Save karein"); };
  const p = res?.parsed || {};
  return (
    <div data-testid="wo-import" style={{ border: "1px dashed #93c5fd", background: "#eff6ff", borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label data-testid="wo-upload-label" className="crm-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1e3a8a", color: "#fff", padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} {busy ? "AI document padh raha hai…" : "Client Work Order Upload (PDF / Photo)"}
          <input data-testid="wo-upload-input" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={busy} style={{ display: "none" }} onChange={onFile} />
        </label>
        <span style={{ fontSize: 11.5, color: "#1e3a8a" }}>Work, items, unit, quantity, rate, GST aur client details apne-aap bhar jayengi</span>
      </div>
      {res && (
        <div data-testid="wo-preview" style={{ marginTop: 12, background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #dbeafe" }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Preview · {res.file.name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 6, fontSize: 12, marginBottom: 10 }}>
            {HEAD.map(([k, l]) => <div key={k}><span style={{ color: "#64748b" }}>{l}:</span> <b>{p[k] || "—"}</b></div>)}
          </div>
          {p.scopeOfWork && <div style={{ fontSize: 12, marginBottom: 8 }}><span style={{ color: "#64748b" }}>Scope:</span> {p.scopeOfWork}</div>}
          <Table testid="wo-preview-items" cols={["Code", "Description", "Unit", "Qty", "Rate", "GST %", "Amount"]}
            rows={(p.items || []).map((i) => [i.code || "—", i.description, i.unit, i.qty, inr(i.rate), `${num(i.gstPct) || num(p.defaultGstPct)}%`, inr(num(i.qty) * num(i.rate))])} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <Btn tone="green" data-testid="wo-apply-btn" onClick={apply}><CheckCircle2 size={14} /> Contract mein bharo</Btn>
            <Btn tone="ghost" data-testid="wo-cancel-btn" onClick={() => setRes(null)}><X size={14} /> Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
};
