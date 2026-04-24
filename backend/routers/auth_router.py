"""
Authentication router for the AI Viva system.
Handles student login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db, Student
from auth import verify_password, create_access_token

router = APIRouter(prefix="/api", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    student_id: int
    username: str
    full_name: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a student.
    
    - Username and password are required.
    - Returns JWT access token on success.
    """
    student = db.query(Student).filter(Student.username == request.username).first()
    
    if not student or not verify_password(request.password, student.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": student.username})
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        student_id=student.id,
        username=student.username,
        full_name=student.full_name or student.username
    )
