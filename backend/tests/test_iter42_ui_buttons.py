# Iteration 42: /api/settings/ui-buttons GET/POST (SuperAdmin only), regression on login
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SA = {"identifier": "arunenterprises2023@gmail.com", "password": "Arun2023@12"}
USER = {"identifier": "test.user@arun.com", "password": "User@2026"}
EMPTY = {"global": {}, "pages": {}, "buttons": {}, "elements": {}}


def _login(body):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=body, timeout=20)
    if r.status_code != 200:
        return None
    d = r.json()
    return d.get("token") or d.get("access_token")


@pytest.fixture(scope="module")
def sa_h():
    t = _login(SA)
    if not t:
        pytest.skip("SA login failed")
    yield {"Authorization": f"Bearer {t}"}
    requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers={"Authorization": f"Bearer {t}"})


@pytest.fixture(scope="module")
def user_h():
    t = _login(USER)
    if not t:
        pytest.skip("test.user login failed")
    h = {"Authorization": f"Bearer {t}"}
    yield h
    requests.post(f"{BASE_URL}/api/auth/logout", headers=h)  # non-SA users are single-session


class TestUiButtons:
    def test_get_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/settings/ui-buttons")
        assert r.status_code in (401, 403)

    def test_get_default_shape(self, sa_h):
        r = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=sa_h)
        assert r.status_code == 200
        v = r.json()["value"]
        assert set(["global", "pages", "buttons"]).issubset(v.keys())

    def test_sa_save_and_persist(self, sa_h):
        val = {"global": {"zoom": "1.1"}, "pages": {"/home": {"font": "14"}},
               "buttons": {"/bill|bill-btn-save": {"radius": "12", "width": "120"}}, "junk": 1}
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": val}, headers=sa_h)
        assert r.status_code == 200
        assert r.json()["ok"] is True
        assert "junk" not in r.json()["value"]
        g = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=sa_h).json()["value"]
        assert g["global"]["zoom"] == "1.1"
        assert g["pages"]["/home"]["font"] == "14"
        assert g["buttons"]["/bill|bill-btn-save"]["radius"] == "12"

    def test_user_can_read(self, user_h):
        r = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=user_h)
        assert r.status_code == 200
        assert r.json()["value"]["global"].get("zoom") == "1.1"

    def test_user_post_forbidden(self, user_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=user_h)
        assert r.status_code == 403

    def test_invalid_value(self, sa_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": [1, 2]}, headers=sa_h)
        assert r.status_code == 400

    def test_reset(self, sa_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=sa_h)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=sa_h).json()["value"]
        assert g == EMPTY
