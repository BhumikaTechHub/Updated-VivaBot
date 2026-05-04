import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { vivaAPI, adminAPI } from '../api';

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // System Check
  const [checkRunning, setCheckRunning] = useState(false);
  const [systemCheck, setSystemCheck] = useState({ camera: null, mic: null, internet: null });

  // Mic Test
  const [micTesting, setMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [micFeedback, setMicFeedback] = useState('');
  const micStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Rules Modal
  const [showRules, setShowRules] = useState(false);

  

  useEffect(() => {
    fetchStats();
    return () => stopMicTest();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch {
      setStats({ text_chunks: 0, questions: 0, system_ready: false });
    }
  };

  // ── System Check ───────────────────────────────────────────────
  const runSystemCheck = async () => {
    setCheckRunning(true);
    setSystemCheck({ camera: null, mic: null, internet: null });

    // Internet
    await delay(400);
    setSystemCheck(s => ({ ...s, internet: navigator.onLine ? 'ok' : 'fail' }));

    // Camera
    await delay(500);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setSystemCheck(s => ({ ...s, camera: 'ok' }));
    } catch {
      setSystemCheck(s => ({ ...s, camera: 'fail' }));
    }

    // Mic
    await delay(500);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setSystemCheck(s => ({ ...s, mic: 'ok' }));
    } catch {
      setSystemCheck(s => ({ ...s, mic: 'fail' }));
    }

    setCheckRunning(false);
  };

  const delay = ms => new Promise(r => setTimeout(r, ms));

  // ── Mic Test ───────────────────────────────────────────────────
  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      setMicTesting(true);
      setMicFeedback('');

      const loop = () => {
        analyser.getByteFrequencyData(data);
        const vol = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
        setMicVolume(vol);
        if (vol > 20) setMicFeedback('✅ Voice detected!');
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setMicFeedback('❌ Microphone access denied.');
    }
  };

  const stopMicTest = () => {
    cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setMicTesting(false);
    setMicVolume(0);
  };

  // ── Start Viva ─────────────────────────────────────────────────
  const handleStartViva = async () => {
    setShowRules(false);
    setLoading(true);
    setError('');
    stopMicTest();
    try {
      const response = await vivaAPI.startViva();
      navigate(`/viva/${response.data.session_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start viva session.');
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const StatusDot = ({ state }) => {
    if (state === null) return <span className="w-4 h-4 rounded-full bg-slate-200 inline-block" />;
    if (state === 'ok') return <span className="w-4 h-4 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]" />;
    return <span className="w-4 h-4 rounded-full bg-rose-500 inline-block" />;
  };

  const StatusLabel = ({ state }) => {
    if (state === null) return <span className="text-slate-400 text-sm">Checking…</span>;
    if (state === 'ok') return <span className="text-emerald-600 text-sm font-semibold">Detected</span>;
    return <span className="text-rose-500 text-sm font-semibold">Not Found</span>;
  };

  const allChecksPassed = systemCheck.camera === 'ok' && systemCheck.mic === 'ok' && systemCheck.internet === 'ok';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">

      {/* ── Header ── */}
      <header className="flex-none border-b border-slate-200 bg-white px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">AI Viva</h1>
            <p className="text-xs text-slate-500">Virtual Exam System</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Status Pill */}
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
            stats?.system_ready
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${stats?.system_ready ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
            {stats?.system_ready ? 'System Ready' : 'Exam Not Ready'}
          </span>

          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="text-xs text-slate-500">@{user.username}</p>
          </div>
          <button
            id="logout-btn"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 transition-all text-slate-500 border border-slate-200"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main Scrollable Body ── */}
      <main className="flex-1 overflow-y-auto px-8 py-8 no-scrollbar">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-1">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{user.full_name}</span>
          </h2>
          <p className="text-slate-500 font-medium">Complete your pre-exam checks before starting the viva.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT: Main Column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* System Check Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Pre-Exam System Check
                </h3>
                <button
                  onClick={runSystemCheck}
                  disabled={checkRunning}
                  className="text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  {checkRunning
                    ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Checking…</>
                    : 'Run System Check'
                  }
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Camera', icon: '📷', state: systemCheck.camera },
                  { label: 'Microphone', icon: '🎙️', state: systemCheck.mic },
                  { label: 'Internet', icon: '🌐', state: systemCheck.internet },
                ].map(item => (
                  <div key={item.label} className={`rounded-xl border p-4 flex flex-col items-center gap-2 transition-all ${
                    item.state === 'ok' ? 'bg-emerald-50 border-emerald-200' :
                    item.state === 'fail' ? 'bg-rose-50 border-rose-200' :
                    'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusDot state={item.state} />
                      <StatusLabel state={item.state} />
                    </div>
                  </div>
                ))}
              </div>

              {allChecksPassed && (
                <p className="mt-4 text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  All systems operational. You're ready to begin!
                </p>
              )}
            </div>

            {/* Mic Test Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                  Microphone Test
                </h3>
                <button
                  onClick={micTesting ? stopMicTest : startMicTest}
                  className={`text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-all ${
                    micTesting
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {micTesting ? 'Stop Test' : 'Test Microphone'}
                </button>
              </div>

              {/* Waveform / Volume Bar */}
              <div className="w-full h-10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative">
                <div
                  className="h-full rounded-xl transition-all duration-100"
                  style={{
                    width: `${Math.min(micVolume * 3, 100)}%`,
                    background: micVolume > 30 ? 'linear-gradient(90deg,#6366f1,#a855f7)' : '#e2e8f0'
                  }}
                />
                {!micTesting && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-medium">
                    Click "Test Microphone" and speak to see the waveform
                  </div>
                )}
              </div>

              {/* Animated bars when testing */}
              {micTesting && (
                <div className="flex items-end gap-1 h-8 mt-3">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-indigo-500 transition-all duration-75"
                      style={{ height: `${Math.max(10, Math.random() * micVolume * 2)}%` }}
                    />
                  ))}
                </div>
              )}

              {micFeedback && (
                <p className={`mt-3 text-sm font-semibold ${micFeedback.startsWith('✅') ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {micFeedback}
                </p>
              )}
            </div>

            {/* Start Viva Button */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
                {error}
              </div>
            )}

            <button
              id="start-viva-btn"
              onClick={() => setShowRules(true)}
              disabled={loading || (stats && !stats.system_ready)}
              className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
            >
              {loading ? (
                <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Starting…</>
              ) : (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"/></svg> Start Viva Examination</>
              )}
            </button>

            {stats && !stats.system_ready && (
              <p className="text-sm text-amber-600 font-medium text-center">
                ⚠️ Exam not ready yet. Please ask admin to upload a PDF and extract questions.
              </p>
            )}
          </div>

          {/* ── RIGHT: Side Column ── */}
          <div className="space-y-6">

            {/* Exam Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Exam Info</h3>
              <div className="space-y-4">
                {[
                  { label: 'Total Questions', value: '10', icon: '📝' },
                  { label: 'Duration', value: '~10 min', icon: '⏱️' },
                  { label: 'Mode', value: 'AI Evaluated', icon: '🤖' },
                  { label: 'Subject', value: 'NLP', icon: '📚' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <span>{item.icon}</span>{item.label}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>



            {/* Exam Rules Quick View */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3">Exam Rules</h3>
              <ul className="space-y-2 text-sm text-indigo-800 font-medium">
                <li className="flex items-center gap-2"><span>🪑</span> Sit alone in a quiet room</li>
                <li className="flex items-center gap-2"><span>📵</span> No phone allowed</li>
                <li className="flex items-center gap-2"><span>📷</span> Camera must stay on</li>
                <li className="flex items-center gap-2"><span>🗣️</span> Speak clearly into mic</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* ── Rules Modal ── */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-200 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">Before You Begin</h3>
                <p className="text-sm text-slate-500">Please read the exam rules carefully</p>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {[
                { icon: '🪑', rule: 'Sit alone in a quiet, distraction-free environment.' },
                { icon: '📵', rule: 'No mobile phones or external devices allowed.' },
                { icon: '📷', rule: 'Your camera must remain ON throughout the exam.' },
                { icon: '🗣️', rule: 'Speak clearly and at a steady pace into the microphone.' },
                { icon: '⏱️', rule: 'Answer each question within the given time.' },
                { icon: '🚫', rule: 'Do not open any other applications or tabs.' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 border border-slate-100">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  {item.rule}
                </li>
              ))}
            </ul>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRules(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                id="agree-start-btn"
                onClick={handleStartViva}
                className="flex-1 py-3 rounded-xl text-white font-bold shadow-md text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
              >
                I Agree & Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
