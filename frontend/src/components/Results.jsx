import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { vivaAPI } from '../api';

export default function Results({ user, onLogout }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isTerminated = new URLSearchParams(location.search).get('terminated') === 'true';

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => { fetchResults(); }, [sessionId]);

  const fetchResults = async () => {
    try {
      const res = await vivaAPI.getResults(sessionId);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load results.');
    } finally { setLoading(false); }
  };

  // ── Helpers ────────────────────────────────────────────
  const getGrade = (pct) => {
    if (pct >= 90) return { label: 'A+', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (pct >= 80) return { label: 'A',  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    if (pct >= 70) return { label: 'B',  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' };
    if (pct >= 60) return { label: 'C',  color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' };
    return           { label: 'D',  color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200' };
  };

  const getBadge = (pct) => {
    if (pct >= 85) return { label: ' Excellent Understanding', color: 'text-emerald-700', bg: 'bg-emerald-100 border-emerald-300' };
    if (pct >= 70) return { label: ' Good Understanding',     color: 'text-blue-700',    bg: 'bg-blue-100 border-blue-300' };
    if (pct >= 50) return { label: ' Average Performance',    color: 'text-amber-700',   bg: 'bg-amber-100 border-amber-300' };
    return           { label: ' Needs Improvement',          color: 'text-rose-700',    bg: 'bg-rose-100 border-rose-300' };
  };

  const getItemStatus = (item) => {
    if (item.student_answer === '[Skipped]' || item.grade === 'Skipped') return 'skipped';
    if (item.score >= 6) return 'correct';
    return 'wrong';
  };

  const statusStyle = {
    correct: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Correct' },
    wrong:   { dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Incorrect' },
    skipped: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Skipped' },
  };

  const extractConcept = (text) => {
    let c = text.toLowerCase().replace(/\?/g, '').trim();
    const prefixes = ['what is the','what are the','how does','how do','explain','define','describe','which'];
    for (const p of prefixes) { if (c.startsWith(p)) { c = c.slice(p.length).trim(); break; } }
    return c.length > 4 ? c.slice(0, 40) : 'NLP fundamentals';
  };

  const handleDownload = () => {
    if (!results) return;
    const lines = [
      'VIVA EXAMINATION REPORT',
      `Student: ${results.student_name}`,
      `Score: ${results.total_score} / ${results.max_score}  (${results.percentage}%)`,
      '',
      ...results.results.map((r, i) =>
        `Q${i+1}. ${r.question_text}\nAnswer: ${r.student_answer}\nScore: ${r.score}/10  Grade: ${r.grade}\n`
      )
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `viva_report_${results.student_name}.txt`; a.click();
  };

  // ── Loading / Error ────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Analysing your performance…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-sm text-center">
        <p className="text-rose-500 mb-4 font-medium">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm">Back to Dashboard</button>
      </div>
    </div>
  );

  const pct = results.percentage;
  const grade = getGrade(pct);
  const badge = getBadge(pct);
  const correct  = results.results.filter(r => getItemStatus(r) === 'correct').length;
  const wrong    = results.results.filter(r => getItemStatus(r) === 'wrong').length;
  const skipped  = results.results.filter(r => getItemStatus(r) === 'skipped').length;
  const strengths = results.results.filter(r => r.score >= 7).map(r => extractConcept(r.question_text)).slice(0, 3);
  const weaknesses = results.results.filter(r => r.score < 5 && r.score > 0).map(r => extractConcept(r.question_text)).slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Viva Results</h1>
            <p className="text-xs text-slate-500">{results.student_name}</p>
          </div>
        </div>

        {/* Score pill in header */}
        <div className="flex items-center gap-3">
          <span className={`text-sm font-extrabold px-3 py-1 rounded-full border ${grade.bg} ${grade.color} ${grade.border}`}>
            Grade {grade.label}
          </span>
          <span className="text-sm font-bold text-slate-700 hidden sm:block">{results.total_score}/{results.max_score} pts</span>
          <div className="flex gap-2">
            <button onClick={() => navigate('/dashboard')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all">Dashboard</button>
            <button onClick={() => { onLogout(); navigate('/'); }} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all">Logout</button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full space-y-6">

        {/* Terminated Banner */}
        {isTerminated && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center gap-3 text-rose-700 font-bold">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            Exam Terminated: Exceeded allowed proctoring violations.
          </div>
        )}

        {/* ── TOP: Performance Summary ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Score Ring Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center text-center col-span-1">
            <div className="relative w-28 h-28 mb-4">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="10"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={pct >= 70 ? '#6366f1' : pct >= 50 ? '#f59e0b' : '#f43f5e'}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${pct * 2.64} 264`}/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900">{pct}%</span>
                <span className={`text-xs font-bold ${grade.color}`}>{grade.label}</span>
              </div>
            </div>
            <p className="text-sm font-bold text-slate-700">{results.total_score} / {results.max_score} points</p>
            <span className={`mt-2 text-xs font-bold px-3 py-1 rounded-full border ${badge.bg} ${badge.color}`}>{badge.label}</span>
          </div>

          {/* Stats Grid */}
          <div className="col-span-2 grid grid-cols-3 gap-4">
            {[
              { label: 'Correct', val: correct,   color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Incorrect', val: wrong, color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200' },
              { label: 'Skipped', val: skipped,  color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5 flex flex-col items-center justify-center text-center`}>
                <span className="text-2xl mb-1">{s.icon}</span>
                <span className={`text-3xl font-extrabold ${s.color}`}>{s.val}</span>
                <span className="text-xs font-semibold text-slate-600 mt-1">{s.label}</span>
              </div>
            ))}

            {/* Mini Progress Bar */}
            <div className="col-span-3 bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                <span>Accuracy</span><span>{pct}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: pct >= 70 ? 'linear-gradient(90deg,#6366f1,#a855f7)' : pct >= 50 ? '#f59e0b' : '#f43f5e' }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress Timeline ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Question Timeline</h3>
          <div className="flex flex-wrap gap-2">
            {results.results.map((item, i) => {
              const st = getItemStatus(item);
              const s = statusStyle[st];
              return (
                <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${s.badge}`}>
                  <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
                  Q{item.question_number}
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3">
            {['correct','wrong','skipped'].map(k => (
              <span key={k} className="flex items-center gap-1 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${statusStyle[k].dot}`}></span>
                {statusStyle[k].label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Question Cards ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Question-by-Question Breakdown</h3>
            <span className="text-xs text-slate-400 font-medium">Click "View Feedback" to expand</span>
          </div>
          <div className="divide-y divide-slate-100">
            {results.results.map((item, i) => {
              const st = getItemStatus(item);
              const s = statusStyle[st];
              const isOpen = expandedIdx === i;
              return (
                <div key={i} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Number */}
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-extrabold text-indigo-600">Q{item.question_number}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 leading-relaxed line-clamp-2">{item.question_text}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
                        </span>
                        {st !== 'skipped' && (
                          <span className="text-xs font-bold text-slate-500">{item.score}/10 pts</span>
                        )}
                      </div>
                    </div>

                    {/* Score bar + button */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(item.score / 10) * 100}%`,
                          background: item.score >= 7 ? '#10b981' : item.score >= 5 ? '#f59e0b' : '#f43f5e'
                        }}/>
                      </div>
                      <button
                        onClick={() => setExpandedIdx(isOpen ? null : i)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-all"
                      >
                        {isOpen ? 'Hide' : 'View Feedback'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Feedback */}
                  {isOpen && (
                    <div className="mt-4 ml-13 pl-4 border-l-2 border-indigo-200 space-y-3 animate-fade-in">
                      {item.student_answer && item.student_answer !== '[Skipped]' && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Your Answer</p>
                          <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">{item.student_answer}</p>
                        </div>
                      )}
                      {item.reference_answer && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Reference Answer</p>
                          <p className="text-sm text-slate-700 bg-emerald-50 rounded-lg p-3 border border-emerald-100">{item.reference_answer}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">AI Feedback</p>
                        <p className="text-sm text-slate-700 bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                          {st === 'correct' ? `Great answer! You scored ${item.score}/10. Your response demonstrated solid understanding of this concept.`
                            : st === 'skipped' ? 'You skipped this question. Review the reference answer to understand the concept.'
                            : `Your answer scored ${item.score}/10. Compare your response with the reference answer and focus on the key points you missed.`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI Feedback Summary ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span className="text-lg"></span> AI Performance Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase mb-2"> Strength Areas</p>
              {strengths.length > 0
                ? strengths.map((s, i) => <p key={i} className="text-sm text-emerald-800 font-medium">• {s}</p>)
                : <p className="text-sm text-emerald-700 italic">Keep practising to build strengths!</p>}
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-xs font-bold text-rose-700 uppercase mb-2"> Weak Areas</p>
              {weaknesses.length > 0
                ? weaknesses.map((w, i) => <p key={i} className="text-sm text-rose-800 font-medium">• {w}</p>)
                : <p className="text-sm text-rose-700 italic">No major weak areas detected.</p>}
            </div>
            <div className="md:col-span-2 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-700 uppercase mb-2"> Suggestions for Improvement</p>
              <p className="text-sm text-indigo-800 font-medium">
                {pct >= 80 ? 'Excellent work! Review any skipped or incorrect questions to achieve a perfect score next time.'
                  : pct >= 60 ? 'Good effort. Focus on the weak areas highlighted above and revisit the reference answers for incorrect questions.'
                  : 'You need more practice. Go through each reference answer carefully, and focus especially on the topics you skipped or got wrong.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex flex-wrap gap-3 justify-center pb-8">
          <button id="retake-viva-btn" onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-md text-sm transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Retake Viva
          </button>
          <button onClick={handleDownload}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download Report
          </button>
          <button id="logout-result-btn" onClick={() => { onLogout(); navigate('/'); }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-100 transition-all shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}
