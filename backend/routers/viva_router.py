"""
Viva session router for the AI Viva system.
Handles viva sessions, question delivery, answer submission, and results.
"""
import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db, Question, VivaSession, SessionQuestion, Result, Student
from auth import get_current_student
from models.answer_evaluator import evaluate_answer
from config import QUESTIONS_PER_VIVA

router = APIRouter(prefix="/api", tags=["Viva"])


class StartVivaResponse(BaseModel):
    session_id: int
    total_questions: int
    message: str


class QuestionResponse(BaseModel):
    question_id: int
    question_text: str
    question_number: int
    total_questions: int
    is_last: bool


class SubmitAnswerRequest(BaseModel):
    session_id: int
    question_id: int
    student_answer: str


class SubmitAnswerResponse(BaseModel):
    score: float
    similarity: float
    grade: str
    feedback: str
    question_number: int
    is_last: bool


class ResultItem(BaseModel):
    question_number: int
    question_text: str
    student_answer: str
    reference_answer: str
    score: float
    similarity: float
    grade: str
    feedback: str


class VivaResults(BaseModel):
    session_id: int
    student_name: str
    total_questions: int
    total_score: float
    max_score: float
    percentage: float
    results: List[ResultItem]


@router.post("/start_viva", response_model=StartVivaResponse)
async def start_viva(
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    Start a new viva session.
    
    Pipeline:
    Question Pool → Random Sampling → 10 Questions → Session Created
    """
    # Get all available questions
    all_questions = db.query(Question).all()
    
    if len(all_questions) < QUESTIONS_PER_VIVA:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough questions in the pool. Need at least {QUESTIONS_PER_VIVA}, "
                   f"but only {len(all_questions)} available. Please upload a PDF and generate questions first."
        )
    
    # Randomly select questions (no repetition)
    selected = random.sample(all_questions, QUESTIONS_PER_VIVA)
    
    # Create viva session
    session = VivaSession(
        student_id=student.id,
        current_question_index=0
    )
    db.add(session)
    db.flush()
    
    # Create session questions with order
    for i, q in enumerate(selected):
        sq = SessionQuestion(
            session_id=session.id,
            question_id=q.id,
            question_order=i
        )
        db.add(sq)
    
    db.commit()
    db.refresh(session)
    
    return StartVivaResponse(
        session_id=session.id,
        total_questions=QUESTIONS_PER_VIVA,
        message="Viva session started! Good luck!"
    )


@router.get("/get_next_question", response_model=QuestionResponse)
async def get_next_question(
    session_id: int,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    Get the next question in the viva session.
    
    Returns the current unanswered question based on session progress.
    """
    # Get session
    session = db.query(VivaSession).filter(
        VivaSession.id == session_id,
        VivaSession.student_id == student.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.completed:
        raise HTTPException(status_code=400, detail="This viva session is already completed")
    
    # Get the current question
    current_sq = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id,
        SessionQuestion.question_order == session.current_question_index
    ).first()
    
    if not current_sq:
        raise HTTPException(status_code=400, detail="No more questions available")
    
    question = db.query(Question).filter(Question.id == current_sq.question_id).first()
    
    total = QUESTIONS_PER_VIVA
    current_num = session.current_question_index + 1
    
    return QuestionResponse(
        question_id=question.id,
        question_text=question.question,
        question_number=current_num,
        total_questions=total,
        is_last=(current_num == total)
    )


@router.post("/submit_answer", response_model=SubmitAnswerResponse)
async def submit_answer(
    request: SubmitAnswerRequest,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    Submit and evaluate an answer.
    
    Pipeline:
    Student Answer → Embedding → Cosine Similarity → Score → Database
    """
    # Validate session
    session = db.query(VivaSession).filter(
        VivaSession.id == request.session_id,
        VivaSession.student_id == student.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.completed:
        raise HTTPException(status_code=400, detail="Session already completed")
    
    # Get the question
    question = db.query(Question).filter(Question.id == request.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Evaluate the answer using MiniLM
    evaluation = evaluate_answer(request.student_answer, question.reference_answer)
    
    # Store result
    result = Result(
        session_id=session.id,
        question_id=question.id,
        student_answer=request.student_answer,
        score=evaluation["score"],
        similarity=evaluation["similarity"]
    )
    db.add(result)
    
    # Advance to next question
    session.current_question_index += 1
    current_num = session.current_question_index
    is_last = current_num >= QUESTIONS_PER_VIVA
    
    if is_last:
        session.completed = True
    
    db.commit()
    
    return SubmitAnswerResponse(
        score=evaluation["score"],
        similarity=evaluation["similarity"],
        grade=evaluation["grade"],
        feedback=evaluation["feedback"],
        question_number=current_num,
        is_last=is_last
    )


class SkipQuestionRequest(BaseModel):
    session_id: int
    question_id: int


@router.post("/skip_question", response_model=SubmitAnswerResponse)
async def skip_question(
    request: SkipQuestionRequest,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    Skip a question the student doesn't know.
    Records a score of 0 and moves to the next question.
    """
    session = db.query(VivaSession).filter(
        VivaSession.id == request.session_id,
        VivaSession.student_id == student.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.completed:
        raise HTTPException(status_code=400, detail="Session already completed")

    question = db.query(Question).filter(Question.id == request.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Store result with score 0
    result = Result(
        session_id=session.id,
        question_id=question.id,
        student_answer="[Skipped]",
        score=0.0,
        similarity=0.0
    )
    db.add(result)

    # Advance to next question
    session.current_question_index += 1
    current_num = session.current_question_index
    is_last = current_num >= QUESTIONS_PER_VIVA

    if is_last:
        session.completed = True

    db.commit()

    return SubmitAnswerResponse(
        score=0.0,
        similarity=0.0,
        grade="Skipped",
        feedback="Question was skipped.",
        question_number=current_num,
        is_last=is_last
    )


@router.get("/get_results/{session_id}", response_model=VivaResults)
async def get_results(
    session_id: int,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    """
    Get the complete results for a viva session.
    
    Returns question-by-question scores, answers, and final percentage.
    """
    # Get session
    session = db.query(VivaSession).filter(
        VivaSession.id == session_id,
        VivaSession.student_id == student.id
    ).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get all results with questions, ordered
    session_questions = db.query(SessionQuestion).filter(
        SessionQuestion.session_id == session.id
    ).order_by(SessionQuestion.question_order).all()
    
    result_items = []
    total_score = 0.0
    
    for i, sq in enumerate(session_questions):
        question = db.query(Question).filter(Question.id == sq.question_id).first()
        result = db.query(Result).filter(
            Result.session_id == session.id,
            Result.question_id == sq.question_id
        ).first()
        
        if result:
            score = result.score
            similarity = result.similarity
            student_answer = result.student_answer or ""
        else:
            score = 0.0
            similarity = 0.0
            student_answer = "Not answered"
        
        total_score += score
        
        # Determine grade from score
        if score >= 9:
            grade = "Excellent"
            feedback = "Outstanding answer!"
        elif score >= 7:
            grade = "Good"
            feedback = "Good answer with relevant points."
        elif score >= 5:
            grade = "Average"
            feedback = "Partially correct answer."
        elif score >= 3:
            grade = "Below Average"
            feedback = "Needs improvement."
        else:
            grade = "Poor"
            feedback = "Inadequate answer."
        
        result_items.append(ResultItem(
            question_number=i + 1,
            question_text=question.question,
            student_answer=student_answer,
            reference_answer=question.reference_answer,
            score=score,
            similarity=similarity,
            grade=grade,
            feedback=feedback
        ))
    
    max_score = QUESTIONS_PER_VIVA * 10.0
    percentage = round((total_score / max_score) * 100, 1) if max_score > 0 else 0.0
    
    return VivaResults(
        session_id=session.id,
        student_name=student.full_name or student.username,
        total_questions=len(session_questions),
        total_score=round(total_score, 1),
        max_score=max_score,
        percentage=percentage,
        results=result_items
    )
