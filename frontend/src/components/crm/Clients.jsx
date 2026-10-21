import React, { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Header from "../Header";
import StepTabs from "../StepTabs";
import { uid, today, crmNextNo, nameOf } from "./crmShared";
import { parseGstin } from "../../lib/gstin";
import { CrmActionBar, FormLock } from "./CrmActionBar";

const CLIENT_TYPES = ["Government Department", "PSU / Corporation", "Private Company", "Builder / Developer", "Individual", "Other"];
const ACCOUNT_TYPES = ["Current", "Savings", "Cash Credit", "Overdraft"];
const STEPS = { 1: "Step 1 · Created", 2: "Step 2 · Checked & Submitted", 3: "Step 3 · Approved" };
const blank = () => ({
  id: "", tempRefId: "", clientCode: "", step: 1, clientType: "Government Department", name: "", department: "", contactPerson: "", designation: "",
  mobile: "", altMobile: "", email: "", gst: "", pan: "", tan: "", address: "", city: "", state: "", pincode: "",
  projectCode: "", siteName: "", ifscCode: "", bankName: "", branchName: "", bankAddress: "", bankCity: "", bankState: "", accountType: "Current", accountHolder: "", accountNumber: "",
  creatorName: "", creationDate: today(), checkedByName: "", remarks: "",
});

const F = ({ label, req, children }) => (
  <div className="field-b"><label>{label}{req && <span className="req"> *</span>}</label>{children}</div>
);

const useIfsc = (f, setF) => {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const code = (f.ifscCode || "").toUpperCase().trim();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) { setOk(false); return undefined; }
    let off = false;
    setBusy(true);
    fetch(`https://ifsc.razorpay.com/${code}`).then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (off) return; setF((p) => ({ ...p, bankName: d.BANK, branchName: d.BRANCH, bankAddress: d.ADDRESS, bankCity: d.CITY, bankState: d.STATE })); setOk(true); toast.success(`Bank: ${d.BANK} · ${d.BRANCH}`); })
      .catch(() => { if (!off) { setOk(false); toast.error(`IFSC "${code}" not found`); } })
      .finally(() => { if (!off) setBusy(false); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.ifscCode]);
  return { ok, busy };
};

