# Iter52 UI helper: setup|otp <key>|state|teardown -- TEST users for Requisitions UI retest
import os
import sys
import requests
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
API = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/") + "/api"
PW = "TestPw@1234"
USERS = {"gm": "GM", "ssom": "Sr. Site Operation Manager", "civil": "Member Civil", "pm": "Purchase Manager", "am": "Accounts Manager", "mf": "Member Financial", "user": "User"}
EM = {k: f"test_i52_ui_{k}@example.com" for k in USERS}
SA = "arunenterprises2023@gmail.com"
tok = requests.post(f"{API}/auth/login", json={"identifier": SA, "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
cmd = sys.argv[1]
if cmd == "setup":
    for k, role in USERS.items():
        print("reg", k, requests.post(f"{API}/auth/register", headers=H, json={"email": EM[k], "name": f"TEST i52 UI {k}", "password": PW, "role": role}).status_code)
elif cmd == "otp":
    print(requests.post(f"{API}/admin/users/{EM[sys.argv[2]]}/otp-reset", headers=H).status_code)
elif cmd == "state":
    for d in mdb.requisitions.find({"requestedBy": {"$in": list(EM.values())}}, {"_id": 0, "id": 1, "reqNo": 1, "status": 1, "stage": 1, "discipline": 1, "rtype": 1}):
        print(d)
else:
    ids = [d["id"] for d in mdb.requisitions.find({"requestedBy": {"$in": list(EM.values())}}, {"id": 1})]
    print("reqs", mdb.requisitions.delete_many({"id": {"$in": ids}}).deleted_count, "files", mdb.req_files.delete_many({"reqId": {"$in": ids}}).deleted_count)
    print("notif", mdb.notifications.delete_many({"$or": [{"to": {"$in": list(EM.values())}}, {"path": {"$in": [f"/requisitions?id={i}" for i in ids]}}]}).deleted_count)
    print("tasks", mdb.tasks.delete_many({"$or": [{"assignee": {"$in": list(EM.values())}}, {"createdBy": {"$in": list(EM.values())}}]}).deleted_count)
    for em in EM.values():
        print("user", requests.delete(f"{API}/users/{em}", headers=H).status_code)
    if not mdb.requisitions.find_one({}):
        mdb.counters.delete_one({"key": "requisitions"})
