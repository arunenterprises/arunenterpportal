import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, HardDriveDownload, RefreshCw, Upload } from "lucide-react";
import { apiDownloadBackup, apiRestoreBackup, apiFetchSnapshot, getToken } from "../lib/api";
import { isSuperAdmin, currentUserEmail } from "../lib/store";

// IndexedDB keeps the chosen folder handle (File System Access API, Chrome / Edge).
const idb = (mode, fn) => new Promise((res, rej) => {
  const r = indexedDB.open("ae_local_folder", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("kv");
  r.onsuccess = () => { const tx = r.result.transaction("kv", mode); const q = fn(tx.objectStore("kv")); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); };
  r.onerror = () => rej(r.error);
});
const getHandle = () => idb("readonly", (s) => s.get("dir"));
const setHandle = (h) => idb("readwrite", (s) => s.put(h, "dir"));
const META = "local_folder_meta_v1";
const meta = () => { try { return JSON.parse(localStorage.getItem(META)) || {}; } catch { return {}; } };
export const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

const writeFile = async (dir, name, obj) => {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(obj, null, 1));
  await w.close();
};

// Pull the full server database (every user's data) and save JSON files into the chosen folder.
const today = () => new Date().toLocaleDateString("en-CA");
export const runFolderBackup = async (interactive = false, daily = false) => {
  const h = await getHandle();
  if (!h) throw new Error("Pehle folder chunein");
  let perm = h.queryPermission ? await h.queryPermission({ mode: "readwrite" }) : "granted";
  if (perm !== "granted" && interactive && h.requestPermission) perm = await h.requestPermission({ mode: "readwrite" });
  if (perm !== "granted") throw new Error("Folder permission chahiye \u2014 'Backup Now' dabayein");
  const sa = isSuperAdmin(currentUserEmail());
  const data = sa ? await apiDownloadBackup() : await apiFetchSnapshot();
  const cols = data.collections || data;
  const top = await h.getDirectoryHandle("ARUN_ERP_DATA", { create: true });
  const root = sa ? top : await top.getDirectoryHandle(`user_${(currentUserEmail() || "user").replace(/[^a-z0-9._-]/gi, "_")}`, { create: true });
  const latest = await root.getDirectoryHandle("latest", { create: true });
  let count = 0;
  for (const [name, rows] of Object.entries(cols)) {
    if (!Array.isArray(rows)) continue;
    await writeFile(latest, `${name}.json`, rows);
    count += rows.length;
  }
  const day = new Date().toISOString().slice(0, 10);
  const hist = await root.getDirectoryHandle("history", { create: true });
  await writeFile(hist, `ERP_Backup_${day}.json`, { generated_at: new Date().toISOString(), collections: cols });
  const m = { ...meta(), folder: h.name, lastAt: new Date().toISOString(), lastCount: count, lastCollections: Object.keys(cols).length };
  if (daily) {
    const dd = await root.getDirectoryHandle("daily_sync", { create: true });
    const hm = new Date().toTimeString().slice(0, 5).replace(":", "");
    await writeFile(dd, `Daily_Sync_${today()}_${hm}.json`, { generated_at: new Date().toISOString(), records: count, collections: cols });
    m.dailyDone = today();
    m.dailyAt = new Date().toISOString();
  }
  localStorage.setItem(META, JSON.stringify(m));
  return m;
};

// Background runner (SuperAdmin only): auto-saves every N minutes while the ERP is open.
export const LocalFolderRunner = () => {
  useEffect(() => {
    if (!folderSupported) return undefined;
    const tick = () => {
      const m = meta();
      if (!getToken() || !m.folder) return;
      const from = m.dailyFrom ?? 22;
      const hr = new Date().getHours();
      if (m.daily !== false && hr >= from && hr < from + 1 && m.dailyDone !== today()) {
        runFolderBackup(false, true).then((r) => toast.success(`Aaj ka Daily Sync ho gaya: ${r.lastCount} records`)).catch(() => {
          if (m.remindOn === today()) return;
          localStorage.setItem(META, JSON.stringify({ ...meta(), remindOn: today() }));
          toast.warning("Aaj ka Daily Sync baki hai \u2014 folder mein backup save karein", { duration: 600000, action: { label: "Daily Sync karein", onClick: () => runFolderBackup(true, true).then((r) => toast.success(`Daily Sync ho gaya: ${r.lastCount} records`)).catch((e) => toast.error(e.message)) } });
        });
        return;
      }
      if (!m.auto) return;
      if (m.lastAt && Date.now() - new Date(m.lastAt).getTime() < (m.every || 5) * 60000) return;
      runFolderBackup(false).catch(() => {});
    };
    const t = setInterval(tick, 30000);
    const onSync = () => setTimeout(tick, 2000);
    window.addEventListener("ae-sync-done", onSync);
    setTimeout(tick, 8000);
    return () => { clearInterval(t); window.removeEventListener("ae-sync-done", onSync); };
  }, []);
  return null;
};