const useGstin = (f, setF) => {
  const info = parseGstin(f.gst);
  useEffect(() => {
    if (!info.valid) return;
    setF((p) => ({ ...p, pan: p.pan || info.pan, state: p.state || info.state }));
    toast.success(`GSTIN valid · ${info.state} · PAN ${info.pan}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.valid, f.gst]);
  return info;
};

const Badge = ({ ok, busy, show, okText = "✓", badText = "✗", testid }) => (
  <span data-testid={testid} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: show ? "inline-block" : "none", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
    background: busy ? "#fef3c7" : ok ? "#dcfce7" : "#fee2e2", color: busy ? "#92400e" : ok ? "#166534" : "#991b1b" }}>{busy ? "…" : ok ? okText : badText}</span>
);

export const Clients = ({ data, save, remove }) => {
  const [f, setF] = useState(blank());
  const [editing, setEditing] = useState(true);
  const ifsc = useIfsc(f, setF);
  const gstInfo = useGstin(f, setF);
  const st = Number(f.step) || 1;
  const bind = (k, up) => ({ value: f[k] ?? "", onChange: (e) => setF({ ...f, [k]: up ? e.target.value.toUpperCase() : e.target.value }), "data-testid": `client-${k}` });

  const persist = async (rec, msg) => {
    const out = await save("clients", rec, msg);
    if (out) { setF({ ...blank(), ...out }); setEditing(false); }
  };
  const onSave = () => {
    if (!f.name.trim() || !f.mobile.trim()) return alert("Client / Department name aur Mobile zaroori hai");
    persist({ ...f, id: f.id || uid("cl"), tempRefId: f.tempRefId || `TMP-CL-${Date.now().toString().slice(-6)}` }, "Client saved");
  };
  const onSubmit = () => {
    if (!f.checkedByName.trim()) return alert("Checked By name bharein");
    persist({ ...f, step: 2 }, "Client submitted for approval");
  };
  const onApprove = async () => persist({ ...f, step: 3, clientCode: f.clientCode || await crmNextNo("client", "CL/") }, "Client approved · permanent code generated");
  const load = (c) => { setF({ ...blank(), ...c }); setEditing(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="a4" data-testid="client-registration" style={{ maxWidth: "100%" }}>
      <div className="module-doc-header"><Header formTitle="CLIENT REGISTRATION FORM" /></div>
      <StepTabs step={st} labels={[STEPS[1], STEPS[2], STEPS[3]]} />
      {st === 3 && f.clientCode && (
        <div className="approval-banner" data-testid="client-approval-banner"><CheckCircle2 size={18} /><span>CLIENT APPROVED · PERMANENT CLIENT CODE:</span><span className="code">{f.clientCode}</span></div>
      )}
      <FormLock editing={editing && st < 3}>
        <div className="section"><div className="sec-head">System Reference &amp; Client Code</div><div className="sec-body">
          <div className="row cols-3">
            <F label="Temporary Ref ID (till Approval)"><input className="pill" data-testid="client-tempRefId" value={f.tempRefId || "Generated on First Save"} readOnly /></F>
            <F label="Permanent Client Code"><input className="pill-generated" data-testid="client-code" value={f.clientCode || "Generated on Step 3 Approval"} readOnly /></F>
            <F label="Current Status"><input className="pill-status" data-testid="client-status" value={STEPS[st]} readOnly /></F>
          </div>
        </div></div>
        <div className="section"><div className="sec-head">Project &amp; Site Details</div><div className="sec-body">
          <div className="row cols-2">
            <F label="Project Code"><input placeholder="e.g. PRJ-2026-NNA" {...bind("projectCode")} /></F>
            <F label="Project Location / Site Name"><input placeholder="e.g. Naini Site / Prayagraj" {...bind("siteName")} /></F>
          </div>
        </div></div>
        <div className="section"><div className="sec-head">1. Client Basic, Contact &amp; Address Details</div><div className="sec-body">
          <div className="row cols-3">
            <F label="Client Type" req><select {...bind("clientType")}>{CLIENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
            <F label="Client / Firm / Department Name" req><input placeholder="e.g. PWD Prayagraj" {...bind("name")} /></F>
            <F label="Division / Office"><input placeholder="e.g. Construction Division-2" {...bind("department")} /></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="Contact Person Name"><input {...bind("contactPerson")} /></F>
            <F label="Designation"><input placeholder="e.g. Executive Engineer" {...bind("designation")} /></F>
            <F label="Mobile Number" req><input maxLength={12} {...bind("mobile")} /></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="Alternate Mobile"><input maxLength={12} {...bind("altMobile")} /></F>
            <F label="Client Email ID (For Bills)"><input type="email" {...bind("email")} /></F>
            <F label={`GST Number${gstInfo.valid ? ` · ${gstInfo.entityType}` : ""}`}><div style={{ position: "relative" }}><input maxLength={15} placeholder="GSTIN (auto-fills PAN & State)" {...bind("gst", true)} style={{ paddingRight: 40, ...(gstInfo.valid ? { background: "#f0fdf4" } : {}) }} /><Badge testid="client-gst-status" ok={gstInfo.valid} show={(f.gst || "").length === 15} /></div></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="PAN Number"><input maxLength={10} {...bind("pan", true)} /></F>
            <F label="TAN Number (TDS deductor)"><input maxLength={10} {...bind("tan", true)} /></F>
            <F label="Registered / Billing Address"><input {...bind("address")} /></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="City"><input {...bind("city")} /></F>
            <F label="State"><input {...bind("state")} /></F>
            <F label="Pincode"><input maxLength={6} {...bind("pincode")} /></F>
          </div>
        </div></div>
        <div className="section"><div className="sec-head">2. Client Bank Details (payment receipt se match ke liye)</div><div className="sec-body">
          <div className="row cols-3">
            <F label="IFSC Code (auto-fetch bank details)"><div style={{ position: "relative" }}><input maxLength={11} placeholder="e.g. SBIN0001234" {...bind("ifscCode", true)} style={{ paddingRight: 40, ...(ifsc.ok ? { background: "#f0fdf4" } : {}) }} /><Badge testid="client-ifsc-status" ok={ifsc.ok} busy={ifsc.busy} show={(f.ifscCode || "").length === 11} /></div></F>
            <F label="Bank Name (auto)"><input {...bind("bankName")} readOnly={ifsc.ok} style={ifsc.ok ? { background: "#f0fdf4" } : {}} /></F>
            <F label="Branch Name (auto)"><input {...bind("branchName")} readOnly={ifsc.ok} style={ifsc.ok ? { background: "#f0fdf4" } : {}} /></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="Bank Branch Address (auto)"><input {...bind("bankAddress")} readOnly={ifsc.ok} style={ifsc.ok ? { background: "#f0fdf4" } : {}} /></F>
            <F label="Bank City (auto)"><input {...bind("bankCity")} readOnly={ifsc.ok} style={ifsc.ok ? { background: "#f0fdf4" } : {}} /></F>
            <F label="Bank State (auto)"><input {...bind("bankState")} readOnly={ifsc.ok} style={ifsc.ok ? { background: "#f0fdf4" } : {}} /></F>
          </div>
          <div className="row cols-3" style={{ marginTop: 10 }}>
            <F label="Account Type"><select {...bind("accountType")}>{ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
            <F label="Account Holder Name"><input {...bind("accountHolder")} /></F>
            <F label="Account Number"><input {...bind("accountNumber")} /></F>
          </div>
        </div></div>
        <div className="section"><div className="sec-head">3. Workflow &amp; Approvals</div><div className="sec-body">
          <div className="substep"><div className="substep-title">[STEP 1] CREATED BY</div><div className="row cols-2">
            <F label="Created By (Fill Name)"><input {...bind("creatorName")} /></F>
            <F label="Creation Date"><input type="date" {...bind("creationDate")} /></F>
          </div></div>
          <div className="substep"><div className="substep-title">[STEP 2] CHECKED &amp; SUBMITTED BY</div><div className="row cols-2">
            <F label="Checked By (Name)"><input {...bind("checkedByName")} /></F>
            <F label="Remarks"><input {...bind("remarks")} /></F>
          </div></div>
          <div className="substep"><div className="substep-title">[STEP 3] FINAL APPROVAL (GM / SuperAdmin)</div><div className="row cols-2">
            <F label="Approved By"><input className="date-highlight" value={f.approvedByName || ""} readOnly /></F>
            <F label="Date of Approval"><input className="date-highlight" value={(f.approvedAt || "").slice(0, 10)} readOnly /></F>
          </div></div>
        </div></div>
      </FormLock>
      <div className="section" data-testid="clients-data-sheet" style={{ marginTop: 14 }}>
        <div className="sec-head">Clients Data Sheet · Click to Load</div>
        <div className="sec-body" style={{ overflowX: "auto" }}>
          <table data-testid="clients-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead><tr style={{ background: "#f1f5f9" }}>{["Code / Temp ID", "Client", "Type", "Mobile", "GST No", "Contracts", "Status", "Action"].map((h) => <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #cbd5e1" }}>{h}</th>)}</tr></thead>
            <tbody>
              {data.clients.map((c) => {
                const s = Number(c.step) || 1;
                return (
                  <tr key={c.id} style={{ background: f.id === c.id ? "#eef4ff" : "#fff", borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "5px 8px", fontFamily: "monospace", fontWeight: 700, color: s === 3 ? "#166534" : "#92400e" }}>{s === 3 && c.clientCode ? `✓ ${c.clientCode}` : `⏳ ${c.tempRefId || c.clientCode || "—"}`}</td>
                    <td style={{ padding: "5px 8px" }}>{c.name}</td>
                    <td style={{ padding: "5px 8px" }}>{c.clientType || "—"}</td>
                    <td style={{ padding: "5px 8px" }}>{c.mobile || "—"}</td>
                    <td style={{ padding: "5px 8px", fontFamily: "monospace" }}>{c.gst || "—"}</td>
                    <td style={{ padding: "5px 8px" }}>{data.contracts.filter((k) => k.clientId === c.id).length}</td>
                    <td style={{ padding: "5px 8px" }}>{s === 3 ? "Approved" : `Step ${s}`}</td>
                    <td style={{ padding: "5px 8px" }}><button data-testid={`client-load-${c.id}`} onClick={() => load(c)} style={{ padding: "3px 10px", fontSize: 10.5, background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>Load</button></td>
                  </tr>
                );
              })}
              {data.clients.length === 0 && <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#94a3b8" }}>No clients yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <CrmActionBar name="client" status={f.id ? `${f.clientCode || f.tempRefId} · ${STEPS[st]} · ${editing && st < 3 ? "Editing" : "View"}` : "New client"}
        onNew={() => { setF(blank()); setEditing(true); }} onSave={editing && st < 3 ? onSave : null}
        onEdit={f.id && !editing && st < 3 ? () => setEditing(true) : null}
        onSubmit={f.id && st === 1 ? onSubmit : null} onApprove={f.id && st === 2 ? onApprove : null}
        onDelete={f.id && !data.contracts.some((k) => k.clientId === f.id) ? async () => { if (await remove("clients", f.id)) setF(blank()); } : null}
        list={{ title: "Client Master", cols: ["Code", "Temp ID", "Client", "Type", "Contact", "Mobile", "Email", "GSTIN", "PAN", "TAN", "City", "Status"], rows: data.clients.map((c) => [c.clientCode, c.tempRefId, c.name, c.clientType, c.contactPerson, c.mobile, c.email, c.gst, c.pan, c.tan, c.city, STEPS[Number(c.step) || 1]]) }} />
      <span style={{ display: "none" }}>{nameOf(data.clients, f.id)}</span>
    </div>
  );
};
