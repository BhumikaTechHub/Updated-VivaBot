import { useState, useEffect, useRef } from 'react';
import { adminAPI } from '../api';

export default function AdminPanel() {
  // Existing state for API functionality
  const [stats, setStats] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [genResult, setGenResult] = useState(null);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const fileRef = useRef(null);


  // Mock states for the new Dashboard features
  const [examRunning, setExamRunning] = useState(false);
  const [alertFilter, setAlertFilter] = useState('All');

  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const fetchStats = async () => {
  try {
    const res = await adminAPI.getStats();
    setStats(res.data);
  } catch (err) {
    console.error("Stats fetch failed");
    setStats({});
  }
};

  useEffect(() => {

    fetchStats();
    fetchQuestions();

    const fetchLiveData = async () => {
      try {
        const [studentsRes, alertsRes] = await Promise.all([
          adminAPI.getStudents(),
          adminAPI.getAlerts()
        ]);

        setStudents(studentsRes.data || []);
        setAlerts(alertsRes.data || []);

      } catch (err) {
        console.error("Live fetch error", err);
      }
    };

    fetchLiveData();

    const interval = setInterval(fetchLiveData, 2000); // every 2 sec

    return () => clearInterval(interval);

  }, []);

  const fetchQuestions = async () => {
    try {
      const res = await adminAPI.getQuestions();
      setQuestions(res.data || []);
    } catch {
      setQuestions([]);
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Please select a PDF file.'); return; }
    if (!file.name.endsWith('.pdf')) { setError('Only PDF files are accepted.'); return; }
    setUploading(true); setError(''); setUploadResult(null);
    try {
      const res = await adminAPI.uploadPDF(file);
      setUploadResult(res.data);
      fetchStats();
    } catch (err) { setError(err.response?.data?.detail || 'Upload failed.'); }
    finally { setUploading(false); }
  };

  const handleGenerate = async () => {
    setGenerating(true); setError(''); setGenResult(null);
    try {
      const res = await adminAPI.generateQuestions();
      setGenResult(res.data);
      fetchStats();
      fetchQuestions();
    } catch (err) { setError(err.response?.data?.detail || 'Generation failed.'); }
    finally { setGenerating(false); }
  };

  const toggleExam = async () => {
    try {
      if (examRunning) {
        await adminAPI.endExam();
      } else {
        await adminAPI.startExam();
      }
      setExamRunning(!examRunning);
    } catch (err) {
      console.error("Exam toggle failed");
    }
  };

  const filteredAlerts = alerts.filter(a => alertFilter === 'All' || a.type.includes(alertFilter));

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Proctor Admin Dashboard</h1>
            <p className="text-xs text-slate-500 font-medium">System Control & Live Monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleExam}
            className={`px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${examRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
          >
            {examRunning ? (
              <><span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> End Exam</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Start Exam</>
            )}
          </button>
          <a href="/" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Logout</a>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* TOP: Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Students</p>
              <h3 className="text-2xl font-black text-slate-800">{students.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Active in Exam</p>
              <h3 className="text-2xl font-black text-emerald-600">{students.filter(s => s.status === 'In Exam').length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Alerts</p>
              <h3 className="text-2xl font-black text-rose-600">{alerts.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">System Status</p>
              <h3 className={`text-xl font-black ${examRunning ? 'text-indigo-600' : 'text-slate-400'}`}>
                {examRunning ? 'Running Live' : 'Stopped'}
              </h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${examRunning ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-100 text-slate-400'}`}>
              <svg className={`w-6 h-6 ${examRunning ? 'animate-spin-slow' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
        </div>

        {/* MIDDLE: Live Feed + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
          {/* Live Video Feed */}
          <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
              <h3 className="text-white font-bold flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${examRunning ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></span>
                Live Student Monitoring
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">CAMERAS: {students.filter(s => s.status === 'In Exam').length} ACTIVE</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {students.filter(s => s.status === 'In Exam').map(student => (
                  <div key={student.id} className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${student.suspicious ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-slate-700'}`}>
                    {/* Placeholder for video feed */}
                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                      <svg className={`w-12 h-12 ${student.suspicious ? 'text-slate-600' : 'text-slate-700'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    {/* Overlay info */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-bold truncate">{student.name}</span>
                        {student.suspicious && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse">WARNING</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!examRunning && (
                  <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <svg className="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <p className="text-sm font-medium text-slate-400">Video feeds will appear here when exam starts</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cheating Alerts Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                Real-time Alerts
              </h3>
              <select
                className="text-xs border-slate-200 rounded p-1 text-slate-600 bg-white"
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
              >
                <option value="All">All Types</option>
                <option value="Mobile">Mobile</option>
                <option value="Looks away">Looking away</option>
                <option value="Multiple">Multiple persons</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredAlerts.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-10 font-medium">No alerts recorded.</div>
              ) : (
                filteredAlerts.map((alert, idx) => (
                  <div key={idx} className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-sm animate-fade-in flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-rose-700">{alert.student}</span>
                      <span className="text-[10px] font-mono text-rose-400 font-bold bg-white px-1.5 py-0.5 rounded border border-rose-100">{alert.time}</span>
                    </div>
                    <span className="text-rose-600 font-medium">{alert.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM: Management Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* PDF & Question Management */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                PDF Knowledge Base
              </h3>

              {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">{error}</div>}

              <div className="flex flex-col sm:flex-row gap-3">
                <input ref={fileRef} type="file" accept=".pdf" className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg" />
                <button onClick={handleUpload} disabled={uploading} className="btn-primary whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-lg shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {uploading ? 'Uploading...' : 'Upload PDF'}
                </button>
              </div>

              {uploadResult && <p className="mt-3 text-xs font-semibold text-emerald-600">{uploadResult.message}</p>}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-700">Extracted Questions ({stats?.questions || 0})</h4>
                  <button onClick={handleGenerate} disabled={generating || (stats && stats.text_chunks === 0)} className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                    {generating ? 'Extracting...' : 'Extract Questions'}
                  </button>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="max-h-[250px] overflow-y-auto p-2">
                    {questions.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6 font-medium">No questions extracted yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {questions.slice(0, 10).map((q, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border border-slate-200 text-sm group">
                            <div className="flex justify-between items-start gap-2">
                              <p className="font-medium text-slate-700 line-clamp-2">{q.question}</p>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="text-slate-400 hover:text-indigo-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                <button className="text-slate-400 hover:text-rose-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Student Management & Reports */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  Student Management
                </h3>
                <button className="text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors shadow-sm">
                  Generate Report
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                    <tr>
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Violations</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{student.name}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                            ${student.status === 'In Exam' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                              student.status === 'Online' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${student.violations > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {student.violations}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-slate-400 hover:text-rose-600 transition-colors font-medium text-xs border border-transparent hover:border-rose-200 hover:bg-rose-50 px-2 py-1 rounded">Block</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
