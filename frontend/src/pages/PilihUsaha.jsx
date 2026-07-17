import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { Building, ArrowRight, Sun, Moon, LayoutGrid, LogOut } from 'lucide-react';

import { API_BASE_URL } from '../config';

const PilihUsaha = () => {
  const { theme, toggleTheme } = useTheme();
  const ui = useUI();
  const navigate = useNavigate();

  const [daftarUsaha, setDaftarUsaha] = useState([]);
  const [tempToken, setTempToken] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('temp_token') || localStorage.getItem('token');
    const rawUsaha = sessionStorage.getItem('daftar_usaha');

    if (!token || !rawUsaha) {
      ui.notif('gagal', 'Sesi tidak ditemukan. Silakan login kembali.');
      navigate('/login');
      return;
    }

    setTempToken(token);
    try {
      setDaftarUsaha(JSON.parse(rawUsaha));
    } catch (e) {
      ui.notif('gagal', 'Terjadi kesalahan saat membaca data usaha.');
      navigate('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePilih = async (item) => {
    ui.loading(true, 'fullscreen', 'Menghubungkan ke konteks usaha...');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/pilih-usaha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({
          usaha_id: item.usaha_id,
          unit_id: item.unit_id,
          role_id: item.role_id
        })
      });

      const data = await response.json();
      ui.tutupLoading();

      if (response.ok && data.status === 'sukses') {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Bersihkan data sementara di sessionStorage
        sessionStorage.removeItem('temp_token');
        sessionStorage.removeItem('daftar_usaha');

        ui.notif('sukses', `Berhasil masuk ke konteks: ${item.nama_usaha || 'Global'} (${item.nama_role})`);
        navigate('/dashboard');
      } else {
        ui.notif('gagal', data.pesan || 'Gagal mengubah konteks usaha.');
      }
    } catch (err) {
      ui.tutupLoading();
      ui.notif('gagal', 'Terjadi kesalahan koneksi ke server.');
    }
  };

  const handleKembali = () => {
    // Jika user sudah login sebelumnya dan memiliki token di localStorage, kembali ke dashboard
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    } else {
      sessionStorage.clear();
      navigate('/login');
    }
  };

  const getRoleBadgeStyle = (roleName) => {
    const name = roleName.toLowerCase();
    if (name === 'root' || name === 'owner') {
      return { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' };
    }
    if (name === 'supervisor' || name === 'admin') {
      return { backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.2)' };
    }
    if (name === 'kasir') {
      return { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' };
    }
    return { backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--warna-utama)', borderColor: 'rgba(99, 102, 241, 0.2)' };
  };

  return (
    <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center py-5" style={{ backgroundColor: 'var(--bg-halaman)' }}>
      {/* Theme Toggle */}
      <button 
        onClick={toggleTheme} 
        className="theme-toggle position-absolute top-0 end-0 m-3"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div className="row justify-content-center w-100 m-0">
        <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5 p-0">
          <div className="kartu-premium fade-in">
            <div className="text-center mb-4">
              <div className="d-inline-flex p-3 rounded-3 mb-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                <LayoutGrid size={36} style={{ color: 'var(--warna-utama)' }} />
              </div>
              <h2 className="fw-bold mb-1 teks-pelangi judul-halaman-bkw">PILIH KONTEKS USAHA</h2>
              <p className="text-muted small">Tentukan usaha dan peran Anda untuk melanjutkan</p>
            </div>

            <div className="d-flex flex-column gap-3 mb-4" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {daftarUsaha.map((item, index) => (
                <div 
                  key={index}
                  onClick={() => handlePilih(item)}
                  className="d-flex align-items-center justify-content-between p-3 rounded-3 border cursor-pointer transisi-lambat"
                  style={{ 
                    backgroundColor: 'var(--bg-halaman)', 
                    borderColor: 'var(--warna-border)',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--warna-utama)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--warna-border)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="d-flex p-2 rounded-2 bg-white text-dark shadow-sm">
                      <Building size={20} style={{ color: 'var(--warna-utama)' }} />
                    </div>
                    <div className="d-flex flex-column">
                      <span className="fw-bold" style={{ fontSize: '0.9rem' }}>
                        {item.nama_usaha || 'Kantor Pusat / Global'}
                      </span>
                      {item.nama_unit && (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Unit: {item.nama_unit}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span 
                      className="badge border text-capitalize px-2 py-1"
                      style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: '600',
                        ...getRoleBadgeStyle(item.nama_role)
                      }}
                    >
                      {item.nama_role}
                    </span>
                    <ArrowRight size={16} className="text-muted" />
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleKembali} 
              className="w-100 tombol-sekunder-premium py-2 d-flex align-items-center justify-content-center gap-2"
            >
              <LogOut size={16} />
              Kembali
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilihUsaha;
