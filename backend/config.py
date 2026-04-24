"""
Configuration settings for the AI Viva backend.
"""
import os

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Database
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'viva.db')}"

# JWT Settings
SECRET_KEY = "ai-viva-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

# Upload settings
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# AI Model settings
T5_MODEL_NAME = "valhalla/t5-base-qg-hl"
SENTENCE_MODEL_NAME = "all-MiniLM-L6-v2"

# Viva settings
QUESTIONS_PER_VIVA = 10
CHUNK_MIN_WORDS = 200
CHUNK_MAX_WORDS = 400

# Scoring thresholds
SCORE_THRESHOLDS = {
    "excellent": {"min_similarity": 0.8, "score_range": (9, 10)},
    "good": {"min_similarity": 0.6, "score_range": (7, 8)},
    "average": {"min_similarity": 0.4, "score_range": (5, 6)},
    "below_average": {"min_similarity": 0.2, "score_range": (3, 4)},
    "poor": {"min_similarity": 0.0, "score_range": (1, 2)},
}

# CORS
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
