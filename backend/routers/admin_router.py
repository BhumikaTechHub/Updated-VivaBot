import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime

from database import get_db, TextChunk, Question
from models.pdf_processor import process_pdf
from models.question_generator import generate_all_questions
from config import UPLOAD_DIR

router = APIRouter(tags=["Admin"])
# =====================================================
# IN-MEMORY STORE (Dashboard features)
# =====================================================

students_db = {}   # key: student_id -> value: student info
alerts_db = []     # list of alerts (latest first)

exam_status = {
    "running": False
}

def register_student(student_id: str, name: str = None):
    if student_id not in students_db:
        students_db[student_id] = {
            "id": student_id,
            "name": name or student_id,
            "status": "Online",
            "violations": 0,
            "suspicious": False,
            "last_seen": datetime.now().isoformat()
        }

def update_student_status(student_id: str, status: str):
    if student_id in students_db:
        students_db[student_id]["status"] = status
        students_db[student_id]["last_seen"] = datetime.now().isoformat()

def add_alert(student_id: str, alert_type: str):
    alert = {
        "id": int(datetime.now().timestamp() * 1000),
        "student": student_id,
        "type": alert_type,
        "time": datetime.now().strftime("%H:%M:%S")
    }
    alerts_db.insert(0, alert)

    if student_id in students_db:
        students_db[student_id]["violations"] += 1
        students_db[student_id]["suspicious"] = True

# =====================================================
# DASHBOARD API ROUTES
# =====================================================

@router.get("/admin/students")
def get_students():
    return list(students_db.values())

@router.get("/admin/alerts")
def get_alerts():
    return alerts_db[:50]

@router.get("/admin/stats")
def get_dashboard_stats():
    total_students = len(students_db)
    active_students = len([s for s in students_db.values() if s["status"] == "In Exam"])
    return {
        "total_students": total_students,
        "active_students": active_students,
        "total_alerts": len(alerts_db),
        "system_running": exam_status["running"]
    }

@router.post("/admin/exam/start")
def start_exam():
    exam_status["running"] = True
    for s in students_db.values():
        if s["status"] == "Online":
            s["status"] = "In Exam"
    return {"message": "Exam started"}

@router.post("/admin/exam/end")
def end_exam():
    exam_status["running"] = False
    for s in students_db.values():
        s["status"] = "Online"
        s["suspicious"] = False
    return {"message": "Exam ended"}

@router.post("/admin/student/block/{student_id}")
def block_student(student_id: str):
    if student_id in students_db:
        students_db[student_id]["status"] = "Blocked"
        return {"message": f"{student_id} blocked"}
    return {"error": "Student not found"}

@router.get("/admin/report")
def generate_report():
    return [
        {"student": s["name"], "violations": s["violations"], "status": s["status"]}
        for s in students_db.values()
    ]






# =====================================================
# PDF & QUESTION GENERATION (Original Code)
# =====================================================

class UploadResponse(BaseModel):
    message: str
    filename: str
    num_chunks: int
    text_length: int

class GenerateQuestionsResponse(BaseModel):
    message: str
    num_questions: int

class QuestionOut(BaseModel):
    id: int
    question: str
    reference_answer: str

    class Config:
        from_attributes = True

@router.post("/upload_pdf", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        result = process_pdf(file_path)
        for i, chunk in enumerate(result["chunks"]):
            text_chunk = TextChunk(
                content=chunk,
                source_file=file.filename,
                chunk_index=i
            )
            db.add(text_chunk)
        db.commit()
        
        return UploadResponse(
            message=f"PDF processed successfully. {result['num_chunks']} chunks extracted.",
            filename=file.filename,
            num_chunks=result["num_chunks"],
            text_length=result["cleaned_text_length"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.post("/generate_questions", response_model=GenerateQuestionsResponse)
async def generate_questions(db: Session = Depends(get_db)):
    chunks = db.query(TextChunk).all()
    if not chunks:
        raise HTTPException(status_code=400, detail="No text chunks found. Please upload a PDF first.")
    
    chunk_texts = [chunk.content for chunk in chunks]
    
    try:
        generated = generate_all_questions(chunk_texts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating questions: {str(e)}")
    
    count = 0
    for q in generated:
        question = Question(
            question=q["question"],
            reference_answer=q["reference_answer"],
            context_chunk=q.get("context", "")
        )
        db.add(question)
        count += 1
    
    db.commit()
    
    return GenerateQuestionsResponse(
        message=f"Successfully generated {count} questions",
        num_questions=count
    )


@router.get("/questions", response_model=List[QuestionOut])
async def list_questions(db: Session = Depends(get_db)):
    questions = db.query(Question).all()
    return questions


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    num_chunks = db.query(TextChunk).count()
    num_questions = db.query(Question).count()
    return {
        "text_chunks": num_chunks,
        "questions": num_questions,
        "system_ready": num_questions >= 10
    }