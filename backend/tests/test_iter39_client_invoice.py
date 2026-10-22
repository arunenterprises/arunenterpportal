# Iteration 39: Client Tax Invoice (crm_invoices) — counter, workflow RBAC, persistence, delete RBAC
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
RUN = uuid.uuid4().hex[:6]
USER_EMAIL = f"test_iter39_u_{RUN}@example.com"
PW = "Test@1234"
INV_ID = f"TEST_inv_{RUN}"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sa_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SA, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user_token(sa_token):
    r = requests.post(f"{BASE_URL}/api/auth/register", headers=_h(sa_token),
                      json={"email": USER_EMAIL, "password": PW, "name": "TEST_iter39", "role": "User"}, timeout=30)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": USER_EMAIL, "password": PW}, timeout=30)
    assert r.status_code == 200, r.text
    yield r.json()["token"]
    requests.delete(f"{BASE_URL}/api/crm/invoices/{INV_ID}", headers=_h(sa_token), timeout=30)
    requests.delete(f"{BASE_URL}/api/users/{USER_EMAIL}", headers=_h(sa_token), timeout=30)


# ---- counter ----
def test_next_number_inv_floor_and_increment(sa_token):
    a = requests.post(f"{BASE_URL}/api/crm/next-number/inv_2627", headers=_h(sa_token), json={}, timeout=30)
    assert a.status_code == 200, a.text
    s1 = a.json()["serial"]
    assert s1 >= 49
    b = requests.post(f"{BASE_URL}/api/crm/next-number/inv_2627", headers=_h(sa_token), json={}, timeout=30)
    assert b.json()["serial"] == s1 + 1


def test_next_number_new_fy_starts_49(sa_token):
    # new FY key (far future so we don't collide with real data)
    r = requests.post(f"{BASE_URL}/api/crm/next-number/inv_9900", headers=_h(sa_token), json={}, timeout=30)
    assert r.status_code == 200
    assert r.json()["serial"] == 49 or r.json()["serial"] > 49


def test_next_number_invalid_kind(sa_token):
    for k in ("inv_26", "inv_abcd", "foo"):
        r = requests.post(f"{BASE_URL}/api/crm/next-number/{k}", headers=_h(sa_token), json={}, timeout=30)
        assert r.status_code == 400, k


def test_next_number_requires_auth():
    r = requests.post(f"{BASE_URL}/api/crm/next-number/inv_2627", json={}, timeout=30)
    assert r.status_code in (401, 403)


# ---- workflow RBAC ----
def test_non_admin_create_and_submit_ok(user_token):
    body = {"id": INV_ID, "invoiceNo": "A/E/INV/TEST/2627", "clientId": "TEST_cl1", "step": 1,
            "lines": [{"description": "x", "qty": 1, "rate": 100, "gstPct": 18}], "total": 118}
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user_token), json=body, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["createdByName"]
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user_token), json={**body, "step": 2}, timeout=30)
    assert r.status_code == 200 and r.json()["step"] == 2


def test_non_admin_approve_403(user_token):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user_token), json={"id": INV_ID, "step": 3}, timeout=30)
    assert r.status_code == 403


def test_non_admin_delete_403(user_token):
    r = requests.delete(f"{BASE_URL}/api/crm/invoices/{INV_ID}", headers=_h(user_token), timeout=30)
    assert r.status_code == 403


def test_superadmin_approve_sets_approver(sa_token):
    cur = [x for x in requests.get(f"{BASE_URL}/api/crm/invoices", headers=_h(sa_token), timeout=30).json() if x["id"] == INV_ID][0]
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa_token), json={**cur, "step": 3, "approvedByName": "HACK"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["step"] == 3 and d["approvedByName"] != "HACK" and d["approvedAt"]
    assert "_id" not in d


def test_non_admin_cannot_modify_approved(user_token):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user_token), json={"id": INV_ID, "step": 1, "total": 1}, timeout=30)
    assert r.status_code == 403


def test_list_persisted_and_delete(sa_token, user_token):
    lst = requests.get(f"{BASE_URL}/api/crm/invoices", headers=_h(sa_token), timeout=30).json()
    assert any(x["id"] == INV_ID and x["step"] == 3 for x in lst)
    r = requests.delete(f"{BASE_URL}/api/crm/invoices/{INV_ID}", headers=_h(sa_token), timeout=30)
    assert r.status_code == 200 and r.json()["deleted"] == 1
    lst = requests.get(f"{BASE_URL}/api/crm/invoices", headers=_h(sa_token), timeout=30).json()
    assert not any(x["id"] == INV_ID for x in lst)
