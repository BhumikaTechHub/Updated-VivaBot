import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import VivaInterface from './components/VivaInterface';
import Results from './components/Results';
import AdminPanel from './components/AdminPanel';

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('viva_user');
    return stored ? JSON.parse(stored) : null;
  });

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('viva_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('viva_token');
    localStorage.removeItem('viva_user');
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/viva/:sessionId"
          element={
            user ? (
              <VivaInterface user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            user ? (
              <Results user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={<AdminPanel />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
//  py -3.13 -m uvicorn main:app --reload