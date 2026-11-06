import React from "react";
import { Paperclip, Eye } from "lucide-react";
import { uploadBig, openFile } from "../lib/bigFiles";

export const FileSlot = ({ label, value, onChange, disabled, testid, maxMB = 25, req }) => (
  <div data-testid={testid} style={{ border: `1.5px dashed ${value ? "#16a34a" : req ? "#dc2626" : "#94a3b8"}`, borderRadius: 8, padding: 12, background: value ? "#f0fdf4" : "#fff" }}>
    <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6 }}>{label}{req && <span style={{ color: "#dc2626" }}> *</span>} <span style={{ fontWeight: 500, color: "#64748b" }}>(PDF / Image · ≤ {maxMB} MB)</span></div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {!disabled && (
        <label style={{ display: "inline-flex", gap: 5, alignItems: "center", padding: "6px 12px", background: "#1d4ed8", color: "#fff", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
          <Paperclip size={12} /> {value ? "Replace" : "Upload"}
          <input data-testid={`${testid}-input`} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; const up = await uploadBig(f, maxMB); if (up) onChange(up); }} />
        </label>
      )}
      {value && <button type="button" data-testid={`${testid}-view`} onClick={() => openFile(value)} style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "6px 10px", border: "1px solid #16a34a", color: "#166534", background: "#fff", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}><Eye size={12} /> {value.name}</button>}
      {!value && disabled && <span style={{ fontSize: 11, color: "#94a3b8" }}>Not uploaded</span>}
    </div>
  </div>
);
