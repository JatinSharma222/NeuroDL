"""
src/database.py
───────────────
SQLite database models and helper functions for NeuroDL v2.0.
Handles persistent storage of every scan prediction (Upgrade 4).

Auto-creates neurodl.db in the project root on first run.
"""

import os
from datetime import datetime

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
)
from sqlalchemy.orm import declarative_base, sessionmaker

# ─── Database Setup ───────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///neurodl.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + Flask
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─── Models ───────────────────────────────────────────────────────────────────

class Scan(Base):
    """
    Represents one MRI scan prediction record.
    Auto-saved after every /predict call.
    """
    __tablename__ = "scans"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    patient_id             = Column(String(100), nullable=True)        # Optional patient identifier
    scan_timestamp         = Column(DateTime, default=datetime.utcnow)
    predicted_class        = Column(String(50),  nullable=False)       # e.g. "Glioma Tumor"
    confidence_score       = Column(Float,        nullable=False)       # e.g. 0.9245
    segmentation_performed = Column(Boolean,      default=False)
    gradcam_performed      = Column(Boolean,      default=False)
    file_name              = Column(String(255),  nullable=True)
    report_text            = Column(Text,         nullable=True)        # LLM-generated report

    def to_dict(self):
        """Serialize to JSON-safe dict for API responses."""
        return {
            "id":                     self.id,
            "patient_id":             self.patient_id,
            "scan_timestamp":         self.scan_timestamp.isoformat() if self.scan_timestamp else None,
            "predicted_class":        self.predicted_class,
            "confidence_score":       round(self.confidence_score, 4),
            "segmentation_performed": self.segmentation_performed,
            "gradcam_performed":      self.gradcam_performed,
            "file_name":              self.file_name,
            "report_text":            self.report_text,
        }

    def __repr__(self):
        return (
            f"<Scan id={self.id} class='{self.predicted_class}' "
            f"confidence={self.confidence_score:.2%} ts={self.scan_timestamp}>"
        )


# ─── Database Initialisation ──────────────────────────────────────────────────

def init_db():
    """
    Create all tables if they don't exist yet.
    Called once at app startup from app.py.
    """
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialised (neurodl.db)")


# ─── CRUD Helpers ─────────────────────────────────────────────────────────────

def save_scan(
    predicted_class: str,
    confidence_score: float,
    segmentation_performed: bool = False,
    gradcam_performed: bool = False,
    file_name: str = None,
    report_text: str = None,
    patient_id: str = None,
) -> int:
    """
    Insert a new scan record and return its auto-generated ID.

    Args:
        predicted_class        : Human-readable class name e.g. "Glioma Tumor"
        confidence_score       : Float between 0 and 1
        segmentation_performed : Whether U-Net segmentation ran
        gradcam_performed      : Whether Grad-CAM ran
        file_name              : Original uploaded filename
        report_text            : LLM-generated radiology report text
        patient_id             : Optional patient identifier string

    Returns:
        int: The new scan's primary key (scan_id)
    """
    db = SessionLocal()
    try:
        scan = Scan(
            patient_id             = patient_id or None,
            predicted_class        = predicted_class,
            confidence_score       = confidence_score,
            segmentation_performed = segmentation_performed,
            gradcam_performed      = gradcam_performed,
            file_name              = file_name or None,
            report_text            = report_text or None,
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        print(f"✓ Scan saved to DB — id={scan.id}, class='{scan.predicted_class}'")
        return scan.id
    except Exception as e:
        db.rollback()
        print(f"✗ Failed to save scan: {e}")
        raise
    finally:
        db.close()


def get_scans(
    page: int = 1,
    per_page: int = 20,
    class_name: str = None,
    date_from: str = None,
    date_to: str = None,
) -> dict:
    """
    Retrieve paginated scan records with optional filters.

    Args:
        page       : Page number (1-indexed)
        per_page   : Records per page (max 100)
        class_name : Filter by predicted class name (partial match)
        date_from  : ISO date string YYYY-MM-DD (inclusive)
        date_to    : ISO date string YYYY-MM-DD (inclusive)

    Returns:
        dict with keys: total, page, per_page, scans (list of dicts)
    """
    per_page = min(per_page, 100)  # Hard cap to prevent abuse
    db = SessionLocal()

    try:
        query = db.query(Scan)

        # ── Filters ───────────────────────────────────────────────
        if class_name:
            query = query.filter(Scan.predicted_class.ilike(f"%{class_name}%"))

        if date_from:
            try:
                dt_from = datetime.strptime(date_from, "%Y-%m-%d")
                query = query.filter(Scan.scan_timestamp >= dt_from)
            except ValueError:
                pass  # Silently ignore malformed date

        if date_to:
            try:
                dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59
                )
                query = query.filter(Scan.scan_timestamp <= dt_to)
            except ValueError:
                pass

        # ── Pagination ────────────────────────────────────────────
        total = query.count()
        scans = (
            query.order_by(Scan.scan_timestamp.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return {
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "scans":    [s.to_dict() for s in scans],
        }

    finally:
        db.close()


def get_scan_by_id(scan_id: int) -> dict | None:
    """
    Retrieve a single scan record by primary key.

    Args:
        scan_id: The scan's integer primary key

    Returns:
        dict representation of the scan, or None if not found
    """
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        return scan.to_dict() if scan else None
    finally:
        db.close()


def delete_scan(scan_id: int) -> bool:
    """
    Delete a scan record by primary key.

    Args:
        scan_id: The scan's integer primary key

    Returns:
        True if deleted, False if not found
    """
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            return False
        db.delete(scan)
        db.commit()
        print(f"✓ Scan id={scan_id} deleted")
        return True
    except Exception as e:
        db.rollback()
        print(f"✗ Failed to delete scan: {e}")
        raise
    finally:
        db.close()