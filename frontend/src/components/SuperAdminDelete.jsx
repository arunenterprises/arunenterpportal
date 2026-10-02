// Reusable SuperAdmin-only Delete button for approved/approval-stage records.
// Writes to localStorage audit log before invoking onDelete.
import React from "react";
import { currentRole, currentUser } from "../lib/store";

/**
 * SuperAdminDelete — gated button visible only when currentRole() === "SuperAdmin"
 *
 * @param {string}  label       e.g. "Pay Bill PB/2026-02/001"
 * @param {object}  meta        audit payload (keys show up in confirm popup + log)
 * @param {string}  auditKey    localStorage key for audit trail
 * @param {func}    onDelete    callback invoked after confirmation + log
 * @param {string}  [testid]    optional data-testid override
 * @param {string}  [title]     tooltip
 */
const SuperAdminDelete = ({ label, meta = {}, auditKey, onDelete, testid, title }) => {
  if (currentRole() !== "SuperAdmin") return null;
  const handleClick = (e) => {
    e?.stopPropagation?.();
    const detail = Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (!window.confirm(`⚠️ SuperAdmin Override\n\nDelete ${label}?\n\n${detail}\n\nThis action is logged in audit trail. Linked Payment Vouchers (if any) will remain in Payments.`)) return;
    try {
      const log = JSON.parse(localStorage.getItem(auditKey) || "[]");
      log.push({ label, ...meta, deletedBy: currentUser() || "SuperAdmin", deletedAt: new Date().toISOString() });
      localStorage.setItem(auditKey, JSON.stringify(log));
    } catch (_err) { /* ignore storage errors */ }
    onDelete();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={testid || "sa-del"}
      title={title || "SuperAdmin override · Delete approved record"}
      style={{ padding: "3px 8px", background: "#7f1d1d", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer", fontSize: 10, fontWeight: 700, marginLeft: 4 }}
    >
      👑 Delete
    </button>
  );
};

export default SuperAdminDelete;
