import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { apiNotifications, apiNotifRead, apiNotifReadAll } from "../lib/api";

export const NotificationBell = () => {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const load = () => apiNotifications().then(setItems).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);
  const unread = items.filter((n) => !n.read).length;
  const go = async (n) => {
    setOpen(false);
    if (!n.read) await apiNotifRead(n.id).catch(() => {});
    load();
    nav(n.path || "/my-tasks");
  };
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button data-testid="notif-bell" onClick={() => setOpen((o) => !o)} className="hn-link" style={{ background: "transparent", cursor: "pointer", position: "relative" }} title="Notifications">
        <Bell size={16} />
        {unread > 0 && <span data-testid="notif-count" style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", borderRadius: 999, fontSize: 9.5, fontWeight: 900, padding: "1px 5px" }}>{unread}</span>}
      </button>
      {open && (
        <div data-testid="notif-panel" style={{ position: "absolute", right: 0, top: 34, width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 18px 40px -12px rgba(15,23,42,.35)", zIndex: 999 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}>
            <b style={{ fontSize: 12.5 }}>Notifications</b>
            <span style={{ display: "flex", gap: 8 }}>
              <button data-testid="notif-read-all" onClick={() => apiNotifReadAll().then(load)} style={{ fontSize: 10.5, color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Sab padh liya</button>
              <button data-testid="notif-open-tasks" onClick={() => { setOpen(false); nav("/my-tasks"); }} style={{ fontSize: 10.5, color: "#15803d", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>My Tasks</button>
            </span>
          </div>
          {!items.length && <div style={{ padding: 18, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>Koi notification nahi</div>}
          {items.map((n) => (
            <button key={n.id} data-testid={`notif-item-${n.id}`} onClick={() => go(n)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderBottom: "1px solid #f1f5f9", background: n.read ? "#fff" : "#eff6ff", cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: n.read ? 600 : 800 }}>{n.title}</div>
              <div style={{ fontSize: 10.5, color: "#475569", marginTop: 2 }}>{n.body}</div>
              <div style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 2 }}>{new Date(n.createdAt).toLocaleString("en-IN")}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
