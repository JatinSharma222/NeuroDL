"""
src/auth.py  —  NeuroDL v2.0
──────────────────────────────
Change vs previous version:
  • create_token() now accepts and encodes role
  • require_doctor() decorator — blocks non-doctors with 403
"""

import os
import traceback
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
import jwt
from flask import jsonify, request

SECRET_KEY      = os.environ.get("SECRET_KEY", "neurodl-dev-secret-change-in-production")
JWT_ALGORITHM   = "HS256"
JWT_EXPIRES_HRS = 24


# ─── Password ─────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ─── JWT ──────────────────────────────────────────────────────────────────────

def create_token(user_id: int, email: str, full_name: str,
                 role: str = "patient") -> str:          # NEW: role param
    payload = {
        "sub":       str(user_id),
        "email":     email,
        "full_name": full_name,
        "role":      role,                               # NEW: stored in token
        "iat":       datetime.utcnow(),
        "exp":       datetime.utcnow() + timedelta(hours=JWT_EXPIRES_HRS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        print("[Auth] Token expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"[Auth] Invalid token: {e}")
        return None
    except Exception:
        print(f"[Auth] Decode error:\n{traceback.format_exc()}")
        return None


def get_token_from_request():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return auth[len("Bearer "):]


# ─── Decorators ───────────────────────────────────────────────────────────────

def require_auth(f):
    """Block unauthenticated requests. Injects current_user into route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token   = get_token_from_request()
        if not token:
            return jsonify({"error": "Authentication required",
                            "message": "Please log in"}), 401
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token",
                            "message": "Please log in again"}), 401
        return f(*args, current_user=payload, **kwargs)
    return decorated


def require_doctor(f):
    """
    NEW — Block non-doctor users with 403.
    Must be stacked AFTER @require_auth so current_user is available.

    Usage:
        @app.route("/doctor/patients")
        @require_auth
        @require_doctor
        def doctor_patients(current_user): ...
    """
    @wraps(f)
    def decorated(*args, current_user, **kwargs):
        if current_user.get("role") != "doctor":
            return jsonify({
                "error":   "Doctor access required",
                "message": "This endpoint is restricted to doctor accounts",
            }), 403
        return f(*args, current_user=current_user, **kwargs)
    return decorated