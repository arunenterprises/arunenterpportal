# Iteration 49: Core config (dynamic members), Tasks, Notifications, core escalation assignee access + auto-task
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
SA_EMAIL = ADMIN["identifier"]
TAG = uuid.uuid4().hex[:6]
PWD = "Test@1234"
EMAILS = {"User": f"test_i49_user_{TAG}@example.com", "User2": f"test_i49_user2_{TAG}@example.com", "Member Legal": f"test_i49_legal_{TAG}@example.com"}
ESC_IDS, OTHER_IDS, TASK_IDS, SA_NOTIF_IDS = [], [], [], []
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    for key, em in EMAILS.items():
        role = "User" if key.startswith("User") else key
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": em, "name": f"TEST i49 {key}", "password": PWD, "role": role})
        assert r.status_code == 200, f"{key}: {r.text}"
    yield s
    for rid in ESC_IDS:
        s.delete(f"{BASE_URL}/api/ops/core_escalation/{rid}")
    for rid in OTHER_IDS:
        s.delete(f"{BASE_URL}/api/ops/core_escalation/{rid}")
    for tid in TASK_IDS:
        s.delete(f"{BASE_URL}/api/tasks/{tid}")
    # tasks auto-created for TEST users (by assignedTo of our unique emails)
    mdb.tasks.delete_many({"assignedTo": {"$in": [e.lower() for e in EMAILS.values()]}})
    mdb.notifications.delete_many({"to": {"$in": [e.lower() for e in EMAILS.values()]}})
    if SA_NOTIF_IDS:
        mdb.notifications.delete_many({"id": {"$in": SA_NOTIF_IDS}})
    for em in EMAILS.values():
        s.delete(f"{BASE_URL}/api/users/{em}")


_sessions = {}


def _login(admin, key):
    if key in _sessions:
        return _sessions[key]
    em = EMAILS[key]
    assert admin.post(f"{BASE_URL}/api/admin/users/{em}/otp-reset").status_code == 200
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"identifier": em, "password": PWD})
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    _sessions[key] = s
    return s


# Core config
def test_core_config_has_new_members(admin):
    r = admin.get(f"{BASE_URL}/api/core/config")
    assert r.status_code == 200
    m = r.json()["members"]
    for k in ("Member HR & Admin", "Member Legal", "Member Financial", "Member Civil", "Member OHE", "Member Electrical", "Member Procurement"):
        assert k in m
    assert m["Member Legal"] == ["LEGAL"]


def test_core_config_put_requires_superadmin(admin):
    s = _login(admin, "User")
    r = s.put(f"{BASE_URL}/api/core/config", json={"members": {}, "modules": {}})
    assert r.status_code == 403


def test_core_config_put_invalid_member_400(admin):
    cur = admin.get(f"{BASE_URL}/api/core/config").json()
    r = admin.put(f"{BASE_URL}/api/core/config", json={"members": {"Bad Name": ["X"]}, "modules": cur["modules"]})
    assert r.status_code == 400
    # unchanged
    assert admin.get(f"{BASE_URL}/api/core/config").json()["members"] == cur["members"]


# Permissions
def test_plain_user_cannot_assign_or_directory(admin):
    s = _login(admin, "User")
    assert s.get(f"{BASE_URL}/api/users/directory").status_code == 403
    r = s.post(f"{BASE_URL}/api/tasks", json={"title": "TEST bad", "assignedTo": EMAILS["User2"]})
    assert r.status_code == 403
    assert s.get(f"{BASE_URL}/api/tasks?scope=all").status_code == 403


def test_member_can_assign(admin):
    s = _login(admin, "Member Legal")
    d = s.get(f"{BASE_URL}/api/users/directory")
    assert d.status_code == 200 and any(u["email"] == EMAILS["User"] for u in d.json())
    assert all("password_hash" not in u for u in d.json())
    r = s.post(f"{BASE_URL}/api/tasks", json={"title": "TEST_i49 legal task", "department": "Legal", "assignedTo": EMAILS["User2"]})
    assert r.status_code == 200, r.text
    TASK_IDS.append(r.json()["id"])
    assert r.json()["assignedBy"] == EMAILS["Member Legal"]


def test_assign_unknown_employee_404(admin):
    r = admin.post(f"{BASE_URL}/api/tasks", json={"title": "TEST_i49 x", "assignedTo": f"nobody_{TAG}@example.com"})
    assert r.status_code == 404


