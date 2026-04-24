"""
Question generation module using T5 Transformer.
Uses HuggingFace model: valhalla/t5-base-qg-hl

Generates general, conceptual, and definition-type questions
(not specific value/numeric questions).
"""
import re
from typing import List, Dict
from transformers import T5ForConditionalGeneration, T5Tokenizer
from config import T5_MODEL_NAME

# Global model cache
_model = None
_tokenizer = None

# Patterns for questions that are too specific / value-based
_BAD_QUESTION_PATTERNS = [
    r'\bvalue of\b',
    r'\bhow many\b.*\b(?:bits?|bytes?|packets?)\b',
    r'\bwhat is the size\b',
    r'\bwhat is the number\b',
    r'\bwhat is the length\b',
    r'\bcalculate\b',
    r'\bcompute\b',
    r'\bfigure\b.*\bshows?\b',
    r'\bexample\b.*\b(?:given|shown|above|below)\b',
    r'^\s*what is \d',
    r'\bwhat is the \d',
    r'\bhow much\b',
    # Context-dependent / relative references (useless without the passage)
    r'\bthe first\b(?!.{0,5}\b(?:layer|step|phase|stage|type|generation|category)\b)',
    r'\bthe second\b',
    r'\bthe third\b',
    r'\bthe fourth\b',
    r'\bthe fifth\b',
    r'\bthe last\b',
    r'\bthe next\b',
    r'\bthe previous\b',
    r'\bthe above\b',
    r'\bthe below\b',
    r'\bthis (?:method|approach|technique|chapter|section|paragraph|table|diagram|book|paper|article|page|passage)\b',
    r'\bthat (?:method|approach|technique|chapter|section)\b',
    r'\bcompare[sd]? to the\b',
    r'\bcompare[sd]? with the\b',
    r'\bhow does (?:it|this|that) compare\b',
    r'\bwhat (?:is|are) (?:it|its|they|their|them)\b',
    r'^what (?:does|do) (?:it|they) ',
    r'\bwhat happens (?:next|after|before|then)\b',
    r'\bin the (?:above|following|previous)\b',
    r'\bmentioned (?:above|earlier|before|previously)\b',
    r'\brefer(?:s|red)? to (?:above|earlier|previously)\b',
    r'\bas (?:shown|seen|mentioned|described|discussed|stated|noted) (?:above|earlier|below|previously|in the)\b',
    r'\bwhat is the (?:main |primary )?(?:purpose|point|idea|goal|aim) of (?:this|the) (?:chapter|section|paragraph|book|passage|text)\b',
    r'\bwhat is this\b',
    r'\bwhat is that\b',
    r'\bpreparation for\b',
    # Document structure artifacts (TOC, headers, questions numbers)
    r'\bpart\s+[ivxlcdm0-9]+\b',
    r'\bchapter\s+\d+\b',
    r'\bsection\s+\d+\b',
    r'\bq\d+(?:-\d+)?\b',
    r'\bmodule\s+\d+\b',
    r'\bunit\s+\d+\b',
    r'\boverview\b',
    r'\bintroduction\b',
    r'\bconclusion\b',
    r'\bsummary\b',
    r'\breferences?\b',
    r'\bappendix\b',
    r'\bindex\b',
    r'\btable of contents\b',
    r'\blearning objectives?\b',
]

# Keywords that signal good general/conceptual questions
_GOOD_QUESTION_STARTERS = [
    'what is ', 'what are ', 'what does ', 'what do ',
    'define ', 'explain ', 'describe ',
    'why is ', 'why are ', 'why does ', 'why do ',
    'how does ', 'how do ', 'how is ', 'how are ',
    'what role ', 'what purpose ', 'what function ',
    'what type ', 'what kind ',
    'which ', 'name ',
]


def load_model():
    """Load the T5 question generation model (cached)."""
    global _model, _tokenizer
    if _model is None:
        print(f"📥 Loading T5 model: {T5_MODEL_NAME}...")
        _tokenizer = T5Tokenizer.from_pretrained(T5_MODEL_NAME)
        _model = T5ForConditionalGeneration.from_pretrained(T5_MODEL_NAME)
        print("✅ T5 model loaded successfully")
    return _model, _tokenizer


def is_good_question(question: str) -> bool:
    """
    Filter: keep general/conceptual questions, reject specific
    value-based or context-dependent ones.
    """
    q_lower = question.lower().strip()

    # Reject questions matching bad patterns
    for pattern in _BAD_QUESTION_PATTERNS:
        if re.search(pattern, q_lower):
            return False

    # Reject very short questions (< 5 words)
    if len(q_lower.split()) < 5:
        return False

    # Reject questions that are mostly numbers
    words = q_lower.split()
    num_count = sum(1 for w in words if re.match(r'^\d+\.?\d*$', w))
    if num_count > len(words) * 0.3:
        return False

    # Reject questions that don't contain a recognizable technical/conceptual term
    # (i.e., questions that are purely about relative/contextual things)
    has_noun = bool(re.search(
        r'\b[A-Za-z]{4,}\b',  # at least one word with 4+ letters
        question
    ))
    if not has_noun:
        return False

    return True


