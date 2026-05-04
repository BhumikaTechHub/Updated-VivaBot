# question_generation.py
# FINAL DYNAMIC VERSION
# ---------------------------------------------
# Features:
# ✅ Extract existing questions from PDF
# ✅ MCQ options preserved
# ✅ Numbered / alphabet options supported
# ✅ Removes answers / explanations
# ✅ No overlapping questions
# ✅ No hardcoded broken-start filters
# ✅ Dynamic low-quality question filtering
# ✅ Removes duplicates
# ---------------------------------------------

import re
from typing import List, Dict


# =====================================================
# CLEAN RAW TEXT
# =====================================================

def clean_text(text: str) -> str:
    text = text.replace("\r", "\n")

    # remove urls / watermark
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'Steve Nouri', '', text, flags=re.IGNORECASE)

    # normalize spaces
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n+', '\n', text)

    return text.strip()


# =====================================================
# DYNAMIC QUESTION VALIDATION
# =====================================================

def is_valid_question(q: str) -> bool:

    q = q.strip()

    if not q:
        return False

    words = q.split()

    # too short
    if len(words) < 4:
        return False

    # too long without ?
    if len(words) > 25 and "?" not in q:
        return False

    # first word lowercase = likely broken
    if words[0][0].islower():
        return False

    valid_starters = {
        "what", "which", "why", "how", "when",
        "where", "who", "define", "describe",
        "explain", "compare", "list", "name",
        "is", "are", "can", "does", "do",
        "would", "should"
    }

    first = re.sub(r'[^a-zA-Z]', '', words[0]).lower()

    if first not in valid_starters and not words[0][0].isupper():
        return False

    # weak incomplete endings
    weak_last = {
        "the", "a", "an", "of", "to", "for",
        "with", "there", "this", "that",
        "these", "those", "one", "some",
        "many", "any"
    }

    last = re.sub(r'[^a-zA-Z]', '', words[-1]).lower()

    if last in weak_last and "?" not in q:
        return False

    # repeated adjacent words
    for i in range(len(words) - 1):
        if words[i].lower() == words[i + 1].lower():
            return False

    return True


# =====================================================
# EXTRACT QUESTIONS
# =====================================================

def extract_existing_questions(text: str) -> List[Dict[str, str]]:

    text = clean_text(text)

    # split using Q1 Q2 etc
    blocks = re.split(r'(?=Q\d+[\.\s])', text)

    questions = []

    for block in blocks:

        block = block.strip()

        if not re.match(r'^Q\d+', block):
            continue

        # remove question number
        body = re.sub(r'^Q\d+[\.\s]*', '', block).strip()

        # cut accidental next question merge
        body = re.split(r'Q\d+[\.\s]', body)[0].strip()

        # remove answer/solution section
        body = re.split(
            r'Answer\s*:|Solution\s*:|Answer :|Solution :',
            body,
            flags=re.IGNORECASE
        )[0].strip()

        # detect MCQ
        has_alpha = re.search(r'\na[\.\)]\s', body, re.IGNORECASE)
        has_num = re.search(r'\n1[\.\)]\s', body)

        # =================================================
        # MCQ SECTION
        # =================================================
        if has_alpha or has_num:

            # -------------------------
            # Alphabet options
            # -------------------------
            if has_alpha:

                start = has_alpha.start()
                q_text = body[:start].strip()
                option_text = body[start:].strip()

                # Clean option text to prevent truncation across line breaks
                option_text = option_text.replace('\n', ' ')
                option_text = re.sub(r'\s+', ' ', option_text)

                # Lookahead for the next option or end of string
                pattern = r'\b([a-eA-E])[\.\)]\s+(.*?)(?=\s+\b[a-eA-E][\.\)]\s+|$)'
                found = re.findall(pattern, option_text, flags=re.DOTALL)

                options = []
                for label, val in found:
                    val = val.strip()
                    if val:
                        options.append(f"{label.upper()}. {val}")

            # -------------------------
            # Numbered options
            # -------------------------
            else:

                start = has_num.start()
                q_text = body[:start].strip()
                option_text = body[start:].strip()

                # Clean option text to prevent truncation
                option_text = option_text.replace('\n', ' ')
                option_text = re.sub(r'\s+', ' ', option_text)

                pattern = r'\b(\d+)[\.\)]\s+(.*?)(?=\s+\b\d+[\.\)]\s+|$)'
                found = re.findall(pattern, option_text, flags=re.DOTALL)

                labels = ["A", "B", "C", "D", "E"]
                options = []
                for i, (_, val) in enumerate(found):
                    val = val.strip()
                    if i < len(labels) and val:
                        options.append(f"{labels[i]}. {val}")

            # Clean and format question text
            q_text = q_text.replace("\n", " ")
            q_text = re.sub(r'\s+', ' ', q_text).strip()

            if "?" not in q_text:
                q_text += "?"

            # VALIDATION: Ensure generated question contains complete options
            if len(options) >= 2 and is_valid_question(q_text):
                # Ensure options are not just single broken characters
                if all(len(opt) > 3 for opt in options):
                    # Enforce structured formatting
                    final_q = q_text + "\n\n" + "\n".join(options)

                    questions.append({
                        "question": final_q,
                        "reference_answer": "",
                        "context": final_q
                    })

        # =================================================
        # DESCRIPTIVE SECTION
        # =================================================
        else:

            lines = [x.strip() for x in body.split("\n") if x.strip()]

            if not lines:
                continue

            q = lines[0]

            # if question continues next line
            if "?" not in q:

                for nxt in lines[1:4]:

                    # stop if paragraph starts
                    if (
                        len(nxt.split()) > 8 or
                        re.match(r'^[●•\-\d]', nxt)
                    ):
                        break

                    q += " " + nxt

                    if "?" in q:
                        break

            if "?" in q:
                q = q.split("?")[0] + "?"

            else:
                q = re.split(r'[.:]', q)[0].strip()

            q = re.sub(r'\s+', ' ', q).strip()
            q = q.rstrip(" ,;:-")

            if is_valid_question(q):

                questions.append({
                    "question": q,
                    "reference_answer": "",
                    "context": q
                })

    # =====================================================
    # REMOVE DUPLICATES
    # =====================================================

    final = []
    seen = set()

    for item in questions:

        key = item["question"].lower().strip()

        if key not in seen:
            seen.add(key)
            final.append(item)

    return final


# =====================================================
# MAIN FUNCTION
# =====================================================

def generate_all_questions(chunks: List[str]) -> List[Dict[str, str]]:

    full_text = "\n".join(chunks)

    extracted = extract_existing_questions(full_text)

    print(f" Extracted {len(extracted)} clean questions")

    return extracted