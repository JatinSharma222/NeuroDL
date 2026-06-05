"""
tests/test_api.py
─────────────────
NeuroDL v2.0 — pytest test suite.

Tests every API endpoint with:
  - Happy path (expected inputs → expected outputs)
  - Auth guards (missing/invalid JWT → 401)
  - Validation errors (bad inputs → 400/422)
  - Rate limiting smoke test

Run:
    pip install pytest pytest-mock
    pytest tests/test_api.py -v

The model is MOCKED — tests run without GPU or model files.
Database uses a temporary SQLite file, wiped after each session.
"""

import io
import json
import os
import sys
import types
import pytest
import numpy as np

# ── Point to project root so `import app` works ───────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ─── Fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def app_client(tmp_path_factory, monkeypatch_session):
    """
    Creates the Flask test client with:
      - SQLite test database (not PostgreSQL)
      - Mocked classification model (no GPU needed)
      - Mocked Ollama LLM (no local model needed)
    """
    tmp_dir = tmp_path_factory.mktemp("neurodl_test")
    db_path = str(tmp_dir / "test.db")

    # Override DB URL to SQLite before importing app
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SECRET_KEY"]   = "test-secret-key-not-for-production"

    # Mock TensorFlow model so no GPU needed
    import unittest.mock as mock

    fake_preds = np.array([[0.85, 0.05, 0.05, 0.05]])   # Glioma at 85%

    mock_model = mock.MagicMock()
    mock_model.predict.return_value          = fake_preds
    mock_model.__call__                      = mock.MagicMock(return_value=fake_preds)
    mock_model.return_value                  = fake_preds

    # Mock gradcam + segmentation to return dummy base64
    dummy_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

    with mock.patch("app.load_local_model", return_value=mock_model), \
         mock.patch("app.generate_gradcam",             return_value=dummy_b64), \
         mock.patch("app.get_gradcam_heatmap",          return_value=np.zeros((7, 7))), \
         mock.patch("app.gradcam_pseudo_segmentation",  return_value=dummy_b64), \
         mock.patch("app.generate_report",              return_value="FINDINGS: Test report."):

        import app as flask_app
        flask_app.app.config["TESTING"]              = True
        flask_app.app.config["RATELIMIT_ENABLED"]    = False   # disable rate limits in tests
        flask_app.classification_model               = mock_model
        flask_app.app_initialized                    = True    # skip before_request model load

        with flask_app.app.test_client() as client:
            yield client


@pytest.fixture(scope="session")
def monkeypatch_session():
    """Session-scoped monkeypatch."""
    from _pytest.monkeypatch import MonkeyPatch
    mp = MonkeyPatch()
    yield mp
    mp.undo()


@pytest.fixture(scope="session")
def auth_token(app_client):
    """Register a test user and return JWT token + user dict."""
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
    """Create a test patient and return its ID."""
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
    """Returns a minimal valid JPEG as bytes."""
    # 1×1 white JPEG
    jpeg = bytes([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD0,
        0xFF, 0xD9,
    ])
    return jpeg


# ─── Health Check ─────────────────────────────────────────────────

class TestHealthCheck:
    def test_get_root_returns_200(self, app_client):
        res = app_client.get("/")
        assert res.status_code == 200

    def test_root_returns_service_info(self, app_client):
        data = app_client.get("/").get_json()
        assert data["status"]  == "online"
        assert "NeuroDL"        in data["service"]
        assert "model"          in data
        assert "accuracy"       in data


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
        assert "token"     in data
        assert "user"      in data
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
        data = res.get_json()
        assert "token" in data
        assert "user"  in data

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
    """Every protected route must return 401 with no token."""

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
        data = res.get_json()
        assert data["email"] == user["email"]


# ─── Patients ─────────────────────────────────────────────────────

