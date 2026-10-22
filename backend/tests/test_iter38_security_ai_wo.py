# Iteration 38: security audit fixes (SEC-002 logout/force_logout, SEC-004 approved-record
# financial lock, login rate limit, fooding delete RBAC) + AI Work Order terms endpoint.
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
RUN = uuid.uuid4().hex[:6]
USER_EMAIL = f"test_iter38_u_{RUN}@example.com"
LOCK_EMAIL = f"test_iter38_lock_{RUN}@example.com"
PW = "Test@1234"


def _login(ident, pw):
    return requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": ident, "password": pw}, timeout=30)


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def sa_token():
    r = _login(SA["identifier"], SA["password"])
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def users(sa_token):
    for em in (USER_EMAIL, LOCK_EMAIL):
        r = requests.post(f"{BASE_URL}/api/auth/register", headers=_h(sa_token),
                          json={"email": em, "password": PW, "name": "TEST_iter38", "role": "User"}, timeout=30)
        assert r.status_code == 200, r.text
    yield
    for em in (USER_EMAIL, LOCK_EMAIL):
        requests.delete(f"{BASE_URL}/api/users/{em}", headers=_h(sa_token), timeout=30)
    for coll, rid in (("paybills", f"TEST_PB_{RUN}"), ("bills", f"TEST_BILL_{RUN}"), ("fooding", f"TEST_FD_{RUN}")):
        requests.delete(f"{BASE_URL}/api/{coll}/{rid}", headers=_h(sa_token), timeout=30)


@pytest.fixture(scope="module")
def user_token():
    r = _login(USER_EMAIL, PW)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---- AI WO terms ----
class TestAiWo:
    def test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/ai/wo-terms", json={"items": []}, timeout=30)
        assert r.status_code == 401

    def test_generate(self, sa_token):
        body = {"vendorName": "TEST Vendor", "projectSite": "Lucknow Site", "items": [
            {"description": "Brick masonry 230mm wall in CM 1:6", "qty": 50, "unit": "cum", "rate": 5200},
            {"description": "Cement plaster 12mm", "qty": 400, "unit": "sqm", "rate": 260}],
            "paymentTerms": "30 days after bill", "deliveryTerms": "Within 45 days",
            "penaltyClause": "0.5% per week delay", "warrantyClause": "12 months",
            "termsAndConditions": "1. GST extra as applicable"}
        r = requests.post(f"{BASE_URL}/api/ai/wo-terms", headers=_h(sa_token), json=body, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["scopeOfWork"], str) and len(d["scopeOfWork"]) > 100
        assert isinstance(d["aiTerms"], str) and "1." in d["aiTerms"]
        print("SCOPE:", d["scopeOfWork"][:300])
        print("TERMS:", d["aiTerms"][:1500])


# ---- Fooding delete RBAC ----
class TestFooding:
    def test_non_admin_delete_403(self, sa_token, user_token):
        r = requests.post(f"{BASE_URL}/api/fooding", headers=_h(sa_token), json={"id": f"TEST_FD_{RUN}", "amount": 1}, timeout=30)
        assert r.status_code == 200
        r = requests.delete(f"{BASE_URL}/api/fooding/TEST_FD_{RUN}", headers=_h(user_token), timeout=30)
        assert r.status_code == 403


# ---- SEC-004 approved-record financial lock ----
class TestApprovedLock:
    def test_paybill_lock(self, sa_token, user_token):
        rid = f"TEST_PB_{RUN}"
        base = {"id": rid, "step": 3, "netPayable": 1000, "remarks": "orig", "utrNo": ""}
        r = requests.post(f"{BASE_URL}/api/paybills", headers=_h(sa_token), json=base, timeout=30)
        assert r.status_code == 200, r.text
        # user changes amount -> 403
        r = requests.post(f"{BASE_URL}/api/paybills", headers=_h(user_token), json={**base, "netPayable": 99999}, timeout=30)
        assert r.status_code == 403, r.text
        # user changes non-financial -> OK
        r = requests.post(f"{BASE_URL}/api/paybills", headers=_h(user_token), json={**base, "utrNo": "UTR1", "remarks": "x"}, timeout=30)
        assert r.status_code == 200, r.text
        # approver can change amount
        r = requests.post(f"{BASE_URL}/api/paybills", headers=_h(sa_token), json={**base, "utrNo": "UTR1", "netPayable": 1200}, timeout=30)
        assert r.status_code == 200, r.text

    def test_bill_lock(self, sa_token, user_token):
        rid = f"TEST_BILL_{RUN}"
        base = {"id": rid, "step": 3, "basicAmount": 5000, "billNo": "TEST_B1", "remarks": "a"}
        r = requests.post(f"{BASE_URL}/api/bills", headers=_h(sa_token), json=base, timeout=30)
        assert r.status_code == 200, r.text
        r = requests.post(f"{BASE_URL}/api/bills", headers=_h(user_token), json={**base, "basicAmount": 1}, timeout=30)
        assert r.status_code == 403
        r = requests.post(f"{BASE_URL}/api/bills", headers=_h(user_token), json={**base, "remarks": "b"}, timeout=30)
        assert r.status_code == 200, r.text

    def test_step_demotion_bypass(self, sa_token, user_token):
        """Non-approver lowers step 3->1 together with an amount change: should be blocked."""
        rid = f"TEST_BILL_{RUN}"
        r = requests.post(f"{BASE_URL}/api/bills", headers=_h(user_token),
                          json={"id": rid, "step": 1, "basicAmount": 777777, "billNo": "TEST_B1"}, timeout=30)
        bills = requests.get(f"{BASE_URL}/api/bills", headers=_h(sa_token), timeout=30).json()
        b = next((x for x in bills if x.get("id") == rid), {})
        print("demotion status", r.status_code, "stored:", b.get("step"), b.get("basicAmount"))
        assert r.status_code == 403, f"bypass: non-approver demoted approved bill & changed amount -> {b.get('step')}/{b.get('basicAmount')}"


# ---- SEC-002 logout / force_logout ----
class TestSessions:
    def test_logout_invalidates(self, user_token):
        assert requests.get(f"{BASE_URL}/api/snapshot", headers=_h(user_token), timeout=60).status_code == 200
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=_h(user_token), timeout=30)
        assert r.status_code == 200
        assert requests.get(f"{BASE_URL}/api/snapshot", headers=_h(user_token), timeout=60).status_code == 401

    def test_force_logout(self, sa_token):
        r = _login(USER_EMAIL, PW)
        assert r.status_code == 200, r.text
        tok = r.json()["token"]
        assert requests.get(f"{BASE_URL}/api/vendors", headers=_h(tok), timeout=30).status_code == 200
        r = requests.post(f"{BASE_URL}/api/users/{USER_EMAIL}/force_logout", headers=_h(sa_token), timeout=30)
        assert r.status_code == 200 and r.json()["updated"] == 1
        assert requests.get(f"{BASE_URL}/api/vendors", headers=_h(tok), timeout=30).status_code == 401


# ---- Login rate limit ----
class TestRateLimit:
    def test_429_after_5(self):
        codes = [_login(LOCK_EMAIL, "wrong_pw").status_code for _ in range(5)]
        assert codes == [401] * 5
        r = _login(LOCK_EMAIL, PW)
        assert r.status_code == 429, r.text
