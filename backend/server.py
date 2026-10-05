"""Vendor Management Backend — FastAPI + MongoDB + JWT auth.

Provides:
- Auth: register / login / me
- CRUD for vendors, bills, payments (cross-device sync)
- Counters (serial vendor/bill/pv numbers)
- Company logo storage
"""
from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body, BackgroundTasks, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import logging
import hmac
import secrets as _secrets
import re
import ipaddress
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

from auth_utils import (
    hash_password, verify_password, create_access_token,
    decode_token, extract_token,
)

# ---- MongoDB connection ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- App & Router ----
app = FastAPI(title="Vendor Management API")
api_router = APIRouter(prefix="/api")

# ---- Logging ----
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ==================== AUTH DEPENDENCY ====================
async def get_current_user(request: Request) -> Dict[str, Any]:
    token = extract_token(request)
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"email": payload.get("email")})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


async def require_admin(user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    if (user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def require_super_admin(user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Only the primary admin (env ADMIN_EMAIL) can perform destructive/global actions."""
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    email = (user.get("email") or "").lower().strip()
    if not primary or email != primary:
        raise HTTPException(status_code=403, detail="Super Admin access required (primary admin only)")
    return user


# ==================== BUSINESS RBAC (SEC-001 / SEC-002) ====================
# Server-side enforcement so a logged-in low-privilege user cannot bypass the UI
# gates by calling the API directly to self-approve financial workflows.

def _is_super_admin(user: Dict) -> bool:
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    return bool(primary) and (user.get("email") or "").lower().strip() == primary


def _can_create(user: Dict) -> bool:
    if _is_super_admin(user):
        return True
    perms = user.get("permissions") or {}
    return bool(perms.get("create") or perms.get("edit") or perms.get("submit") or perms.get("approve"))


def _can_approve(user: Dict) -> bool:
    if _is_super_admin(user):
        return True
    perms = user.get("permissions") or {}
    return bool(perms.get("approve"))


async def require_write(user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    if not _can_create(user):
        raise HTTPException(status_code=403, detail="Create / edit permission required")
    return user


async def require_approver(user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    if not _can_approve(user):
        raise HTTPException(status_code=403, detail="Approver role required (Admin / Accounts / SuperAdmin)")
    return user


# Fields that the server authoritatively owns — client-supplied values are
# discarded and the server stamps them based on the actual workflow transition
# and the authenticated user. Prevents forged approver names / timestamps.
_SERVER_OWNED_FIELDS = (
    "approvedByName", "approvedAt",
    "submittedByName", "submittedAt",
    "settledByName", "settledAt",
    "rejectedByName", "rejectedAt",
    "disbursedByName", "disbursedAt",
    "paidByName", "paidAt",
)


async def _enforce_workflow(coll: str, body: Dict, user: Dict, step_field: str = "step") -> Dict:
    """For paybills / advance_requests / loans / bills: validate step/status
    transition on the server, require approver for forward transitions, strip
    server-owned fields and stamp them from the authenticated user."""
    rid = body.get("id")
    existing = await db[coll].find_one({"id": rid}, {"_id": 0}) if rid else None
    try:
        old_step = int((existing or {}).get(step_field, 1) or 1)
    except (TypeError, ValueError):
        old_step = 1
    try:
        new_step = int(body.get(step_field, old_step))
    except (TypeError, ValueError):
        new_step = old_step
    # Strip any client-supplied privileged fields — server authors these
    for f in _SERVER_OWNED_FIELDS:
        body.pop(f, None)
    # Preserve already-stamped values from the existing record so they don't
    # get wiped when the user upserts the same step (e.g. UTR edit on settled)
    if existing:
        for f in _SERVER_OWNED_FIELDS:
            if existing.get(f) is not None:
                body[f] = existing[f]
    # Permission check: new drafts need write perm, forward transitions need approve
    if new_step > old_step:
        if not _can_approve(user):
            raise HTTPException(
                status_code=403,
                detail=f"Approver role required to transition {step_field} {old_step} → {new_step}",
            )
    else:
        if not _can_create(user):
            raise HTTPException(status_code=403, detail="Create / edit permission required")
    # Stamp server-owned fields based on the transition
    me_name = user.get("name") or user.get("email") or "Unknown"
    now_iso = datetime.now(timezone.utc).isoformat()
    if new_step > old_step:
        if new_step == 2:
            body["submittedByName"] = me_name
            body["submittedAt"] = now_iso
        elif new_step == 3:
            body["approvedByName"] = me_name
            body["approvedAt"] = now_iso
        elif new_step == 4:
            body["settledByName"] = me_name
            body["settledAt"] = now_iso
        elif new_step == 5:
            body["paidByName"] = me_name
            body["paidAt"] = now_iso
    return body


# ==================== AUTH MODELS ====================
class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "User"
    mobile: str = ""
    employee_id: str = ""
    designation: str = ""


class LoginBody(BaseModel):
    identifier: str  # email or username
    password: str


# ==================== AUTH ROUTES ====================
@api_router.post("/auth/register")
async def register(body: RegisterBody, admin: Dict = Depends(require_admin)):
    """Admin-only: register new employees. Public registration is disabled."""
    email = body.email.lower().strip()
    password = body.password.strip()
    name = body.name.strip()
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    role = "Admin" if body.role.lower() == "admin" else "User"
    doc = {
        "email": email,
        "name": name,
        "role": role,
        "mobile": (body.mobile or "").strip(),
        "employee_id": (body.employee_id or "").strip(),
        "designation": (body.designation or "").strip(),
        "password_hash": hash_password(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email"),
    }
    await db.users.insert_one(doc)
    return {
        "user": {
            "email": email, "name": name, "role": role,
            "mobile": doc["mobile"], "employee_id": doc["employee_id"], "designation": doc["designation"],
        },
    }


# ---- Users Management (admin-only) ----
@api_router.get("/users")
async def list_users(admin: Dict = Depends(require_admin)):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return items


@api_router.delete("/users/{email}")
async def delete_user(email: str, admin: Dict = Depends(require_admin)):
    email = email.lower().strip()
    if email == (admin.get("email") or "").lower():
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if email == os.environ.get("ADMIN_EMAIL", "").lower():
        raise HTTPException(status_code=400, detail="Primary admin account cannot be deleted")
    r = await db.users.delete_one({"email": email})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"deleted": r.deleted_count}


class ChangePasswordBody(BaseModel):
    new_password: str
    old_password: Optional[str] = None
    email: Optional[str] = None  # admin can change any user's password; user can change own


@api_router.post("/users/change-password")
async def change_password(body: ChangePasswordBody, user: Dict = Depends(get_current_user)):
    new_pass = (body.new_password or "").strip()
    if len(new_pass) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    target_email = (body.email or user["email"]).lower().strip()
    is_self = target_email == user["email"]
    is_admin = (user.get("role") or "").lower() == "admin"
    primary_admin = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    is_super_admin = bool(primary_admin) and (user.get("email") or "").lower().strip() == primary_admin
    # Cross-user password change is restricted to the Super Admin
    if not is_self and not is_super_admin:
        raise HTTPException(status_code=403, detail="Only Super Admin can change another user's password")
    # If changing own password, verify current (old) password
    if is_self:
        old = (body.old_password or "").strip()
        if not old:
            raise HTTPException(status_code=400, detail="Current password is required")
        target = await db.users.find_one({"email": target_email})
        if not target or not verify_password(old, target.get("password_hash", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    r = await db.users.update_one({"email": target_email}, {"$set": {"password_hash": hash_password(new_pass)}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "email": target_email}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    ident = body.identifier.lower().strip()
    password = body.password.strip()
    user = await db.users.find_one({"email": ident})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["email"], user["email"])
    perms = user.get("permissions") or _role_default_perms(user.get("role"))
    # SuperAdmin always gets full permissions
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    if primary and user["email"].lower().strip() == primary:
        perms = {"create": True, "edit": True, "submit": True, "approve": True}
    return {
        "token": token,
        "user": {
            "email": user["email"], "name": user["name"], "role": user["role"],
            "permissions": perms,
        },
    }


# ---- Per-user permission override (Super Admin only) ----
class PermsBody(BaseModel):
    create: Optional[bool] = None
    edit: Optional[bool] = None
    submit: Optional[bool] = None
    approve: Optional[bool] = None


def _role_default_perms(role: Optional[str]) -> Dict[str, bool]:
    r = (role or "User").strip()
    if r in ("Admin", "GM"):
        return {"create": True, "edit": True, "submit": True, "approve": True}
    if r in ("Purchase", "Accounts", "User"):
        return {"create": True, "edit": True, "submit": True, "approve": False}
    if r == "Viewer":
        return {"create": False, "edit": False, "submit": False, "approve": False}
    return {"create": True, "edit": True, "submit": True, "approve": False}


@api_router.patch("/users/{email}/permissions")
async def update_user_permissions(email: str, body: PermsBody, admin: Dict = Depends(require_super_admin)):
    email = email.lower().strip()
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    if email == primary:
        raise HTTPException(status_code=400, detail="Super Admin permissions cannot be modified")
    target = await db.users.find_one({"email": email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    current = dict(target.get("permissions") or _role_default_perms(target.get("role")))
    for k in ("create", "edit", "submit", "approve"):
        v = getattr(body, k)
        if v is not None:
            current[k] = bool(v)
    await db.users.update_one({"email": email}, {"$set": {"permissions": current}})
    return {"ok": True, "email": email, "permissions": current}


class RoleBody(BaseModel):
    role: str


@api_router.patch("/users/{email}/role")
async def update_user_role(email: str, body: RoleBody, admin: Dict = Depends(require_super_admin)):
    """Change a user's role. SuperAdmin only. Primary ADMIN_EMAIL role is locked."""
    email = email.lower().strip()
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    if email == primary:
        raise HTTPException(status_code=400, detail="Primary SuperAdmin role is locked")
    allowed_roles = ["User", "Admin", "Accounts", "GM", "HR", "Viewer"]
    new_role = (body.role or "").strip()
    if new_role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {allowed_roles}")
    target = await db.users.find_one({"email": email})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Reset perms to role defaults when role changes so stale per-user overrides don't persist
    new_perms = _role_default_perms(new_role)
    await db.users.update_one({"email": email}, {"$set": {"role": new_role, "permissions": new_perms}})
    return {"ok": True, "email": email, "role": new_role, "permissions": new_perms}


@api_router.get("/auth/me")
async def me(user: Dict = Depends(get_current_user)):
    return user


# ==================== GENERIC CRUD HELPERS ====================
def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _list_collection(coll: str) -> List[dict]:
    items = await db[coll].find({}, {"_id": 0}).to_list(5000)
    return items


async def _replace_collection(coll: str, items: List[dict]) -> int:
    await db[coll].delete_many({})
    if items:
        await db[coll].insert_many([dict(it) for it in items])
    return len(items)


# ==================== VENDORS ====================
@api_router.get("/vendors")
async def list_vendors(user: Dict = Depends(get_current_user)):
    return await _list_collection("vendors")


@api_router.post("/vendors")
async def upsert_vendor(body: Dict = Body(...), user: Dict = Depends(require_write)):
    vid = body.get("id")
    if not vid:
        raise HTTPException(status_code=400, detail="id required")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.vendors.update_one({"id": vid}, {"$set": body}, upsert=True)
    return _clean(body)


@api_router.delete("/vendors/{vid}")
async def delete_vendor(vid: str, admin: Dict = Depends(require_admin)):
    r = await db.vendors.delete_one({"id": vid})
    return {"deleted": r.deleted_count}


# ==================== BILLS ====================
@api_router.get("/bills")
async def list_bills(user: Dict = Depends(get_current_user)):
    return await _list_collection("bills")


@api_router.post("/bills")
async def upsert_bill(body: Dict = Body(...), user: Dict = Depends(require_write)):
    bid = body.get("id")
    if not bid:
        raise HTTPException(status_code=400, detail="id required")
    body = await _enforce_workflow("bills", body, user, step_field="step")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bills.update_one({"id": bid}, {"$set": body}, upsert=True)
    return _clean(body)


@api_router.delete("/bills/{bid}")
async def delete_bill(bid: str, admin: Dict = Depends(require_admin)):
    r = await db.bills.delete_one({"id": bid})
    return {"deleted": r.deleted_count}


# ==================== PAYMENTS ====================
@api_router.get("/payments")
async def list_payments(user: Dict = Depends(get_current_user)):
    return await _list_collection("payments")


@api_router.post("/payments/bulk")
async def replace_payments(body: Dict = Body(...), user: Dict = Depends(require_approver)):
    """SEC-002 FIX: per-id upsert (approver only). The old blanket delete-and-
    insert flow allowed any logged-in user to wipe the full payments ledger."""
    items = body.get("items") or []
    count = 0
    for p in items:
        pid = p.get("id") or p.get("pvNo")
        if not pid:
            continue
        key = {"id": pid} if p.get("id") else {"pvNo": p.get("pvNo")}
        await db.payments.update_one(key, {"$set": p}, upsert=True)
        count += 1
    return {"count": count}


@api_router.delete("/payments/{pvNo:path}")
async def delete_payment(pvNo: str, admin: Dict = Depends(require_admin)):
    """DELETE a payment voucher by pvNo. Admin / SuperAdmin only.
    Prevents the 'zombie resurrection' bug where deleted vouchers were only
    removed client-side and resurfaced on next cross-device cloud sync."""
    # pvNo contains slashes (e.g. GPV/2627/0001) so use :path converter.
    r = await db.payments.delete_many({"pvNo": pvNo})
    return {"ok": True, "deleted": r.deleted_count}


@api_router.post("/payments/delete_bulk")
async def delete_payments_bulk(body: Dict = Body(...), admin: Dict = Depends(require_admin)):
    """Bulk DELETE payment vouchers by pvNo list. Used for GPV→PN rename cleanup."""
    pv_nos = body.get("pvNos") or []
    if not pv_nos:
        return {"ok": True, "deleted": 0}
    r = await db.payments.delete_many({"pvNo": {"$in": pv_nos}})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== COUNTERS ====================
@api_router.get("/counters")
async def get_counters(user: Dict = Depends(get_current_user)):
    c = await db.counters.find_one({"key": "global"}, {"_id": 0})
    return c or {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0}


@api_router.post("/counters")
async def set_counters(body: Dict = Body(...), user: Dict = Depends(require_write)):
    body["key"] = "global"
    await db.counters.update_one({"key": "global"}, {"$set": body}, upsert=True)
    return body


# ==================== LOGO ====================
@api_router.get("/logo")
async def get_logo(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "logo"}, {"_id": 0})
    return {"logo": (doc or {}).get("value", "")}


@api_router.post("/logo")
async def set_logo(body: Dict = Body(...), user: Dict = Depends(require_write)):
    await db.settings.update_one({"key": "logo"}, {"$set": {"value": body.get("logo", "")}}, upsert=True)
    return {"ok": True}


# ==================== EMPLOYEES (HR) ====================
@api_router.get("/employees")
async def list_employees(user: Dict = Depends(get_current_user)):
    return await _list_collection("employees")


@api_router.post("/employees")
async def upsert_employee(body: Dict = Body(...), user: Dict = Depends(require_write)):
    eid = body.get("id")
    if not eid:
        raise HTTPException(status_code=400, detail="id required")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.employees.update_one({"id": eid}, {"$set": body}, upsert=True)
    return _clean(body)


@api_router.delete("/employees/{eid}")
async def delete_employee(eid: str, admin: Dict = Depends(require_admin)):
    r = await db.employees.delete_one({"id": eid})
    return {"deleted": r.deleted_count}


# ==================== ATTENDANCE (HR) ====================
@api_router.get("/attendance")
async def list_attendance(user: Dict = Depends(get_current_user)):
    return await _list_collection("attendance")


@api_router.post("/attendance")
async def upsert_attendance(body: Dict = Body(...), user: Dict = Depends(require_write)):
    aid = body.get("id")
    if not aid:
        raise HTTPException(status_code=400, detail="id required")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.attendance.update_one({"id": aid}, {"$set": body}, upsert=True)
    return _clean(body)


# ==================== SNAPSHOT (full sync) ====================
@api_router.get("/snapshot")
async def snapshot(user: Dict = Depends(get_current_user)):
    return {
        "vendors": await _list_collection("vendors"),
        "bills": await _list_collection("bills"),
        "payments": await _list_collection("payments"),
        "expenses": await _list_collection("expenses"),
        "boqs": await _list_collection("boqs"),
        "work_orders": await _list_collection("work_orders"),
        "employees": await _list_collection("employees"),
        "attendance": await _list_collection("attendance"),
        "paybills": await _list_collection("paybills"),
        "loans": await _list_collection("loans"),
        "advance_requests": await _list_collection("advance_requests"),
        "recruitments": await _list_collection("recruitments"),
        "exits": await _list_collection("exits"),
        "counters": (await db.counters.find_one({"key": "global"}, {"_id": 0})) or {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0, "expenseSerial": 0, "boqSerial": 0, "woSerial": 0, "empSerial": 0, "adsSerial": 0},
        "logo": ((await db.settings.find_one({"key": "logo"}, {"_id": 0})) or {}).get("value", ""),
    }


@api_router.post("/snapshot")
async def push_snapshot(body: Dict = Body(...), user: Dict = Depends(require_approver)):
    """One-shot migration/push of the client's full state to the cloud.
    SEC-002 FIX: Approver-only + per-id upsert for payments (no blanket replace)."""
    vendors = body.get("vendors", [])
    bills = body.get("bills", [])
    payments = body.get("payments", [])
    expenses = body.get("expenses", [])
    paybills = body.get("paybills", [])
    loans = body.get("loans", [])
    advance_requests = body.get("advance_requests", [])
    recruitments = body.get("recruitments", [])
    exits_ = body.get("exits", [])
    counters = body.get("counters", {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0, "expenseSerial": 0})
    logo = body.get("logo", "")
    # Merge (upsert by id) instead of replace, to avoid data loss across devices
    for v in vendors:
        if v.get("id"):
            await db.vendors.update_one({"id": v["id"]}, {"$set": v}, upsert=True)
    for b in bills:
        if b.get("id"):
            await db.bills.update_one({"id": b["id"]}, {"$set": b}, upsert=True)
    for x in expenses:
        if x.get("id"):
            await db.expenses.update_one({"id": x["id"]}, {"$set": x}, upsert=True)
    for pb in paybills:
        if pb.get("id"):
            await db.paybills.update_one({"id": pb["id"]}, {"$set": pb}, upsert=True)
    for ln in loans:
        if ln.get("id"):
            await db.loans.update_one({"id": ln["id"]}, {"$set": ln}, upsert=True)
    for ar in advance_requests:
        if ar.get("id"):
            await db.advance_requests.update_one({"id": ar["id"]}, {"$set": ar}, upsert=True)
    for rc in recruitments:
        if rc.get("id"):
            await db.recruitments.update_one({"id": rc["id"]}, {"$set": rc}, upsert=True)
    for ex in exits_:
        if ex.get("id"):
            await db.exits.update_one({"id": ex["id"]}, {"$set": ex}, upsert=True)
    if payments:
        for p in payments:
            pid = p.get("id") or p.get("pvNo")
            if not pid:
                continue
            key = {"id": pid} if p.get("id") else {"pvNo": p.get("pvNo")}
            await db.payments.update_one(key, {"$set": p}, upsert=True)
    counters["key"] = "global"
    await db.counters.update_one({"key": "global"}, {"$set": counters}, upsert=True)
    if logo:
        await db.settings.update_one({"key": "logo"}, {"$set": {"value": logo}}, upsert=True)
    return {
        "vendors": len(vendors), "bills": len(bills), "payments": len(payments), "expenses": len(expenses),
        "paybills": len(paybills), "loans": len(loans), "advance_requests": len(advance_requests),
        "recruitments": len(recruitments), "exits": len(exits_),
    }


# ==================== HR: PAY BILLS / LOANS / ADVANCES / RECRUIT / EXITS ====================
def _make_hr_crud(coll_name: str, path: str, step_field: str = "step"):
    """Create generic get/upsert/delete endpoints for an HR collection.
    SEC-001 FIX: upsert runs through _enforce_workflow — the server validates
    step/status transitions, requires the approver role to move past step 1,
    and stamps server-owned fields (approvedByName / approvedAt / etc.)."""
    @api_router.get(f"/{path}")
    async def _list(user: Dict = Depends(get_current_user)):
        return await _list_collection(coll_name)
    @api_router.post(f"/{path}")
    async def _upsert(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
        rid = body.get("id")
        if not rid:
            raise HTTPException(status_code=400, detail="id required")
        body = await _enforce_workflow(coll_name, body, user, step_field=step_field)
        await db[coll_name].update_one({"id": rid}, {"$set": body}, upsert=True)
        return {"ok": True, "id": rid}
    @api_router.delete(f"/{path}/{{rid}}")
    async def _delete(rid: str, admin: Dict = Depends(require_admin)):
        r = await db[coll_name].delete_one({"id": rid})
        return {"ok": True, "deleted": r.deleted_count}
    return _list, _upsert, _delete

# Register endpoints for all 5 HR collections (paybills + loans use `step`,
# advance_requests uses `status`, recruitments + exits use `step`)
_make_hr_crud("paybills", "paybills", step_field="step")
_make_hr_crud("loans", "loans", step_field="status")
_make_hr_crud("advance_requests", "advance_requests", step_field="status")
_make_hr_crud("recruitments", "recruitments", step_field="step")
_make_hr_crud("exits", "exits", step_field="step")


# ==================== EXPENSES (single-record upsert) ====================
@api_router.post("/expenses")
async def upsert_expense(body: Dict = Body(...), user: Dict = Depends(require_write)):
    xid = body.get("id")
    if not xid:
        raise HTTPException(status_code=400, detail="id is required")
    await db.expenses.update_one({"id": xid}, {"$set": body}, upsert=True)
    return {"ok": True, "id": xid}


@api_router.delete("/expenses/{xid}")
async def delete_expense(xid: str, admin: Dict = Depends(require_admin)):
    r = await db.expenses.delete_one({"id": xid})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== BOQs (Purchase Management — Bill of Quantity) ====================
@api_router.get("/boqs")
async def list_boqs(user: Dict = Depends(get_current_user)):
    return await _list_collection("boqs")


@api_router.post("/boqs")
async def upsert_boq(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    bid = body.get("id")
    if not bid:
        raise HTTPException(status_code=400, detail="id is required")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.boqs.update_one({"id": bid}, {"$set": body}, upsert=True)
    return {"ok": True, "id": bid}


@api_router.delete("/boqs/{bid}")
async def delete_boq(bid: str, admin: Dict = Depends(require_admin)):
    r = await db.boqs.delete_one({"id": bid})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== WORK ORDERS (Purchase Management) ====================
@api_router.get("/work_orders")
async def list_wos(user: Dict = Depends(get_current_user)):
    return await _list_collection("work_orders")


@api_router.post("/work_orders")
async def upsert_wo(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    wid = body.get("id")
    if not wid:
        raise HTTPException(status_code=400, detail="id is required")
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.work_orders.update_one({"id": wid}, {"$set": body}, upsert=True)
    return {"ok": True, "id": wid}


@api_router.delete("/work_orders/{wid}")
async def delete_wo(wid: str, admin: Dict = Depends(require_admin)):
    r = await db.work_orders.delete_one({"id": wid})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== PUBLIC CAREERS / ADVERTISEMENT PORTAL ====================
# Public read-only list of GM-approved recruitment requisitions (status >= 3, < 5).
# Candidates view & apply via email — no auth required.
@api_router.get("/public/recruitments")
async def public_list_recruitments():
    cursor = db.recruitments.find({"status": {"$gte": 3}}, {"_id": 0})
    out = []
    async for d in cursor:
        if int(d.get("status", 1)) >= 5:
            continue  # skip joined/closed
        out.append({
            "id": d.get("id"),
            "advertisementNo": d.get("advertisementNo", ""),
            "position": d.get("position", ""),
            "department": d.get("department", ""),
            "vacancies": d.get("vacancies", 1),
            "qualificationRequired": d.get("qualificationRequired", ""),
            "experienceRequired": d.get("experienceRequired", ""),
            "budgetCTC": d.get("budgetCTC", 0),
            "targetJoinDate": d.get("targetJoinDate", ""),
            "reasonForHire": d.get("reasonForHire", ""),
            "gmApprovedAt": d.get("gmApprovedAt", ""),
            "requisitionDate": d.get("requisitionDate", ""),
        })
    return out


# ==================== PUBLIC VENDOR PORTAL ====================
# Public read-only access for approved + published Work Orders. No auth required
# because vendors receive a direct share-link and should not need an account.
@api_router.get("/public/work_orders/{wo_id}")
async def public_get_wo(wo_id: str):
    doc = await db.work_orders.find_one({"id": wo_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Work Order not found")
    if not doc.get("vendorPortalPublished"):
        raise HTTPException(status_code=403, detail="This Work Order has not been published to the vendor portal yet")
    wo = _clean(doc)
    # Attach a lightweight vendor snapshot (public-safe fields only) if we have it
    vendor_code = wo.get("vendorCode")
    if vendor_code:
        v = await db.vendors.find_one({"vendorCode": vendor_code})
        if v:
            wo["vendor"] = {
                "firmName": v.get("firmName") or "",
                "vendorCode": v.get("vendorCode") or "",
                "gstNo": v.get("gstNo") or "",
                "contactPerson": v.get("contactPerson") or "",
                "mobile": v.get("mobile") or "",
            }
    return wo


# ==================== DANGER ZONE: RESET ALL DATA ====================
@api_router.post("/admin/reset-data")
async def reset_all_data(body: Dict = Body(default={}), admin: Dict = Depends(require_super_admin)):
    """Admin-only: wipe all business data (vendors, bills, payments, counters, logo).
    Optionally also wipe non-admin users when `wipe_users` is true.
    The primary admin account is always preserved.
    """
    wipe_users = bool(body.get("wipe_users", False))
    v = await db.vendors.delete_many({})
    b = await db.bills.delete_many({})
    p = await db.payments.delete_many({})
    x = await db.expenses.delete_many({})
    c = await db.counters.delete_many({})
    logo = await db.settings.delete_many({"key": "logo"})
    users_removed = 0
    if wipe_users:
        admin_email = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
        # Keep primary admin + the caller (in case caller is a different admin)
        keep = {e for e in [admin_email, (admin.get("email") or "").lower()] if e}
        r = await db.users.delete_many({"email": {"$nin": list(keep)}})
        users_removed = r.deleted_count
    return {
        "ok": True,
        "vendors": v.deleted_count,
        "bills": b.deleted_count,
        "payments": p.deleted_count,
        "expenses": x.deleted_count,
        "counters": c.deleted_count,
        "logo": logo.deleted_count,
        "users_removed": users_removed,
    }


@api_router.post("/admin/reset-hr-financials")
async def reset_hr_financials(admin: Dict = Depends(require_super_admin)):
    """Admin-only: wipe HR financial docs ONLY — pay bills, advance requests, and
    HR-generated payment vouchers (PV/HR/* and PV/ADV/*). Employees, leaves, loans,
    recruitments, exits, vendors, vendor bills — all PRESERVED.
    """
    pb = await db.paybills.delete_many({})
    ar = await db.advance_requests.delete_many({})
    pv = await db.payments.delete_many({"$or": [
        {"pvNo": {"$regex": "^PV/HR/"}},
        {"pvNo": {"$regex": "^PV/ADV/"}},
        {"pvNo": {"$regex": "^PV/HR-FNF/"}},
    ]})
    return {
        "ok": True,
        "paybills_removed": pb.deleted_count,
        "advance_requests_removed": ar.deleted_count,
        "hr_payment_vouchers_removed": pv.deleted_count,
    }


# ==================== BACKUP & RESTORE ====================
# Full database backup (JSON) — SuperAdmin only. Includes every business
# collection so an identical copy can be restored on any MongoDB (Atlas / local).

BACKUP_COLLECTIONS = [
    "users", "vendors", "bills", "payments", "expenses", "boqs", "work_orders",
    "employees", "attendance", "paybills", "loans", "advance_requests",
    "recruitments", "exits", "counters", "settings",
]


@api_router.get("/admin/backup")
async def download_backup(admin: Dict = Depends(require_super_admin)):
    """Return a full JSON snapshot of every business collection.
    Password hashes are preserved so restored users can keep logging in."""
    payload: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "db_name": os.environ.get("DB_NAME", ""),
        "version": 1,
        "collections": {},
    }
    for coll in BACKUP_COLLECTIONS:
        docs = await db[coll].find({}, {"_id": 0}).to_list(100000)
        payload["collections"][coll] = docs
    return payload


@api_router.post("/admin/restore")
async def restore_backup(body: Dict = Body(...), admin: Dict = Depends(require_super_admin)):
    """Restore a JSON backup. If `wipe_existing` is true, each collection is
    emptied before inserting the backup documents. Otherwise it upserts by `id`
    (or by `email` for users / `key` for counters & settings)."""
    collections = body.get("collections") or {}
    wipe_existing = bool(body.get("wipe_existing", False))
    report: Dict[str, int] = {}
    for coll, docs in collections.items():
        if coll not in BACKUP_COLLECTIONS or not isinstance(docs, list):
            continue
        if wipe_existing:
            # Preserve the current super-admin so the operator can keep logging in
            if coll == "users":
                keep = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
                await db.users.delete_many({"email": {"$ne": keep}})
            else:
                await db[coll].delete_many({})
        count = 0
        for d in docs:
            if not isinstance(d, dict):
                continue
            key = None
            if "id" in d:
                key = {"id": d["id"]}
            elif coll == "users" and "email" in d:
                key = {"email": (d.get("email") or "").lower().strip()}
            elif coll in ("counters", "settings") and "key" in d:
                key = {"key": d["key"]}
            if not key:
                continue
            await db[coll].update_one(key, {"$set": d}, upsert=True)
            count += 1
        report[coll] = count
    return {"ok": True, "restored": report, "wiped": wipe_existing}


# ==================== EMAIL (Emergent Resend proxy) ====================
# Platform-managed Resend integration — see Resend playbook for guardrails.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Arun Enterprises")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def _send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set — email skipped")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        r.raise_for_status()
        return r.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


# ==================== NIGHTLY BACKUP (Scheduled) ====================
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")
NIGHTLY_BACKUPS_KEEP = 7  # retain last 7 nightly backups


async def _run_nightly_backup(run_id: str) -> Dict[str, Any]:
    """Generate full backup JSON, store it, email SuperAdmin a summary."""
    # Idempotency: if already processed, skip
    existing = await db.backup_runs.find_one({"run_id": run_id}, {"_id": 0})
    if existing:
        return {"status": "duplicate", "run_id": run_id}

    collections_data: Dict[str, Any] = {}
    total = 0
    for coll in BACKUP_COLLECTIONS:
        docs = await db[coll].find({}, {"_id": 0}).to_list(100000)
        collections_data[coll] = docs
        total += len(docs)

    now = datetime.now(timezone.utc)
    backup_id = f"nb_{now.strftime('%Y%m%d_%H%M%S')}_{_secrets.token_hex(4)}"
    doc = {
        "id": backup_id,
        "run_id": run_id,
        "generated_at": now.isoformat(),
        "db_name": os.environ.get("DB_NAME", ""),
        "total_records": total,
        "collection_counts": {k: len(v) for k, v in collections_data.items()},
        "collections": collections_data,
    }
    await db.backups.insert_one(doc)
    await db.backup_runs.insert_one({"run_id": run_id, "backup_id": backup_id, "at": now.isoformat()})

    # Keep only the last N backups
    old = await db.backups.find({}, {"id": 1, "generated_at": 1}).sort("generated_at", -1).to_list(1000)
    if len(old) > NIGHTLY_BACKUPS_KEEP:
        to_drop = [o["id"] for o in old[NIGHTLY_BACKUPS_KEEP:]]
        await db.backups.delete_many({"id": {"$in": to_drop}})

    # Email SuperAdmin a summary (recipient from server-side env, NOT caller input)
    to_email = (os.environ.get("ADMIN_EMAIL", "") or "").strip()
    size_kb = round(len(str(collections_data)) / 1024, 1)
    if to_email:
        html = (
            f'<table role="presentation" width="100%" style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px"><tr><td>'
            f'<table role="presentation" width="620" style="margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:8px"><tr><td style="padding:20px 24px">'
            f'<h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">Nightly Backup Completed</h2>'
            f'<p style="margin:0 0 12px;color:#334155;font-size:14px">Hi SuperAdmin,</p>'
            f'<p style="margin:0 0 12px;color:#334155;font-size:14px">Aapke {escape(EMAIL_FROM_NAME)} ERP ka nightly backup <b>{escape(now.strftime("%d %b %Y · %H:%M UTC"))}</b> par successfully complete ho gaya hai.</p>'
            f'<table role="presentation" width="100%" style="border-collapse:collapse;margin:14px 0;font-size:13px">'
            f'<tr><td style="padding:8px 12px;background:#dcfce7;color:#166534;border:1px solid #86efac;font-weight:700">Total Records</td><td style="padding:8px 12px;border:1px solid #cbd5e1;font-weight:700">{total}</td></tr>'
            f'<tr><td style="padding:8px 12px;background:#dbeafe;color:#1e3a8a;border:1px solid #93c5fd;font-weight:700">Collections</td><td style="padding:8px 12px;border:1px solid #cbd5e1">{len(BACKUP_COLLECTIONS)}</td></tr>'
            f'<tr><td style="padding:8px 12px;background:#fef3c7;color:#78350f;border:1px solid #fcd34d;font-weight:700">Backup Size</td><td style="padding:8px 12px;border:1px solid #cbd5e1">~{size_kb} KB</td></tr>'
            f'<tr><td style="padding:8px 12px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;font-weight:700">Backup ID</td><td style="padding:8px 12px;border:1px solid #cbd5e1;font-family:monospace;font-size:11px">{escape(backup_id)}</td></tr>'
            f'</table>'
            f'<p style="margin:14px 0 8px;color:#334155;font-size:13px">Backup ko download karne ke liye SuperAdmin login kijiye · <b>Users Management → Nightly Backups</b> section se download button par click karein.</p>'
            f'<p style="margin:12px 0 0;color:#64748b;font-size:11px;border-top:1px dashed #cbd5e1;padding-top:10px">Last {NIGHTLY_BACKUPS_KEEP} nightly backups retained · older ones auto-removed · {escape(EMAIL_FROM_NAME)} ERP never asks for your password or OTP by email.</p>'
            f'</td></tr></table></td></tr></table>'
        )
        await _send_email(to=to_email, subject=f"✓ Nightly Backup · {total} records · {now.strftime('%d %b %Y')}", html=html)

    return {"status": "ok", "backup_id": backup_id, "total_records": total}


@api_router.post("/cron/nightly-backup")
# Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
async def cron_nightly_backup(
    body: Dict = Body(default={}),
    background: BackgroundTasks = None,
    authorization: Optional[str] = Header(default=None),
    x_webhook_id: Optional[str] = Header(default=None),
):
    if not WEBHOOK_CRON_SECRET:
        raise HTTPException(status_code=500, detail="WEBHOOK_CRON_SECRET not configured")
    token = (authorization or "").removeprefix("Bearer ").strip()
    if not token or not hmac.compare_digest(token, WEBHOOK_CRON_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")
    run_id = x_webhook_id or (body.get("run_id") if isinstance(body, dict) else None) or f"manual_{datetime.now(timezone.utc).isoformat()}"
    if background is not None:
        background.add_task(_run_nightly_backup, run_id)
    return {"ok": True, "accepted": True, "run_id": run_id}


@api_router.get("/admin/nightly-backups")
async def list_nightly_backups(admin: Dict = Depends(require_super_admin)):
    rows = await db.backups.find({}, {"_id": 0, "collections": 0}).sort("generated_at", -1).to_list(100)
    return {"items": rows}


@api_router.get("/admin/nightly-backups/{backup_id}/download")
async def download_nightly_backup(backup_id: str, admin: Dict = Depends(require_super_admin)):
    doc = await db.backups.find_one({"id": backup_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Backup not found")
    return doc


@api_router.delete("/admin/nightly-backups/{backup_id}")
async def delete_nightly_backup(backup_id: str, admin: Dict = Depends(require_super_admin)):
    r = await db.backups.delete_one({"id": backup_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"ok": True}


@api_router.post("/admin/nightly-backups/trigger")
async def trigger_nightly_backup_now(background: BackgroundTasks, admin: Dict = Depends(require_super_admin)):
    """Allow SuperAdmin to manually trigger the same nightly backup flow (test / on-demand)."""
    run_id = f"manual_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    background.add_task(_run_nightly_backup, run_id)
    return {"ok": True, "run_id": run_id}


# ==================== ROOT ====================
@api_router.get("/")
async def root():
    return {"message": "Vendor Management API", "status": "ok"}


# ==================== STARTUP ====================
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "").strip()
    admin_name = os.environ.get("ADMIN_NAME", "Administrator").strip()
    if not admin_email or not admin_password:
        logger.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed")
        return
    # Cleanup any legacy admin accounts specified via LEGACY_ADMIN_EMAILS (comma-separated)
    legacy = [e.strip().lower() for e in (os.environ.get("LEGACY_ADMIN_EMAILS", "") or "").split(",") if e.strip()]
    for old in legacy:
        if old and old != admin_email:
            r = await db.users.delete_one({"email": old})
            if r.deleted_count:
                logger.info(f"Removed legacy admin: {old}")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "name": admin_name,
            "role": "Admin",
            "mobile": "",
            "employee_id": "AE-ADMIN-001",
            "designation": "Administrator",
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    else:
        # Keep name/role in sync with env; do NOT overwrite password if already changed by admin
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"name": admin_name, "role": "Admin"}},
        )


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.vendors.create_index("id", unique=True)
        await db.bills.create_index("id", unique=True)
        await seed_admin()
    except Exception as e:
        logger.error(f"Startup error: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---- Include router & CORS ----
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
