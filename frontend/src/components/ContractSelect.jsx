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
