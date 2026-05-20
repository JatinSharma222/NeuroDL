"""
src/database.py
───────────────
SQLite database models and helper functions for NeuroDL v2.0.

Tables:
  patients — one record per patient registration
  scans    — one record per MRI analysis, linked to a patient

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
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

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

class Patient(Base):
    """
    One record per patient registration.
    Created when the user fills the patient form before uploading MRI.
    """
    __tablename__ = "patients"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String(150), nullable=False)
    age        = Column(Integer,     nullable=False)
    gender     = Column(String(20),  nullable=False)          # Male / Female / Other
    phone      = Column(String(20),  nullable=True)           # optional
    symptoms   = Column(Text,        nullable=True)           # optional free text
    created_at = Column(DateTime,    default=datetime.utcnow)

    # One patient → one scan (one-to-one via uselist=False)
    scan = relationship("Scan", back_populates="patient", uselist=False)

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "age":        self.age,
            "gender":     self.gender,
            "phone":      self.phone,
            "symptoms":   self.symptoms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "scan":       self.scan.to_dict() if self.scan else None,
        }

    def __repr__(self):
        return f"<Patient id={self.id} name='{self.name}' age={self.age}>"


class Scan(Base):
    """
    One MRI analysis record, linked to a Patient.
    Auto-saved after every /predict call.
    """
    __tablename__ = "scans"

    id                     = Column(Integer, primary_key=True, autoincrement=True)
    patient_id             = Column(Integer, ForeignKey("patients.id"), nullable=True)
    scan_timestamp         = Column(DateTime, default=datetime.utcnow)
    predicted_class        = Column(String(50),  nullable=False)
    confidence_score       = Column(Float,        nullable=False)
    segmentation_performed = Column(Boolean,      default=False)
    gradcam_performed      = Column(Boolean,      default=False)
    file_name              = Column(String(255),  nullable=True)
    report_text            = Column(Text,         nullable=True)

    # Relationship back to patient
    patient = relationship("Patient", back_populates="scan")

    def to_dict(self):
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
            f"<Scan id={self.id} patient_id={self.patient_id} "
            f"class='{self.predicted_class}' confidence={self.confidence_score:.2%}>"
        )


# ─── Database Initialisation ──────────────────────────────────────────────────

def init_db():
    """
    Create all tables if they don't exist yet.
    Called once at app startup from app.py.
    """
    Base.metadata.create_all(bind=engine)
    print("✓ Database initialised (neurodl.db)")


# ─── Patient CRUD ─────────────────────────────────────────────────────────────

def create_patient(
    name: str,
    age: int,
    gender: str,
    phone: str = None,
    symptoms: str = None,
) -> int:
    """
    Insert a new patient record and return its ID.

    Args:
        name     : Full name of the patient
        age      : Age in years
        gender   : Male / Female / Other
        phone    : Optional contact number
        symptoms : Optional free-text symptom description

    Returns:
        int: New patient's primary key
    """
    db = SessionLocal()
    try:
        patient = Patient(
            name     = name.strip(),
            age      = int(age),
            gender   = gender.strip(),
            phone    = phone.strip() if phone else None,
            symptoms = symptoms.strip() if symptoms else None,
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        print(f"✓ Patient saved — id={patient.id}, name='{patient.name}'")
        return patient.id
    except Exception as e:
        db.rollback()
        print(f"✗ Failed to save patient: {e}")
        raise
    finally:
        db.close()


def get_patients(
    page: int = 1,
    per_page: int = 20,
    search: str = None,
) -> dict:
    """
    Retrieve paginated patient records with their linked scan.

    Args:
        page     : Page number (1-indexed)
        per_page : Records per page (max 100)
        search   : Optional name search (partial match)

    Returns:
        dict with keys: total, page, per_page, patients (list of dicts)
    """
    per_page = min(per_page, 100)
    db = SessionLocal()
    try:
        query = db.query(Patient)

        if search:
            query = query.filter(Patient.name.ilike(f"%{search}%"))

        total    = query.count()
        patients = (
            query.order_by(Patient.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

        return {
            "total":    total,
            "page":     page,
            "per_page": per_page,
            "patients": [p.to_dict() for p in patients],
        }
    finally:
        db.close()


def get_patient_by_id(patient_id: int) -> dict | None:
    """Return a single patient with their scan, or None if not found."""
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        return patient.to_dict() if patient else None
    finally:
        db.close()


def delete_patient(patient_id: int) -> bool:
    """
    Delete a patient and their linked scan record.

    Returns:
        True if deleted, False if not found
    """
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return False
        db.delete(patient)
        db.commit()
        print(f"✓ Patient id={patient_id} deleted")
        return True
    except Exception as e:
        db.rollback()
        print(f"✗ Failed to delete patient: {e}")
        raise
    finally:
        db.close()


# ─── Scan CRUD ────────────────────────────────────────────────────────────────

def save_scan(
    predicted_class: str,
    confidence_score: float,
    segmentation_performed: bool = False,
    gradcam_performed: bool = False,
    file_name: str = None,
    report_text: str = None,
    patient_id: int = None,
) -> int:
    """
    Insert a new scan record linked to a patient and return its ID.

    Args:
        predicted_class        : e.g. "Glioma Tumor"
        confidence_score       : Float between 0 and 1
        segmentation_performed : Whether pseudo-segmentation ran
        gradcam_performed      : Whether Grad-CAM ran
        file_name              : Original uploaded filename
        report_text            : LLM-generated radiology report
        patient_id             : FK to patients.id (int, not string)

    Returns:
        int: New scan's primary key
    """
    db = SessionLocal()
    try:
        scan = Scan(
            patient_id             = patient_id,
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
        print(f"✓ Scan saved — id={scan.id}, class='{scan.predicted_class}'")
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

    Returns:
        dict with keys: total, page, per_page, scans (list of dicts)
    """
    per_page = min(per_page, 100)
    db = SessionLocal()
    try:
        query = db.query(Scan)

        if class_name:
            query = query.filter(Scan.predicted_class.ilike(f"%{class_name}%"))

        if date_from:
            try:
                dt_from = datetime.strptime(date_from, "%Y-%m-%d")
                query = query.filter(Scan.scan_timestamp >= dt_from)
            except ValueError:
                pass

        if date_to:
            try:
                dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59
                )
                query = query.filter(Scan.scan_timestamp <= dt_to)
            except ValueError:
                pass

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
    """Return a single scan record by primary key, or None if not found."""
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        return scan.to_dict() if scan else None
    finally:
        db.close()


def delete_scan(scan_id: int) -> bool:
    """Delete a scan record by primary key."""
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