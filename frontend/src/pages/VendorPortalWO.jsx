import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer, FileSearch, ShieldCheck, Loader2 } from "lucide-react";
import { printWorkOrder } from "../lib/woPrint";

const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "") + "/api";

// Public, read-only Vendor Portal view of an approved + published Work Order.
// Fetches directly from the shared backend so vendors can view it on any device
// without needing to log in or share localStorage with the publisher.
const VendorPortalWO = () => {
  const { id } = useParams();
  const [wo, setWo] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | notfound | restricted | error

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`${API}/public/work_orders/${encodeURIComponent(id)}`);
        if (res.status === 404) { if (!cancelled) setStatus("notfound"); return; }
        if (res.status === 403) { if (!cancelled) setStatus("restricted"); return; }
        if (!res.ok) { if (!cancelled) setStatus("error"); return; }
        const data = await res.json();
        if (cancelled) return;
        setWo(data);
        setVendor(data.vendor || null);
        setStatus("ok");
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Loader2 size={28} className="spin" style={{ animation: "spin 1s linear infinite" }} />
          <div style={{ fontSize: 14, letterSpacing: 1 }}>Loading Work Order…</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 500, textAlign: "center", background: "#1e293b", padding: 40, borderRadius: 10, border: "1px solid #334155" }}>
          <FileSearch size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>Work Order Not Found</h2>
          <p style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>The requested WO ID <code style={{ background: "#0f172a", padding: "2px 6px", borderRadius: 3 }}>{id}</code> is not available or the link is invalid.</p>
          <p style={{ color: "#64748b", marginTop: 10, fontSize: 11 }}>Please contact ARUN ENTERPRISES Purchase Department.</p>
        </div>
      </div>
    );
  }

  if (status === "restricted") {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 500, textAlign: "center", background: "#1e293b", padding: 40, borderRadius: 10, border: "1px solid #334155" }}>
          <ShieldCheck size={48} color="#f87171" style={{ marginBottom: 16 }} />
          <h2 style={{ margin: 0, fontSize: 20 }}>Access Restricted</h2>
          <p style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>This Work Order has not been published to the vendor portal yet.</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !wo) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 500, textAlign: "center", background: "#1e293b", padding: 40, borderRadius: 10, border: "1px solid #334155" }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Unable to Load</h2>
          <p style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>Network error. Please try again later.</p>
        </div>
      </div>
    );
  }

  const totalWO = (wo.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const gst = Math.round(totalWO * (Number(wo.gstSlab) || 0) / 100);
  const retention = Math.round(totalWO * (Number(wo.retentionPct) || 0) / 100);
  const grand = totalWO + gst - retention;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "20px 16px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Portal badge banner */}
        <div style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%)", color: "#fff", padding: "14px 20px", borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 4px 14px rgba(79,70,229,.25)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", opacity: .9 }}>Vendor Portal · Read-only</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>ARUN ENTERPRISES · Work Order Preview</div>
          </div>
          <button
            onClick={() => printWorkOrder(wo)}
            data-testid="portal-print-wo"
            style={{ padding: "10px 18px", background: "#fff", color: "#4f46e5", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 800, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Printer size={15} /> Download / Print A4
          </button>
        </div>

        {/* WO details card */}
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 10px rgba(15,23,42,.08)", border: "1px solid #e2e8f0" }} data-testid="portal-wo-view">
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f172a", borderBottom: "2px solid #0ea5e9", paddingBottom: 10 }}>Work Order {wo.woNo || "—"}</h1>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16, fontSize: 12 }}>
            <div><b>WO Date:</b> {wo.woDate || "—"}</div>
            <div><b>Expiry:</b> {wo.expiryDate || "—"}</div>
            <div><b>BOQ Ref:</b> {wo.boqRefNo || "—"}</div>
            <div><b>Project / Site:</b> {wo.projectSite || "—"}</div>
            <div><b>Client:</b> {wo.clientName || "—"}</div>
            <div><b>Published:</b> {wo.vendorPortalPublishedAt ? new Date(wo.vendorPortalPublishedAt).toLocaleDateString("en-GB") : "—"}</div>
          </div>

          <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{vendor?.firmName || wo.vendorName || "—"}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Code: <b>{wo.vendorCode}</b>{vendor?.gstNo ? ` · GSTIN: ${vendor.gstNo}` : ""}{vendor?.contactPerson ? ` · ${vendor.contactPerson}` : ""}</div>
          </div>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>Scope of Work</h3>
          <div style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 12, color: "#334155", whiteSpace: "pre-wrap", minHeight: 40 }}>{wo.scopeOfWork || "—"}</div>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>Line Items</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr style={{ background: "#0f172a", color: "#fff" }}>
              <th style={{ padding: 7, textAlign: "left" }}>#</th>
              <th style={{ padding: 7, textAlign: "left" }}>Description</th>
              <th style={{ padding: 7, textAlign: "right" }}>Qty</th>
              <th style={{ padding: 7 }}>Unit</th>
              <th style={{ padding: 7, textAlign: "right" }}>Rate ₹</th>
              <th style={{ padding: 7, textAlign: "right" }}>Amount ₹</th>
            </tr></thead>
            <tbody>
              {(wo.items || []).map((it, i) => (
                <tr key={i} style={{ background: i % 2 ? "#f8fafc" : "#fff" }}>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{i + 1}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{it.description}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>{it.qty}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "center" }}>{it.unit}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>{Number(it.rate || 0).toLocaleString("en-IN")}</td>
                  <td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700 }}>{Number(it.amount || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              <tr style={{ background: "#f1f5f9" }}><td colSpan={5} style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700 }}>Sub Total</td><td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700 }}>₹ {totalWO.toLocaleString("en-IN")}</td></tr>
              <tr style={{ background: "#f1f5f9" }}><td colSpan={5} style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>GST @ {wo.gstSlab || 0}%</td><td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>₹ {gst.toLocaleString("en-IN")}</td></tr>
              <tr style={{ background: "#f1f5f9" }}><td colSpan={5} style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>Less Retention @ {wo.retentionPct || 0}%</td><td style={{ padding: 6, border: "1px solid #e2e8f0", textAlign: "right" }}>(₹ {retention.toLocaleString("en-IN")})</td></tr>
              <tr style={{ background: "#fef3c7" }}><td colSpan={5} style={{ padding: 10, border: "1px solid #0f172a", textAlign: "right", fontWeight: 800, fontSize: 13 }}>Grand Total (Payable)</td><td style={{ padding: 10, border: "1px solid #0f172a", textAlign: "right", fontWeight: 800, fontSize: 15, color: "#78350f" }}>₹ {grand.toLocaleString("en-IN")}</td></tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, color: "#0f172a" }}>Terms &amp; Conditions</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <tbody>
              {[["Payment Terms", wo.paymentTerms], ["Delivery Terms", wo.deliveryTerms], ["Penalty Clause", wo.penaltyClause], ["Warranty Clause", wo.warrantyClause], ["General T&C", wo.termsAndConditions]].map(([k, v]) => (
                <tr key={k}><td style={{ padding: 6, border: "1px solid #e2e8f0", background: "#f1f5f9", fontWeight: 700, width: 160 }}>{k}</td><td style={{ padding: 6, border: "1px solid #e2e8f0" }}>{v || "—"}</td></tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 20, padding: 12, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 11, color: "#166534" }}>
            <b>✓ Approved by:</b> {wo.approvedByName || "—"} · <b>Approval Date:</b> {wo.approvalDate || "—"}
          </div>
        </div>

        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 10, marginTop: 20 }}>
          Powered by ARUN ENTERPRISES Vendor Portal · Confidential document — share only with the authorized vendor.
        </div>
      </div>
    </div>
  );
};

export default VendorPortalWO;
