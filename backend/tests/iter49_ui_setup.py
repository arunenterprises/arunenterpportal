# Iter49 UI helper: setup|otp|teardown TEST plain User for UI flows (task + escalation assignment)
import os
import sys
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "TestPw@1234"
EM = "test_i49_ui_user@example.com"
sa = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {sa}"}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
cmd = sys.argv[1]
if cmd == "setup":
    print(requests.post(f"{API}/auth/register", headers=H, json={"email": EM, "name": "TEST i49 UI User", "password": PW, "role": "User"}).status_code)
    print(requests.post(f"{API}/admin/users/{EM}/otp-reset", headers=H).status_code)
elif cmd == "otp":
    print(requests.post(f"{API}/admin/users/{EM}/otp-reset", headers=H).status_code)
elif cmd == "state":
    print("tasks", list(mdb.tasks.find({"assignedTo": EM}, {"_id": 0, "id": 1, "taskNo": 1, "status": 1, "title": 1, "path": 1})))
    print("notif", list(mdb.notifications.find({"to": EM}, {"_id": 0, "title": 1, "read": 1, "path": 1})))
    print("esc", [d["id"] for d in mdb.ops_core_escalation.find({"id": {"$regex": "TEST"}}, {"id": 1})])
    print("cfg", mdb.settings.find_one({"key": "core_config"}, {"_id": 0}))
else:
    tids = [t["id"] for t in mdb.tasks.find({"assignedTo": EM}, {"id": 1})]
    tnos = [t["taskNo"] for t in mdb.tasks.find({"assignedTo": EM}, {"taskNo": 1})]
    for tid in tids:
        print("task", requests.delete(f"{API}/tasks/{tid}", headers=H).status_code)
    mdb.notifications.delete_many({"to": EM})
    for no in tnos:  # SA "Task Submitted" notifs for our tasks only
        mdb.notifications.delete_many({"to": "arunenterprises2023@gmail.com", "body": {"$regex": f"^{no} "}})
    for d in mdb.ops_core_escalation.find({"id": {"$regex": "^op_"}, "issue": {"$regex": "^TEST_i49"}}, {"id": 1}):
        print("esc", requests.delete(f"{API}/ops/core_escalation/{d['id']}", headers=H).status_code)
    print("user", requests.delete(f"{API}/users/{EM}", headers=H).status_code)
