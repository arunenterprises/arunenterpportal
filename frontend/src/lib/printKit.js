// Print polish: dark table lines + scanned company letterhead header on every print window
export const PRINT_DARK_CSS = "table,table th,table td{border-color:#000 !important}hr{border-color:#000 !important}";

export const letterheadImg = () =>
  `<img class="ae-lh-img" src="${window.location.origin}/letterhead-header.jpg" alt="Letterhead" style="width:100%;display:block;margin:0 0 8px"/>`;

// Page Setup bar injected into every print window: orientation (auto from data width), paper size, margins
const PAGE_SETUP = `<style>.ae-ps{position:fixed;top:0;left:0;right:0;z-index:99999;background:#0b1f4d;color:#fff;font:600 12px Arial;padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.3)}.ae-ps select,.ae-ps input{padding:4px 6px;border-radius:4px;border:0;font:600 12px Arial}.ae-ps button{padding:6px 14px;border:0;border-radius:5px;font:800 12px Arial;cursor:pointer}body{padding-top:48px}@media print{.ae-ps{display:none!important}body{padding-top:0!important}}</style>
<div class="ae-ps" id="ae-ps">Page Setup:
<label>Orientation <select id="ae-or" data-testid="print-orientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
<label>Paper <select id="ae-pp" data-testid="print-paper"><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option></select></label>
<label>Margin <select id="ae-mg" data-testid="print-margin"><option value="0">None</option><option value="5">Narrow 5mm</option><option value="10">Normal 10mm</option><option value="15">Wide 15mm</option><option value="20">Extra 20mm</option><option value="c">Custom</option></select></label>
<label id="ae-cw" style="display:none">T/R/B/L mm <input id="ae-mc" data-testid="print-margin-custom" value="10 10 10 10" style="width:90px"/></label>
<span id="ae-auto" style="color:#fcd34d"></span>
<button id="ae-go" data-testid="print-go" style="background:#16a34a;color:#fff;margin-left:auto">Print</button><button id="ae-x" style="background:#fff;color:#0b1f4d">Close</button></div>
<style id="ae-page"></style>
<script>(function(){var P=window.print.bind(window),$=function(i){return document.getElementById(i)},K="ae_print_setup",RK="ae_print_setup_map",RID=((document.querySelector("title")||{}).textContent||(document.querySelector("h1,h2,h3")||{}).textContent||"report").replace(/[0-9\\/\\-]+/g,"").trim().slice(0,60),s={},rm={};try{s=JSON.parse(localStorage.getItem(K)||"{}");rm=JSON.parse(localStorage.getItem(RK)||"{}")}catch(e){}var rs=rm[RID];
function auto(){var c=0;[].forEach.call(document.querySelectorAll("tr"),function(r){c=Math.max(c,r.children.length)});var w=false;return(c>9||w)?"landscape":"portrait"}
function apply(){var m=$("ae-mg").value,mm=m==="c"?$("ae-mc").value.trim().split(/\\s+/).map(function(x){return(parseFloat(x)||0)+"mm"}).join(" "):m+"mm";$("ae-cw").style.display=m==="c"?"inline":"none";$("ae-page").textContent="@page{size:"+$("ae-pp").value+" "+$("ae-or").value+";margin:"+mm+"}";var v={or:$("ae-or").value,pp:$("ae-pp").value,mg:m,mc:$("ae-mc").value};localStorage.setItem(K,JSON.stringify(v));if(window.__aeInit){rm[RID]=v;localStorage.setItem(RK,JSON.stringify(rm))}}
function init(){if(window.__aeInit)return;var a=auto(),z=rs||s;$("ae-or").value=(rs&&rs.or)||a;$("ae-auto").textContent=rs?"Saved layout: "+RID:"Auto: "+(a==="landscape"?"Landscape (wide data)":"Portrait");if(z.pp)$("ae-pp").value=z.pp;$("ae-mg").value=z.mg||"10";if(z.mc)$("ae-mc").value=z.mc;["ae-or","ae-pp","ae-mg","ae-mc"].forEach(function(i){$(i).onchange=apply});apply();window.__aeInit=1}
window.print=function(){if(!$("ae-or"))return P();init();$("ae-go").focus()};$("ae-go").onclick=function(){window.__aeInit=1;apply();P()};$("ae-x").onclick=function(){window.close()};
if(document.readyState==="complete")init();else window.addEventListener("load",init);})();</script>`;

export const polishPrintHtml = (h) => {
  if (typeof h !== "string") return h;
  let out = h.replace(/<div class=("?)(lh|hdr)\1>/g, (m) => letterheadImg() + m.replace(/>$/, ' style="display:none">'));
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, `<style>${PRINT_DARK_CSS}</style></head>`);
  else if (/<style/i.test(out)) out = `<style>${PRINT_DARK_CSS}</style>${out}`;
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${PAGE_SETUP}</body>`);
  else if (/<\/html>/i.test(out)) out = out.replace(/<\/html>/i, `${PAGE_SETUP}</html>`);
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
