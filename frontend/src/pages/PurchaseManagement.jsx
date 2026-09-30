import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { FileText, ClipboardList, Receipt, Wallet, ArrowRight, Info } from "lucide-react";
import Header from "../components/Header";
import HomeNavBar from "../components/HomeNavBar";
import { currentRole, canCreate } from "../lib/store";

const TABS = [
  {
    id: "boq",
    title: "BOQ",
    subtitle: "Bill of Quantity",
    icon: ClipboardList,
    color: "#0ea5e9",
    lines: [
      "Auto BOQ No · Project / Site",
      "Line items (desc / qty / rate / amount)",
      "Attachment (PDF / Excel)",
      "Create → Prepare → Submit → Approval",
    ],
  },
  {
    id: "wo",
    title: "Work Order",
    subtitle: "WO Creation",
    icon: FileText,
    color: "#16a34a",
    lines: [
      "Vendor-linked Work Order",
      "Scope, value, dates, terms",
      "Attachment (PDF)",
      "Create → Prepare → Submit → Approval",
    ],
    route: "/bill",
  },
  {
    id: "billing",
    title: "Billing",
    subtitle: "Vendor Bill Submission",
    icon: Receipt,
    color: "#f59e0b",
    lines: [
      "Bill Invoice + Work Order attach",
      "Multi-item breakdown (HSN/SAC)",
      "GST-ready draft",
      "Create → Submit (Accounts approves)",
    ],
    route: "/bill",
  },
  {
    id: "expense",
    title: "Expense",
    subtitle: "Petty Cash / Reimbursement",
    icon: Wallet,
    color: "#7c3aed",
    lines: [
      "Receipt upload + capture",
      "GST + TDS auto calculation",
      "Auto Ref No.",
      "Create → Submit (Accounts approves)",
    ],
    route: "/expense",
  },
];

export default function PurchaseManagement() {
  const nav = useNavigate();
  const [active, setActive] = useState("boq");
  const role = currentRole();
  const write = canCreate();

  const openTab = (t) => {
    if (t.route) { nav(t.route); return; }
    setActive(t.id);
  };

  const activeTab = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <>
      <Toaster position="top-center" richColors />
      <HomeNavBar />
      <div className="app-shell">
        <div className="a4" data-testid="purchase-page">
          <Header formTitle="PURCHASE MANAGEMENT · CREATE / PREPARE / SUBMIT" />

          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }} data-testid="purchase-tabs">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  data-testid={`purchase-tab-${t.id}`}
                  onClick={() => openTab(t)}
                  style={{
                    flex: 1, minWidth: 180,
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 6,
                    border: `1px solid ${isActive ? t.color : "#cbd5e1"}`,
                    background: isActive ? t.color : "#fff",
                    color: isActive ? "#fff" : "#0f172a",
                    cursor: "pointer",
                    fontWeight: 700, fontSize: 12.5,
                    letterSpacing: .3,
                  }}
                >
                  <Icon size={18} strokeWidth={2} />
                  <div style={{ textAlign: "left" }}>
                    <div>{t.title}</div>
                    <div style={{ fontSize: 10, opacity: .8, fontWeight: 500 }}>{t.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{
            marginTop: 14, padding: "12px 14px",
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6,
            display: "flex", alignItems: "center", gap: 10, fontSize: 12,
          }} data-testid="purchase-role-note">
            <Info size={14} />
            <span>
              Signed in as <b>{role}</b> · Purchase Management me sirf <b>Create / Prepare / Submit</b> permission hai — Approval Accounts Department karega.
            </span>
          </div>

          <div style={{ marginTop: 16 }} data-testid={`purchase-panel-${active}`}>
            <div style={{ borderLeft: `4px solid ${activeTab.color}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{activeTab.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{activeTab.subtitle}</div>
              <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 12.5, lineHeight: 1.7 }}>
                {activeTab.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>

            {activeTab.id === "boq" ? (
              <div style={{ marginTop: 18, padding: "16px 18px", background: "#fff7ed", border: "1px dashed #fdba74", borderRadius: 6, fontSize: 13, color: "#7c2d12" }}>
                <b>BOQ full editor coming next.</b> Yahaan pe BOQ No auto-generate, Project / Site, Line items table (Add / Delete), Total auto-calc, PDF/Excel attachment upload, Prepared by (current user), Submitted date honge. Submit karne pe entry Accounts Department ke inbox me chali jayegi.
              </div>
            ) : (
              <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
                <button
                  disabled={!write}
                  data-testid={`purchase-open-${activeTab.id}`}
                  onClick={() => activeTab.route && nav(activeTab.route)}
                  style={{
                    padding: "10px 16px", background: activeTab.color, color: "#fff",
                    border: "none", borderRadius: 5, cursor: write ? "pointer" : "not-allowed",
                    opacity: write ? 1 : .5,
                    fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  Open {activeTab.title} Module <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
