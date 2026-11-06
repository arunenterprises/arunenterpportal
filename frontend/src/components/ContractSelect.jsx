import React, { useEffect, useState } from "react";
import { req } from "../lib/api";

const mk = (path) => {
  let cache = null, pending = null, at = 0;
  return () => {
    if (cache && Date.now() - at < 30000) return Promise.resolve(cache);
    if (!pending) pending = req(path).then((r) => { cache = r || []; at = Date.now(); pending = null; return cache; }).catch(() => { pending = null; return []; });
    return pending;
  };
};
export const loadProjects = mk("/projects/master");
export const findProject = (name) => loadProjects().then((l) => l.find((p) => String(p.name).trim().toLowerCase() === String(name || "").trim().toLowerCase()) || null);
// Contract item grid → BOQ / RFQ / Bill rows
export const contractRows = (m) => (m?.items || []).map((i, k) => ({ ...i, id: `ci_${Date.now()}_${k}` }));
// Vendor bill lines vs contract approved rate / qty
export const contractBreaches = (m, lines) => {
  const norm = (s) => String(s || "").trim().toLowerCase();
  if (!m?.items?.length) return [];
  return lines.filter((l) => String(l.description || "").trim()).map((l) => {
    const c = m.items.find((x) => (l.itemCode && norm(x.itemCode) === norm(l.itemCode)) || norm(x.description) === norm(l.description));
    if (!c) return `'${l.description}' contract items mein nahi hai`;
    if (Number(l.rate) > Number(c.rate) + 1e-6) return `'${l.description}' rate ₹${l.rate} > contract rate ₹${c.rate}`;
    if (Number(l.qty) > Number(c.qty) + 1e-6) return `'${l.description}' qty ${l.qty} > contract BOQ qty ${c.qty}`;
    return "";
  }).filter(Boolean);
};
export const loadContracts = mk("/contracts/master");
const useList = (loader) => {
  const [list, setList] = useState([]);
  useEffect(() => { loader().then(setList); }, [loader]);
  return list;
};

const MasterSelect = ({ loader, valueOf, labelOf, empty, value, onChange, disabled, testid, style, className }) => {
  const list = useList(loader);
  const legacy = value && !list.some((c) => valueOf(c) === value);
  return (
    <select data-testid={testid} value={value || ""} disabled={disabled} style={style} className={className}
      onChange={(e) => onChange(e.target.value, list.find((c) => valueOf(c) === e.target.value) || null)}>
      <option value="">{empty}</option>
      {legacy && <option value={value}>{value} (purana)</option>}
      {list.map((c) => <option key={c.id} value={valueOf(c)}>{labelOf(c)}</option>)}
    </select>
  );
};

// Every "Project" field in the ERP: Project Master (Project Register). value = project name; onChange(value, masterRecord)
export const ContractSelect = (p) => (
  <MasterSelect {...p} loader={loadProjects} valueOf={(c) => c.name} empty="— Project Master (Project Register) —"
    labelOf={(c) => [c.code, c.name, c.contractNo && `Contract ${c.contractNo}`, c.siteLocation].filter(Boolean).join(" · ")} />
);

// Used only inside Project Register: link the master to Client & Revenue → Work Contracts
export const CrmContractSelect = (p) => (
  <MasterSelect {...p} loader={loadContracts} valueOf={(c) => c.contractNo} empty="— Contract No (Client & Revenue) —"
    labelOf={(c) => [c.contractNo, c.projectName, c.clientName].filter(Boolean).join(" · ")} />
);
