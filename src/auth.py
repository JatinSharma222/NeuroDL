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

Usage:
  from src.auth import hash_password, verify_password, create_token, require_auth
"""

import os
import traceback
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
import jwt
from flask import jsonify, request

# ─── Configuration ────────────────────────────────────────────────────────────

SECRET_KEY     = os.environ.get("SECRET_KEY", "neurodl-dev-secret-change-in-production")
JWT_ALGORITHM  = "HS256"
JWT_EXPIRES_HRS = 24   # Token valid for 24 hours


# ─── Password Helpers ─────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """
    Hash a plain-text password with bcrypt.

    Args:
        plain : Raw password string from registration form

    Returns:
        str: bcrypt hash string (safe to store in DB)
    """
    salt   = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Check a plain password against a stored bcrypt hash.

    Args:
        plain  : Raw password from login form
        hashed : bcrypt hash string from DB

    Returns:
        bool: True if password matches
    """
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
    Create a signed JWT for an authenticated user.

    Payload:
      sub       : user_id (int)
      email     : user email
      full_name : display name
      iat       : issued at
      exp       : expiry (24h from now)

    Args:
        user_id   : User primary key
        email     : User email address
        full_name : User display name

    Returns:
        str: Signed JWT string
    """
    payload = {
        "sub":       user_id,
        "email":     email,
        "full_name": full_name,
        "iat":       datetime.utcnow(),
        "exp":       datetime.utcnow() + timedelta(hours=JWT_EXPIRES_HRS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """
    Decode and validate a JWT.

    Args:
        token : Raw JWT string (without 'Bearer ' prefix)

    Returns:
        dict: Decoded payload, or None if invalid / expired
    """
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
    """
    Extract JWT from the Authorization header.

    Expects:   Authorization: Bearer <token>

    Returns:
        str: Raw token string, or None if header is missing / malformed
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header[len("Bearer "):]


# ─── Route Decorator ──────────────────────────────────────────────────────────

def require_auth(f):
    """
    Flask route decorator — blocks unauthenticated requests.

    Extracts the JWT from the Authorization header, decodes it,
    and injects the decoded payload into the route as `current_user`.

    Usage:
        @app.route("/predict", methods=["POST"])
        @require_auth
        def predict(current_user):
            user_id = current_user["sub"]
            ...

    Returns 401 if:
      - Authorization header is missing
      - Token is malformed
      - Token is expired
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