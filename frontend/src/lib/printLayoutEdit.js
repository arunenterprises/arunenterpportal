// Mouse layout editing inside a print-preview iframe: drag column edges, row edges and Ctrl+drag to move blocks.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGetPrintLayout, apiSetPrintLayout } from "./api";
const EDGE = 6;
const CSS = `body.ae-le, body.ae-le td, body.ae-le th{color:#000}body.ae-le *:focus{outline:none}`;
const MV = "table,img,h1,h2,h3,p,div";

const freeze = (table) => {
  if (table.dataset.aeFrozen) return;
  const row = [...table.rows].reduce((a, r) => (r.cells.length > a.cells.length ? r : a), table.rows[0]);
  if (!row) return;
  let cg = table.querySelector("colgroup[data-ae]");
  if (!cg) { cg = table.ownerDocument.createElement("colgroup"); cg.dataset.ae = "1"; table.insertBefore(cg, table.firstChild); }
  cg.innerHTML = "";
  [...row.cells].forEach((c) => { const col = table.ownerDocument.createElement("col"); col.style.width = `${c.getBoundingClientRect().width}px`; col.span = c.colSpan || 1; cg.appendChild(col); });
  table.style.tableLayout = "fixed";
  table.style.width = `${table.getBoundingClientRect().width}px`;
  table.dataset.aeFrozen = "1";
};

const colIndex = (cell) => {
  let i = 0;
  for (const c of cell.parentElement.cells) { if (c === cell) return i + (cell.colSpan || 1) - 1; i += c.colSpan || 1; }
  return i;
};
const colAt = (table, idx) => {
  let i = 0;
  for (const col of table.querySelectorAll("colgroup[data-ae] col")) { i += col.span || 1; if (idx < i) return col; }
  return null;
};

export const enableLayoutEdit = (doc, on) => {
  if (!doc?.body) return;
  if (doc.__aeOff) { doc.__aeOff(); doc.__aeOff = null; }
  doc.body.classList.toggle("ae-le", !!on);
  if (!on) return;
  if (!doc.getElementById("ae-le-css")) { const s = doc.createElement("style"); s.id = "ae-le-css"; s.textContent = CSS; doc.head.appendChild(s); }
  let drag = null;
  const hit = (e) => {
    const cell = e.target.closest?.("td,th");
    if (!cell) return null;
    const r = cell.getBoundingClientRect();
    if (r.right - e.clientX <= EDGE) return { kind: "col", cell };
    if (r.bottom - e.clientY <= EDGE) return { kind: "row", cell };
    return null;
  };
  const move = (e) => {
    if (!drag) {
      const h = hit(e);
      doc.body.style.cursor = h ? (h.kind === "col" ? "col-resize" : "row-resize") : e.ctrlKey ? "move" : "";
      return;
    }
    e.preventDefault();
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.kind === "col" && drag.col) drag.col.style.width = `${Math.max(12, drag.w + dx)}px`;
    if (drag.kind === "col" && drag.col) drag.table.style.width = `${Math.max(100, drag.tw + dx)}px`;
    if (drag.kind === "row") { drag.tr.style.height = `${Math.max(10, drag.h + dy)}px`; }
    if (drag.kind === "move") drag.el.style.transform = `translate(${drag.tx + dx}px, ${drag.ty + dy}px)`;
  };
  const down = (e) => {
    const h = hit(e);
    if (h) {
      e.preventDefault();
      const table = h.cell.closest("table");
      if (h.kind === "col") {
        freeze(table);
        const col = colAt(table, colIndex(h.cell));
        drag = { kind: "col", x: e.clientX, y: e.clientY, table, col, w: col ? parseFloat(col.style.width) : 0, tw: table.getBoundingClientRect().width };
      } else {
        const tr = h.cell.parentElement;
        drag = { kind: "row", x: e.clientX, y: e.clientY, tr, h: tr.getBoundingClientRect().height };
      }
      return;
    }
    if (e.ctrlKey) {
      const el = e.target.closest?.("table,img,h1,h2,h3,p,div:not(body)");
      if (!el || el === doc.body) return;
      e.preventDefault();
      const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(el.style.transform || "");
      drag = { kind: "move", el, x: e.clientX, y: e.clientY, tx: m ? +m[1] : 0, ty: m ? +m[2] : 0 };
    }
  };
  const up = () => { drag = null; };
  doc.addEventListener("mousemove", move);
  doc.addEventListener("mousedown", down, true);
  doc.addEventListener("mouseup", up);
  doc.__aeOff = () => { doc.removeEventListener("mousemove", move); doc.removeEventListener("mousedown", down, true); doc.removeEventListener("mouseup", up); doc.body.style.cursor = ""; };
};

