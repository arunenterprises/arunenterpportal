import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Monitor, BarChart3 } from "lucide-react";
import { apiNewSyncKey, apiSyncReport } from "../lib/api";

const PS1 = (url, key) => `$ErrorActionPreference = "Stop"
$Url = "${url}/api/sync-agent/backup"
$Key = "${key}"
$Root = Join-Path $PSScriptRoot "ARUN_ERP_DATA"
$Latest = Join-Path $Root "latest"; $Hist = Join-Path $Root "history"; $Daily = Join-Path $Root "daily_sync"
New-Item -ItemType Directory -Force -Path $Latest, $Hist, $Daily | Out-Null
$Day = Get-Date -Format "yyyy-MM-dd"
$Tmp = Join-Path $env:TEMP "arun_erp_sync.json"
try {
  Invoke-WebRequest -Uri $Url -Headers @{ "X-Sync-Key" = $Key } -OutFile $Tmp -UseBasicParsing -TimeoutSec 600
  Copy-Item $Tmp (Join-Path $Hist "ERP_Backup_$Day.json") -Force
  $J = Get-Content $Tmp -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($P in $J.collections.PSObject.Properties) { ConvertTo-Json -InputObject @($P.Value) -Depth 30 | Set-Content (Join-Path $Latest "$($P.Name).json") -Encoding UTF8 }
  if ([int](Get-Date -Format HH) -ge 22 -and -not (Test-Path (Join-Path $Daily "Daily_Sync_$Day*.json"))) { Copy-Item $Tmp (Join-Path $Daily ("Daily_Sync_{0}_{1}.json" -f $Day, (Get-Date -Format HHmm))) }
  Add-Content (Join-Path $Root "sync_log.txt") "$(Get-Date) OK"
} catch { Add-Content (Join-Path $Root "sync_log.txt") "$(Get-Date) ERROR $_" }
`;

const BAT = `@echo off
schtasks /Create /F /TN "ARUN_ERP_Sync" /SC MINUTE /MO 30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \\"%~dp0ERP_Sync.ps1\\""
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ERP_Sync.ps1"
echo.
echo ARUN ERP Sync install ho gaya. Har 30 minute par data is folder ke ARUN_ERP_DATA mein save hoga.
pause
`;

const dl = (name, text) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text.replace(/\n/g, "\r\n")], { type: "text/plain" }));
  a.download = name;
  a.click();
};

const btn = (bg) => ({ padding: "8px 14px", background: bg, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 });

export const DesktopSyncDownload = () => {
  const get = async () => {
    if (!window.confirm("Naya Sync App banega. Purana Sync App (agar install hai) band ho jayega. Aage badhein?")) return;
    try {
      const { sync_key } = await apiNewSyncKey();
      dl("ERP_Sync.ps1", PS1(window.location.origin, sync_key));
      setTimeout(() => dl("Install_ERP_Sync.bat", BAT), 600);
      toast.success("2 files download hui — dono ko ek folder (jaise D:\\ERP_DATA) mein rakh kar Install_ERP_Sync.bat chalayein");
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div data-testid="desktop-sync-box" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #0f766e" }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: "#0f766e", display: "flex", alignItems: "center", gap: 6 }}><Monitor size={16} /> Desktop Sync App (ERP band ho tab bhi)</div>
      <div style={{ fontSize: 12, color: "#334155", margin: "4px 0 8px", lineHeight: 1.5 }}>
        Download karein → dono files ek folder (jaise <b>D:\ERP_DATA</b>) mein rakhein → <b>Install_ERP_Sync.bat</b> par double-click. Computer on rahega to har 30 minute sabhi users ka data <b>ARUN_ERP_DATA</b> mein save hoga, raat 10 baje ke baad roz ki <b>daily_sync</b> file banegi. Windows computer ke liye.
      </div>
      <button data-testid="desktop-sync-download" onClick={get} style={btn("#0f766e")}><Monitor size={14} /> Sync App Download</button>
    </div>
  );
};

export const DailySyncReport = () => {
  const [d, setD] = useState(null);
  useEffect(() => { apiSyncReport().then(setD).catch(() => setD({ items: [], labels: {} })); }, []);
  if (!d) return null;
  const keys = Object.keys(d.labels || {});
  return (
    <div data-testid="daily-sync-report" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #0f766e" }}>
      <div style={{ fontWeight: 900, fontSize: 13, color: "#0f766e", display: "flex", alignItems: "center", gap: 6 }}><BarChart3 size={16} /> Daily Sync Report (us din naye records)</div>
      {!d.items.length ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Abhi tak koi sync nahi hua.</div> : (
        <div style={{ overflowX: "auto", marginTop: 6 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead><tr>{["Date", ...keys.map((k) => d.labels[k])].map((h) => <th key={h} style={{ border: "1px solid #99f6e4", padding: "4px 8px", background: "#ccfbf1", textAlign: "left" }}>{h}</th>)}</tr></thead>
            <tbody>{d.items.map((r) => (
              <tr key={r.date} data-testid={`sync-report-row-${r.date}`}>
                <td style={{ border: "1px solid #99f6e4", padding: "4px 8px", fontWeight: 700 }}>{r.date}</td>
                {keys.map((k) => <td key={k} style={{ border: "1px solid #99f6e4", padding: "4px 8px" }}>{r.new?.[k] == null ? `${r.counts[k]} total` : `+${r.new[k]}`} </td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};
