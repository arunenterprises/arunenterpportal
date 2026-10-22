# Iteration 40: Client Tax Invoice — refNo counter, server-assigned invoiceNo on approval, step-2 lock, sent/paid
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
RUN = uuid.uuid4().hex[:6]
USER_EMAIL = f"test_iter40_u_{RUN}@example.com"
PW = "Test@1234"
INV1 = f"TEST_inv40a_{RUN}"
INV2 = f"TEST_inv40b_{RUN}"
CL = "TEST_cl1"


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _inv(iid, **kw):
    b = {"id": iid, "clientId": CL, "invoiceDate": "2026-10-22", "refNo": "", "step": 1,
         "lines": [{"description": "TEST item", "qty": 10, "rate": 100, "gstPct": 18}], "total": 1180}
    b.update(kw)
    return b


def _get(tok, iid):
    r = requests.get(f"{BASE_URL}/api/crm/invoices", headers=_h(tok), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("invoices") or []
    return next((x for x in items if x.get("id") == iid), None)


@pytest.fixture(scope="module")
def sa():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=SA, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def user(sa):
    r = requests.post(f"{BASE_URL}/api/auth/register", headers=_h(sa),
                      json={"email": USER_EMAIL, "password": PW, "name": "TEST_iter40", "role": "User"}, timeout=30)
    assert r.status_code == 200, r.text
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": USER_EMAIL, "password": PW}, timeout=30)
    assert r.status_code == 200, r.text
    yield r.json()["token"]
    for i in (INV1, INV2):
        requests.delete(f"{BASE_URL}/api/crm/invoices/{i}", headers=_h(sa), timeout=30)
    requests.delete(f"{BASE_URL}/api/users/{USER_EMAIL}", headers=_h(sa), timeout=30)


def test_invref_counter(sa):
    a = requests.post(f"{BASE_URL}/api/crm/next-number/invref_2627", headers=_h(sa), json={}, timeout=30)
    assert a.status_code == 200, a.text
    b = requests.post(f"{BASE_URL}/api/crm/next-number/invref_2627", headers=_h(sa), json={}, timeout=30)
    assert b.json()["serial"] == a.json()["serial"] + 1


def test_client_invoiceno_ignored(user, sa):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, invoiceNo="HACK", refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["invoiceNo"] == ""
    g = _get(sa, INV1)
    assert g and g["invoiceNo"] == "" and g["refNo"] == "INV-REF/2627/9001"


def test_user_can_submit(user):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, step=2, refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["step"] == 2 and r.json()["invoiceNo"] == ""


def test_user_cannot_modify_submitted(user, sa):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, step=2, total=99999), timeout=30)
    assert r.status_code == 403, r.text
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, step=1), timeout=30)
    assert r.status_code == 403, r.text
    assert _get(sa, INV1)["total"] == 1180


def test_user_cannot_approve(user):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, step=3), timeout=30)
    assert r.status_code == 403


def test_sa_can_modify_submitted(sa):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV1, step=2, total=1180, poNo="TEST_PO", refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["poNo"] == "TEST_PO"


def test_approve_assigns_number_and_increments(sa, user):
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV1, step=3, invoiceNo="HACK2", refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200, r.text
    n1 = r.json()["invoiceNo"]
    assert n1.startswith("A/E/INV/") and n1.endswith("/2627"), n1
    s1 = int(n1.split("/")[3])
    assert s1 >= 49
    assert r.json().get("approvedByName")
    # second invoice
    requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV2, step=2, refNo="INV-REF/2627/9002"), timeout=30)
    r2 = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV2, step=3, refNo="INV-REF/2627/9002"), timeout=30)
    assert r2.status_code == 200
    assert r2.json()["invoiceNo"] == f"A/E/INV/{s1 + 1:05d}/2627"
    # re-save approved keeps number, client-sent number ignored
    r3 = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV1, step=3, invoiceNo="X", refNo="INV-REF/2627/9001"), timeout=30)
    assert r3.json()["invoiceNo"] == n1
    # non-admin can't touch approved
    r4 = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(user), json=_inv(INV1, step=3), timeout=30)
    assert r4.status_code == 403


def test_sent_and_paid(sa):
    n1 = _get(sa, INV1)["invoiceNo"]
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV1, step=4, sentAt="2026-10-22", refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200 and r.json()["step"] == 4 and r.json()["invoiceNo"] == n1
    r = requests.post(f"{BASE_URL}/api/crm/invoices", headers=_h(sa), json=_inv(INV1, step=5, sentAt="2026-10-22", receivedAmount=1180, receivedDate="2026-10-25", utr="TESTUTR123", refNo="INV-REF/2627/9001"), timeout=30)
    assert r.status_code == 200
    g = _get(sa, INV1)
    assert g["step"] == 5 and g["utr"] == "TESTUTR123" and g["invoiceNo"] == n1 and g.get("approvedByName")
