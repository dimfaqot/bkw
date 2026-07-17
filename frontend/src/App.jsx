import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Daftar from './pages/Daftar.jsx';
import Login from './pages/Login.jsx';
import BuatPassword from './pages/BuatPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PilihUsaha from './pages/PilihUsaha.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/daftar" element={<Daftar />} />
        <Route path="/buat-password" element={<BuatPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pilih-usaha" element={<PilihUsaha />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
