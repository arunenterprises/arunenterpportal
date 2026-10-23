import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Save } from "lucide-react";
import { apiSetAcl } from "../lib/api";
import { ACL_DEPTS, ACL_ROLES, aclCell, loadAcl } from "../lib/acl";

const OPS = [["v", "View"], ["c", "Create"], ["a", "Approve"]];
const th = { padding: "6px 6px", border: "1px solid #cbd5e1", background: "#f1f5f9", fontSize: 11, textAlign: "center" };

export default function AclMatrix() {
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadAcl().then(setM); }, []);
  if (!m) return null;
  const flip = (role, dept, op) => setM((x) => ({ ...x, [role]: { ...(x[role] || {}), [dept]: { ...aclCell(x, role, dept), [op]: !aclCell(x, role, dept)[op] } } }));
  const save = async () => {
    setBusy(true);
    try { await apiSetAcl(m); await loadAcl(); toast.success("Permissions saved · sabhi users par lagu"); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div data-testid="acl-matrix" style={{ background: "#fff", border: "1.5px solid #4f46e5", borderRadius: 10, padding: 14, margin: "14px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 14, color: "#3730a3", display: "flex", alignItems: "center", gap: 6 }}><ShieldCheck size={16} /> Role-Based Permissions (ACL Matrix)</div>
        <button data-testid="acl-save" disabled={busy} onClick={save} style={{ padding: "7px 14px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Save size={13} /> {busy ? "Saving..." : "Save Permissions"}</button>
      </div>
      <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 8 }}>Tick lagayein: <b>View</b> = department khulega · <b>Create</b> = entry / save / submit · <b>Approve</b> = approve / reject. SuperAdmin ke paas hamesha sab power rahegi.</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: "100%" }}>
          <thead>
            <tr><th style={{ ...th, textAlign: "left" }} rowSpan={2}>Department</th>{ACL_ROLES.map((r) => <th key={r} style={th} colSpan={3}>{r}</th>)}</tr>
            <tr>{ACL_ROLES.map((r) => OPS.map(([o, l]) => <th key={r + o} style={{ ...th, fontWeight: 600 }}>{l}</th>))}</tr>
          </thead>
          <tbody>
            {ACL_DEPTS.map((d) => (
              <tr key={d.k}>
                <td style={{ padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{d.l}</td>
                {ACL_ROLES.map((r) => OPS.map(([o]) => (
                  <td key={r + o} style={{ border: "1px solid #e2e8f0", textAlign: "center" }}>
                    <input type="checkbox" data-testid={`acl-${r}-${d.k}-${o}`} checked={!!aclCell(m, r, d.k)[o]} onChange={() => flip(r, d.k, o)} />
                  </td>
                )))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
