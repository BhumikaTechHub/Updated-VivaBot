"""
Speech recognition module using Vosk.
Provides server-side speech-to-text as a fallback to the browser's Web Speech API.
"""
import os
import json
import wave
import tempfile
from typing import Optional

# Vosk is optional - the system primarily uses Web Speech API in the browser
try:
    from vosk import Model, KaldiRecognizer
    VOSK_AVAILABLE = True
except ImportError:
    VOSK_AVAILABLE = False
    print("⚠️  Vosk not available. Using Web Speech API (browser-based) for STT.")

# Global model cache
_vosk_model = None

# Default Vosk model path 
VOSK_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "vosk-model")


def is_vosk_available() -> bool:
    """Check if Vosk is available and model is downloaded."""
    return VOSK_AVAILABLE and os.path.exists(VOSK_MODEL_PATH)


def load_vosk_model():
    """Load the Vosk speech recognition model."""
    global _vosk_model
    if not VOSK_AVAILABLE:
        raise RuntimeError("Vosk is not installed. Install with: pip install vosk")
    
    if _vosk_model is None:
        if not os.path.exists(VOSK_MODEL_PATH):
            raise FileNotFoundError(
                f"Vosk model not found at {VOSK_MODEL_PATH}. "
                "Download a model from https://alphacephei.com/vosk/models "
                "and extract it to the 'vosk-model' directory."
            )
        print(f"📥 Loading Vosk model from {VOSK_MODEL_PATH}...")
        _vosk_model = Model(VOSK_MODEL_PATH)
        print("✅ Vosk model loaded successfully")
    
    return _vosk_model


def transcribe_audio_file(audio_path: str) -> str:
    """
    Transcribe an audio file using Vosk.
    
    Supports WAV files (16kHz, mono, 16-bit).
    """
    model = load_vosk_model()
    
    wf = wave.open(audio_path, "rb")
    
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
        raise ValueError("Audio file must be WAV format: mono, 16-bit, 16kHz")
    
    recognizer = KaldiRecognizer(model, wf.getframerate())
    recognizer.SetWords(True)
    
    results = []
    
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if recognizer.AcceptWaveform(data):
            result = json.loads(recognizer.Result())
            if result.get("text"):
                results.append(result["text"])
    
    # Get final result
    final_result = json.loads(recognizer.FinalResult())
    if final_result.get("text"):
        results.append(final_result["text"])
    
    wf.close()
    
    return " ".join(results)


def transcribe_audio_bytes(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Transcribe audio bytes using Vosk.
    
    Pipeline:
    Audio Bytes → Vosk Recognizer → Text Output
    """
    model = load_vosk_model()
    
    # Save to temporary WAV file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name
        
        # Create WAV file
        wf = wave.open(tmp_path, "wb")
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_bytes)
        wf.close()
    
    try:
        result = transcribe_audio_file(tmp_path)
    finally:
        os.unlink(tmp_path)
    
    return result
