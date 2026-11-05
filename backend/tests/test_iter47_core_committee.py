# Iteration 47: Core Committee — core_project / core_progress / core_escalation + Member role discipline filtering + core_all toggle
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
TAG = uuid.uuid4().hex[:6]
OHE_EMAIL = f"test_member_ohe_{TAG}@example.com"
USER_EMAIL = f"test_plain_user_{TAG}@example.com"
PWD = "Test@1234"
IDS = {"core_project": [], "core_progress": [], "core_escalation": []}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    yield s
    # cleanup: only records/users this module created
    for kind, ids in IDS.items():
        for rid in ids:
            s.delete(f"{BASE_URL}/api/ops/{kind}/{rid}")
    for em in (OHE_EMAIL, USER_EMAIL):
        s.delete(f"{BASE_URL}/api/users/{em}")


def _login_as(admin, email):
    r = admin.post(f"{BASE_URL}/api/admin/users/{email}/otp-reset")
    assert r.status_code == 200, r.text
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": email, "password": PWD})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("token"), d
    s.headers["Authorization"] = f"Bearer {d['token']}"
    return s, d


class TestCoreCommittee:
    def test_01_create_core_project_civil(self, admin):
        rid = f"TEST_cprj_civil_{TAG}"
        r = admin.post(f"{BASE_URL}/api/ops/core_project", json={"id": rid, "discipline": "CIVIL", "name": f"TEST Core Civil Project {TAG}", "startDate": "2026-01-01", "member": "Member Civil", "status": "Draft"})
        assert r.status_code == 200, r.text
        IDS["core_project"].append(rid)
        d = r.json()
        assert d["docNo"].startswith("AE/CPRJ/T") and d["docNo"].split("/")[-1] in ("2526", "2627"), d["docNo"]
        lst = admin.get(f"{BASE_URL}/api/ops/core_project").json()
        assert any(x["id"] == rid for x in lst)

    def test_02_create_core_project_ohe_progress_escalation(self, admin):
        rid = f"TEST_cprj_ohe_{TAG}"
        r = admin.post(f"{BASE_URL}/api/ops/core_project", json={"id": rid, "discipline": "OHE", "name": f"TEST Core OHE Project {TAG}", "startDate": "2026-01-01"})
        assert r.status_code == 200, r.text
        IDS["core_project"].append(rid)
        wid = f"TEST_cwrk_{TAG}"
        r = admin.post(f"{BASE_URL}/api/ops/core_progress", json={"id": wid, "discipline": "CIVIL", "project": f"TEST Core Civil Project {TAG}", "module": "RCC", "unit": "Cum", "scopeQty": 100, "prevQty": 20, "todayQty": 10, "cumQty": 30, "progressPct": 30, "date": "2026-01-10"})
        assert r.status_code == 200, r.text
        IDS["core_progress"].append(wid)
        assert r.json()["docNo"].startswith("AE/CWRK/T")
        eid = f"TEST_cesc_{TAG}"
        r = admin.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": eid, "discipline": "CIVIL", "project": f"TEST Core Civil Project {TAG}", "issue": "TEST issue", "priority": "High", "level": "L1 · Site Engineer", "estatus": "Open", "date": "2026-01-06"})
        assert r.status_code == 200, r.text
        IDS["core_escalation"].append(eid)
        assert r.json()["docNo"].startswith("AE/CESC/T")

    def test_03_register_member_ohe_and_plain_user(self, admin):
        r = admin.post(f"{BASE_URL}/api/auth/register", json={"email": OHE_EMAIL, "name": "TEST Member OHE", "password": PWD, "role": "Member OHE"})
        assert r.status_code == 200, r.text
        r = admin.post(f"{BASE_URL}/api/auth/register", json={"email": USER_EMAIL, "name": "TEST Plain User", "password": PWD, "role": "User"})
        assert r.status_code == 200, r.text
        users = admin.get(f"{BASE_URL}/api/users").json()
        users = users.get("users", users) if isinstance(users, dict) else users
        u = next(x for x in users if x["email"] == OHE_EMAIL)
        assert u["role"] == "Member OHE"

    def test_04_member_ohe_filtered_and_blocked(self, admin):
        s, d = _login_as(admin, OHE_EMAIL)
        assert d["user"]["role"] == "Member OHE"
        lst = s.get(f"{BASE_URL}/api/ops/core_project").json()
        discs = {x.get("discipline") for x in lst}
        assert discs <= {"OHE"}, discs
        assert any(x["id"] == f"TEST_cprj_ohe_{TAG}" for x in lst)
        assert not any(x["id"] == f"TEST_cprj_civil_{TAG}" for x in lst)
        for k in ("core_progress", "core_escalation"):
            assert all(x.get("discipline") == "OHE" for x in s.get(f"{BASE_URL}/api/ops/{k}").json())
        r = s.post(f"{BASE_URL}/api/ops/core_project", json={"id": f"TEST_cprj_bad_{TAG}", "discipline": "CIVIL", "name": "TEST bad"})
        assert r.status_code == 403, r.text
        # Member cannot overwrite existing CIVIL record by relabeling it OHE
        r = s.post(f"{BASE_URL}/api/ops/core_project", json={"id": f"TEST_cprj_civil_{TAG}", "discipline": "OHE", "name": "TEST hijack"})
        assert r.status_code == 403, r.text
        # Member can create in own discipline
        rid = f"TEST_cprj_ohe2_{TAG}"
        r = s.post(f"{BASE_URL}/api/ops/core_project", json={"id": rid, "discipline": "OHE", "name": f"TEST Member OHE own {TAG}"})
        assert r.status_code == 200, r.text
        IDS["core_project"].append(rid)
        # Member cannot delete (Admin only)
        r = s.delete(f"{BASE_URL}/api/ops/core_project/{f'TEST_cprj_civil_{TAG}'}")
        assert r.status_code == 403, r.text

    def test_05_core_all_toggle(self, admin):
        r = admin.patch(f"{BASE_URL}/api/users/{OHE_EMAIL}/core-access", json={"core_all": True})
        assert r.status_code == 200 and r.json()["core_all"] is True
        s, _ = _login_as(admin, OHE_EMAIL)
        me = s.get(f"{BASE_URL}/api/auth/me").json()
        assert me.get("core_all") is True
        lst = s.get(f"{BASE_URL}/api/ops/core_project").json()
        assert any(x["id"] == f"TEST_cprj_civil_{TAG}" for x in lst)
        r = admin.patch(f"{BASE_URL}/api/users/{OHE_EMAIL}/core-access", json={"core_all": False})
        assert r.status_code == 200
        lst = s.get(f"{BASE_URL}/api/ops/core_project").json()
        assert not any(x["id"] == f"TEST_cprj_civil_{TAG}" for x in lst)

    def test_06_core_access_requires_superadmin(self, admin):
        s, _ = _login_as(admin, OHE_EMAIL)
        r = s.patch(f"{BASE_URL}/api/users/{OHE_EMAIL}/core-access", json={"core_all": True})
        assert r.status_code == 403
        r = admin.patch(f"{BASE_URL}/api/users/nonexistent_{TAG}@x.com/core-access", json={"core_all": True})
        assert r.status_code == 404

    def test_07_plain_user_core_data_visibility(self, admin):
        """Spec: core data visible only to GM + assigned member + SuperAdmin. Plain User should NOT get core data."""
        s, _ = _login_as(admin, USER_EMAIL)
        lst = s.get(f"{BASE_URL}/api/ops/core_project").json()
        leaked = [x["id"] for x in lst if x["id"].endswith(TAG)] if isinstance(lst, list) else []
        assert not leaked, f"Plain 'User' role can read core projects via API: {leaked}"
