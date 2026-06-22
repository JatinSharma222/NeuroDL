"""
src/database.py  —  NeuroDL v2.1
─────────────────────────────────
Adds vs previous version:
  • User.role column  ('patient' | 'doctor')
  • ClinicalNote model  — doctor notes + verdict per scan
  • get_all_patients()  — doctor sees every patient
  • add_clinical_note() / get_notes_for_scan()
  • get_doctor_stats()  — aggregate numbers for doctor dashboard

v2.1 — structural fix:
  • Patient is now a 1-to-1 PROFILE on a User (age/gender/phone only).
    `name` is NEVER stored here — it's always read live from
    users.full_name, so it can't drift out of sync and never has to
    be retyped.
  • Patient → Scan is now one-to-many (was incorrectly uselist=False,
    which is why a new "patient" row got created on every form
    submit instead of reusing the account).
  • `symptoms` moved from Patient (profile) to Scan (per-visit reason
    for that specific scan).
  • get_or_create_patient_profile() — upserts the current user's own
    profile. There is no longer any way to create a profile for
    someone else's account from the API.
"""

import os
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, Text, ForeignKey, or_, create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# ─── Setup ────────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://jatinsharma@localhost:5432/neurodl",
)

engine       = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base         = declarative_base()


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id            = Column(Integer,     primary_key=True, autoincrement=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(150), nullable=False)
    # NEW: role column — 'patient' | 'doctor'
    role          = Column(String(20),  nullable=False, default="patient")
    created_at    = Column(DateTime,    default=datetime.utcnow)

    patient = relationship(
        "Patient", back_populates="user",
        uselist=False, cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id":         self.id,
            "email":      self.email,
            "full_name":  self.full_name,
            "role":       self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}' role='{self.role}'>"


class Patient(Base):
    """
    A patient PROFILE — one per user account (1-to-1 with User).

    Deliberately does NOT store `name`. The name shown anywhere in the
    app is always read live from `users.full_name` via the `user`
    relationship, so it can never go stale and never needs retyping.

    `symptoms` also lives on Scan now, not here — the reason for a
    scan changes visit to visit; age/gender/phone are profile-level
    and persist across visits.
    """
    __tablename__ = "patients"

    id         = Column(Integer,  primary_key=True, autoincrement=True)
    user_id    = Column(Integer,  ForeignKey("users.id"), unique=True, nullable=False, index=True)
    age        = Column(Integer,  nullable=True)
    gender     = Column(String(20), nullable=True)
    phone      = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user  = relationship("User", back_populates="patient")
    scans = relationship(
        "Scan", back_populates="patient",
        order_by="desc(Scan.scan_timestamp)",
        cascade="all, delete-orphan",
    )

    def to_dict(self, include_scans: bool = False):
        latest = self.scans[0] if self.scans else None
        data = {
            "id":          self.id,
            "user_id":     self.user_id,
            "name":        self.user.full_name if self.user else None,   # live, never stored
            "email":       self.user.email if self.user else None,
            "age":         self.age,
            "gender":      self.gender,
            "phone":       self.phone,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
            "updated_at":  self.updated_at.isoformat() if self.updated_at else None,
            "total_scans": len(self.scans),
            "scan":        latest.to_dict() if latest else None,   # latest scan, kept for backward compat
        }
        if include_scans:
            data["scans"] = [s.to_dict() for s in self.scans]
        return data


class Scan(Base):
    __tablename__ = "scans"

    id                     = Column(Integer,     primary_key=True, autoincrement=True)
    patient_id             = Column(Integer,     ForeignKey("patients.id"), nullable=True)
    scan_timestamp         = Column(DateTime,    default=datetime.utcnow)
    predicted_class        = Column(String(50),  nullable=False)
    confidence_score       = Column(Float,       nullable=False)
    segmentation_performed = Column(Boolean,     default=False)
    gradcam_performed      = Column(Boolean,     default=False)
    file_name              = Column(String(255), nullable=True)
    report_text            = Column(Text,        nullable=True)
    symptoms               = Column(Text,        nullable=True)  # NEW — reason for THIS scan

    patient = relationship("Patient",       back_populates="scans")
    notes   = relationship("ClinicalNote",  back_populates="scan",
                           cascade="all, delete-orphan")

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
            "symptoms":               self.symptoms,
        }


