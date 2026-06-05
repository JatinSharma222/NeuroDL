"""
tests/test_api.py
─────────────────
NeuroDL v2.0 — pytest test suite.

Run:
    pip install pytest pytest-mock
    pytest tests/test_api.py -v

The model is MOCKED — tests run without GPU or model files.
Database uses a temporary SQLite file, created fresh each session.
"""

import io
import os
import sys
import pytest
import numpy as np
import unittest.mock as mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app_client(tmp_path_factory):
    """
    Flask test client with:
      - SQLite test database (auto-created via init_db)
      - Mocked classification model (no GPU needed)
      - Mocked Ollama LLM
    """
    tmp_dir = tmp_path_factory.mktemp("neurodl_test")
    db_path = str(tmp_dir / "test.db")

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SECRET_KEY"]   = "test-secret-not-for-production"

    # Dummy 1x4 softmax — Glioma at 85%
    fake_preds = np.array([[0.85, 0.05, 0.05, 0.05]], dtype=np.float32)
    dummy_b64  = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ"
        "AABjkB6QAAAABJRU5ErkJggg=="
    )

    mock_model          = mock.MagicMock()
    mock_model.predict  = mock.MagicMock(return_value=fake_preds)
    mock_model.__call__ = mock.MagicMock(return_value=fake_preds)

    with mock.patch("app.load_local_model",            return_value=mock_model), \
         mock.patch("app.generate_gradcam",             return_value=dummy_b64),  \
         mock.patch("app.get_gradcam_heatmap",          return_value=np.zeros((7,7))), \
         mock.patch("app.gradcam_pseudo_segmentation",  return_value=dummy_b64),  \
         mock.patch("app.generate_report",              return_value="FINDINGS: Test report."):

        import app as flask_app
        from src.database import init_db as _init_db

        flask_app.app.config["TESTING"]           = True
        flask_app.app.config["RATELIMIT_ENABLED"] = False
        flask_app.classification_model            = mock_model
        flask_app.app_initialized                 = True   # skip before_request

        # ── CREATE TABLES in the test SQLite DB ──────────────────
        _init_db()

        with flask_app.app.test_client() as client:
            yield client


@pytest.fixture(scope="session")
def auth_token(app_client):
    """Register a test user once for the whole session."""
    res = app_client.post("/auth/register", json={
        "full_name": "Test User",
        "email":     "test@neurodl.com",
        "password":  "TestPass123",
    })
    assert res.status_code == 201, f"Register failed: {res.get_json()}"
    data = res.get_json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    token, _ = auth_token
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def patient_id(app_client, auth_headers):
    """Create a test patient once for the whole session."""
    res = app_client.post("/patients", json={
        "name":     "John Doe",
        "age":      45,
        "gender":   "Male",
        "symptoms": "Persistent headache",
    }, headers=auth_headers)
    assert res.status_code == 201, f"Patient creation failed: {res.get_json()}"
    return res.get_json()["patient_id"]


@pytest.fixture
def sample_image():
    """Minimal valid 1×1 JPEG."""
    return bytes([
        0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,
        0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,
        0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,0x0D,
        0x0C,0x0B,0x0B,0x0C,0x19,0x12,0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,
        0x1A,0x1C,0x1C,0x20,0x24,0x2E,0x27,0x20,0x22,0x2C,0x23,0x1C,0x1C,0x28,
        0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,0x39,0x3D,0x38,0x32,
        0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,0x00,0x01,
        0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,
        0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,
        0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0xFF,0xDA,0x00,0x08,0x01,
        0x01,0x00,0x00,0x3F,0x00,0xFB,0xD0,0xFF,0xD9,
    ])


# ─── Health Check ─────────────────────────────────────────────────

class TestHealthCheck:
    def test_get_root_returns_200(self, app_client):
        assert app_client.get("/").status_code == 200

    def test_root_returns_service_info(self, app_client):
        data = app_client.get("/").get_json()
        assert data["status"] == "online"
        assert "NeuroDL"       in data["service"]
        assert "model"         in data
        assert "accuracy"      in data


# ─── Auth: Register ───────────────────────────────────────────────

