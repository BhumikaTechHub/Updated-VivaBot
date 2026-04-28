import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('viva_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('viva_token');
      localStorage.removeItem('viva_user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (username, password) =>
    api.post('/login', { username, password }),
};

export const adminAPI = {
  // ---------------- EXISTING ----------------
  uploadPDF: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload_pdf', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  generateQuestions: () => api.post('/generate_questions'),
  getStats: () => api.get('/stats'),
  getQuestions: () => api.get('/questions'),


  getStudents: () => api.get('/admin/students'),

 
  getAlerts: () => api.get('/admin/alerts'),

  getDashboardStats: () => api.get('/admin/stats'),

  startExam: () => api.post('/admin/exam/start'),
  endExam: () => api.post('/admin/exam/end'),

  blockStudent: (studentId) =>
    api.post(`/admin/student/block/${studentId}`),

  generateReport: () => api.get('/admin/report'),
};

export const vivaAPI = {
  startViva: () => api.post('/start_viva'),
  getNextQuestion: (sessionId) =>
    api.get(`/get_next_question?session_id=${sessionId}`),
  submitAnswer: (sessionId, questionId, studentAnswer) =>
    api.post('/submit_answer', {
      session_id: sessionId,
      question_id: questionId,
      student_answer: studentAnswer,
    }),
  skipQuestion: (sessionId, questionId) =>
    api.post('/skip_question', {
      session_id: sessionId,
      question_id: questionId,
    }),
  getResults: (sessionId) => api.get(`/get_results/${sessionId}`),
};
export const proctorAPI = {
  sendFrame: (sessionId, imageData) =>
    api.post('/proctor/frame', {
      session_id: sessionId,
      image_data: imageData,
    }),
};

export default api;
