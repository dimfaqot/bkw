import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { Lock, AlertCircle, Sun, Moon, Layers } from 'lucide-react';

import { API_BASE_URL } from '../config';

const BuatPassword = () => {
  const { theme, toggleTheme } = useTheme();
  const ui = useUI();
  const navigate = useNavigate();
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('temp_token');
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (passwordBaru.length < 6) {
      ui.notif('gagal', 'Sandi baru minimal berisi 6 karakter.');
      return;
    }

    if (passwordBaru !== konfirmasiPassword) {
      ui.notif('gagal', 'Konfirmasi sandi tidak cocok.');
      return;
    }

    ui.loading(true, 'fullscreen', 'Menyimpan password baru Anda...');
    const token = sessionStorage.getItem('temp_token');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/buat-password`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password_baru: passwordBaru }),
      });
      const data = await response.json();

      ui.tutupLoading();

      if (response.ok && data.status === 'sukses') {
        await ui.notif('sukses', 'Password berhasil dibuat! Silakan masuk kembali dengan password baru Anda.');
        sessionStorage.removeItem('temp_token');
        navigate('/login');
      } else {
        ui.notif('gagal', data.pesan || 'Gagal mengubah password.');
      }
    } catch (err) {
      ui.tutupLoading();
      ui.notif('gagal', 'Gagal menghubungkan ke server.');
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center py-5">
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
              <p className="text-muted small">Pengaturan Kata Sandi Baru Anda</p>
            </div>

            <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-3">
              <AlertCircle size={18} />
              <span>Sandi sementara Anda (4 digit terakhir No WA) tidak berlaku lagi setelah ini.</span>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Kata Sandi Baru</label>
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0 text-muted"><Lock size={18} /></span>
                  <input
                    type="password"
                    value={passwordBaru}
                    onChange={(e) => setPasswordBaru(e.target.value)}
                    className="form-control input-premium border-start-0 ps-2"
                    placeholder="Minimal 6 karakter"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">Ulangi Kata Sandi Baru</label>
                <div className="input-group">
                  <span className="input-group-text bg-transparent border-end-0 text-muted"><Lock size={18} /></span>
                  <input
                    type="password"
                    value={konfirmasiPassword}
                    onChange={(e) => setKonfirmasiPassword(e.target.value)}
                    className="form-control input-premium border-start-0 ps-2"
                    placeholder="Masukkan ulang kata sandi"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-100 tombol-premium py-2">
                Simpan Password
              </button>
            </form>

            <button 
              onClick={() => navigate('/login')} 
              className="w-100 tombol-sekunder-premium py-2 mt-3"
            >
              Batalkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuatPassword;
