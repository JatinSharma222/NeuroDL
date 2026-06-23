"""
src/image_storage.py
─────────────────────
Backend-agnostic storage for Grad-CAM / segmentation heatmap PNGs.

Everything elsewhere in the app deals only in opaque "keys"
(e.g. "scans/3f9a1c2b_gradcam.png") — never a filesystem path, never
an S3 client. Swapping local disk for S3 at deploy time is a env-var
flip, not a code change.

Local dev (default):
    IMAGE_STORAGE_BACKEND unset or "local"
    Files land under LOCAL_IMAGE_DIR (default: "scan_images/").

Production (S3):
    IMAGE_STORAGE_BACKEND=s3
    S3_IMAGE_BUCKET=your-bucket-name
    AWS_REGION=...                  (or whatever your boto3 setup needs)
    boto3 picks up credentials the normal way (env vars / IAM role /
    ~/.aws/credentials) — nothing AWS-specific lives in this app.

    pip install boto3   (only required once you actually flip to "s3")
"""

import os
import uuid

STORAGE_BACKEND   = os.environ.get("IMAGE_STORAGE_BACKEND", "local").lower()
LOCAL_IMAGE_DIR   = os.environ.get("LOCAL_IMAGE_DIR", "scan_images")
S3_BUCKET         = os.environ.get("S3_IMAGE_BUCKET")
SIGNED_URL_EXPIRY = int(os.environ.get("S3_SIGNED_URL_EXPIRY", 300))  # seconds

_s3_client = None  # lazy singleton — boto3 only imported if backend == "s3"


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        import boto3  # local import: dev machines never need boto3 installed
        _s3_client = boto3.client("s3")
    return _s3_client


def new_key(scan_kind: str) -> str:
    """
    Generate a globally-unique storage key. UUID-based (not scan_id-based)
    so the image can be written BEFORE the Scan row exists — no chicken
    -egg ordering problem, no second "update" query needed.

    scan_kind: "gradcam" | "segment"
    """
    return f"scans/{uuid.uuid4().hex}_{scan_kind}.png"


def save_image(key: str, png_bytes: bytes) -> bool:
    """Write image bytes under `key`. Returns True on success, False on failure (never raises)."""
    try:
        if STORAGE_BACKEND == "s3":
            if not S3_BUCKET:
                print("[Storage] ⚠ S3_IMAGE_BUCKET not set — skipping image persistence")
                return False
            _get_s3_client().put_object(
                Bucket=S3_BUCKET, Key=key, Body=png_bytes, ContentType="image/png",
            )
        else:
            path = os.path.join(LOCAL_IMAGE_DIR, key)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(png_bytes)
        return True
    except Exception as e:
        print(f"[Storage] ✗ Failed to save image '{key}': {e}")
        return False


def read_image_bytes(key: str) -> bytes | None:
    """LOCAL backend only — used by the Flask route to stream bytes directly."""
    try:
        path = os.path.join(LOCAL_IMAGE_DIR, key)
        with open(path, "rb") as f:
            return f.read()
    except Exception as e:
        print(f"[Storage] ✗ Failed to read local image '{key}': {e}")
        return None


def get_signed_url(key: str, expires: int = SIGNED_URL_EXPIRY) -> str | None:
    """S3 backend only — time-limited presigned URL, never a public link."""
    try:
        return _get_s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )
    except Exception as e:
        print(f"[Storage] ✗ Failed to sign URL for '{key}': {e}")
        return None


def delete_image(key: str) -> None:
    """Best-effort cleanup — never raises, so a failed delete never blocks a scan delete."""
    try:
        if STORAGE_BACKEND == "s3":
            if S3_BUCKET:
                _get_s3_client().delete_object(Bucket=S3_BUCKET, Key=key)
        else:
            path = os.path.join(LOCAL_IMAGE_DIR, key)
            if os.path.exists(path):
                os.remove(path)
    except Exception as e:
        print(f"[Storage] ⚠ Failed to delete image '{key}': {e}")