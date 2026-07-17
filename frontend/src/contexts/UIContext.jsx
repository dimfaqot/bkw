import React, { createContext, useContext, useState, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Info } from 'lucide-react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // Notification State
  const [notif, setNotif] = useState({
    show: false,
    tipe: 'sukses', // 'sukses', 'gagal', 'konfirmasi'
    pesan: '',
  });
  const notifResolveRef = useRef(null);
  const notifTimerRef = useRef(null);

  // Loading State
  const [loading, setLoading] = useState({
    show: false,
    tipe: 'fullscreen', // 'fullscreen', 'lazy'
    pesan: '',
  });

  // Modal State
  const [modal, setModal] = useState({
    show: false,
    title: '',
    content: null,
    onSave: null,
    saveLabel: 'Simpan',
  });

  // 1. Notification Function (Returns Promise for confirm)
  const tampilkanNotif = (tipe, pesan) => {
    if (notifTimerRef.current) {
      clearTimeout(notifTimerRef.current);
    }
    return new Promise((resolve) => {
      setNotif({
        show: true,
        tipe,
        pesan,
      });
      notifResolveRef.current = resolve;

      if (tipe !== 'konfirmasi') {
        notifTimerRef.current = setTimeout(() => {
          tutupNotif(true);
        }, 4000);
      }
    });
  };

  const tutupNotif = (hasil = false) => {
    if (notifTimerRef.current) {
      clearTimeout(notifTimerRef.current);
      notifTimerRef.current = null;
    }
    setNotif((prev) => ({ ...prev, show: false }));
    if (notifResolveRef.current) {
      notifResolveRef.current(hasil);
      notifResolveRef.current = null;
    }
  };

  // 2. Loading Function
  const tampilkanLoading = (show = true, tipe = 'fullscreen', pesan = 'Memproses...') => {
    setLoading({
      show,
      tipe,
      pesan,
    });
  };

  const tutupLoading = () => {
    setLoading((prev) => ({ ...prev, show: false }));
  };

  // 3. Modal Function
  const tampilkanModal = (title, content, onSave = null, saveLabel = 'Simpan') => {
    setModal({
      show: true,
      title,
      content,
      onSave,
      saveLabel,
    });
  };

  const tutupModal = () => {
    setModal((prev) => ({ ...prev, show: false }));
  };

  return (
    <UIContext.Provider
      value={{
        notif: tampilkanNotif,
        loading: tampilkanLoading,
        tutupLoading,
        modal: tampilkanModal,
        tutupModal,
      }}
    >
      {children}

      {/* ================= NOTIFICATION OVERLAYS ================= */}
      {notif.show && (
        <div
          className="position-fixed bottom-0 start-50 translate-middle-x mb-4"
          style={{
            zIndex: 9999,
            width: '90%',
            maxWidth: '450px',
            animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div
            className="d-flex align-items-center p-3"
            style={{
              borderRadius: '16px',
              backgroundColor: localStorage.getItem('theme') === 'dark' ? 'rgba(22, 31, 48, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--warna-border)',
              borderLeft: `5px solid ${notif.tipe === 'sukses' ? 'var(--warna-sukses)' :
                notif.tipe === 'gagal' ? 'var(--warna-bahaya)' :
                  notif.tipe === 'konfirmasi' ? 'var(--warna-peringatan)' :
                    'var(--warna-utama)'
                }`,
              color: 'var(--warna-teks-utama)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Left Circular Icon Container */}
            <div
              className="d-flex align-items-center justify-content-center rounded-circle me-3"
              style={{
                width: '48px',
                height: '48px',
                minWidth: '48px',
                backgroundColor:
                  notif.tipe === 'sukses' ? 'rgba(16, 185, 129, 0.15)' :
                    notif.tipe === 'gagal' ? 'rgba(239, 68, 68, 0.15)' :
                      notif.tipe === 'konfirmasi' ? 'rgba(245, 158, 11, 0.15)' :
                        'rgba(99, 102, 241, 0.15)',
                color:
                  notif.tipe === 'sukses' ? 'var(--warna-sukses)' :
                    notif.tipe === 'gagal' ? 'var(--warna-bahaya)' :
                      notif.tipe === 'konfirmasi' ? 'var(--warna-peringatan)' :
                        'var(--warna-utama)'
              }}
            >
              {notif.tipe === 'sukses' && <CheckCircle size={24} />}
              {notif.tipe === 'gagal' && <XCircle size={24} />}
              {notif.tipe === 'konfirmasi' && <AlertTriangle size={24} />}
              {notif.tipe === 'info' && <Info size={24} />}
            </div>

            {/* Right Text Content */}
            <div className="flex-grow-1">
              <div className="d-flex align-items-center justify-content-between">
                <span className="fw-bold text-capitalize" style={{ letterSpacing: '0.2px', fontSize: '0.7rem' }}>
                  {notif.tipe === 'sukses' && 'Sukses'}
                  {notif.tipe === 'gagal' && 'Gagal'}
                  {notif.tipe === 'konfirmasi' && 'Konfirmasi'}
                  {notif.tipe === 'info' && 'Petunjuk'}
                </span>
              </div>
              <div style={{ color: 'var(--warna-teks-redup)', fontSize: '0.6rem', lineHeight: '1.35' }} className="mt-1">
                {notif.pesan}
              </div>

              {notif.tipe === 'konfirmasi' && (
                <div className="d-flex gap-2 justify-content-end mt-2">
                  <button onClick={() => tutupNotif(false)} className="btn-notif-kecil-sekunder">
                    Batal
                  </button>
                  <button onClick={() => tutupNotif(true)} className="btn-notif-kecil">
                    Ya, Lanjutkan
                  </button>
                </div>
              )}
            </div>

            {/* Close button for non-confirm */}
            {notif.tipe !== 'konfirmasi' && (
              <button
                onClick={() => tutupNotif(true)}
                className="btn-close ms-2"
                style={{
                  transform: 'scale(0.8)',
                  filter: localStorage.getItem('theme') === 'dark' ? 'invert(1) grayscale(100%) brightness(200%)' : 'none'
                }}
              ></button>
            )}
          </div>
        </div>
      )}

      {/* ================= LOADING OVERLAYS ================= */}
      {loading.show && loading.tipe === 'fullscreen' && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
          style={{
            zIndex: 9998,
            backgroundColor: 'rgba(11, 15, 25, 0.75)',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease forwards'
          }}
        >
          {/* SVG Gradient Definition */}
          <svg width="0" height="0" style={{ position: 'absolute', zIndex: -1 }}>
            <defs>
              <linearGradient id="pelangi-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="40%" stopColor="#c084fc" />
                <stop offset="60%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>

          <div className="text-center d-flex flex-column align-items-center">
            <Loader2 size={72} stroke="url(#pelangi-grad)" style={{ animation: 'spin 1.2s linear infinite' }} className="mb-3" />
            <div className="teks-pelangi fs-6 mt-2">{loading.pesan}</div>
          </div>
        </div>
      )}

      {/* ================= GLOBAL CUSTOM MODAL ================= */}
      {modal.show && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            zIndex: 9990,
            backgroundColor: 'rgba(11, 15, 25, 0.6)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease forwards'
          }}
        >
          <div className="kartu-premium fade-in w-100" style={{ maxWidth: '550px', padding: '1.5rem', boxSizing: 'border-box' }}>
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
              <h4 className="fw-bold mb-0 text-main" style={{ fontSize: '0.9rem' }}>{modal.title}</h4>
              <button 
                onClick={tutupModal} 
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  border: '1.5px solid var(--warna-bahaya)',
                  background: 'rgba(239,68,68,0.08)',
                  color: 'var(--warna-bahaya)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 text-main" style={{ maxHeight: '75vh' }}>
              {typeof modal.content === 'function' ? modal.content() : modal.content}
            </div>

            <div className="d-flex gap-2 justify-content-end">
              {modal.onSave && (
                <button
                  onClick={async () => {
                    tampilkanLoading(true, 'fullscreen', 'Menyimpan...');
                    try {
                      await modal.onSave();
                      tutupModal();
                    } catch (e) {
                      // Tetap biarkan modal terbuka jika simpan gagal
                    } finally {
                      tutupLoading();
                    }
                  }}
                  className="tombol-premium"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 1rem' }}
                >
                  {modal.saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);

// Global Lazy Loading Spinner Component
export const LazyLoading = ({ pesan = 'Memuat data...' }) => {
  return (
    <div className="d-flex align-items-center justify-content-center p-4 w-100">
      <div className="text-center d-flex align-items-center gap-2">
        <Loader2 size={24} style={{ color: 'var(--warna-utama)', animation: 'spin 1s linear infinite' }} />
        <span className="text-muted small fw-semibold">{pesan}</span>
      </div>
    </div>
  );
};