# NEW MODEL ────────────────────────────────────────────────────────────────────
class ClinicalNote(Base):
    """
    A doctor's note + verdict on an AI prediction.

    verdict:
      'pending'  — doctor has not reviewed yet  (default)
      'approved' — doctor confirms AI result
      'flagged'  — doctor disagrees or wants further review
    """
    __tablename__ = "clinical_notes"

    id         = Column(Integer,     primary_key=True, autoincrement=True)
    scan_id    = Column(Integer,     ForeignKey("scans.id"),   nullable=False)
    doctor_id  = Column(Integer,     ForeignKey("users.id"),   nullable=False)
    note_text  = Column(Text,        nullable=False)
    verdict    = Column(String(20),  nullable=False, default="pending")
    created_at = Column(DateTime,    default=datetime.utcnow)

    scan   = relationship("Scan", back_populates="notes")
    doctor = relationship("User")

    def to_dict(self):
        return {
            "id":          self.id,
            "scan_id":     self.scan_id,
            "doctor_id":   self.doctor_id,
            "doctor_name": self.doctor.full_name if self.doctor else None,
            "note_text":   self.note_text,
            "verdict":     self.verdict,
            "created_at":  self.created_at.isoformat() if self.created_at else None,
        }


# ─── Init ─────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✓ PostgreSQL database initialised")


# ─── User CRUD ────────────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str, full_name: str,
                role: str = "patient") -> "User":
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email.lower().strip()).first():
            raise ValueError("Email already registered")
        user = User(
            email         = email.lower().strip(),
            password_hash = password_hash,
            full_name     = full_name.strip(),
            role          = role,          # NEW
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✓ User created — id={user.id}, role='{role}', email='{user.email}'")
        return user
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


def get_user_by_email(email: str):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email.lower().strip()).first()
    finally:
        db.close()


def get_user_by_id(user_id: int):
    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


# ─── Patient Profile CRUD ─────────────────────────────────────────────────────

def get_or_create_patient_profile(user_id: int, age=None, gender=None, phone=None) -> dict:
    """
    One profile per user — get it if it exists, create it if it doesn't,
    update whichever fields were passed in either case.

    `name` is intentionally NOT a parameter here: it is never stored on
    Patient. It always comes from User.full_name at read time, so every
    caller automatically gets the current account name with zero risk
    of it drifting or needing to be retyped.
    """
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        if patient is None:
            patient = Patient(user_id=user_id)
            db.add(patient)

        if age is not None and str(age).strip() != "":
            patient.age = int(age)
        if gender:
            patient.gender = gender.strip()
        if phone is not None:
            patient.phone = phone.strip() or None

        patient.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(patient)
        _ = patient.user  # eager-touch for to_dict()
        result = patient.to_dict()
        print(f"✓ Patient profile upserted — user_id={user_id}, patient_id={patient.id}")
        return result
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


def get_patient_profile_by_user(user_id: int):
    """Returns the current user's own profile, or None if they haven't set one up yet."""
    db = SessionLocal()
    try:
        p = db.query(Patient).filter(Patient.user_id == user_id).first()
        return p.to_dict() if p else None
    finally:
        db.close()


def get_patients(user_id: int) -> dict:
    """
    Backward-compatible shape for GET /patients — wraps the single
    profile belonging to `user_id` in a list (0 or 1 entries).
    """
    profile  = get_patient_profile_by_user(user_id)
    patients = [profile] if profile else []
    return {"total": len(patients), "patients": patients}


def get_all_patients(page=1, per_page=20, search=None) -> dict:
    """
    Doctor view: returns ALL patient profiles across all users, each with
    the live account name/email joined in. Search matches on the
    account's full_name (since Patient no longer stores name itself).
    """
    per_page = min(per_page, 100)
    db = SessionLocal()
    try:
        query = db.query(Patient).join(User, Patient.user_id == User.id)
        if search:
            query = query.filter(User.full_name.ilike(f"%{search}%"))
        total    = query.count()
        patients = (query.order_by(Patient.created_at.desc())
                        .offset((page - 1) * per_page).limit(per_page).all())
        return {"total": total, "page": page, "per_page": per_page,
                "patients": [p.to_dict() for p in patients]}
    finally:
        db.close()


def get_patient_by_id(patient_id: int, include_scans: bool = False):
    db = SessionLocal()
    try:
        p = db.query(Patient).filter(Patient.id == patient_id).first()
        return p.to_dict(include_scans=include_scans) if p else None
    finally:
        db.close()


def delete_patient(patient_id: int) -> bool:
    db = SessionLocal()
    try:
        p = db.query(Patient).filter(Patient.id == patient_id).first()
        if not p: return False
        db.delete(p); db.commit()
        print(f"✓ Patient id={patient_id} deleted")
        return True
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


# ─── Scan CRUD ────────────────────────────────────────────────────────────────