class TestRegister:
    def test_register_success(self, app_client):
        res = app_client.post("/auth/register", json={
            "full_name": "New User",
            "email":     "newuser@neurodl.com",
            "password":  "NewPass123",
        })
        assert res.status_code == 201
        data = res.get_json()
        assert "token" in data
        assert data["user"]["email"] == "newuser@neurodl.com"

    def test_register_duplicate_email(self, app_client):
        payload = {"full_name": "Dup", "email": "dup@neurodl.com", "password": "Pass123!"}
        app_client.post("/auth/register", json=payload)
        res = app_client.post("/auth/register", json=payload)
        assert res.status_code == 409

    def test_register_missing_fields(self, app_client):
        res = app_client.post("/auth/register", json={"email": "x@x.com"})
        assert res.status_code == 400

    def test_register_invalid_email(self, app_client):
        res = app_client.post("/auth/register", json={
            "full_name": "Bad", "email": "not-an-email", "password": "Pass123!"
        })
        assert res.status_code == 400

    def test_register_short_password(self, app_client):
        res = app_client.post("/auth/register", json={
            "full_name": "Short", "email": "short@x.com", "password": "abc"
        })
        assert res.status_code == 400


# ─── Auth: Login ──────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self, app_client, auth_token):
        _, user = auth_token
        res = app_client.post("/auth/login", json={
            "email":    user["email"],
            "password": "TestPass123",
        })
        assert res.status_code == 200
        assert "token" in res.get_json()

    def test_login_wrong_password(self, app_client, auth_token):
        _, user = auth_token
        res = app_client.post("/auth/login", json={
            "email":    user["email"],
            "password": "WrongPassword!",
        })
        assert res.status_code == 401

    def test_login_unknown_email(self, app_client):
        res = app_client.post("/auth/login", json={
            "email":    "nobody@nowhere.com",
            "password": "Pass123!",
        })
        assert res.status_code == 401

    def test_login_missing_body(self, app_client):
        res = app_client.post("/auth/login")
        assert res.status_code == 400


# ─── Auth: Guards ─────────────────────────────────────────────────

class TestAuthGuards:
    PROTECTED = [
        ("GET",  "/history"),
        ("GET",  "/history/1"),
        ("POST", "/patients"),
        ("GET",  "/patients"),
        ("GET",  "/auth/me"),
        ("GET",  "/stats"),
    ]

    @pytest.mark.parametrize("method,path", PROTECTED)
    def test_no_token_returns_401(self, app_client, method, path):
        res = getattr(app_client, method.lower())(path)
        assert res.status_code == 401

    def test_invalid_token_returns_401(self, app_client):
        res = app_client.get("/history", headers={"Authorization": "Bearer invalid.jwt.token"})
        assert res.status_code == 401

    def test_malformed_auth_header_returns_401(self, app_client):
        res = app_client.get("/history", headers={"Authorization": "NotBearer token"})
        assert res.status_code == 401


# ─── Auth: Me ─────────────────────────────────────────────────────

class TestMe:
    def test_me_returns_user(self, app_client, auth_headers, auth_token):
        _, user = auth_token
        res = app_client.get("/auth/me", headers=auth_headers)
        assert res.status_code == 200
        assert res.get_json()["email"] == user["email"]


# ─── Patients ─────────────────────────────────────────────────────

