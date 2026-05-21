"""
src/database.py
───────────────
NeuroDL v2.0 — PostgreSQL database models and helpers.

Tables:
  users    — registered patient accounts (email + bcrypt password)
  patients — patient profile linked to a user account
  scans    — MRI analysis results linked to a patient

PostgreSQL setup:
  brew install postgresql@15 && brew services start postgresql@15
  psql postgres -c "CREATE DATABASE neurodl;"
  psql postgres -c "CREATE USER neurodl_user WITH PASSWORD 'your_password';"
  psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE neurodl TO neurodl_user;"

Environment variable:
  DATABASE_URL=postgresql://neurodl_user:your_password@localhost:5432/neurodl
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

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://jatinsharma@localhost:5432/neurodl",
)

# PostgreSQL does NOT need check_same_thread
engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    """
    Registered patient account.
    One user -> one or more patient profiles (one per visit).
    """
    __tablename__ = "users"

    id            = Column(Integer,     primary_key=True, autoincrement=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name     = Column(String(150), nullable=False)
    created_at    = Column(DateTime,    default=datetime.utcnow)

    patients = relationship("Patient", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":         self.id,
            "email":      self.email,
            "full_name":  self.full_name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User id={self.id} email='{self.email}'>"


class Patient(Base):
    """
    Patient profile created before each MRI analysis session.
    Linked to an authenticated user account.
    """
    __tablename__ = "patients"

    id         = Column(Integer,     primary_key=True, autoincrement=True)
    user_id    = Column(Integer,     ForeignKey("users.id"), nullable=True)
    name       = Column(String(150), nullable=False)
    age        = Column(Integer,     nullable=False)
    gender     = Column(String(20),  nullable=False)
    phone      = Column(String(20),  nullable=True)
    symptoms   = Column(Text,        nullable=True)
    created_at = Column(DateTime,    default=datetime.utcnow)

    user = relationship("User",    back_populates="patients")
    scan = relationship("Scan",    back_populates="patient", uselist=False)

    def to_dict(self):
        return {
            "id":         self.id,
            "user_id":    self.user_id,
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
    """One MRI analysis record linked to a Patient."""
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
    """Create all tables. Called once at app startup."""
    Base.metadata.create_all(bind=engine)
    print("✓ PostgreSQL database initialised")


# ─── User CRUD ────────────────────────────────────────────────────────────────

def create_user(email: str, password_hash: str, full_name: str) -> "User":
    """
    Insert a new user. Raises ValueError if email already exists.
    Returns the User ORM object.
    """
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email.lower().strip()).first()
        if existing:
            raise ValueError("Email already registered")
        user = User(
            email         = email.lower().strip(),
            password_hash = password_hash,
            full_name     = full_name.strip(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✓ User created — id={user.id}, email='{user.email}'")
        return user
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_user_by_email(email: str):
    """Fetch a User by email (case-insensitive). Returns ORM object or None."""
    db = SessionLocal()
    try:
        return db.query(User).filter(User.email == email.lower().strip()).first()
    finally:
        db.close()


def get_user_by_id(user_id: int):
    """Fetch a User by primary key. Returns ORM object or None."""
    db = SessionLocal()
    try:
        return db.query(User).filter(User.id == user_id).first()
    finally:
        db.close()


# ─── Patient CRUD ─────────────────────────────────────────────────────────────

def create_patient(
    name:     str,
    age:      int,
    gender:   str,
    phone:    str = None,
    symptoms: str = None,
    user_id:  int = None,
) -> int:
    """Insert a new patient and return its ID."""
    db = SessionLocal()
    try:
        patient = Patient(
            user_id  = user_id,
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
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_patients(
    page:     int = 1,
    per_page: int = 20,
    search:   str = None,
    user_id:  int = None,
) -> dict:
    """Paginated patient list. Filtered by user_id to scope to logged-in user."""
    per_page = min(per_page, 100)
    db = SessionLocal()
    try:
        query = db.query(Patient)
        if user_id:
            query = query.filter(Patient.user_id == user_id)
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
    """Return a single patient with their scan, or None."""
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        return patient.to_dict() if patient else None
    finally:
        db.close()


def delete_patient(patient_id: int) -> bool:
    """Delete a patient and their linked scan."""
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return False
        db.delete(patient)
        db.commit()
        print(f"✓ Patient id={patient_id} deleted")
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ─── Scan CRUD ────────────────────────────────────────────────────────────────

def save_scan(
    predicted_class:        str,
    confidence_score:       float,
    segmentation_performed: bool = False,
    gradcam_performed:      bool = False,
    file_name:              str  = None,
    report_text:            str  = None,
    patient_id:             int  = None,
) -> int:
    """Insert a new scan record and return its ID."""
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
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_scans(
    page:       int = 1,
    per_page:   int = 20,
    class_name: str = None,
    date_from:  str = None,
    date_to:    str = None,
    user_id:    int = None,
) -> dict:
    """
    Paginated scan history. Scoped to user_id via patient join
    so patients only see their own scans.
    """
    per_page = min(per_page, 100)
    db = SessionLocal()
    try:
        query = db.query(Scan)
        if user_id:
            query = query.join(Patient).filter(Patient.user_id == user_id)
        if class_name:
            query = query.filter(Scan.predicted_class.ilike(f"%{class_name}%"))
        if date_from:
            try:
                query = query.filter(
                    Scan.scan_timestamp >= datetime.strptime(date_from, "%Y-%m-%d")
                )
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
    """Return a single scan by primary key."""
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
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()