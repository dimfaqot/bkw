import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { Phone, Lock, Sun, Moon, Layers } from 'lucide-react';

import { API_BASE_URL } from '../config';

const Login = () => {
  const { theme, toggleTheme } = useTheme();
  const ui = useUI();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ wa: '', password: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.wa.trim()) {
      ui.notif('gagal', 'Nomor WhatsApp wajib diisi.');
      return;
    }
    if (!formData.password.trim()) {
      ui.notif('gagal', 'Kata sandi wajib diisi.');
      return;
    }

    ui.loading(true, 'fullscreen', 'Memverifikasi kredensial Anda...');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      ui.tutupLoading();

      if (!response.ok) {
        ui.notif('gagal', data.pesan || 'Login gagal. Cek kembali nomor WhatsApp dan kata sandi Anda.');
        return;
      }

      // Alur 1: Pengguna perlu membuat password baru (sandi sementara)
      if (data.status === 'perlu_buat_password') {
        sessionStorage.setItem('temp_token', data.token_sementara);
        await ui.notif('konfirmasi', 'Anda masuk menggunakan kata sandi sementara. Anda wajib membuat kata sandi baru demi keamanan.');
        navigate('/buat-password');
      } 
      // Alur 2: Login Sukses langsung masuk
      else if (data.status === 'sukses') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      ui.tutupLoading();
      ui.notif('gagal', 'Gagal menghubungkan ke server.');
    }
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-5">
      {/* Floating Theme Toggle */}
      <button 
        onClick={toggleTheme} 
        className="theme-toggle position-absolute top-0 end-0 m-3"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div className="row justify-content-center w-100 m-0">
        <div className="col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4 p-0">
          <div className="kartu-premium fade-in">
            <div className="text-center mb-4">
              <div className="d-inline-flex p-3 rounded-3 mb-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                <Layers size={36} style={{ color: 'var(--warna-utama)' }} />
              </div>
              <h2 className="fw-bold mb-1 teks-pelangi judul-halaman-bkw">BKW CONSOLE</h2>
              <p className="text-muted small">Masuk ke Sistem Modular POS & ERP</p>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Nomor WhatsApp</label>
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0 text-muted"><Phone size={18} /></span>
                  <input
                    type="text"
                    name="wa"
                    value={formData.wa}
                    onChange={handleChange}
                    className="form-control input-premium border-start-0 ps-2"
                    placeholder="Contoh: 081234567890"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">Kata Sandi</label>
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0 text-muted"><Lock size={18} /></span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="form-control input-premium border-start-0 ps-2"
                    placeholder="Masukkan kata sandi"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-100 tombol-premium py-2">
                Masuk Aplikasi
              </button>
            </form>

            <div className="text-center mt-4 small">
              <span className="text-muted">Belum terdaftar? </span>
              <Link to="/daftar" className="fw-semibold text-decoration-none" style={{ color: 'var(--warna-utama)' }}>
                Daftar sekarang
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
