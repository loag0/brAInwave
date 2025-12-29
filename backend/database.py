from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./brainwave.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# This is where your AI data will live
class StudyMaterial(Base):
    __tablename__ = "study_materials"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    raw_content = Column(Text)  # The text extracted from the PDF
    ai_summary = Column(Text)   # The summary from BART
    ai_plan = Column(Text)      # The schedule from FLAN-T5

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)

def init_db():
    Base.metadata.create_all(bind=engine)