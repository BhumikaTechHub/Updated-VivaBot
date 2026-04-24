# 📋 AI Virtual Viva — Task Breakdown

## Project Overview
Build a complete AI-powered Virtual Viva Examination System with web interface, backend APIs, and AI processing pipeline.

---

## ✅ Phase 1: Project Setup & Foundation

- [x] Initialize project structure (frontend + backend)
- [x] Set up React.js frontend with TailwindCSS
- [x] Set up Python FastAPI backend
- [x] Configure SQLite database with schema
- [x] Create predefined student accounts (10 accounts)
- [x] Set up CORS and API configuration

---

## ✅ Phase 2: Authentication System

- [x] Create Login page UI (username + password)
- [x] Implement POST `/api/login` endpoint
- [x] Session/token management
- [x] Redirect to Dashboard on successful login
- [x] Student Dashboard with name display and "Start Viva" button

---

## ✅ Phase 3: PDF Knowledge Processing

- [x] PDF upload interface (admin)
- [x] Text extraction using PyMuPDF
- [x] Text cleaning and preprocessing
- [x] Text chunking (200–400 words per chunk)
- [x] Store chunks in database
- [x] POST `/api/upload_pdf` endpoint

---

## ✅ Phase 4: Question Generation

- [x] Integrate T5 model (valhalla/t5-base-qg-hl)
- [x] Generate questions from text chunks
- [x] Generate reference answers for each question
- [x] Store questions in question pool database
- [x] POST `/api/generate_questions` endpoint

---

## ✅ Phase 5: Viva Session Management

- [x] Random selection of 10 questions per session
- [x] No question repetition within a session
- [x] Session tracking in database
- [x] POST `/api/start_viva` endpoint
- [x] GET `/api/get_next_question` endpoint

---

## ✅ Phase 6: Voice Input & Speech-to-Text

- [x] Microphone recording component
- [x] Web Speech API integration (browser-based STT)
- [x] Real-time transcription display
- [x] Vosk integration as fallback (server-side)
- [x] Audio stream handling

---

## ✅ Phase 7: Answer Evaluation

- [x] Integrate all-MiniLM-L6-v2 (Sentence Transformers)
- [x] Convert answers to embeddings
- [x] Compute cosine similarity
- [x] Score mapping (0.8+ → 9-10, 0.6+ → 7-8, 0.4+ → 5-6)
- [x] POST `/api/submit_answer` endpoint
- [x] Store per-question scores

---

## ✅ Phase 8: Results Dashboard

- [x] Display question-by-question results
- [x] Show student answer vs expected answer
- [x] Individual question scores
- [x] Final percentage calculation
- [x] GET `/api/get_results/{session_id}` endpoint

---

## ✅ Phase 9: UI/UX Polish

- [x] Progress indicator (e.g., "Question 3 of 10")
- [x] Smooth transitions between questions
- [x] "Answer Recorded" confirmation
- [x] Responsive design
- [x] Loading states and error handling

---

## ✅ Phase 10: Documentation & Testing

- [x] README.md with full setup instructions
- [x] task.md with task breakdown
- [x] API documentation (FastAPI auto-docs)
- [x] Predefined student account list

---

## 🔧 Tech Stack Summary

| Component       | Technology                        |
|----------------|-----------------------------------|
| Frontend        | React.js + TailwindCSS + Vite     |
| Backend         | Python FastAPI                    |
| Database        | SQLite                            |
| PDF Processing  | PyMuPDF (fitz)                   |
| Question Gen    | T5 (valhalla/t5-base-qg-hl)      |
| Speech-to-Text  | Web Speech API / Vosk             |
| Answer Eval     | all-MiniLM-L6-v2                  |

---

## 🗂️ Database Schema

### Students Table
| Column   | Type    | Description          |
|----------|---------|----------------------|
| id       | INTEGER | Primary key          |
| username | TEXT    | Unique username      |
| password | TEXT    | Hashed password      |

### Questions Table
| Column           | Type    | Description              |
|-----------------|---------|--------------------------|
| id              | INTEGER | Primary key              |
| question        | TEXT    | Generated question       |
| reference_answer| TEXT    | Expected answer          |
| context_chunk   | TEXT    | Source text chunk         |

### Sessions Table
| Column     | Type    | Description              |
|-----------|---------|--------------------------|
| id        | INTEGER | Primary key              |
| student_id| INTEGER | Foreign key → Students   |
| started_at| DATETIME| Session start time       |
| completed | BOOLEAN | Whether session is done   |

### Results Table
| Column         | Type    | Description              |
|---------------|---------|--------------------------|
| id            | INTEGER | Primary key              |
| session_id    | INTEGER | Foreign key → Sessions   |
| question_id   | INTEGER | Foreign key → Questions  |
| student_answer| TEXT    | Transcribed answer       |
| score         | REAL    | Evaluation score (0-10)  |
| similarity    | REAL    | Cosine similarity value  |

---

## 📌 Notes

- The system uses Web Speech API as the primary STT engine (runs in browser)
- Vosk is available as a server-side fallback for environments without Web Speech API
- T5 model downloads automatically on first run (~1GB)
- MiniLM model downloads automatically on first run (~80MB)
- SQLite database is created automatically on first backend start
