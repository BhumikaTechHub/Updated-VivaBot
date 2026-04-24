"""
Database models and setup for the AI Viva system.
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import hashlib
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)

    sessions = relationship("VivaSession", back_populates="student")


class TextChunk(Base):
    __tablename__ = "text_chunks"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    source_file = Column(String(255), nullable=True)
    chunk_index = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=False)
    context_chunk = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("Result", back_populates="question")


class VivaSession(Base):
    __tablename__ = "viva_sessions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed = Column(Boolean, default=False)
    current_question_index = Column(Integer, default=0)

    student = relationship("Student", back_populates="sessions")
    results = relationship("Result", back_populates="session")
    session_questions = relationship("SessionQuestion", back_populates="session")


class SessionQuestion(Base):
    __tablename__ = "session_questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("viva_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    question_order = Column(Integer, nullable=False)

    session = relationship("VivaSession", back_populates="session_questions")
    question = relationship("Question")


class Result(Base):
    __tablename__ = "results"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("viva_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    student_answer = Column(Text, nullable=True)
    score = Column(Float, default=0.0)
    similarity = Column(Float, default=0.0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("VivaSession", back_populates="results")
    question = relationship("Question", back_populates="results")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database and create tables."""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if students already exist
        existing = db.query(Student).count()
        if existing == 0:
            # Create 10 predefined student accounts
            students = []
            for i in range(1, 11):
                student = Student(
                    username=f"student{i}",
                    password=hash_password(f"pass{i}"),
                    full_name=f"Student {i}"
                )
                students.append(student)
            db.add_all(students)
            db.commit()
            print("✅ Created 10 predefined student accounts")
        else:
            print(f"ℹ️  {existing} student accounts already exist")
    finally:
        db.close()
