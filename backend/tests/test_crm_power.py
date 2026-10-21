# CRM _crm_power tests: delete / step-3 approval / retention release only SuperAdmin + Admin (iteration 32)
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
PW = "TestPass@123"
USERS = {
    "gm": ("test_crm32_gm@example.com", "GM", {"create": True, "edit": True, "submit": True, "approve": True}),
    "user": ("test_crm32_user@example.com", "User", {"create": True, "edit": True, "submit": True, "approve": True}),
    "admin": ("test_crm32_admin@example.com", "Admin", None),
}


def _mongo():
    env = {}
    for line in open("/app/backend/.env"):
        if "=" in line:
            k, v = line.strip().split("=", 1)
            env[k] = v.strip('"')
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


def rid(p):
    return f"TEST_{p}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def sa():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def sessions(sa):
    db = _mongo()
    out = {}
    for k, (email, role, perms) in USERS.items():
        db.users.delete_one({"email": email})
        body = {"email": email, "password": PW, "name": f"TEST {k}", "role": role}
        if perms:
            body["permissions"] = perms
        r = sa.post(f"{BASE_URL}/api/auth/register", json=body)
        assert r.status_code in (200, 201), r.text
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": email, "password": PW})
        assert r.status_code == 200, r.text
        s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
        out[k] = s
    yield out
    for k, (email, _, _) in USERS.items():
        r = sa.delete(f"{BASE_URL}/api/users/{email}")
        db.users.delete_one({"email": email})
    for c in ["leads", "clients", "contracts", "mb", "ra_bills", "retention_releases"]:
        db[f"crm_{c}"].delete_many({"id": {"$regex": "^TEST_"}})


@pytest.mark.parametrize("who", ["gm", "user"])
def test_nonadmin_delete_lead_403(sa, sessions, who):
    lid = rid("lead")
    assert sa.post(f"{BASE_URL}/api/crm/leads", json={"id": lid, "name": "TEST lead"}).status_code == 200
    r = sessions[who].delete(f"{BASE_URL}/api/crm/leads/{lid}")
    assert r.status_code == 403, r.text
    assert any(x["id"] == lid for x in sa.get(f"{BASE_URL}/api/crm/leads").json())


@pytest.mark.parametrize("who", ["gm", "user"])
def test_nonadmin_mb_step3_403_but_step2_ok(sessions, who):
    mid = rid("mb")
    s = sessions[who]
    assert s.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 1, "qty": 1}).status_code == 200
    assert s.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 2, "qty": 1}).status_code == 200
    r = s.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 3, "qty": 1})
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("who", ["gm", "user"])
def test_nonadmin_retention_release_403(sessions, who):
    r = sessions[who].post(f"{BASE_URL}/api/crm/retention_releases", json={"id": rid("rr"), "contractId": "TEST_none", "amount": 0})
    assert r.status_code == 403, r.text


def test_nonadmin_can_edit_and_create(sessions):
    lid = rid("lead")
    s = sessions["user"]
    assert s.post(f"{BASE_URL}/api/crm/leads", json={"id": lid, "name": "A"}).status_code == 200
    r = s.post(f"{BASE_URL}/api/crm/leads", json={"id": lid, "name": "B"})
    assert r.status_code == 200 and r.json()["name"] == "B"


@pytest.mark.parametrize("who", ["admin", "sa"])
def test_admin_and_superadmin_allowed(sa, sessions, who):
    s = sa if who == "sa" else sessions["admin"]
    mid = rid("mb")
    assert s.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 2, "qty": 1}).status_code == 200
    r = s.post(f"{BASE_URL}/api/crm/mb", json={"id": mid, "step": 3, "qty": 1})
    assert r.status_code == 200 and r.json()["approvedByName"]
    r = s.post(f"{BASE_URL}/api/crm/retention_releases", json={"id": rid("rr"), "contractId": "TEST_none", "amount": 0})
    assert r.status_code == 200, r.text
    lid = rid("lead")
    s.post(f"{BASE_URL}/api/crm/leads", json={"id": lid, "name": "del"})
    r = s.delete(f"{BASE_URL}/api/crm/leads/{lid}")
    assert r.status_code == 200 and r.json()["deleted"] == 1
    assert not any(x["id"] == lid for x in sa.get(f"{BASE_URL}/api/crm/leads").json())


def test_ra_bill_delete_at_step5_superadmin(sa):
    bid = rid("ra")
    for st in (1, 2, 3, 4, 5):
        assert sa.post(f"{BASE_URL}/api/crm/ra_bills", json={"id": bid, "step": st, "raNo": "TEST/RA"}).status_code == 200
    r = sa.delete(f"{BASE_URL}/api/crm/ra_bills/{bid}")
    assert r.status_code == 200 and r.json()["deleted"] == 1
