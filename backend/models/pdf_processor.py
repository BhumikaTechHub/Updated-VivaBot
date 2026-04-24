"""
PDF text extraction and chunking module.
Uses PyMuPDF (fitz) for PDF processing.
"""
import fitz  # PyMuPDF
import re
import os
from typing import List, Dict
from config import CHUNK_MIN_WORDS, CHUNK_MAX_WORDS


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file using PyMuPDF."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found: {pdf_path}")

    doc = fitz.open(pdf_path)
    full_text = ""

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        full_text += text + "\n"

    doc.close()
    return full_text


def clean_text(text: str) -> str:
    """Clean extracted text by removing extra whitespace and special characters."""
    # Remove excessive newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Remove excessive spaces
    text = re.sub(r' {2,}', ' ', text)
    # Remove page numbers (common patterns)
    text = re.sub(r'\n\d+\n', '\n', text)
    # Remove header/footer artifacts
    text = re.sub(r'(?m)^[\s]*Page \d+[\s]*$', '', text)
    # Clean up
    text = text.strip()
    return text


def chunk_text(text: str, min_words: int = CHUNK_MIN_WORDS, max_words: int = CHUNK_MAX_WORDS) -> List[str]:
    """
    Split text into chunks of min_words to max_words.
    Tries to split on paragraph boundaries for coherent chunks.
    """
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""
    current_word_count = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_words = len(para.split())

        # If adding this paragraph exceeds max_words and we have enough
        if current_word_count + para_words > max_words and current_word_count >= min_words:
            chunks.append(current_chunk.strip())
            current_chunk = para
            current_word_count = para_words
        else:
            current_chunk += " " + para if current_chunk else para
            current_word_count += para_words

    # Add the last chunk if it has enough content
    if current_chunk.strip() and current_word_count >= min_words // 2:
        chunks.append(current_chunk.strip())

    # If no chunks were created from paragraph splitting, do word-based splitting
    if not chunks:
        words = text.split()
        for i in range(0, len(words), max_words):
            chunk = " ".join(words[i:i + max_words])
            if len(chunk.split()) >= min_words // 2:
                chunks.append(chunk)

    return chunks


def process_pdf(pdf_path: str) -> Dict:
    """
    Complete PDF processing pipeline:
    PDF → Text Extraction → Text Cleaning → Chunking
    """
    # Extract text
    raw_text = extract_text_from_pdf(pdf_path)

    # Clean text
    cleaned_text = clean_text(raw_text)

    # Chunk text
    chunks = chunk_text(cleaned_text)

    return {
        "raw_text_length": len(raw_text),
        "cleaned_text_length": len(cleaned_text),
        "num_chunks": len(chunks),
        "chunks": chunks
    }
