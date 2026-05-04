"""
Semantic answer evaluation module using Sentence Transformers.
Uses all-MiniLM-L6-v2 for computing semantic similarity.

Combines:
1. Semantic similarity (embeddings + cosine)
2. Keyword matching (key terms from reference found in student answer)
3. Length-aware scoring (short but correct answers are not penalized)
"""
import re
import numpy as np
from typing import Dict, List, Set
from sentence_transformers import SentenceTransformer
from config import SENTENCE_MODEL_NAME
import nltk
from nltk.stem import WordNetLemmatizer
from nltk.corpus import stopwords

# Global model cache
_model = None
_lemmatizer = None
_nltk_initialized = False

# Common stop words to ignore during keyword matching
_STOP_WORDS = {
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
    'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to',
    'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'it', 'its', 'it\'s', 'they', 'them', 'their', 'we', 'us', 'our',
    'he', 'him', 'his', 'she', 'her', 'i', 'me', 'my', 'you', 'your',
    'also', 'then', 'there', 'here', 'up', 'out', 'down',
}

def _ensure_nltk_data():
    """Ensure NLTK data is downloaded for lemmatization and stopwords."""
    global _nltk_initialized, _lemmatizer
    if not _nltk_initialized:
        for pkg in ['wordnet', 'omw-1.4', 'stopwords']:
            try:
                nltk.data.find(f'corpora/{pkg}')
            except LookupError:
                nltk.download(pkg, quiet=True)
        _lemmatizer = WordNetLemmatizer()
        _nltk_initialized = True


def load_model():
    """Load the Sentence Transformer model (cached)."""
    global _model
    if _model is None:
        print(f"📥 Loading Sentence Transformer: {SENTENCE_MODEL_NAME}...")
        _model = SentenceTransformer(SENTENCE_MODEL_NAME)
        print("✅ Sentence Transformer loaded successfully")
    return _model


def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def normalize_text(text: str) -> str:
    """
    Normalize text for concept-level evaluation:
    - lowercase
    - extract words
    - remove extended stopwords
    - lemmatize
    """
    _ensure_nltk_data()
    # Combine custom stopwords with NLTK stopwords for maximum filtering
    all_stop_words = _STOP_WORDS.union(set(stopwords.words('english')))
    
    words = re.findall(r'[a-zA-Z]+', text.lower())
    lemmatized = [_lemmatizer.lemmatize(w) for w in words if w not in all_stop_words and len(w) > 2]
    return " ".join(lemmatized)


def extract_keywords(text: str) -> Set[str]:
    """Extract meaningful keywords from text."""
    # normalize_text already handles lowering, stopwords, and lemmatization
    return set(normalize_text(text).split())


def compute_keyword_overlap(student_answer: str, reference_answer: str) -> float:
    """
    Compute what fraction of the reference answer's key terms
    appear in the student's answer.
    """
    ref_keywords = extract_keywords(reference_answer)
    student_keywords = extract_keywords(student_answer)

    if not ref_keywords:
        return 1.0  # No keywords to match = full credit

    matched = ref_keywords & student_keywords
    return len(matched) / len(ref_keywords)


def combined_score(similarity: float, keyword_overlap: float) -> float:
    """
    Combine semantic similarity and keyword overlap into a final score.
    Dynamically weights based on overlap.
    """
    semantic_score = similarity_to_score(similarity)

    if keyword_overlap >= 0.5:
        keyword_score = keyword_overlap * 10.0
        boosted = 0.5 * semantic_score + 0.5 * keyword_score
    elif keyword_overlap >= 0.3:
        boosted = 0.6 * semantic_score + 0.4 * (keyword_overlap * 10.0)
    else:
        boosted = semantic_score

    final = max(semantic_score, boosted)

    if keyword_overlap >= 0.7 and similarity >= 0.4:
        final = max(final, 8.5 + keyword_overlap * 1.5)

    return min(10.0, max(0.0, round(final, 1)))


def similarity_to_score(similarity: float) -> float:
    """
    Convert cosine similarity to a score out of 10.
    Dynamically adjusted for leniency because embeddings of lemmatized text
    (without stop words) often have slightly lower absolute similarities than natural language.
    """
    if similarity > 0.70:
        return 9.0 + (similarity - 0.70) * 3.33
    elif similarity > 0.50:
        return 7.0 + (similarity - 0.50) * 10.0
    elif similarity > 0.35:
        return 5.0 + (similarity - 0.35) * 13.3
    elif similarity > 0.20:
        return 3.0 + (similarity - 0.20) * 13.3
    else:
        return 1.0 + similarity * 10.0


def evaluate_answer(student_answer: str, reference_answer: str) -> Dict:
    """
    Evaluate a student's answer against the reference answer.
    Ensures comparison of concept-level meaning rather than surface syntax.
    """
    model = load_model()

    if not student_answer or not student_answer.strip():
        return {
            "similarity": 0.0,
            "score": 0.0,
            "grade": "No Answer",
            "feedback": "No answer was provided."
        }

    answer_lower = student_answer.strip().lower()
    skip_phrases = [
        "i don't know", "i dont know", "idk", "no idea", "not sure",
        "i don't remember", "i dont remember", "can't remember",
        "no answer", "skip", "pass", "i have no idea",
        "i'm not sure", "im not sure", "don't know", "dont know",
        "i do not know", "no clue", "not aware", "i forget",
        "i forgot", "can not answer", "cannot answer",
    ]
    if any(phrase in answer_lower for phrase in skip_phrases) and len(answer_lower.split()) < 10:
        return {
            "similarity": 0.0,
            "score": 0.0,
            "grade": "Skipped",
            "feedback": "Question was skipped."
        }

    # Step 1: Normalize text to extract concept-level meaning
    norm_student = normalize_text(student_answer)
    norm_reference = normalize_text(reference_answer)

    if not norm_student and student_answer:
        return {
            "similarity": 0.0,
            "score": 1.0,
            "grade": "Poor",
            "feedback": "The answer did not contain sufficient meaningful content."
        }

    # Step 2: Compute semantic similarity via embeddings on normalized concept text
    student_embedding = model.encode(norm_student)
    reference_embedding = model.encode(norm_reference)

    similarity = compute_cosine_similarity(student_embedding, reference_embedding)
    similarity = max(0.0, min(1.0, similarity))

    # Step 3: Compute keyword overlap (uses normalized text internally)
    keyword_overlap = compute_keyword_overlap(student_answer, reference_answer)

    # Step 4: Combine both signals for a robust semantic score
    score = combined_score(similarity, keyword_overlap)

    if score >= 9:
        grade = "Excellent"
        feedback = "Outstanding answer! Very accurate and comprehensive."
    elif score >= 7:
        grade = "Good"
        feedback = "Good answer with relevant key points covered."
    elif score >= 5:
        grade = "Average"
        feedback = "Partially correct. Some key concepts are missing."
    elif score >= 3:
        grade = "Below Average"
        feedback = "The answer needs significant improvement."
    else:
        grade = "Poor"
        feedback = "The answer does not adequately address the question."

    return {
        "similarity": round(similarity, 4),
        "score": score,
        "grade": grade,
        "feedback": feedback
    }
