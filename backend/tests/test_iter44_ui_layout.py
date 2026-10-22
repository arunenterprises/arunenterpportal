# Iteration 44: /api/settings/ui-buttons `elements` key (page layout designer), SA-only write
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
    h = {"Authorization": f"Bearer {t}"}
    yield h
    requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=h)


@pytest.fixture(scope="module")
def user_h():
    t = _login(USER)
    if not t:
        pytest.skip("test.user login failed")
    h = {"Authorization": f"Bearer {t}"}
    yield h
    requests.post(f"{BASE_URL}/api/auth/logout", headers=h)


class TestUiLayout:
    def test_default_shape_has_elements(self, sa_h):
        requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=sa_h)
        v = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=sa_h).json()["value"]
        assert set(EMPTY.keys()).issubset(v.keys())

    def test_save_elements_persist(self, sa_h):
        key = '/home|[data-testid="home-welcome"] > div:nth-child(1)'
        val = {**EMPTY, "elements": {key: {"font": "18", "width": "80", "hide": False, "bg": "#ff0000"}},
               "buttons": {"/bill|bill-btn-save": {"font": "15"}}}
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": val}, headers=sa_h)
        assert r.status_code == 200 and r.json()["value"]["elements"][key]["font"] == "18"
        g = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=sa_h).json()["value"]
        assert g["elements"][key]["bg"] == "#ff0000"
        assert g["buttons"]["/bill|bill-btn-save"]["font"] == "15"

    def test_user_can_read_elements(self, sa_h, user_h):
        g = requests.get(f"{BASE_URL}/api/settings/ui-buttons", headers=user_h)
        assert g.status_code == 200
        assert any(k.startswith("/home|") for k in g.json()["value"]["elements"])

    def test_user_post_forbidden(self, user_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=user_h)
        assert r.status_code == 403

    def test_invalid_value_400(self, sa_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": [1, 2]}, headers=sa_h)
        assert r.status_code == 400

    def test_reset(self, sa_h):
        r = requests.post(f"{BASE_URL}/api/settings/ui-buttons", json={"value": EMPTY}, headers=sa_h)
        assert r.status_code == 200 and r.json()["value"] == EMPTY
