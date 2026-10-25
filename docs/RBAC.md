# RBAC — Arun Enterprises ERP (10. System Management → Permissions)

## 1. Database Schema (MongoDB `settings` collection, document `{key: "acl"}`)
```json
{
  "key": "acl",
  "value": {
    "<Role>": { "<dept>": { "v": true, "c": true, "e": true, "d": false, "a": false } },
    "_users":    { "<email>": { "<dept>": { "d": true } } },
    "_mask":     { "<Role>": ["card:kpi-receivable", "col:Net Payable"] },
    "_userMask": { "<email>": ["col:TDS"] }
  },
  "updated_by": "superadmin email",
  "updated_at": "ISO datetime"
}
```
- Roles: Admin, GM, Purchase, Accounts, Viewer, User (SuperAdmin is fixed by email and always has full access).
- Depts (10 sidebar modules): gm, client, hr, procurement, accounts, site, qc, plant, reports, admin.
- Ops: v = View (module visible in sidebar + route), c = Create/Save/Submit, e = Edit, d = Delete, a = Approve/Reject (e.g. GM Approved).
- Defaults when a cell is not saved: v = true (gm: Admin/GM only), c/e = everyone except Viewer, d/a = Admin only.
- Resolution order: default → role cell → `_users[email][dept]` override (only the ops set there).
- Masking: `_userMask[email]` (if present) replaces the role's `_mask[role]` list.

## 2. Backend Middleware (`backend/server.py`)
- `_acl_default(role, dept, op)` – default table above.
- `_acl_ok(user, dept, op)` – merges role cell + user override; SuperAdmin always true.
- `_rbac(user, dept, op)` – raises HTTP 403 when not allowed.
- `_need(dept, op)` – FastAPI dependency, used on delete routes (vendors, bills, payments, employees, fooding, expenses, boqs, work_orders).
- Enforced on: `POST /api/crm/{name}` (c/e + a for approvals), `DELETE /api/crm/...` (d), `POST /api/ops/{kind}` (c/e + a), `DELETE /api/ops/...` (d), legacy upserts via `_acl_guard` (c/e/a), HR CRUD deletes (d).
- `GET/POST /api/settings/acl` – read (any user) / write (SuperAdmin only).

## 3. Frontend Permission Controller
- `frontend/src/lib/acl.js` – `can(dept, op)`, `aclCell`, `maskedKeys()`, `MASK_ITEMS`, `loadAcl()` (cached in localStorage, refreshed on every route change).
- `frontend/src/lib/store.js` – `canCreate / canEdit / canDelete / canApprove` use the ACL of the current page's module.
- Route guard: `AclGate` in `AppSidebar.jsx` blocks a module page without View; sidebar hides modules without View (GM shows "Not Permitted").
- Buttons: `CrmActionBar` (New/Save/Edit/Submit/Approve/Delete), `OpsModule`, `Abstract`, legacy pages through store helpers.
- Masking + date display: `frontend/src/lib/displayEngine.js` hides masked cards (by data-testid) and table columns (by header text) in screens and print windows, and shows all dates as DD/MM/YYYY.
- Date entry: `frontend/src/components/DateInput.jsx` (DD/MM/YYYY box + calendar, stores YYYY-MM-DD).
- Admin UI: `frontend/src/components/AclMatrix.jsx` – A. role matrix, B. user override, C. card/column masking.