def save_scan(predicted_class, confidence_score, segmentation_performed=False,
              gradcam_performed=False, file_name=None, report_text=None,
              patient_id=None, symptoms=None) -> int:
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
            symptoms               = symptoms or None,
        )
        db.add(scan); db.commit(); db.refresh(scan)
        print(f"✓ Scan saved — id={scan.id}, class='{scan.predicted_class}'")
        return scan.id
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


def get_scans(page=1, per_page=20, class_name=None, date_from=None,
              date_to=None, user_id=None, search=None,
              min_confidence=None) -> dict:
    per_page = min(per_page, 1000)
    db = SessionLocal()
    try:
        query = db.query(Scan).outerjoin(Patient, Scan.patient_id == Patient.id)
        if user_id:
            query = query.filter(
                or_(Patient.user_id == user_id, Scan.patient_id.is_(None))
            )
        if class_name:
            query = query.filter(Scan.predicted_class.ilike(f"%{class_name}%"))
        if search:
            s = search.strip()
            if s.lstrip("#").isdigit():
                v = int(s.lstrip("#"))
                query = query.filter(or_(Scan.id == v, Scan.patient_id == v))
            else:
                query = query.filter(Scan.file_name.ilike(f"%{s}%"))
        if min_confidence is not None:
            try:
                query = query.filter(Scan.confidence_score >= float(min_confidence))
            except (ValueError, TypeError):
                pass
        if date_from:
            try:
                query = query.filter(
                    Scan.scan_timestamp >= datetime.strptime(date_from, "%Y-%m-%d"))
            except ValueError:
                pass
        if date_to:
            try:
                dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59)
                query = query.filter(Scan.scan_timestamp <= dt_to)
            except ValueError:
                pass
        total = query.count()
        scans = (query.order_by(Scan.scan_timestamp.desc())
                     .offset((page - 1) * per_page).limit(per_page).all())
        return {"total": total, "page": page, "per_page": per_page,
                "scans": [s.to_dict() for s in scans]}
    finally:
        db.close()


def get_scan_by_id(scan_id: int):
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan: return None
        data = scan.to_dict()
        data["notes"] = [n.to_dict() for n in scan.notes]  # include notes
        return data
    finally:
        db.close()


def delete_scan(scan_id: int) -> bool:
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan: return False
        db.delete(scan); db.commit()
        print(f"✓ Scan id={scan_id} deleted")
        return True
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


# ─── Clinical Note CRUD (NEW) ─────────────────────────────────────────────────

def add_clinical_note(scan_id: int, doctor_id: int,
                      note_text: str, verdict: str = "pending") -> dict:
    """
    Insert a clinical note. verdict must be 'pending' | 'approved' | 'flagged'.
    Returns the new note as a dict.
    """
    if verdict not in ("pending", "approved", "flagged"):
        raise ValueError(f"Invalid verdict '{verdict}'")

    db = SessionLocal()
    try:
        note = ClinicalNote(
            scan_id   = scan_id,
            doctor_id = doctor_id,
            note_text = note_text.strip(),
            verdict   = verdict,
        )
        db.add(note); db.commit(); db.refresh(note)
        print(f"✓ Note added — scan_id={scan_id}, verdict='{verdict}'")
        return note.to_dict()
    except Exception:
        db.rollback(); raise
    finally:
        db.close()


def get_notes_for_scan(scan_id: int) -> list:
    """Return all clinical notes for a scan, newest first."""
    db = SessionLocal()
    try:
        notes = (db.query(ClinicalNote)
                   .filter(ClinicalNote.scan_id == scan_id)
                   .order_by(ClinicalNote.created_at.desc())
                   .all())
        return [n.to_dict() for n in notes]
    finally:
        db.close()


def get_doctor_stats() -> dict:
    """
    NEW — Aggregate numbers for the doctor dashboard header.
    Returns total patients, total scans, pending/approved/flagged counts.
    """
    db = SessionLocal()
    try:
        total_patients = db.query(Patient).count()
        total_scans    = db.query(Scan).count()
        pending        = db.query(ClinicalNote).filter(
                            ClinicalNote.verdict == "pending").count()
        approved       = db.query(ClinicalNote).filter(
                            ClinicalNote.verdict == "approved").count()
        flagged        = db.query(ClinicalNote).filter(
                            ClinicalNote.verdict == "flagged").count()
        return {
            "total_patients": total_patients,
            "total_scans":    total_scans,
            "notes": {
                "pending":  pending,
                "approved": approved,
                "flagged":  flagged,
            },
        }
    finally:
        db.close()