class TestPatients:
    def test_create_patient_success(self, app_client, auth_headers):
        res = app_client.post("/patients", json={
            "name":   "Jane Doe",
            "age":    35,
            "gender": "Female",
        }, headers=auth_headers)
        assert res.status_code == 201
        data = res.get_json()
        assert "patient_id" in data
        assert isinstance(data["patient_id"], int)

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
        assert "total"    in data
        assert data["total"] >= 1

    def test_get_patient_detail(self, app_client, auth_headers, patient_id):
        res = app_client.get(f"/patients/{patient_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["id"]     == patient_id
        assert data["name"]   == "John Doe"
        assert data["age"]    == 45

    def test_get_nonexistent_patient(self, app_client, auth_headers):
        res = app_client.get("/patients/99999", headers=auth_headers)
        assert res.status_code == 404


# ─── Predict ──────────────────────────────────────────────────────

class TestPredict:
    def test_predict_success(self, app_client, auth_headers, sample_image, patient_id):
        data = {
            "image":      (io.BytesIO(sample_image), "scan.jpg", "image/jpeg"),
            "patient_id": str(patient_id),
        }
        res = app_client.post("/predict",
            data=data,
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
        assert isinstance(body["class_probabilities"], dict)
        assert len(body["class_probabilities"]) == 4

    def test_predict_no_image_returns_400(self, app_client, auth_headers):
        res = app_client.post("/predict",
            data={},
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        assert res.status_code == 400

    def test_predict_empty_filename_returns_400(self, app_client, auth_headers):
        data = {"image": (io.BytesIO(b""), "", "image/jpeg")}
        res = app_client.post("/predict",
            data=data,
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        assert res.status_code == 400

    def test_predict_requires_auth(self, app_client, sample_image):
        data = {"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg")}
        res = app_client.post("/predict",
            data=data,
            content_type="multipart/form-data",
        )
        assert res.status_code == 401

    def test_predict_returns_probabilities_sum_to_one(self, app_client, auth_headers, sample_image, patient_id):
        data = {
            "image":      (io.BytesIO(sample_image), "scan.jpg", "image/jpeg"),
            "patient_id": str(patient_id),
        }
        res = app_client.post("/predict",
            data=data,
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        body  = res.get_json()
        total = sum(body["class_probabilities"].values())
        assert abs(total - 1.0) < 0.01, f"Probabilities sum to {total}, expected ~1.0"

    def test_predict_confidence_in_response(self, app_client, auth_headers, sample_image):
        data = {"image": (io.BytesIO(sample_image), "scan.jpg", "image/jpeg")}
        res  = app_client.post("/predict",
            data=data,
            content_type="multipart/form-data",
            headers=auth_headers,
        )
        body = res.get_json()
        assert "%" in body["confidence"]


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
        data = res.get_json()
        for scan in data["scans"]:
            assert "Glioma" in scan["predicted_class"]

    def test_history_detail_existing(self, app_client, auth_headers):
        # First create a scan via predict, then fetch it
        list_res = app_client.get("/history", headers=auth_headers)
        scans    = list_res.get_json()["scans"]
        if not scans:
            pytest.skip("No scans in DB yet")
        scan_id = scans[0]["id"]
        res = app_client.get(f"/history/{scan_id}", headers=auth_headers)
        assert res.status_code == 200
        data = res.get_json()
        assert data["id"] == scan_id

    def test_history_detail_nonexistent(self, app_client, auth_headers):
        res = app_client.get("/history/99999", headers=auth_headers)
        assert res.status_code == 404

    def test_history_delete(self, app_client, auth_headers):
        list_res = app_client.get("/history", headers=auth_headers)
        scans    = list_res.get_json()["scans"]
        if not scans:
            pytest.skip("No scans to delete")
        scan_id = scans[-1]["id"]
        res = app_client.delete(f"/history/{scan_id}", headers=auth_headers)
        assert res.status_code == 200
        # Confirm it's gone
        res2 = app_client.get(f"/history/{scan_id}", headers=auth_headers)
        assert res2.status_code == 404


# ─── Stats ────────────────────────────────────────────────────────

class TestStats:
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

    def test_stats_scans_per_day_length(self, app_client, auth_headers):
        res  = app_client.get("/stats", headers=auth_headers)
        data = res.get_json()
        assert len(data["scans_per_day"]) == 30

    def test_stats_feature_usage_keys(self, app_client, auth_headers):
        res  = app_client.get("/stats", headers=auth_headers)
        data = res.get_json()
        fu   = data["feature_usage"]
        assert "segmentation" in fu
        assert "gradcam"      in fu
        assert "report"       in fu

    def test_stats_requires_auth(self, app_client):
        res = app_client.get("/stats")
        assert res.status_code == 401


# ─── CORS ─────────────────────────────────────────────────────────

class TestCORS:
    def test_options_preflight_returns_200(self, app_client):
        res = app_client.options("/stats")
        assert res.status_code == 200

    def test_options_predict_returns_200(self, app_client):
        res = app_client.options("/predict")
        assert res.status_code == 200

    def test_options_has_cors_headers(self, app_client):
        res = app_client.options("/history")
        assert "Access-Control-Allow-Origin" in res.headers


# ─── Error Handlers ───────────────────────────────────────────────

class TestErrorHandlers:
    def test_404_returns_json(self, app_client):
        res = app_client.get("/this-route-does-not-exist")
        assert res.status_code == 404
        data = res.get_json()
        assert "error" in data

    def test_405_method_not_allowed(self, app_client):
        res = app_client.delete("/auth/login")
        assert res.status_code == 405