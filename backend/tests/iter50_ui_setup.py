# Iter50 UI helper: setup|otp <email>|state|teardown -- TEST plain User + TEST Member Legal for core-escalation & MyTasks deep-link UI flows
import os
import sys
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = "https://vendor-workflow-sys.preview.emergentagent.com/api"
PW = "TestPw@1234"
U = "test_i50_ui_user@example.com"
L = "test_i50_ui_legal@example.com"
SA = "arunenterprises2023@gmail.com"
tok = requests.post(f"{API}/auth/login", json={"identifier": SA, "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
cmd = sys.argv[1]
if cmd == "setup":
    for em, role, nm in ((U, "User", "TEST i50 UI User"), (L, "Member Legal", "TEST i50 UI Legal")):
        print("reg", requests.post(f"{API}/auth/register", headers=H, json={"email": em, "name": nm, "password": PW, "role": role}).status_code)
    r = requests.post(f"{API}/ops/core_escalation", headers=H, json={"id": "op_test_i50_ui_esc", "discipline": "CIVIL", "project": "TEST", "issue": "TEST_i50 UI escalation", "priority": "High", "assignedTo": U.upper()})
    print("esc", r.status_code)
    t1 = requests.post(f"{API}/tasks", headers=H, json={"title": "TEST_i50 task for user", "assignedTo": U}).json()
    t2 = requests.post(f"{API}/tasks", headers=H, json={"title": "TEST_i50 task for legal", "assignedTo": L}).json()
    print("tasks", t1["id"], t2["id"])
elif cmd == "otp":
    print(requests.post(f"{API}/admin/users/{sys.argv[2]}/otp-reset", headers=H).status_code)
elif cmd == "state":
    print("tasks", list(mdb.tasks.find({"assignedTo": {"$in": [U, L]}}, {"_id": 0, "id": 1, "status": 1, "title": 1, "path": 1})))
    print("notif", list(mdb.notifications.find({"to": {"$in": [U, L]}}, {"_id": 0, "to": 1, "title": 1, "path": 1})))
    print("esc", mdb.ops_core_escalation.find_one({"id": "op_test_i50_ui_esc"}, {"_id": 0, "remarks": 1, "assignedTo": 1, "status": 1, "docNo": 1}))
else:
    for t in mdb.tasks.find({"assignedTo": {"$in": [U, L]}}, {"id": 1, "taskNo": 1}):
        print("task", requests.delete(f"{API}/tasks/{t['id']}", headers=H).status_code)
    mdb.notifications.delete_many({"to": {"$in": [U, L]}})
    mdb.notifications.delete_many({"to": SA, "title": {"$regex": "TEST_i50"}})
    print("esc", requests.delete(f"{API}/ops/core_escalation/op_test_i50_ui_esc", headers=H).status_code)
    for em in (U, L):
        print("user", requests.delete(f"{API}/users/{em}", headers=H).status_code)
