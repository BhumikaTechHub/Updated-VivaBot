"""
AI-Powered Virtual Viva Examination System
Main FastAPI Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import auth_router, admin_router, viva_router
from config import CORS_ORIGINS

# Create FastAPI app
app = FastAPI(
    title="AI Virtual Viva Examination System",
    description="An AI-powered system that simulates real oral viva examinations "
                "with automatic question generation, speech recognition, and semantic evaluation.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(viva_router.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database and create tables on startup."""
    print("🚀 Starting AI Virtual Viva System...")
    init_db()
    print("✅ Database initialized")
    print("📚 System ready! Access API docs at /docs")


@app.get("/")
async def root():
    return {
        "message": "AI Virtual Viva Examination System",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