const btn = (bg) => ({ padding: "8px 14px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 });

export const LocalFolderPanel = () => {
  const [m, setM] = useState(meta);
  const [busy, setBusy] = useState(false);
  const save = (x) => { const n = { ...meta(), ...x }; localStorage.setItem(META, JSON.stringify(n)); setM(n); };
  const choose = async () => {
    try {
      const h = await window.showDirectoryPicker({ mode: "readwrite" });
      await setHandle(h);
      save({ folder: h.name, auto: true, every: m.every || 5 });
      toast.success(`Folder set: ${h.name}`);
      await now();
    } catch (e) { if (e.name !== "AbortError") toast.error(e.message); }
  };
  const now = async (daily = false) => {
    setBusy(true);
    try { const r = await runFolderBackup(true, daily === true); setM(r); toast.success(`${r.lastCount} records ${r.folder} folder mein save`); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const restore = async (file) => {
    if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      const cols = j.collections || j;
      if (!window.confirm(`${Object.keys(cols).length} collections server par merge karein? (purana data delete nahi hoga)`)) return;
      await apiRestoreBackup(cols, false);
      toast.success("Folder se data server par restore ho gaya. Page refresh karein.");
    } catch (e) { toast.error(`Restore failed: ${e.message}`); }
  };
  const sa = isSuperAdmin(currentUserEmail());
  return (
    <div data-testid="local-folder-panel" style={{ margin: "16px 0", border: "2px solid #0f766e", borderRadius: 10, padding: 14, background: "#f0fdfa" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900, color: "#0f766e", fontSize: 14 }}><HardDriveDownload size={18} /> Local Folder / Drive Data Save {sa ? "(SuperAdmin · sabhi users ka data)" : "(aapka data)"}</div>
      <div style={{ fontSize: 12, color: "#334155", margin: "6px 0 10px", lineHeight: 1.5 }}>
        Apne computer ka koi bhi drive / folder chunein. {sa ? "Sabhi users ke saare process ka data" : "Aapke saare process ka data"} <b>ARUN_ERP_DATA</b> folder mein JSON files mein apne-aap save hota rahega: <code>latest/</code> (har process ki file) aur <code>history/</code> (roz ki ek poori file).
      </div>
      {!folderSupported ? (
        <div data-testid="local-folder-unsupported" style={{ color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>Yeh feature Google Chrome ya Microsoft Edge (computer) par hi chalega.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button data-testid="local-folder-choose" onClick={choose} style={btn("#0f766e")}><FolderOpen size={14} /> {m.folder ? "Folder badlein" : "Folder / Drive chunein"}</button>
            <button data-testid="local-folder-now" disabled={busy || !m.folder} onClick={() => now()} style={{ ...btn("#1d4ed8"), opacity: busy || !m.folder ? 0.6 : 1 }}><RefreshCw size={14} /> {busy ? "Saving\u2026" : "Backup Now"}</button>
            <label style={{ fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input data-testid="local-folder-auto" type="checkbox" checked={!!m.auto} onChange={(e) => save({ auto: e.target.checked })} /> Auto save har
              <select data-testid="local-folder-every" value={m.every || 5} onChange={(e) => save({ every: Number(e.target.value) })} style={{ padding: 3 }}>{[1, 5, 15, 30, 60].map((x) => <option key={x} value={x}>{x}</option>)}</select> min
            </label>
            <button data-testid="local-folder-daily-now" disabled={busy || !m.folder} onClick={() => now(true)} style={{ ...btn("#b45309"), opacity: busy || !m.folder ? 0.6 : 1 }}><HardDriveDownload size={14} /> Daily Sync Now</button>
            <label style={{ fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input data-testid="local-folder-daily" type="checkbox" checked={m.daily !== false} onChange={(e) => save({ daily: e.target.checked })} /> Roz raat Daily Sync
              <select data-testid="local-folder-daily-from" value={m.dailyFrom ?? 22} onChange={(e) => save({ dailyFrom: Number(e.target.value) })} style={{ padding: 3 }}>{[18, 19, 20, 21, 22, 23].map((x) => <option key={x} value={x}>{`${x > 12 ? x - 12 : x}:00 - ${x + 1 > 12 ? x - 11 : x + 1}:00 PM`.replace("12:00 PM", "12:00 AM")}</option>)}</select>
            </label>
            {sa && <label style={{ ...btn("#7c3aed"), cursor: "pointer" }}><Upload size={14} /> Folder file se Restore
              <input data-testid="local-folder-restore" type="file" accept=".json" style={{ display: "none" }} onChange={(e) => restore(e.target.files[0])} />
            </label>}
          </div>
          <div data-testid="local-folder-status" style={{ marginTop: 8, fontSize: 12, color: "#0f172a" }}>
            Folder: <b>{m.folder || "—"}</b> · Last save: <b>{m.lastAt ? new Date(m.lastAt).toLocaleString("en-IN") : "abhi tak nahi"}</b>{m.lastCount != null ? ` · ${m.lastCount} records / ${m.lastCollections} collections` : ""}
          </div>
          <div data-testid="local-folder-daily-status" style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: m.dailyDone === today() ? "#15803d" : "#b45309" }}>
            Aaj ka Daily Sync: {m.dailyDone === today() ? `Ho gaya (${new Date(m.dailyAt).toLocaleTimeString("en-IN")})` : "Baki hai"} · File: ARUN_ERP_DATA/daily_sync/Daily_Sync_&lt;date&gt;_&lt;time&gt;.json (purani files kabhi delete nahi hoti)
          </div>
          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>Auto save tabhi chalta hai jab ERP is computer par khula ho (har {m.every || 5} min aur har sync ke baad). Browser band karke dobara kholne par ek baar "Backup Now" dabakar folder permission dein.</div>
        </>
      )}
    </div>
  );
};

export default LocalFolderPanel;
