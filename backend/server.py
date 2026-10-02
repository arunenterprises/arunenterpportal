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

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Body
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import logging

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
async def upsert_vendor(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
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
async def upsert_bill(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    bid = body.get("id")
    if not bid:
        raise HTTPException(status_code=400, detail="id required")
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
async def replace_payments(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    items = body.get("items", [])
    count = await _replace_collection("payments", items)
    return {"count": count}


# ==================== COUNTERS ====================
@api_router.get("/counters")
async def get_counters(user: Dict = Depends(get_current_user)):
    c = await db.counters.find_one({"key": "global"}, {"_id": 0})
    return c or {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0}


@api_router.post("/counters")
async def set_counters(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    body["key"] = "global"
    await db.counters.update_one({"key": "global"}, {"$set": body}, upsert=True)
    return body


# ==================== LOGO ====================
@api_router.get("/logo")
async def get_logo(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "logo"}, {"_id": 0})
    return {"logo": (doc or {}).get("value", "")}


@api_router.post("/logo")
async def set_logo(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    await db.settings.update_one({"key": "logo"}, {"$set": {"value": body.get("logo", "")}}, upsert=True)
    return {"ok": True}


# ==================== EMPLOYEES (HR) ====================
@api_router.get("/employees")
async def list_employees(user: Dict = Depends(get_current_user)):
    return await _list_collection("employees")


@api_router.post("/employees")
async def upsert_employee(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
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
async def upsert_attendance(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
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
async def push_snapshot(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    """One-shot migration/push of the client's full state to the cloud."""
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
        await _replace_collection("payments", payments)
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
def _make_hr_crud(coll_name: str, path: str):
    """Create generic get/upsert/delete endpoints for an HR collection.
    DELETE routes are gated to Admin role (RBAC)."""
    @api_router.get(f"/{path}")
    async def _list(user: Dict = Depends(get_current_user)):
        return await _list_collection(coll_name)
    @api_router.post(f"/{path}")
    async def _upsert(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
        rid = body.get("id")
        if not rid:
            raise HTTPException(status_code=400, detail="id required")
        await db[coll_name].update_one({"id": rid}, {"$set": body}, upsert=True)
        return {"ok": True, "id": rid}
    @api_router.delete(f"/{path}/{{rid}}")
    async def _delete(rid: str, admin: Dict = Depends(require_admin)):
        r = await db[coll_name].delete_one({"id": rid})
        return {"ok": True, "deleted": r.deleted_count}
    return _list, _upsert, _delete

# Register endpoints for all 5 HR collections
_make_hr_crud("paybills", "paybills")
_make_hr_crud("loans", "loans")
_make_hr_crud("advance_requests", "advance_requests")
_make_hr_crud("recruitments", "recruitments")
_make_hr_crud("exits", "exits")


# ==================== EXPENSES (single-record upsert) ====================
@api_router.post("/expenses")
async def upsert_expense(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
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
