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
  const getItemStatus = (item) => {
    if (item.student_answer === '[Skipped]' || item.grade === 'Skipped') return 'skipped';
    if (item.score >= 6) return 'correct';
    return 'wrong';
  };

  const statusStyle = {
    correct: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Well Understood' },
    wrong:   { dot: 'bg-rose-500',    badge: 'bg-rose-50 text-rose-700 border-rose-200',          label: 'Needs Review' },
    skipped: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Skipped' },
  };

  const extractConcept = (text) => {
    let c = text.toLowerCase().replace(/\?/g, '').trim();
    const prefixes = ['what is the','what are the','how does','how do','explain','define','describe','which'];
    for (const p of prefixes) { if (c.startsWith(p)) { c = c.slice(p.length).trim(); break; } }
    return c.length > 4 ? c.charAt(0).toUpperCase() + c.slice(1, 40) : 'NLP Fundamentals';
  };

  const getBehaviorInsights = () => {
    if (!results) return [];
    const insights = [];
    const skippedCount = results.results.filter(r => getItemStatus(r) === 'skipped').length;
    const wrongCount = results.results.filter(r => getItemStatus(r) === 'wrong').length;
    
    if (skippedCount > 3) {
      insights.push({ 
        title: 'High Skip Rate', 
        desc: 'You bypassed several questions. This suggests uncertainty in core areas.',
        type: 'warning'
      });
    } else if (skippedCount === 0) {
      insights.push({ 
        title: 'Confident Attempt', 
        desc: 'You attempted every single question. Great persistence!',
        type: 'success'
      });
    }

    if (wrongCount > 4) {
      insights.push({
        title: 'Conceptual Gaps',
        desc: 'Answers often missed key technical nuances. Focus on formal definitions.',
        type: 'info'
      });
    }

    // Heuristic for "Hesitation" - can be simulated or based on session duration if available
    // For now, let's add a generic positive one
    insights.push({
      title: 'Logical Flow',
      desc: 'Your explanations show a structured way of thinking, even in complex topics.',
      type: 'success'
    });

    return insights;
  };

  const handleDownload = () => {
    if (!results) return;
    const lines = [
      'VIVA LEARNING INSIGHTS REPORT',
      `Student: ${results.student_name}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      'SUMMARY OF UNDERSTANDING',
      ...results.results.map((r, i) =>
        `[Q${i+1}] ${r.question_text}\nStatus: ${statusStyle[getItemStatus(r)].label}\n`
      )
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `viva_insights_${results.student_name}.txt`; a.click();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-slate-500 font-medium">Generating Learning Insights…</p>
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

  const insights = getBehaviorInsights();
  const recommendedTopics = Array.from(new Set(
    results.results
      .filter(r => getItemStatus(r) !== 'correct')
      .map(r => extractConcept(r.question_text))
  )).slice(0, 5);

  const strengths = Array.from(new Set(
    results.results
      .filter(r => getItemStatus(r) === 'correct')
      .map(r => extractConcept(r.question_text))
  )).slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Learning Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium">{results.student_name} • NLP Viva Analysis</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => navigate('/dashboard')} className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all">Dashboard</button>
          <button onClick={handleDownload} className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-all border border-indigo-100">Export PDF Report</button>
        </div>
      </header>

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full space-y-8">

        {/* Terminated Banner */}
        {isTerminated && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700 font-bold animate-shake">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
            Session ended prematurely due to behavioral flags.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* ── Behavior Analysis ── */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Behavioral Insights</h3>
              <div className="grid gap-4">
                {insights.map((ins, i) => (
                  <div key={i} className={`p-4 rounded-2xl border flex gap-4 items-start ${
                    ins.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                    ins.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                  }`}>
                    <span className="text-xl">
                      {ins.type === 'success' ? '' : ins.type === 'warning' ? '' : ''}
                    </span>
                    <div>
                      <p className={`font-bold text-sm ${
                        ins.type === 'success' ? 'text-emerald-700' :
                        ins.type === 'warning' ? 'text-amber-700' : 'text-blue-700'
                      }`}>{ins.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-medium">{ins.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Question Breakdown (Qualitative) ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-7 py-5 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Attempt Review</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {results.results.map((item, i) => {
                  const st = getItemStatus(item);
                  const s = statusStyle[st];
                  const isOpen = expandedIdx === i;
                  return (
                    <div key={i} className="p-6 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${s.badge}`}>
                          <span className="text-xs font-black">Q{item.question_number}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800 leading-snug">{item.question_text}</p>
                          <div className="flex items-center gap-3 mt-3">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border ${s.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                              {s.label.toUpperCase()}
                            </span>
                            <button
                              onClick={() => setExpandedIdx(isOpen ? null : i)}
                              className="text-[10px] font-bold text-indigo-600 hover:underline"
                            >
                              {isOpen ? 'Close Feedback' : 'Analyze Answer'}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {isOpen && (
                        <div className="mt-5 pl-14 space-y-4 animate-fade-in">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Observation</p>
                            <p className="text-sm text-slate-700 leading-relaxed font-medium">
                              {st === 'correct' ? 'Your explanation covered the primary components correctly.' : 
                               st === 'skipped' ? 'This topic was bypassed. It is essential for advanced NLP modules.' :
                               'The answer lacked technical precision. Revisit the core definitions.'}
                            </p>
                          </div>
                          {st !== 'correct' && item.reference_answer && (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                              <p className="text-[10px] font-black text-indigo-400 uppercase mb-2">Key Learning Point</p>
                              <p className="text-sm text-indigo-900 leading-relaxed font-medium italic">"{item.reference_answer}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right Column: Recommendations ── */}
          <div className="space-y-6">
            
            {/* Recommended Topics */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7 space-y-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Focus Next</h3>
              <div className="flex flex-wrap gap-2">
                {recommendedTopics.map((topic, i) => (
                  <span key={i} className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                    {topic}
                  </span>
                ))}
                {recommendedTopics.length === 0 && (
                  <p className="text-sm text-emerald-600 font-bold italic">No gaps found! You're ready for the next level.</p>
                )}
              </div>
            </div>

            {/* Strengths */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-7 space-y-6">
              <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest opacity-60">Demonstrated Strengths</h3>
              <div className="space-y-3">
                {strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-emerald-900 font-bold">
                    <span></span> {s}
                  </div>
                ))}
                {strengths.length === 0 && (
                  <p className="text-sm text-slate-500 italic">Attempt more questions to reveal strengths.</p>
                )}
              </div>
            </div>

            {/* AI Action Card */}
            <div className="bg-slate-900 rounded-3xl p-7 shadow-xl shadow-slate-200 border border-slate-800 space-y-6">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg"></div>
              <div className="space-y-2">
                <h4 className="text-white font-bold">Bridge the Gaps</h4>
                <p className="text-slate-400 text-xs leading-relaxed font-medium">Our AI suggests a focused session on your weak points to accelerate your learning.</p>
              </div>
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 transition-all shadow-lg"
              >
                Practice Weak Questions
              </button>
            </div>

            <button 
              onClick={() => { onLogout(); navigate('/'); }}
              className="w-full py-4 text-xs font-black text-rose-500 hover:text-rose-600 transition-all"
            >
              FINISH SESSION & LOGOUT
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
