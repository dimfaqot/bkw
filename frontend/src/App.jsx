import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Daftar from './pages/Daftar.jsx';
import Login from './pages/Login.jsx';
import BuatPassword from './pages/BuatPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PilihUsaha from './pages/PilihUsaha.jsx';
import NotaPublik from './pages/NotaPublik.jsx';

// Guard: Hanya untuk user yang BELUM login (Guest)
const GuestRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Guard: Hanya untuk user yang SUDAH login
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/daftar" element={<GuestRoute><Daftar /></GuestRoute>} />
        <Route path="/buat-password" element={<GuestRoute><BuatPassword /></GuestRoute>} />
        <Route path="/pilih-usaha" element={<ProtectedRoute><PilihUsaha /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/nota/:id" element={<NotaPublik />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
