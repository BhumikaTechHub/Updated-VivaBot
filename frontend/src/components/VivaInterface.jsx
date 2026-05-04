import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { vivaAPI, proctorAPI } from '../api';
import Avatar from './Avatar';
import { FaceMesh } from '@mediapipe/face_mesh';
import * as cam from '@mediapipe/camera_utils';

export default function VivaInterface({ user }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [question, setQuestion] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Secure exam mode
  const [secureViolations, setSecureViolations] = useState(0);
  const [secureWarning, setSecureWarning] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const MAX_SECURE_VIOLATIONS = 5;

  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [proctorWarnings, setProctorWarnings] = useState(0);
  const [proctorMessage, setProctorMessage] = useState('');
  const [minorMessage, setMinorMessage] = useState('');
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceMeshRef = useRef(null);
  const consecutiveOffScreenFrames = useRef(0);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = finalTranscriptRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + ' ';
            finalTranscriptRef.current = finalTranscript;
          } else {
            interimTranscript += transcriptPart;
          }
        }
        setTranscript(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Initialize webcam
  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to access webcam:', err);
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  // Initialize MediaPipe FaceMesh
  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults((results) => {
      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        consecutiveOffScreenFrames.current += 1;
        if (consecutiveOffScreenFrames.current > 15) { // ~1.5s at 10fps
          setMinorMessage('Please stay visible in front of the camera');
        }
        return;
      }

      const landmarks = results.multiFaceLandmarks[0];

      // Calculate head pose (simplified)
      // Landmarks: 1=nose, 33=left eye, 263=right eye, 61=left mouth, 291=right mouth
      const nose = landmarks[1];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];

      // Yaw (side looking)
      const eyeCenter = (leftEye.x + rightEye.x) / 2;
      const yaw = (nose.x - eyeCenter) * 100;

      // Pitch (looking up/down)
      const pitch = (nose.y - (leftEye.y + rightEye.y) / 2) * 100;

      if (Math.abs(yaw) > 12 || Math.abs(pitch) > 10) {
        consecutiveOffScreenFrames.current += 1;
        if (consecutiveOffScreenFrames.current > 20) {
          setMinorMessage('Please focus on the screen');
        }
      } else {
        consecutiveOffScreenFrames.current = 0;
      }
    });

    faceMeshRef.current = faceMesh;

    let camera = null;
    if (videoRef.current) {
      camera = new cam.Camera(videoRef.current, {
        onFrame: async () => {
          if (faceMeshRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => {
      if (camera) camera.stop();
    };
  }, []);

  // Ensure video stream is persistently attached to the video element whenever it renders
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  });

  // Proctoring polling (Continuous)
  useEffect(() => {
    let proctorTimer;
    let isMounted = true;

    const captureAndSendFrame = async () => {
      // Allow polling even during submitting/skipping, just need video & stream
      if (videoRef.current && streamRef.current && videoRef.current.videoWidth) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL('image/jpeg', 0.5); // compress a bit

          const res = await proctorAPI.sendFrame(sessionId, base64Image);

          if (!isMounted) return;

          setProctorWarnings(res.data.warnings);
          if (res.data.detected_objects && res.data.detected_objects.length > 0 && !res.data.terminate) {
            setProctorMessage(res.data.message);
            setTimeout(() => { if (isMounted) setProctorMessage(''); }, 5000); // hide after 5s
          }

          if (res.data.minor_message && !res.data.terminate) {
            setMinorMessage(res.data.minor_message);
            setTimeout(() => { if (isMounted) setMinorMessage(''); }, 4000); // hide after 4s
          }

          if (res.data.terminate) {
            navigate(`/results/${sessionId}?terminated=true`);
            return; // stop polling
          }
        } catch (err) {
          console.error('Proctoring error:', err);
        }
      }

      if (isMounted) {
        proctorTimer = setTimeout(captureAndSendFrame, 1000); // 1s frequency
      }
    };

    proctorTimer = setTimeout(captureAndSendFrame, 1000);

    return () => {
      isMounted = false;
      clearTimeout(proctorTimer);
    };
  }, [sessionId, navigate]);

  // ── Secure Exam Mode ──────────────────────────────────────────
  useEffect(() => {
    let violationCount = 0;

    const showViolation = (msg) => {
      violationCount += 1;
      setSecureViolations(violationCount);
      setSecureWarning(msg);
      setTimeout(() => setSecureWarning(''), 5000);
      if (violationCount >= MAX_SECURE_VIOLATIONS) {
        navigate(`/results/${sessionId}?terminated=true`);
      }
    };

    // Enter fullscreen
    const enterFullscreen = () => {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (req) req.call(el).catch(() => { });
    };
    enterFullscreen();

    // Fullscreen change
    const onFullscreenChange = () => {
      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(inFS);
      if (!inFS) {
        showViolation('⚠️ You exited fullscreen! Re-entering secure mode...');
        setTimeout(enterFullscreen, 800);
      }
    };

    // Tab / window visibility
    const onVisibilityChange = () => {
      if (document.hidden) {
        showViolation('⚠️ Tab switching is not allowed during the exam!');
      }
    };

    // Keyboard restrictions
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        showViolation('⚠️ Pressing Escape is not allowed during the exam!');
      }
      // Ctrl+Tab, Alt+Tab combos (partial; browser limits full interception)
      if ((e.altKey && e.key === 'Tab') || (e.ctrlKey && e.key === 'Tab')) {
        e.preventDefault();
        showViolation('⚠️ Switching windows is not allowed during the exam!');
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown);
      // Exit fullscreen on unmount
      if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
    };
  }, [sessionId, navigate]);

  // Handle TTS when question changes
  useEffect(() => {
    if (question && question.question_text) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(question.question_text);

      // Select voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
      if (englishVoices.length > 0) {
        const preferredVoice = englishVoices.find(v => v.name.includes('Google US English') || v.name.includes('Female')) || englishVoices[0];
        utterance.voice = preferredVoice;
      }

      utterance.rate = 0.95;

      utterance.onstart = () => setIsAvatarSpeaking(true);

      utterance.onend = () => {
        setIsAvatarSpeaking(false);
        // Automatically start listening
        if (recognitionRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current.start();
              setIsListening(true);
            } catch (e) {
              console.log('Recognition already started');
            }
          }, 300);
        }
      };

      utterance.onerror = () => setIsAvatarSpeaking(false);

      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 500);
    }
  }, [question]);

  // Fetch first question
  useEffect(() => {
    fetchNextQuestion();
  }, [sessionId]);

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await vivaAPI.getNextQuestion(sessionId);
      setQuestion(res.data);
      setTranscript('');
      finalTranscriptRef.current = '';
      setFeedback(null);
      setShowFeedback(false);
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('completed')) {
        navigate(`/results/${sessionId}`);
      } else {
        setError(err.response?.data?.detail || 'Failed to load question.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser. Please use Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      finalTranscriptRef.current = transcript;
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening, transcript]);

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      setError('Please provide an answer before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    window.speechSynthesis.cancel();
    setIsAvatarSpeaking(false);

    try {
      const res = await vivaAPI.submitAnswer(sessionId, question.question_id, transcript.trim());
      setFeedback(res.data);
      setShowFeedback(true);

      // Move to next question after delay
      setTimeout(() => {
        if (res.data.is_last) {
          navigate(`/results/${sessionId}`);
        } else {
          fetchNextQuestion();
        }
      }, 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError('');

    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    window.speechSynthesis.cancel();
    setIsAvatarSpeaking(false);

    try {
      const res = await vivaAPI.skipQuestion(sessionId, question.question_id);
      setFeedback(res.data);
      setShowFeedback(true);

      setTimeout(() => {
        if (res.data.is_last) {
          navigate(`/results/${sessionId}`);
        } else {
          fetchNextQuestion();
        }
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to skip question.');
    } finally {
      setSkipping(false);
    }
  };

  const progress = question ? (question.question_number / question.total_questions) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin" />
          <p className="text-surface-200/50">Loading question...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50">
      {/* Top Bar */}
      <header className="flex-none border-b border-slate-200/50 bg-white/50 backdrop-blur-lg">
        <div className="w-full px-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              </div>
              <span className="text-sm font-bold text-slate-900">{user.full_name}</span>
            </div>
            <div className="flex items-center gap-3">
              {question && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question</span>
                  <span className="text-lg font-extrabold text-primary-600">{question.question_number}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-sm font-semibold text-slate-500">{question.total_questions}</span>
                </div>
              )}
              {/* Secure Mode Badge */}
              <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${secureViolations === 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : secureViolations < MAX_SECURE_VIOLATIONS
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${secureViolations === 0 ? 'bg-emerald-500' : secureViolations < MAX_SECURE_VIOLATIONS ? 'bg-amber-500' : 'bg-rose-500'
                  }`} />
                {secureViolations === 0 ? 'Secure Mode Active' : `Violations: ${secureViolations}/${MAX_SECURE_VIOLATIONS}`}
              </span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-4 py-4 md:px-8 md:py-6 overflow-hidden min-h-0">
        {error && (
          <div className="mb-6 w-full flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            {error}
          </div>
        )}

        {/* Proctoring Warning Overlay */}
        {proctorMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in border-2 border-red-400">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex flex-col">
              <span className="font-bold text-lg">Proctoring Warning ({proctorWarnings}/3)</span>
              <span className="text-sm opacity-90">{proctorMessage}</span>
            </div>
          </div>
        )}

        {/* Behavioral Guidance Banner (Minor Issues) */}
        {minorMessage && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] bg-amber-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-slide-down border border-amber-400">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-sm tracking-wide">{minorMessage}</span>
          </div>
        )}

        {/* Secure Exam Violation Warning */}
        {secureWarning && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-full max-w-lg px-4">
            <div className="bg-rose-600 text-white px-5 py-3 rounded-xl shadow-2xl border border-rose-400 flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="flex-1">
                <p className="font-bold text-sm leading-tight">{secureWarning}</p>
                <p className="text-xs text-rose-200 mt-0.5">Violation {secureViolations}/{MAX_SECURE_VIOLATIONS} — Exam will terminate at {MAX_SECURE_VIOLATIONS}.</p>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Overlay */}
        {showFeedback && feedback && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="glass-card p-8 max-w-sm text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${feedback.grade === 'Skipped' ? 'bg-slate-200' : feedback.score >= 7 ? 'bg-accent-100 text-accent-600' : feedback.score >= 5 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                }`}>
                <span className="text-2xl font-bold">{feedback.grade === 'Skipped' ? '⏭' : feedback.score >= 7 ? '✓' : feedback.score >= 5 ? '~' : '✗'}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{feedback.grade === 'Skipped' ? 'Question Skipped' : 'Answer Recorded'}</h3>
              <p className="text-sm text-slate-600 mb-3">{feedback.feedback}</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold text-primary-600">{feedback.score}</span>
                <span className="text-slate-400 font-bold">/10</span>
              </div>
              <p className={`text-sm font-bold mt-2 ${feedback.score >= 7 ? 'text-accent-600' : feedback.score >= 5 ? 'text-amber-600' : 'text-red-600'
                }`}>
                {feedback.grade}
              </p>
              {!feedback.is_last && (
                <p className="text-xs font-medium text-slate-400 mt-4">Loading next question...</p>
              )}
            </div>
          </div>
        )}

        {/* Question Card */}
        {question && (
          <div className="flex-1 flex flex-col w-full min-h-0 animate-fade-in gap-3 md:gap-4">
            {/* TOP SECTION: Avatar and Webcam (60-70%) */}
            <div className="flex-[3] min-h-0 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <Avatar isSpeaking={isAvatarSpeaking} />

              <div className="flex flex-col items-center justify-center p-3 md:p-4 glass-card overflow-hidden h-full w-full">
                <div className="relative w-full h-full max-w-lg aspect-video rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                  />
                  {!streamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                      <span className="text-slate-400 text-sm font-medium">Initializing Camera...</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 flex-none">
                  <div className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
                  <span className="text-sm font-bold text-slate-700">Live Camera</span>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: Question & Answer (30-40%) */}
            <div className="flex-[2] flex flex-col min-h-0 gap-3 md:gap-4">
              {/* Question Text */}
              <div className="flex-none glass-card p-4 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-primary-600">
                    Question {question.question_number} of {question.total_questions}
                  </span>
                  {question.is_last && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold border border-amber-200">
                      Last Question
                    </span>
                  )}
                </div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 leading-snug line-clamp-2">
                  {question.question_text}
                </h2>
              </div>

              {/* Microphone & Transcription */}
              <div className="flex-1 min-h-0 glass-card p-3 md:p-4 flex gap-4 md:gap-6 items-center">
                {/* Mic Area */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <button
                    id="mic-btn"
                    onClick={toggleListening}
                    disabled={submitting}
                    className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all duration-300 ${isListening
                        ? 'bg-red-500 shadow-lg shadow-red-500/30 mic-pulse'
                        : 'bg-gradient-to-br from-primary-500 to-purple-600 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:scale-105'
                      }`}
                  >
                    <svg className="w-6 h-6 md:w-7 md:h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    </svg>
                  </button>
                  <p className="text-[10px] md:text-xs font-medium text-slate-500 mt-2">
                    {isListening ? (
                      <span className="text-red-500 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        Recording...
                      </span>
                    ) : (
                      'Click to answer'
                    )}
                  </p>
                </div>

                {/* Transcription Area */}
                <div className="flex-1 flex flex-col h-full min-h-0">
                  <label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1 flex-none">
                    {transcript ? 'Your Answer:' : 'Detected Answer:'}
                  </label>
                  <div className={`flex-1 overflow-y-auto p-3 rounded-xl border transition-all ${isListening
                      ? 'bg-red-50 border-red-300'
                      : 'bg-white/60 border-slate-200'
                    }`}>
                    {transcript ? (
                      <p className="text-slate-900 font-medium text-xs md:text-sm leading-relaxed">{transcript}</p>
                    ) : (
                      <p className="text-slate-400 italic font-medium text-xs md:text-sm">Your spoken answer will appear here...</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    id="submit-answer-btn"
                    onClick={handleSubmit}
                    disabled={submitting || skipping || !transcript.trim()}
                    className="btn-primary w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold"
                  >
                    {submitting ? 'Evaluating...' : 'Submit Answer'}
                  </button>

                  <button
                    id="skip-question-btn"
                    onClick={handleSkip}
                    disabled={submitting || skipping}
                    className="w-[140px] py-2.5 rounded-xl bg-white/80 border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-amber-300 hover:bg-amber-50 transition-all text-xs font-bold shadow-sm"
                  >
                    {skipping ? 'Skipping...' : 'Skip Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
