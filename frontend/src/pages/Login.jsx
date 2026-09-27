import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/store";
import { Shield } from "lucide-react";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    if (login(u.trim(), p)) {
      nav("/home");
    } else {
      setErr("Invalid credentials. Use admin / admin@123");
    }
  };

  return (
    <div className="login-wrap" data-testid="login-page">
      <form className="login-card" onSubmit={submit}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#0b3d91" }}>
          <Shield />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: "#55617a" }}>ARUN ENTERPRISES</div>
            <h2 style={{ margin: 0 }}>Vendor Management</h2>
          </div>
        </div>
        <p className="hint">Sign in with your administrator credentials to continue.</p>
        <label>Username</label>
        <input data-testid="login-username" value={u} onChange={(e) => setU(e.target.value)} placeholder="admin" autoFocus />
        <label>Password</label>
        <input data-testid="login-password" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" />
        {err && <div className="err" data-testid="login-error">{err}</div>}
        <div style={{ marginTop: 16 }}>
          <button className="btn solid" style={{ width: "100%", justifyContent: "center" }} data-testid="login-submit">
            Sign in
          </button>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Default: <b>admin</b> / <b>admin@123</b></p>
      </form>
    </div>
  );
}
