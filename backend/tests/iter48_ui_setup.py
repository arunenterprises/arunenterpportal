# Iter48 helper: setup/teardown TEST users (plain User, Member OHE) + OTP bypass for UI. usage: python iter48_ui_setup.py setup|teardown
import os
import sys
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "TestPw@1234"
USERS = {"test_i48_ui_user@example.com": "User", "test_i48_ui_ohe@example.com": "Member OHE"}
sa = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {sa}"}
if sys.argv[1] == "setup":
    for em, role in USERS.items():
        print(em, requests.post(f"{API}/auth/register", headers=H, json={"email": em, "name": f"TEST i48 {role}", "password": PW, "role": role}).status_code)
        print(requests.post(f"{API}/admin/users/{em}/otp-reset", headers=H).status_code)
    print(requests.post(f"{API}/ops/core_project", headers=H, json={"id": "TEST_i48_ui_civil", "discipline": "CIVIL", "name": "TEST i48 UI Civil"}).status_code)
elif sys.argv[1] == "otp":
    for em in USERS:
        print(requests.post(f"{API}/admin/users/{em}/otp-reset", headers=H).status_code)
else:
    print(requests.delete(f"{API}/ops/core_project/TEST_i48_ui_civil", headers=H).status_code)
    for em in USERS:
        print(em, requests.delete(f"{API}/users/{em}", headers=H).status_code)
    for k in ("core_project", "core_progress", "core_escalation"):
        print(k, [d["id"] for d in requests.get(f"{API}/ops/{k}", headers=H).json() if "TEST" in (d.get("id", "") + str(d.get("name", "")))])
