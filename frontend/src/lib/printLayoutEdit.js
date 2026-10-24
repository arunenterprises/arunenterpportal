// Mouse layout editing inside a print-preview iframe: drag column edges, row edges and Ctrl+drag to move blocks.
const EDGE = 6;
const CSS = `body.ae-le td,body.ae-le th{outline:1px dashed rgba(245,158,11,.45)}body.ae-le .ae-mv{outline:2px solid #2563eb!important}`;

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
      el.classList.add("ae-mv");
      drag = { kind: "move", el, x: e.clientX, y: e.clientY, tx: m ? +m[1] : 0, ty: m ? +m[2] : 0 };
    }
  };
  const up = () => { if (drag?.el) drag.el.classList.remove("ae-mv"); drag = null; };
  doc.addEventListener("mousemove", move);
  doc.addEventListener("mousedown", down, true);
  doc.addEventListener("mouseup", up);
  doc.__aeOff = () => { doc.removeEventListener("mousemove", move); doc.removeEventListener("mousedown", down, true); doc.removeEventListener("mouseup", up); doc.body.style.cursor = ""; };
};

export const LAYOUT_EDIT_HINT = "Text par click karke badlein · cell ke RIGHT kinare ko pakad kar kheenchein = column chauda/patla · NEECHE kinare ko kheenchein = row oonchi · Ctrl dabakar kheenchein = table / block khiskayein · badlav sirf is print ke liye";
