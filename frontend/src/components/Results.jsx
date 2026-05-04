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

    // Heuristic for "Hesitation"
    insights.push({
      title: 'Logical Flow',
      desc: 'Your explanations show a structured way of thinking, even in complex topics.',
      type: 'success'
    });

    return insights;
  };

  const getSmartFeedback = () => {
    if (!results) return "";
    
    const total = results.results.length;
    const skipped = results.results.filter(r => getItemStatus(r) === 'skipped').length;
    const correct = results.results.filter(r => getItemStatus(r) === 'correct').length;
    const wrong = results.results.filter(r => getItemStatus(r) === 'wrong').length;
    
    if (isTerminated) {
      return "Your exam was terminated due to detection of unauthorized behavior during the session. Maintaining academic integrity is essential for a fair evaluation. Please ensure full compliance with the proctoring guidelines in all future attempts.";
    }
    
    if (skipped === total) {
      return "You did not attempt any questions during the session. This may indicate uncertainty or a lack of preparation. It is highly recommended to revise foundational concepts and attempt future sessions with more confidence.";
    }
    
    if (correct < total * 0.3) {
      return "You attempted the questions, but your responses indicate significant difficulty in understanding key technical concepts. We acknowledge your effort, but we suggest focusing on strengthening your fundamentals and practicing more application-based questions.";
    }
    
    return `You demonstrated a basic understanding of the subject by attempting ${total - skipped} questions. While you showed strength in some areas, ${skipped > 0 ? `${skipped} questions were skipped and ` : ""}${wrong} answers need more clarity. Improving conceptual precision will significantly enhance your performance.`;
  };

  const getConceptFeedback = (questionText, status) => {
    const text = questionText.toLowerCase();
    
    if (status === 'correct') {
      return "Excellent understanding! You accurately captured the technical nuances. This fundamental clarity is key for advanced model implementation.";
    }

    // ── 1. Production & Deployment ──
    if (text.includes('service') || text.includes('production') || text.includes('deployment') || text.includes('latency')) {
      return "Learning Tip: Transitioning from research to production requires focus on model quantization, batching strategy, and API latency. Consider horizontal scaling and caching for frequently seen queries.";
    }

    // ── 2. Specialized NLP Tasks ──
    if (text.includes('summarization')) {
      return "Learning Tip: Differentiate between Extractive (selecting sentences) and Abstractive (generating new text) summarization. Study how Seq2Seq models with Attention or Transformers (like T5) handle length constraints.";
    }
    if (text.includes('sentiment') || text.includes('classification')) {
      return "Learning Tip: For classification, consider the impact of class imbalance. Explore how pretrained encoders (BERT) can be fine-tuned with a simple classification head.";
    }
    if (text.includes('named entity') || text.includes('ner')) {
      return "Learning Tip: NER is a sequence labeling task. Study the IOB tagging format and how CRFs (Conditional Random Fields) help model the dependencies between adjacent tags.";
    }

    // ── 3. Core Architectures ──
    if (text.includes('transformer') || text.includes('attention') || text.includes('bert') || text.includes('gpt')) {
      return "Learning Tip: The core of modern NLP is the Multi-Head Self-Attention mechanism. Study the 'Scaled Dot-Product' and how positional encodings help the model understand token order without recurrence.";
    }
    if (text.includes('word embedding') || text.includes('word2vec') || text.includes('glove') || text.includes('vector')) {
      return "Learning Tip: Focus on how high-dimensional semantic relationships are captured in vector space. Revisit the skip-gram and CBOW architectures and how they utilize the distributional hypothesis.";
    }
    if (text.includes('rnn') || text.includes('lstm') || text.includes('gru')) {
      return "Learning Tip: While Transformers are dominant, LSTMs/GRUs are crucial for understanding the 'vanishing gradient' problem. Study how 'gates' allow the model to preserve long-term dependencies.";
    }

    // ── 4. Preprocessing & Linguistics ──
    if (text.includes('token') || text.includes('tokenize') || text.includes('subword')) {
      return "Learning Tip: Tokenization is the foundation. Study Byte-Pair Encoding (BPE) and WordPiece to understand how modern models handle OOV (Out-Of-Vocabulary) terms and balance vocabulary size.";
    }
    if (text.includes('ambiguity') || text.includes('pragmatic') || text.includes('semantic')) {
      return "Learning Tip: Language is deeply contextual. Revisit the hierarchy of linguistic analysis: Lexical, Syntactic, Semantic, and finally Pragmatic (context-driven) ambiguity.";
    }
    if (text.includes('pos tagging') || text.includes('parts of speech')) {
      return "Learning Tip: Review sequence labeling models. Hidden Markov Models (HMM) and Viterbi decoding are essential for understanding the transition and emission probabilities in POS tags.";
    }

    // ── 5. Optimization & Training ──
    if (text.includes('normalization') || text.includes('batchnorm') || text.includes('layernorm')) {
      return "Learning Tip: LayerNorm is preferred in NLP (over BatchNorm) because it normalizes across the feature dimension for each token, making it independent of batch size and sequence length.";
    }
    if (text.includes('loss') || text.includes('cross entropy') || text.includes('perplexity')) {
      return "Learning Tip: Understand Perplexity as the exponentiated cross-entropy loss. It measures how well the probability distribution predicts the sample.";
    }

    // ── 6. Generic/Foundational (Checked Last) ──
    if (text.includes('ai') || text.includes('machine learning') || text.includes('nlp')) {
      return "Learning Tip: Clarify the hierarchy: AI is the broad field, ML is the data-driven subset, and NLP is the specialization focused specifically on the complexities of human language processing.";
    }
    
    return "Learning Tip: Your answer was partially correct but lacked formal technical terminology. Focus on the mathematical definitions and the specific algorithmic steps for this topic.";
  };

  const handleDownload = () => {
    if (!results) return;
    const lines = [
      'VIVA LEARNING INSIGHTS REPORT',
      `Student: ${results.student_name}`,
      `Date: ${new Date().toLocaleDateString()}`,
      '',
      'AI QUALITATIVE FEEDBACK',
      getSmartFeedback(),
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
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

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
          <button onClick={handleDownload} className="text-xs font-bold px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-all border border-indigo-100">Export Report</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar">
        <div className="max-w-none px-6 w-full space-y-8">
          
          {/* AI Qualitative Feedback Banner */}
          <div className={`p-6 rounded-3xl border-2 shadow-sm ${isTerminated ? 'bg-rose-50 border-rose-200' : 'bg-indigo-50 border-indigo-100'}`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isTerminated ? 'bg-rose-100' : 'bg-indigo-100'}`}>
                {isTerminated ? '🚫' : '👩‍🏫'}
              </div>
              <div className="space-y-1">
                <h3 className={`font-bold text-lg ${isTerminated ? 'text-rose-800' : 'text-indigo-800'}`}>
                  {isTerminated ? 'Exam Termination Notice' : 'Instructor Feedback'}
                </h3>
                <p className={`text-sm font-medium leading-relaxed ${isTerminated ? 'text-rose-700' : 'text-indigo-700'}`}>
                  {getSmartFeedback()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* ── Attempt Review ── */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Attempt Review</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {results.results.filter(r => getItemStatus(r) !== 'skipped').map((item, i) => {
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
                                {getConceptFeedback(item.question_text, st)}
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

                {/* Skipped Summary */}
                {results.results.some(r => getItemStatus(r) === 'skipped') && (
                  <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                    <p className="text-sm font-bold text-slate-500 italic">
                      Note: Questions {results.results
                        .filter(r => getItemStatus(r) === 'skipped')
                        .map(r => `Q${r.question_number}`)
                        .join(', ')} were skipped during the session.
                    </p>
                  </div>
                )}
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



              <button 
                onClick={() => { onLogout(); navigate('/'); }}
                className="w-full py-4 text-xs font-black text-rose-500 hover:text-rose-600 transition-all"
              >
                FINISH SESSION & LOGOUT
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