class TestPatients:
    def test_create_patient_success(self, app_client, auth_headers):
        res = app_client.post("/patients", json={
            "name": "Jane Doe", "age": 35, "gender": "Female",
        }, headers=auth_headers)
        assert res.status_code == 201
        assert isinstance(res.get_json()["patient_id"], int)

    def test_create_patient_missing_required(self, app_client, auth_headers):
        res = app_client.post("/patients", json={"name": "No Age"}, headers=auth_headers)
        assert res.status_code == 400

    def test_create_patient_invalid_age(self, app_client, auth_headers):
        res = app_client.post("/patients", json={
            "name": "Bad Age", "age": 200, "gender": "Male"
        }, headers=auth_headers)
        assert res.status_code == 400

    def test_list_patients(self, app_client, auth_headers, patient_id):
        res = app_client.get("/patients", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert "patients" in data
        assert data["total"] >= 1

    def test_get_patient_detail(self, app_client, auth_headers, patient_id):
        res = app_client.get(f"/patients/{patient_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["id"]   == patient_id
        assert data["name"] == "John Doe"

    def test_get_nonexistent_patient(self, app_client, auth_headers):
        res = app_client.get("/patients/99999", headers=auth_headers)
        assert res.status_code == 404


# ─── Predict ──────────────────────────────────────────────────────

class TestPredict:
    def test_predict_success(self, app_client, auth_headers, sample_image, patient_id):
        res = app_client.post("/predict",
            data={"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg"),
                  "patient_id": str(patient_id)},
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert "final_class"         in body
        assert "class_name"          in body
        assert "confidence"          in body
        assert "class_probabilities" in body
        assert body["final_class"]   in [0, 1, 2, 3]
        assert len(body["class_probabilities"]) == 4

    def test_predict_no_image_returns_400(self, app_client, auth_headers):
        res = app_client.post("/predict",
            data={}, content_type="multipart/form-data", headers=auth_headers)
        assert res.status_code == 400

    def test_predict_requires_auth(self, app_client, sample_image):
        res = app_client.post("/predict",
            data={"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg")},
            content_type="multipart/form-data",
        )
        assert res.status_code == 401

    def test_predict_probabilities_sum_to_one(self, app_client, auth_headers, sample_image):
        res = app_client.post("/predict",
            data={"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg")},
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        body  = res.get_json()
        total = sum(body["class_probabilities"].values())
        assert abs(total - 1.0) < 0.01, f"Probs sum to {total}, expected ~1.0"

    def test_predict_confidence_has_percent(self, app_client, auth_headers, sample_image):
        res = app_client.post("/predict",
            data={"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg")},
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        assert "%" in res.get_json()["confidence"]


# ─── History ──────────────────────────────────────────────────────

class TestHistory:
    def test_history_returns_list(self, app_client, auth_headers):
        res = app_client.get("/history", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert "scans"    in data
        assert "total"    in data
        assert "page"     in data
        assert "per_page" in data

    def test_history_pagination(self, app_client, auth_headers):
        res = app_client.get("/history?page=1&per_page=5", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["per_page"] == 5
        assert len(data["scans"]) <= 5

    def test_history_filter_by_class(self, app_client, auth_headers):
        res = app_client.get("/history?class_name=Glioma", headers=auth_headers)
        assert res.status_code == 200
        for scan in res.get_json()["scans"]:
            assert "Glioma" in scan["predicted_class"]

    def test_history_detail_nonexistent(self, app_client, auth_headers):
        res = app_client.get("/history/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_history_detail_and_delete(self, app_client, auth_headers, sample_image, patient_id):
        # Create a scan first
        app_client.post("/predict",
            data={"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg"),
                  "patient_id": str(patient_id)},
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        scans = app_client.get("/history", headers=auth_headers).get_json()["scans"]
        if not scans:
            pytest.skip("No scans in DB")
        scan_id = scans[0]["id"]

        # Fetch detail
        res = app_client.get(f"/history/{scan_id}", headers=auth_headers)
        assert res.status_code == 200
        assert res.get_json()["id"] == scan_id

        # Delete
        res = app_client.delete(f"/history/{scan_id}", headers=auth_headers)
        assert res.status_code == 200

        # Confirm gone
        assert app_client.get(f"/history/{scan_id}", headers=auth_headers).status_code == 404


# ─── Stats ────────────────────────────────────────────────────────

class TestStats:
    def test_stats_requires_auth(self, app_client):
        assert app_client.get("/stats").status_code == 401

    def test_stats_structure(self, app_client, auth_headers):
        res = app_client.get("/stats", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert "total"                  in data
        assert "class_distribution"     in data
        assert "avg_confidence"         in data
        assert "overall_avg_confidence" in data
        assert "scans_per_day"          in data
        assert "feature_usage"          in data

    def test_stats_scans_per_day_is_30(self, app_client, auth_headers):
        res  = app_client.get("/stats", headers=auth_headers)
        assert len(res.get_json()["scans_per_day"]) == 30

    def test_stats_feature_usage_keys(self, app_client, auth_headers):
        fu = app_client.get("/stats", headers=auth_headers).get_json()["feature_usage"]
        assert "segmentation" in fu
        assert "gradcam"      in fu
        assert "report"       in fu


# ─── CORS ─────────────────────────────────────────────────────────

class TestCORS:
    def test_options_stats_returns_200(self, app_client):
        assert app_client.options("/stats").status_code == 200

    def test_options_predict_returns_200(self, app_client):
        assert app_client.options("/predict").status_code == 200

    def test_options_has_cors_header(self, app_client):
        res = app_client.options("/history")
        assert "Access-Control-Allow-Origin" in res.headers


# ─── Error Handlers ───────────────────────────────────────────────

class TestErrorHandlers:
    def test_404_returns_json(self, app_client):
        res = app_client.get("/this-route-does-not-exist")
        assert res.status_code == 404
        assert "error" in res.get_json()

    def test_405_method_not_allowed(self, app_client):
        assert app_client.delete("/auth/login").status_code == 405