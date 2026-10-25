# Iter45 helper: setup/teardown TEST_ user + ACL for RBAC UI masking test. usage: python iter45_ui_setup.py setup|teardown
import os
import sys
import requests

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
EM, PW = "test_rbac_ui@example.com", "TestPw@1234"
sa = requests.post(f"{API}/auth/login", json={"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}).json()["token"]
H = {"Authorization": f"Bearer {sa}"}
if sys.argv[1] == "setup":
    print(requests.post(f"{API}/auth/register", headers=H, json={"email": EM, "name": "TEST_RBAC UI", "password": PW, "role": "User"}).status_code)
    print(requests.post(f"{API}/admin/users/{EM}/otp-reset", headers=H).json())
    print(requests.post(f"{API}/settings/acl", headers=H, json={"value": {"User": {"site": {"v": False}}, "_mask": {"User": ["card:kpi-receivable", "col:TDS"]}}}).json())
else:
    print(requests.post(f"{API}/settings/acl", headers=H, json={"value": {}}).json())
    print(requests.delete(f"{API}/users/{EM}", headers=H).status_code)
