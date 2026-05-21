"""
src/auth.py
───────────
NeuroDL v2.0 — Authentication helpers.

Handles:
  - Password hashing and verification (bcrypt)
  - JWT token generation and decoding
  - Flask route decorator @require_auth

Environment variables:
  SECRET_KEY : JWT signing secret (required in production)
"""

import os
import traceback
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
import jwt
from flask import jsonify, request

# ─── Configuration ────────────────────────────────────────────────────────────

SECRET_KEY      = os.environ.get("SECRET_KEY", "neurodl-dev-secret-change-in-production")
JWT_ALGORITHM   = "HS256"
JWT_EXPIRES_HRS = 24


# ─── Password Helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    salt   = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception:
        return False


# ─── JWT Helpers ──────────────────────────────────────────────────────────────

def create_token(user_id: int, email: str, full_name: str) -> str:
    """
    Create a signed JWT.
    sub is stored as a STRING — PyJWT requires sub to be a string.
    Cast back to int with int(current_user["sub"]) when needed.
    """
    payload = {
        "sub":       str(user_id),   # ← must be string for PyJWT
        "email":     email,
        "full_name": full_name,
        "iat":       datetime.utcnow(),
        "exp":       datetime.utcnow() + timedelta(hours=JWT_EXPIRES_HRS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
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


def get_token_from_request() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[len("Bearer "):]


# ─── Route Decorator ──────────────────────────────────────────────────────────

def require_auth(f):
    """
    Flask route decorator — blocks unauthenticated requests.
    Injects decoded JWT payload as current_user into the route.

    Note: current_user["sub"] is a STRING — cast to int where needed:
        user_id = int(current_user["sub"])
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({
                "error":   "Authentication required",
                "message": "Please log in to access this resource",
            }), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({
                "error":   "Invalid or expired token",
                "message": "Please log in again",
            }), 401

        return f(*args, current_user=payload, **kwargs)
    return decorated