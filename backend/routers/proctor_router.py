from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from database import get_db, VivaSession, Student
from auth import get_current_student
from models.proctoring import detect_restricted_objects

router = APIRouter(prefix="/proctor", tags=["Proctoring"])

class FrameRequest(BaseModel):
    session_id: int
    image_data: str

class ProctorResponse(BaseModel):
    warnings: int
    detected_objects: List[str]
    terminate: bool
    message: str
    minor_message: str

@router.post("/frame", response_model=ProctorResponse)
async def process_frame(
    request: FrameRequest,
    student: Student = Depends(get_current_student),
    db: Session = Depends(get_db)
):
    # Verify session
    session = db.query(VivaSession).filter(
        VivaSession.id == request.session_id,
        VivaSession.student_id == student.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.completed:
        return ProctorResponse(
            warnings=session.proctor_warnings,
            detected_objects=[],
            terminate=True,
            message="Session is already completed.",
            minor_message=""
        )

    # Process image
    results = detect_restricted_objects(request.image_data)
    critical_issues = results.get("critical", [])
    minor_issues = results.get("minor", [])

    terminate = False
    msg = ""
    minor_msg = ", ".join(minor_issues) if minor_issues else ""

    if critical_issues:
        # Increment warnings for critical violations only
        session.proctor_warnings += 1
        
        if session.proctor_warnings >= 4:
            session.completed = True
            terminate = True
            msg = "Exam terminated due to repeated proctoring violations. All attempts exhausted."
        else:
            msg = f"Warning {session.proctor_warnings}/3: {', '.join(critical_issues)}. Please clear your desk immediately."

        db.commit()
        print(f"CRITICAL VIOLATION: {critical_issues} | Session: {session.id} | Warnings: {session.proctor_warnings}")
    
    return ProctorResponse(
        warnings=session.proctor_warnings,
        detected_objects=critical_issues,
        terminate=terminate,
        message=msg,
        minor_message=minor_msg
    )
