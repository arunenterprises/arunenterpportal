import React from "react";

// Plain HSN / SAC input — search lives in the separate <HsnFinder /> panel below each tab.
export const HsnInput = ({ value, onChange, disabled, testid, style }) => (
  <input data-testid={testid} value={value || ""} disabled={disabled} readOnly={disabled} placeholder="HSN/SAC"
    onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", padding: "5px 6px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", textAlign: "center", ...(style || {}) }} />
);

export default HsnInput;
