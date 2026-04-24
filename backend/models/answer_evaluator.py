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

# Global model cache
_model = None

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


def load_model():
    """Load the Sentence Transformer model (cached)."""
    global _model
    if _model is None:
        print(f"📥 Loading Sentence Transformer: {SENTENCE_MODEL_NAME}...")
        _model = SentenceTransformer(SENTENCE_MODEL_NAME)
        print("✅ Sentence Transformer loaded successfully")
    return _model


def compute_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Compute cosine similarity between two vectors.

    Formula: cos(A,B) = (A · B) / (||A|| × ||B||)
    """
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot_product / (norm_a * norm_b))


def extract_keywords(text: str) -> Set[str]:
    """Extract meaningful keywords from text (no stop words, lowered)."""
    words = re.findall(r'[a-zA-Z]+', text.lower())
    return {w for w in words if w not in _STOP_WORDS and len(w) > 2}


def compute_keyword_overlap(student_answer: str, reference_answer: str) -> float:
    """
    Compute what fraction of the reference answer's key terms
    appear in the student's answer.

    Returns a value between 0.0 and 1.0.
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

    Strategy:
    - Use the HIGHER of (semantic_score, keyword_boosted_score)
    - This ensures short but correct answers are not penalized
    - Keyword overlap boosts the semantic similarity when key terms match

    Example: "data link layer" vs long reference about data link layer
    - Semantic similarity might be ~0.65 (penalized by length mismatch)
    - Keyword overlap might be ~0.8 (key terms match well)
    - Combined takes the best signal from both approaches
    """
    # Pure semantic score
    semantic_score = similarity_to_score(similarity)

    # Keyword-boosted score: if student hits the key terms, boost heavily
    if keyword_overlap >= 0.5:
        # Student mentioned at least half the key concepts
        # Boost: blend keyword overlap into the score
        keyword_score = keyword_overlap * 10.0
        # Weighted combination: semantic + keyword
        boosted = 0.5 * semantic_score + 0.5 * keyword_score
    elif keyword_overlap >= 0.3:
        boosted = 0.6 * semantic_score + 0.4 * (keyword_overlap * 10.0)
    else:
        boosted = semantic_score

    # Take the higher of pure semantic and boosted
    final = max(semantic_score, boosted)

    # Extra boost: if keyword overlap is very high (>0.7),
    # the student clearly knows the answer
    if keyword_overlap >= 0.7 and similarity >= 0.5:
        final = max(final, 8.5 + keyword_overlap * 1.5)

    return min(10.0, max(0.0, round(final, 1)))


def similarity_to_score(similarity: float) -> float:
    """
    Convert cosine similarity to a score out of 10.

    More lenient mapping (adjusted for real-world viva answers):
    > 0.75 → 9-10
    > 0.55 → 7-9
    > 0.40 → 5-7
    > 0.25 → 3-5
    <= 0.25 → 1-3
    """
    if similarity > 0.75:
        # Map 0.75-1.0 to 9-10
        return 9.0 + (similarity - 0.75) * 4.0
    elif similarity > 0.55:
        # Map 0.55-0.75 to 7-9
        return 7.0 + (similarity - 0.55) * 10.0
    elif similarity > 0.40:
        # Map 0.40-0.55 to 5-7
        return 5.0 + (similarity - 0.40) * 13.3
    elif similarity > 0.25:
        # Map 0.25-0.40 to 3-5
        return 3.0 + (similarity - 0.25) * 13.3
    else:
        # Map 0.0-0.25 to 1-3
        return 1.0 + similarity * 8.0


def evaluate_answer(student_answer: str, reference_answer: str) -> Dict:
    """
    Evaluate a student's answer against the reference answer.

    Pipeline:
    1. Student Answer → Embedding + Keywords
    2. Reference Answer → Embedding + Keywords
    3. Semantic Similarity (cosine)
    4. Keyword Overlap (term matching)
    5. Combined Score (best of both signals)

    Returns dict with similarity, score, grade, and feedback.
    """
    model = load_model()

    # Handle empty answers
    if not student_answer or not student_answer.strip():
        return {
            "similarity": 0.0,
            "score": 0.0,
            "grade": "No Answer",
            "feedback": "No answer was provided."
        }

    # Detect "I don't know" type answers → treat as skip
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

    # Step 1: Compute semantic similarity via embeddings
    student_embedding = model.encode(student_answer)
    reference_embedding = model.encode(reference_answer)

    similarity = compute_cosine_similarity(student_embedding, reference_embedding)
    similarity = max(0.0, min(1.0, similarity))

    # Step 2: Compute keyword overlap
    keyword_overlap = compute_keyword_overlap(student_answer, reference_answer)

    # Step 3: Combine both signals for a fair score
    score = combined_score(similarity, keyword_overlap)

    # Determine grade
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
