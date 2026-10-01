// Work Order A4 Printable PDF - opens new window with company letterhead + all WO fields
import { getLogo } from "./store";

const COMPANY = {
  name: "ARUN ENTERPRISES",
  tagline: "Quality · Commitment · Solutions & Services",
  address: "209H/1F/1 Ops Nagar, Kalindipuram, Prayagraj — 211011, Uttar Pradesh, India",
  phone: "+91-9429694552",
  website: "www.arunenterprises.com.in",
  email: "info@arunenterprises.online",
  gstin: "09AAACA0000A1Z5",
};

const fmtDMY = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};

const inr = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/\n/g, "<br/>");

export const printWorkOrder = (wo, boqRef = "") => {
  if (!wo) return;
  const logo = getLogo() || "/arun-logo.jpg";
  const totalWO = (wo.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gst = Math.round(totalWO * (Number(wo.gstSlab) || 0) / 100);
  const retention = Math.round(totalWO * (Number(wo.retentionPct) || 0) / 100);
  const grand = totalWO + gst - retention;

  const itemsHtml = (wo.items || []).map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${esc(it.description)}</td>
      <td style="text-align:right">${esc(it.qty)}</td>
      <td style="text-align:center">${esc(it.unit)}</td>
      <td style="text-align:right">${inr(it.rate)}</td>
      <td style="text-align:right">${inr(it.amount)}</td>
    </tr>`).join("");

  const body = `
    <h1 class="title">Work Order</h1>

    <table class="meta">
      <tr>
        <td><b>WO No.:</b> ${esc(wo.woNo || "— pending approval —")}</td>
        <td><b>WO Date:</b> ${fmtDMY(wo.woDate)}</td>
        <td><b>Expiry Date:</b> ${fmtDMY(wo.expiryDate)}</td>
      </tr>
      <tr>
        <td><b>BOQ Ref:</b> ${esc(wo.boqRefNo || boqRef || "—")}</td>
        <td><b>Project / Site:</b> ${esc(wo.projectSite || "—")}</td>
        <td><b>Client:</b> ${esc(wo.clientName || "—")}</td>
      </tr>
    </table>

    <h2 class="sec">To,</h2>
    <div class="vbox">
      <div><b>${esc(wo.vendorName || "—")}</b> &nbsp;·&nbsp; Vendor Code: <b>${esc(wo.vendorCode || "—")}</b></div>
    </div>

    <h2 class="sec">A. Scope of Work</h2>
    <div class="para">${esc(wo.scopeOfWork || "—")}</div>

    <h2 class="sec">B. Line Items</h2>
    <table class="items">
      <thead>
        <tr>
          <th style="width:34px">#</th>
          <th>Description</th>
          <th style="width:70px">Qty</th>
          <th style="width:70px">Unit</th>
          <th style="width:95px">Rate (₹)</th>
          <th style="width:110px">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || `<tr><td colspan="6" style="text-align:center;color:#64748b">No items</td></tr>`}
        <tr class="sub"><td colspan="5" style="text-align:right">Sub Total</td><td style="text-align:right">${inr(totalWO)}</td></tr>
        <tr class="sub"><td colspan="5" style="text-align:right">GST @ ${esc(wo.gstSlab || 0)}%</td><td style="text-align:right">${inr(gst)}</td></tr>
        <tr class="sub"><td colspan="5" style="text-align:right">Less: Retention @ ${esc(wo.retentionPct || 0)}%</td><td style="text-align:right">(${inr(retention)})</td></tr>
        <tr class="total"><td colspan="5" style="text-align:right">Grand Total (Payable)</td><td style="text-align:right">₹ ${inr(grand)}</td></tr>
      </tbody>
    </table>

    <h2 class="sec">C. Terms &amp; Conditions</h2>
    <table class="terms">
      <tr><td class="k">Payment Terms</td><td>${esc(wo.paymentTerms || "—")}</td></tr>
      <tr><td class="k">Delivery Terms</td><td>${esc(wo.deliveryTerms || "—")}</td></tr>
      <tr><td class="k">Penalty Clause</td><td>${esc(wo.penaltyClause || "—")}</td></tr>
      <tr><td class="k">Warranty Clause</td><td>${esc(wo.warrantyClause || "—")}</td></tr>
      <tr><td class="k">General T&amp;C</td><td>${esc(wo.termsAndConditions || "—")}</td></tr>
    </table>

    <table class="approval">
      <tr>
        <td><b>Prepared By:</b> ${esc(wo.preparedBy || "—")}</td>
        <td><b>Submitted:</b> ${fmtDMY(wo.submittedDate)}</td>
        <td><b>Approved By:</b> ${esc(wo.approvedByName || "— pending —")}</td>
        <td><b>Approval Date:</b> ${fmtDMY(wo.approvalDate)}</td>
      </tr>
    </table>
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Work Order ${esc(wo.woNo || wo.id || "")}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Times New Roman", Georgia, serif; color: #0f172a; margin: 0; padding: 0; font-size: 11pt; line-height: 1.45; }
  .lh { display: flex; align-items: center; gap: 14px; border-bottom: 2.5px solid #0f172a; padding-bottom: 10px; margin-bottom: 10px; }
  .lh img { width: 72px; height: 72px; object-fit: contain; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; padding: 2px; }
  .lh .name { font-size: 22pt; font-weight: 800; letter-spacing: 1.5px; color: #0f172a; line-height: 1.05; }
  .lh .tag { font-size: 9.5pt; color: #475569; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; font-style: italic; }
  .lh .addr { font-size: 8.8pt; color: #64748b; margin-top: 4px; line-height: 1.4; }
  .lh .addr b { color: #334155; }
  h1.title { font-size: 15pt; font-weight: 800; text-align: center; text-decoration: underline; letter-spacing: 2px; margin: 4px 0 10px; text-transform: uppercase; }
  h2.sec { font-size: 11pt; font-weight: 800; background: #0f172a; color: #fff; padding: 4px 8px; margin: 10px 0 6px; letter-spacing: 1px; text-transform: uppercase; }
  table.meta { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 4px; }
  table.meta td { padding: 3px 6px; border: 1px solid #cbd5e1; width: 33.33%; }
  .vbox { padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; margin-bottom: 6px; }
  .para { padding: 6px 8px; border: 1px solid #cbd5e1; min-height: 36px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 10pt; }
  table.items th, table.items td { border: 1px solid #334155; padding: 4px 6px; }
  table.items th { background: #0f172a; color: #fff; text-transform: uppercase; font-size: 9pt; }
  table.items tr.sub td { background: #f1f5f9; font-weight: 700; }
  table.items tr.total td { background: #fef3c7; font-weight: 800; font-size: 11pt; }
  table.terms { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 4px 0; }
  table.terms td { border: 1px solid #cbd5e1; padding: 4px 8px; vertical-align: top; }
  table.terms td.k { background: #f1f5f9; font-weight: 700; width: 150px; }
  table.approval { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 10px; }
  table.approval td { border: 1px solid #cbd5e1; padding: 6px; width: 25%; }
  .noprint-btn { position: fixed; top: 10px; right: 10px; padding: 10px 18px; background: #0f172a; color: #fff; border: none; border-radius: 6px; font-size: 11pt; cursor: pointer; font-weight: 700; }
  @media print { .noprint-btn { display: none; } }
</style>
</head>
<body>
<button class="noprint-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
<div class="lh">
  <img src="${logo}" alt="logo" onerror="this.style.display='none'" />
  <div style="flex:1;">
    <div class="name">${COMPANY.name}</div>
    <div class="tag">${COMPANY.tagline}</div>
    <div class="addr">
      <b>Office:</b> ${COMPANY.address}<br/>
      <b>Tel:</b> ${COMPANY.phone} · <b>Email:</b> ${COMPANY.email} · <b>Web:</b> ${COMPANY.website}<br/>
      <b>GSTIN:</b> ${COMPANY.gstin}
    </div>
  </div>
</div>
${body}
<script>
  window.onload = function() { setTimeout(function() { window.print(); }, 400); };
</script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) { alert("Please allow pop-ups to generate the Work Order PDF."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
};
