"""Backend tests for Vendor Management API — Feb 2026 iteration (iter 26).
Covers:
 - Auth (SuperAdmin login via ADMIN_EMAIL/ADMIN_PASSWORD)
 - Cross-user data visibility fix (Point 3): require_write for /payments/bulk and /snapshot,
   plain 'User' role can create vendors/bills/snapshot without explicit perms.
 - Financial Year admin endpoints (Point 2): GET/POST /api/settings/fy
 - Regression: /api/vendors, /api/bills, /api/snapshot
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "arunenterprises2023@gmail.com"
ADMIN_PASSWORD = "Arun2023@12"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and len(data["token"]) > 20
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def regular_user(admin_token):
    """Create a plain 'User' role account (no perms map) for cross-user test (Point 3)."""
    headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    email = f"testuserx_{uuid.uuid4().hex[:6]}@arunenterprises.online"
    pwd = "TestPass@123"
    r = requests.post(f"{API}/auth/register", headers=headers,
                      json={"email": email, "password": pwd, "name": "Test User X", "role": "User"},
                      timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "User"
    # Login as this user
    r2 = requests.post(f"{API}/auth/login", json={"identifier": email, "password": pwd}, timeout=15)
    assert r2.status_code == 200, r2.text
    tok = r2.json()["token"]
    yield {"email": email, "token": tok}
    # Cleanup
    try:
        requests.delete(f"{API}/users/{email}", headers=headers, timeout=10)
    except Exception:
        pass


@pytest.fixture
def user_headers(regular_user):
    return {"Authorization": f"Bearer {regular_user['token']}", "Content-Type": "application/json"}


# ---------------- Health ----------------
def test_root_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
def test_login_admin_ok(admin_token):
    assert len(admin_token) > 20


def test_login_bad_password():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_auth_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["email"] == ADMIN_EMAIL
    assert "password_hash" not in d


# ---------------- Point 2: Financial Year endpoints ----------------
def test_fy_get_requires_auth():
    r = requests.get(f"{API}/settings/fy", timeout=10)
    assert r.status_code == 401


def test_fy_get_as_admin(admin_headers):
    r = requests.get(f"{API}/settings/fy", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert "active_fy" in d
    assert isinstance(d["active_fy"], str)


def test_fy_set_validation(admin_headers):
    r = requests.post(f"{API}/settings/fy", headers=admin_headers, json={"active_fy": "badformat"}, timeout=10)
    assert r.status_code == 400


def test_fy_set_4digit_and_verify(admin_headers):
    # set to 2526
    r = requests.post(f"{API}/settings/fy", headers=admin_headers, json={"active_fy": "2526"}, timeout=10)
    assert r.status_code == 200, r.text
    assert r.json()["active_fy"] == "2526"
    # GET verify persistence
    r2 = requests.get(f"{API}/settings/fy", headers=admin_headers, timeout=10)
    assert r2.status_code == 200
    assert r2.json()["active_fy"] == "2526"
    # reset (empty)
    requests.post(f"{API}/settings/fy", headers=admin_headers, json={"active_fy": ""}, timeout=10)


def test_fy_set_requires_admin(user_headers):
    r = requests.post(f"{API}/settings/fy", headers=user_headers, json={"active_fy": "2526"}, timeout=10)
    assert r.status_code == 403


# ---------------- Point 3 CRITICAL: Cross-user data visibility ----------------
def test_regular_user_can_create_vendor(user_headers):
    """Plain 'User' role (no perms map) must be allowed to POST /vendors — this was the silent-403 bug."""
    vid = f"TEST_cross_v_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/vendors", headers=user_headers,
                      json={"id": vid, "firmName": "CrossUserVendor", "mobileNo": "9888888888"},
                      timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"


def test_regular_user_can_create_bill(user_headers):
    bid = f"TEST_cross_b_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/bills", headers=user_headers,
                      json={"id": bid, "amount": 1234, "billNo": "CU-001"},
                      timeout=10)
    assert r.status_code == 200, r.text


def test_regular_user_can_push_payments_bulk(user_headers):
    """Previously require_approver → 403. Now require_write → should accept."""
    items = [{"id": f"TEST_cross_pv_{uuid.uuid4().hex[:6]}", "pvNo": "PV/CU/1", "amount": 100}]
    r = requests.post(f"{API}/payments/bulk", headers=user_headers, json={"items": items}, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    assert r.json().get("count") == 1


def test_regular_user_can_push_snapshot(user_headers):
    """Previously require_approver → 403. Now require_write → should accept."""
    vid = f"TEST_cross_snap_{uuid.uuid4().hex[:8]}"
    payload = {
        "vendors": [{"id": vid, "firmName": "CrossUserSnap"}],
        "bills": [], "payments": [], "counters": {}, "logo": ""
    }
    r = requests.post(f"{API}/snapshot", headers=user_headers, json=payload, timeout=15)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"


def test_vendor_created_by_user_visible_to_admin(user_headers, admin_headers):
    """Cross-device visibility — admin should see data created by regular user."""
    vid = f"TEST_cross_vis_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/vendors", headers=user_headers,
                      json={"id": vid, "firmName": "VisibleAcrossUsers"},
                      timeout=10)
    assert r.status_code == 200, r.text
    # Admin lists
    r2 = requests.get(f"{API}/vendors", headers=admin_headers, timeout=10)
    assert r2.status_code == 200
    vendors = r2.json()
    matched = [v for v in vendors if v.get("id") == vid]
    assert len(matched) == 1, f"Vendor created by regular user not visible to admin! Found {len(matched)}"
    assert matched[0]["firmName"] == "VisibleAcrossUsers"
    # cleanup via admin
    requests.delete(f"{API}/vendors/{vid}", headers=admin_headers, timeout=10)


# ---------------- Regression: Vendors / Bills / Snapshot ----------------
def test_vendors_requires_auth():
    r = requests.get(f"{API}/vendors", timeout=10)
    assert r.status_code == 401


def test_vendor_upsert_and_list_admin(admin_headers):
    vid = f"TEST_v_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/vendors", headers=admin_headers,
                      json={"id": vid, "firmName": "AdminVendor"}, timeout=10)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/vendors", headers=admin_headers, timeout=10)
    assert r2.status_code == 200
    assert any(v.get("id") == vid for v in r2.json())
    requests.delete(f"{API}/vendors/{vid}", headers=admin_headers, timeout=10)


def test_snapshot_get_admin(admin_headers):
    r = requests.get(f"{API}/snapshot", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ("vendors", "bills", "payments", "counters"):
        assert k in d
