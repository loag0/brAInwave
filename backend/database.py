import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from datetime import datetime, timezone

# For railway dashboard
# Format: postgresql://user:password@host:port/dbname
DATABASE_URL = os.environ.get("DATABASE_URL")
#DATABASE_URL = "SQLITE:///./brainwave.db"  # For local testing with SQLite

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    title = Column(String, index=True)
    rawContent = Column(Text)
    aiPlan = Column(Text)
    file_uri = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_deleted = Column(Integer, default=0)


class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    title = Column(String, index=True)
    structuredData = Column(Text)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_deleted = Column(Integer, default=0)


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    title = Column(String, index=True)
    subject = Column(String, index=True)
    due_date = Column(String)  # YYYY-MM-DD
    priority = Column(String)  # low, medium, high
    rawContent = Column(Text)
    file_uri = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_deleted = Column(Integer, default=0)


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    material_id = Column(Integer, index=True)
    question = Column(Text)
    answer = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class DailyPlan(Base):
    __tablename__ = "daily_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    date = Column(String)  # YYYY-MM-DD
    items_json = Column(Text)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class CompletionLog(Base):
    __tablename__ = "completion_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    date = Column(String)  # YYYY-MM-DD
    minutes_studied = Column(Integer, default=0)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()