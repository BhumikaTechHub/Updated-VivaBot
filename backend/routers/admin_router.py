"""
Admin router for PDF upload and question generation.
"""
import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db, TextChunk, Question
from models.pdf_processor import process_pdf
from models.question_generator import generate_all_questions
from config import UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["Admin"])


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
    """
    Upload a PDF textbook for processing.
    
    Pipeline:
    PDF → PyMuPDF → Text Extraction → Text Cleaning → Chunking → Database
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    
    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Process PDF
        result = process_pdf(file_path)
        
        # Store chunks in database
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
    """
    Generate questions from stored text chunks using T5 model.
    
    Pipeline:
    Text Chunks → T5 Model → Questions + Reference Answers → Database
    """
    # Get all text chunks
    chunks = db.query(TextChunk).all()
    
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No text chunks found. Please upload a PDF first."
        )
    
    # Extract chunk content
    chunk_texts = [chunk.content for chunk in chunks]
    
    # Generate questions
    try:
        generated = generate_all_questions(chunk_texts)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating questions: {str(e)}"
        )
    
    # Store questions in database
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
    """List all generated questions."""
    questions = db.query(Question).all()
    return questions


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get system statistics."""
    num_chunks = db.query(TextChunk).count()
    num_questions = db.query(Question).count()
    
    return {
        "text_chunks": num_chunks,
        "questions": num_questions,
        "system_ready": num_questions >= 10
    }
