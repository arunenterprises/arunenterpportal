import { toast } from "sonner";
import { getToken } from "./api";

const BASE = process.env.REACT_APP_BACKEND_URL;
const CHUNK = 1024 * 1024;
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const b64 = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = no; r.readAsDataURL(blob); });
const post = async (body) => {
  const res = await fetch(`${BASE}/api/files/chunk`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
  return j;
};

// Chunked upload to server; returns {name,size,type,fileId} (no dataUrl kept in browser)
export const uploadBig = async (f, maxMB = 25) => {
  if (!f) return null;
  if (f.size > maxMB * 1024 * 1024) { toast.error(`File ${(f.size / 1048576).toFixed(1)} MB · seema ${maxMB} MB`); return null; }
  if (!TYPES.includes(f.type)) { toast.error("Sirf PDF, Excel ya Image file"); return null; }
  const total = Math.max(1, Math.ceil(f.size / CHUNK));
  const id = toast.loading(`Uploading ${f.name} · 0%`);
  try {
    let fileId = "";
    for (let i = 0; i < total; i += 1) {
      const r = await post({ fileId, index: i, total, name: f.name, size: f.size, type: f.type, maxMB, data: await b64(f.slice(i * CHUNK, (i + 1) * CHUNK)) });
      fileId = r.fileId;
      toast.loading(`Uploading ${f.name} · ${Math.round(((i + 1) / total) * 100)}%`, { id });
    }
    toast.success(`Uploaded ${f.name} (${(f.size / 1048576).toFixed(2)} MB)`, { id });
    return { name: f.name, size: f.size, type: f.type, fileId };
  } catch (e) { toast.error(`Upload fail: ${e.message}`, { id }); return null; }
};

export const openFile = async (f, download = false) => {
  if (!f) return;
  let url = f.dataUrl;
  if (!url && f.fileId) {
    const res = await fetch(`${BASE}/api/files/${f.fileId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) { toast.error("File nahi khuli"); return; }
    url = URL.createObjectURL(await res.blob());
  }
  if (!url) { toast.error("No file"); return; }
  if (download) { const a = document.createElement("a"); a.href = url; a.download = f.name || "file"; a.click(); } else window.open(url, "_blank", "noopener");
};
