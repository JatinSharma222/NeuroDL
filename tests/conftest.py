"""
tests/conftest.py
─────────────────
Shared pytest configuration for NeuroDL test suite.
Sets environment variables before any app code is imported.
"""

import os
import sys

# ── Ensure project root is on the path ────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Set test env vars BEFORE app is imported ──────────────────────
# These are overridden per-session in test_api.py fixtures,
# but setting them here ensures no accidental production DB writes.
os.environ.setdefault("DATABASE_URL", "sqlite:///test_neurodl.db")
os.environ.setdefault("SECRET_KEY",   "test-secret-not-for-production")
os.environ.setdefault("FLASK_ENV",    "testing")