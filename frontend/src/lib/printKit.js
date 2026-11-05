// Print polish: dark table lines + scanned company letterhead header on every print window
export const PRINT_DARK_CSS = "table,table th,table td{border-color:#000 !important}hr{border-color:#000 !important}";

export const letterheadImg = () =>
  `<img class="ae-lh-img" src="${window.location.origin}/letterhead-header.jpg" alt="Letterhead" style="width:100%;display:block;margin:0 0 8px"/>`;

export const polishPrintHtml = (h) => {
  if (typeof h !== "string") return h;
  let out = h.replace(/<div class=("?)(lh|hdr)\1>/g, (m) => letterheadImg() + m.replace(/>$/, ' style="display:none">'));
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `<style>${PRINT_DARK_CSS}</style></head>`);
  else if (/<style/i.test(out)) out = `<style>${PRINT_DARK_CSS}</style>${out}`;
  return out;
};

export const installPrintPolish = () => {
  const orig = window.open;
  window.open = function (...args) {
    const w = orig.apply(window, args);
    try {
      if (w && w.document) {
        const d = w.document;
        const wr = d.write.bind(d);
        d.write = (...s) => wr(...s.map(polishPrintHtml));
      }
    } catch (e) { /* cross-origin window */ }
    return w;
  };
};
