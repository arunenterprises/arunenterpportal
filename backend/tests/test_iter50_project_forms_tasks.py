# Iteration 50: per-project forms (projects.forms), ops_upsert assignedTo lowercase, task Done guard, task delete -> notifications cleanup
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
TAG = uuid.uuid4().hex[:6]
PWD = "Test@1234"
U_EMAIL = f"test_i50_user_{TAG}@example.com"
L_EMAIL = f"test_i50_legal_{TAG}@example.com"
PRJ_IDS, DPR_IDS, ESC_IDS, TASK_IDS = [], [], [], []
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    for em, role, nm in ((U_EMAIL, "User", "TEST i50 User"), (L_EMAIL, "Member Legal", "TEST i50 Legal")):
        r = s.post(f"{API}/auth/register", json={"email": em, "name": nm, "password": PWD, "role": role})
        assert r.status_code == 200, r.text
    yield s
    for rid in PRJ_IDS:
        s.delete(f"{API}/ops/projects/{rid}")
    for rid in DPR_IDS:
        s.delete(f"{API}/ops/dpr/{rid}")
    for rid in ESC_IDS:
        s.delete(f"{API}/ops/core_escalation/{rid}")
    for tid in TASK_IDS:
        s.delete(f"{API}/tasks/{tid}")
    ems = [U_EMAIL, L_EMAIL]
    for t in mdb.tasks.find({"assignedTo": {"$in": ems}}, {"id": 1}):
        s.delete(f"{API}/tasks/{t['id']}")
    mdb.notifications.delete_many({"to": {"$in": ems}})
    mdb.notifications.delete_many({"to": ADMIN["identifier"], "title": {"$regex": f"TEST_i50_{TAG}"}})
    for em in ems:
        s.delete(f"{API}/users/{em}")


_sess = {}


def _login(admin, em):
    if em in _sess:
        return _sess[em]
    assert admin.post(f"{API}/admin/users/{em}/otp-reset").status_code == 200
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": em, "password": PWD})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    _sess[em] = s
    return s


# Projects register: forms persist on server
def test_project_forms_persist(admin):
    pid = f"TEST_prj_{TAG}"
    body = {"id": pid, "code": f"PRJ/TEST/{TAG}", "name": f"TEST_i50 Project {TAG}", "manager": "TEST Mgr", "status": "Planning", "forms": ["dpr", "qc_test", "safety_audit"]}
    r = admin.post(f"{API}/ops/projects", json=body)
    assert r.status_code == 200, r.text
    PRJ_IDS.append(pid)
    got = [p for p in admin.get(f"{API}/ops/projects").json() if p["id"] == pid]
    assert got and got[0]["forms"] == ["dpr", "qc_test", "safety_audit"]
    body["forms"] = ["dpr", "indent", "labour"]
    assert admin.post(f"{API}/ops/projects", json=body).status_code == 200
    got = [p for p in admin.get(f"{API}/ops/projects").json() if p["id"] == pid][0]
    assert got["forms"] == ["dpr", "indent", "labour"]
    assert got["docNo"].startswith("AE/PRJT/")


# Ops upsert lowercases assignedTo and auto-task is created for the lowercased email
def test_core_escalation_assignedto_lowercased(admin):
    rid = f"op_test_i50_{TAG}"
    r = admin.post(f"{API}/ops/core_escalation", json={"id": rid, "discipline": "CIVIL", "project": "TEST", "issue": f"TEST_i50_{TAG} esc", "priority": "High", "assignedTo": f"  {U_EMAIL.upper()} "})
    assert r.status_code == 200, r.text
    ESC_IDS.append(rid)
    assert r.json()["assignedTo"] == U_EMAIL
    doc = mdb.ops_core_escalation.find_one({"id": rid}, {"_id": 0})
    assert doc["assignedTo"] == U_EMAIL
    t = mdb.tasks.find_one({"assignedTo": U_EMAIL, "path": f"/core-dashboard?kind=core_escalation&rid={rid}"}, {"_id": 0})
    assert t, "auto-task not created"
    # Assigned user can list and save the record
    u = _login(admin, U_EMAIL)
    lst = u.get(f"{API}/ops/core_escalation")
    assert lst.status_code == 200 and any(x["id"] == rid for x in lst.json())
    doc["remarks"] = "TEST user remark"
    r2 = u.post(f"{API}/ops/core_escalation", json=doc)
    assert r2.status_code == 200, r2.text
    assert r2.json()["assignedTo"] == U_EMAIL


# Task: assignee cannot change a Done task; boss still can
def test_task_done_guard(admin):
    r = admin.post(f"{API}/tasks", json={"title": f"TEST_i50_{TAG} guard", "assignedTo": U_EMAIL.upper()})
    assert r.status_code == 200, r.text
    t = r.json()
    TASK_IDS.append(t["id"])
    assert t["assignedTo"] == U_EMAIL
    u = _login(admin, U_EMAIL)
    assert u.patch(f"{API}/tasks/{t['id']}", json={"status": "Submitted", "remarks": "done"}).json()["status"] == "Submitted"
    assert admin.patch(f"{API}/tasks/{t['id']}", json={"status": "Done"}).json()["status"] == "Done"
    r = u.patch(f"{API}/tasks/{t['id']}", json={"status": "In Progress", "remarks": "reopen"})
    assert r.status_code == 403
    assert mdb.tasks.find_one({"id": t["id"]})["status"] == "Done"


# Task delete removes its notifications
def test_task_delete_removes_notifications(admin):
    r = admin.post(f"{API}/tasks", json={"title": f"TEST_i50_{TAG} del", "assignedTo": U_EMAIL})
    tid = r.json()["id"]
    u = _login(admin, U_EMAIL)
    u.patch(f"{API}/tasks/{tid}", json={"status": "Submitted"})
    assert mdb.notifications.count_documents({"path": {"$regex": tid}}) >= 2
    assert admin.delete(f"{API}/tasks/{tid}").status_code == 200
    assert mdb.notifications.count_documents({"path": {"$regex": tid}}) == 0
    assert mdb.tasks.find_one({"id": tid}) is None


# Core auto-task delete: its "Naya Task" notification uses core-dashboard path (no tid) -> check if removed
def test_core_auto_task_delete_notification(admin):
    rid = ESC_IDS[0] if ESC_IDS else None
    if not rid:
        pytest.skip("no esc")
    t = mdb.tasks.find_one({"assignedTo": U_EMAIL, "path": f"/core-dashboard?kind=core_escalation&rid={rid}"})
    assert admin.delete(f"{API}/tasks/{t['id']}").status_code == 200
    left = mdb.notifications.count_documents({"to": U_EMAIL, "path": f"/core-dashboard?kind=core_escalation&rid={rid}"})
    assert left == 0, f"{left} orphan notification(s) remain for deleted core auto-task"


# Non-assignee plain user cannot read others' core escalations
def test_core_escalation_not_visible_to_other_user(admin):
    lg = _login(admin, L_EMAIL)
    r = lg.get(f"{API}/ops/core_escalation")
    assert r.status_code in (200, 403)
    if r.status_code == 200:
        assert not any(x["id"] in ESC_IDS for x in r.json())
