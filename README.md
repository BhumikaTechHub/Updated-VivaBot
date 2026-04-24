#  AI-Powered Virtual Viva Examination System

A complete AI-powered Virtual Viva Examination System that simulates a real oral viva examination. Students answer questions verbally while the system evaluates responses automatically using state-of-the-art NLP models.

---

##  Architecture

```
PDF → Text Extraction → Question Generation → Question Pool
→ Random Question Selection → Question Display
→ Student Voice Input → Speech-to-Text
→ Semantic Evaluation → Score Calculation
→ Result Dashboard
```

##  Tech Stack

| Layer      | Technology                                      |
|------------|--------------------------------------------------|
| Frontend   | React.js, TailwindCSS, Web Speech API            |
| Backend    | Python FastAPI                                    |
| Database   | SQLite                                           |
| PDF        | PyMuPDF (fitz)                                   |
| QG Model   | T5 (valhalla/t5-base-qg-hl)                     |
| STT        | Web Speech API (browser) / Vosk (fallback)       |
| Evaluation | all-MiniLM-L6-v2 (Sentence Transformers)         |

---

##  Project Structure

```
ai-viva/
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration settings
│   ├── database.py             # Database models & setup
│   ├── auth.py                 # Authentication logic
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   ├── pdf_processor.py    # PDF text extraction & chunking
│   │   ├── question_generator.py # T5-based question generation
│   │   ├── speech_recognizer.py  # Vosk speech recognition
│   │   └── answer_evaluator.py   # Semantic similarity scoring
│   ├── routers/
│   │   ├── auth_router.py      # Login endpoints
│   │   ├── viva_router.py      # Viva session endpoints
│   │   └── admin_router.py     # PDF upload & admin endpoints
│   └── uploads/                # Uploaded PDF storage
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx       # Login page
│   │   │   ├── Dashboard.jsx   # Student dashboard
│   │   │   ├── VivaInterface.jsx # Exam interface
│   │   │   ├── Microphone.jsx  # Voice recording component
│   │   │   ├── Transcription.jsx # Real-time transcription
│   │   │   └── Results.jsx     # Result dashboard
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── README.md
└── task.md
```

---

##  Getting Started

### Prerequisites

- **Python 3.9+**
- **Node.js 18+**
- **npm** or **yarn**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ai-viva
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download Vosk model (optional, for server-side STT)
# The system uses Web Speech API by default for browser-based STT
# For Vosk fallback, download a model from https://alphacephei.com/vosk/models

# Start the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

##  Predefined Student Accounts

| Username   | Password   |
|------------|------------|
| student1   | pass1      |
| student2   | pass2      |
| student3   | pass3      |
| student4   | pass4      |
| student5   | pass5      |
| student6   | pass6      |
| student7   | pass7      |
| student8   | pass8      |
| student9   | pass9      |
| student10  | pass10     |

---

## 📋 System Workflow

1. **Student Login** → Authenticate with predefined credentials
2. **Admin Uploads PDF** → System extracts text and generates questions
3. **Start Viva** → 10 random questions selected from the pool
4. **Answer Questions** → Student speaks into microphone
5. **Speech-to-Text** → Real-time transcription via Web Speech API
6. **AI Evaluation** → Semantic similarity scoring via MiniLM
7. **View Results** → Detailed score breakdown and final percentage

---

## API Endpoints

| Method | Endpoint              | Description                       |
|--------|-----------------------|-----------------------------------|
| POST   | `/api/login`          | Student authentication            |
| POST   | `/api/upload_pdf`     | Upload and process course PDF     |
| POST   | `/api/generate_questions` | Generate questions from PDF   |
| POST   | `/api/start_viva`     | Start a new viva session          |
| GET    | `/api/get_next_question` | Get the next question           |
| POST   | `/api/submit_answer`  | Submit and evaluate an answer     |
| GET    | `/api/get_results/{session_id}` | Get viva results        |

---

##  AI Models Used

### 1. PyMuPDF (fitz)
- Extracts text from uploaded PDF textbooks
- Handles multi-page documents with text cleaning

### 2. T5 Question Generation (valhalla/t5-base-qg-hl)
- Generates contextual questions from text chunks
- Input: highlighted context passage
- Output: relevant exam questions

### 3. Web Speech API / Vosk
- Browser-based speech recognition (primary)
- Vosk as server-side fallback for offline use
- Real-time transcription display

### 4. all-MiniLM-L6-v2 (Sentence Transformers)
- Computes semantic similarity between student answer and reference answer
- Uses cosine similarity for scoring
- Score mapping: >0.8 → 9-10, >0.6 → 7-8, >0.4 → 5-6

---

##  License

This project is for educational purposes.
