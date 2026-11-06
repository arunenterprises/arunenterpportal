# Iteration 52: retest of Requisitions fixes - file GET ACL, conclude needs assigned-dept comment, discipline cleared for non-Material
import os
import base64
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
ROLES = ["GM", "Sr. Site Operation Manager", "Member Civil", "Accounts Manager", "Member Financial", "User"]
EMAILS = {r: f"test_i52_{''.join(c for c in r.lower() if c.isalnum())}_{TAG}@example.com" for r in ROLES}
REQ_IDS = []
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
COUNTER_EXISTED = mdb.counters.find_one({"key": "requisitions"}) is not None
_S = {}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    for role, em in EMAILS.items():
        r = s.post(f"{API}/auth/register", json={"email": em, "name": f"TEST i52 {role}", "password": PWD, "role": role})
        assert r.status_code == 200, f"{role}: {r.text}"
    yield s
    mdb.requisitions.delete_many({"id": {"$in": REQ_IDS}})
    mdb.req_files.delete_many({"reqId": {"$in": REQ_IDS}})
    mdb.notifications.delete_many({"path": {"$in": [f"/requisitions?id={i}" for i in REQ_IDS]}})
    mdb.notifications.delete_many({"to": {"$in": list(EMAILS.values())}})
    for em in EMAILS.values():
        s.delete(f"{API}/users/{em}")
    if not COUNTER_EXISTED and not mdb.requisitions.find_one({}):
        mdb.counters.delete_one({"key": "requisitions"})


def sess(admin, role):
    if role in _S:
        return _S[role]
    em = EMAILS[role]
    assert admin.post(f"{API}/admin/users/{em}/otp-reset").status_code == 200
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": em, "password": PWD})
    assert r.status_code == 200 and r.json().get("token"), r.text
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    _S[role] = s
    return s


def create(s, **kw):
    r = s.post(f"{API}/requisitions", json=kw)
    if r.status_code == 200:
        REQ_IDS.append(r.json()["id"])
    return r


# --- file GET ACL
def test_file_get_acl(admin):
    u = sess(admin, "User")
    rid = create(u, rtype="Material", title="TEST_i52 FileAcl", discipline="CIVIL", amount=0).json()["id"]
    data = base64.b64encode(b"%PDF-1.4 x").decode()
    fid = u.post(f"{API}/requisitions/{rid}/files", json={"name": "t.pdf", "type": "application/pdf", "data": data}).json()["id"]
    assert sess(admin, "Member Financial").get(f"{API}/requisitions/{rid}/files/{fid}").status_code == 403
    assert sess(admin, "Accounts Manager").get(f"{API}/requisitions/{rid}/files/{fid}").status_code == 403
    for role in ["User", "Sr. Site Operation Manager", "Member Civil", "GM"]:
        r = sess(admin, role).get(f"{API}/requisitions/{rid}/files/{fid}")
        assert r.status_code == 200 and r.json()["data"] == data, f"{role}: {r.status_code}"
    assert admin.get(f"{API}/requisitions/{rid}/files/{fid}").status_code == 200
    # wrong rid/fid pairing -> 404
    assert u.get(f"{API}/requisitions/{rid}/files/nope").status_code == 404


# --- conclude needs assigned-department comment
def test_conclude_requires_dept_comment(admin):
    u, gm, am = sess(admin, "User"), sess(admin, "GM"), sess(admin, "Accounts Manager")
    r = create(u, rtype="Finance", title="TEST_i52 Big", amount=4000000, discipline="CIVIL")
    assert r.status_code == 200
    rid = r.json()["id"]
    assert gm.post(f"{API}/requisitions/{rid}/discussion", json={"topic": "TEST_i52 topic", "departments": ["Accounts Manager"]}).status_code == 200
    assert gm.post(f"{API}/requisitions/{rid}/discussion/comment", json={"text": "TEST GM note"}).status_code == 200
    r = gm.post(f"{API}/requisitions/{rid}/discussion/conclude", json={"summary": "TEST_i52 summary"})
    assert r.status_code == 409, r.text
    assert am.post(f"{API}/requisitions/{rid}/discussion/comment", json={"text": "TEST AM ok", "decision": "Approve", "amount": 100}).status_code == 200
    r = gm.post(f"{API}/requisitions/{rid}/discussion/conclude", json={"summary": "TEST_i52 summary"})
    assert r.status_code == 200 and r.json()["status"] == "Pending"


# --- discipline cleared for non-Material
def test_discipline_cleared(admin):
    u = sess(admin, "User")
    f = create(u, rtype="Finance", title="TEST_i52 Fin", amount=1000, discipline="CIVIL")
    m = create(u, rtype="Machinery", title="TEST_i52 Mach", amount=1000, discipline="OHE")
    assert f.status_code == 200 and f.json()["discipline"] == ""
    assert m.status_code == 200 and m.json()["discipline"] == ""
    for rid in (f.json()["id"], m.json()["id"]):
        assert mdb.requisitions.find_one({"id": rid})["discipline"] == ""
    mat = create(u, rtype="Material", title="TEST_i52 Mat", amount=0, discipline="CIVIL")
    assert mat.json()["discipline"] == "CIVIL"
