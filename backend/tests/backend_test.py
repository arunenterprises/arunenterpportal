"""Backend tests for Vendor Management API (cloud sync + JWT auth)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or \
    open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "ashishsrivastava085@gmail.com"
ADMIN_PASSWORD = "admin@123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and len(data["token"]) > 20
    assert data["user"]["email"] == ADMIN_EMAIL
    assert data["user"]["role"] == "Admin"
    return data["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- Health ----
def test_root_health():
    r = requests.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d.get("status") == "ok"
    assert "message" in d


# ---- Auth ----
def test_login_invalid_password():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
    assert r.status_code == 401
    assert "Invalid email or password" in r.text


def test_register_and_duplicate():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Test User"}, timeout=10)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "token" in d
    assert d["user"]["email"] == email
    assert d["user"]["role"] == "User"
    # Duplicate
    r2 = requests.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Test User"}, timeout=10)
    assert r2.status_code == 400
    assert "already registered" in r2.text


def test_auth_me(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    assert d["email"] == ADMIN_EMAIL
    assert d["role"] == "Admin"
    assert "password_hash" not in d


def test_auth_me_no_token():
    r = requests.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 401


# ---- Vendors ----
def test_vendor_upsert_and_list(auth_headers):
    vid = f"TEST_v_{uuid.uuid4().hex[:8]}"
    payload = {"id": vid, "firmName": "CrossDevice Test Ltd", "mobileNo": "9999999999"}
    r = requests.post(f"{API}/vendors", headers=auth_headers, json=payload, timeout=10)
    assert r.status_code == 200, r.text
    # GET verify
    r2 = requests.get(f"{API}/vendors", headers=auth_headers, timeout=10)
    assert r2.status_code == 200
    vendors = r2.json()
    matched = [v for v in vendors if v.get("id") == vid]
    assert len(matched) == 1
    assert matched[0]["firmName"] == "CrossDevice Test Ltd"
    # cleanup
    requests.delete(f"{API}/vendors/{vid}", headers=auth_headers, timeout=10)


def test_vendors_requires_auth():
    r = requests.get(f"{API}/vendors", timeout=10)
    assert r.status_code == 401


# ---- Bills ----
def test_bill_upsert_and_list(auth_headers):
    bid = f"TEST_b_{uuid.uuid4().hex[:8]}"
    r = requests.post(f"{API}/bills", headers=auth_headers, json={"id": bid, "amount": 500}, timeout=10)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/bills", headers=auth_headers, timeout=10)
    assert r2.status_code == 200
    assert any(b.get("id") == bid for b in r2.json())
    requests.delete(f"{API}/bills/{bid}", headers=auth_headers, timeout=10)


# ---- Payments ----
def test_payments_bulk_replace(auth_headers):
    items = [{"id": "TEST_p1", "amount": 100}, {"id": "TEST_p2", "amount": 200}]
    r = requests.post(f"{API}/payments/bulk", headers=auth_headers, json={"items": items}, timeout=10)
    assert r.status_code == 200
    assert r.json()["count"] == 2
    r2 = requests.get(f"{API}/payments", headers=auth_headers, timeout=10)
    assert r2.status_code == 200
    ids = {p.get("id") for p in r2.json()}
    assert {"TEST_p1", "TEST_p2"}.issubset(ids)


# ---- Snapshot ----
def test_snapshot_get(auth_headers):
    r = requests.get(f"{API}/snapshot", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    d = r.json()
    for k in ("vendors", "bills", "payments", "counters", "logo"):
        assert k in d
    assert isinstance(d["vendors"], list)


def test_snapshot_post_merge(auth_headers):
    vid = f"TEST_snap_{uuid.uuid4().hex[:8]}"
    payload = {
        "vendors": [{"id": vid, "firmName": "SnapVendor"}],
        "bills": [],
        "payments": [],
        "counters": {"vendorSerial": 5, "billSerial": 3, "pvSerial": 2},
        "logo": "",
    }
    r = requests.post(f"{API}/snapshot", headers=auth_headers, json=payload, timeout=10)
    assert r.status_code == 200
    # Verify persisted
    r2 = requests.get(f"{API}/vendors", headers=auth_headers, timeout=10)
    assert any(v.get("id") == vid for v in r2.json())
    requests.delete(f"{API}/vendors/{vid}", headers=auth_headers, timeout=10)
