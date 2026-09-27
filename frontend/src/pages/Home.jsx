import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { UserPlus, Trash2, ArrowRight, FileText, Receipt, ClipboardList } from "lucide-react";
import Header from "../components/Header";
import TopActionBar from "../components/TopActionBar";
import {
  getUsers, createUser, deleteUser, currentUserProfile, currentUser,
  getVendors, getBills,
} from "../lib/store";

const F = ({ label, children }) => (
  <div className="field-b"><label>{label}</label>{children}</div>
);

export default function Home() {
  const nav = useNavigate();
  const [uname, setUname] = useState("");
  const [uuser, setUuser] = useState("");
  const [upass, setUpass] = useState("");
  const [urole, setUrole] = useState("User");
  const [refresh, setRefresh] = useState(0);

  const users = useMemo(() => getUsers(), [refresh]);
  const vendors = useMemo(() => getVendors(), [refresh]);
  const bills = useMemo(() => getBills(), [refresh]);
  const me = currentUserProfile();
  const isAdmin = !me?.role || me?.role === "Admin";

  const approvedVendors = vendors.filter((v) => v.step === 3).length;
  const approvedBills = bills.filter((b) => b.step === 5).length;

  const handleSearch = () => {};
  const handleNew = () => { setUname(""); setUuser(""); setUpass(""); setUrole("User"); toast.success("Cleared user form"); };
  const handleSave = () => {
    try {
      createUser({ name: uname, username: uuser, password: upass, role: urole });
      setUname(""); setUuser(""); setUpass(""); setUrole("User");
      setRefresh((n) => n + 1);
      toast.success("User created successfully");
    } catch (e) { toast.error(e.message); }
  };
  const handlePrint = () => window.print();
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ users, vendors: vendors.length, bills: bills.length }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleExportExcel = () => toast.info("Use the Export on Final Processing page for full Excel report");

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="app-shell">
        <TopActionBar
          searchPlaceholder="Search users by name / username"
          onSearch={handleSearch}
          nextLabel="Vendor Reg"
          nextTo="/vendor"
          onNew={handleNew}
          onSave={handleSave}
          onPrint={handlePrint}
          onExportJSON={handleExportJSON}
          onExportExcel={handleExportExcel}
        />

        <div className="a4" data-testid="home-page">
          <Header formTitle="HOME · VENDOR MANAGEMENT &amp; BILL PROCESS" />

          {/* Welcome banner */}
          <div className="welcome" data-testid="welcome-banner">
            <div className="welcome-lead">Welcome To</div>
            <div className="welcome-title" data-testid="welcome-title">ARUN ENTERPRISES</div>
            <div className="welcome-sub">Vendor Management &amp; Bill Process</div>
            <div className="welcome-hint">
              A workflow-driven, paperless platform for vendor onboarding, bill processing,
              multi-stage approvals and payables — signed in as <b>{currentUser() || "admin"}</b>.
            </div>
          </div>

          {/* Quick nav tiles */}
          <div className="tiles" data-testid="quick-tiles">
            <button className="tile" onClick={() => nav("/vendor")} data-testid="tile-vendor">
              <FileText size={26} />
              <div className="t1">Page 1</div>
              <div className="t2">Vendor Registration</div>
              <div className="t3">{approvedVendors} approved</div>
              <div className="arrow"><ArrowRight size={14} /> Open</div>
            </button>
            <button className="tile" onClick={() => nav("/bill")} data-testid="tile-bill">
              <Receipt size={26} />
              <div className="t1">Page 2</div>
              <div className="t2">Bill Processing</div>
              <div className="t3">{approvedBills} approved</div>
              <div className="arrow"><ArrowRight size={14} /> Open</div>
            </button>
            <button className="tile" onClick={() => nav("/final")} data-testid="tile-final">
              <ClipboardList size={26} />
              <div className="t1">Page 3</div>
              <div className="t2">Final Processing</div>
              <div className="t3">Due list · Voucher</div>
              <div className="arrow"><ArrowRight size={14} /> Open</div>
            </button>
          </div>

          {/* System Users */}
          <div className="section">
            <div className="sec-head">System Users &amp; User Creation</div>
            <div className="sec-body">
              <div className="row cols-4" data-testid="user-create-row">
                <F label="Full Name">
                  <input value={uname} onChange={(e) => setUname(e.target.value)}
                    placeholder="e.g. Rahul Sharma" data-testid="user-name" />
                </F>
                <F label="Username">
                  <input value={uuser} onChange={(e) => setUuser(e.target.value)}
                    placeholder="e.g. rahul.sharma" data-testid="user-username" />
                </F>
                <F label="Password (min 4 chars)">
                  <input type="password" value={upass} onChange={(e) => setUpass(e.target.value)}
                    placeholder="••••••" data-testid="user-password" />
                </F>
                <F label="Role">
                  <select value={urole} onChange={(e) => setUrole(e.target.value)} data-testid="user-role">
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </F>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="btn-color btn-new" data-testid="user-create-btn" onClick={handleSave}>
                  <UserPlus size={14} /><span className="lbl">Create User</span>
                </button>
              </div>

              <table className="data-table" style={{ marginTop: 12 }} data-testid="users-table">
                <thead>
                  <tr>
                    <th>#</th><th>Full Name</th><th>Username</th><th>Role</th>
                    <th>Created</th><th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id} data-testid={`user-row-${u.username}`}>
                      <td>{i + 1}</td>
                      <td>{u.name}</td>
                      <td className="mono">{u.username}</td>
                      <td>
                        <span className={`pill-tag ${u.role === "Admin" ? "paid" : "due"}`}>{u.role}</span>
                      </td>
                      <td style={{ fontSize: 10.5, color: "#64748b" }}>{u.createdAt?.slice(0, 10)}</td>
                      <td style={{ textAlign: "right" }}>
                        {isAdmin && u.username !== "admin" && u.username !== me?.user && (
                          <button
                            className="btn-color btn-logo-remove"
                            data-testid={`user-delete-${u.username}`}
                            onClick={() => {
                              try { deleteUser(u.id); setRefresh((n) => n + 1); toast.success("User deleted"); }
                              catch (e) { toast.error(e.message); }
                            }}
                            title="Delete user"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 10.5, color: "#64748b", marginTop: 8 }}>
                Default admin (username: <b>admin</b>) is protected and cannot be deleted. Newly created users can log in immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