# Task lifecycle
def test_task_lifecycle_and_notifications(admin):
    r = admin.post(f"{BASE_URL}/api/tasks", json={"title": "TEST_i49 DPR submit karein", "department": "Project Management", "template": "DPR submit karein", "assignedTo": EMAILS["User"].upper(), "priority": "High", "dueDate": "2026-01-31"})
    assert r.status_code == 200, r.text
    t = r.json()
    TASK_IDS.append(t["id"])
    assert t["taskNo"].startswith("AE/TASK/") and t["taskNo"].endswith("/2526") or t["taskNo"].endswith("/2627")
    assert t["status"] == "Assigned" and t["assignedTo"] == EMAILS["User"]
    u = _login(admin, "User")
    mine = u.get(f"{BASE_URL}/api/tasks?scope=mine").json()
    assert any(x["id"] == t["id"] for x in mine)
    n = [x for x in u.get(f"{BASE_URL}/api/notifications").json() if t["taskNo"] in x["body"]]
    assert n and n[0]["read"] is False and n[0]["path"] == f"/my-tasks?task={t['id']}"
    assert u.post(f"{BASE_URL}/api/notifications/{n[0]['id']}/read").status_code == 200
    assert [x for x in u.get(f"{BASE_URL}/api/notifications").json() if x["id"] == n[0]["id"]][0]["read"] is True
    # assignee cannot mark Done himself
    assert u.patch(f"{BASE_URL}/api/tasks/{t['id']}", json={"status": "Done"}).status_code == 403
    r = u.patch(f"{BASE_URL}/api/tasks/{t['id']}", json={"remarks": "TEST remark", "status": "In Progress"})
    assert r.status_code == 200 and r.json()["status"] == "In Progress" and r.json()["remarks"] == "TEST remark"
    r = u.patch(f"{BASE_URL}/api/tasks/{t['id']}", json={"status": "Submitted"})
    assert r.status_code == 200 and r.json()["status"] == "Submitted"
    sa_n = [x for x in admin.get(f"{BASE_URL}/api/notifications").json() if x["title"].startswith("Task Submitted") and t["taskNo"] in x["body"]]
    assert sa_n, "assigner not notified"
    SA_NOTIF_IDS.extend(x["id"] for x in sa_n)
    r = admin.patch(f"{BASE_URL}/api/tasks/{t['id']}", json={"status": "Done", "seniorRemarks": "ok"})
    assert r.status_code == 200 and r.json()["status"] == "Done"
    assert any(x["title"].startswith("Task Done") for x in u.get(f"{BASE_URL}/api/notifications").json())
    assert any(x["id"] == t["id"] for x in admin.get(f"{BASE_URL}/api/tasks?scope=assigned").json())
    # other user can't touch it
    u2 = _login(admin, "User2")
    assert u2.patch(f"{BASE_URL}/api/tasks/{t['id']}", json={"remarks": "hack"}).status_code == 403
    assert u2.delete(f"{BASE_URL}/api/tasks/{t['id']}").status_code == 403


# Core escalation assignment -> task + notif + assignee access
def test_escalation_assign_creates_task_and_access(admin):
    rid = f"TEST_i49_esc_{TAG}"
    other = f"TEST_i49_esc_other_{TAG}"
    r = admin.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": rid, "discipline": "CIVIL", "project": "TEST i49 prj", "issue": "TEST i49 issue", "assignedTo": EMAILS["User"], "priority": "High"})
    assert r.status_code == 200, r.text
    ESC_IDS.append(rid)
    r = admin.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": other, "discipline": "CIVIL", "project": "TEST i49 prj", "issue": "TEST other"})
    assert r.status_code == 200
    OTHER_IDS.append(other)
    u = _login(admin, "User")
    path = f"/core-dashboard?kind=core_escalation&rid={rid}"
    tasks = [x for x in u.get(f"{BASE_URL}/api/tasks?scope=mine").json() if x.get("path") == path]
    assert len(tasks) == 1 and tasks[0]["template"] == "Core Escalation"
    assert any(x["path"] == path for x in u.get(f"{BASE_URL}/api/notifications").json())
    # re-save with same assignee -> no duplicate task
    admin.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": rid, "discipline": "CIVIL", "project": "TEST i49 prj", "issue": "TEST i49 issue", "assignedTo": EMAILS["User"], "priority": "High"})
    assert len([x for x in u.get(f"{BASE_URL}/api/tasks?scope=mine").json() if x.get("path") == path]) == 1
    # assignee sees only his record
    r = u.get(f"{BASE_URL}/api/ops/core_escalation")
    assert r.status_code == 200, r.text
    ids = {x["id"] for x in r.json()}
    assert rid in ids and other not in ids
    # assignee can save same discipline
    r = u.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": rid, "discipline": "CIVIL", "project": "TEST i49 prj", "issue": "TEST i49 issue", "remarks": "TEST assignee update", "assignedTo": EMAILS["User2"]})
    assert r.status_code == 200, r.text
    assert r.json()["assignedTo"] == EMAILS["User"]  # cannot reassign
    got = [x for x in admin.get(f"{BASE_URL}/api/ops/core_escalation").json() if x["id"] == rid][0]
    assert got["remarks"] == "TEST assignee update"
    # cannot change discipline / edit other record / delete
    assert u.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": rid, "discipline": "OHE", "issue": "x"}).status_code == 403
    assert u.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": other, "discipline": "CIVIL", "issue": "x"}).status_code == 403
    assert u.delete(f"{BASE_URL}/api/ops/core_escalation/{rid}").status_code == 403
    # other plain user sees nothing
    u2 = _login(admin, "User2")
    r2 = u2.get(f"{BASE_URL}/api/ops/core_escalation")
    assert r2.status_code in (200, 403)
    if r2.status_code == 200:
        assert rid not in {x["id"] for x in r2.json()}


def test_escalation_assign_mixed_case_email_visible(admin):
    """assignedTo typed in mixed case: task is created lowercased; record must still be visible to assignee."""
    rid = f"TEST_i49_esc_case_{TAG}"
    r = admin.post(f"{BASE_URL}/api/ops/core_escalation", json={"id": rid, "discipline": "CIVIL", "project": "TEST", "issue": "TEST case", "assignedTo": EMAILS["User2"].upper()})
    assert r.status_code == 200
    ESC_IDS.append(rid)
    u2 = _login(admin, "User2")
    r = u2.get(f"{BASE_URL}/api/ops/core_escalation")
    assert r.status_code == 200
    assert rid in {x["id"] for x in r.json()}, "assignee cannot see record when assignedTo saved in mixed case"
