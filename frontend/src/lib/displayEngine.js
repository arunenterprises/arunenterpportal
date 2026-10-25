import { maskedKeys } from "./acl";

// Global display layer: DD/MM/YYYY dates everywhere + RBAC widget/column masking
const DATE_RX = /\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?(?![\d-])/g;
export const fmtDates = (s) => s.replace(DATE_RX, (m, y, mo, d, h, mi) => `${d}/${mo}/${y}${h ? ` ${h}:${mi}` : ""}`);
export const fmtDate = (iso) => (iso ? fmtDates(String(iso)) : "");

const COL_RX = {
  "col:Net Payable": "net\\s*payable", "col:TDS": "\\btds\\b", "col:GST": "\\bgst\\b|cgst|sgst|igst", "col:Basic": "basic|taxable",
  "col:Gross": "gross", "col:Amount": "amount|total|value", "col:Rate": "\\brate\\b",
};
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE"]);

const fixText = (root) => {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const v = n.nodeValue;
    if (!v || v.length < 10 || !/\d{4}-\d{2}-\d{2}/.test(v) || SKIP.has(n.parentNode?.nodeName)) continue;
    const f = fmtDates(v);
    if (f !== v) n.nodeValue = f;
  }
};

// Hides table columns whose header matches a masked key. Serialisable (also injected into print windows).
function maskTables(doc, srcs) {
  var rxs = srcs.map(function (s) { return new RegExp(s, "i"); });
  doc.querySelectorAll("table").forEach(function (t) {
    var head = (t.tHead && t.tHead.rows[t.tHead.rows.length - 1]) || t.rows[0];
    if (!head) return;
    var hide = [], col = 0;
    Array.prototype.forEach.call(head.cells, function (c) {
      var span = c.colSpan || 1;
      if (c.tagName === "TH" && rxs.some(function (r) { return r.test(c.textContent || ""); })) for (var k = 0; k < span; k++) hide.push(col + k);
      col += span;
    });
    Array.prototype.forEach.call(t.rows, function (r) {
      var i = 0;
      Array.prototype.forEach.call(r.cells, function (c) {
        var on = hide.indexOf(i) >= 0 && (c.colSpan || 1) === 1;
        if (on) { c.style.display = "none"; c.setAttribute("data-rbac-hidden", "1"); }
        else if (c.getAttribute("data-rbac-hidden")) { c.style.display = ""; c.removeAttribute("data-rbac-hidden"); }
        i += c.colSpan || 1;
      });
    });
  });
}

const colSrcs = () => maskedKeys().filter((k) => COL_RX[k]).map((k) => COL_RX[k]);

const applyCardCss = () => {
  let el = document.getElementById("rbac-mask-css");
  if (!el) { el = document.createElement("style"); el.id = "rbac-mask-css"; document.head.appendChild(el); }
  el.textContent = maskedKeys().filter((k) => k.startsWith("card:")).map((k) => {
    const id = k.slice(5);
    return id === "gm-crm-kpi" ? `[data-testid^="gm-crm-kpi-"]{display:none!important}` : `[data-testid="${id}"]{display:none!important}`;
  }).join("\n");
};

const transformHtml = (h) => {
  if (typeof h !== "string") return h;
  let out = h.replace(/>([^<]+)</g, (m, t) => `>${fmtDates(t)}<`);
  const s = colSrcs();
  if (s.length && /<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `<script>(${maskTables.toString()})(document, ${JSON.stringify(s)});</script></body>`);
  return out;
};

export const installDisplayEngine = () => {
  let queued = false;
  const run = () => {
    queued = false;
    fixText(document.body);
    const s = colSrcs();
    if (s.length || document.querySelector("[data-rbac-hidden]")) maskTables(document, s);
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("ae-acl", () => { applyCardCss(); schedule(); });
  applyCardCss();
  schedule();
  const open = window.open.bind(window);
  window.open = (...a) => {
    const w = open(...a);
    try {
      if (w && w.document) {
        const wr = w.document.write.bind(w.document);
        w.document.write = (...h) => wr(...h.map(transformHtml));
      }
    } catch { /* cross-origin window */ }
    return w;
  };
};
