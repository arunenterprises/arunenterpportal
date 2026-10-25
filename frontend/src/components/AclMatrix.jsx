import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Save } from "lucide-react";
import { apiSetAcl, apiListUsers } from "../lib/api";
import { ACL_DEPTS, ACL_ROLES, ACL_OPS, MASK_ITEMS, aclRoleCell, loadAcl } from "../lib/acl";

const th = { padding: "6px 6px", border: "1px solid #cbd5e1", background: "#f1f5f9", fontSize: 11, textAlign: "center" };
const td = { border: "1px solid #e2e8f0", textAlign: "center", padding: 3 };
const tdl = { padding: "6px 8px", border: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" };
const card = { background: "#fff", border: "1.5px solid #4f46e5", borderRadius: 10, padding: 14, margin: "14px 0" };
const h = { fontWeight: 900, fontSize: 13.5, color: "#3730a3", marginBottom: 6 };

const RoleMatrix = ({ m, setM }) => {
  const flip = (r, d, o) => setM((x) => ({ ...x, [r]: { ...(x[r] || {}), [d]: { ...aclRoleCell(x, r, d), [o]: !aclRoleCell(x, r, d)[o] } } }));
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: "100%" }}>
        <thead>
          <tr><th style={{ ...th, textAlign: "left" }} rowSpan={2}>Module</th>{ACL_ROLES.map((r) => <th key={r} style={th} colSpan={ACL_OPS.length}>{r}</th>)}</tr>
          <tr>{ACL_ROLES.map((r) => ACL_OPS.map(([o, l]) => <th key={r + o} style={{ ...th, fontWeight: 600 }}>{l}</th>))}</tr>
        </thead>
        <tbody>
          {ACL_DEPTS.map((d) => (
            <tr key={d.k}><td style={tdl}>{d.l}</td>
              {ACL_ROLES.map((r) => ACL_OPS.map(([o]) => (
                <td key={r + o} style={td}><input type="checkbox" data-testid={`acl-${r}-${d.k}-${o}`} checked={!!aclRoleCell(m, r, d.k)[o]} onChange={() => flip(r, d.k, o)} /></td>
              )))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const UserOverride = ({ m, setM, email }) => {
  const u = (m._users || {})[email] || {};
  const setOp = (d, o, v) => setM((x) => {
    const cur = { ...(((x._users || {})[email] || {})[d] || {}) };
    if (v === "") delete cur[o]; else cur[o] = v === "1";
    return { ...x, _users: { ...(x._users || {}), [email]: { ...((x._users || {})[email] || {}), [d]: cur } } };
  });
  return (
    <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: "100%" }}>
      <thead><tr><th style={{ ...th, textAlign: "left" }}>Module</th>{ACL_OPS.map(([o, l]) => <th key={o} style={th}>{l}</th>)}</tr></thead>
      <tbody>
        {ACL_DEPTS.map((d) => (
          <tr key={d.k}><td style={tdl}>{d.l}</td>
            {ACL_OPS.map(([o]) => {
              const v = (u[d.k] || {})[o];
              return (
                <td key={o} style={td}>
                  <select data-testid={`acl-user-${d.k}-${o}`} value={v === undefined ? "" : v ? "1" : "0"} onChange={(e) => setOp(d.k, o, e.target.value)}
                    style={{ fontSize: 11, padding: 2, background: v === undefined ? "#fff" : v ? "#dcfce7" : "#fee2e2" }}>
                    <option value="">Role jaisa</option><option value="1">Allow</option><option value="0">Deny</option>
                  </select>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const MaskMatrix = ({ m, setM, email }) => {
  const um = (m._userMask || {})[email];
  const flipRole = (r, k) => setM((x) => { const a = (x._mask || {})[r] || []; return { ...x, _mask: { ...(x._mask || {}), [r]: a.includes(k) ? a.filter((y) => y !== k) : [...a, k] } }; });
  const flipUser = (k) => setM((x) => { const a = ((x._userMask || {})[email]) || []; return { ...x, _userMask: { ...(x._userMask || {}), [email]: a.includes(k) ? a.filter((y) => y !== k) : [...a, k] } }; });
  const toggleCustom = () => setM((x) => { const nm = { ...(x._userMask || {}) }; if (Array.isArray(nm[email])) delete nm[email]; else nm[email] = []; return { ...x, _userMask: nm }; });
  return (
    <div style={{ overflowX: "auto" }}>
      {email && (
        <label style={{ fontSize: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input type="checkbox" data-testid="mask-user-custom" checked={Array.isArray(um)} onChange={toggleCustom} /> {email} ke liye alag masking (role wali ki jagah)
        </label>
      )}
      <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: "100%" }}>
        <thead><tr><th style={{ ...th, textAlign: "left" }}>Card / Column (tick = chhupao)</th>{ACL_ROLES.map((r) => <th key={r} style={th}>{r}</th>)}{Array.isArray(um) && <th style={{ ...th, background: "#fef3c7" }}>{email}</th>}</tr></thead>
        <tbody>
          {MASK_ITEMS.map((it) => (
            <tr key={it.k}><td style={tdl}>{it.l}</td>
              {ACL_ROLES.map((r) => <td key={r} style={td}><input type="checkbox" data-testid={`mask-${r}-${it.k}`} checked={((m._mask || {})[r] || []).includes(it.k)} onChange={() => flipRole(r, it.k)} /></td>)}
              {Array.isArray(um) && <td style={{ ...td, background: "#fffbeb" }}><input type="checkbox" data-testid={`mask-user-${it.k}`} checked={um.includes(it.k)} onChange={() => flipUser(it.k)} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function AclMatrix() {
  const [m, setM] = useState(null);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadAcl().then(setM); apiListUsers().then(setUsers).catch(() => setUsers([])); }, []);
  if (!m) return null;
  const save = async () => {
    setBusy(true);
    try { await apiSetAcl(m); await loadAcl(); toast.success("Permissions saved · sabhi users par lagu"); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div data-testid="acl-matrix">
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ ...h, fontSize: 14, display: "flex", alignItems: "center", gap: 6, marginBottom: 0 }}><ShieldCheck size={16} /> Role-Based Access Control (RBAC)</div>
          <button data-testid="acl-save" disabled={busy} onClick={save} style={{ padding: "7px 14px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 6, fontWeight: 800, fontSize: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}><Save size={13} /> {busy ? "Saving..." : "Save Permissions"}</button>
        </div>
        <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 8 }}><b>View</b> hataoge to module sidebar se chhup jayega · <b>Create</b> = New / Save / Submit · <b>Edit</b> = Edit · <b>Delete</b> = Delete · <b>Approve</b> = Approve / Reject (GM Approved). SuperAdmin ke paas hamesha sab power.</div>
        <div style={h}>A. Role-wise Module Permissions</div>
        <RoleMatrix m={m} setM={setM} />
      </div>
      <div style={card}>
        <div style={h}>B. User-wise Alag Chhoot (Override)</div>
        <select data-testid="acl-user-pick" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "6px 8px", fontSize: 12.5, marginBottom: 8, minWidth: 320 }}>
          <option value="">— User chunein —</option>
          {users.filter((u) => u.email).map((u) => <option key={u.email} value={u.email}>{u.name || u.email} · {u.role} · {u.email}</option>)}
        </select>
        {email ? <UserOverride m={m} setM={setM} email={email} /> : <div style={{ fontSize: 12, color: "#64748b" }}>User chunne par uske liye har module ka Allow / Deny set kar sakte hain. "Role jaisa" = role ki permission chalegi.</div>}
      </div>
      <div style={card}>
        <div style={h}>C. Dashboard Card & Table Column Masking</div>
        <MaskMatrix m={m} setM={setM} email={email} />
      </div>
    </div>
  );
}
