// Reusable SuperAdmin-only Delete button for approved/approval-stage records.
// Writes to localStorage audit log before invoking onDelete.
// If `blockReason` is provided (non-empty string), the button is disabled with that reason
// — used to prevent deleting financial records until the linked Payment Voucher's UTR is entered.
import React from "react";
import { toast } from "sonner";
import { currentRole, currentUser } from "../lib/store";

/**
 * SuperAdminDelete — gated button visible only when currentRole() === "SuperAdmin"
 *
 * @param {string}  label        e.g. "Pay Bill PB/2026-02/001"
 * @param {object}  meta         audit payload (keys show up in confirm popup + log)
 * @param {string}  auditKey     localStorage key for audit trail
 * @param {func}    onDelete     callback invoked after confirmation + log
 * @param {string}  [testid]     optional data-testid override
 * @param {string}  [title]      tooltip
 * @param {string}  [blockReason] when truthy, button is disabled + click shows this reason as toast
 */
const SuperAdminDelete = ({ label, meta = {}, auditKey, onDelete, testid, title, blockReason }) => {
  if (currentRole() !== "SuperAdmin") return null;
  const blocked = !!blockReason;
  const handleClick = (e) => {
    e?.stopPropagation?.();
    if (blocked) {
      toast.error(blockReason);
      return;
    }
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
      title={blocked ? blockReason : (title || "SuperAdmin override · Delete approved record")}
      style={{
        padding: "3px 8px",
        background: blocked ? "#cbd5e1" : "#7f1d1d",
        color: blocked ? "#64748b" : "#fff",
        border: "none",
        borderRadius: 3,
        cursor: blocked ? "not-allowed" : "pointer",
        fontSize: 10,
        fontWeight: 700,
        marginLeft: 4,
        opacity: blocked ? 0.75 : 1,
      }}
    >
      {blocked ? "🔒 Locked" : "👑 Delete"}
    </button>
  );
};

export default SuperAdminDelete;