export const captureLayout = (doc) => {
  const tables = [...doc.querySelectorAll("table")];
  const all = [...doc.body.querySelectorAll(MV)];
  return {
    tables: tables.map((t, i) => (t.dataset.aeFrozen ? { i, w: t.style.width, cols: [...t.querySelectorAll("colgroup[data-ae] col")].map((c) => [c.span || 1, c.style.width]) } : null)).filter(Boolean),
    rows: tables.flatMap((t, i) => [...t.rows].map((r, j) => (r.style.height ? { t: i, r: j, h: r.style.height } : null)).filter(Boolean)),
    moves: all.map((el, i) => (el.style.transform ? { i, tr: el.style.transform } : null)).filter(Boolean),
  };
};

export const applyLayout = (doc, L) => {
  if (!doc?.body || !L) return;
  const tables = [...doc.querySelectorAll("table")];
  (L.tables || []).forEach(({ i, w, cols }) => {
    const t = tables[i];
    if (!t || !cols?.length) return;
    let cg = t.querySelector("colgroup[data-ae]");
    if (!cg) { cg = doc.createElement("colgroup"); cg.dataset.ae = "1"; t.insertBefore(cg, t.firstChild); }
    cg.innerHTML = "";
    cols.forEach(([span, width]) => { const c = doc.createElement("col"); c.span = span; c.style.width = width; cg.appendChild(c); });
    t.style.tableLayout = "fixed"; if (w) t.style.width = w; t.dataset.aeFrozen = "1";
  });
  (L.rows || []).forEach(({ t, r, h }) => { const row = tables[t]?.rows[r]; if (row) row.style.height = h; });
  const all = [...doc.body.querySelectorAll(MV)];
  (L.moves || []).forEach(({ i, tr }) => { if (all[i]) all[i].style.transform = tr; });
};

export const usePrintLayout = (docKey, ref, setZoom, setMargin) => {
  const [L, setL] = useState(null);
  useEffect(() => {
    apiGetPrintLayout(docKey).then((r) => {
      const v = r.value || {};
      setL(v);
      if (v.zoom) setZoom(v.zoom);
      if (v.margin != null) setMargin(v.margin);
    }).catch(() => setL({}));
  }, [docKey, setZoom, setMargin]);
  const applySaved = () => applyLayout(ref.current?.contentDocument, L);
  useEffect(() => { applyLayout(ref.current?.contentDocument, L); }, [L, ref]);
  const save = async (zoom, margin) => {
    const d = ref.current?.contentDocument;
    if (!d) return;
    const v = { ...captureLayout(d), zoom, margin };
    try { await apiSetPrintLayout(docKey, v); setL(v); toast.success("Layout save ho gaya · har agle print par yahi lagega"); }
    catch (e) { toast.error(e.message); }
  };
  const reset = async () => {
    if (!window.confirm("Saved layout hata kar original layout par wapas jaayein?")) return;
    try { await apiSetPrintLayout(docKey, {}); setL({}); setZoom(100); setMargin(10); if (ref.current) ref.current.srcdoc = ref.current.srcdoc; toast.success("Original layout wapas"); }
    catch (e) { toast.error(e.message); }
  };
  return { applySaved, save, reset };
};

export const LAYOUT_EDIT_HINT = "Text par click karke badlein · cell ke RIGHT kinare ko pakad kar kheenchein = column chauda/patla · NEECHE kinare ko kheenchein = row oonchi · Ctrl dabakar kheenchein = table / block khiskayein · badlav sirf is print ke liye";
