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
    email: Optional[str] = None  # admin can change any user's password; user can change own


@api_router.post("/users/change-password")
async def change_password(body: ChangePasswordBody, user: Dict = Depends(get_current_user)):
    new_pass = (body.new_password or "").strip()
    if len(new_pass) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    target_email = (body.email or user["email"]).lower().strip()
    # Only admin can change another user's password
    if target_email != user["email"] and (user.get("role") or "").lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required to change another user's password")
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
    return {
        "token": token,
        "user": {"email": user["email"], "name": user["name"], "role": user["role"]},
    }


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
async def delete_vendor(vid: str, user: Dict = Depends(get_current_user)):
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
async def delete_bill(bid: str, user: Dict = Depends(get_current_user)):
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


# ==================== SNAPSHOT (full sync) ====================
@api_router.get("/snapshot")
async def snapshot(user: Dict = Depends(get_current_user)):
    return {
        "vendors": await _list_collection("vendors"),
        "bills": await _list_collection("bills"),
        "payments": await _list_collection("payments"),
        "counters": (await db.counters.find_one({"key": "global"}, {"_id": 0})) or {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0},
        "logo": ((await db.settings.find_one({"key": "logo"}, {"_id": 0})) or {}).get("value", ""),
    }


@api_router.post("/snapshot")
async def push_snapshot(body: Dict = Body(...), user: Dict = Depends(get_current_user)):
    """One-shot migration/push of the client's full state to the cloud."""
    vendors = body.get("vendors", [])
    bills = body.get("bills", [])
    payments = body.get("payments", [])
    counters = body.get("counters", {"vendorSerial": 0, "billSerial": 0, "pvSerial": 0})
    logo = body.get("logo", "")
    # Merge (upsert by id) instead of replace, to avoid data loss across devices
    for v in vendors:
        if v.get("id"):
            await db.vendors.update_one({"id": v["id"]}, {"$set": v}, upsert=True)
    for b in bills:
        if b.get("id"):
            await db.bills.update_one({"id": b["id"]}, {"$set": b}, upsert=True)
    if payments:
        await _replace_collection("payments", payments)
    counters["key"] = "global"
    await db.counters.update_one({"key": "global"}, {"$set": counters}, upsert=True)
    if logo:
        await db.settings.update_one({"key": "logo"}, {"$set": {"value": logo}}, upsert=True)
    return {
        "vendors": len(vendors), "bills": len(bills), "payments": len(payments),
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
