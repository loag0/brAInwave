from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

DATABASE_URL = "sqlite:///./brainwave.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# This is where the AI data will live
class Base(DeclarativeBase):
    pass

class StudyMaterial(Base):
    __tablename__ = "study_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    rawContent = Column(Text)
    aiPlan = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
class Timetable(Base):
    __tablename__ = "timetables"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    structuredData = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

def init_db():
    Base.metadata.create_all(bind=engine)