def _extract_definition_sentence(context: str) -> List[str]:
    """
    Extract sentences that contain definitions, explanations, or key concepts.
    These make the best reference answers for general questions.
    """
    sentences = re.split(r'(?<=[.!?])\s+', context)
    definition_sentences = []

    # Patterns that indicate a definition or concept explanation
    concept_patterns = [
        r'\bis (?:a|an|the|defined|used|responsible)\b',
        r'\bare (?:used|designed|responsible|classified)\b',
        r'\brefers? to\b',
        r'\bknown as\b',
        r'\bcalled\b',
        r'\bprovides?\b',
        r'\bensures?\b',
        r'\bperforms?\b',
        r'\bresponsible for\b',
        r'\bfunctions? (?:of|as|is)\b',
        r'\bpurpose (?:of|is)\b',
        r'\bprocess (?:of|by|in)\b',
        r'\bprotocol\b',
        r'\balgorithm\b',
        r'\btechnique\b',
        r'\bmethod\b',
        r'\bapproach\b',
        r'\barchitecture\b',
        r'\bmechanism\b',
        r'\bframework\b',
        r'\bconcept\b',
        r'\bprinciple\b',
    ]

    for sentence in sentences:
        s = sentence.strip()
        if len(s.split()) < 8:
            continue
        for pattern in concept_patterns:
            if re.search(pattern, s, re.IGNORECASE):
                definition_sentences.append(s)
                break

    # If no definition sentences found, use longer sentences
    if not definition_sentences:
        definition_sentences = [s.strip() for s in sentences if len(s.split()) >= 10]

    return definition_sentences


def generate_questions_from_chunk(context: str, num_questions: int = 3) -> List[Dict[str, str]]:
    """
    Generate general/conceptual questions from a text chunk using T5.

    Focuses on definition and explanation type questions rather than
    specific value-based questions.
    """
    model, tokenizer = load_model()

    questions = []
    used_questions = set()

    # Get definition-rich sentences for better highlighting
    good_sentences = _extract_definition_sentence(context)
    if not good_sentences:
        # Fallback: use all sentences with enough words
        good_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', context) if len(s.split()) >= 6]

    for sentence in good_sentences:
        if len(questions) >= num_questions:
            break

        # Create highlighted input
        highlighted_context = context.replace(
            sentence,
            f"<hl> {sentence} <hl>"
        )

        input_text = f"generate question: {highlighted_context}"

        input_ids = tokenizer.encode(
            input_text,
            return_tensors="pt",
            max_length=512,
            truncation=True
        )

        # Generate multiple candidates so we can filter
        outputs = model.generate(
            input_ids,
            max_length=72,
            num_beams=6,
            early_stopping=True,
            num_return_sequences=3,
            no_repeat_ngram_size=3,
        )

        for output in outputs:
            if len(questions) >= num_questions:
                break

            generated_question = tokenizer.decode(output, skip_special_tokens=True).strip()

            if not generated_question or generated_question in used_questions:
                continue

            if not generated_question.endswith("?"):
                generated_question += "?"

            # Filter: only keep general/conceptual questions
            if not is_good_question(generated_question):
                continue

            used_questions.add(generated_question)
            questions.append({
                "question": generated_question,
                "reference_answer": sentence.strip(),
                "context": context
            })

    # Fallback: generate from full context if not enough
    if len(questions) < num_questions:
        input_text = f"generate question: <hl> {context} <hl>"
        input_ids = tokenizer.encode(
            input_text,
            return_tensors="pt",
            max_length=512,
            truncation=True
        )

        outputs = model.generate(
            input_ids,
            max_length=72,
            num_beams=6,
            early_stopping=True,
            num_return_sequences=min(num_questions - len(questions) + 2, 5),
            no_repeat_ngram_size=3,
        )

        for output in outputs:
            if len(questions) >= num_questions:
                break
            generated_question = tokenizer.decode(output, skip_special_tokens=True).strip()
            if generated_question and generated_question not in used_questions:
                if not generated_question.endswith("?"):
                    generated_question += "?"
                if is_good_question(generated_question):
                    used_questions.add(generated_question)
                    questions.append({
                        "question": generated_question,
                        "reference_answer": context[:300].strip(),
                        "context": context
                    })

    return questions[:num_questions]


def generate_all_questions(chunks: List[str], questions_per_chunk: int = 3) -> List[Dict[str, str]]:
    """
    Generate questions from all text chunks.
    """
    all_questions = []

    for i, chunk in enumerate(chunks):
        print(f"📝 Generating questions from chunk {i+1}/{len(chunks)}...")
        try:
            questions = generate_questions_from_chunk(chunk, questions_per_chunk)
            all_questions.extend(questions)
        except Exception as e:
            print(f"⚠️  Error processing chunk {i+1}: {e}")
            continue

    print(f"✅ Generated {len(all_questions)} questions total")
    return all_questions
