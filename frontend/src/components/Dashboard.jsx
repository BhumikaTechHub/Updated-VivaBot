import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { vivaAPI, adminAPI } from '../api';

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await adminAPI.getStats();
      setStats(res.data);
    } catch {
      // Stats endpoint might fail if no data yet
      setStats({ text_chunks: 0, questions: 0, system_ready: false });
    }
  };

  const handleStartViva = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vivaAPI.startViva();
      navigate(`/viva/${response.data.session_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start viva session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200/50 bg-white/50 backdrop-blur-lg">
        <div className="w-full px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
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
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">@{user.username}</p>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              className="p-2.5 rounded-xl bg-white/70 border border-slate-200/50 hover:bg-red-50 hover:border-red-200 transition-all group"
              title="Logout"
            >
              <svg className="w-4 h-4 text-slate-500 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-8 py-12 overflow-y-auto">
        {/* Welcome Section */}
        <div className="animate-fade-in mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">{user.full_name}</span>
          </h2>
          <p className="text-slate-600">Ready for your virtual viva examination?</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full pb-8">
          {/* Start Viva Card */}
          <div className="lg:col-span-2 glass-card glass-card-hover p-10 animate-fade-in-delay flex flex-col justify-center">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shrink-0 shadow-lg shadow-accent-500/20">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Start Viva Examination</h3>
                <p className="text-base text-slate-600">
                  Begin your AI-powered oral examination. You will be asked 10 questions and evaluated in real-time using semantic analysis.
                </p>
              </div>
            </div>

            <div className="space-y-5 mb-10">
              <div className="flex items-center gap-4 text-base text-slate-700">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center border border-primary-100">
                  <span className="text-primary-600 font-bold text-sm">10</span>
                </div>
                <span className="font-medium">Questions per session</span>
              </div>
              <div className="flex items-center gap-4 text-base text-slate-700">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center border border-primary-100">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span className="font-medium">Voice-based answers with real-time transcription</span>
              </div>
              <div className="flex items-center gap-4 text-base text-slate-700">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center border border-primary-100">
                  <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="font-medium">AI-powered semantic answer evaluation</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            )}

            <button
              id="start-viva-btn"
              onClick={handleStartViva}
              disabled={loading || (stats && !stats.system_ready)}
              className="btn-accent text-lg px-8 py-4 flex items-center gap-3"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Preparing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Start Viva
                </>
              )}
            </button>

            {stats && !stats.system_ready && (
              <p className="mt-4 text-sm text-amber-600 font-medium">
                ⚠️ System needs at least 10 questions. Please ask admin to upload a PDF and generate questions.
              </p>
            )}
          </div>

          {/* Stats Card */}
          <div className="space-y-8 animate-fade-in-delay-2 flex flex-col">
            <div className="glass-card p-8 flex-1">
              <h4 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest">System Status</h4>
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <span className="text-base font-medium text-slate-600">Questions Available</span>
                  <span className="text-xl font-bold text-primary-600">{stats?.questions ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <span className="text-base font-medium text-slate-600">Text Chunks</span>
                  <span className="text-xl font-bold text-purple-600">{stats?.text_chunks ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-base font-medium text-slate-600">Status</span>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                    stats?.system_ready
                      ? 'bg-accent-50 text-accent-600 border border-accent-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}>
                    {stats?.system_ready ? '● Ready' : '○ Setup Needed'}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 flex-1">
              <h4 className="text-xs font-bold text-slate-500 mb-6 uppercase tracking-widest">How It Works</h4>
              <div className="space-y-4">
                {[
                  { step: '1', text: 'Start the viva session' },
                  { step: '2', text: 'Read the question displayed' },
                  { step: '3', text: 'Click mic and speak your answer' },
                  { step: '4', text: 'Submit and move to next' },
                  { step: '5', text: 'View your final results' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-7 h-7 rounded-full bg-primary-50 flex items-center justify-center shrink-0 mt-0.5 border border-primary-100">
                      <span className="text-xs font-bold text-primary-600">{item.step}</span>
                    </div>
                    <p className="text-base font-medium text-slate-700">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
