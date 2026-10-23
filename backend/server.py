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
from datetime import datetime, timezone, timedelta
import hashlib
import logging
import asyncio
import json
import uuid
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
    cs = user.get("current_session")
    if isinstance(cs, dict) and cs.get("active") is False:
        raise HTTPException(status_code=401, detail="Session ended. Please login again.")
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
    """CROSS-USER DATA FIX (Feb 2026):
    Previously required explicit permissions.create/edit/submit/approve — any user
    created without a permissions map (role-only) got 403 on every write endpoint,
    so their save silently failed on the backend and their data never reached the
    cloud. Other devices never saw it. Now: role-based default — every role
    except Viewer can create; explicit perms override."""
    if _is_super_admin(user):
        return True
    role = (user.get("role") or "User").strip().lower()
    if role in ("admin", "gm", "purchase", "accounts", "user", "hr", "store"):
        return True
    perms = user.get("permissions") or {}
    return bool(perms.get("create") or perms.get("edit") or perms.get("submit") or perms.get("approve"))


def _can_approve(user: Dict) -> bool:
    """Approver tier: SuperAdmin + Admin role + explicit approve perm."""
    if _is_super_admin(user):
        return True
    role = (user.get("role") or "").strip().lower()
    if role == "admin":
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


_PROTECTED_FIN_RE = re.compile(r"(amount|total|net|gross|rate|qty|quantity|bank|account|ifsc|tds|gst|deduction|payable|salary|items|lines)", re.I)


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
    # Approved records: non-approvers may not change financial fields (re-approval needed)
    if existing and new_step < old_step and old_step >= 3 and not _can_approve(user):
        raise HTTPException(status_code=403, detail="Approved record can be re-opened only by an approver")
    if existing and new_step == old_step and old_step >= 3 and not _can_approve(user):
        for k in set(existing) | set(body):
            if _PROTECTED_FIN_RE.search(k) and json.dumps(existing.get(k), sort_keys=True, default=str) != json.dumps(body.get(k, existing.get(k)), sort_keys=True, default=str):
                raise HTTPException(status_code=403, detail=f"Approved record: '{k}' can be changed only by an approver")
    # Permission check: creators may submit (→ step 2); further transitions need approve
    if new_step > old_step and new_step > 2:
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
    # Fine-grained access powers assigned by SuperAdmin at registration time (Feb-2026)
    permissions: Optional[Dict[str, bool]] = None   # {create, edit, submit, approve}
    is_accounts_approver: bool = False              # weekly fooding / advance approver
    is_full_access: bool = False                    # all perms = true


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
    allowed_roles = ["User", "Admin", "Accounts", "GM", "HR", "Viewer", "Purchase"]
    role_in = (body.role or "User").strip()
    role = role_in if role_in in allowed_roles else "User"
    # Resolve effective permissions:
    #   SuperAdmin can either (a) pass an explicit permissions dict, (b) flip is_full_access,
    #   or (c) rely on role defaults.
    perms = _role_default_perms(role)
    if body.permissions and isinstance(body.permissions, dict):
        for k in ("create", "edit", "submit", "approve"):
            if k in body.permissions:
                perms[k] = bool(body.permissions[k])
    if body.is_full_access:
        perms = {"create": True, "edit": True, "submit": True, "approve": True}
    doc = {
        "email": email,
        "name": name,
        "role": role,
        "mobile": (body.mobile or "").strip(),
        "employee_id": (body.employee_id or "").strip(),
        "designation": (body.designation or "").strip(),
        "password_hash": hash_password(password),
        "permissions": perms,
        "is_accounts_approver": bool(body.is_accounts_approver),
        "is_full_access": bool(body.is_full_access),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("email"),
    }
    await db.users.insert_one(doc)
    return {
        "user": {
            "email": email, "name": name, "role": role,
            "mobile": doc["mobile"], "employee_id": doc["employee_id"], "designation": doc["designation"],
            "permissions": perms,
            "is_accounts_approver": doc["is_accounts_approver"],
            "is_full_access": doc["is_full_access"],
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


_LOGIN_FAILS: Dict[str, List[float]] = {}


@api_router.post("/auth/login")
async def login(body: LoginBody, request: Request):
    ident = body.identifier.lower().strip()
    password = body.password.strip()
    now_ts = datetime.now(timezone.utc).timestamp()
    fails = [t for t in _LOGIN_FAILS.get(ident, []) if now_ts - t < 900]
    if len(fails) >= 5:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again after 15 minutes.")
    user = await db.users.find_one({"email": ident})
    if not user or not verify_password(password, user.get("password_hash", "")):
        _LOGIN_FAILS[ident] = fails + [now_ts]
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _LOGIN_FAILS.pop(ident, None)

    # ---- SINGLE-SESSION ENFORCEMENT (Feb 2026 · user request) ----
    # Block login if the same account already has an active session newer than
    # 10 hours (full working day). SuperAdmin (primary ADMIN_EMAIL) is exempt.
    primary = (os.environ.get("ADMIN_EMAIL", "") or "").lower().strip()
    is_super = bool(primary) and user["email"].lower().strip() == primary
    now_iso = datetime.now(timezone.utc).isoformat()
    cs = user.get("current_session") or {}
    if not is_super and cs.get("active") and cs.get("login_at"):
        try:
            prev = datetime.fromisoformat(cs["login_at"].replace("Z", "+00:00"))
            age_hours = (datetime.now(timezone.utc) - prev).total_seconds() / 3600.0
        except Exception:
            age_hours = 999
        if age_hours < 10:
            raise HTTPException(
                status_code=409,
                detail=f"Already logged in from {cs.get('ip', 'another device')} at {cs.get('login_at')[:16].replace('T', ' ')}. Logout first or contact admin.",
            )

    # Resolve client IP + user-agent for the session record
    xff = request.headers.get("x-forwarded-for") or ""
    client_ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    ua = (request.headers.get("user-agent") or "")[:200]
    session_doc = {
        "active": True,
        "login_at": now_iso,
        "ip": client_ip,
        "user_agent": ua,
        "location": "",  # best-effort placeholder — enrich via IP lookup in a future pass
    }
    await db.users.update_one(
        {"email": user["email"]},
        {"$set": {"current_session": session_doc, "last_login_at": now_iso, "last_login_ip": client_ip}},
    )

    token = create_access_token(user["email"], user["email"])
    perms = user.get("permissions") or _role_default_perms(user.get("role"))
    if is_super or user.get("is_full_access"):
        perms = {"create": True, "edit": True, "submit": True, "approve": True}
    return {
        "token": token,
        "user": {
            "email": user["email"], "name": user["name"], "role": user["role"],
            "permissions": perms, "designation": user.get("designation", ""),
            "is_accounts_approver": bool(user.get("is_accounts_approver", False)) or is_super,
            "is_full_access": bool(user.get("is_full_access", False)) or is_super,
            "employee_id": user.get("employee_id", ""),
            "mobile": user.get("mobile", ""),
        },
    }


@api_router.post("/auth/logout")
async def logout(user: Dict = Depends(get_current_user)):
    await db.users.update_one(
        {"email": user["email"]},
        {"$set": {"current_session.active": False, "last_logout_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api_router.get("/users/sessions")
async def list_sessions(admin: Dict = Depends(get_current_user)):
    """Return active + last session info for every user. Admin / SuperAdmin only."""
    if (admin.get("role") or "").lower() not in ("admin",) and not _is_super_admin(admin):
        raise HTTPException(status_code=403, detail="Admin / SuperAdmin only")
    cursor = db.users.find({}, {"password_hash": 0})
    out = []
    async for u in cursor:
        u.pop("_id", None)
        cs = u.get("current_session") or {}
        out.append({
            "email": u.get("email"), "name": u.get("name"), "role": u.get("role"),
            "designation": u.get("designation", ""),
            "active": bool(cs.get("active")),
            "login_at": cs.get("login_at", ""),
            "ip": cs.get("ip", ""),
            "user_agent": cs.get("user_agent", ""),
            "location": cs.get("location", ""),
            "last_logout_at": u.get("last_logout_at", ""),
        })
    out.sort(key=lambda x: (not x["active"], -(len(x["login_at"] or ""))))
    return {"items": out}


@api_router.post("/users/{email}/force_logout")
async def force_logout(email: str, admin: Dict = Depends(require_admin)):
    """Admin can force-logout another user (clears current_session.active)."""
    email = email.lower().strip()
    r = await db.users.update_one(
        {"email": email},
        {"$set": {"current_session.active": False, "forced_logout_at": datetime.now(timezone.utc).isoformat(), "forced_logout_by": admin.get("email")}},
    )
    return {"ok": True, "updated": r.modified_count}


# ---- ATTENDANCE PUNCH (Feb 2026 · user request) ----
# Allowed window: 09:10 - 09:30 IST (05:40 - 06:00 UTC). One punch per user per day.
@api_router.post("/attendance/punch")
async def attendance_punch(user: Dict = Depends(get_current_user)):
    now_utc = datetime.now(timezone.utc)
    # IST = UTC + 05:30
    from datetime import timedelta
    now_ist = now_utc + timedelta(hours=5, minutes=30)
    minutes_of_day = now_ist.hour * 60 + now_ist.minute
    # 09:10 = 550, 09:30 = 570
    WINDOW_START, WINDOW_END = 9 * 60 + 10, 9 * 60 + 30
    if not (WINDOW_START <= minutes_of_day <= WINDOW_END):
        raise HTTPException(
            status_code=400,
            detail=f"Punch window is 09:10 - 09:30 IST only. Current IST time: {now_ist.strftime('%H:%M')}",
        )
    date_key = now_ist.strftime("%Y-%m-%d")
    existing = await db.attendance_punches.find_one({"email": user["email"], "date": date_key})
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Already punched today at {existing.get('punch_time_ist', '')} IST",
        )
    doc = {
        "email": user["email"],
        "name": user.get("name", ""),
        "designation": user.get("designation", ""),
        "date": date_key,
        "punch_time_ist": now_ist.strftime("%H:%M:%S"),
        "punch_time_utc": now_utc.isoformat(),
    }
    await db.attendance_punches.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "punch": doc}


@api_router.get("/attendance/today")
async def attendance_today(user: Dict = Depends(get_current_user)):
    from datetime import timedelta
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    date_key = now_ist.strftime("%Y-%m-%d")
    rows = []
    async for r in db.attendance_punches.find({"date": date_key}):
        r.pop("_id", None); rows.append(r)
    rows.sort(key=lambda x: x.get("punch_time_ist", ""))
    my = next((r for r in rows if r.get("email") == user["email"]), None)
    return {"date": date_key, "my_punch": my, "all": rows}


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
async def update_user_permissions(email: str, body: PermsBody, admin: Dict = Depends(require_admin)):
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
async def update_user_role(email: str, body: RoleBody, admin: Dict = Depends(require_admin)):
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


async def _merge_upsert(coll: str, items: List[dict]) -> int:
    """Upsert by id (or pvNo); never let an older copy overwrite a newer one."""
    count = 0
    for it in items or []:
        if not isinstance(it, dict):
            continue
        it.pop("_id", None)
        key = {"id": it["id"]} if it.get("id") else ({"pvNo": it["pvNo"]} if it.get("pvNo") else None)
        if not key:
            continue
        existing = await db[coll].find_one(key, {"_id": 0, "updatedAt": 1})
        inc, cur = str(it.get("updatedAt") or ""), str((existing or {}).get("updatedAt") or "")
        if existing and cur and inc < cur:
            continue
        await db[coll].update_one(key, {"$set": it}, upsert=True)
        count += 1
    return count


async def _bump_counters(counters: Dict) -> None:
    """Counters only ever move forward ($max) — a stale device can't reset serials."""
    vals = {}
    for k, v in (counters or {}).items():
        if k in ("key", "_id"):
            continue
        try:
            vals[k] = int(v or 0)
        except (TypeError, ValueError):
            continue
    if vals:
        await db.counters.update_one({"key": "global"}, {"$max": vals}, upsert=True)


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
    await _acl_guard("vendors", body, user)
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
    await _acl_guard("bills", body, user)
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
async def replace_payments(body: Dict = Body(...), user: Dict = Depends(require_write)):
    """SEC-002 FIX: per-id upsert (any writer). The old blanket delete-and-
    insert flow allowed any logged-in user to wipe the full payments ledger.
    Feb 2026 fix: switched from require_approver → require_write so creator-tier
    users can save their own voucher drafts and sync them cross-device."""
    items = await _acl_filter("payments", body.get("items") or [], user)
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
    await _bump_counters(body)
    return (await db.counters.find_one({"key": "global"}, {"_id": 0})) or {}


# ---------------------------------------------------------------------------
# ATOMIC counter bump (Feb 2026 fix for "vendor code reset to 01" bug).
#
# Why?  Local-only serial generation drifts the moment any device has an
# empty/stale `ae_vm_vendors` snapshot: `nextVendorCode()` scans only local
# records, finds nothing, bumps a 0 counter and happily reissues `AE0001JVxx`
# — which the dedupe pass then uses to overwrite the real `AE0001` on cloud.
#
# This endpoint eliminates the race: it uses MongoDB `$inc` to atomically
# increment the serial counter server-side AND cross-checks the max serial
# actually used by existing vendors in the same collection, so the returned
# serial is guaranteed monotonic across every device, every tab, every retry.
# ---------------------------------------------------------------------------
@api_router.post("/counters/next-vendor")
async def next_vendor_serial(user: Dict = Depends(require_write)):
    import re
    # 1. Max serial actually in use (scan vendor codes, ignore drafts without a code)
    max_used = 0
    async for v in db.vendors.find({"vendorCode": {"$regex": r"^AE\d{4}JV"}}, {"vendorCode": 1}):
        m = re.match(r"^AE(\d{4})JV", v.get("vendorCode") or "")
        if m:
            try:
                n = int(m.group(1))
                if n > max_used:
                    max_used = n
            except ValueError:
                pass
    # 2. Current stored counter
    cur_doc = await db.counters.find_one({"key": "global"}, {"vendorSerial": 1})
    cur_serial = int((cur_doc or {}).get("vendorSerial") or 0)
    # 3. Floor at max(stored, max_used), then atomically $inc by 1 so parallel
    #    callers never collide. If stored < floor we first clamp it up, then inc.
    floor = max(cur_serial, max_used)
    if cur_serial < floor:
        await db.counters.update_one(
            {"key": "global"}, {"$set": {"vendorSerial": floor}}, upsert=True,
        )
    bumped = await db.counters.find_one_and_update(
        {"key": "global"},
        {"$inc": {"vendorSerial": 1}},
        upsert=True,
        return_document=True,
    )
    next_serial = int((bumped or {}).get("vendorSerial") or (floor + 1))
    return {"nextSerial": next_serial, "maxUsed": max_used, "flooredAt": floor}


@api_router.post("/counters/next-expense")
async def next_expense_serial(user: Dict = Depends(require_write)):
    import re
    max_used = 0
    async for x in db.expenses.find({}, {"refNo": 1, "permanentExpenseNo": 1, "expenseSerial": 1}):
        for v in (x.get("refNo"), x.get("permanentExpenseNo")):
            m = re.match(r"^EX[RP](\d{4})", v or "")
            if m:
                max_used = max(max_used, int(m.group(1)))
        try:
            max_used = max(max_used, int(x.get("expenseSerial") or 0))
        except (TypeError, ValueError):
            pass
    await db.counters.update_one({"key": "global"}, {"$max": {"expenseSerial": max_used}}, upsert=True)
    bumped = await db.counters.find_one_and_update({"key": "global"}, {"$inc": {"expenseSerial": 1}}, upsert=True, return_document=True)
    return {"nextSerial": int(bumped.get("expenseSerial") or max_used + 1)}



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
    await _acl_guard("employees", body, user)
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
    await _acl_guard("attendance", body, user)
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
        "fooding": await _list_collection("fooding"),
        "counters": (await db.counters.find_one({"key": "global"}, {"_id": 0})) or {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0, "expenseSerial": 0, "boqSerial": 0, "woSerial": 0, "empSerial": 0, "adsSerial": 0},
        "logo": ((await db.settings.find_one({"key": "logo"}, {"_id": 0})) or {}).get("value", ""),
        "active_fy": ((await db.settings.find_one({"key": "active_fy"}, {"_id": 0})) or {}).get("value", ""),
        "company": ((await db.settings.find_one({"key": "company"}, {"_id": 0})) or {}).get("value", {}),
    }


# ==================== FINANCIAL YEAR (admin-managed active FY) ====================
@api_router.get("/settings/fy")
async def get_active_fy(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "active_fy"}, {"_id": 0})
    return {"active_fy": (doc or {}).get("value", "")}


@api_router.post("/settings/fy")
async def set_active_fy(body: Dict = Body(...), admin: Dict = Depends(require_admin)):
    """SuperAdmin / Admin only — set the active Financial Year used by all
    serial / code generation (vendor codes, bill nos, PV nos, EMP codes, ADV)."""
    fy = (body.get("active_fy") or "").strip()
    # Accept 4-digit (2526) or hyphen (25-26) or full (2025-2026) formats
    if fy and not (len(fy) == 4 and fy.isdigit()) and not (len(fy) == 5 and fy[2] == "-") and not (len(fy) == 9 and fy[4] == "-"):
        raise HTTPException(status_code=400, detail="FY must be 2526, 25-26, or 2025-2026 format")
    await db.settings.update_one({"key": "active_fy"}, {"$set": {"value": fy, "updated_by": admin.get("email"), "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True, "active_fy": fy}


# ==================== COMPANY DETAILS (SuperAdmin-managed letterhead data) ====================
_COMPANY_DEFAULTS = {
    "name": "M/s ARUN ENTERPRISES",
    "tagline": "OUR QUALITY ORIENTED SERVICE'S IS FIRST PRIORITY",
    "pillLine": "Govt. Civil Work Contractor & General Order Supplier",
    "address": "209H/1F/1, O.P.S. Nagar Kalindipuram, Prayagraj (U.P.) - 211011",
    "tollFree": "9429694552",
    "email": "info@arunenterprises.online",
    "website": "www.arunenterprises.com.in",
    "gst": "",
    "pan": "",
    "cin": "",
    "state": "Uttar Pradesh",
    "bankName": "",
    "bankAccountNo": "",
    "bankIfsc": "",
    "bankBranch": "",
}


@api_router.get("/settings/acl")
async def get_acl(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "acl"}, {"_id": 0})
    return {"value": (doc or {}).get("value") or {}}


@api_router.post("/settings/acl")
async def set_acl(body: Dict = Body(...), admin: Dict = Depends(require_super_admin)):
    value = body.get("value")
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="`value` must be an object")
    await db.settings.update_one({"key": "acl"}, {"$set": {"key": "acl", "value": value, "updated_by": admin.get("email"), "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True, "value": value}


async def _acl_ok(user: Dict, dept: str, op: str) -> bool:
    if _is_super_admin(user):
        return True
    role = (user.get("role") or "User").strip()
    cell = (((await db.settings.find_one({"key": "acl"}, {"_id": 0})) or {}).get("value") or {}).get(role, {}).get(dept) or {}
    default = role in ("Admin", "GM") if op == "a" else (role != "Viewer")
    return bool(cell.get(op, default))


ACL_COLL_DEPT = {
    "vendors": "procurement", "boqs": "procurement", "work_orders": "procurement",
    "bills": "accounts", "payments": "accounts", "expenses": "accounts", "fooding": "accounts",
    "paybills": "accounts", "loans": "accounts", "advance_requests": "accounts",
    "employees": "hr", "attendance": "hr", "recruitments": "hr", "exits": "hr",
}
_APPROVE_WORDS = {"approved", "rejected", "paid", "settled"}


async def _acl_restricted(user: Dict, coll: str) -> bool:
    dept = ACL_COLL_DEPT.get(coll)
    return bool(dept) and not (await _acl_ok(user, dept, "c") and await _acl_ok(user, dept, "a"))


async def _acl_guard(coll: str, body: Dict, user: Dict) -> None:
    """Old modules: block create/edit or approval when the role's ACL tick is removed."""
    if not await _acl_restricted(user, coll):
        return
    dept = ACL_COLL_DEPT[coll]
    key = {"id": body["id"]} if body.get("id") else ({"pvNo": body["pvNo"]} if body.get("pvNo") else None)
    ex = await db[coll].find_one(key, {"_id": 0}) if key else None
    if ex and all(json.dumps(ex.get(k), sort_keys=True, default=str) == json.dumps(v, sort_keys=True, default=str) for k, v in body.items()):
        return

    def lvl(d):
        try:
            s = int((d or {}).get("step") or 0)
        except (TypeError, ValueError):
            s = 0
        return s, str((d or {}).get("status") or "").lower()
    (os_, ost), (ns, nst) = lvl(ex), lvl(body)
    if ((ns > os_ and ns > 2) or (nst != ost and nst in _APPROVE_WORDS)) and not await _acl_ok(user, dept, "a"):
        raise HTTPException(status_code=403, detail="Approval ki permission nahi hai (System Admin → Permissions)")
    if not await _acl_ok(user, dept, "c"):
        raise HTTPException(status_code=403, detail="Entry / edit ki permission nahi hai (System Admin → Permissions)")


async def _acl_filter(coll: str, items: List[dict], user: Dict) -> List[dict]:
    if not await _acl_restricted(user, coll):
        return items
    out = []
    for it in items:
        try:
            await _acl_guard(coll, it, user)
            out.append(it)
        except HTTPException:
            continue
    return out


@api_router.get("/settings/ui-buttons")
async def get_ui_buttons(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "ui_buttons"}, {"_id": 0})
    return {"value": (doc or {}).get("value") or {"global": {}, "pages": {}, "buttons": {}, "elements": {}}}


@api_router.post("/settings/ui-buttons")
async def set_ui_buttons(body: Dict = Body(...), admin: Dict = Depends(get_current_user)):
    if not _is_super_admin(admin):
        raise HTTPException(status_code=403, detail="Only SuperAdmin can change button layout")
    value = body.get("value") or {}
    if not isinstance(value, dict):
        raise HTTPException(status_code=400, detail="`value` must be an object")
    clean = {"global": value.get("global") or {}, "pages": value.get("pages") or {}, "buttons": value.get("buttons") or {}, "elements": value.get("elements") or {}}
    await db.settings.update_one({"key": "ui_buttons"}, {"$set": {"value": clean, "updated_by": admin.get("email"), "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True, "value": clean}


@api_router.get("/settings/company")
async def get_company_details(user: Dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "company"}, {"_id": 0})
    value = (doc or {}).get("value") or {}
    merged = {**_COMPANY_DEFAULTS, **value}
    return {"company": merged}


@api_router.post("/settings/company")
async def set_company_details(body: Dict = Body(...), admin: Dict = Depends(get_current_user)):
    """SuperAdmin ONLY — update the full company master used across the app
    (letterhead, PV footer, print formats, bank-advice slips, etc.)."""
    if not _is_super_admin(admin):
        raise HTTPException(status_code=403, detail="Only SuperAdmin can edit company details")
    details = body.get("company") or {}
    if not isinstance(details, dict):
        raise HTTPException(status_code=400, detail="`company` must be an object")
    # Whitelist keys and strip to strings
    clean = {k: (str(v) if v is not None else "") for k, v in details.items() if k in _COMPANY_DEFAULTS}
    merged = {**_COMPANY_DEFAULTS, **clean}
    await db.settings.update_one(
        {"key": "company"},
        {"$set": {"value": merged, "updated_by": admin.get("email"), "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "company": merged}


@api_router.post("/snapshot")
async def push_snapshot(body: Dict = Body(...), user: Dict = Depends(require_write)):
    """One-shot migration/push of the client's full state to the cloud.
    Feb 2026 fix: switched from require_approver → require_write so creator-tier
    users (Purchase, Accounts, HR, User) can also push their saved drafts and
    data syncs cross-device. Approval-gated transitions still enforced per-field."""
    colls = ["vendors", "bills", "payments", "expenses", "paybills", "loans", "advance_requests",
             "recruitments", "exits", "employees", "boqs", "work_orders", "attendance", "fooding"]
    wf = {"bills": "step", "paybills": "step", "loans": "status", "advance_requests": "status",
          "recruitments": "step", "exits": "step"}
    result = {}
    for c in colls:
        items = body.get(c) or []
        if c in wf:
            allowed = []
            for it in items:
                if not isinstance(it, dict) or not it.get("id"):
                    continue
                try:
                    allowed.append(await _enforce_workflow(c, it, user, step_field=wf[c]))
                except HTTPException:
                    continue
            items = allowed
        items = await _acl_filter(c, items, user)
        result[c] = await _merge_upsert(c, items)
    if body.get("counters"):
        await _bump_counters(body["counters"])
    logo = body.get("logo", "")
    if logo:
        await db.settings.update_one({"key": "logo"}, {"$set": {"value": logo}}, upsert=True)
    return result


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
        await _acl_guard(coll_name, body, user)
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


# ==================== WEEKLY FOODING ====================
@api_router.post("/fooding")
async def upsert_fooding(body: Dict = Body(...), user: Dict = Depends(require_write)):
    if not body.get("id"):
        raise HTTPException(status_code=400, detail="id is required")
    await _acl_guard("fooding", body, user)
    await _merge_upsert("fooding", [body])
    return {"ok": True, "id": body["id"]}


@api_router.delete("/fooding/{fid}")
async def delete_fooding(fid: str, user: Dict = Depends(require_admin)):
    r = await db.fooding.delete_one({"id": fid})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== AI WORK ORDER (Scope + T&C) ====================
_AI_WO_SYSTEM = (
    "You are a senior contracts engineer for an Indian civil works contractor and general order supplier. "
    "You draft clear, professional Work Order documents in formal English."
)


@api_router.post("/ai/wo-terms")
async def ai_wo_terms(body: Dict = Body(...), user: Dict = Depends(require_write)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
    items = body.get("items") or []
    lines = "\n".join(f"- {i.get('description','')} | qty {i.get('qty','')} {i.get('unit','')} | rate {i.get('rate','')}" for i in items[:60])
    defaults = "\n".join(f"{k}: {body.get(k) or ''}" for k in ("paymentTerms", "deliveryTerms", "penaltyClause", "warrantyClause", "termsAndConditions"))
    prompt = (
        f"Work Order details:\nVendor: {body.get('vendorName','')}\nProject/Site: {body.get('projectSite','')}\nClient: {body.get('clientName','')}\n"
        f"WO Date: {body.get('woDate','')} | Expiry: {body.get('expiryDate','')} | GST %: {body.get('gstSlab','')} | Retention %: {body.get('retentionPct','')}\n"
        f"Existing scope notes: {body.get('scopeOfWork','')}\nLine items:\n{lines}\n\n"
        f"The company's OWN default terms (already printed separately in the WO):\n{defaults}\n\n"
        "Task: 1) Write a detailed 'Scope of Work' in English (deliverables, execution method, quality standards, site responsibilities, exclusions) based on the line items. "
        "2) Write 10-15 additional numbered Terms & Conditions in English suitable for this work order. "
        "These AI terms MUST NOT repeat, paraphrase or overlap any of the company's own default terms above - cover different topics only "
        "(e.g. safety, insurance, labour law compliance, documentation, inspection, dispute resolution, force majeure, confidentiality, termination). "
        'Respond ONLY with JSON: {"scopeOfWork": "...", "aiTerms": "1. ...\\n2. ..."}'
    )
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"aiwo-{uuid.uuid4()}", system_message=_AI_WO_SYSTEM).with_model("openai", "gpt-5.6-terra")
    out = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                out += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.exception("AI WO generation failed")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)[:200]}")
    m = re.search(r"\{.*\}", out, re.S)
    try:
        data = json.loads(m.group(0)) if m else {}
    except Exception:
        data = {}
    if not data.get("scopeOfWork") and not data.get("aiTerms"):
        raise HTTPException(status_code=502, detail="AI returned an unreadable response. Please try again.")
    return {"scopeOfWork": str(data.get("scopeOfWork", "")).strip(), "aiTerms": str(data.get("aiTerms", "")).strip()}


# ==================== CLIENT & REVENUE (CRM + RA BILLING) ====================
_CRM_COLLS = {"leads", "clients", "comms", "contracts", "mb", "ra_bills", "milestones", "change_orders", "retention_releases", "invoices"}
_CRM_WF = {"mb", "ra_bills", "change_orders", "clients", "invoices"}


def _crm_coll(name: str) -> str:
    if name not in _CRM_COLLS:
        raise HTTPException(status_code=404, detail="Unknown CRM collection")
    return f"crm_{name}"


@api_router.get("/crm-all")
async def crm_all(user: Dict = Depends(get_current_user)):
    names = sorted(_CRM_COLLS)
    lists = await asyncio.gather(*[_list_collection(_crm_coll(n)) for n in names])
    return dict(zip(names, lists))


@api_router.get("/crm/{name}")
async def crm_list(name: str, user: Dict = Depends(get_current_user)):
    return await _list_collection(_crm_coll(name))


_WO_PROMPT = """You are reading a client's construction WORK ORDER / LOI / agreement document (Indian context, may be Hindi or English, may be scanned).
Extract data and reply with ONLY a JSON object (no markdown) in this exact shape:
{"workOrderNo": "", "workOrderDate": "YYYY-MM-DD or empty", "workOrderType": "Supply | Service | Composite", "clientName": "", "clientAddress": "", "clientGst": "", "clientPan": "",
 "contactPerson": "", "clientMobile": "", "clientEmail": "", "projectName": "", "siteLocation": "", "startDate": "YYYY-MM-DD or empty",
 "completionDate": "YYYY-MM-DD or empty", "contractValue": 0, "retentionPct": 0, "advanceAmount": 0, "advanceRecoveryPct": 0,
 "defaultGstPct": 0, "scopeOfWork": "",
 "items": [{"code": "", "description": "", "unit": "", "qty": 0, "rate": 0, "gstPct": 0}]}
Rules: numbers must be plain numbers (no commas/currency). Include EVERY line item of the BOQ/schedule with its quantity, unit and rate.
If GST % is given per item use it, else use the overall GST % (defaultGstPct). Retention / security deposit % goes in retentionPct.
Use empty string or 0 when a value is not present. Do not invent values.
workOrderType: "Supply" if only material supply, "Service" if works contract / labour / construction / services, "Composite" if supply + installation/erection."""


@api_router.post("/crm/parse-work-order")
async def crm_parse_work_order(body: Dict = Body(...), user: Dict = Depends(require_write)):
    import base64, json as _json, tempfile, uuid
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType, TextDelta, StreamDone
    mime = body.get("mimeType") or "application/pdf"
    if mime not in ("application/pdf", "image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=400, detail="Sirf PDF / JPG / PNG file upload karein")
    raw = (body.get("data") or "").split(",")[-1]
    try:
        blob = base64.b64decode(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file data")
    if not blob or len(blob) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File 15 MB se chhoti honi chahiye")
    ext = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}[mime]
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tf:
        tf.write(blob)
        path = tf.name
    try:
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"wo-{uuid.uuid4()}",
                       system_message="You extract structured data from construction work order documents.").with_model("gemini", "gemini-3.1-pro-preview")
        text = ""
        async for ev in chat.stream_message(UserMessage(text=_WO_PROMPT, file_contents=[FileContentWithMimeType(file_path=path, mime_type=mime)])):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logging.exception("WO parse failed")
        raise HTTPException(status_code=502, detail=f"AI se document nahi padha ja saka: {str(e)[:150]}")
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    m = re.search(r"\{.*\}", text, re.S)
    try:
        data = _json.loads(m.group(0)) if m else None
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="Document se data nahi nikla — saaf PDF try karein")
    return data


@api_router.post("/crm/next-number/{kind}")
async def crm_next_number(kind: str, user: Dict = Depends(require_write)):
    import re
    if kind not in ("lead", "client", "contract", "mb", "co") and not re.fullmatch(r"(ra_[A-Za-z0-9_]+|inv_\d{4}|invref_\d{4})", kind):
        raise HTTPException(status_code=400, detail="Invalid number kind")
    if kind.startswith("inv_"):
        # Client Tax Invoice series starts at 49 (first invoice A/E/INV/00049/2627)
        await db.counters.update_one({"key": "crm"}, {"$max": {kind: 48}}, upsert=True)
    doc = await db.counters.find_one_and_update(
        {"key": "crm"}, {"$inc": {kind.replace(".", "_"): 1}}, upsert=True, return_document=True,
    )
    return {"serial": int(doc.get(kind.replace(".", "_")) or 1)}


@api_router.post("/crm/{name}")
async def crm_upsert(name: str, body: Dict = Body(...), user: Dict = Depends(require_write)):
    coll = _crm_coll(name)
    rid = body.get("id")
    if not rid:
        raise HTTPException(status_code=400, detail="id required")
    body.pop("_id", None)
    existing = await db[coll].find_one({"id": rid}, {"_id": 0})
    if name in _CRM_WF:
        old_step = int((existing or {}).get("step") or 1)
        new_step = int(body.get("step") or old_step)
        for f in ("approvedByName", "approvedAt"):
            body.pop(f, None)
            if existing and existing.get(f):
                body[f] = existing[f]
        if name == "invoices":
            body["invoiceNo"] = (existing or {}).get("invoiceNo", "")
            if existing and existing.get("refNo"):
                body["refNo"] = existing["refNo"]
            if old_step == 6:
                raise HTTPException(status_code=400, detail="Cancelled invoice change nahi ho sakta")
            if new_step == 6 and (old_step not in (3, 4) or not str(body.get("cancelReason") or "").strip()):
                raise HTTPException(status_code=400, detail="Sirf Approved / Sent invoice reason ke saath cancel ho sakta hai")
            if new_step == 6 and existing:
                body = {**existing, "step": 6, "cancelReason": str(body.get("cancelReason")).strip(), "history": body.get("history", existing.get("history", [])),
                        "cancelledBy": user.get("name") or user.get("email"), "cancelledAt": datetime.now(timezone.utc).date().isoformat()}
        if not _crm_power(user) and (new_step > 2 or old_step >= 3 or (name == "invoices" and old_step >= 2)):
            if name == "mb" and existing and new_step == old_step:
                body = {**existing, "raBillId": body.get("raBillId", existing.get("raBillId", ""))}
            else:
                raise HTTPException(status_code=403, detail="Approval sirf SuperAdmin / Admin kar sakte hain")
        if new_step == 3 and old_step < 3:
            body["approvedByName"] = user.get("name") or user.get("email")
            body["approvedAt"] = datetime.now(timezone.utc).isoformat()
            if name == "invoices" and not (existing or {}).get("invoiceNo"):
                d = str(body.get("invoiceDate") or datetime.now(timezone.utc).date().isoformat())
                y, m = int(d[:4]), int(d[5:7])
                fy_start = y if m >= 4 else y - 1
                fy = f"{str(fy_start)[2:]}{str(fy_start + 1)[2:]}"
                k = f"inv_{fy}"
                await db.counters.update_one({"key": "crm"}, {"$max": {k: 39}}, upsert=True)
                c = await db.counters.find_one_and_update({"key": "crm"}, {"$inc": {k: 1}}, upsert=True, return_document=True)
                body["invoiceNo"] = f"A/E/INV/{int(c[k]):05d}/{fy}"
            elif name == "invoices":
                body["invoiceNo"] = existing["invoiceNo"]
    if name == "retention_releases":
        if not _crm_power(user):
            raise HTTPException(status_code=403, detail="Approval sirf SuperAdmin / Admin kar sakte hain")
        cid = body.get("contractId")
        held = sum([float(b.get("retentionAmt") or 0) async for b in db.crm_ra_bills.find({"contractId": cid, "step": {"$gte": 3}})])
        released = sum([float(r.get("amount") or 0) async for r in db.crm_retention_releases.find({"contractId": cid, "id": {"$ne": rid}})])
        if float(body.get("amount") or 0) > round(held - released, 2) + 0.01:
            raise HTTPException(status_code=400, detail="Release amount exceeds retention balance")
    body["updatedAt"] = datetime.now(timezone.utc).isoformat()
    if not existing:
        body["createdByName"] = user.get("name") or user.get("email")
    await db[coll].update_one({"id": rid}, {"$set": body}, upsert=True)
    return await db[coll].find_one({"id": rid}, {"_id": 0})


def _crm_power(user: Dict) -> bool:
    """Client & Revenue: approve/delete only for SuperAdmin + Admin role."""
    return _is_super_admin(user) or (user.get("role") or "").strip().lower() == "admin"


@api_router.delete("/crm/{name}/{rid}")
async def crm_delete(name: str, rid: str, user: Dict = Depends(get_current_user)):
    if not _crm_power(user):
        raise HTTPException(status_code=403, detail="Delete sirf SuperAdmin / Admin kar sakte hain")
    if name == "invoices":
        inv = await db[_crm_coll(name)].find_one({"id": rid}, {"_id": 0, "invoiceNo": 1})
        if inv and inv.get("invoiceNo"):
            raise HTTPException(status_code=400, detail="Approved invoice (permanent number) delete nahi ho sakta")
    r = await db[_crm_coll(name)].delete_one({"id": rid})
    return {"ok": True, "deleted": r.deleted_count}


# ==================== EXPENSES (single-record upsert) ====================
@api_router.post("/expenses")
async def upsert_expense(body: Dict = Body(...), user: Dict = Depends(require_write)):
    xid = body.get("id")
    if not xid:
        raise HTTPException(status_code=400, detail="id is required")
    await _acl_guard("expenses", body, user)
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
    await _acl_guard("boqs", body, user)
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
    await _acl_guard("work_orders", body, user)
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
    "recruitments", "exits", "counters", "settings", "fooding",
    "crm_leads", "crm_clients", "crm_contracts", "crm_mb", "crm_ra_bills", "crm_invoices",
    "crm_retention_releases", "crm_milestones", "crm_comms", "crm_change_orders",
]
REPORT_KEYS = {"bills": "Vendor Bills", "expenses": "Expenses", "payments": "Payment Vouchers", "fooding": "Fooding", "crm_invoices": "Tax Invoices", "crm_ra_bills": "RA Bills", "work_orders": "Work Orders", "vendors": "Vendors"}


async def _full_backup_payload() -> Dict[str, Any]:
    cols = {c: await db[c].find({}, {"_id": 0}).to_list(100000) for c in BACKUP_COLLECTIONS}
    today = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
    counts = {k: len(cols.get(k, [])) for k in REPORT_KEYS}
    await db.sync_reports.update_one({"date": today}, {"$set": {"date": today, "counts": counts, "at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"generated_at": datetime.now(timezone.utc).isoformat(), "db_name": os.environ.get("DB_NAME", ""), "version": 1, "collections": cols}


async def _require_sync_key(x_sync_key: Optional[str] = Header(default=None)) -> None:
    doc = await db.settings.find_one({"key": "desktop_sync_key"}, {"_id": 0})
    want = (doc or {}).get("hash", "")
    got = hashlib.sha256((x_sync_key or "").encode()).hexdigest()
    if not x_sync_key or not want or not hmac.compare_digest(got, want):
        raise HTTPException(status_code=401, detail="Invalid sync key")


@api_router.post("/admin/sync-key")
async def new_sync_key(admin: Dict = Depends(require_super_admin)):
    key = _secrets.token_urlsafe(32)
    await db.settings.update_one({"key": "desktop_sync_key"}, {"$set": {"key": "desktop_sync_key", "hash": hashlib.sha256(key.encode()).hexdigest(), "created_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"sync_key": key}


@api_router.get("/sync-agent/backup")
async def sync_agent_backup(_: None = Depends(_require_sync_key)):
    return await _full_backup_payload()


@api_router.get("/admin/sync-report")
async def sync_report(admin: Dict = Depends(require_super_admin)):
    rows = await db.sync_reports.find({}, {"_id": 0}).sort("date", -1).to_list(15)
    for i, r in enumerate(rows):
        prev = rows[i + 1]["counts"] if i + 1 < len(rows) else {}
        r["new"] = {k: max(0, r["counts"].get(k, 0) - prev.get(k, 0)) if prev else None for k in REPORT_KEYS}
    return {"labels": REPORT_KEYS, "items": rows[:14]}


@api_router.get("/admin/backup")
async def download_backup(admin: Dict = Depends(require_super_admin)):
    return await _full_backup_payload()


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


DUP_FIX = [
    ("vendors", "vendorCode", r"^(AE)(\d{4})(JV\d{4})$"),
    ("advance_requests", "refNo", r"^(ADV/\d{4}/)(\d{4})()$"),
    ("expenses", "refNo", r"^(EXR)(\d{4})(\d{4})$"),
]


@api_router.post("/admin/fix-duplicate-numbers")
async def fix_duplicate_numbers(body: Dict = Body(default={}), admin: Dict = Depends(require_super_admin)):
    import re
    dry = bool(body.get("dry_run"))
    now = datetime.now(timezone.utc).isoformat()
    report: Dict[str, Any] = {"renumbered": [], "removed_copies": []}
    for coll in ["payments", "vendors", "advance_requests", "expenses", "bills", "boqs", "work_orders", "paybills", "employees"]:
        async for g in db[coll].aggregate([{"$match": {"id": {"$ne": None}}}, {"$group": {"_id": "$id", "oids": {"$push": "$_id"}, "n": {"$sum": 1}}}, {"$match": {"n": {"$gt": 1}}}]):
            report["removed_copies"].append({"collection": coll, "id": g["_id"], "copies_removed": g["n"] - 1})
            if not dry:
                await db[coll].delete_many({"_id": {"$in": g["oids"][1:]}})
    for coll, key, pat in DUP_FIX:
        rx = re.compile(pat)
        docs = await db[coll].find({key: {"$regex": pat}}, {"_id": 1, "id": 1, key: 1, "createdAt": 1}).to_list(100000)
        max_serial = max([int(rx.match(d[key]).group(2)) for d in docs] or [0])
        groups: Dict[str, List[Dict]] = {}
        for d in docs:
            groups.setdefault(d[key], []).append(d)
        for no, rows in groups.items():
            if len({r.get("id") for r in rows}) < 2:
                continue
            rows.sort(key=lambda r: (str(r.get("createdAt") or ""), str(r.get("id") or "")))
            seen = {rows[0].get("id")}
            for r in rows[1:]:
                if r.get("id") in seen:
                    continue
                seen.add(r.get("id"))
                max_serial += 1
                m = rx.match(no)
                new_no = f"{m.group(1)}{max_serial:04d}{m.group(3)}"
                report["renumbered"].append({"collection": coll, "id": r.get("id"), "old": no, "new": new_no})
                if not dry:
                    await db[coll].update_many({"id": r.get("id")}, {"$set": {key: new_no, "oldRefNo": no, "updatedAt": now}})
        if not dry and coll == "vendors":
            await db.counters.update_one({"key": "global"}, {"$max": {"vendorSerial": max_serial}}, upsert=True)
        if not dry and coll == "expenses":
            await db.counters.update_one({"key": "global"}, {"$max": {"expenseSerial": max_serial}}, upsert=True)
    logger.info(f"fix-duplicate-numbers dry={dry} by {admin.get('email')}: {report}")
    return {"ok": True, "dry_run": dry, **report}



RESTORE_COLLECTIONS = ["bills", "boqs", "work_orders", "payments", "paybills", "advance_requests", "vendors", "employees", "expenses", "fooding", "loans"]
RESTORE_KEYS = {"bills": "refNo", "boqs": "boqNo", "work_orders": "woNo", "payments": "pvNo", "paybills": "refNo", "advance_requests": "refNo", "vendors": "vendorCode", "employees": "empCode", "expenses": "refNo", "fooding": "refNo", "loans": "id"}


async def _missing_from_backup(backup_id: str) -> Dict[str, List[Dict]]:
    doc = await db.backups.find_one({"id": backup_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Backup not found")
    out: Dict[str, List[Dict]] = {}
    for coll in RESTORE_COLLECTIONS:
        rows = [r for r in (doc.get("collections") or {}).get(coll, []) if isinstance(r, dict) and r.get("id")]
        if not rows:
            continue
        have = set(await db[coll].distinct("id", {"id": {"$in": [r["id"] for r in rows]}}))
        miss = [r for r in rows if r["id"] not in have]
        if miss:
            out[coll] = miss
    return out


@api_router.get("/admin/nightly-backups/{backup_id}/missing")
async def nightly_backup_missing(backup_id: str, admin: Dict = Depends(require_super_admin)):
    miss = await _missing_from_backup(backup_id)
    items = [{"collection": c, "id": r["id"], "ref": r.get(RESTORE_KEYS[c]) or r.get("tempRefId") or r.get("permanentBillNo") or "", "name": r.get("vendorName") or r.get("name") or r.get("partyName") or r.get("description") or "", "amount": r.get("netPayable") or r.get("amount") or r.get("total") or r.get("grandTotal") or ""} for c, rs in miss.items() for r in rs]
    return {"backup_id": backup_id, "count": len(items), "items": items}


@api_router.post("/admin/nightly-backups/{backup_id}/restore-missing")
async def nightly_backup_restore_missing(backup_id: str, body: Dict = Body(default={}), admin: Dict = Depends(require_super_admin)):
    want = set(body.get("ids") or [])
    miss = await _missing_from_backup(backup_id)
    restored: Dict[str, int] = {}
    for coll, rows in miss.items():
        pick = [r for r in rows if not want or r["id"] in want]
        if pick:
            await db[coll].insert_many([dict(r) for r in pick])
            restored[coll] = len(pick)
    logger.info(f"Restore-missing from {backup_id} by {admin.get('email')}: {restored}")
    return {"ok": True, "restored": restored, "total": sum(restored.values())}



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
OPS_KINDS = {
    "projects": "PRJT", "dpr": "DPRS", "indent": "INDT", "qc_test": "QCTS", "safety_audit": "SAFE",
    "machine": "MACH", "machine_log": "RUNH", "diesel_log": "DESL", "booking": "BOOK", "demand_letter": "DMND",
    "tender": "TNDR", "agreement": "AGMT", "geo_site": "GEOS", "geo_att": "GATT",
    "labour": "LABR", "labour_att": "LATT", "labour_bill": "WAGE", "abstract": "ABST",
}
OPS_DEPT = {
    "projects": "site", "dpr": "site", "indent": "site", "qc_test": "qc", "safety_audit": "qc",
    "machine": "plant", "machine_log": "plant", "diesel_log": "plant", "booking": "client", "demand_letter": "client",
    "tender": "client", "agreement": "client", "geo_site": "hr", "geo_att": "hr", "labour": "hr", "labour_att": "hr", "labour_bill": "hr", "abstract": "client",
}
BACKUP_COLLECTIONS.extend(f"ops_{k}" for k in OPS_KINDS)


def _ops_coll(kind: str) -> str:
    if kind not in OPS_KINDS:
        raise HTTPException(status_code=404, detail="Unknown module")
    return f"ops_{kind}"


@api_router.get("/ops/{kind}")
async def ops_list(kind: str, user: Dict = Depends(get_current_user)):
    return await db[_ops_coll(kind)].find({}, {"_id": 0}).sort("updatedAt", -1).to_list(20000)


@api_router.post("/ops/{kind}")
async def ops_upsert(kind: str, body: Dict = Body(...), user: Dict = Depends(require_write)):
    coll = _ops_coll(kind)
    rid = body.get("id")
    if not rid:
        raise HTTPException(status_code=400, detail="id required")
    body.pop("_id", None)
    ex = await db[coll].find_one({"id": rid}, {"_id": 0}) or {}
    old, new = ex.get("status") or "Draft", body.get("status") or ex.get("status") or "Draft"
    dept = OPS_DEPT[kind]
    if not await _acl_ok(user, dept, "c"):
        raise HTTPException(status_code=403, detail="Aapko is department mein entry ki permission nahi hai")
    if ((new in ("Approved", "Rejected") and new != old) or old == "Approved") and not await _acl_ok(user, dept, "a"):
        raise HTTPException(status_code=403, detail="Approval / approved record change ki permission nahi hai")
    now = datetime.now(timezone.utc)
    if new == "Approved" and old != "Approved":
        body["approvedByName"] = user.get("name") or user.get("email")
        body["approvedAt"] = now.isoformat()
    for f in ("docNo", "tempNo", "permNo", "createdAt", "createdByName"):
        if ex.get(f):
            body[f] = ex[f]
    fy_start = now.year if now.month >= 4 else now.year - 1
    fy = f"{str(fy_start)[2:]}{str(fy_start + 1)[2:]}"
    code = OPS_KINDS[kind]

    async def _serial(k: str) -> int:
        c = await db.counters.find_one_and_update({"key": "ops"}, {"$inc": {k: 1}}, upsert=True, return_document=True)
        return int(c[k])
    if not body.get("docNo"):
        body["tempNo"] = f"AE/{code}/T{await _serial(f'{kind}_tmp_{fy}'):04d}/{fy}"
        body["docNo"] = body["tempNo"]
    if new == "Approved" and body.get("tempNo") and not body.get("permNo"):
        body["permNo"] = f"AE/{code}/{await _serial(f'{kind}_{fy}'):04d}/{fy}"
        body["docNo"] = body["permNo"]
    body.setdefault("createdAt", now.isoformat())
    body.setdefault("createdByName", user.get("name") or user.get("email"))
    body["status"] = new
    body["updatedAt"] = now.isoformat()
    await db[coll].replace_one({"id": rid}, body, upsert=True)
    return body


@api_router.delete("/ops/{kind}/{rid}")
async def ops_delete(kind: str, rid: str, user: Dict = Depends(get_current_user)):
    if not _crm_power(user):
        raise HTTPException(status_code=403, detail="Delete sirf SuperAdmin / Admin kar sakte hain")
    await db[_ops_coll(kind)].delete_one({"id": rid})
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
