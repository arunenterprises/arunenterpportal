// Shared Bank Transfer Advice utilities used across BillProcessing & HRManagement
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { getEmployees, amountToWords } from "./store";

const inr = (n) => Number(n || 0).toLocaleString("en-IN");
const esc = (s) => String(s || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const buildTransferRows = (pb) => {
  const emps = getEmployees();
  const active = (pb.lines || []).filter((l) => !l.excluded && (Number(l.net) || 0) > 0);
  return active.map((l, i) => {
    const emp = emps.find((e) => e.id === l.empId) || {};
    return {
      sr: i + 1,
      empCode: l.empCode || emp.empCode || "—",
      name: l.name || emp.fullName || "—",
      designation: l.designation || emp.designation || "",
      department: emp.department || "",
      bankName: emp.bankName || "—",
      bankBranch: emp.bankBranch || "",
      accountNo: emp.bankAccount || emp.accountNumber || "—",
      ifsc: emp.ifsc || emp.ifscCode || "—",
      accountType: emp.bankAccountType || "Savings",
      netAmount: Number(l.net) || 0,
    };
  });
};

export const exportBankTransferXLSX = (pb) => {
  const rows = buildTransferRows(pb);
  if (!rows.length) { toast.error("No eligible employee transfers in this pay bill"); return; }
  const monthName = new Date(pb.year, (pb.month || 1) - 1).toLocaleString("en", { month: "long" });
  const total = rows.reduce((a, r) => a + r.netAmount, 0);

  const aoa = [
    [`M/s ARUN ENTERPRISES · BANK TRANSFER SHEET · ${monthName} ${pb.year}`],
    [`Pay Bill: ${pb.refNo} · PV No: ${pb.linkedPvNo || "—"} · Employees: ${rows.length} · Total: ₹ ${total.toLocaleString("en-IN")}`],
    [],
    ["Sr.", "EMP Code", "Name", "Designation", "Department", "Bank Name", "Branch", "A/C No", "IFSC", "A/C Type", "Net Amount (₹)"],
    ...rows.map((r) => [r.sr, r.empCode, r.name, r.designation, r.department, r.bankName, r.bankBranch, r.accountNo, r.ifsc, r.accountType, r.netAmount]),
    [],
    ["", "", "", "", "", "", "", "", "", "TOTAL (₹)", total],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bank Transfer");
  XLSX.writeFile(wb, `BankTransfer_${(pb.refNo || "draft").replace(/\//g, "_")}_${monthName}${pb.year}.xlsx`);
  toast.success(`Bank Transfer sheet exported · ${rows.length} employees · ₹ ${total.toLocaleString("en-IN")}`);
};

export const printBulkBankAdvice = (items, { monthLabel = "", period = "" } = {}) => {
  if (!items || items.length === 0) { toast.error("No rows to print"); return; }
  const total = items.reduce((a, r) => a + Number(r.amount || 0), 0);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const wordsFn = typeof amountToWords === "function" ? amountToWords : (n) => `${inr(n)} only`;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Bulk Bank Advice - ${esc(monthLabel || period)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10pt; }
  .hdr { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
  .hdr .co { font-size: 20pt; font-weight: 900; color: #c81e2b; letter-spacing: 1.5px; }
  .hdr .tag { font-size: 9pt; font-weight: 700; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; }
  .hdr .addr { font-size: 8.5pt; color: #334155; margin-top: 2px; }
  .banner { background: #be185d; color: #fff; padding: 8px 14px; text-align: center; font-size: 14pt; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; }
  .meta-row { display: flex; justify-content: space-between; padding: 6px 10px; background: #f1f5f9; border-left: 4px solid #be185d; font-size: 9pt; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
  .meta-row b { color: #be185d; }
  .addressee { padding: 8px 12px; background: #fff7ed; border: 1px solid #fed7aa; margin-bottom: 8px; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th, td { border: 1px solid #94a3b8; padding: 5px 6px; }
  th { background: #0f172a; color: #fff; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.num { text-align: right; font-family: "Courier New", monospace; font-weight: 700; }
  .total-row td { background: #0f172a !important; color: #fff; font-weight: 900; font-size: 10pt; }
  .words { padding: 8px 12px; background: #ecfdf5; border: 1px solid #86efac; margin-top: 10px; font-size: 9.5pt; }
  .words b { color: #166534; }
  .instr { padding: 8px 12px; background: #fef9c3; border: 1px solid #fde68a; margin-top: 8px; font-size: 8.5pt; color: #78350f; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 25px; padding: 0 10px; }
  .sign-box { width: 30%; text-align: center; }
  .sign-box .line { border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 4px; font-size: 9pt; font-weight: 700; }
  .sign-box .sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
  @media print { body { padding: 0; } button { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <div class="co">M/S ARUN ENTERPRISES</div>
    <div class="tag">Govt. Civil Work Contractor & General Order Supplier</div>
    <div class="addr">209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011 · Email: info@arunenterprises.online · Toll Free: 9429694552</div>
  </div>
  <div class="banner">BULK BANK TRANSFER ADVICE · ${esc((monthLabel || period).toUpperCase())}</div>
  <div class="meta-row">
    <div>Vendors / Parties: <b>${items.length}</b></div>
    <div>Period: <b>${esc(monthLabel || period)}</b></div>
    <div>Date: <b>${esc(today)}</b></div>
  </div>
  <div class="addressee">
    <b>To:</b> The Branch Manager<br/>
    Please transfer the following vendor payments as per Due List decision sheet. Debit our Current Account for the total amount; share consolidated UTR / Ref Nos post-transfer for voucher closure.
  </div>
  <table>
    <thead><tr>
      <th>Sr.</th><th>Ref No</th><th>Bill No</th><th>Party</th><th>Code</th><th>Bank / Branch</th><th>A/C No</th><th>IFSC</th><th>Amount (₹)</th>
    </tr></thead>
    <tbody>
      ${items.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td style="font-family:monospace;">${esc(r.refNo)}</td>
        <td>${esc(r.billNo || "")}</td>
        <td>${esc(r.party)}</td>
        <td style="font-family:monospace;">${esc(r.partyCode || "")}</td>
        <td>${esc(r.bank)}${r.branch ? ` / ${esc(r.branch)}` : ""}</td>
        <td style="font-family:monospace;">${esc(r.account)}</td>
        <td style="font-family:monospace;">${esc(r.ifsc)}</td>
        <td class="num">${inr(r.amount)}</td>
      </tr>`).join("")}
      <tr class="total-row"><td colspan="8" style="text-align:right;">TOTAL AMOUNT TO BE TRANSFERRED (₹)</td><td class="num">${inr(total)}</td></tr>
    </tbody>
  </table>
  <div class="words"><b>Amount in Words:</b> ${esc(wordsFn(total))}</div>
  <div class="instr"><b>Instructions:</b> (1) Verify all A/C numbers and IFSC codes before transfer. (2) Use NEFT/RTGS as applicable per amount. (3) Share consolidated UTR/Ref Nos with Accounts department post-transfer for voucher closure.</div>
  <div class="sign-row">
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">— to be signed —</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Created By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">— to be signed —</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Prepared By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">— to be signed —</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Checked By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">— to be signed —</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Approved By</div></div>
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Please allow popups to print Bulk Bank Advice"); return; }
  w.document.open(); w.document.write(html); w.document.close();
};

export const printBankTransferAdvice = (pb) => {
  const rows = buildTransferRows(pb);
  if (!rows.length) { toast.error("No eligible employee transfers in this pay bill"); return; }
  const monthName = new Date(pb.year, (pb.month || 1) - 1).toLocaleString("en", { month: "long" });
  const total = rows.reduce((a, r) => a + r.netAmount, 0);
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const wordsFn = typeof amountToWords === "function" ? amountToWords : (n) => `${inr(n)} only`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Bank Transfer Advice - ${esc(pb.refNo)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Arial", sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 10pt; }
  .hdr { border-bottom: 3px double #0f172a; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
  .hdr .co { font-size: 20pt; font-weight: 900; color: #c81e2b; letter-spacing: 1.5px; }
  .hdr .tag { font-size: 9pt; font-weight: 700; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; }
  .hdr .addr { font-size: 8.5pt; color: #334155; margin-top: 2px; }
  .banner { background: #0f172a; color: #fff; padding: 8px 14px; text-align: center; font-size: 14pt; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; }
  .meta-row { display: flex; justify-content: space-between; padding: 6px 10px; background: #f1f5f9; border-left: 4px solid #c81e2b; font-size: 9pt; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
  .meta-row b { color: #c81e2b; }
  .addressee { padding: 8px 12px; background: #fff7ed; border: 1px solid #fed7aa; margin-bottom: 8px; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th, td { border: 1px solid #94a3b8; padding: 5px 6px; }
  th { background: #0f172a; color: #fff; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.num { text-align: right; font-family: "Courier New", monospace; font-weight: 700; }
  .total-row td { background: #0f172a !important; color: #fff; font-weight: 900; font-size: 10pt; }
  .words { padding: 8px 12px; background: #ecfdf5; border: 1px solid #86efac; margin-top: 10px; font-size: 9.5pt; }
  .words b { color: #166534; }
  .instr { padding: 8px 12px; background: #fef9c3; border: 1px solid #fde68a; margin-top: 8px; font-size: 8.5pt; color: #78350f; }
  .sign-row { display: flex; justify-content: space-between; margin-top: 25px; padding: 0 10px; }
  .sign-box { width: 30%; text-align: center; }
  .sign-box .line { border-top: 1px solid #0f172a; margin-top: 50px; padding-top: 4px; font-size: 9pt; font-weight: 700; }
  .sign-box .sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }
  @media print { body { padding: 0; } button { display: none; } }
</style>
</head>
<body>
  <div class="hdr">
    <div class="co">M/S ARUN ENTERPRISES</div>
    <div class="tag">Govt. Civil Work Contractor & General Order Supplier</div>
    <div class="addr">209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011 · Email: info@arunenterprises.online · Toll Free: 9429694552</div>
  </div>
  <div class="banner">BANK TRANSFER ADVICE · ${esc(monthName.toUpperCase())} ${pb.year}</div>
  <div class="meta-row">
    <div>Pay Bill: <b>${esc(pb.refNo)}</b></div>
    <div>Payment Voucher: <b>${esc(pb.linkedPvNo || "—")}</b></div>
    <div>Employees: <b>${rows.length}</b></div>
    <div>Date: <b>${esc(today)}</b></div>
  </div>
  <div class="addressee">
    <b>To:</b> The Branch Manager<br/>
    Please transfer the following salary payments to the respective employees' bank accounts as per the details below. Debit our Current Account for the total amount.
  </div>
  <table>
    <thead><tr>
      <th>Sr.</th><th>EMP Code</th><th>Name</th><th>Designation</th><th>Bank &amp; Branch</th><th>A/C No</th><th>IFSC</th><th>A/C Type</th><th>Amount (₹)</th>
    </tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>
        <td>${r.sr}</td>
        <td>${esc(r.empCode)}</td>
        <td>${esc(r.name)}<br/><span style="font-size:7.5pt;color:#64748b;">${esc(r.department || "")}</span></td>
        <td>${esc(r.designation)}</td>
        <td>${esc(r.bankName)}${r.bankBranch ? ` / ${esc(r.bankBranch)}` : ""}</td>
        <td style="font-family:monospace;">${esc(r.accountNo)}</td>
        <td style="font-family:monospace;">${esc(r.ifsc)}</td>
        <td>${esc(r.accountType)}</td>
        <td class="num">${inr(r.netAmount)}</td>
      </tr>`).join("")}
      <tr class="total-row"><td colspan="8" style="text-align:right;">TOTAL AMOUNT TO BE TRANSFERRED (₹)</td><td class="num">${inr(total)}</td></tr>
    </tbody>
  </table>
  <div class="words"><b>Amount in Words:</b> ${esc(wordsFn(total))}</div>
  <div class="instr"><b>Instructions:</b> (1) Verify all A/C numbers and IFSC codes before transfer. (2) Use NEFT/RTGS as applicable. (3) Share consolidated UTR/Ref Nos with Accounts department post-transfer for voucher closure.</div>
  <div class="sign-row">
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">${esc(pb.createdByName || "— to be signed —")}</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Created By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">${esc(pb.submittedByName || "— to be signed —")}</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Prepared By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">${esc(pb.settledByName || pb.verifiedByName || "— to be signed —")}</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Checked By</div></div>
    <div class="sign-box"><div style="font-weight:800;font-size:10pt;color:#0f172a;padding-bottom:4px;border-bottom:1.3px solid #0f172a;margin-bottom:5px;min-height:14px">${esc(pb.approvedByName || pb.finalApprovedByName || "— to be signed —")}</div><div style="font-weight:900;font-size:9.5pt;letter-spacing:.5px;text-transform:uppercase;color:#0f172a">Approved By</div></div>
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Please allow popups to print Bank Advice"); return; }
  w.document.open(); w.document.write(html); w.document.close();
};
