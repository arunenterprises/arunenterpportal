import React from "react";
import { matchItem } from "./ContractSelect";

const n = (v) => Number(v) || 0;
const inr = (v) => `₹${n(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const th = { padding: "5px 6px", background: "#14532d", color: "#fff", fontSize: 10.5, textAlign: "right", whiteSpace: "nowrap" };
const td = { padding: "4px 6px", borderBottom: "1px solid #e2e8f0", fontSize: 11.5, textAlign: "right" };

const sumFor = (m, c, lines) => lines.filter((l) => matchItem(m, l) === c).reduce((s, l) => s + n(l.qty), 0);

// Contract item-wise: earlier bills + this bill vs contract BOQ qty/value
export const ContractBalance = ({ master, prior, current }) => {
  if (!master?.items?.length) return null;
  const rows = master.items.map((c) => {
    const before = sumFor(master, c, prior), now = sumFor(master, c, current), billed = before + now;
    return { c, before, now, billed, bal: n(c.qty) - billed };
  });
  const tot = rows.reduce((s, r) => ({ v: s.v + n(r.c.qty) * n(r.c.rate), b: s.b + r.billed * n(r.c.rate) }), { v: 0, b: 0 });
  return (
    <div data-testid="contract-balance" style={{ marginTop: 10, border: "1px solid #bbf7d0", borderRadius: 8, overflowX: "auto", background: "#fff" }}>
      <div style={{ padding: "7px 10px", background: "#f0fdf4", fontWeight: 800, fontSize: 12, color: "#166534", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span>Contract Balance · {master.contractNo} · {master.name}</span>
        <span data-testid="contract-balance-total">Billed {inr(tot.b)} / {inr(tot.v)} · Balance {inr(tot.v - tot.b)}</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Item Code", "Description", "Unit", "Contract Qty", "Rate", "Contract Value", "Earlier Bills Qty", "This Bill Qty", "Balance Qty", "Balance Value"].map((h, i) => <th key={h} style={{ ...th, textAlign: i < 3 ? "left" : "right" }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(({ c, before, now, bal }, i) => (
            <tr key={`${c.itemCode}-${i}`} data-testid={`cb-row-${i}`} style={{ background: bal < 0 ? "#fee2e2" : "transparent" }}>
              <td style={{ ...td, textAlign: "left", fontFamily: "monospace" }}>{c.itemCode || "—"}</td>
              <td style={{ ...td, textAlign: "left" }}>{c.description}</td>
              <td style={{ ...td, textAlign: "left" }}>{c.unit}</td>
              <td style={td}>{n(c.qty)}</td>
              <td style={td}>{inr(c.rate)}</td>
              <td style={td}>{inr(n(c.qty) * n(c.rate))}</td>
              <td style={td} data-testid={`cb-before-${i}`}>{before}</td>
              <td style={td} data-testid={`cb-now-${i}`}>{now}</td>
              <td style={{ ...td, fontWeight: 800, color: bal < 0 ? "#991b1b" : "#166534" }} data-testid={`cb-bal-${i}`}>{+bal.toFixed(3)}</td>
              <td style={{ ...td, fontWeight: 700 }} data-testid={`cb-balval-${i}`}>{inr(bal * n(c.rate))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
