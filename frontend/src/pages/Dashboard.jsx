import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useUI, LazyLoading } from '../contexts/UIContext.jsx';
import { 
  LogOut, User, Users, Shield, Briefcase, Phone, Mail, Sun, Moon, Edit3, HelpCircle, 
  Layers, Menu, Home, ShoppingCart, BarChart2, Settings, Database, Trash2, Plus, Calendar, MapPin, RefreshCw, UserCheck,
  ChevronDown, ChevronRight, Folder, Grid, Box, FileText, Monitor, CheckSquare, Search, GripVertical, Bell
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../config';

// Fix for default Leaflet marker icons in React
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Tile providers dengan kualitas berbeda
const TILE_PROVIDERS = {
  esri: {
    label: '🗺️ Jalan',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri'
  },
  satelit: {
    label: '🛰️ Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery'
  },
  osm: {
    label: '🌍 OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap'
  },
};

// Helper format tanggal Indonesia dinamis (panjang, sedang, singkat)
const formatTanggal = (dateString, tipe = 'sedang') => {
  if (!dateString) return '-';
  const tgl = new Date(dateString);
  if (isNaN(tgl.getTime())) return dateString;

  const hariArr = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulanArr = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const bulanSingkatArr = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];

  const namaHari = hariArr[tgl.getDay()];
  const tanggal = tgl.getDate();
  const namaBulan = bulanArr[tgl.getMonth()];
  const namaBulanSingkat = bulanSingkatArr[tgl.getMonth()];
  const tahun = tgl.getFullYear();

  if (tipe === 'panjang') {
    return `${namaHari}, ${tanggal} ${namaBulan} ${tahun}`;
  } else if (tipe === 'singkat') {
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(tanggal)}/${pad(tgl.getMonth() + 1)}/${tahun}`;
  }
  
  return `${tanggal} ${namaBulanSingkat} ${tahun}`;
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const IconMap = {
  Home, Database, ShoppingCart, BarChart2, Settings, User, Users, Shield, Briefcase, UserCheck, MapPin, Layers,
  Folder, Grid, Box, FileText, Monitor, CheckSquare
};

const GroupIconMap = {
  'Users': 'Users',
  'Usaha': 'Briefcase',
  'Menus': 'Settings',
  'Lainnya': 'Grid'
};

// Komponen klik peta untuk menangkap klik koordinat
const KlikPeta = ({ onKlik }) => {
  useMapEvents({ click: (e) => onKlik(e.latlng.lat, e.latlng.lng) });
  return null;
};

// Komponen untuk fly-to saat posisi berubah
const FlyToPosisi = ({ posisi }) => {
  const map = useMap();
  useEffect(() => { map.flyTo(posisi, 17, { duration: 1.2 }); }, [posisi]);
  return null;
};

// Komponen peta interaktif lokasi usaha
const PetaLokasi = ({ lat, lng, radius, onLokasiChange }) => {
  const [posisi, setPosisi] = useState([lat || -6.2, lng || 106.816]);
  const [sudahKlik, setSudahKlik] = useState(!!(lat && lng && lat !== -6.2));
  const [loadingLokasi, setLoadingLokasi] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [akurasi, setAkurasi] = useState(null); // meter
  const [tileAktif, setTileAktif] = useState('esri');
  const watchRef = useRef(null);

  // Bersihkan watch saat komponen unmount
  useEffect(() => {
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  const handleKlik = (la, ln) => {
    setPosisi([la, ln]);
    setSudahKlik(true);
    setAkurasi(null);
    onLokasiChange(la, ln);
  };

  const dapatkanLokasiSaatIni = () => {
    if (!navigator.geolocation) return;
    // Hentikan watch sebelumnya
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setLoadingLokasi(true);
    setAkurasi(null);

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);
        const p = [la, ln];
        setPosisi(p);
        setFlyTarget(p);
        setSudahKlik(true);
        setAkurasi(acc);
        onLokasiChange(la, ln);
        // Jika akurasi sudah < 30m, hentikan watch
        if (acc <= 30) {
          navigator.geolocation.clearWatch(watchRef.current);
          setLoadingLokasi(false);
        }
      },
      () => { setLoadingLokasi(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    // Timeout paksa setelah 12 detik
    setTimeout(() => {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      setLoadingLokasi(false);
    }, 12000);
  };

  const tile = TILE_PROVIDERS[tileAktif];

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--warna-border)', height: '220px' }}>
      <MapContainer center={posisi} zoom={17} style={{ height: '220px', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer key={tileAktif} url={tile.url} attribution={tile.attribution} maxZoom={20} />
        <KlikPeta onKlik={handleKlik} />
        {flyTarget && <FlyToPosisi posisi={flyTarget} />}
        {sudahKlik && (
          <>
            <Marker position={posisi} />
            <Circle
              center={posisi}
              radius={radius || 100}
              pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15 }}
            />
          </>
        )}
        {/* Lingkaran akurasi GPS (oranye, hanya saat deteksi) */}
        {akurasi && (
          <Circle
            center={posisi}
            radius={akurasi}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.08, dashArray: '6 4' }}
          />
        )}
      </MapContainer>

      {/* Tombol switcher tile — kiri bawah */}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000, display: 'flex', gap: '4px' }}>
        {Object.entries(TILE_PROVIDERS).map(([key, t]) => (
          <button
            key={key} type="button" onClick={() => setTileAktif(key)}
            style={{
              background: tileAktif === key ? 'var(--warna-utama)' : 'rgba(15,20,35,0.8)',
              color: '#fff', border: tileAktif === key ? 'none' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px', padding: '0.15rem 0.4rem',
              fontSize: '0.55rem', fontWeight: 600, cursor: 'pointer',
              backdropFilter: 'blur(4px)'
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Tombol Posisi Saya — kanan bawah */}
      <button
        type="button" onClick={dapatkanLokasiSaatIni} disabled={loadingLokasi}
        style={{
          position: 'absolute', bottom: '10px', right: '10px', zIndex: 1000,
          background: loadingLokasi ? 'rgba(99,102,241,0.7)' : 'var(--warna-utama)',
          color: '#fff', border: 'none', borderRadius: '8px',
          padding: '0.25rem 0.6rem', fontSize: '0.62rem', fontWeight: 600,
          cursor: loadingLokasi ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {loadingLokasi
          ? <><span>⏳</span> {akurasi ? `±${akurasi}m...` : 'Mendeteksi...'}</>
          : <><span>📍</span> Posisi Saya</>
        }
      </button>
    </div>
  );
};

// Komponen Autocomplete Kustom sebagai pengganti native datalist
const PilihRelasi = ({ options, value, onChange, name, placeholder, dropUp = false }) => {
  const [buka, setBuka] = useState(false);
  const [cari, setCari] = useState(() => {
    if (!value || !options || options.length === 0) return '';
    const matched = options.find(opt => String(opt.value) === String(value));
    return matched ? matched.label : '';
  });
  const ref = useRef(null);
  const cariRef = useRef(cari);

  // Selalu update referensi cari terbaru untuk dipakai di event listener
  useEffect(() => {
    cariRef.current = cari;
  }, [cari]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setBuka(false);
        // Validasi ketat: jika teks yang diketik tidak ada di daftar opsi (sama persis), kosongkan!
        const currentCari = cariRef.current;
        if (currentCari) {
          const matched = options.find(opt => String(opt.label).toLowerCase() === currentCari.toLowerCase());
          if (matched) {
            setCari(matched.label);
            onChange({ target: { name, value: matched.value } });
          } else {
            // Teks tidak valid (ngawur), paksa kosongkan
            setCari('');
            onChange({ target: { name, value: '' } });
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [options, name, onChange]);

  // Sinkronisasi: konversi value (ID) → label untuk ditampilkan
  // Dijalankan ulang setiap options berubah agar non-Root (yang optionsnya telat dimuat) tetap tampil label
  useEffect(() => {
    if (value && options.length > 0) {
      const matched = options.find(opt => String(opt.value) === String(value));
      if (matched && cari !== matched.label) {
        setCari(matched.label);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const filteredOptions = options.filter(opt => 
    String(opt.label).toLowerCase().includes(cari.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <input
        type="text"
        className="form-control input-premium"
        placeholder={placeholder}
        value={cari}
        onChange={(e) => {
          const val = e.target.value;
          setCari(val);
          setBuka(true);
          
          // Langsung sinkronkan ke parent: Jika sama persis kirim ID, jika tidak kirim kosong
          const matched = options.find(opt => String(opt.label).toLowerCase() === val.toLowerCase());
          if (matched) {
            onChange({ target: { name, value: matched.value } });
          } else {
            onChange({ target: { name, value: '' } });
          }
        }}
        onFocus={() => setBuka(true)}
      />
      {buka && (
        <div 
          className="kartu-premium mt-1 fade-in" 
          style={{ 
            position: 'absolute', 
            ...(dropUp ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }), 
            left: 0, right: 0, 
            zIndex: 10000, maxHeight: '200px', overflowY: 'auto',
            padding: '0.25rem', boxShadow: 'var(--warna-bayangan)',
            border: '1px solid var(--warna-border)'
          }}
        >
          {filteredOptions.length > 0 ? filteredOptions.map(opt => (
            <div 
              key={opt.value}
              className="opsi-dropdown-item"
              onClick={() => {
                setCari(opt.label);
                setBuka(false);
                onChange({ target: { name, value: opt.value } }); // Harus opt.value (ID), bukan label
              }}
            >
              {opt.label}
            </div>
          )) : (
            <div className="text-muted small p-2 text-center">Tidak ada hasil pencarian</div>
          )}
        </div>
      )}
    </div>
  );
};

const ModalForm = ({ tabel, isEdit, dataAwal, onSimpan, onBatal, onError, opsiUsaha, opsiUsers, opsiUnit, opsiRoles, opsiMenus, opsiIot = [], opsiAlokasi = [], opsiShift = [], opsiKriteriaPoin = [], opsiJadwal = [], profile }) => {
  const [formState, setFormState] = useState(dataAwal);
  const [shiftTersedia, setShiftTersedia] = useState([]);
  const [loadingShift, setLoadingShift] = useState(false);
  const [pesanLibur, setPesanLibur] = useState('');

  const isPerizinanLoading = tabel === 'perizinan' && !formState.id && (
    loadingShift || 
    opsiUsers.length === 0 || 
    !formState.tanggal || 
    !formState.shift_id_izin || 
    formState.shift_id_izin.length === 0
  );

  useEffect(() => {
    if (tabel === 'perizinan') {
      const karyawanId = formState.karyawan_id || profile?.user_id;
      const tanggal = formState.tanggal;
      if (karyawanId && tanggal) {
        setLoadingShift(true);
        setPesanLibur('');
        const token = localStorage.getItem('token');
        fetch(`http://localhost:8080/api/perizinan/shift-aktif?karyawan_id=${karyawanId}&tanggal=${tanggal}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(res => {
            setLoadingShift(false);
            if (res.status === 'sukses') {
              if (res.libur) {
                setPesanLibur('Hari yang dipilih adalah HARI LIBUR karyawan tersebut.');
                setShiftTersedia([]);
              } else {
                setShiftTersedia(res.shifts || []);
                // Centang semua shift secara default untuk pengajuan baru jika belum ada pilihan
                if (!formState.id && !formState.shift_id_izin) {
                  const allIds = (res.shifts || []).map(s => s.id);
                  setFormState(prev => ({ ...prev, shift_id_izin: allIds }));
                }
              }
            }
          })
          .catch(() => {
            setLoadingShift(false);
          });
      }
    }
  }, [formState.karyawan_id, formState.tanggal, tabel]);

  // Sync edit mode shift_id_izin yang masuk sebagai string comma-separated dari DB
  useEffect(() => {
    if (tabel === 'perizinan' && formState.id && typeof formState.shift_id_izin === 'string') {
      const parsedIds = formState.shift_id_izin.split(',').map(Number).filter(Boolean);
      setFormState(prev => ({ ...prev, shift_id_izin: parsedIds }));
    }
  }, [formState.id, tabel]);

  // State dropdown dipindahkan ke Dashboard dan dilempar sebagai props
  // agar data relasi (seperti nama usaha) bisa dipakai juga di tabel hasil.
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Ekstrak ID berdasarkan label yang dipilih di dropdown
    const ekstrakId = (val, optionsMapping) => {
      if (!val) return '';
      const strVal = val.toString();
      const matched = optionsMapping.find(o => o.label === strVal || String(o.value) === strVal);
      return matched ? matched.value : strVal;
    };

    let dataAkhir = { ...formState };

    if (tabel === 'unit') {
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
    } else if (tabel === 'user_role') {
      dataAkhir.user_id = ekstrakId(dataAkhir.user_id, opsiUsers.map(u => ({ value: u.id, label: `${u.nama} (${u.wa})` })));
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
      dataAkhir.unit_id = ekstrakId(dataAkhir.unit_id, opsiUnit.map(u => ({ value: u.id, label: u.nama_unit })));
      dataAkhir.role_id = ekstrakId(dataAkhir.role_id, opsiRoles.map(u => ({ value: u.id, label: u.nama_role })));
    } else if (tabel === 'shift') {
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
    } else if (tabel === 'jadwal_karyawan') {
      dataAkhir.karyawan_id = ekstrakId(dataAkhir.karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
      if (dataAkhir.is_lembur == 1) {
        dataAkhir.shift_id = '';
      } else {
        dataAkhir.shift_id = ekstrakId(dataAkhir.shift_id, opsiShift.map(s => ({ value: s.id, label: `${s.nama_shift} (${s.jam_mulai.substring(0, 5)} - ${s.jam_selesai.substring(0, 5)})` })));
      }
      if (dataAkhir.original_karyawan_id) {
        dataAkhir.original_karyawan_id = ekstrakId(dataAkhir.original_karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      }
    } else if (tabel === 'absensi') {
      dataAkhir.karyawan_id = ekstrakId(dataAkhir.karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
    } else if (tabel === 'kriteria_poin') {
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
    } else if (tabel === 'points') {
      dataAkhir.karyawan_id = ekstrakId(dataAkhir.karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      if (dataAkhir.pemberi_poin_id) {
        dataAkhir.pemberi_poin_id = ekstrakId(dataAkhir.pemberi_poin_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      }
    } else if (tabel === 'perizinan') {
      dataAkhir.karyawan_id = ekstrakId(dataAkhir.karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      if (dataAkhir.karyawan_pengganti_id) {
        dataAkhir.karyawan_pengganti_id = ekstrakId(dataAkhir.karyawan_pengganti_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      }
      if (dataAkhir.disetujui_oleh) {
        dataAkhir.disetujui_oleh = ekstrakId(dataAkhir.disetujui_oleh, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      }
    } else if (tabel === 'kebersihan') {
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
    }


    // Validasi JS (tanpa bawaan HTML required) menggunakan dataAkhir
    if (tabel === 'users') {
      if (!dataAkhir.nama?.trim()) { onError('Nama lengkap wajib diisi.'); return; }
      if (!dataAkhir.wa?.trim()) { onError('Nomor WhatsApp wajib diisi.'); return; }
      if (!isEdit && !dataAkhir.password?.trim()) { onError('Kata sandi wajib diisi untuk data baru.'); return; }
    } else if (tabel === 'usaha') {
      if (!dataAkhir.nama_usaha?.trim()) { onError('Nama usaha wajib diisi.'); return; }
    } else if (tabel === 'unit') {
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.nama_unit?.trim()) { onError('Nama unit wajib diisi.'); return; }
    } else if (tabel === 'roles') {
      if (!dataAkhir.nama_role?.trim()) { onError('Nama role wajib diisi.'); return; }
    } else if (tabel === 'user_role') {
      if (!dataAkhir.user_id) { onError('Silakan pilih User.'); return; }
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.role_id) { onError('Silakan pilih Role.'); return; }
    } else if (tabel === 'menus') {
      if (!dataAkhir.label?.trim()) { onError('Label menu wajib diisi.'); return; }
      if (!dataAkhir.url?.trim()) { onError('URL menu wajib diisi.'); return; }
    } else if (tabel === 'iot') {
      if (!dataAkhir.nama_perangkat?.trim()) { onError('Nama perangkat wajib diisi.'); return; }
      if (!dataAkhir.mac_address?.trim()) { onError('Alamat MAC / Serial wajib diisi.'); return; }
    } else if (tabel === 'iot_alokasi') {
      if (!dataAkhir.iot_id) { onError('Silakan pilih Perangkat IoT.'); return; }
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
    } else if (tabel === 'shift') {
      if (!dataAkhir.nama_shift?.trim()) { onError('Nama shift wajib diisi.'); return; }
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.jam_mulai) { onError('Jam mulai wajib diisi.'); return; }
      if (!dataAkhir.jam_selesai) { onError('Jam selesai wajib diisi.'); return; }
    } else if (tabel === 'jadwal_karyawan') {
      if (!dataAkhir.karyawan_id) { onError('Silakan pilih Karyawan.'); return; }
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.shift_id) { onError('Silakan pilih Shift Kerja.'); return; }
    } else if (tabel === 'absensi') {
      if (!dataAkhir.karyawan_id) { onError('Silakan pilih Karyawan.'); return; }
      if (!dataAkhir.jam_masuk) { onError('Jam masuk wajib diisi.'); return; }
      if (!dataAkhir.status_kehadiran) { onError('Status kehadiran wajib dipilih.'); return; }
    } else if (tabel === 'kriteria_poin') {
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.nama_kriteria?.trim()) { onError('Nama kriteria wajib diisi.'); return; }
      if (dataAkhir.nilai_poin === undefined || dataAkhir.nilai_poin === '') { onError('Nilai poin wajib diisi.'); return; }
    } else if (tabel === 'points') {
      if (!dataAkhir.karyawan_id) { onError('Silakan pilih Karyawan.'); return; }
      if (dataAkhir.jumlah_poin === undefined || dataAkhir.jumlah_poin === '') { onError('Jumlah poin wajib diisi.'); return; }
      if (!dataAkhir.sumber) { onError('Sumber perolehan poin wajib dipilih.'); return; }
      if (!dataAkhir.keterangan?.trim()) { onError('Keterangan / alasan wajib diisi.'); return; }
      if (!dataAkhir.tanggal) { onError('Tanggal transaksi wajib diisi.'); return; }
    } else if (tabel === 'perizinan') {
      if (!dataAkhir.karyawan_id) { onError('Silakan pilih Karyawan.'); return; }
      if (!dataAkhir.jenis_izin) { onError('Silakan pilih Jenis Pengajuan.'); return; }
      if (!dataAkhir.tanggal) { onError('Tanggal izin wajib diisi.'); return; }
      if (!dataAkhir.alasan?.trim()) { onError('Alasan wajib diisi.'); return; }
    } else if (tabel === 'kebersihan') {
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.nama_area?.trim()) { onError('Nama area kebersihan wajib diisi.'); return; }
      if (!dataAkhir.jam_mulai) { onError('Jam mulai wajib diisi.'); return; }
      if (!dataAkhir.jam_selesai) { onError('Jam selesai wajib diisi.'); return; }
    } else if (tabel === 'kebersihan_tugas') {
      if (!dataAkhir.status) { onError('Status wajib dipilih.'); return; }
    }
    onSimpan(dataAkhir);
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column">
      <div className="d-flex flex-column gap-3 pe-2" style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
        {tabel === 'users' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Nama Lengkap</label>
              <input type="text" name="nama" className="form-control input-premium" value={formState.nama || ''} onChange={handleChange} placeholder="cth: Budi Santoso" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Nomor WhatsApp</label>
              <input type="text" name="wa" className="form-control input-premium" value={formState.wa || ''} onChange={handleChange} placeholder="cth: 08123456789" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Email</label>
              <input type="email" name="email" className="form-control input-premium" value={formState.email || ''} onChange={handleChange} placeholder="cth: budi@email.com" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Kata Sandi {isEdit && '(Kosongkan jika tidak diubah)'}</label>
              <input type="password" name="password" className="form-control input-premium" value={formState.password || ''} onChange={handleChange} placeholder={isEdit ? 'Kosongkan jika tidak ingin diubah' : 'Min. 6 karakter'} />
            </div>
          </>
        )}
        {tabel === 'usaha' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Nama Usaha</label>
              <input type="text" name="nama_usaha" className="form-control input-premium" value={formState.nama_usaha || ''} onChange={handleChange} placeholder="cth: Warung Makan Padang" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Alamat Usaha</label>
              <textarea name="alamat" className="form-control input-premium" value={formState.alamat || ''} onChange={handleChange} rows="2" placeholder="cth: Jl. Sudirman No. 10, Jakarta"></textarea>
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Tanggal Berdiri</label>
                <input type="date" name="tanggal_berdiri" className="form-control input-premium" value={formState.tanggal_berdiri || ''} onChange={handleChange} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">No. Izin Usaha</label>
                <input type="text" name="no_izin" className="form-control input-premium" value={formState.no_izin || ''} onChange={handleChange} placeholder="cth: NIB-12345" />
              </div>
            </div>

            {/* PETA INTERAKTIF LOKASI USAHA */}
            <div>
              <label className="form-label small fw-semibold d-flex align-items-center gap-1">
                <MapPin size={13} /> Lokasi Usaha (Klik peta untuk menentukan titik)
              </label>
              <PetaLokasi
                lat={parseFloat(formState.latitude) || -6.2}
                lng={parseFloat(formState.longitude) || 106.816}
                radius={parseInt(formState.radius_absen) || 100}
                onLokasiChange={(lat, lng) => {
                  setFormState(prev => ({ ...prev, latitude: lat.toFixed(7), longitude: lng.toFixed(7) }));
                }}
              />
              <div className="row g-2 mt-1">
                <div className="col-4">
                  <label className="form-label small fw-semibold" style={{ fontSize: '0.65rem' }}>Latitude</label>
                  <input type="text" name="latitude" className="form-control input-premium" value={formState.latitude || ''} onChange={handleChange} placeholder="-6.2000" />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-semibold" style={{ fontSize: '0.65rem' }}>Longitude</label>
                  <input type="text" name="longitude" className="form-control input-premium" value={formState.longitude || ''} onChange={handleChange} placeholder="106.8166" />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-semibold" style={{ fontSize: '0.65rem' }}>Radius Absen</label>
                  <input type="number" name="radius_absen" className="form-control input-premium" value={formState.radius_absen || ''} onChange={handleChange} placeholder="meter" />
                </div>
              </div>
              {/* Slider Radius */}
              {(formState.latitude || formState.longitude) && (
                <div className="mt-2">
                  <label className="form-label small fw-semibold" style={{ fontSize: '0.65rem' }}>
                    Atur Radius: <strong>{formState.radius_absen || 100}m</strong>
                  </label>
                  <input
                    type="range" min="50" max="2000" step="25"
                    value={formState.radius_absen || 100}
                    onChange={(e) => setFormState(prev => ({ ...prev, radius_absen: e.target.value }))}
                    className="form-range w-100"
                    style={{ accentColor: 'var(--warna-utama)' }}
                  />
                </div>
              )}
            </div>
          </>
        )}
        {tabel === 'unit' && (
          <>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha Induk</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div>
              <label className="form-label small fw-semibold">Nama Unit Cabang</label>
              <input type="text" name="nama_unit" className="form-control input-premium" value={formState.nama_unit || ''} onChange={handleChange} placeholder="cth: Cabang Pusat" />
            </div>
          </>
        )}
        {tabel === 'roles' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Nama Role (Peran)</label>
              <input type="text" name="nama_role" className="form-control input-premium" value={formState.nama_role || ''} onChange={handleChange} placeholder="cth: kasir" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Keterangan</label>
              <textarea name="deskripsi" className="form-control input-premium" value={formState.deskripsi || ''} onChange={handleChange} rows="3" placeholder="cth: Petugas kasir yang mengelola transaksi"></textarea>
            </div>
          </>
        )}
        {tabel === 'user_role' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Pilih User</label>
              <PilihRelasi
                name="user_id"
                placeholder="Ketik atau pilih user..."
                value={formState.user_id || ''}
                onChange={handleChange}
                options={opsiUsers.map(u => ({ value: u.id, label: `${u.nama} (${u.wa})` }))}
              />
            </div>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Kosongkan jika role Global (Root/Member)"
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div>
              <label className="form-label small fw-semibold">Pilih Unit (Opsional)</label>
              <PilihRelasi
                name="unit_id"
                placeholder="Kosongkan jika tidak terikat unit"
                value={formState.unit_id || ''}
                onChange={handleChange}
                // Tampilkan semua opsi unit, beri nama fallback jika nama_unit kosong
                options={opsiUnit.map(u => ({ value: u.id, label: u.nama_unit ? String(u.nama_unit) : `(Unit ID: ${u.id})` }))}
              />
            </div>
            <div>
              <label className="form-label small fw-semibold">Pilih Role / Peran</label>
              <PilihRelasi
                name="role_id"
                placeholder="Ketik atau pilih role..."
                value={formState.role_id || ''}
                onChange={handleChange}
                options={opsiRoles.map(u => ({ value: u.id, label: u.nama_role }))}
                dropUp={true}
              />
            </div>
          </>
        )}
        {tabel === 'menus' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Label Menu</label>
              <input type="text" name="label" className="form-control input-premium" value={formState.label || ''} onChange={handleChange} placeholder="cth: Pengaturan" />
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Ikon (Lucide)</label>
                <input type="text" name="icon" className="form-control input-premium" value={formState.icon || ''} onChange={handleChange} placeholder="cth: Settings" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">URL / Endpoint</label>
                <input type="text" name="url" className="form-control input-premium" value={formState.url || ''} onChange={handleChange} placeholder="cth: pengaturan" />
              </div>
            </div>
            <div>
              <label className="form-label small fw-semibold">Tabel Terkait</label>
              <input type="text" name="tabel" className="form-control input-premium" value={formState.tabel || ''} onChange={handleChange} placeholder="cth: users (Opsional)" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Grup Menu</label>
              <input type="text" name="grup" className="form-control input-premium" value={formState.grup || ''} onChange={handleChange} placeholder="cth: Users, Pengaturan, Laporan" />
            </div>
            <div className="d-flex align-items-center justify-content-between p-2 rounded-3 mt-1" style={{ border: '1px solid var(--warna-border)' }}>
              <span className="small fw-semibold">Status Aktif</span>
              <div className="form-check form-switch mb-0">
                <input 
                  className="form-check-input cursor-pointer" 
                  type="checkbox" 
                  name="is_aktif" 
                  role="switch"
                  id="menu_is_aktif_switch"
                  checked={String(formState.is_aktif) === '1'} 
                  onChange={(e) => setFormState(prev => ({ ...prev, is_aktif: e.target.checked ? '1' : '0' }))} 
                />
              </div>
            </div>
          </>
        )}
        {tabel === 'role_permissions' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Pilih Role / Peran</label>
              <PilihRelasi
                name="role_id"
                placeholder="Ketik atau pilih role..."
                value={formState.role_id || ''}
                onChange={handleChange}
                options={opsiRoles.map(u => ({ value: u.id, label: u.nama_role }))}
              />
            </div>
            <div>
              <label className="form-label small fw-semibold">Pilih Menu</label>
              <PilihRelasi
                name="menu_id"
                placeholder="Ketik atau pilih menu..."
                value={formState.menu_id || ''}
                onChange={handleChange}
                options={opsiMenus.map(m => ({ value: m.id, label: `${m.grup} - ${m.label}` }))}
                dropUp={true}
              />
            </div>
          </>
        )}
        {tabel === 'iot' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Nama Perangkat</label>
              <input type="text" name="nama_perangkat" className="form-control input-premium" value={formState.nama_perangkat || ''} onChange={handleChange} placeholder="cth: Meja Billiard 1" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Alamat MAC / Serial Number</label>
              <input type="text" name="mac_address" className="form-control input-premium" value={formState.mac_address || ''} onChange={handleChange} placeholder="cth: 24:0A:C4:8B:58:80" />
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Tipe Perangkat</label>
                <PilihRelasi
                  name="tipe_perangkat"
                  placeholder="Pilih tipe..."
                  value={formState.tipe_perangkat || ''}
                  onChange={handleChange}
                  options={[
                    { value: 'billiard', label: 'Billiard (Relay)' },
                    { value: 'android_tv', label: 'Android TV (Network)' },
                    { value: 'saklar_umum', label: 'Saklar Umum' }
                  ]}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">IP Address (Opsional)</label>
                <input type="text" name="ip_address" className="form-control input-premium" value={formState.ip_address || ''} onChange={handleChange} placeholder="cth: 192.168.1.50" />
              </div>
            </div>
            <div className="d-flex align-items-center justify-content-between p-2 rounded-3 mt-1" style={{ border: '1px solid var(--warna-border)' }}>
              <span className="small fw-semibold">Status Alat Beroperasi</span>
              <div className="form-check form-switch mb-0">
                <input 
                  className="form-check-input cursor-pointer" 
                  type="checkbox" 
                  name="is_aktif" 
                  role="switch"
                  id="iot_is_aktif_switch"
                  checked={String(formState.is_aktif) === '1'} 
                  onChange={(e) => setFormState(prev => ({ ...prev, is_aktif: e.target.checked ? '1' : '0' }))} 
                />
              </div>
            </div>
          </>
        )}
        {tabel === 'iot_alokasi' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Pilih Perangkat IoT</label>
              <PilihRelasi
                name="iot_id"
                placeholder="Ketik atau pilih perangkat..."
                value={formState.iot_id || ''}
                onChange={handleChange}
                options={opsiIot
                  .filter(i => {
                    if (isEdit && i.id == formState.iot_id) return true;
                    if (i.is_aktif != 1) return false;
                    const isAllocated = opsiAlokasi.some(al => al.iot_id == i.id);
                    return !isAllocated;
                  })
                  .map(i => ({ value: i.id, label: profile?.usaha_id ? i.nama_perangkat : `${i.nama_perangkat} [${i.mac_address || 'No MAC'}]` }))}
                disabled={isEdit}
              />
            </div>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div>
              <label className="form-label small fw-semibold">Pilih Unit Cabang (Opsional)</label>
              <PilihRelasi
                name="unit_id"
                placeholder="Ketik atau pilih unit..."
                value={formState.unit_id || ''}
                onChange={handleChange}
                options={opsiUnit
                  .filter(u => !formState.usaha_id || u.usaha_id == formState.usaha_id || (profile?.usaha_id && u.usaha_id == profile.usaha_id))
                  .map(u => ({ value: u.id, label: u.nama_unit }))}
              />
            </div>
            <div>
              <label className="form-label small fw-semibold">Kondisi / Ketersediaan</label>
              <PilihRelasi
                name="status_penggunaan"
                placeholder="Pilih status..."
                value={formState.status_penggunaan || ''}
                onChange={handleChange}
                dropUp={true}
                options={[
                  { value: 'tersedia', label: 'Tersedia' },
                  { value: 'dipakai', label: 'Dipakai (Rentan)' },
                  { value: 'gangguan', label: 'Gangguan / Rusak' }
                ]}
              />
            </div>
            {isEdit && (
              <>
                <div className="d-flex align-items-center justify-content-between p-2 rounded-3 mt-1" style={{ border: '1px solid var(--warna-border)' }}>
                  <span className="small fw-semibold">Status Relay Saat Ini (ON/OFF)</span>
                  <div className="form-check form-switch mb-0">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      name="status_relay" 
                      role="switch"
                      id="alokasi_status_relay_switch"
                      checked={String(formState.status_relay) === '1'} 
                      onChange={(e) => setFormState(prev => ({ ...prev, status_relay: e.target.checked ? '1' : '0' }))} 
                    />
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between p-2 rounded-3 mt-1" style={{ border: '1px solid var(--warna-border)' }}>
                  <span className="small fw-semibold">Status Alokasi Aktif</span>
                  <div className="form-check form-switch mb-0">
                    <input 
                      className="form-check-input cursor-pointer" 
                      type="checkbox" 
                      name="is_aktif" 
                      role="switch"
                      id="alokasi_is_aktif_switch"
                      checked={String(formState.is_aktif) === '1'} 
                      onChange={(e) => setFormState(prev => ({ ...prev, is_aktif: e.target.checked ? '1' : '0' }))} 
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {tabel === 'shift' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Nama Shift</label>
              <input 
                type="text" 
                name="nama_shift" 
                className="form-control input-premium" 
                value={formState.nama_shift || ''} 
                onChange={handleChange} 
                placeholder="cth: Pagi, Siang, Malam" 
              />
            </div>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Mulai</label>
                <input 
                  type="time" 
                  name="jam_mulai" 
                  className="form-control input-premium" 
                  value={formState.jam_mulai ? formState.jam_mulai.substring(0, 5) : ''} 
                  onChange={handleChange} 
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Selesai</label>
                <input 
                  type="time" 
                  name="jam_selesai" 
                  className="form-control input-premium" 
                  value={formState.jam_selesai ? formState.jam_selesai.substring(0, 5) : ''} 
                  onChange={handleChange} 
                />
              </div>
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Toleransi Sebelum (Menit)</label>
                <input 
                  type="number" 
                  name="toleransi_sebelum" 
                  className="form-control input-premium" 
                  min="0"
                  value={formState.toleransi_sebelum !== undefined ? formState.toleransi_sebelum : '0'} 
                  onChange={handleChange} 
                  placeholder="cth: 60" 
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Toleransi Terlambat (Menit)</label>
                <input 
                  type="number" 
                  name="toleransi_terlambat" 
                  className="form-control input-premium" 
                  min="0"
                  value={formState.toleransi_terlambat !== undefined ? formState.toleransi_terlambat : '0'} 
                  onChange={handleChange} 
                  placeholder="cth: 15" 
                />
              </div>
            </div>
          </>
        )}
        {tabel === 'jadwal_karyawan' && (
          <>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Karyawan</label>
                <PilihRelasi
                  name="karyawan_id"
                  placeholder="Pilih karyawan..."
                  value={formState.karyawan_id || ''}
                  onChange={handleChange}
                  options={opsiUsers
                    .filter(u => !formState.usaha_id || u.usaha_id == formState.usaha_id)
                    .map(u => ({ value: u.id, label: u.nama }))
                  }
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Hari Libur Mingguan</label>
                <PilihRelasi
                  name="hari"
                  placeholder="Pilih hari libur..."
                  value={formState.hari || ''}
                  onChange={handleChange}
                  options={[
                    { value: '', label: '- Masuk Setiap Hari (Tanpa Libur) -' },
                    { value: 'Senin', label: 'Senin' },
                    { value: 'Selasa', label: 'Selasa' },
                    { value: 'Rabu', label: 'Rabu' },
                    { value: 'Kamis', label: 'Kamis' },
                    { value: 'Jumat', label: 'Jumat' },
                    { value: 'Sabtu', label: 'Sabtu' },
                    { value: 'Minggu', label: 'Minggu' }
                  ]}
                />
              </div>
            </div>
            
            <div className="mt-3">
              <label className="form-label small fw-semibold">Pilih Shift Kerja</label>
              <PilihRelasi
                name="shift_id"
                placeholder="Pilih shift..."
                value={formState.shift_id || ''}
                onChange={handleChange}
                dropUp={true}
                options={opsiShift
                  .filter(s => !formState.usaha_id || s.usaha_id == formState.usaha_id)
                  .map(s => ({ value: s.id, label: `${s.nama_shift} (${s.jam_mulai.substring(0, 5)} - ${s.jam_selesai.substring(0, 5)})` }))
                }
              />
            </div>
          </>
        )}

        {tabel === 'lembur' && (
          <>
            {!isRoot && formState.usaha_id === '' && (
              <div className="mb-3">
                <label className="form-label small fw-semibold">Usaha / Cabang</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Karyawan</label>
                <PilihRelasi
                  name="karyawan_id"
                  placeholder="Pilih karyawan..."
                  value={formState.karyawan_id || ''}
                  onChange={handleChange}
                  options={opsiUsers
                    .filter(u => !formState.usaha_id || u.usaha_id == formState.usaha_id)
                    .map(u => ({ value: u.id, label: u.nama }))
                  }
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Tanggal Lembur</label>
                <input 
                  type="date" 
                  name="tanggal" 
                  className="form-control input-premium" 
                  value={formState.tanggal || ''} 
                  onChange={handleChange} 
                />
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Mulai</label>
                <input 
                  type="time" 
                  name="jam_mulai" 
                  className="form-control input-premium" 
                  value={formState.jam_mulai || ''} 
                  onChange={handleChange} 
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Selesai</label>
                <input 
                  type="time" 
                  name="jam_selesai" 
                  className="form-control input-premium" 
                  value={formState.jam_selesai || ''} 
                  onChange={handleChange} 
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Keterangan / Tugas Lembur</label>
              <textarea
                name="keterangan"
                className="form-control input-premium"
                placeholder="Tulis instruksi lembur..."
                value={formState.keterangan || ''}
                onChange={handleChange}
              />
            </div>
          </>
        )}

        {tabel === 'absensi' && (
          <>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Pilih Karyawan</label>
                <PilihRelasi
                  name="karyawan_id"
                  placeholder="Ketik nama karyawan..."
                  value={formState.karyawan_id || ''}
                  onChange={handleChange}
                  options={opsiUsers
                    .filter(u => !profile?.usaha_id || u.usaha_id == profile.usaha_id)
                    .map(u => ({ value: u.id, label: u.nama }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Status Kehadiran</label>
                <PilihRelasi
                  name="status_kehadiran"
                  placeholder="Pilih status..."
                  value={formState.status_kehadiran || ''}
                  onChange={handleChange}
                  options={[
                    { value: 'tepat_waktu', label: 'Tepat Waktu' },
                    { value: 'lebih_awal', label: 'Lebih Awal' },
                    { value: 'terlambat_toleransi', label: 'Terlambat Toleransi' },
                    { value: 'terlambat', label: 'Terlambat' },
                    { value: 'izin', label: 'Izin' },
                    { value: 'sakit', label: 'Sakit' },
                    { value: 'alpha', label: 'Alpha' }
                  ]}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Hubungkan Jadwal Kerja (Opsional)</label>
              <PilihRelasi
                name="jadwal_karyawan_id"
                placeholder="Pilih jadwal kerja..."
                value={formState.jadwal_karyawan_id || ''}
                onChange={handleChange}
                dropUp={true}
                options={[
                  { value: '', label: '- Tanpa Jadwal Kerja Khusus -' },
                  ...opsiJadwal
                    .filter(j => !formState.karyawan_id || j.karyawan_id == formState.karyawan_id)
                    .map(j => ({ value: j.id, label: `${j.nama_karyawan} - ${j.nama_shift || 'Lembur'} (${j.tanggal})` }))
                ]}
              />
            </div>

            <div className="row g-2 mt-3">
              <div className="col-6">
                <label className="form-label small fw-semibold">Waktu Masuk</label>
                <input
                  type="datetime-local"
                  name="jam_masuk"
                  className="form-control input-premium"
                  value={formState.jam_masuk || ''}
                  onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Waktu Pulang (Opsional)</label>
                <input
                  type="datetime-local"
                  name="jam_pulang"
                  className="form-control input-premium"
                  value={formState.jam_pulang || ''}
                  onChange={handleChange}
                />
              </div>
            </div>
          </>
        )}

        {tabel === 'kriteria_poin' && (
          <>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik nama usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            
            <div className="mt-3">
              <label className="form-label small fw-semibold">Nama Kriteria</label>
              <input
                type="text"
                name="nama_kriteria"
                className="form-control input-premium"
                value={formState.nama_kriteria || ''}
                onChange={handleChange}
                placeholder="cth: Kedisiplinan Tepat Waktu, Pelanggaran Seragam"
              />
            </div>

            <div className="row g-2 mt-3">
              <div className="col-6">
                <label className="form-label small fw-semibold">Nilai Poin (Bisa +/-)</label>
                <input
                  type="number"
                  name="nilai_poin"
                  className="form-control input-premium"
                  value={formState.nilai_poin ?? 0}
                  onChange={handleChange}
                  placeholder="cth: 10 atau -5"
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Metode Penilaian</label>
                <div className="form-check form-switch mt-2">
                  <input
                    className="form-check-input cursor-pointer"
                    type="checkbox"
                    role="switch"
                    id="isOtomatisSwitch"
                    checked={formState.is_otomatis == 1}
                    onChange={(e) => setFormState(prev => ({ ...prev, is_otomatis: e.target.checked ? 1 : 0 }))}
                  />
                  <label className="form-check-label small fw-semibold" htmlFor="isOtomatisSwitch">
                    Otomatis oleh Sistem
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Kode Sistem (Hanya untuk Developer)</label>
              <input
                type="text"
                name="kode_sistem"
                className="form-control input-premium text-muted"
                value={formState.kode_sistem || ''}
                onChange={handleChange}
                readOnly={profile?.role !== 'root'}
                placeholder="cth: ABSEN_TEPAT_WAKTU"
              />
              <span className="text-muted small" style={{ fontSize: '0.65rem' }}>
                *Hanya Root administrator yang dapat mengedit kode sistem untuk otomatisasi backend.
              </span>
            </div>
          </>
        )}

        {tabel === 'points' && (
          <>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Karyawan Penerima Poin</label>
                <PilihRelasi
                  name="karyawan_id"
                  placeholder="Pilih karyawan..."
                  value={formState.karyawan_id || ''}
                  onChange={handleChange}
                  options={opsiUsers
                    .filter(u => !profile?.usaha_id || u.usaha_id == profile.usaha_id)
                    .map(u => ({ value: u.id, label: u.nama }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Tanggal Transaksi</label>
                <input
                  type="date"
                  name="tanggal"
                  className="form-control input-premium"
                  value={formState.tanggal || ''}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="row g-2 mt-3">
              <div className="col-6">
                <label className="form-label small fw-semibold">Jumlah Poin (Bisa +/-)</label>
                <input
                  type="number"
                  name="jumlah_poin"
                  className="form-control input-premium"
                  value={formState.jumlah_poin ?? 0}
                  onChange={handleChange}
                  placeholder="cth: 5 atau -10"
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Sumber Transaksi</label>
                <PilihRelasi
                  name="sumber"
                  placeholder="Pilih sumber..."
                  value={formState.sumber || ''}
                  onChange={handleChange}
                  options={[
                    { value: 'penilaian_supervisor', label: 'Penilaian Atasan' },
                    { value: 'tugas_tambahan', label: 'Tugas Tambahan' },
                    { value: 'absensi', label: 'Kehadiran / Absen' },
                    { value: 'saldo_awal', label: 'Saldo Awal Bulanan' }
                  ]}
                />
              </div>
            </div>

            {profile?.role === 'root' && (
              <div className="mt-3">
                <label className="form-label small fw-semibold">Pemberi Poin (Atasan Penilai)</label>
                <PilihRelasi
                  name="pemberi_poin_id"
                  placeholder="Pilih supervisor/owner penilai..."
                  value={formState.pemberi_poin_id || ''}
                  onChange={handleChange}
                  options={opsiUsers.map(u => ({ value: u.id, label: u.nama }))}
                />
              </div>
            )}

            <div className="mt-3">
              <label className="form-label small fw-semibold">Keterangan / Alasan</label>
              <textarea
                name="keterangan"
                className="form-control input-premium"
                rows="3"
                value={formState.keterangan || ''}
                onChange={handleChange}
                placeholder="Tuliskan detail pencatatan poin (cth: Menyelesaikan kebersihan gudang tepat waktu)"
              />
            </div>
          </>
        )}
        {tabel === 'perizinan' && (
          <>
            {/* Field Karyawan */}
            {formState.id ? (
              <div>
                <label className="form-label small fw-semibold">Karyawan Pemohon</label>
                <input
                  type="text"
                  className="form-control input-premium"
                  value={formState.nama_karyawan || formState.karyawan_id || ''}
                  disabled
                />
              </div>
            ) : (profile?.role?.toLowerCase() === 'karyawan' || profile?.role?.toLowerCase() === 'kasir') ? (
              <input type="hidden" name="karyawan_id" value={formState.karyawan_id || profile?.user_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Karyawan Pemohon</label>
                <PilihRelasi
                  name="karyawan_id"
                  placeholder="Pilih karyawan..."
                  value={formState.karyawan_id || ''}
                  onChange={handleChange}
                  options={opsiUsers
                    .filter(u => !profile?.usaha_id || u.usaha_id == profile.usaha_id)
                    .map(u => ({ value: u.id, label: u.nama }))}
                />
              </div>
            )}
            
            <div className="mt-3">
              <label className="form-label small fw-semibold">Karyawan Pengganti (Opsional)</label>
              <PilihRelasi
                name="karyawan_pengganti_id"
                placeholder="Pilih karyawan pengganti..."
                value={formState.karyawan_pengganti_id || ''}
                onChange={handleChange}
                options={opsiUsers
                  .filter(u => (!profile?.usaha_id || u.usaha_id == profile.usaha_id) && String(u.id) !== String(formState.karyawan_id || profile?.user_id))
                  .map(u => ({ value: u.id, label: u.nama }))}
              />
            </div>

            <div className="row g-2 mt-3">
              <div className="col-12">
                <label className="form-label small fw-semibold">Jenis Pengajuan</label>
                <div className="d-flex gap-2 mt-1">
                  <button
                    type="button"
                    className={`flex-fill tombol-${(formState.jenis_izin || 'izin') === 'izin' ? 'premium' : 'sekunder-premium'}`}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem', borderRadius: '8px' }}
                    onClick={() => setFormState(prev => ({ ...prev, jenis_izin: 'izin' }))}
                  >
                    📝 Izin (Pribadi)
                  </button>
                  <button
                    type="button"
                    className={`flex-fill tombol-${formState.jenis_izin === 'sakit' ? 'premium' : 'sekunder-premium'}`}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem', borderRadius: '8px' }}
                    onClick={() => setFormState(prev => ({ ...prev, jenis_izin: 'sakit' }))}
                  >
                    🤕 Sakit (Dokter)
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Tanggal Izin / Sakit</label>
              <input
                type="date"
                name="tanggal"
                className="form-control input-premium"
                value={formState.tanggal || ''}
                onChange={handleChange}
              />
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Pilih Shift yang Diizinkan (Bisa lebih dari 1)</label>
              {loadingShift && <div className="text-muted small">Memuat shift kerja...</div>}
              {pesanLibur && <div className="alert alert-warning small p-2">{pesanLibur}</div>}
              {!loadingShift && !pesanLibur && shiftTersedia.length === 0 && (
                <div className="text-muted small italic text-warning">Tidak ada shift kerja reguler untuk karyawan ini di hari tersebut.</div>
              )}
              {!loadingShift && !pesanLibur && shiftTersedia.length > 0 && (
                <div className="d-flex flex-column gap-2 mt-1">
                  {shiftTersedia.map(s => {
                    const terpilih = Array.isArray(formState.shift_id_izin) && formState.shift_id_izin.map(Number).includes(Number(s.id));
                    return (
                      <div key={s.id} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`shift_chk_${s.id}`}
                          checked={terpilih}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setFormState(prev => {
                              const current = Array.isArray(prev.shift_id_izin) ? prev.shift_id_izin : [];
                              const next = checked 
                                ? [...current, Number(s.id)]
                                : current.filter(id => Number(id) !== Number(s.id));
                              return { ...prev, shift_id_izin: next };
                            });
                          }}
                        />
                        <label className="form-check-label small text-main" htmlFor={`shift_chk_${s.id}`} style={{ cursor: 'pointer' }}>
                          <strong>{s.nama_shift}</strong> ({s.jam_mulai.substring(0, 5)} - {s.jam_selesai.substring(0, 5)})
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Alasan Ketidakhadiran</label>
              <textarea
                name="alasan"
                className="form-control input-premium"
                rows="3"
                value={formState.alasan || ''}
                onChange={handleChange}
                placeholder="Tuliskan alasan pengajuan izin atau sakit..."
              />
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold">Unggah Dokumen Bukti (Gambar / PDF - Opsional)</label>
              <input
                type="file"
                name="dokumen_bukti_file"
                accept="image/*,application/pdf"
                className="form-control input-premium"
                onChange={(e) => {
                  const file = e.target.files[0];
                  setFormState(prev => ({ ...prev, dokumen_bukti: file }));
                }}
              />
              {formState.id && typeof formState.dokumen_bukti === 'string' && formState.dokumen_bukti && (
                <div className="small text-muted mt-1">
                  Berkas terunggah: <code>{formState.dokumen_bukti}</code>
                </div>
              )}
            </div>

            {/* Bagian Review Atasan (Hanya muncul jika yang membuka adalah Supervisor/Owner/Root dan data sudah diajukan) */}
            {(profile?.role?.toLowerCase() === 'root' || profile?.role?.toLowerCase() === 'supervisor' || profile?.role?.toLowerCase() === 'owner') && (
              <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--warna-border)' }}>
                <h5 className="fw-bold mb-3 text-main" style={{ fontSize: '0.8rem' }}>🛡️ Evaluasi Atasan</h5>
                
                {(() => {
                  const shiftIdsDiajukan = typeof formState.shift_id_izin === 'string'
                    ? formState.shift_id_izin.split(',').map(Number).filter(Boolean)
                    : (Array.isArray(formState.shift_id_izin) ? formState.shift_id_izin.map(Number) : []);
                  const detailShiftDiajukan = opsiShift.filter(s => shiftIdsDiajukan.includes(Number(s.id)));
                  
                  if (detailShiftDiajukan.length === 0) return null;

                  const rawApproved = formState.shift_id_disetujui !== undefined
                    ? formState.shift_id_disetujui
                    : formState.shift_id_izin;
                  
                  const shiftIdsDisetujui = typeof rawApproved === 'string'
                    ? rawApproved.split(',').map(Number).filter(Boolean)
                    : (Array.isArray(rawApproved) ? rawApproved.map(Number) : shiftIdsDiajukan);

                  return (
                    <div className="mb-3 p-2 rounded-2" style={{ backgroundColor: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <div className="small fw-semibold text-main mb-1" style={{ fontSize: '0.72rem' }}>Pilih shift yang disetujui untuk izin:</div>
                      <div className="d-flex flex-column gap-1">
                        {detailShiftDiajukan.map(s => {
                          const terpilih = shiftIdsDisetujui.includes(Number(s.id));
                          return (
                            <div key={s.id} className="form-check m-0">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`eval_chk_${s.id}`}
                                checked={terpilih}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const next = checked 
                                    ? [...shiftIdsDisetujui, Number(s.id)]
                                    : shiftIdsDisetujui.filter(id => Number(id) !== Number(s.id));
                                  setFormState(prev => ({ ...prev, shift_id_disetujui: next }));
                                }}
                              />
                              <label className="form-check-label small text-main" htmlFor={`eval_chk_${s.id}`} style={{ cursor: 'pointer', fontSize: '0.72rem' }}>
                                <strong>{s.nama_shift}</strong> ({s.jam_mulai.substring(0, 5)} - {s.jam_selesai.substring(0, 5)})
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                
                <div className="row g-2">
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Keputusan Status</label>
                    <div className="d-flex gap-2 mt-1">
                      <button
                        type="button"
                        className={`flex-fill tombol-${(formState.status || 'menunggu_persetujuan') === 'menunggu_persetujuan' ? 'premium' : 'sekunder-premium'}`}
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem', borderRadius: '8px' }}
                        onClick={() => setFormState(prev => ({ ...prev, status: 'menunggu_persetujuan' }))}
                      >
                        ⏱️ Menunggu
                      </button>
                      <button
                        type="button"
                        className={`flex-fill tombol-${formState.status === 'disetujui' ? 'premium' : 'sekunder-premium'}`}
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem', borderRadius: '8px' }}
                        onClick={() => setFormState(prev => ({ ...prev, status: 'disetujui' }))}
                      >
                        ✓ Setujui
                      </button>
                      <button
                        type="button"
                        className={`flex-fill tombol-${formState.status === 'ditolak' ? 'premium' : 'sekunder-premium'}`}
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.5rem', borderRadius: '8px' }}
                        onClick={() => setFormState(prev => ({ ...prev, status: 'ditolak' }))}
                      >
                        ✕ Tolak
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label small fw-semibold">Catatan dari Atasan</label>
                  <textarea
                    name="catatan_atasan"
                    className="form-control input-premium"
                    rows="2"
                    value={formState.catatan_atasan || ''}
                    onChange={handleChange}
                    placeholder="Masukkan alasan persetujuan atau penolakan..."
                  />
                </div>

                {/* Set disetujui_oleh otomatis jika disetujui/ditolak */}
                <input type="hidden" name="disetujui_oleh" value={profile?.user_id} />
              </div>
            )}
          </>
        )}
        {tabel === 'kebersihan' && (
          <>
            {profile?.usaha_id ? (
              <input type="hidden" name="usaha_id" value={formState.usaha_id || profile.usaha_id} />
            ) : (
              <div>
                <label className="form-label small fw-semibold">Pilih Usaha</label>
                <PilihRelasi
                  name="usaha_id"
                  placeholder="Ketik atau pilih usaha..."
                  value={formState.usaha_id || ''}
                  onChange={handleChange}
                  options={opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha }))}
                />
              </div>
            )}
            <div>
              <label className="form-label small fw-semibold">Nama Area Kebersihan</label>
              <input 
                type="text" 
                name="nama_area" 
                className="form-control input-premium" 
                value={formState.nama_area || ''} 
                onChange={handleChange} 
                placeholder="cth: Area Lobby Depan" 
              />
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Mulai</label>
                <input 
                  type="time" 
                  name="jam_mulai" 
                  className="form-control input-premium" 
                  value={formState.jam_mulai ? formState.jam_mulai.substring(0, 5) : ''} 
                  onChange={handleChange} 
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold">Jam Selesai</label>
                <input 
                  type="time" 
                  name="jam_selesai" 
                  className="form-control input-premium" 
                  value={formState.jam_selesai ? formState.jam_selesai.substring(0, 5) : ''} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </>
        )}
        {tabel === 'kebersihan_tugas' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Area Kebersihan</label>
              <input 
                type="text" 
                className="form-control input-premium" 
                value={formState.nama_area || ''} 
                disabled 
              />
            </div>
            <div>
              <label className="form-label small fw-semibold">Status Tugas</label>
              <select 
                name="status" 
                className="form-select input-premiumSelect" 
                value={formState.status || 'belum_dibersihkan'} 
                onChange={handleChange}
              >
                <option value="belum_dibersihkan">Belum Dibersihkan</option>
                <option value="menunggu_verifikasi">Menunggu Verifikasi</option>
                <option value="selesai">Selesai (Bersih)</option>
                <option value="tidak_bersih">Tidak Bersih (Kotor)</option>
              </select>
            </div>
            <div>
              <label className="form-label small fw-semibold">Catatan Evaluasi</label>
              <textarea 
                name="catatan_atasan" 
                className="form-control input-premium" 
                rows="3" 
                value={formState.catatan_atasan || ''} 
                onChange={handleChange} 
                placeholder="Tuliskan catatan..." 
              />
            </div>
          </>
        )}
      </div>

      <div className="d-flex justify-content-end mt-4 pt-3" style={{ borderTop: '1px solid var(--warna-border)', flexShrink: 0, position: 'sticky', bottom: 0, backgroundColor: 'var(--warna-bg-kartu)' }}>
        <button 
          type="submit" 
          className="tombol-premium" 
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
          disabled={isPerizinanLoading}
        >
          {isPerizinanLoading ? 'Memuat data...' : 'Simpan'}
        </button>
      </div>
    </form>
  );
};

const dapatkanNamaShiftDariIds = (shiftIdsStr, opsiShift) => {
  if (!shiftIdsStr) return 'Semua Shift';
  const ids = shiftIdsStr.split(',').map(Number).filter(Boolean);
  const matching = opsiShift.filter(s => ids.includes(Number(s.id)));
  if (matching.length === 0) return 'Semua Shift';
  return matching.map(s => s.nama_shift).join(', ');
};

const KartuTugasPengganti = ({ tugas, opsiShift, profile, ambilRiwayatPerizinan, formatTanggal, ui }) => {
  const [shiftsTersedia, setShiftsTersedia] = useState([]);
  const [shiftsDisetujui, setShiftsDisetujui] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rawIds = tugas.shift_id_izin;
    if (rawIds) {
      const ids = rawIds.split(',').map(Number).filter(Boolean);
      const detail = opsiShift.filter(s => ids.includes(Number(s.id)));
      setShiftsTersedia(detail);
      setShiftsDisetujui(ids);
    } else {
      // Fallback: Tarik shift aktif dari backend untuk data lama
      setLoading(true);
      const token = localStorage.getItem('token');
      fetch(`http://localhost:8080/api/perizinan/shift-aktif?karyawan_id=${tugas.karyawan_id}&tanggal=${tugas.tanggal}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(res => {
          setLoading(false);
          if (res.status === 'sukses') {
            setShiftsTersedia(res.shifts || []);
            setShiftsDisetujui((res.shifts || []).map(s => s.id));
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [tugas.shift_id_izin, tugas.karyawan_id, tugas.tanggal, opsiShift]);

  const tanganiTerima = async () => {
    if (shiftsDisetujui.length === 0) {
      ui.notif('gagal', 'Anda harus memilih minimal 1 shift yang ingin Anda gantikan.');
      return;
    }

    const setuju = await ui.notif('konfirmasi', 'Apakah Anda yakin menerima tugas pengganti untuk shift yang Anda pilih?');
    if (!setuju) return;

    ui.loading(true, 'fullscreen', 'Memproses keputusan...');
    try {
      const r = await fetch('http://localhost:8080/api/perizinan/keputusan-pengganti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ 
          id: tugas.id, 
          keputusan: 'setuju',
          shift_id_disetujui: shiftsDisetujui
        })
      });
      const res = await r.json();
      ui.loading(false);
      if (r.ok && res.status === 'sukses') {
        ui.notif('sukses', res.pesan);
        await ambilRiwayatPerizinan();
      } else { 
        ui.notif('gagal', res.pesan); 
      }
    } catch { 
      ui.loading(false); 
      ui.notif('gagal', 'Kesalahan koneksi.'); 
    }
  };

  const tanganiTolak = async () => {
    const setuju = await ui.notif('konfirmasi', 'Apakah Anda yakin menolak tugas pengganti ini?');
    if (!setuju) return;

    ui.loading(true, 'fullscreen', 'Memproses keputusan...');
    try {
      const r = await fetch('http://localhost:8080/api/perizinan/keputusan-pengganti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ id: tugas.id, keputusan: 'tolak' })
      });
      const res = await r.json();
      ui.loading(false);
      if (r.ok && res.status === 'sukses') {
        ui.notif('sukses', res.pesan);
        await ambilRiwayatPerizinan();
      } else { 
        ui.notif('gagal', res.pesan); 
      }
    } catch { 
      ui.loading(false); 
      ui.notif('gagal', 'Kesalahan koneksi.'); 
    }
  };

  return (
    <div className="col-12">
      <div className="alert-premium border-warning p-3 p-sm-4 fade-in" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', borderLeft: '5px solid var(--warna-warning)' }}>
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div>
            <h5 className="fw-bold mb-1 text-main d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
              <span>🚨 Permintaan Pengganti Shift Masuk</span>
            </h5>
            <p className="mb-2 text-muted small">
              <strong>{tugas.nama_karyawan}</strong> mengajukan izin <strong>{tugas.jenis_izin === 'sakit' ? 'Sakit' : 'Izin'}</strong> untuk tanggal <strong>{formatTanggal(tugas.tanggal, 'sedang')}</strong> dengan alasan <em>"{tugas.alasan}"</em>.
            </p>
            
            <div className="mt-2 p-2 rounded-2" style={{ backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', maxWidth: '400px' }}>
              <div className="small fw-semibold text-main mb-1" style={{ fontSize: '0.72rem' }}>Pilih shift yang sanggup Anda gantikan:</div>
              {loading && <div className="text-muted small">Memuat daftar shift...</div>}
              {!loading && shiftsTersedia.length === 0 && (
                <div className="text-muted small italic text-warning">Tidak ada shift kerja reguler untuk karyawan ini di hari tersebut.</div>
              )}
              {!loading && shiftsTersedia.length > 0 && (
                <div className="d-flex flex-column gap-1">
                  {shiftsTersedia.map(s => {
                    const terpilih = shiftsDisetujui.includes(Number(s.id));
                    return (
                      <div key={s.id} className="form-check m-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`replace_chk_${tugas.id}_${s.id}`}
                          checked={terpilih}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setShiftsDisetujui(prev => checked 
                              ? [...prev, Number(s.id)]
                              : prev.filter(id => Number(id) !== Number(s.id))
                            );
                          }}
                        />
                        <label className="form-check-label small text-main" htmlFor={`replace_chk_${tugas.id}_${s.id}`} style={{ cursor: 'pointer', fontSize: '0.72rem' }}>
                          <strong>{s.nama_shift}</strong> ({s.jam_mulai.substring(0, 5)} - {s.jam_selesai.substring(0, 5)})
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="d-flex gap-2 w-100 w-sm-auto justify-content-end align-self-sm-end mt-2 mt-sm-0">
            <button
              onClick={tanganiTerima}
              className="tombol-premium border-0"
              style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
            >
              Terima Tugas
            </button>
            <button
              onClick={tanganiTolak}
              className="tombol-sekunder-premium border-0"
              style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
            >
              Tolak
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { theme, toggleTheme } = useTheme();
  const ui = useUI();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');
  const [sidebarTerbuka, setSidebarTerbuka] = useState(true);
  const [menuAktif, setMenuAktif] = useState('beranda');
  const [openAccordion, setOpenAccordion] = useState(null); // Track opened accordion group
  const [mobileSubmenuGroup, setMobileSubmenuGroup] = useState(null); // Track opened mobile submenu
  
  // Notification settings states
  const [pengaturanNotif, setPengaturanNotif] = useState([]);
  const [loadingPengaturanNotif, setLoadingPengaturanNotif] = useState(false);
  const [menyimpanPengaturanNotif, setMenyimpanPengaturanNotif] = useState(false);
  const [localSettings, setLocalSettings] = useState({});
  
  // CRUD state
  const [tabelTerpilih, setTabelTerpilih] = useState(null);
  const [dataTabel, setDataTabel] = useState([]);
  const [loadingTabel, setLoadingTabel] = useState(false);
  const [kataKunciPencarian, setKataKunciPencarian] = useState('');
  const [filterBulanKebersihan, setFilterBulanKebersihan] = useState('');
  const [filterTahunKebersihan, setFilterTahunKebersihan] = useState('');
  const [filterBulanPoin, setFilterBulanPoin] = useState('');
  const [filterTahunPoin, setFilterTahunPoin] = useState('');
  const [filterBulanAbsensi, setFilterBulanAbsensi] = useState('');
  const [filterTahunAbsensi, setFilterTahunAbsensi] = useState('');
  const [filterBulanIzin, setFilterBulanIzin] = useState('');
  const [filterTahunIzin, setFilterTahunIzin] = useState('');
  const [filterUsahaGlobal, setFilterUsahaGlobal] = useState('');
  const [loadingIzin, setLoadingIzin] = useState(null);
  const [riwayatPerizinan, setRiwayatPerizinan] = useState([]);
  const [loadingRiwayatPerizinan, setLoadingRiwayatPerizinan] = useState(false);
  const [infoDitutup, setInfoDitutup] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bkw_info_ditutup') || '[]');
    } catch { return []; }
  });

  const tutupInfoPerizinan = (id) => {
    const next = [...infoDitutup, id];
    setInfoDitutup(next);
    localStorage.setItem('bkw_info_ditutup', JSON.stringify(next));
  };
  const [tugasHariIni, setTugasHariIni] = useState(null);
  const [loadingTugasHariIni, setLoadingTugasHariIni] = useState(false);
  const lastTabelRef = useRef(null);

  // Modul Kebersihan Usaha (Gamification)
  const [tugasKebersihan, setTugasKebersihan] = useState([]);
  const [loadingTugasKebersihan, setLoadingTugasKebersihan] = useState(false);
  const [tanggalBisnisKebersihan, setTanggalBisnisKebersihan] = useState('');
  const [assigneeMap, setAssigneeMap] = useState({});
  const [catatanEvaluasiMap, setCatatanEvaluasiMap] = useState({});

  const ambilTugasKebersihan = useCallback(async () => {
    setLoadingTugasKebersihan(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/api/kebersihan/tugas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await response.json();
      if (response.ok && json.status === 'sukses') {
        setTugasKebersihan(json.data || []);
        setTanggalBisnisKebersihan(json.tanggal_bisnis_str || '');
      }
    } catch (err) {
      console.error('Gagal mengambil tugas kebersihan', err);
    } finally {
      setLoadingTugasKebersihan(false);
    }
  }, []);

  const tanganiKlaimKebersihan = async (tugasId) => {
    ui.loading(true, 'fullscreen', 'Mengirim klaim pengerjaan...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/kebersihan/tugas/klaim/${tugasId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await response.json();
      if (response.ok && json.status === 'sukses') {
        ui.notif('sukses', json.pesan || 'Klaim tugas berhasil!');
        ambilTugasKebersihan();
        ambilDataTabel('kebersihan_tugas');
      } else {
        ui.notif('gagal', json.pesan || 'Gagal mengajukan klaim.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat mengklaim tugas.');
    } finally {
      ui.tutupLoading();
    }
  };

  const tanganiEvaluasiKebersihan = async (tugasId, keputusan) => {
    const catatan = catatanEvaluasiMap[tugasId] || '';
    ui.loading(true, 'fullscreen', 'Menyimpan hasil evaluasi...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/kebersihan/tugas/evaluasi/${tugasId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ keputusan, catatan_atasan: catatan })
      });
      const json = await response.json();
      if (response.ok && json.status === 'sukses') {
        ui.notif('sukses', json.pesan || 'Tugas berhasil dievaluasi.');
        setCatatanEvaluasiMap(prev => {
          const next = { ...prev };
          delete next[tugasId];
          return next;
        });
        ambilTugasKebersihan();
        ambilDataTabel('kebersihan_tugas');
        fetchProfile();
      } else {
        ui.notif('gagal', json.pesan || 'Gagal menyimpan evaluasi.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat mengirim evaluasi.');
    } finally {
      ui.tutupLoading();
    }
  };

  const tanganiTunjukKebersihan = async (tugasId) => {
    const ditunjukKaryawanId = assigneeMap[tugasId];
    if (!ditunjukKaryawanId) {
      ui.notif('gagal', 'Silakan pilih karyawan yang ingin ditunjuk.');
      return;
    }
    ui.loading(true, 'fullscreen', 'Menunjuk karyawan...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/kebersihan/tugas/tunjuk/${tugasId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ditunjuk_karyawan_id: parseInt(ditunjukKaryawanId) })
      });
      const json = await response.json();
      if (response.ok && json.status === 'sukses') {
        ui.notif('sukses', json.pesan || 'Karyawan berhasil ditunjuk.');
        setAssigneeMap(prev => {
          const next = { ...prev };
          delete next[tugasId];
          return next;
        });
        ambilTugasKebersihan();
        ambilDataTabel('kebersihan_tugas');
      } else {
        ui.notif('gagal', json.pesan || 'Gagal menunjuk karyawan.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat menunjuk karyawan.');
    } finally {
      ui.tutupLoading();
    }
  };

  // Modal Form state — dirender langsung di JSX Dashboard agar opsi selalu segar
  const [modalFormState, setModalFormState] = useState(null); // { title, tabel, isEdit, nilaiAwal }
  const tutupModalForm = () => setModalFormState(null);

  const batalkanPengajuanIzin = async (id) => {
    const yakin = await ui.notif('konfirmasi', 'Apakah Anda yakin ingin membatalkan dan menghapus pengajuan izin ini?');
    if (!yakin) return;
    
    ui.loading(true, 'fullscreen', 'Membatalkan pengajuan...');
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/hapus/perizinan/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', 'Pengajuan izin berhasil dibatalkan dan dihapus.');
        await ambilRiwayatPerizinan();
      } else {
        ui.notif('gagal', res.pesan || 'Gagal membatalkan pengajuan.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const bukaRekapPerizinan = () => {
    const hariIni = new Date();
    const yKini = hariIni.getFullYear();
    const mKini = hariIni.getMonth();
    
    let yLalu = yKini;
    let mLalu = mKini - 1;
    if (mLalu < 0) {
      mLalu = 11;
      yLalu = yKini - 1;
    }

    const dataDuaBulan = riwayatPerizinan.filter(p => {
      if (!p.tanggal) return false;
      const t = new Date(p.tanggal);
      const yTarget = t.getFullYear();
      const mTarget = t.getMonth();
      return (yTarget === yKini && mTarget === mKini) || (yTarget === yLalu && mTarget === mLalu);
    });

    const konten = (
      <div className="d-flex flex-column gap-3 text-main">
        <div className="text-muted small">
          Menampilkan riwayat perizinan cabang/diri Anda pada bulan ini dan bulan sebelumnya sebagai pengingat.
        </div>
        {dataDuaBulan.length === 0 ? (
          <div className="p-4 text-center text-muted small" style={{ backgroundColor: 'var(--bg-halaman)', borderRadius: '8px', border: '1px dashed var(--warna-border)' }}>
            Tidak ada riwayat perizinan tercatat pada 2 bulan terakhir.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '45vh' }}>
            <table className="table table-dark table-hover table-striped text-main small align-middle mb-0" style={{ minWidth: '500px', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--warna-border)' }}>
                  <th className="py-2 px-3 text-muted">Tanggal</th>
                  <th className="py-2 px-2 text-muted">Karyawan</th>
                  <th className="py-2 px-2 text-muted">Karyawan Pengganti</th>
                  <th className="py-2 px-2 text-muted">Jenis</th>
                  <th className="py-2 px-3 text-muted text-end">Status</th>
                </tr>
              </thead>
              <tbody>
                {dataDuaBulan.map(p => {
                  const statusTerhapus = p.deleted_at !== null && p.deleted_at !== undefined;
                  const badgeStatus = statusTerhapus
                    ? <span className="badge text-white" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(108,117,125,0.3)', border: '1px solid rgba(108,117,125,0.5)' }}>🗑️ Dibatalkan</span>
                    : {
                        menunggu_pengganti: <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>⏳ Pengganti</span>,
                        ditolak_pengganti: <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>✕ Pengganti</span>,
                        menunggu_persetujuan: <span className="badge bg-info text-dark" style={{ fontSize: '0.65rem' }}>⏱️ Atasan</span>,
                        disetujui: <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>✓ Disetujui</span>,
                        ditolak: <span className="badge bg-danger" style={{ fontSize: '0.65rem' }}>✕ Ditolak</span>
                      }[p.status] || <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>{p.status}</span>;

                  return (
                    <tr key={p.id} className={statusTerhapus ? 'fst-italic' : ''} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: statusTerhapus ? 0.55 : 1 }}>
                      <td className="py-2 px-3 fw-semibold">{formatTanggal(p.tanggal, 'singkat')}</td>
                      <td className="py-2 px-2">{p.nama_karyawan}</td>
                      <td className="py-2 px-2">{p.nama_pengganti || <span className="text-muted italic">-</span>}</td>
                      <td className="py-2 px-2 text-capitalize">{p.jenis_izin}</td>
                      <td className="py-2 px-3 text-end">{badgeStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="d-flex justify-content-end mt-2">
          <button 
            onClick={() => ui.tutupModal()} 
            className="tombol-sekunder-premium border-0"
            style={{ fontSize: '0.78rem', padding: '0.4rem 1.2rem', borderRadius: '8px' }}
          >
            Tutup
          </button>
        </div>
      </div>
    );

    ui.modal("📅 Rekap Perizinan (2 Bulan Terakhir)", konten);
  };

  // State dan Handlers Drag and Drop untuk pengurutan Menu
  const [draggingIndex, setDraggingIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) return;

    const updatedData = [...dataTabel];
    const draggedItem = updatedData[draggingIndex];
    
    updatedData.splice(draggingIndex, 1);
    updatedData.splice(targetIndex, 0, draggedItem);

    const reorderedData = updatedData.map((item, idx) => ({
      ...item,
      urutan: idx + 1
    }));

    setDataTabel(reorderedData);
    setDraggingIndex(null);

    ui.loading(true, 'fullscreen', 'Menyimpan urutan menu...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8080/api/manajemen/ubah/menus/urutkan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reorderedData.map(item => ({ id: item.id, urutan: item.urutan })))
      });
      const resData = await response.json();
      ui.tutupLoading();
      if (response.ok && resData.status === 'sukses') {
        ui.notif('sukses', 'Urutan menu berhasil disimpan.');
        fetchProfile();
      } else {
        ui.notif('gagal', resData.pesan || 'Gagal menyimpan urutan.');
        ambilDataTabel('menus', true);
      }
    } catch (err) {
      ui.tutupLoading();
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
      ambilDataTabel('menus', true);
    }
  };

  // Mengelompokkan menu berdasarkan grup (untuk sidebar/bottombar)
  const menuGroups = React.useMemo(() => {
    if (!profile?.menus) return [];
    const groups = {};
    profile.menus.forEach(menu => {
      const g = menu.grup || 'Lainnya';
      if (!groups[g]) {
        // Tentukan icon grup secara eksplisit atau fallback ke Folder
        const groupIcon = GroupIconMap[g] || 'Folder';
        groups[g] = {
          grup: g,
          label: g,
          icon: groupIcon,
          menus: [],
          urutan: menu.urutan
        };
      } else {
        if (menu.urutan < groups[g].urutan) {
          groups[g].urutan = menu.urutan;
        }
      }
      
      // Override icon menu tertentu agar tidak sama dengan icon Grup
      let menuIcon = menu.icon;
      if (menu.url === 'users' && menuIcon === 'Users') menuIcon = 'User';
      if (menu.url === 'usaha' && menuIcon === 'Briefcase') menuIcon = 'Database';
      if (menu.url === 'menus' && menuIcon === 'Layers') menuIcon = 'List'; // fallback jika ada
      if (menu.url === 'menus') menuIcon = 'FileText'; // lebih cocok untuk manajemen data menu
      
      groups[g].menus.push({ ...menu, icon: menuIcon });
    });

    return Object.values(groups).sort((a, b) => a.urutan - b.urutan);
  }, [profile]);

  // Global Relational Data (untuk dropdown dan mapping ID ke Nama di tabel)
  const [opsiUsaha, setOpsiUsaha] = useState([]);
  const [opsiUsers, setOpsiUsers] = useState([]);
  const [opsiUnit, setOpsiUnit] = useState([]);
  const [opsiRoles, setOpsiRoles] = useState([]);
  const [opsiMenus, setOpsiMenus] = useState([]);
  const [opsiIot, setOpsiIot] = useState([]);
  const [opsiAlokasi, setOpsiAlokasi] = useState([]);
  const [opsiShift, setOpsiShift] = useState([]);
  const [opsiKriteriaPoin, setOpsiKriteriaPoin] = useState([]);
  const [opsiJadwal, setOpsiJadwal] = useState([]);

  // Dipisah sebagai useCallback agar bisa dipanggil ulang setelah CRUD (tanpa reload)
  const fetchGlobalOptions = useCallback(async () => {
    if (!profile) return;

    const token = localStorage.getItem('token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };

    // Cek izin can_read per tabel dari profil user (agar tidak fetch yang 403)
    const bolehBaca = (namaTabel) => {
      const roleLow = profile?.role?.toLowerCase();
      if (roleLow === 'karyawan' || roleLow === 'kasir') {
        return ['users', 'perizinan'].includes(namaTabel);
      }
      return profile?.menus?.some(m => m.tabel === namaTabel && (m.can_read == 1 || m.permissions?.can_read == 1));
    };

    const butuhUsaha = bolehBaca('usaha') || bolehBaca('unit') || bolehBaca('user_role') || bolehBaca('iot_alokasi') || bolehBaca('shift') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi') || bolehBaca('kriteria_poin') || bolehBaca('points') || bolehBaca('perizinan');
    const butuhUsers = bolehBaca('users') || bolehBaca('user_role') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi') || bolehBaca('points') || bolehBaca('perizinan');
    const butuhUnit = bolehBaca('unit') || bolehBaca('user_role') || bolehBaca('iot_alokasi');
    const butuhRoles = bolehBaca('roles') || bolehBaca('user_role') || bolehBaca('role_permissions');
    const butuhMenus = bolehBaca('menus') || bolehBaca('role_permissions');
    const butuhIot = bolehBaca('iot') || bolehBaca('iot_alokasi');
    const butuhAlokasi = bolehBaca('iot_alokasi');
    const butuhShift = bolehBaca('shift') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi');
    const butuhKriteriaPoin = bolehBaca('kriteria_poin') || bolehBaca('points');
    const butuhJadwal = bolehBaca('jadwal_karyawan') || bolehBaca('absensi');
    
    const safeFetch = async (url) => {
      try {
        const r = await fetch(url, { headers });
        if (!r.ok) return [];
        const json = await r.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch { return []; }
    };

    // Hanya fetch tabel yang user punya izin baca atau dibutuhkan oleh menu relasional
    const [dUsaha, dUsers, dUnit, dRoles, dMenus, dIot, dAlokasi, dShift, dKriteria, dJadwal] = await Promise.all([
      butuhUsaha ? safeFetch('http://localhost:8080/api/manajemen/ambil/usaha') : Promise.resolve([]),
      butuhUsers ? safeFetch('http://localhost:8080/api/manajemen/ambil/users') : Promise.resolve([]),
      butuhUnit ? safeFetch('http://localhost:8080/api/manajemen/ambil/unit') : Promise.resolve([]),
      butuhRoles ? safeFetch('http://localhost:8080/api/manajemen/ambil/roles') : Promise.resolve([]),
      butuhMenus ? safeFetch('http://localhost:8080/api/manajemen/ambil/menus') : Promise.resolve([]),
      butuhIot ? safeFetch('http://localhost:8080/api/manajemen/ambil/iot') : Promise.resolve([]),
      butuhAlokasi ? safeFetch('http://localhost:8080/api/manajemen/ambil/iot_alokasi') : Promise.resolve([]),
      butuhShift ? safeFetch('http://localhost:8080/api/manajemen/ambil/shift') : Promise.resolve([]),
      butuhKriteriaPoin ? safeFetch('http://localhost:8080/api/manajemen/ambil/kriteria_poin') : Promise.resolve([]),
      butuhJadwal ? safeFetch('http://localhost:8080/api/manajemen/ambil/jadwal_karyawan') : Promise.resolve([])
    ]);

    setOpsiUsaha(dUsaha);
    setOpsiUsers(dUsers);
    setOpsiRoles(dRoles);
    setOpsiMenus(dMenus);
    setOpsiAlokasi(dAlokasi);
    setOpsiShift(dShift);
    setOpsiKriteriaPoin(dKriteria);
    setOpsiJadwal(dJadwal);

    // Jika non-Root (tidak punya izin ke tabel iot/unit), bangun opsi dari data iot_alokasi yang sudah di-JOIN
    if (dIot.length > 0) {
      setOpsiIot(dIot);
    } else if (dAlokasi.length > 0) {
      const iotMap = {};
      dAlokasi.forEach(a => {
        if (a.iot_id && a.nama_perangkat && !iotMap[a.iot_id]) {
          iotMap[a.iot_id] = { id: a.iot_id, nama_perangkat: a.nama_perangkat, tipe_perangkat: a.tipe_perangkat, mac_address: a.mac_address, is_aktif: a.iot_is_aktif };
        }
      });
      setOpsiIot(Object.values(iotMap));
    }

    if (dUnit.length > 0) {
      setOpsiUnit(dUnit);
    } else if (dAlokasi.length > 0) {
      const unitMap = {};
      dAlokasi.forEach(a => {
        if (a.unit_id && a.nama_unit && !unitMap[a.unit_id]) {
          unitMap[a.unit_id] = { id: a.unit_id, nama_unit: a.nama_unit, usaha_id: a.usaha_id };
        }
      });
      setOpsiUnit(Object.values(unitMap));
    }
  }, [profile]);

  const ambilRiwayatPerizinan = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoadingRiwayatPerizinan(true);
    try {
      const response = await fetch('http://localhost:8080/api/perizinan/riwayat', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        setRiwayatPerizinan(Array.isArray(json) ? json : []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingRiwayatPerizinan(false);
    }
  }, []);

  const ambilTugasHariIni = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoadingTugasHariIni(true);
    try {
      const response = await fetch('http://localhost:8080/api/absen/tugas-hari-ini', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.status === 'sukses') {
          setTugasHariIni(json.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingTugasHariIni(false);
    }
  }, []);

  // Ambil semua data relasi sekaligus hanya jika memiliki izin CRUD
  useEffect(() => {
    fetchGlobalOptions();
    ambilRiwayatPerizinan();
    ambilTugasHariIni();

    // Registrasi Service Worker PWA & Izin Notifikasi
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(async (registration) => {
          let permission = Notification.permission;
          if (permission === 'default') {
            permission = await Notification.requestPermission();
          }

          if (permission === 'granted') {
            try {
              const publicKey = 'BBD47VKJi9f6b3xynvZulkx6hczzV_yDhiiyO4XZtZV91Wwke3urTD0birDoGgZnarQHgCHjNJKQTtIdt7pnj9M';
              const applicationServerKey = urlBase64ToUint8Array(publicKey);
              
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
              });

              // Kirim subskripsi ke server
              const token = localStorage.getItem('token');
              if (token) {
                await fetch('http://localhost:8080/api/notifikasi/subscribe', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(subscription)
                });
              }
            } catch (err) {
              console.log('Failed to subscribe to push notification:', err);
            }
          }
        })
        .catch(err => console.log('SW registration failed:', err));
    }
  }, [fetchGlobalOptions, ambilRiwayatPerizinan]);

  // State for email update form
  const [newEmail, setNewEmail] = useState('');

  // ===== STATE ABSENSI =====
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null); // { lat, lng }
  const [gpsError, setGpsError] = useState('');
  const [gpsDistance, setGpsDistance] = useState(null); // meter
  const [todayAbsensi, setTodayAbsensi] = useState(null);
  const [absenLoading, setAbsenLoading] = useState(false);
  const [absenFetching, setAbsenFetching] = useState(false);
  const [totalPoin, setTotalPoin] = useState(null);
  const [poinAnimasi, setPoinAnimasi] = useState(false);
  const nowDate = new Date();
  const [filterPoin, setFilterPoin] = useState({ mode: 'bulan', bulan: nowDate.getMonth() + 1, tahun: nowDate.getFullYear() });
  const [showFilterPoin, setShowFilterPoin] = useState(false); // dropdown filter topbar

  // ===== STATE NOTIFIKASI (BELL CENTER) =====
  const [daftarNotifikasi, setDaftarNotifikasi] = useState([]);
  const [showNotifikasiDropdown, setShowNotifikasiDropdown] = useState(false);
  const notifikasiDropdownRef = useRef(null);

  const ambilNotifikasi = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8080/api/notifikasi/ambil', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        setDaftarNotifikasi(res.data || []);
      }
    } catch (err) {
      console.log('Gagal mengambil notifikasi:', err);
    }
  }, []);

  const tandaiBacaNotifikasi = async (id, tautan = null) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`http://localhost:8080/api/notifikasi/baca/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await ambilNotifikasi();
        if (tautan) {
          // Arahkan ke tautan menu yang bersangkutan
          setMenuAktif(tautan);
        }
      }
    } catch (err) {
      console.log('Gagal membaca notifikasi:', err);
    }
  };

  const tandaiSemuaBaca = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8080/api/notifikasi/baca-semua', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        await ambilNotifikasi();
        ui.notif('sukses', 'Semua notifikasi ditandai dibaca.');
      }
    } catch (err) {
      console.log('Gagal menandai semua dibaca:', err);
    }
  };

  const ambilPengaturanNotif = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoadingPengaturanNotif(true);
    try {
      const response = await fetch('http://localhost:8080/api/notifikasi/pengaturan', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        setPengaturanNotif(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil pengaturan notifikasi:', err);
    } finally {
      setLoadingPengaturanNotif(false);
    }
  }, []);

  const simpanPengaturanNotif = async (updatedSettings) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setMenyimpanPengaturanNotif(true);
    try {
      const response = await fetch('http://localhost:8080/api/notifikasi/pengaturan/simpan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: updatedSettings })
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', 'Pengaturan notifikasi berhasil disimpan.');
        await ambilPengaturanNotif();
      } else {
        ui.notif('gagal', res.pesan || 'Gagal menyimpan pengaturan.');
      }
    } catch (err) {
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    } finally {
      setMenyimpanPengaturanNotif(false);
    }
  };

  useEffect(() => {
    if (menuAktif === 'pengaturan_notifikasi') {
      ambilPengaturanNotif();
    }
  }, [menuAktif, ambilPengaturanNotif]);

  useEffect(() => {
    if (pengaturanNotif.length > 0) {
      const initial = {};
      pengaturanNotif.forEach(item => {
        initial[item.kunci] = item.nilai === 1;
      });
      setLocalSettings(initial);
    }
  }, [pengaturanNotif]);

  const handleToggleNotif = (kunci) => {
    setLocalSettings(prev => ({
      ...prev,
      [kunci]: !prev[kunci]
    }));
  };

  // Fungsi untuk mengambil profil secara dinamis
  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8080/api/auth/profil', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (response.ok && data.status === 'sukses') {
        setProfile(data.data);
      } else {
        setError(data.pesan || 'Gagal mengambil data profil.');
      }
    } catch (err) {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchProfile();
    fetchTotalPoin();
    ambilNotifikasi();

    // Baca parameter menu dari URL (?menu=nama_menu) untuk navigasi otomatis
    const queryParams = new URLSearchParams(window.location.search);
    const menuParam = queryParams.get('menu');
    if (menuParam) {
      setMenuAktif(menuParam);
      // Bersihkan query param agar jika di-refresh tidak terus membuka menu tersebut
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate]);

  // Efek untuk memantau pesan real-time dari Service Worker PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleSWMessage = (event) => {
        if (!event.data) return;

        // A. Jika ada push notifikasi baru masuk, reload lonceng dan data perizinan secara real-time
        if (event.data.type === 'PUSH_RECEIVED') {
          ambilNotifikasi();
          ambilRiwayatPerizinan();
        }

        // B. Jika notifikasi diklik, arahkan ke sub-menu yang ditargetkan secara instan
        if (event.data.type === 'NAVIGATE_MENU') {
          const urlObj = new URL(event.data.url, window.location.origin);
          const menuParam = urlObj.searchParams.get('menu');
          if (menuParam) {
            setMenuAktif(menuParam);
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      };
    }
  }, [ambilNotifikasi, ambilRiwayatPerizinan]);

  // Polling fallback: Ambil notifikasi & data perizinan setiap 20 detik (berguna jika PWA/Push diblokir oleh browser)
  useEffect(() => {
    const interval = setInterval(() => {
      ambilNotifikasi();
      ambilRiwayatPerizinan();
    }, 20000);
    return () => clearInterval(interval);
  }, [ambilNotifikasi, ambilRiwayatPerizinan]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (notifikasiDropdownRef.current && !notifikasiDropdownRef.current.contains(e.target)) {
        setShowNotifikasiDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch CRUD table data
  const ambilDataTabel = async (tabel, silent = false) => {
    if (!tabel) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!silent) setLoadingTabel(true);
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/ambil/${tabel}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        setDataTabel(res.data);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal mengambil data tabel.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat mengambil data.');
    } finally {
      if (!silent) setLoadingTabel(false);
    }
  };

  // Memuat data tabel dinamis ketika menu berubah
  useEffect(() => {
    if (menuAktif === 'beranda') {
      setTabelTerpilih(null);
      lastTabelRef.current = null;
      return;
    }
    
    // Temukan menu yang aktif di seluruh grup
    let currentMenu = null;
    menuGroups.forEach(g => {
      const m = g.menus.find(x => x.url === menuAktif);
      if (m) currentMenu = m;
    });

    if (currentMenu) {
      if (currentMenu.grup) {
        setOpenAccordion(currentMenu.grup);
      }
      if (currentMenu.tabel && lastTabelRef.current !== currentMenu.tabel) {
        lastTabelRef.current = currentMenu.tabel;
        setTabelTerpilih(currentMenu.tabel);
        setKataKunciPencarian('');
        setFilterBulanKebersihan('');
        setFilterTahunKebersihan('');
        setFilterBulanPoin('');
        setFilterTahunPoin('');
        setFilterUsahaGlobal('');
        ambilDataTabel(currentMenu.tabel);
        if (currentMenu.tabel === 'kebersihan_tugas') {
          ambilTugasKebersihan();
        }
      }
    } else {
      lastTabelRef.current = null;
      setTabelTerpilih(null);
      setKataKunciPencarian('');
      setFilterBulanKebersihan('');
      setFilterTahunKebersihan('');
      setFilterBulanPoin('');
      setFilterTahunPoin('');
      setFilterUsahaGlobal('');
    }
  }, [menuAktif, menuGroups]);

  const handleLogout = async () => {
    const setuju = await ui.notif('konfirmasi', 'Apakah Anda yakin ingin keluar dari aplikasi BKW Console?');
    if (setuju) {
      localStorage.removeItem('token');
      ui.notif('sukses', 'Berhasil keluar dari aplikasi.');
      navigate('/login');
    }
  };

  const handleGantiUsaha = async () => {
    const setuju = await ui.notif('konfirmasi', 'Apakah Anda ingin berganti konteks usaha?');
    if (!setuju) return;

    ui.loading(true, 'fullscreen', 'Menyiapkan pilihan usaha...');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:8080/api/auth/minta-pilih-usaha', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      ui.loading(false);
      
      if (response.ok && data.status === 'pilih_usaha') {
        sessionStorage.setItem('temp_token', data.token_sementara);
        sessionStorage.setItem('daftar_usaha', JSON.stringify(data.daftar_usaha));
        navigate('/pilih-usaha');
      } else {
        ui.notif('gagal', data.pesan || 'Gagal beralih usaha.');
      }
    } catch (e) {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan saat menghubungi server.');
    }
  };

  // ===== FUNGSI HAVERSINE (Hitung jarak GPS ke toko dalam meter) =====
  const hitungJarak = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Radius bumi dalam meter
    const toRad = (deg) => deg * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ===== FETCH TOTAL POIN KARYAWAN =====
  const fetchTotalPoin = useCallback(async (filter) => {
    const fp = filter || filterPoin;
    try {
      const token = localStorage.getItem('token');
      let url = 'http://localhost:8080/api/absen/total-poin';
      const params = new URLSearchParams();
      if (fp.mode === 'bulan') { params.set('bulan', fp.bulan); params.set('tahun', fp.tahun); }
      else if (fp.mode === 'tahun') { params.set('tahun', fp.tahun); }
      if (params.toString()) url += '?' + params.toString();

      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const json = await res.json();
        const nilaiBaru = json.total_poin ?? 0;
        setTotalPoin(prev => {
          if (prev !== null && prev !== nilaiBaru) {
            setPoinAnimasi(true);
            setTimeout(() => setPoinAnimasi(false), 1200);
          }
          return nilaiBaru;
        });
      }
    } catch (_) {}
  }, [filterPoin]);

  // ===== FUNGSI ABSENSI =====
  const bukaAbsenModal = async () => {
    // Cek apakah ada koordinat toko
    const usahaData = opsiUsaha.find(u => u.id == profile?.usaha_id);
    const tokoLat = parseFloat(usahaData?.latitude);
    const tokoLng = parseFloat(usahaData?.longitude);
    const radiusAbsen = parseFloat(usahaData?.radius_absen) || 100;

    setShowAbsenModal(true);
    setGpsLoading(true);
    setGpsError('');
    setGpsCoords(null);
    setGpsDistance(null);
    setTodayAbsensi(null);

    // Ambil data absensi hari ini via endpoint khusus (tanpa butuh izin CRUD)
    setAbsenFetching(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8080/api/absen/hari-ini', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setTodayAbsensi(json.data || null);
      }
    } catch (e) {
      // Abaikan error
    } finally {
      setAbsenFetching(false);
    }

    // Ambil GPS
    if (!navigator.geolocation) {
      setGpsError('Browser Anda tidak mendukung GPS / Geolocation.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsCoords({ lat, lng });

        // Hitung jarak ke toko jika ada koordinat toko
        if (!isNaN(tokoLat) && !isNaN(tokoLng) && tokoLat !== 0 && tokoLng !== 0) {
          const jarak = hitungJarak(lat, lng, tokoLat, tokoLng);
          setGpsDistance(Math.round(jarak));
        } else {
          setGpsDistance(null);
        }
        setGpsLoading(false);
      },
      (err) => {
        let pesan = 'Gagal mendapatkan lokasi GPS.';
        if (err.code === 1) pesan = 'Izin lokasi ditolak. Mohon izinkan akses lokasi pada browser.';
        else if (err.code === 2) pesan = 'Lokasi tidak tersedia. Pastikan GPS aktif.';
        else if (err.code === 3) pesan = 'Permintaan GPS timeout. Coba lagi.';
        setGpsError(pesan);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const tanganiAbsenMasuk = async (absenLemburId = null) => {
    const lemburId = (absenLemburId && typeof absenLemburId === 'number') ? absenLemburId : null;

    if (!gpsCoords) {
      ui.notif('gagal', 'Koordinat GPS belum tersedia.');
      return;
    }
    const usahaData = opsiUsaha.find(u => u.id == profile?.usaha_id);
    const tokoLat = parseFloat(usahaData?.latitude);
    const tokoLng = parseFloat(usahaData?.longitude);
    const radiusAbsen = parseFloat(usahaData?.radius_absen) || 100;
    const isRoot = profile?.role?.toLowerCase() === 'root';

    // Validasi radius (kecuali root)
    if (!isRoot && !isNaN(tokoLat) && !isNaN(tokoLng) && tokoLat !== 0 && tokoLng !== 0) {
      if (gpsDistance !== null && gpsDistance > radiusAbsen) {
        ui.notif('gagal', `Lokasi Anda terlalu jauh dari toko (${gpsDistance}m). Batas radius: ${radiusAbsen}m.`);
        return;
      }
    }

    const nowLocalStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16);

    // Tentukan target tugas absensi hari ini (apakah lembur atau rutin)
    let statusKehadiran = 'tepat_waktu';
    let jadwalId = null;
    let targetShift = null;

    if (lemburId) {
      // Absen Lembur
      const lemburObj = tugasHariIni?.lembur_aktif;
      if (lemburObj) {
        targetShift = {
          jam_mulai: lemburObj.jam_mulai,
          jam_selesai: lemburObj.jam_selesai,
          toleransi_sebelum: 120, // toleransi default lembur 2 jam sebelum
          toleransi_terlambat: 15 // toleransi default terlambat 15 menit
        };
      }
    } else {
      // Absen Rutin / Pengganti
      const rutinObj = tugasHariIni?.jadwal_pengganti || tugasHariIni?.jadwal_rutin;
      if (rutinObj) {
        jadwalId = rutinObj.id;
        targetShift = rutinObj;
      }
    }

    if (targetShift) {
      const [jamMulaiH, jamMulaiM] = targetShift.jam_mulai.split(':').map(Number);
      const toleransiSebelum = parseInt(targetShift.toleransi_sebelum) || 0;
      const toleransiTerlambat = parseInt(targetShift.toleransi_terlambat) || 0;

      const now = new Date();
      const batasAwal = new Date(now); batasAwal.setHours(jamMulaiH, jamMulaiM - toleransiSebelum, 0, 0);
      const batasTepat = new Date(now); batasTepat.setHours(jamMulaiH, jamMulaiM + toleransiTerlambat, 0, 0);

      if (now < batasAwal) statusKehadiran = 'lebih_awal';
      else if (now <= batasTepat) statusKehadiran = 'tepat_waktu';
      else statusKehadiran = 'terlambat';
    }

    setAbsenLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:8080/api/absen/masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          jadwal_karyawan_id: jadwalId,
          lembur_id: lemburId,
          jam_masuk: nowLocalStr,
          status_kehadiran: statusKehadiran
        })
      });
      const json = await res.json();
      if (res.ok && json.status === 'sukses') {
        const statusLabel = { tepat_waktu: 'Tepat Waktu', lebih_awal: 'Lebih Awal', terlambat: 'Terlambat' }[statusKehadiran] || statusKehadiran;
        const infoPoin = json.nilai_poin ? ` (${json.nilai_poin > 0 ? '+' : ''}${json.nilai_poin} poin)` : '';
        ui.notif('sukses', `Absen Masuk berhasil! Status: ${statusLabel}${infoPoin}`);
        setTodayAbsensi({ id: json.id_baru, karyawan_id: profile?.user_id, jam_masuk: nowLocalStr, jam_pulang: null, status_kehadiran: statusKehadiran, lembur_id: lemburId });
        ambilTugasHariIni();
        if (tabelTerpilih === 'absensi') ambilDataTabel('absensi', true);
        if (tabelTerpilih === 'points') ambilDataTabel('points', true);
        fetchTotalPoin();
      } else {
        ui.notif('gagal', json.pesan || 'Absen masuk gagal.');
      }
    } catch (e) {
      ui.notif('gagal', 'Koneksi gagal saat absen masuk.');
    } finally {
      setAbsenLoading(false);
    }
  };

  const tanganiAbsenPulang = async () => {
    if (!todayAbsensi?.id) {
      ui.notif('gagal', 'Data absensi hari ini tidak ditemukan.');
      return;
    }
    const nowLocalStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16);

    // Tentukan status pulang dari tugas hari ini
    let statusPulang = null;
    let targetShift = null;

    if (todayAbsensi?.lembur_id) {
      targetShift = tugasHariIni?.lembur_aktif;
    } else {
      targetShift = tugasHariIni?.jadwal_pengganti || tugasHariIni?.jadwal_rutin;
    }

    if (targetShift?.jam_selesai) {
      const [h, m] = targetShift.jam_selesai.split(':').map(Number);
      const batas = new Date(); batas.setHours(h, m, 0, 0);
      statusPulang = new Date() >= batas ? 'PULANG_TEPAT_WAKTU' : 'PULANG_LEBIH_AWAL';
    }

    setAbsenLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:8080/api/absen/pulang/${todayAbsensi.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ jam_pulang: nowLocalStr, status_pulang: statusPulang })
      });
      const json = await res.json();
      if (res.ok && json.status === 'sukses') {
        const infoPoin = json.nilai_poin ? ` (${json.nilai_poin > 0 ? '+' : ''}${json.nilai_poin} poin)` : '';
        ui.notif('sukses', `Absen Pulang berhasil!${infoPoin}`);
        setTodayAbsensi(prev => ({ ...prev, jam_pulang: nowLocalStr }));
        ambilTugasHariIni();
        if (tabelTerpilih === 'absensi') ambilDataTabel('absensi', true);
        if (tabelTerpilih === 'points') ambilDataTabel('points', true);
        fetchTotalPoin(); // Update tampilan poin di topbar
      } else {
        ui.notif('gagal', json.pesan || 'Absen pulang gagal.');
      }
    } catch (e) {
      ui.notif('gagal', 'Koneksi gagal saat absen pulang.');
    } finally {
      setAbsenLoading(false);
    }
  };



  const bukaModalEditEmail = () => {
    setNewEmail(profile?.email || '');
    ui.modal(
      'Ubah Email Anda',
      <div>
        <label className="form-label small fw-semibold">Alamat Email Baru</label>
        <input 
          type="email" 
          defaultValue={profile?.email || ''} 
          onChange={(e) => setNewEmail(e.target.value)}
          className="form-control input-premium" 
          placeholder="contoh@domain.com"
        />
      </div>,
      async () => {
        if (!newEmail) {
          throw new Error('Alamat email wajib diisi!');
        }
        // Simulasi update email (karena tidak ada endpoint update profil)
        setProfile((prev) => ({ ...prev, email: newEmail }));
        ui.notif('sukses', 'Email Anda berhasil diperbarui!');
      },
      'Simpan Email'
    );
  };





  const tanganiHapus = async (baris) => {
    let namaLabel = baris.id;
    if (tabelTerpilih === 'users') namaLabel = baris.nama;
    else if (tabelTerpilih === 'usaha') namaLabel = baris.nama_usaha;
    else if (tabelTerpilih === 'unit') namaLabel = baris.nama_unit;
    else if (tabelTerpilih === 'roles') namaLabel = baris.nama_role;
    else if (tabelTerpilih === 'menus') namaLabel = baris.label;
    else if (tabelTerpilih === 'role_permissions') {
      const namaRole = opsiRoles.find(u => u.id == baris.role_id)?.nama_role || baris.role_id;
      const namaMenu = opsiMenus.find(m => m.id == baris.menu_id)?.label || baris.menu_id;
      namaLabel = `Akses ${namaMenu} untuk ${namaRole}`;
    }
    else if (tabelTerpilih === 'user_role') {
      const namaUser = opsiUsers.find(u => u.id == baris.user_id)?.nama || baris.user_id;
      const namaRole = opsiRoles.find(u => u.id == baris.role_id)?.nama_role || baris.role_id;
      namaLabel = `Peran ${namaRole} untuk ${namaUser}`;
    }
    else if (tabelTerpilih === 'iot') namaLabel = baris.nama_perangkat;

    const setuju = await ui.notif('konfirmasi', `Apakah Anda yakin ingin menghapus data "${namaLabel}"?`);
    if (!setuju) return;

    const id = baris.id;

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/hapus/${tabelTerpilih}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', 'Data berhasil dihapus!');
        await ambilDataTabel(tabelTerpilih, true); // Ambil ulang data
        if (['menus', 'user_role', 'roles', 'role_permissions'].includes(tabelTerpilih)) {
          await fetchProfile(); 
        }
      } else {
        ui.notif('gagal', res.pesan || 'Gagal menghapus data.');
      }
    } catch (err) {
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const tanganiSimpan = async (dataForm) => {
    const isEdit = dataForm.id !== undefined;
    let url = isEdit 
      ? `http://localhost:8080/api/manajemen/ubah/${tabelTerpilih}/${dataForm.id}` 
      : `http://localhost:8080/api/manajemen/tambah/${tabelTerpilih}`;
    let method = isEdit ? 'PUT' : 'POST';
    const token = localStorage.getItem('token');
    
    let headers = { 'Authorization': `Bearer ${token}` };
    let bodyPayload;

    if (tabelTerpilih === 'perizinan') {
      const statusSaatIni = dataForm.status;
      const roleUser = profile?.role?.toLowerCase();
      const isEvaluasiAtasan = isEdit 
        && ['root', 'owner', 'supervisor'].includes(roleUser) 
        && statusSaatIni === 'menunggu_persetujuan';

      if (isEvaluasiAtasan) {
        url = `http://localhost:8080/api/perizinan/evaluasi-atasan`;
        method = 'POST';
        headers['Content-Type'] = 'application/json';
        
        const rawApproved = dataForm.shift_id_disetujui !== undefined
          ? dataForm.shift_id_disetujui
          : dataForm.shift_id_izin;
        
        const shiftIdsDisetujui = typeof rawApproved === 'string'
          ? rawApproved.split(',').map(Number).filter(Boolean)
          : (Array.isArray(rawApproved) ? rawApproved.map(Number) : []);

        bodyPayload = JSON.stringify({
          id: dataForm.id,
          status: dataForm.status,
          catatan_atasan: dataForm.catatan_atasan,
          shift_id_disetujui: shiftIdsDisetujui
        });
      } else {
        url = isEdit 
          ? `http://localhost:8080/api/manajemen/ubah/perizinan/${dataForm.id}` 
          : `http://localhost:8080/api/perizinan/ajukan`;
        method = 'POST';
        const formData = new FormData();
        Object.keys(dataForm).forEach(key => {
          if (dataForm[key] !== null && dataForm[key] !== undefined) {
            if (key === 'shift_id_izin' && Array.isArray(dataForm[key])) {
              formData.append(key, dataForm[key].join(','));
            } else if (key === 'shift_id_disetujui' && Array.isArray(dataForm[key])) {
              formData.append(key, dataForm[key].join(','));
            } else {
              formData.append(key, dataForm[key]);
            }
          }
        });
        if (isEdit) {
          formData.append('_method', 'PUT');
        }
        bodyPayload = formData;
      }
    } else {
      headers['Content-Type'] = 'application/json';
      bodyPayload = JSON.stringify(dataForm);
    }
    
    ui.loading(true, 'fullscreen', 'Menyimpan data...');
    try {
      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: bodyPayload
      });
      
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', isEdit ? 'Data berhasil diperbarui!' : 'Data berhasil ditambahkan!');
        tutupModalForm();
        if (tabelTerpilih === 'perizinan') {
          await ambilRiwayatPerizinan();
        } else {
          await ambilDataTabel(tabelTerpilih, true);
        }
        await fetchGlobalOptions();
        if (['menus', 'user_role', 'roles', 'role_permissions'].includes(tabelTerpilih)) {
          await fetchProfile();
        }
      } else {
        // Tampilkan daftar error dengan cerdas
        let pesanError = 'Gagal menyimpan data.';
        if (res.errors && typeof res.errors === 'object') {
            pesanError = Object.values(res.errors).join(', ');
        } else if (res.messages) {
            if (typeof res.messages === 'object') {
                pesanError = Object.values(res.messages).join('\n');
            } else {
                pesanError = String(res.messages);
            }
        } else if (res.pesan) {
            pesanError = res.pesan;
        }
        ui.notif('gagal', pesanError);
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat menyimpan data.');
    } finally {
      ui.tutupLoading();
    }
  };

  const bukaModalForm = (dataSblm = null, targetTabel = tabelTerpilih) => {
    const isEdit = dataSblm !== null;
    let nilaiAwal = {};

    if (isEdit) {
      if (targetTabel === 'users') {
        const { password, ...tanpaPassword } = dataSblm;
        nilaiAwal = { ...tanpaPassword, password: '' };
      } else {
        nilaiAwal = { ...dataSblm };
      }
    } else {
      if (targetTabel === 'users') {
        nilaiAwal = { nama: '', wa: '', email: '', password: '' };
      } else if (targetTabel === 'usaha') {
        nilaiAwal = { nama_usaha: '', alamat: '', tanggal_berdiri: '', no_izin: '', latitude: '', longitude: '', radius_absen: '100' };
      } else if (targetTabel === 'unit') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', nama_unit: '' };
      } else if (targetTabel === 'roles') {
        nilaiAwal = { nama_role: '', deskripsi: '' };
      } else if (targetTabel === 'user_role') {
        nilaiAwal = { user_id: '', usaha_id: profile?.usaha_id || '', unit_id: '', role_id: '' };
      } else if (targetTabel === 'menus') {
        nilaiAwal = { label: '', icon: '', url: '', tabel: '', urutan: '0', is_aktif: '1' };
      } else if (targetTabel === 'role_permissions') {
        nilaiAwal = { role_id: '', menu_id: '', can_read: '0', can_create: '0', can_update: '0', can_delete: '0' };
      } else if (targetTabel === 'iot') {
        nilaiAwal = { nama_perangkat: '', mac_address: '', tipe_perangkat: 'saklar_umum', ip_address: '', is_aktif: '1' };
      } else if (targetTabel === 'iot_alokasi') {
        nilaiAwal = { iot_id: '', usaha_id: profile?.usaha_id || '', unit_id: '', status_relay: '0', status_penggunaan: 'tersedia', transaksi_aktif_id: '', is_aktif: '0' };
      } else if (targetTabel === 'shift') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', nama_shift: '', jam_mulai: '08:00', jam_selesai: '17:00', toleransi_sebelum: 0, toleransi_terlambat: 0 };
      } else if (targetTabel === 'jadwal_karyawan') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', karyawan_id: '', shift_id: '', hari: '' };
      } else if (targetTabel === 'absensi') {
        const nowLocalStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16);
        nilaiAwal = { jadwal_karyawan_id: '', karyawan_id: '', jam_masuk: nowLocalStr, jam_pulang: '', status_kehadiran: 'tepat_waktu' };
      } else if (targetTabel === 'kriteria_poin') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', nama_kriteria: '', nilai_poin: 0, is_otomatis: 0, kode_sistem: '' };
      } else if (targetTabel === 'points') {
        const today = new Date().toISOString().substring(0, 10);
        nilaiAwal = { karyawan_id: '', jumlah_poin: 0, sumber: 'penilaian_supervisor', referensi_id: '', pemberi_poin_id: profile?.id || '', keterangan: '', tanggal: today };
      } else if (targetTabel === 'perizinan') {
        const today = new Date().toISOString().substring(0, 10);
        nilaiAwal = { 
          karyawan_id: profile?.user_id || '', 
          jenis_izin: 'izin', 
          tanggal: today, 
          alasan: '', 
          dokumen_bukti: '', 
          status: 'menunggu_persetujuan', 
          disetujui_oleh: '', 
          catatan_atasan: '' 
        };
      }
    }

    setModalFormState({
      title: isEdit ? `Edit Data ${(targetTabel || '').replace('_', ' ').toUpperCase()}` : `Tambah Data ${(targetTabel || '').replace('_', ' ').toUpperCase()}`,
      tabel: targetTabel,
      isEdit,
      nilaiAwal
    });
  };

  const toggleRelay = async (baris) => {
    const statusBaru = baris.status_relay == 1 ? '0' : '1';
    ui.loading(true, 'fullscreen', 'Mengubah status relay...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/manajemen/ubah/${tabelTerpilih}/${baris.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...baris, status_relay: statusBaru })
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', `Relay berhasil diubah menjadi ${statusBaru === '1' ? 'ON' : 'OFF'}.`);
        ambilDataTabel(tabelTerpilih);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal mengubah relay.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat mengubah relay.');
    } finally {
      ui.tutupLoading();
    }
  };

  const tanganiToggleIzin = async (baris, field) => {
    // Proteksi root
    const namaRole = opsiRoles.find(u => u.id == baris.role_id)?.nama_role || '';
    if (String(namaRole).toLowerCase() === 'root') {
      ui.notif('gagal', "Hak akses 'root' dilindungi dan tidak boleh diubah secara manual.");
      return;
    }

    const idField = `${baris.id}-${field}`;
    setLoadingIzin(idField);
    const nilaiBaru = baris[field] == 1 ? 0 : 1;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/manajemen/ubah/role_permissions/${baris.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...baris, [field]: nilaiBaru })
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        const actionName = nilaiBaru === 1 ? 'diberikan' : 'dicabut';
        const fieldName = field.replace('can_', '').toUpperCase();
        ui.notif('sukses', `Izin ${fieldName} berhasil ${actionName}.`);
        await ambilDataTabel(tabelTerpilih, true); // silent reload
        fetchProfile(); // Update sidebar jika hak akses menu berubah
      } else {
        ui.notif('gagal', res.pesan || 'Gagal mengubah izin.');
      }
    } catch (err) {
      ui.notif('gagal', 'Koneksi gagal saat mengubah izin.');
    } finally {
      setLoadingIzin(null);
    }
  };

  const dapatkanKolomTabel = (tabel) => {
    if (tabel === 'users') {
      return ['No.', 'Nama', 'WA', 'Email', 'Aksi'];
    } else if (tabel === 'usaha') {
      return ['No.', 'Nama Usaha', 'Alamat', 'Tgl Berdiri', 'No Izin', 'Lokasi', 'Radius', 'Aksi'];
    } else if (tabel === 'unit') {
      return ['No.', 'Usaha Induk', 'Nama Unit', 'Aksi'];
    } else if (tabel === 'roles') {
      return ['No.', 'Nama Role', 'Keterangan', 'Aksi'];
    } else if (tabel === 'user_role') {
      return ['No.', 'User', 'Usaha', 'Unit', 'Role', 'Aksi'];
    } else if (tabel === 'menus') {
      return ['No.', 'Urutan', 'Label', 'Grup', 'Icon', 'URL', 'Tabel Terkait', 'Status', 'Aksi'];
    } else if (tabel === 'role_permissions') {
      return ['No.', 'Role', 'Menu', 'Read', 'Create', 'Update', 'Delete', 'Aktif', 'Aksi'];
    } else if (tabel === 'iot') {
      return ['No.', 'Nama Perangkat', 'MAC Address', 'Tipe', 'IP Address', 'Status', 'Aksi'];
    } else if (tabel === 'iot_alokasi') {
      return ['No.', 'Perangkat IoT', 'Usaha', 'Unit Cabang', 'Relay', 'Penggunaan', 'Status Alokasi', 'Aksi'];
    } else if (tabel === 'shift') {
      return ['No.', 'Nama Shift', 'Usaha', 'Jam Mulai', 'Jam Selesai', 'Toleransi Sebelum', 'Toleransi Terlambat', 'Aksi'];
    } else if (tabel === 'jadwal_karyawan') {
      return ['No.', 'Karyawan', 'Shift', 'Tanggal', 'Tipe', 'Jam Mulai', 'Jam Selesai', 'Di-cover Oleh', 'Aksi'];
    } else if (tabel === 'absensi') {
      return ['No.', 'Karyawan', 'Shift', 'Batas Kerja', 'Masuk Aktual', 'Pulang Aktual', 'Status Kehadiran', 'Cabang', 'Aksi'];
    } else if (tabel === 'kriteria_poin') {
      return ['No.', 'Nama Kriteria', 'Nilai Poin', 'Sifat', 'Kode Sistem', 'Usaha', 'Aksi'];
    } else if (tabel === 'points') {
      return ['No.', 'Karyawan', 'Jumlah Poin', 'Sumber', 'Atasan Penilai', 'Keterangan', 'Tanggal', 'Cabang', 'Aksi'];
    } else if (tabel === 'perizinan') {
      return ['No.', 'Karyawan', 'Karyawan Pengganti', 'Jenis Izin', 'Tanggal', 'Alasan', 'Status', 'Catatan / Penyetuju', 'Cabang', 'Aksi'];
    } else if (tabel === 'kebersihan') {
      return ['No.', 'Nama Area', 'Jam Mulai', 'Jam Selesai', 'Cabang', 'Aksi'];
    } else if (tabel === 'kebersihan_tugas') {
      return ['No.', 'Nama Area', 'Tanggal Bisnis', 'Petugas', 'Status', 'Atasan Verifikasi', 'Diverifikasi Pada', 'Cabang', 'Aksi'];
    }
    return [];
  };

  const tanganiLihatBukti = async (namaFile) => {
    if (!namaFile) return;
    const token = localStorage.getItem('token');
    ui.loading(true, 'fullscreen', 'Mengambil berkas bukti secara aman...');
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/ambil-bukti/perizinan/${namaFile}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      ui.loading(false);
      if (response.ok) {
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        window.open(localUrl, '_blank');
      } else {
        const res = await response.json();
        ui.notif('gagal', res.pesan || 'Gagal membuka berkas bukti.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Koneksi gagal saat mengunduh berkas.');
    }
  };

  const tanganiKeputusanPengganti = async (baris, keputusan) => {
    const aksiLabel = keputusan === 'setuju' ? 'menerima tugas pengganti' : 'menolak tugas pengganti';
    const setuju = await ui.notif('konfirmasi', `Apakah Anda yakin ingin ${aksiLabel} untuk ${baris.nama_karyawan}?`);
    if (!setuju) return;

    const statusBaru = keputusan === 'setuju' ? 'menunggu_persetujuan' : 'ditolak_pengganti';
    const payload = {
      id: baris.id,
      karyawan_id: baris.karyawan_id,
      karyawan_pengganti_id: baris.karyawan_pengganti_id,
      jenis_izin: baris.jenis_izin,
      tanggal: baris.tanggal,
      alasan: baris.alasan,
      status: statusBaru
    };

    const token = localStorage.getItem('token');
    ui.loading(true, 'fullscreen', 'Memproses keputusan Anda...');
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/ubah/perizinan/${baris.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', `Keputusan Anda berhasil disimpan!`);
        await ambilDataTabel('perizinan', true);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal menyimpan keputusan.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const tanganiBypassKeAtasan = async (baris) => {
    const setuju = await ui.notif('konfirmasi', 'Karyawan pengganti telah menolak. Apakah Anda ingin mengajukan izin ini langsung ke Supervisor/Atasan tanpa pengganti?');
    if (!setuju) return;

    const token = localStorage.getItem('token');
    ui.loading(true, 'fullscreen', 'Mengajukan langsung ke atasan...');
    try {
      const response = await fetch(`http://localhost:8080/api/manajemen/ubah/perizinan/${baris.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: baris.id,
          karyawan_id: baris.karyawan_id,
          karyawan_pengganti_id: '',
          jenis_izin: baris.jenis_izin,
          tanggal: baris.tanggal,
          alasan: baris.alasan,
          status: 'menunggu_persetujuan'
        })
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', 'Permohonan berhasil diajukan langsung ke atasan!');
        await ambilDataTabel('perizinan', true);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal mengajukan ke atasan.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const renderSelTabel = (tabel, baris, index) => {
    const noUrut = index + 1;
    if (tabel === 'users') {
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold">{baris.nama}</td>
          <td>{baris.wa}</td>
          <td>{baris.email || <span className="text-muted small">Belum diatur</span>}</td>
        </>
      );
    } else if (tabel === 'usaha') {
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold">{baris.nama_usaha}</td>
          <td style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{baris.alamat || <span className="text-muted">-</span>}</td>
          <td>{baris.tanggal_berdiri || <span className="text-muted">-</span>}</td>
          <td>{baris.no_izin || <span className="text-muted">-</span>}</td>
          <td>
            {baris.latitude && baris.longitude
              ? <span style={{ fontSize: '0.58rem' }}>{parseFloat(baris.latitude).toFixed(4)}, {parseFloat(baris.longitude).toFixed(4)}</span>
              : <span className="text-muted">-</span>}
          </td>
          <td>{baris.radius_absen ? `${baris.radius_absen}m` : <span className="text-muted">-</span>}</td>
        </>
      );
    } else if (tabel === 'unit') {
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      return (
        <>
          <td>{noUrut}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td className="fw-bold">{baris.nama_unit}</td>
        </>
      );
    } else if (tabel === 'roles') {
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold"><span className="badge bg-primary">{baris.nama_role}</span></td>
          <td>{baris.deskripsi || <span className="text-muted small">-</span>}</td>
        </>
      );
    } else if (tabel === 'user_role') {
      const namaUser = opsiUsers.find(u => u.id == baris.user_id)?.nama || baris.user_id;
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      const namaUnit = baris.unit_id ? (opsiUnit.find(u => u.id == baris.unit_id)?.nama_unit || baris.unit_id) : 'Global';
      const namaRole = opsiRoles.find(u => u.id == baris.role_id)?.nama_role || baris.role_id;
      return (
        <>
          <td>{noUrut}</td>
          <td><span className="badge bg-dark">{namaUser}</span></td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td><span className="badge bg-light text-dark">{namaUnit}</span></td>
          <td><span className="badge bg-primary">{namaRole}</span></td>
        </>
      );
    } else if (tabel === 'menus') {
      return (
        <>
          <td>
            <div className="d-flex align-items-center gap-1">
              <span className="text-muted cursor-grab" style={{ cursor: 'grab' }}><GripVertical size={13} /></span>
              {noUrut}
            </div>
          </td>
          <td><span className="badge bg-dark fw-normal">{baris.urutan}</span></td>
          <td className="fw-bold">{baris.label}</td>
          <td><span className="badge bg-secondary">{baris.grup || 'Lainnya'}</span></td>
          <td>{baris.icon}</td>
          <td><code>/{baris.url}</code></td>
          <td>{baris.tabel || '-'}</td>
          <td>{baris.is_aktif == 1 ? <span className="badge bg-success">Aktif</span> : <span className="badge bg-danger">Nonaktif</span>}</td>
        </>
      );
    } else if (tabel === 'role_permissions') {
      const namaRole = opsiRoles.find(u => u.id == baris.role_id)?.nama_role || baris.role_id;
      const namaMenu = opsiMenus.find(m => m.id == baris.menu_id)?.label || baris.menu_id;
      
      const renderIzinCell = (field) => {
        if (loadingIzin === `${baris.id}-${field}`) {
          return (
            <td>
              <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
            </td>
          );
        }
        return (
          <td onClick={() => tanganiToggleIzin(baris, field)} style={{ cursor: 'pointer', transition: 'transform 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            {baris[field] == 1 ? <span className="badge bg-success">✔</span> : <span className="badge bg-danger">✖</span>}
          </td>
        );
      };

      return (
        <>
          <td>{noUrut}</td>
          <td><span className="badge bg-primary">{namaRole}</span></td>
          <td className="fw-bold">{namaMenu}</td>
          {renderIzinCell('can_read')}
          {renderIzinCell('can_create')}
          {renderIzinCell('can_update')}
          {renderIzinCell('can_delete')}
          {renderIzinCell('is_aktif')}
        </>
      );
    } else if (tabel === 'iot') {
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold">{baris.nama_perangkat}</td>
          <td><code>{baris.mac_address || '-'}</code></td>
          <td><span className="badge bg-info text-dark">{baris.tipe_perangkat}</span></td>
          <td><code>{baris.ip_address || '-'}</code></td>
          <td>{baris.is_aktif == 1 ? <span className="text-success fw-bold">✓</span> : <span className="text-danger fw-bold">✗</span>}</td>
        </>
      );
    } else if (tabel === 'iot_alokasi') {
      const iotDevice = opsiIot.find(i => i.id == baris.iot_id);
      const namaPerangkat = iotDevice
        ? (profile?.usaha_id ? iotDevice.nama_perangkat : `${iotDevice.nama_perangkat} [${iotDevice.mac_address || '-'}]`)
        : (baris.nama_perangkat || baris.iot_id);
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      const namaUnit = opsiUnit.find(u => u.id == baris.unit_id)?.nama_unit || <span className="text-muted small">Global Usaha</span>;

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold">{namaPerangkat}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td><span className="badge bg-light text-dark">{namaUnit}</span></td>
          <td>
            {baris.status_relay == 1 
              ? <span className="badge bg-warning text-dark" style={{ cursor: 'pointer' }} onClick={() => toggleRelay(baris)}>ON</span> 
              : <span className="badge bg-secondary" style={{ cursor: 'pointer' }} onClick={() => toggleRelay(baris)}>OFF</span>}
          </td>
          <td>
            {baris.status_penggunaan === 'dipakai' ? <span className="badge bg-danger">Dipakai</span> : 
             baris.status_penggunaan === 'tersedia' ? <span className="badge bg-success">Tersedia</span> : <span className="badge bg-dark">Gangguan</span>}
          </td>
          <td>{baris.is_aktif == 1 ? <span className="badge bg-success">Aktif</span> : <span className="badge bg-danger">Nonaktif</span>}</td>
        </>
      );
    } else if (tabel === 'shift') {
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      const formatJam = (j) => j ? j.substring(0, 5) : '-'; // format "HH:MM:SS" -> "HH:MM"
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{baris.nama_shift}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td><code className="text-main">{formatJam(baris.jam_mulai)}</code></td>
          <td><code className="text-main">{formatJam(baris.jam_selesai)}</code></td>
          <td><span className="small text-main">{baris.toleransi_sebelum ? `${baris.toleransi_sebelum} Menit` : '-'}</span></td>
          <td><span className="small text-main">{baris.toleransi_terlambat ? `${baris.toleransi_terlambat} Menit` : '-'}</span></td>
        </>
      );
    } else if (tabel === 'jadwal_karyawan') {
      const formatJam = (j) => j ? j.substring(0, 5) : '-';
      const formatTgl = (t) => {
        if (!t) return '-';
        const d = new Date(t);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      };
      
      const karyawanObj = opsiUsers.find(u => u.id == baris.karyawan_id);
      const namaKaryawan = karyawanObj ? karyawanObj.nama : (baris.nama_karyawan || `User #${baris.karyawan_id}`);
      
      const originalKaryawanObj = opsiUsers.find(u => u.id == baris.original_karyawan_id);
      const namaOriginal = originalKaryawanObj ? originalKaryawanObj.nama : (baris.nama_original || '-');
      
      const shiftObj = opsiShift.find(s => s.id == baris.shift_id);
      const namaShift = shiftObj ? shiftObj.nama_shift : (baris.nama_shift || '-');
      
      // Jam kerja diambil dari target shift, atau kolom jam jika itu lembur mandiri
      const jamMulai = baris.is_lembur == 1 && baris.jam_mulai ? baris.jam_mulai : (shiftObj ? shiftObj.jam_mulai : '-');
      const jamSelesai = baris.is_lembur == 1 && baris.jam_selesai ? baris.jam_selesai : (shiftObj ? shiftObj.jam_selesai : '-');

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{namaKaryawan}</td>
          <td><span className="badge bg-light text-dark">{namaShift}</span></td>
          <td><code>{formatTgl(baris.tanggal)}</code></td>
          <td>
            {baris.is_lembur == 1 
              ? <span className="badge bg-warning text-dark">Lembur</span> 
              : <span className="badge bg-success">Shift Kerja</span>}
          </td>
          <td><code className="text-main">{formatJam(jamMulai)}</code></td>
          <td><code className="text-main">{formatJam(jamSelesai)}</code></td>
          <td>
            {baris.original_karyawan_id 
              ? <span className="small text-danger fw-bold">{namaOriginal}</span> 
              : <span className="text-muted small">-</span>}
          </td>
        </>
      );
    } else if (tabel === 'absensi') {
      const formatWaktu = (dt) => {
        if (!dt) return '-';
        const d = new Date(dt);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      };
      
      const karyawanObj = opsiUsers.find(u => u.id == baris.karyawan_id);
      const namaKaryawan = karyawanObj ? karyawanObj.nama : (baris.nama_karyawan || `Karyawan #${baris.karyawan_id}`);
      
      const shiftNama = baris.nama_shift || '-';
      const batasKerja = baris.shift_jam_mulai && baris.shift_jam_selesai 
        ? `${baris.shift_jam_mulai.substring(0, 5)} - ${baris.shift_jam_selesai.substring(0, 5)}`
        : '-';

      const statusMap = {
        tepat_waktu: { label: 'Tepat Waktu', cls: 'bg-success' },
        lebih_awal: { label: 'Lebih Awal', cls: 'bg-info text-dark' },
        terlambat_toleransi: { label: 'Terlambat Toleransi', cls: 'bg-warning text-dark' },
        terlambat: { label: 'Terlambat', cls: 'bg-danger' },
        izin: { label: 'Izin', cls: 'bg-secondary' },
        sakit: { label: 'Sakit', cls: 'bg-secondary' },
        alpha: { label: 'Alpha', cls: 'bg-dark' }
      };
      const statusConfig = statusMap[baris.status_kehadiran] || { label: baris.status_kehadiran, cls: 'bg-secondary' };

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{namaKaryawan}</td>
          <td><span className="badge bg-light text-dark">{shiftNama}</span></td>
          <td><code>{batasKerja}</code></td>
          <td><code>{formatWaktu(baris.jam_masuk)}</code></td>
          <td><code>{formatWaktu(baris.jam_pulang)}</code></td>
          <td><span className={`badge ${statusConfig.cls}`}>{statusConfig.label}</span></td>
          <td><span className="badge bg-secondary">{baris.nama_usaha || '-'}</span></td>
        </>
      );
    } else if (tabel === 'kriteria_poin') {
      const isOto = baris.is_otomatis == 1;
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{baris.nama_kriteria}</td>
          <td>
            <span className={`fw-bold ${baris.nilai_poin >= 0 ? 'text-success' : 'text-danger'}`}>
              {baris.nilai_poin >= 0 ? `+${baris.nilai_poin}` : baris.nilai_poin} Poin
            </span>
          </td>
          <td>
            {isOto 
              ? <span className="badge bg-primary">Otomatis Sistem</span> 
              : <span className="badge bg-secondary">Manual Atasan</span>}
          </td>
          <td><code>{baris.kode_sistem || '-'}</code></td>
          <td><span className="badge bg-secondary">{baris.nama_usaha || '-'}</span></td>
        </>
      );
    } else if (tabel === 'points') {
      const formatTgl = (t) => {
        if (!t) return '-';
        const d = new Date(t);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      const karyawanObj = opsiUsers.find(u => u.id == baris.karyawan_id);
      const namaKaryawan = karyawanObj ? karyawanObj.nama : (baris.nama_karyawan || `Karyawan #${baris.karyawan_id}`);
      
      const pemberiObj = opsiUsers.find(u => u.id == baris.pemberi_poin_id);
      const namaPemberi = pemberiObj ? pemberiObj.nama : (baris.nama_pemberi_poin || '-');

      const sumberMap = {
        absensi: { label: 'Kehadiran / Absen', cls: 'bg-success' },
        tugas_tambahan: { label: 'Tugas Tambahan', cls: 'bg-primary' },
        penilaian_supervisor: { label: 'Penilaian Atasan', cls: 'bg-warning text-dark' },
        saldo_awal: { label: 'Saldo Awal Bulanan', cls: 'bg-info text-dark' }
      };
      const sumberConfig = sumberMap[baris.sumber] || { label: baris.sumber, cls: 'bg-secondary' };

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{namaKaryawan}</td>
          <td>
            <span className={`fw-bold ${baris.jumlah_poin >= 0 ? 'text-success' : 'text-danger'}`}>
              {baris.jumlah_poin >= 0 ? `+${baris.jumlah_poin}` : baris.jumlah_poin}
            </span>
          </td>
          <td><span className={`badge ${sumberConfig.cls}`}>{sumberConfig.label}</span></td>
          <td><span className="small text-main">{namaPemberi}</span></td>
          <td className="small text-muted">{baris.keterangan}</td>
          <td><code>{formatTgl(baris.tanggal)}</code></td>
          <td><span className="badge bg-secondary">{baris.nama_usaha || '-'}</span></td>
        </>
      );
    } else if (tabel === 'perizinan') {
      const formatTgl = (t) => {
        if (!t) return '-';
        const d = new Date(t);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      const karyawanObj = opsiUsers.find(u => u.id == baris.karyawan_id);
      const namaKaryawan = karyawanObj ? karyawanObj.nama : (baris.nama_karyawan || `Karyawan #${baris.karyawan_id}`);
      
      const penggantiObj = opsiUsers.find(u => u.id == baris.karyawan_pengganti_id);
      const namaPengganti = penggantiObj ? penggantiObj.nama : (baris.nama_pengganti || '-');

      const penyetujuObj = opsiUsers.find(u => u.id == baris.disetujui_oleh);
      const namaPenyetuju = penyetujuObj ? penyetujuObj.nama : (baris.nama_penyetuju || '-');

      const badgeJenis = baris.jenis_izin === 'sakit' 
        ? <span className="badge bg-warning text-dark">🤕 Sakit</span>
        : <span className="badge bg-info">📝 Izin</span>;

      const badgeStatus = {
        menunggu_pengganti: <span className="badge bg-warning text-dark">⏳ Menunggu Pengganti</span>,
        ditolak_pengganti: <span className="badge bg-danger">✕ Ditolak Pengganti</span>,
        menunggu_persetujuan: <span className="badge bg-info text-dark">⏱️ Menunggu Atasan</span>,
        disetujui: <span className="badge bg-success">✓ Disetujui</span>,
        ditolak: <span className="badge bg-danger">✕ Ditolak Atasan</span>
      }[baris.status] || <span className="badge bg-secondary">{baris.status}</span>;

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{namaKaryawan}</td>
          <td><span className="small text-main">{namaPengganti}</span></td>
          <td>{badgeJenis}</td>
          <td>
            <code className="d-none d-sm-inline">{formatTanggal(baris.tanggal, 'sedang')}</code>
            <code className="d-inline d-sm-none">{formatTanggal(baris.tanggal, 'singkat')}</code>
          </td>
          <td>
            <div className="small text-muted" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={baris.alasan}>
              {baris.alasan}
            </div>
            {baris.dokumen_bukti && (
              <span 
                onClick={() => tanganiLihatBukti(baris.dokumen_bukti)} 
                style={{ cursor: 'pointer', textDecoration: 'underline' }} 
                className="text-primary small fw-semibold d-inline-block mt-1"
              >
                📎 Lihat Bukti
              </span>
            )}
          </td>
          <td>{badgeStatus}</td>
          <td>
            {!['menunggu_pengganti', 'menunggu_persetujuan'].includes(baris.status) ? (
              <div className="small">
                <span className="fw-semibold text-main">{namaPenyetuju}</span>
                {baris.catatan_atasan && <div className="text-muted italic">"{baris.catatan_atasan}"</div>}
              </div>
            ) : <span className="text-muted small">-</span>}
          </td>
          <td><span className="badge bg-secondary">{baris.nama_usaha || '-'}</span></td>
        </>
      );
    } else if (tabel === 'kebersihan') {
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{baris.nama_area}</td>
          <td><code>{baris.jam_mulai.substring(0, 5)}</code></td>
          <td><code>{baris.jam_selesai.substring(0, 5)}</code></td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
        </>
      );
    } else if (tabel === 'kebersihan_tugas') {
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      const namaKaryawan = baris.nama_karyawan || baris.nama_ditunjuk || <span className="text-muted italic">Belum ada</span>;
      const statusWarna = {
        belum_dibersihkan: 'warning',
        menunggu_verifikasi: 'info',
        selesai: 'success',
        tidak_bersih: 'danger'
      }[baris.status] || 'secondary';

      const statusTeks = {
        belum_dibersihkan: 'Belum Dibersihkan',
        menunggu_verifikasi: 'Menunggu Verifikasi',
        selesai: 'Selesai (Bersih)',
        tidak_bersih: 'Tidak Bersih (Kotor)'
      }[baris.status] || baris.status;

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{baris.nama_area}</td>
          <td><code>{formatTanggal(baris.tanggal, 'sedang')}</code></td>
          <td><span className="text-main">{namaKaryawan}</span></td>
          <td>
            <span className={`badge bg-${statusWarna} text-capitalize`}>{statusTeks}</span>
          </td>
          <td><span className="text-main">{baris.nama_penyetuju || <span className="text-muted">-</span>}</span></td>
          <td><code>{baris.waktu_diverifikasi ? formatTanggal(baris.waktu_diverifikasi, 'lengkap') : '-'}</code></td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
        </>
      );
    }
  };

  if (loadingProfile) {
    return (
      <div className="container min-vh-100 d-flex align-items-center justify-content-center">
        <LazyLoading pesan="Memuat data profil dan sesi Anda..." />
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--bg-halaman)', color: 'var(--warna-teks-utama)', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <header className="topbar-premium d-flex align-items-center justify-content-between px-3">
        <div className="d-flex align-items-center gap-2">
          {/* Sidebar Toggle Button (Desktop Only) */}
          <button 
            onClick={() => setSidebarTerbuka(!sidebarTerbuka)} 
            className="btn-ikon-premium d-none d-sm-inline-flex border-0"
            style={{ width: '34px', height: '34px' }}
            title={sidebarTerbuka ? "Sembunyikan Menu" : "Tampilkan Menu"}
          >
            <Menu size={18} />
          </button>
          
          <div className="d-inline-flex p-2 rounded-2" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
            <Layers size={18} style={{ color: 'var(--warna-utama)' }} />
          </div>
          <h3 className="fw-bold mb-0 teks-pelangi judul-dashboard-bkw">BKW</h3>
        </div>
        
        <div className="d-flex align-items-center gap-2">
        {(() => {
          // Helper untuk label periode
          const namaBulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
          const labelPeriode = filterPoin.mode === 'bulan'
            ? `${namaBulan[filterPoin.bulan - 1]} ${filterPoin.tahun}`
            : filterPoin.mode === 'tahun' ? `${filterPoin.tahun}` : 'Semua';

          const chipStyle = (isMobile) => ({
            background: totalPoin >= 0 ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${totalPoin >= 0 ? 'rgba(99,102,241,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '20px',
            padding: isMobile ? '3px 8px' : '3px 10px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            animation: poinAnimasi ? 'poinPulse 0.6s ease 2' : 'none',
            userSelect: 'none',
            position: 'relative',
          });

          const gantiFilterPoin = () => {
            const modes = ['bulan', 'tahun', 'semua'];
            const idx = modes.indexOf(filterPoin.mode);
            const next = modes[(idx + 1) % modes.length];
            const newFilter = { ...filterPoin, mode: next };
            setFilterPoin(newFilter);
            fetchTotalPoin(newFilter);
          };

          const poinDisplay = totalPoin !== null ? (
            <>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: totalPoin >= 0 ? 'var(--warna-utama)' : 'var(--warna-bahaya)', fontFamily: 'monospace' }}>
                {totalPoin >= 0 ? '⭐' : '⚠️'} {totalPoin > 0 ? '+' : ''}{totalPoin}
              </span>
              <span style={{ fontSize: '0.58rem', color: 'var(--warna-teks-sekunder)', fontWeight: 500, lineHeight: 1 }}>
                poin<br/><span style={{ fontSize: '0.55rem', opacity: 0.7 }}>{labelPeriode}</span>
              </span>
            </>
          ) : null;

          return (
            <div className="position-relative d-flex align-items-center gap-1">
              {/* Chip Poin Mobile (Menggantikan Nama/Role) */}
              {totalPoin !== null && profile?.role !== 'member' && (
                <div
                  className="d-flex d-sm-none align-items-center gap-1"
                  style={chipStyle(true)}
                  onClick={() => setShowFilterPoin(!showFilterPoin)}
                  title={`Tap untuk ganti periode (${labelPeriode})`}
                >
                  {poinDisplay}
                </div>
              )}

              {/* Chip Poin Desktop */}
              {totalPoin !== null && profile?.role !== 'member' && (
                <div
                  className="d-none d-sm-flex align-items-center gap-1"
                  style={chipStyle(false)}
                  onClick={() => setShowFilterPoin(!showFilterPoin)}
                  title={`Klik untuk ganti periode (${labelPeriode})`}
                >
                  {poinDisplay}
                </div>
              )}

              {/* Dropdown Pemilih Periode Poin (Desktop & Mobile) */}
              {showFilterPoin && (
                <>
                  <div 
                    className="position-fixed top-0 start-0 w-100 h-100" 
                    style={{ zIndex: 9990, cursor: 'default' }} 
                    onClick={() => setShowFilterPoin(false)}
                  />
                  <div
                    className="position-absolute p-3 kartu-premium shadow-lg"
                    style={{
                      top: '42px',
                      right: '0px',
                      width: '220px',
                      zIndex: 9991,
                      animation: 'slideUpFade 0.2s ease forwards',
                      border: '1px solid var(--warna-border)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="fw-bold mb-2 text-main d-flex justify-content-between align-items-center" style={{ fontSize: '0.78rem' }}>
                      <span>Pilih Periode Poin</span>
                      <button 
                        onClick={() => setShowFilterPoin(false)} 
                        className="border-0 bg-transparent text-muted small fw-semibold"
                      >✕</button>
                    </div>
                    
                    {/* Pilihan Mode */}
                    <div className="d-flex flex-column gap-1 mb-2">
                      {['bulan', 'tahun', 'semua'].map(m => (
                        <button
                          key={m}
                          onClick={() => {
                            const nf = { ...filterPoin, mode: m };
                            setFilterPoin(nf);
                            fetchTotalPoin(nf);
                          }}
                          className={filterPoin.mode === m ? 'tombol-premium w-100' : 'tombol-sekunder-premium w-100'}
                          style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem', borderRadius: '6px', textAlign: 'center' }}
                        >
                          {m === 'bulan' ? 'Per Bulan' : m === 'tahun' ? 'Per Tahun' : 'Semua Waktu'}
                        </button>
                      ))}
                    </div>

                    {/* Form Input Detail */}
                    {filterPoin.mode === 'bulan' && (
                      <div className="d-flex gap-1 mt-2">
                        <select
                          className="form-select form-select-sm input-premium"
                          style={{ fontSize: '0.7rem', padding: '0.25rem' }}
                          value={filterPoin.bulan}
                          onChange={e => {
                            const nf = { ...filterPoin, bulan: parseInt(e.target.value) };
                            setFilterPoin(nf);
                            fetchTotalPoin(nf);
                          }}
                        >
                          {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'].map((b, i) => (
                            <option key={i} value={i + 1}>{b}</option>
                          ))}
                        </select>

                        <select
                          className="form-select form-select-sm input-premium"
                          style={{ fontSize: '0.7rem', padding: '0.25rem' }}
                          value={filterPoin.tahun}
                          onChange={e => {
                            const nf = { ...filterPoin, tahun: parseInt(e.target.value) };
                            setFilterPoin(nf);
                            fetchTotalPoin(nf);
                          }}
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {filterPoin.mode === 'tahun' && (
                      <div className="mt-2">
                        <select
                          className="form-select form-select-sm input-premium w-100"
                          style={{ fontSize: '0.7rem', padding: '0.25rem' }}
                          value={filterPoin.tahun}
                          onChange={e => {
                            const nf = { ...filterPoin, tahun: parseInt(e.target.value) };
                            setFilterPoin(nf);
                            fetchTotalPoin(nf);
                          }}
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {(profile?.punya_multi_peran || profile?.role?.toLowerCase() === 'root') && (
          <button
            onClick={handleGantiUsaha}
            className="btn-ikon-premium"
            style={{ width: '34px', height: '34px' }}
            title="Ganti Usaha"
          >
            <RefreshCw size={16} />
          </button>
        )}

        {profile?.role !== 'member' && (
          <button
            onClick={bukaAbsenModal}
            className="btn-ikon-premium d-none d-sm-flex text-white"
            style={{ width: '34px', height: '34px', backgroundColor: 'var(--warna-utama)', borderColor: 'var(--warna-utama)' }}
            title="Absensi"
          >
            <UserCheck size={16} />
          </button>
        )}
        {/* Lonceng Notifikasi Premium */}
        <div className="position-relative" ref={notifikasiDropdownRef}>
          <button
            onClick={() => setShowNotifikasiDropdown(!showNotifikasiDropdown)}
            className="btn-ikon-premium position-relative"
            style={{ width: '34px', height: '34px' }}
            title="Notifikasi"
          >
            <Bell size={16} />
            {daftarNotifikasi.filter(n => n.is_dibaca == 0).length > 0 && (
              <span 
                className="position-absolute translate-middle badge rounded-pill bg-danger"
                style={{ fontSize: '0.55rem', padding: '0.2rem 0.35rem', top: '5px', right: '-5px' }}
              >
                {daftarNotifikasi.filter(n => n.is_dibaca == 0).length}
              </span>
            )}
          </button>

          {showNotifikasiDropdown && (
            <div 
              className="position-absolute dropdown-menu-premium show p-0 shadow-lg border-0"
              style={{
                right: 0,
                top: '40px',
                width: '320px',
                zIndex: 1050,
                backgroundColor: 'var(--bg-kartu)',
                border: '1px solid var(--warna-border) !important',
                borderRadius: '12px',
                maxHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header Dropdown */}
              <div className="p-3 d-flex justify-content-between align-items-center border-bottom" style={{ borderColor: 'var(--warna-border)' }}>
                <span className="fw-semibold text-main" style={{ fontSize: '0.82rem' }}>Notifikasi</span>
                {daftarNotifikasi.filter(n => n.is_dibaca == 0).length > 0 && (
                  <button 
                    onClick={tandaiSemuaBaca}
                    className="border-0 bg-transparent text-main p-0 small text-decoration-none hover-opacity"
                    style={{ fontSize: '0.72rem', color: 'var(--warna-utama)' }}
                  >
                    Tandai semua dibaca
                  </button>
                )}
              </div>

              {/* List Notifikasi */}
              <div style={{ overflowY: 'auto', flex: 1, maxHeight: '300px' }}>
                {daftarNotifikasi.length === 0 ? (
                  <div className="p-4 text-center text-muted small">
                    Tidak ada notifikasi baru.
                  </div>
                ) : (
                  daftarNotifikasi.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        tandaiBacaNotifikasi(notif.id, notif.tautan);
                        setShowNotifikasiDropdown(false);
                      }}
                      className="p-3 border-bottom hover-bg cursor-pointer d-flex flex-column gap-1 position-relative"
                      style={{ 
                        borderColor: 'var(--warna-border)',
                        backgroundColor: notif.is_dibaca == 0 ? 'rgba(var(--warna-utama-rgb), 0.05)' : 'transparent',
                        borderLeft: notif.is_dibaca == 0 ? '3.5px solid var(--warna-utama)' : '3.5px solid transparent',
                        transition: 'all 0.2s ease',
                        paddingLeft: notif.is_dibaca == 0 ? '12.5px' : '16px'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span className={`small ${notif.is_dibaca == 0 ? 'fw-bold text-main' : 'text-muted'}`} style={{ fontSize: '0.78rem' }}>
                          {notif.judul}
                        </span>
                        <div className="d-flex align-items-center gap-2">
                          {notif.is_dibaca == 0 && (
                            <span 
                              className="rounded-circle animate-pulse" 
                              style={{ 
                                width: '6px', 
                                height: '6px', 
                                backgroundColor: 'var(--warna-utama)',
                                display: 'inline-block'
                              }}
                            />
                          )}
                          <span className="text-muted" style={{ fontSize: '0.62rem' }}>
                            {formatTanggal(notif.created_at, 'singkat')}
                          </span>
                        </div>
                      </div>
                      <span className={notif.is_dibaca == 0 ? 'text-main' : 'text-muted'} style={{ fontSize: '0.72rem', lineHeight: '1.25' }}>
                        {notif.pesan}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

          <button 
            onClick={toggleTheme} 
            className="btn-ikon-premium"
            style={{ width: '34px', height: '34px' }}
            title="Ubah Tema"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button 
            onClick={handleLogout} 
            className="btn-ikon-premium bahaya"
            style={{ width: '34px', height: '34px' }}
            title="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop Only) */}
      <aside className={`leftbar-premium ${sidebarTerbuka ? '' : 'hidden'} d-none d-sm-flex flex-column`}>
        <div className="flex-grow-1" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
          {/* Beranda */}
          <button 
            onClick={() => { setMenuAktif('beranda'); setOpenAccordion(null); }} 
            className={`menu-item-premium ${menuAktif === 'beranda' ? 'aktif' : ''}`}
          >
            {React.createElement(IconMap['Home'] || Home, { size: 18 })}
            <span>Beranda</span>
          </button>
          
          {menuGroups.map(grup => {
            const validMenus = grup.menus.filter(m => m.url !== 'beranda');
            if (validMenus.length === 0) return null;
            
            const IconComponent = IconMap[grup.icon] || HelpCircle;
            
            // Jika hanya 1 menu, tampilkan tanpa accordion
            if (validMenus.length === 1) {
              const singleMenu = validMenus[0];
              const isActive = menuAktif === singleMenu.url;
              const isNonaktif = singleMenu.rp_is_aktif == 0;
              return (
                <button 
                  key={grup.grup}
                  onClick={() => !isNonaktif && (setMenuAktif(singleMenu.url), setOpenAccordion(null))} 
                  className={`menu-item-premium w-100 mb-1 ${isActive ? 'aktif' : ''} ${isNonaktif ? 'text-muted' : ''}`}
                  style={{ opacity: isNonaktif ? 0.5 : 1, cursor: isNonaktif ? 'not-allowed' : 'pointer' }}
                  title={isNonaktif ? "Menu dinonaktifkan untuk peran ini" : ""}
                >
                  <IconComponent size={18} />
                  <span>{grup.label} {isNonaktif && <span className="badge bg-secondary ms-1" style={{ fontSize: '0.6rem' }}>Nonaktif</span>}</span>
                </button>
              );
            }
            
            const isOpen = openAccordion === grup.grup;
            const isGroupActive = validMenus.some(m => m.url === menuAktif);
            
            return (
              <div key={grup.grup} className="mb-1">
                <button 
                  onClick={() => setOpenAccordion(isOpen ? null : grup.grup)} 
                  className={`menu-item-premium d-flex justify-content-between align-items-center w-100 ${isGroupActive ? 'aktif-grup text-primary fw-bold' : ''}`}
                  style={{ opacity: isOpen ? 1 : 0.8, backgroundColor: isGroupActive ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <IconComponent size={18} />
                    <span>{grup.label}</span>
                  </div>
                  <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>
                
                {isOpen && (
                  <div className="ms-3 ps-2 mt-1 fade-in" style={{ borderLeft: '1px solid var(--warna-border)' }}>
                    {validMenus.map(menu => {
                      const MenuIcon = IconMap[menu.icon] || ChevronRight;
                      const isNonaktif = menu.rp_is_aktif == 0;
                      return (
                        <button
                          key={menu.url}
                          onClick={() => !isNonaktif && setMenuAktif(menu.url)}
                          className={`menu-item-premium w-100 mb-1 ${menuAktif === menu.url ? 'aktif' : ''} ${isNonaktif ? 'text-muted' : ''}`}
                          style={{ 
                            padding: '0.4rem 0.8rem', 
                            fontSize: '0.8rem', 
                            opacity: isNonaktif ? 0.5 : 1,
                            cursor: isNonaktif ? 'not-allowed' : 'pointer'
                          }}
                          title={isNonaktif ? "Menu dinonaktifkan untuk peran ini" : ""}
                        >
                          <MenuIcon size={14} />
                          <span>{menu.label} {isNonaktif && <span className="badge bg-secondary ms-1" style={{ fontSize: '0.6rem' }}>Nonaktif</span>}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Identitas Desktop (Bawah Sidebar) */}
        <div className="p-3 mt-auto" style={{ borderTop: '1px solid var(--warna-border)' }}>
          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center justify-content-center rounded-circle" style={{ width: '35px', height: '35px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--warna-utama)', minWidth: '35px' }}>
              <User size={18} />
            </div>
            {sidebarTerbuka && (
              <div className="d-flex flex-column" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <span className="fw-bold lh-1" style={{ fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden' }}>{profile?.nama || 'User'}</span>
                <span className="text-muted text-uppercase mt-1" style={{ fontSize: '0.65rem', letterSpacing: '0.5px' }}>{profile?.role || 'Role'}</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`konten-utama-wrapper flex-grow-1 ${sidebarTerbuka ? 'with-sidebar' : ''}`}>
        <main className="p-3 p-sm-4 flex-grow-1" style={{ paddingBottom: '80px' }}>
          {error ? (
            <div className="alert alert-danger">{error}</div>
          ) : (
            <>
              {menuAktif === 'beranda' && (
                <div className="row g-4">
                  {/* Session Info (Role, Business, Unit) */}
                  <div className="col-12 col-md-6">
                    <div className="kartu-premium h-100 fade-in">
                      <h4 className="fw-bold mb-3 d-flex align-items-center gap-2">
                        <Shield size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                        <span>Sesi Aktif Anda</span>
                      </h4>
                      
                      <div className="d-flex flex-column gap-3 mt-3">
                        <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                          <div className="text-muted small fw-semibold">Peran Pengguna (Role)</div>
                          <div className="fw-bold text-main fs-5 mt-1 text-capitalize d-flex align-items-center gap-2">
                            <span className="badge bg-primary py-1 px-3 fs-6" style={{ backgroundColor: 'var(--warna-utama) !important' }}>
                              {profile?.role}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                          <div className="text-muted small fw-semibold">Unit Usaha Aktif</div>
                          <div className="fw-bold text-main fs-5 mt-1 d-flex align-items-center gap-2">
                            <Briefcase size={20} className="text-muted" />
                            <span>{profile?.nama_usaha ? profile.nama_usaha : 'Global (Tidak Terikat Usaha)'}</span>
                          </div>
                          {profile?.nama_unit && (
                            <div className="text-muted small mt-1">
                              Unit: <strong>{profile.nama_unit}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* WIDGET TUGAS & ABSENSI HARI INI */}
                  {!['root', 'owner'].includes(profile?.role?.toLowerCase()) && tugasHariIni && (
                    <div className="col-12 col-md-6">
                      <div className="kartu-premium h-100 fade-in" style={{ animationDelay: '0.05s' }}>
                        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2">
                          <UserCheck size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                          <span>Tugas & Absensi Hari Ini</span>
                        </h4>

                        <div className="d-flex flex-column gap-3 mt-3">
                          {tugasHariIni.izin_aktif && (
                            <div className="alert alert-info py-2 px-3 m-0" style={{ fontSize: '0.8rem', borderRadius: '8px' }}>
                              ℹ️ Hari ini Anda terdaftar sedang mengambil izin/sakit yang telah disetujui.
                            </div>
                          )}

                          {tugasHariIni.digantikan && (
                            <div className="alert alert-warning py-2 px-3 m-0" style={{ fontSize: '0.8rem', borderRadius: '8px' }}>
                              ⚠️ Jadwal kerja rutin Anda hari ini dikerjakan oleh karyawan pengganti.
                            </div>
                          )}

                          {tugasHariIni.jadwal_rutin && !tugasHariIni.digantikan && (
                            <div className="p-3 rounded-3" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                              <div className="text-muted small fw-semibold">Shift Kerja Rutin</div>
                              <div className="fw-bold text-main fs-5 mt-1 d-flex align-items-center gap-2">
                                <Briefcase size={18} className="text-muted" />
                                <span>{tugasHariIni.jadwal_rutin.nama_shift} ({tugasHariIni.jadwal_rutin.jam_mulai.substring(0, 5)} - {tugasHariIni.jadwal_rutin.jam_selesai.substring(0, 5)})</span>
                              </div>
                              <button
                                onClick={bukaAbsenModal}
                                className="tombol-premium mt-3 w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: '0.8rem' }}
                              >
                                <UserCheck size={16} />
                                Kelola Absen Rutin
                              </button>
                            </div>
                          )}

                          {tugasHariIni.jadwal_pengganti && (
                            <div className="p-3 rounded-3 border-primary" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-utama)' }}>
                              <div className="text-muted small fw-semibold text-primary">Tugas Pengganti Shift (Tukar)</div>
                              <div className="fw-bold text-main fs-5 mt-1 d-flex align-items-center gap-2">
                                <RefreshCw size={18} className="text-primary" />
                                <span>{tugasHariIni.jadwal_pengganti.nama_shift} ({tugasHariIni.jadwal_pengganti.jam_mulai.substring(0, 5)} - {tugasHariIni.jadwal_pengganti.jam_selesai.substring(0, 5)})</span>
                              </div>
                              <div className="text-muted small mt-1">
                                {tugasHariIni.jadwal_pengganti.keterangan_tukar}
                              </div>
                              <button
                                onClick={bukaAbsenModal}
                                className="tombol-premium mt-3 w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: '0.8rem' }}
                              >
                                <UserCheck size={16} />
                                Kelola Absen Pengganti
                              </button>
                            </div>
                          )}

                          {tugasHariIni.lembur_aktif && (
                            <div className="p-3 rounded-3 border-warning" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-warning)' }}>
                              <div className="text-muted small fw-semibold text-warning">Tugas Lembur Aktif</div>
                              <div className="fw-bold text-main fs-5 mt-1 d-flex align-items-center gap-2">
                                <Clock size={18} className="text-warning" />
                                <span>{tugasHariIni.lembur_aktif.jam_mulai.substring(0, 5)} - {tugasHariIni.lembur_aktif.jam_selesai.substring(0, 5)}</span>
                              </div>
                              {tugasHariIni.lembur_aktif.keterangan && (
                                <div className="text-muted small mt-1">
                                  Tugas: <em>{tugasHariIni.lembur_aktif.keterangan}</em>
                                </div>
                              )}
                              <button
                                onClick={() => tanganiAbsenMasuk(tugasHariIni.lembur_aktif.id)}
                                className="tombol-premium mt-3 w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                                style={{ fontSize: '0.8rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                              >
                                <Clock size={16} />
                                Mulai Lembur
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profile Info */}
                  <div className="col-12 col-md-6">
                    <div className="kartu-premium h-100 fade-in" style={{ animationDelay: '0.1s' }}>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h4 className="fw-bold mb-0 d-flex align-items-center gap-2">
                          <User size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                          <span>Profil Akun</span>
                        </h4>
                        <button 
                          onClick={bukaModalEditEmail} 
                          className="btn-ikon-premium" 
                          title="Edit Email"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>

                      <div className="d-flex flex-column gap-3 mt-3">
                        <div className="d-flex align-items-center gap-3">
                          <div className="d-flex align-items-center justify-content-center bg-light rounded-circle text-dark" style={{ width: '50px', height: '50px' }}>
                            <User size={24} />
                          </div>
                          <div>
                            <div className="fw-bold fs-5">{profile?.nama}</div>
                            <div className="text-muted small">Anggota terdaftar mPOS Pro</div>
                          </div>
                        </div>

                        <hr className="my-2" style={{ borderColor: 'var(--warna-border)' }} />

                        <div className="d-flex align-items-center gap-2 text-main">
                          <Phone size={16} className="text-muted" />
                          <span>WhatsApp: <strong>{profile?.wa}</strong></span>
                        </div>

                        <div className="d-flex align-items-center gap-2 text-main">
                          <Mail size={16} className="text-muted" />
                          <span>Email: <strong>{profile?.email || '- (Belum Diatur)'}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* WIDGET PERIZINAN BERTINGKAT */}
                  <div className="col-12 mt-4">
                    <div className="row g-4">
                      {/* Pemberitahuan Hasil Keputusan Atasan untuk Pengganti (B) */}
                      {(() => {
                        const hariIni = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 10);
                        const pemberitahuanPengganti = riwayatPerizinan.filter(p => 
                          String(p.karyawan_pengganti_id) === String(profile?.user_id) && 
                          ['ditolak', 'disetujui'].includes(p.status) &&
                          p.tanggal >= hariIni &&
                          !infoDitutup.includes(p.id)
                        );
                        return pemberitahuanPengganti.map(pInfo => (
                          <div key={`pinfo_${pInfo.id}`} className="col-12">
                            <div className={`alert-premium border-${pInfo.status === 'disetujui' ? 'success' : 'danger'} p-3 p-sm-4 fade-in`} style={{ backgroundColor: pInfo.status === 'disetujui' ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', borderLeft: `5px solid var(--warna-${pInfo.status === 'disetujui' ? 'sukses' : 'bahaya'})` }}>
                              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
                                <div>
                                  <h5 className="fw-bold mb-1 text-main d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                                    <span>{pInfo.status === 'disetujui' ? '✅ Tugas Pengganti Disetujui' : '❌ Tugas Pengganti Ditolak'}</span>
                                  </h5>
                                  <p className="mb-0 text-muted small">
                                    Permintaan tugas pengganti untuk <strong>{pInfo.nama_karyawan}</strong> pada tanggal <strong>{formatTanggal(pInfo.tanggal, 'sedang')}</strong> (yang telah Anda terima) telah <strong>{pInfo.status === 'disetujui' ? 'DISETUJUI' : 'DITOLAK'}</strong> oleh Atasan.
                                  </p>
                                  {pInfo.status === 'ditolak' && pInfo.catatan_atasan && (
                                    <p className="mb-0 text-danger small mt-1">
                                      Catatan Atasan: <em>"{pInfo.catatan_atasan}"</em>
                                    </p>
                                  )}
                                </div>
                                <div className="d-flex gap-2 w-100 w-sm-auto justify-content-end">
                                  <button
                                    onClick={() => tutupInfoPerizinan(pInfo.id)}
                                    className="tombol-sekunder-premium border-0"
                                    style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                  >
                                    Tutup Info
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ));
                      })()}

                      {/* A. Widget Tugas Pengganti Aktif */}
                      {(() => {
                        const hariIni = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 10);
                        return riwayatPerizinan.filter(p => 
                          p.status === 'menunggu_pengganti' && 
                          String(p.karyawan_pengganti_id) === String(profile?.user_id) &&
                          p.tanggal >= hariIni
                        ).map(tugas => (
                          <KartuTugasPengganti 
                            key={tugas.id} 
                            tugas={tugas} 
                            opsiShift={opsiShift} 
                            profile={profile} 
                            ambilRiwayatPerizinan={ambilRiwayatPerizinan} 
                            formatTanggal={formatTanggal} 
                            ui={ui} 
                          />
                        ));
                      })()}

                      {/* B. Widget Antrean Persetujuan Izin (Atasan) */}
                      {['root', 'owner', 'supervisor'].includes(profile?.role?.toLowerCase()) && (
                        <div className="col-12">
                          <div className="kartu-premium p-3 p-sm-4 fade-in">
                            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-3">
                              <div>
                                <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                  <Shield size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                                  <span>Antrean Persetujuan Izin</span>
                                </h4>
                                <div className="text-muted small">Tinjau dan berikan keputusan pengajuan izin dari karyawan.</div>
                              </div>
                              <button
                                onClick={bukaRekapPerizinan}
                                className="tombol-sekunder-premium border-0 w-100 w-sm-auto d-flex align-items-center justify-content-center gap-2 text-main"
                                style={{ fontSize: '0.78rem', padding: '0.45rem 1rem', borderRadius: '10px' }}
                              >
                                <Calendar size={14} />
                                <span>📅 Rekap 2 Bulan</span>
                              </button>
                            </div>
                            {riwayatPerizinan.filter(p => p.status === 'menunggu_persetujuan').length === 0 ? (
                              <div className="text-muted small py-3">Tidak ada permohonan izin karyawan yang memerlukan evaluasi saat ini.</div>
                            ) : (
                              <div className="d-flex flex-column gap-2 mt-2">
                                {riwayatPerizinan.filter(p => p.status === 'menunggu_persetujuan').map(izin => (
                                  <div key={izin.id} className="p-3 rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                                    <div>
                                      <div className="fw-bold text-main" style={{ fontSize: '0.82rem' }}>{izin.nama_karyawan}</div>
                                      <div className="text-muted small mt-1">
                                        Jenis: <span className="badge bg-info">{izin.jenis_izin.toUpperCase()}</span> | Tanggal: <strong>{formatTanggal(izin.tanggal, 'sedang')}</strong> | Shift: <strong>{dapatkanNamaShiftDariIds(izin.shift_id_izin, opsiShift)}</strong>
                                      </div>
                                      <div className="text-muted small mt-1 italic">Alasan: "{izin.alasan}"</div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setTabelTerpilih('perizinan');
                                        bukaModalForm(izin, 'perizinan');
                                      }}
                                      className="tombol-premium border-0 w-100 w-sm-auto text-center"
                                      style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                    >
                                      Evaluasi Izin
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* C. Widget Pusat Perizinan Saya (Karyawan/Member) */}
                      {!['root', 'owner', 'supervisor'].includes(profile?.role?.toLowerCase()) && (
                        <div className="col-12">
                          <div className="kartu-premium p-3 p-sm-4 fade-in">
                            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-3">
                              <div>
                                <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                  <FileText size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                                  <span>Pusat Perizinan Saya</span>
                                </h4>
                                <div className="text-muted small">Kelola dan ajukan permohonan ketidakhadiran kerja Anda di sini.</div>
                              </div>
                              <div className="d-flex flex-column flex-sm-row gap-2 w-100 w-sm-auto">
                                <button
                                  onClick={bukaRekapPerizinan}
                                  className="tombol-sekunder-premium border-0 d-flex align-items-center justify-content-center gap-2 text-main"
                                  style={{ fontSize: '0.78rem', padding: '0.45rem 1rem', borderRadius: '10px' }}
                                >
                                  <Calendar size={14} />
                                  <span>📅 Rekap 2 Bulan</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setTabelTerpilih('perizinan');
                                    bukaModalForm(null, 'perizinan');
                                  }}
                                  className="tombol-premium border-0 d-flex align-items-center justify-content-center gap-2"
                                  style={{ fontSize: '0.78rem', padding: '0.45rem 1rem', borderRadius: '10px' }}
                                >
                                  <Plus size={14} />
                                  <span>Ajukan Izin Baru</span>
                                </button>
                              </div>
                            </div>

                            {/* Pelacak Status Pengajuan Aktif */}
                            {(() => {
                              const hariIni = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 10);
                              const aktif = riwayatPerizinan.find(p => (p.karyawan_id == profile?.user_id || p.karyawan_pengganti_id == profile?.user_id) && ['menunggu_pengganti', 'ditolak_pengganti', 'menunggu_persetujuan', 'ditolak', 'disetujui'].includes(p.status) && p.tanggal >= hariIni && !infoDitutup.includes(p.id));
                              if (!aktif) {
                                return (
                                  <div className="p-3 rounded-3 text-center text-muted small" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px dashed var(--warna-border)' }}>
                                    Anda tidak memiliki pengajuan izin yang sedang diproses saat ini.
                                  </div>
                                );
                              }

                              const badgeStatusMap = {
                                menunggu_pengganti: <span className="badge bg-warning text-dark">⏳ Menunggu Pengganti</span>,
                                ditolak_pengganti: <span className="badge bg-danger">✕ Ditolak Pengganti</span>,
                                menunggu_persetujuan: <span className="badge bg-info text-dark">⏱️ Menunggu Persetujuan Atasan</span>,
                                ditolak: <span className="badge bg-danger">✕ Ditolak Atasan</span>,
                                disetujui: <span className="badge bg-success">✓ Disetujui Atasan</span>
                              };

                              return (
                                <div className="p-3 rounded-3 mt-3" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                                  <div className="d-flex justify-content-between align-items-center">
                                    <div className="fw-semibold text-main small">Status Pengajuan Berjalan</div>
                                    {badgeStatusMap[aktif.status]}
                                  </div>
                                  <div className="text-muted small mt-2">
                                    Jenis: <strong>{aktif.jenis_izin.toUpperCase()}</strong> | Tanggal: <strong>{formatTanggal(aktif.tanggal, 'sedang')}</strong> | Shift: <strong>{dapatkanNamaShiftDariIds(aktif.shift_id_izin, opsiShift)}</strong>
                                  </div>
                                  <div className="text-muted small mt-1 italic">Alasan: "{aktif.alasan}"</div>
                                  
                                  {aktif.karyawan_id == profile?.user_id && (aktif.status === 'menunggu_pengganti' || aktif.status === 'menunggu_persetujuan') && (
                                     <div className="mt-3 d-flex flex-column flex-sm-row gap-2">
                                       <button
                                         onClick={() => batalkanPengajuanIzin(aktif.id)}
                                         className="tombol-sekunder-premium border-0 text-center flex-fill"
                                         style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px', color: 'var(--warna-bahaya)', background: 'rgba(239, 68, 68, 0.08)' }}
                                       >
                                         🗑️ Batalkan Pengajuan
                                       </button>
                                     </div>
                                   )}
 
                                   {aktif.karyawan_id == profile?.user_id && aktif.status === 'ditolak_pengganti' && (
                                     <div className="mt-3 d-flex flex-column flex-sm-row gap-2">
                                       <button
                                         onClick={async () => {
                                           const setuju = await ui.notif('konfirmasi', 'Apakah Anda yakin ingin meneruskan pengajuan ini langsung ke atasan tanpa karyawan pengganti?');
                                           if (!setuju) return;
                                           ui.loading(true, 'fullscreen', 'Meneruskan ke atasan...');
                                           try {
                                             const r = await fetch('http://localhost:8080/api/perizinan/eskalasi-atasan', {
                                               method: 'POST',
                                               headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                                               body: JSON.stringify({ id: aktif.id })
                                             });
                                             const res = await r.json();
                                             ui.loading(false);
                                             if (r.ok && res.status === 'sukses') {
                                               ui.notif('sukses', res.pesan);
                                               await ambilRiwayatPerizinan();
                                             } else { ui.notif('gagal', res.pesan); }
                                           } catch { ui.loading(false); ui.notif('gagal', 'Kesalahan koneksi.'); }
                                         }}
                                         className="tombol-premium border-0 text-center flex-fill"
                                         style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                       >
                                         Kirim Langsung ke Atasan
                                       </button>
                                       <button
                                         onClick={() => {
                                           setTabelTerpilih('perizinan');
                                           bukaModalForm(aktif, 'perizinan');
                                         }}
                                         className="tombol-sekunder-premium border-0 text-center flex-fill text-main"
                                         style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                       >
                                         ✏️ Edit & Ajukan Kembali
                                       </button>
                                       <button
                                         onClick={() => batalkanPengajuanIzin(aktif.id)}
                                         className="tombol-sekunder-premium border-0 text-center flex-fill"
                                         style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px', color: 'var(--warna-bahaya)', background: 'rgba(239, 68, 68, 0.08)' }}
                                       >
                                         🗑️ Batalkan
                                       </button>
                                     </div>
                                   )}
 
                                   {aktif.status === 'ditolak' && (
                                     <div className="mt-3">
                                       {aktif.catatan_atasan && (
                                         <div className="alert alert-danger small p-2 mb-2">
                                           Catatan Atasan: <em>"{aktif.catatan_atasan}"</em>
                                         </div>
                                       )}
                                       <div className="d-flex flex-column flex-sm-row gap-2">
                                         {aktif.karyawan_id == profile?.user_id && (
                                           <>
                                             <button
                                               onClick={() => {
                                                 setTabelTerpilih('perizinan');
                                                 bukaModalForm(aktif, 'perizinan');
                                               }}
                                               className="tombol-premium border-0 text-center flex-fill"
                                               style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                             >
                                               ✏️ Edit & Ajukan Kembali
                                             </button>
                                             <button
                                               onClick={() => batalkanPengajuanIzin(aktif.id)}
                                               className="tombol-sekunder-premium border-0 text-center flex-fill"
                                               style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px', color: 'var(--warna-bahaya)', background: 'rgba(239, 68, 68, 0.08)' }}
                                             >
                                               🗑️ Batalkan & Hapus
                                             </button>
                                           </>
                                         )}
                                         <button
                                           onClick={() => tutupInfoPerizinan(aktif.id)}
                                           className="tombol-sekunder-premium border-0 text-center flex-fill text-main"
                                           style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                         >
                                           Tutup Info
                                         </button>
                                       </div>
                                     </div>
                                   )}

                                  {aktif.status === 'disetujui' && (
                                    <div className="mt-3 d-flex flex-column flex-sm-row gap-2">
                                      <button
                                        onClick={() => tutupInfoPerizinan(aktif.id)}
                                        className="tombol-sekunder-premium border-0 text-center flex-fill text-main"
                                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem', borderRadius: '8px' }}
                                      >
                                        Tutup Info
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* DYNAMIC CRUD PANEL */}
              {(() => {
                let currentMenu = null;
                menuGroups.forEach(g => {
                  const m = g.menus.find(x => x.url === menuAktif);
                  if (m) currentMenu = m;
                });
                
                if (!currentMenu || !currentMenu.tabel) return null;
                
                const canCreate = currentMenu.can_create == 1 || currentMenu.permissions?.can_create == 1;
                const canUpdate = currentMenu.can_update == 1 || currentMenu.permissions?.can_update == 1;
                const canDelete = currentMenu.can_delete == 1 || currentMenu.permissions?.can_delete == 1;
                
                const dataTabelFiltered = dataTabel.filter(row => {
                  // Filter Bulan & Tahun khusus kebersihan_tugas
                  if (currentMenu.tabel === 'kebersihan_tugas') {
                    if (row.tanggal) {
                      const parts = row.tanggal.split('-');
                      if (parts.length >= 2) {
                        const y = parts[0];
                        const m = parts[1];
                        if (filterBulanKebersihan && m !== filterBulanKebersihan) return false;
                        if (filterTahunKebersihan && y !== filterTahunKebersihan) return false;
                      }
                    }
                    if (filterUsahaGlobal && String(row.usaha_id) !== String(filterUsahaGlobal)) return false;
                  }

                  // Filter Bulan & Tahun khusus points
                  if (currentMenu.tabel === 'points') {
                    if (row.tanggal) {
                      const parts = row.tanggal.split('-');
                      if (parts.length >= 2) {
                        const y = parts[0];
                        const m = parts[1];
                        if (filterBulanPoin && m !== filterBulanPoin) return false;
                        if (filterTahunPoin && y !== filterTahunPoin) return false;
                      }
                    }
                    if (filterUsahaGlobal && String(row.usaha_id) !== String(filterUsahaGlobal)) return false;
                  }

                  // Filter Bulan & Tahun khusus absensi
                  if (currentMenu.tabel === 'absensi') {
                    if (row.tanggal) {
                      const parts = row.tanggal.split('-');
                      if (parts.length >= 2) {
                        const y = parts[0];
                        const m = parts[1];
                        if (filterBulanAbsensi && m !== filterBulanAbsensi) return false;
                        if (filterTahunAbsensi && y !== filterTahunAbsensi) return false;
                      }
                    }
                    if (filterUsahaGlobal && String(row.usaha_id) !== String(filterUsahaGlobal)) return false;
                  }

                  // Filter Bulan & Tahun khusus perizinan
                  if (currentMenu.tabel === 'perizinan') {
                    if (row.tanggal) {
                      const parts = row.tanggal.split('-');
                      if (parts.length >= 2) {
                        const y = parts[0];
                        const m = parts[1];
                        if (filterBulanIzin && m !== filterBulanIzin) return false;
                        if (filterTahunIzin && y !== filterTahunIzin) return false;
                      }
                    }
                    if (filterUsahaGlobal && String(row.usaha_id) !== String(filterUsahaGlobal)) return false;
                  }

                  if (!kataKunciPencarian) return true;
                  const lowerKeyword = kataKunciPencarian.toLowerCase();
                  
                  // Khusus tabel users, batasi pencarian hanya pada 'nama' dan 'wa'
                  if (currentMenu.tabel === 'users') {
                    const matchNama = row.nama && String(row.nama).toLowerCase().includes(lowerKeyword);
                    const matchWa = row.wa && String(row.wa).toLowerCase().includes(lowerKeyword);
                    return matchNama || matchWa;
                  }
                  
                  // Tabel user_role: cari berdasarkan nama user, usaha, atau role
                  if (currentMenu.tabel === 'user_role') {
                    const namaUser = opsiUsers.find(u => u.id == row.user_id)?.nama || String(row.user_id);
                    const namaUsaha = opsiUsaha.find(u => u.id == row.usaha_id)?.nama_usaha || String(row.usaha_id);
                    const namaRole = opsiRoles.find(u => u.id == row.role_id)?.nama_role || String(row.role_id);
                    
                    return namaUser.toLowerCase().includes(lowerKeyword) || 
                           namaUsaha.toLowerCase().includes(lowerKeyword) || 
                           namaRole.toLowerCase().includes(lowerKeyword);
                  }

                  // Tabel role_permissions: cari berdasarkan nama role atau menu
                  if (currentMenu.tabel === 'role_permissions') {
                    const namaRole = opsiRoles.find(u => u.id == row.role_id)?.nama_role || String(row.role_id);
                    const namaMenu = opsiMenus.find(m => m.id == row.menu_id)?.label || String(row.menu_id);
                    
                    return namaRole.toLowerCase().includes(lowerKeyword) || 
                           namaMenu.toLowerCase().includes(lowerKeyword);
                  }
                  
                  // Tabel unit: cari berdasarkan nama unit atau nama usaha induk
                  if (currentMenu.tabel === 'unit') {
                    const namaUsaha = opsiUsaha.find(u => u.id == row.usaha_id)?.nama_usaha || String(row.usaha_id);
                    const namaUnit = row.nama_unit || '';
                    
                    return namaUnit.toLowerCase().includes(lowerKeyword) || 
                           namaUsaha.toLowerCase().includes(lowerKeyword);
                  }

                  // Tabel shift: cari berdasarkan nama shift atau nama usaha terkait
                  if (currentMenu.tabel === 'shift') {
                    const namaShift = row.nama_shift || '';
                    const namaUsaha = opsiUsaha.find(u => u.id == row.usaha_id)?.nama_usaha || row.nama_usaha || '';
                    
                    return namaShift.toLowerCase().includes(lowerKeyword) || 
                           namaUsaha.toLowerCase().includes(lowerKeyword);
                  }

                  // Tabel jadwal_karyawan: cari berdasarkan nama karyawan, nama shift, atau tanggal
                  if (currentMenu.tabel === 'jadwal_karyawan') {
                    const karyawanObj = opsiUsers.find(u => u.id == row.karyawan_id);
                    const namaKaryawan = karyawanObj ? karyawanObj.nama : (row.nama_karyawan || '');
                    const shiftObj = opsiShift.find(s => s.id == row.shift_id);
                    const namaShift = shiftObj ? shiftObj.nama_shift : (row.nama_shift || '');
                    const tanggal = row.tanggal || '';
                    
                    return namaKaryawan.toLowerCase().includes(lowerKeyword) || 
                           namaShift.toLowerCase().includes(lowerKeyword) ||
                           tanggal.includes(lowerKeyword);
                  }

                  // Tabel lainnya: pencarian global di semua kolom
                  return Object.values(row).some(val => 
                    val !== null && String(val).toLowerCase().includes(lowerKeyword)
                  );
                });
                
                return (
                  <div className="kartu-premium fade-in p-3 p-sm-4">
                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-3 mb-sm-4 pb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
                      <div>
                        <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                          <Database size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                          <span>Data {currentMenu.label}</span>
                        </h4>
                        <div className="text-muted small">Kelola data {currentMenu.tabel.replace('_', ' ')} dalam sistem.</div>
                      </div>
                      
                      {canCreate && (
                        <div className="d-flex gap-2 w-100 w-sm-auto justify-content-end">
                          {/* Tombol Tambah — MOBILE (kecil) */}
                          <button onClick={() => bukaModalForm(null)} className="tombol-premium d-flex d-sm-none align-items-center gap-1" style={{ fontSize: '0.6rem', padding: '0.2rem 0.55rem', borderRadius: '7px', lineHeight: '1.4', flexShrink: 0 }}>
                            <Plus size={10} />
                            <span>Tambah Data</span>
                          </button>
                          {/* Tombol Tambah — DESKTOP (normal) */}
                          <button onClick={() => bukaModalForm(null)} className="tombol-premium d-none d-sm-flex align-items-center gap-2" style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', borderRadius: '10px', flexShrink: 0 }}>
                            <Plus size={15} />
                            <span>Tambah Data</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {currentMenu.tabel === 'kebersihan_tugas' && (
                      <div className="mb-5">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <h5 className="fw-bold mb-0 text-main" style={{ fontSize: '0.85rem' }}>
                            🧹 Tugas Aktif Siklus Shift ({tanggalBisnisKebersihan || 'Memuat...'})
                          </h5>
                          {loadingTugasKebersihan && (
                            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                          )}
                        </div>
                        
                        {tugasKebersihan.length === 0 ? (
                          <div className="text-center py-4 rounded-3 text-muted small" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px dashed var(--warna-border)' }}>
                            Tidak ada area kebersihan yang diatur oleh atasan untuk cabang ini.
                          </div>
                        ) : (
                          <div className="row g-3">
                            {tugasKebersihan.map(t => {
                              const statusWarna = {
                                belum_dibersihkan: 'warning',
                                menunggu_verifikasi: 'info',
                                selesai: 'success',
                                tidak_bersih: 'danger'
                              }[t.status] || 'secondary';

                              const statusTeks = {
                                belum_dibersihkan: 'Belum Dibersihkan',
                                menunggu_verifikasi: 'Menunggu Verifikasi',
                                selesai: 'Selesai (Bersih)',
                                tidak_bersih: 'Tidak Bersih (Kotor)'
                              }[t.status] || t.status;

                              const isAtasan = ['root', 'owner', 'supervisor'].includes(profile?.role?.toLowerCase());
                              const isDitunjukLain = t.ditunjuk_karyawan_id && Number(t.ditunjuk_karyawan_id) !== Number(profile?.user_id);

                              return (
                                <div key={t.id} className="col-12 col-md-6 col-lg-4">
                                  <div className="kartu-premium h-100 p-3 d-flex flex-column transition-lambat" style={{ border: `1.5px solid ${t.status === 'selesai' ? 'var(--warna-sukses)' : 'var(--warna-border)'}`, backgroundColor: 'var(--bg-kartu)' }}>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                      <h6 className="fw-bold mb-0 text-main text-truncate" style={{ fontSize: '0.85rem' }}>{t.nama_area}</h6>
                                      <span className={`badge bg-${statusWarna} text-capitalize`} style={{ fontSize: '0.62rem', padding: '0.25rem 0.6rem' }}>
                                        {statusTeks}
                                      </span>
                                    </div>
                                    
                                    <div className="small text-muted mb-3" style={{ fontSize: '0.72rem' }}>
                                      ⏱️ Jadwal: <strong className="text-main">{t.jam_mulai_formatted} - {t.jam_selesai_formatted}</strong>
                                      {t.ditunjuk_karyawan_id && (
                                        <div className="mt-1 text-primary fw-semibold">
                                          🎯 Khusus Petugas: {t.nama_ditunjuk}
                                        </div>
                                      )}
                                      {t.status === 'menunggu_verifikasi' && (
                                        <div className="mt-1">
                                          👤 Dikerjakan: <span className="fw-bold">{t.nama_karyawan}</span>
                                        </div>
                                      )}
                                      {t.status === 'selesai' && (
                                        <div className="mt-1 text-success">
                                          ✓ Selesai & diverifikasi bersih.
                                        </div>
                                      )}
                                    </div>

                                    {t.catatan_atasan && (
                                      <div className="p-2 rounded-2 mb-3 small" style={{ backgroundColor: t.status === 'tidak_bersih' ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)', border: `1px solid ${t.status === 'tidak_bersih' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`, fontSize: '0.68rem' }}>
                                        <strong>Catatan Atasan:</strong> <em>"{t.catatan_atasan}"</em>
                                      </div>
                                    )}

                                    <div className="mt-auto pt-2">
                                      {t.status !== 'selesai' && t.status !== 'menunggu_verifikasi' && (
                                        <>
                                          {t.status_waktu === 'belum_mulai' && (
                                            <button className="tombol-sekunder-premium w-100 disabled" style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem' }} disabled>
                                              🔒 Belum Waktunya
                                            </button>
                                          )}
                                          {t.status_waktu === 'terlewat' && (
                                            <button className="tombol-sekunder-premium w-100 disabled text-danger" style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem' }} disabled>
                                              ⚠️ Waktu Terlewat
                                            </button>
                                          )}
                                          {t.status_waktu === 'aktif' && (
                                            <button
                                              onClick={() => tanganiKlaimKebersihan(t.id)}
                                              className="tombol-premium w-100"
                                              style={{ fontSize: '0.72rem', padding: '0.35rem 0.8rem' }}
                                              disabled={isDitunjukLain}
                                            >
                                              {isDitunjukLain ? '🔒 Khusus Petugas Lain' : '🧹 Selesai Bersihkan'}
                                            </button>
                                          )}
                                        </>
                                      )}

                                      {t.status === 'menunggu_verifikasi' && isAtasan && (
                                        <div className="d-flex flex-column gap-2 mt-2 pt-2" style={{ borderTop: '1px dashed var(--warna-border)' }}>
                                          <input
                                            type="text"
                                            className="form-control input-premium w-100"
                                            style={{ fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}
                                            placeholder="Tulis catatan evaluasi..."
                                            value={catatanEvaluasiMap[t.id] || ''}
                                            onChange={(e) => setCatatanEvaluasiMap(prev => ({ ...prev, [t.id]: e.target.value }))}
                                          />
                                          <div className="d-flex gap-2">
                                            <button
                                              onClick={() => tanganiEvaluasiKebersihan(t.id, 'bersih')}
                                              className="tombol-premium flex-fill text-center"
                                              style={{ fontSize: '0.68rem', padding: '0.3rem 0.6rem', backgroundColor: 'var(--warna-sukses)' }}
                                            >
                                              ✓ Bersih
                                            </button>
                                            <button
                                              onClick={() => tanganiEvaluasiKebersihan(t.id, 'tidak_bersih')}
                                              className="tombol-sekunder-premium flex-fill text-center text-danger border-danger"
                                              style={{ fontSize: '0.68rem', padding: '0.3rem 0.6rem' }}
                                            >
                                              ✕ Kotor
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {t.status === 'tidak_bersih' && isAtasan && (
                                        <div className="d-flex flex-column gap-2 mt-2 pt-2" style={{ borderTop: '1px dashed var(--warna-border)' }}>
                                          <select
                                            className="form-select input-premiumSelect"
                                            style={{ fontSize: '0.68rem', padding: '0.3rem 0.5rem' }}
                                            value={assigneeMap[t.id] || ''}
                                            onChange={(e) => setAssigneeMap(prev => ({ ...prev, [t.id]: e.target.value }))}
                                          >
                                            <option value="">Pilih Petugas Baru...</option>
                                            {opsiUsers
                                              .filter(u => (!profile?.usaha_id || u.usaha_id == profile.usaha_id) && String(u.id) !== String(t.karyawan_id))
                                              .map(u => (
                                                <option key={u.id} value={u.id}>{u.nama}</option>
                                              ))}
                                          </select>
                                          <button
                                            onClick={() => tanganiTunjukKebersihan(t.id)}
                                            className="tombol-premium w-100"
                                            style={{ fontSize: '0.68rem', padding: '0.3rem 0.6rem' }}
                                          >
                                            🎯 Tunjuk Petugas
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <hr className="my-4" style={{ borderColor: 'var(--warna-border)' }} />
                      </div>
                    )}
                    
                    {/* Search Bar */}
                    <div className="mb-3 position-relative" style={{ maxWidth: '350px' }}>
                      <div className="position-absolute d-flex align-items-center justify-content-center" style={{ top: 0, bottom: 0, left: '15px', color: 'var(--text-secondary)', opacity: 0.7, pointerEvents: 'none' }}>
                        <Search size={16} />
                      </div>
                      <input 
                        type="text" 
                        className="form-control input-premium w-100" 
                        style={{ paddingLeft: '40px', fontSize: '0.85rem' }} 
                        placeholder={`Cari data di tabel ${currentMenu.tabel.replace('_', ' ')}...`} 
                        value={kataKunciPencarian}
                        onChange={(e) => setKataKunciPencarian(e.target.value)}
                      />
                    </div>

                    {/* Filter Bar khusus untuk Tugas Kebersihan */}
                    {currentMenu.tabel === 'kebersihan_tugas' && (() => {
                      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                      
                      // Ambil tahun unik dari data di tabel database secara dinamis
                      const tahunSet = new Set();
                      dataTabel.forEach(row => {
                        if (row.tanggal) {
                          const parts = row.tanggal.split('-');
                          if (parts.length >= 1 && parts[0]) {
                            tahunSet.add(parts[0]);
                          }
                        }
                      });
                      const tahunList = Array.from(tahunSet).sort((a, b) => b - a);
                      if (tahunList.length === 0) {
                        tahunList.push(new Date().getFullYear().toString());
                      }

                      return (
                        <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-halaman)', border: '1px solid var(--warna-border)', maxWidth: '550px' }}>
                          <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-main" style={{ fontSize: '0.75rem' }}>📅 Filter:</span>
                            
                            {!profile?.usaha_id && (
                              <div className="d-flex align-items-center gap-2">
                                <select
                                  className="form-select form-select-sm input-premium"
                                  style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                  value={filterUsahaGlobal}
                                  onChange={e => setFilterUsahaGlobal(e.target.value)}
                                >
                                  <option value="">Semua Cabang/Usaha</option>
                                  {opsiUsaha.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_usaha}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterBulanKebersihan}
                                onChange={e => setFilterBulanKebersihan(e.target.value)}
                              >
                                <option value="">Semua Bulan</option>
                                {namaBulan.map((b, i) => (
                                  <option key={i} value={String(i + 1).padStart(2, '0')}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterTahunKebersihan}
                                onChange={e => setFilterTahunKebersihan(e.target.value)}
                              >
                                <option value="">Semua Tahun</option>
                                {tahunList.map(t => (
                                  <option key={t} value={String(t)}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {(filterBulanKebersihan || filterTahunKebersihan || filterUsahaGlobal) && (
                              <button 
                                onClick={() => {
                                  setFilterBulanKebersihan('');
                                  setFilterTahunKebersihan('');
                                  setFilterUsahaGlobal('');
                                }} 
                                className="tombol-sekunder-premium btn-sm border-0" 
                                style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '15px' }}
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Filter Bar khusus untuk Tabungan Poin */}
                    {currentMenu.tabel === 'points' && (() => {
                      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                      
                      // Ambil tahun unik dari data points di database secara dinamis
                      const tahunSet = new Set();
                      dataTabel.forEach(row => {
                        if (row.tanggal) {
                          const parts = row.tanggal.split('-');
                          if (parts.length >= 1 && parts[0]) {
                            tahunSet.add(parts[0]);
                          }
                        }
                      });
                      const tahunList = Array.from(tahunSet).sort((a, b) => b - a);
                      if (tahunList.length === 0) {
                        tahunList.push(new Date().getFullYear().toString());
                      }

                      // Hitung total dari baris tabel yang sudah difilter
                      const filteredByPeriod = dataTabel.filter(row => {
                        if (row.tanggal) {
                          const parts = row.tanggal.split('-');
                          if (parts.length >= 2) {
                            const y = parts[0];
                            const m = parts[1];
                            if (filterBulanPoin && m !== filterBulanPoin) return false;
                            if (filterTahunPoin && y !== filterTahunPoin) return false;
                          }
                        }
                        if (filterUsahaGlobal && String(row.usaha_id) !== String(filterUsahaGlobal)) return false;
                        return true;
                      });
                      const totalPeriode = filteredByPeriod.reduce((acc, r) => acc + (parseInt(r.jumlah_poin) || 0), 0);

                      return (
                        <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-halaman)', border: '1px solid var(--warna-border)', maxWidth: '550px' }}>
                          <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-main" style={{ fontSize: '0.75rem' }}>📅 Filter:</span>
                            
                            {!profile?.usaha_id && (
                              <div className="d-flex align-items-center gap-2">
                                <select
                                  className="form-select form-select-sm input-premium"
                                  style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                  value={filterUsahaGlobal}
                                  onChange={e => setFilterUsahaGlobal(e.target.value)}
                                >
                                  <option value="">Semua Cabang/Usaha</option>
                                  {opsiUsaha.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_usaha}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterBulanPoin}
                                onChange={e => setFilterBulanPoin(e.target.value)}
                              >
                                <option value="">Semua Bulan</option>
                                {namaBulan.map((b, i) => (
                                  <option key={i} value={String(i + 1).padStart(2, '0')}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterTahunPoin}
                                onChange={e => setFilterTahunPoin(e.target.value)}
                              >
                                <option value="">Semua Tahun</option>
                                {tahunList.map(t => (
                                  <option key={t} value={String(t)}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {(filterBulanPoin || filterTahunPoin || filterUsahaGlobal) && (
                              <button 
                                onClick={() => {
                                  setFilterBulanPoin('');
                                  setFilterTahunPoin('');
                                  setFilterUsahaGlobal('');
                                }} 
                                className="tombol-sekunder-premium btn-sm border-0" 
                                style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '15px' }}
                              >
                                Reset Filter
                              </button>
                            )}

                            {/* Total periode */}
                            <div className="ms-sm-auto d-flex align-items-center gap-1" style={{ background: totalPeriode >= 0 ? 'rgba(99,102,241,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: '12px', padding: '3px 10px', border: `1px solid ${totalPeriode >= 0 ? 'rgba(99,102,241,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Total:</span>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: totalPeriode >= 0 ? 'var(--warna-utama)' : 'var(--warna-bahaya)', fontFamily: 'monospace' }}>
                                {totalPeriode > 0 ? '+' : ''}{totalPeriode}
                              </span>
                              <span style={{ fontSize: '0.62rem', color: 'var(--warna-teks-sekunder)' }}>poin</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Filter Bar khusus untuk Absensi */}
                    {currentMenu.tabel === 'absensi' && (() => {
                      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                      
                      const tahunSet = new Set();
                      dataTabel.forEach(row => {
                        if (row.tanggal) {
                          const parts = row.tanggal.split('-');
                          if (parts.length >= 1 && parts[0]) {
                            tahunSet.add(parts[0]);
                          }
                        }
                      });
                      const tahunList = Array.from(tahunSet).sort((a, b) => b - a);
                      if (tahunList.length === 0) {
                        tahunList.push(new Date().getFullYear().toString());
                      }

                      return (
                        <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-halaman)', border: '1px solid var(--warna-border)', maxWidth: '550px' }}>
                          <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-main" style={{ fontSize: '0.75rem' }}>📅 Filter:</span>
                            
                            {!profile?.usaha_id && (
                              <div className="d-flex align-items-center gap-2">
                                <select
                                  className="form-select form-select-sm input-premium"
                                  style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                  value={filterUsahaGlobal}
                                  onChange={e => setFilterUsahaGlobal(e.target.value)}
                                >
                                  <option value="">Semua Cabang/Usaha</option>
                                  {opsiUsaha.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_usaha}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterBulanAbsensi}
                                onChange={e => setFilterBulanAbsensi(e.target.value)}
                              >
                                <option value="">Semua Bulan</option>
                                {namaBulan.map((b, i) => (
                                  <option key={i} value={String(i + 1).padStart(2, '0')}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterTahunAbsensi}
                                onChange={e => setFilterTahunAbsensi(e.target.value)}
                              >
                                <option value="">Semua Tahun</option>
                                {tahunList.map(t => (
                                  <option key={t} value={String(t)}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {(filterBulanAbsensi || filterTahunAbsensi || filterUsahaGlobal) && (
                              <button 
                                onClick={() => {
                                  setFilterBulanAbsensi('');
                                  setFilterTahunAbsensi('');
                                  setFilterUsahaGlobal('');
                                }} 
                                className="tombol-sekunder-premium btn-sm border-0" 
                                style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '15px' }}
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Filter Bar khusus untuk Perizinan */}
                    {currentMenu.tabel === 'perizinan' && (() => {
                      const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                      
                      const tahunSet = new Set();
                      dataTabel.forEach(row => {
                        if (row.tanggal) {
                          const parts = row.tanggal.split('-');
                          if (parts.length >= 1 && parts[0]) {
                            tahunSet.add(parts[0]);
                          }
                        }
                      });
                      const tahunList = Array.from(tahunSet).sort((a, b) => b - a);
                      if (tahunList.length === 0) {
                        tahunList.push(new Date().getFullYear().toString());
                      }

                      return (
                        <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-halaman)', border: '1px solid var(--warna-border)', maxWidth: '550px' }}>
                          <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-main" style={{ fontSize: '0.75rem' }}>📅 Filter:</span>
                            
                            {!profile?.usaha_id && (
                              <div className="d-flex align-items-center gap-2">
                                <select
                                  className="form-select form-select-sm input-premium"
                                  style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                  value={filterUsahaGlobal}
                                  onChange={e => setFilterUsahaGlobal(e.target.value)}
                                >
                                  <option value="">Semua Cabang/Usaha</option>
                                  {opsiUsaha.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_usaha}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterBulanIzin}
                                onChange={e => setFilterBulanIzin(e.target.value)}
                              >
                                <option value="">Semua Bulan</option>
                                {namaBulan.map((b, i) => (
                                  <option key={i} value={String(i + 1).padStart(2, '0')}>{b}</option>
                                ))}
                              </select>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterTahunIzin}
                                onChange={e => setFilterTahunIzin(e.target.value)}
                              >
                                <option value="">Semua Tahun</option>
                                {tahunList.map(t => (
                                  <option key={t} value={String(t)}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {(filterBulanIzin || filterTahunIzin || filterUsahaGlobal) && (
                              <button 
                                onClick={() => {
                                  setFilterBulanIzin('');
                                  setFilterTahunIzin('');
                                  setFilterUsahaGlobal('');
                                }} 
                                className="tombol-sekunder-premium btn-sm border-0" 
                                style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '15px' }}
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Table Listing */}
                  {loadingTabel ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                      <span className="small text-muted">Mengambil data dari server...</span>
                    </div>
                  ) : dataTabel.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      Tidak ada data yang ditemukan di tabel <strong>{currentMenu.tabel.replace('_', ' ').toUpperCase()}</strong>.
                    </div>
                  ) : dataTabelFiltered.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      Pencarian "<strong>{kataKunciPencarian}</strong>" tidak menemukan hasil di tabel ini.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className={`table ${theme === 'dark' ? 'table-dark' : ''} table-hover align-middle mb-0 tabel-font`} style={{ backgroundColor: 'transparent', borderColor: 'var(--warna-border)' }}>
                        <thead>
                          <tr className="text-muted">
                            {dapatkanKolomTabel(currentMenu.tabel).map((hdr, idx) => (
                              <th key={idx} style={{ fontWeight: 600, letterSpacing: '0.3px' }}>{hdr}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dataTabelFiltered.map((baris, index) => {
                            // Helper untuk mengecek apakah baris ini dilindungi karena berkaitan dengan Root
                            let isProtectedRoot = false;
                            if (tabelTerpilih === 'roles' && String(baris.nama_role).toLowerCase() === 'root') {
                              isProtectedRoot = true;
                            } else if (tabelTerpilih === 'user_role') {
                              const namaRole = opsiRoles.find(r => r.id == baris.role_id)?.nama_role || '';
                              if (String(namaRole).toLowerCase() === 'root') {
                                isProtectedRoot = true;
                              }
                            }

                            return (
                            <tr 
                              key={baris.id}
                              draggable={tabelTerpilih === 'menus'}
                              onDragStart={(e) => {
                                if (tabelTerpilih === 'menus') {
                                  handleDragStart(e, index);
                                }
                              }}
                              onDragOver={(e) => {
                                if (tabelTerpilih === 'menus') {
                                  handleDragOver(e, index);
                                }
                              }}
                              onDrop={(e) => {
                                if (tabelTerpilih === 'menus') {
                                  handleDrop(e, index);
                                }
                              }}
                              style={tabelTerpilih === 'menus' ? { cursor: 'grab' } : {}}
                              className={tabelTerpilih === 'menus' && draggingIndex === index ? 'opacity-50' : ''}
                            >
                              {renderSelTabel(tabelTerpilih, baris, index)}
                              <td>
                                <div className="d-flex gap-2 align-items-center">


                                  {canUpdate && !isProtectedRoot && (
                                    <button 
                                      onClick={() => bukaModalForm(baris)} 
                                      className="btn-ikon-premium text-primary border-0" 
                                      style={{ width: '30px', height: '30px' }}
                                      title="Edit"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                  )}
                                  {canDelete && !isProtectedRoot && (
                                    <button 
                                      onClick={() => tanganiHapus(baris)} 
                                      className="btn-ikon-premium bahaya border-0" 
                                      style={{ width: '30px', height: '30px' }}
                                      title="Hapus"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {menuAktif === 'transaksi' && (
                <div className="kartu-premium fade-in p-4 text-center">
                  <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                    <ShoppingCart size={40} style={{ color: 'var(--warna-utama)' }} />
                  </div>
                  <h4 className="fw-bold mb-2">Modul Kasir & POS</h4>
                  <p className="text-muted small mx-auto" style={{ maxWidth: '400px' }}>
                    Sistem Penjualan dan Kasir Modular mPOS Pro. Di sini kasir dapat melakukan pencatatan transaksi penjualan secara real-time.
                  </p>
                  <button onClick={() => ui.notif('info', 'Fitur POS segera hadir pada pembaruan tahap berikutnya!')} className="tombol-premium mt-2" style={{ fontSize: '0.82rem', padding: '0.45rem 1.25rem' }}>
                    Buka Kasir
                  </button>
                </div>
              )}

              {menuAktif === 'laporan' && (
                <div className="kartu-premium fade-in p-4 text-center">
                  <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                    <BarChart2 size={40} style={{ color: 'var(--warna-utama)' }} />
                  </div>
                  <h4 className="fw-bold mb-2">Analisis & Laporan</h4>
                  <p className="text-muted small mx-auto" style={{ maxWidth: '400px' }}>
                    Laporan penjualan harian, omset laba-rugi, dan ringkasan performa unit usaha Anda dalam bentuk grafik interaktif.
                  </p>
                  <button onClick={() => ui.notif('info', 'Modul analisis laporan sedang disiapkan!')} className="tombol-premium mt-2" style={{ fontSize: '0.82rem', padding: '0.45rem 1.25rem' }}>
                    Unduh Laporan
                  </button>
                </div>
              )}

              {menuAktif === 'pengaturan' && (
                <div className="kartu-premium fade-in p-4 text-center">
                  <div className="d-inline-flex p-3 rounded-circle mb-3" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                    <Settings size={40} style={{ color: 'var(--warna-utama)' }} />
                  </div>
                  <h4 className="fw-bold mb-2">Pengaturan Sistem</h4>
                  <p className="text-muted small mx-auto" style={{ maxWidth: '400px' }}>
                    Konfigurasi multi-tenant, unit usaha, hak akses karyawan/kasir, dan integrasi perangkat Smart IoT hardware.
                  </p>
                  <button onClick={() => ui.notif('info', 'Modul konfigurasi sistem segera diluncurkan!')} className="tombol-premium mt-2" style={{ fontSize: '0.82rem', padding: '0.45rem 1.25rem' }}>
                    Kelola Sistem
                  </button>
                </div>
              )}

              {menuAktif === 'pengaturan_notifikasi' && (
                <div className="kartu-premium fade-in p-4" style={{ maxWidth: '650px', margin: '0 auto' }}>
                  <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--warna-border)' }}>
                    <div className="p-2 rounded-circle" style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}>
                      <Bell size={24} style={{ color: 'var(--warna-utama)' }} />
                    </div>
                    <div>
                      <h5 className="fw-bold mb-1 text-main" style={{ fontSize: '1.05rem' }}>Pengaturan Notifikasi</h5>
                      <p className="text-muted m-0" style={{ fontSize: 'calc(0.68rem + 0.1vw)' }}>
                        Konfigurasikan notifikasi sistem absensi otomatis untuk unit usaha Anda.
                      </p>
                    </div>
                  </div>

                  {loadingPengaturanNotif ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary spinner-border-sm" role="status" />
                      <p className="text-muted mt-2 small">Memuat pengaturan...</p>
                    </div>
                  ) : pengaturanNotif.length === 0 ? (
                    <div className="text-center text-muted py-4 small">
                      Tidak ada konfigurasi notifikasi yang tersedia.
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3 mb-4">
                      {pengaturanNotif.map(item => {
                        const isChecked = !!localSettings[item.kunci];
                        return (
                          <div 
                            key={item.kunci} 
                            className="p-3 rounded-3 d-flex justify-content-between align-items-center hover-bg"
                            style={{ 
                              border: '1px solid var(--warna-border)',
                              backgroundColor: isChecked ? 'rgba(var(--warna-utama-rgb), 0.02)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ maxWidth: '80%' }}>
                              <span className="fw-bold text-main d-block mb-1" style={{ fontSize: '0.82rem' }}>
                                {item.kunci === 'notif_absen_masuk' && 'Notifikasi Absen Masuk'}
                                {item.kunci === 'notif_absen_pulang' && 'Notifikasi Absen Pulang'}
                                {item.kunci === 'notif_absen_terlambat' && 'Notifikasi Keterlambatan'}
                                {item.kunci === 'notif_absen_luar_lokasi' && 'Notifikasi Absen Di Luar Radius'}
                                {item.kunci === 'notif_perizinan_baru' && 'Notifikasi Pengajuan Izin Baru'}
                                {item.kunci === 'notif_perizinan_persetujuan' && 'Notifikasi Persetujuan Izin'}
                              </span>
                              <span className="text-muted d-block text-wrap" style={{ fontSize: '0.72rem', lineHeight: '1.3' }}>
                                {item.deskripsi}
                              </span>
                            </div>
                            <div className="form-check form-switch p-0 m-0">
                              <input
                                className="form-check-input cursor-pointer"
                                type="checkbox"
                                role="switch"
                                checked={isChecked}
                                onChange={() => handleToggleNotif(item.kunci)}
                                style={{ width: '2.4em', height: '1.2em' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!loadingPengaturanNotif && pengaturanNotif.length > 0 && (
                    <div className="d-flex justify-content-end gap-2 border-top pt-3" style={{ borderColor: 'var(--warna-border)' }}>
                      <button 
                        onClick={() => {
                          const initial = {};
                          pengaturanNotif.forEach(item => {
                            initial[item.kunci] = item.nilai === 1;
                          });
                          setLocalSettings(initial);
                        }}
                        disabled={menyimpanPengaturanNotif}
                        className="tombol-sekunder-premium"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 1.1rem' }}
                      >
                        Reset
                      </button>
                      <button 
                        onClick={() => simpanPengaturanNotif(localSettings)}
                        disabled={menyimpanPengaturanNotif}
                        className="tombol-premium"
                        style={{ fontSize: '0.78rem', padding: '0.45rem 1.25rem' }}
                      >
                        {menyimpanPengaturanNotif ? 'Menyimpan...' : 'Simpan Pengaturan'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer (Desktop Only) */}
        <footer className="text-center text-muted small py-3 mt-auto d-none d-sm-block" style={{ borderTop: '1px solid var(--warna-border)' }}>
          &copy; 2026 mPOS Pro - Aplikasi ERP & Kasir Multi-Tenant.
        </footer>
      </div>

      {/* Bottombar (Mobile Only) */}
      <nav className="bottombar-premium d-flex d-sm-none justify-content-around align-items-center">
        {(() => {
          // Tambahkan Beranda di awal grup
          const bottomGroups = [
            { grup: 'Beranda', label: 'Beranda', icon: 'Home', menus: [{ url: 'beranda', label: 'Beranda', icon: 'Home' }] },
            ...menuGroups
          ];
          
          return bottomGroups.slice(0, 5).map(grup => {
            const IconComponent = IconMap[grup.icon] || HelpCircle;
            const isActive = grup.menus.some(m => m.url === menuAktif);
            
            return (
              <button 
                key={grup.grup}
                onClick={() => {
                  if (grup.menus.length === 1) {
                     const isNonaktif = grup.menus[0].rp_is_aktif == 0;
                     if (!isNonaktif) {
                       setMenuAktif(grup.menus[0].url);
                       setMobileSubmenuGroup(null);
                     }
                  } else {
                     setMobileSubmenuGroup(mobileSubmenuGroup === grup ? null : grup);
                  }
                }} 
                className={`bottombar-item-premium ${isActive ? 'aktif' : ''} ${(grup.menus.length === 1 && grup.menus[0].rp_is_aktif == 0) ? 'text-muted' : ''}`}
                style={{ flex: 1, padding: '0.5rem 0.2rem' }}
              >
                <IconComponent size={20} />
                <span style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', textAlign: 'center' }}>
                  {grup.label}
                </span>
              </button>
            );
          });
        })()}
      </nav>

      {/* Mobile Submenu Overlay */}
      {mobileSubmenuGroup && (
        <>
          <div 
            className="mobile-submenu-backdrop d-sm-none" 
            onClick={() => setMobileSubmenuGroup(null)}
          ></div>
          <div className="mobile-submenu-overlay d-sm-none">
            {mobileSubmenuGroup.menus.map(m => {
              const MIcon = IconMap[m.icon] || HelpCircle;
              const isAktif = menuAktif === m.url;
              const isNonaktif = m.rp_is_aktif == 0;
              return (
                <button 
                  key={m.url}
                  onClick={() => { 
                    if (!isNonaktif) {
                      setMenuAktif(m.url); 
                      setMobileSubmenuGroup(null); 
                    }
                  }}
                  className={`w-100 d-flex align-items-center justify-content-start gap-3 p-3 ${isAktif ? 'tombol-premium' : 'tombol-sekunder-premium'} ${isNonaktif ? 'opacity-50' : ''}`}
                  style={{ borderRadius: '12px', border: 'none', textAlign: 'left', cursor: isNonaktif ? 'not-allowed' : 'pointer' }}
                >
                  <MIcon size={18} />
                  <span className="fw-semibold">{m.label} {isNonaktif && <span className="badge bg-secondary ms-1" style={{ fontSize: '0.6rem' }}>Nonaktif</span>}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
      {/* ===== MODAL ABSENSI ===== */}
      {showAbsenModal && (() => {
        const usahaData = opsiUsaha.find(u => u.id == profile?.usaha_id);
        const tokoLat = parseFloat(usahaData?.latitude);
        const tokoLng = parseFloat(usahaData?.longitude);
        const radiusAbsen = parseFloat(usahaData?.radius_absen) || 100;
        const adaKoordToko = !isNaN(tokoLat) && !isNaN(tokoLng) && tokoLat !== 0 && tokoLng !== 0;
        const isRoot = profile?.role?.toLowerCase() === 'root';

        let lokasiValid = true;
        if (adaKoordToko && gpsDistance !== null && !isRoot) {
          lokasiValid = gpsDistance <= radiusAbsen;
        }
        const sudahAbsenMasuk = !!todayAbsensi?.jam_masuk;
        const sudahAbsenPulang = !!todayAbsensi?.jam_pulang;

        const formatWaktu = (dt) => {
          if (!dt) return '-';
          const d = new Date(dt);
          return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        };

        return (
          <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{
              zIndex: 9995,
              backgroundColor: 'rgba(11, 15, 25, 0.7)',
              backdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease forwards'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAbsenModal(false); }}
          >
            <div className="kartu-premium fade-in w-100" style={{ maxWidth: '420px', padding: '1.5rem', boxSizing: 'border-box' }}>
              {/* Header Modal */}
              <div className="d-flex align-items-center justify-content-between pb-3 mb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
                <div className="d-flex align-items-center gap-2">
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCheck size={17} style={{ color: 'var(--warna-utama)' }} />
                  </div>
                  <div>
                    <h4 className="fw-bold mb-0 text-main" style={{ fontSize: '0.88rem' }}>Absensi Karyawan</h4>
                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAbsenModal(false)}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid var(--warna-bahaya)', background: 'rgba(239,68,68,0.08)', color: 'var(--warna-bahaya)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >✕</button>
              </div>

              {/* Info Karyawan */}
              <div className="d-flex align-items-center gap-3 mb-3 p-2 rounded-2" style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--warna-utama)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{profile?.nama?.charAt(0)?.toUpperCase() || 'K'}</span>
                </div>
                <div>
                  <div className="fw-bold text-main" style={{ fontSize: '0.82rem' }}>{profile?.nama || '-'}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{profile?.role || '-'} · {usahaData?.nama_usaha || 'Semua Usaha'}</div>
                </div>
              </div>

              {/* Status GPS */}
              <div className="mb-3 p-2 rounded-2" style={{ border: '1px solid var(--warna-border)' }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--warna-teks-utama)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📡 Status Lokasi</span>
                  {gpsLoading && <span className="spinner-border spinner-border-sm" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />}
                </div>

                {gpsLoading && (
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>Mendeteksi posisi GPS Anda...</div>
                )}

                {gpsError && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--warna-bahaya)' }}>⚠ {gpsError}</div>
                )}

                {!gpsLoading && gpsCoords && (
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '0.72rem', color: 'var(--warna-teks-sekunder)' }}>
                        📍 {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                      </span>
                    </div>
                    {adaKoordToko && gpsDistance !== null && (
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span
                          className="badge"
                          style={{ fontSize: '0.7rem', backgroundColor: lokasiValid ? '#16a34a' : '#dc2626', color: '#fff', padding: '2px 8px' }}
                        >
                          {lokasiValid ? '✓ Lokasi Valid' : '✗ Di Luar Radius'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--warna-teks-sekunder)' }}>
                          {gpsDistance}m dari toko (radius: {radiusAbsen}m)
                        </span>
                      </div>
                    )}
                    {!adaKoordToko && (
                      <div className="mt-1" style={{ fontSize: '0.72rem', color: '#ca8a04' }}>⚠ Koordinat toko belum diatur — validasi radius dinonaktifkan.</div>
                    )}
                    {isRoot && adaKoordToko && gpsDistance !== null && !lokasiValid && (
                      <div className="mt-1" style={{ fontSize: '0.72rem', color: '#6366f1' }}>ℹ Root dapat absen dari mana saja.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Status Absensi Hari Ini */}
              {absenFetching ? (
                <div className="text-center py-2" style={{ fontSize: '0.75rem', color: 'var(--warna-teks-sekunder)' }}>
                  <span className="spinner-border spinner-border-sm me-2" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                  Memeriksa absensi hari ini...
                </div>
              ) : (
                <div className="mb-3 p-2 rounded-2" style={{ border: '1px solid var(--warna-border)' }}>
                  <div className="mb-1" style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--warna-teks-utama)' }}>📋 Rekap Hari Ini</div>
                  <div className="d-flex gap-3">
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Masuk</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: sudahAbsenMasuk ? '#16a34a' : 'var(--warna-teks-sekunder)', fontFamily: 'monospace' }}>
                        {sudahAbsenMasuk ? formatWaktu(todayAbsensi.jam_masuk) : '--:--'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Pulang</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: sudahAbsenPulang ? '#6366f1' : 'var(--warna-teks-sekunder)', fontFamily: 'monospace' }}>
                        {sudahAbsenPulang ? formatWaktu(todayAbsensi.jam_pulang) : '--:--'}
                      </div>
                    </div>
                    {sudahAbsenMasuk && (
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Status</div>
                        <div style={{ fontSize: '0.72rem' }}>
                          {{
                            tepat_waktu: <span style={{ color: '#16a34a', fontWeight: 600 }}>Tepat Waktu</span>,
                            lebih_awal: <span style={{ color: '#0891b2', fontWeight: 600 }}>Lebih Awal</span>,
                            terlambat: <span style={{ color: '#dc2626', fontWeight: 600 }}>Terlambat</span>,
                          }[todayAbsensi.status_kehadiran] || <span>{todayAbsensi.status_kehadiran}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tombol Aksi */}
              <div className="d-flex flex-column gap-2">
                {!sudahAbsenMasuk && (
                  <button
                    onClick={tanganiAbsenMasuk}
                    disabled={absenLoading || gpsLoading || (!lokasiValid && adaKoordToko && !isRoot)}
                    className="tombol-premium w-100 d-flex align-items-center justify-content-center gap-2"
                    style={{ fontSize: '0.82rem', padding: '0.6rem', opacity: (absenLoading || gpsLoading || (!lokasiValid && adaKoordToko && !isRoot)) ? 0.5 : 1 }}
                  >
                    {absenLoading ? <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <UserCheck size={16} />}
                    Absen Masuk Sekarang
                  </button>
                )}

                {sudahAbsenMasuk && !sudahAbsenPulang && (
                  <button
                    onClick={tanganiAbsenPulang}
                    disabled={absenLoading || gpsLoading}
                    className="tombol-premium w-100 d-flex align-items-center justify-content-center gap-2"
                    style={{ fontSize: '0.82rem', padding: '0.6rem', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', opacity: (absenLoading || gpsLoading) ? 0.5 : 1 }}
                  >
                    {absenLoading ? <span className="spinner-border spinner-border-sm" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <LogOut size={16} />}
                    Absen Pulang Sekarang
                  </button>
                )}

                {sudahAbsenPulang && (
                  <div className="text-center py-2" style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                    ✅ Absensi hari ini sudah selesai.
                  </div>
                )}

                <button
                  onClick={() => setShowAbsenModal(false)}
                  className="tombol-sekunder-premium w-100"
                  style={{ fontSize: '0.78rem', padding: '0.4rem' }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== MODAL FORM — dirender di sini agar opsi selalu segar (tidak lewat UIContext) ===== */}
      {modalFormState && (
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
              <h4 className="fw-bold mb-0 text-main" style={{ fontSize: '0.9rem' }}>{modalFormState.title}</h4>
              <button
                onClick={tutupModalForm}
                style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  border: '1.5px solid var(--warna-bahaya)',
                  background: 'rgba(239,68,68,0.08)',
                  color: 'var(--warna-bahaya)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0
                }}
                title="Tutup"
              >✕</button>
            </div>
            <ModalForm
              tabel={modalFormState.tabel}
              isEdit={modalFormState.isEdit}
              dataAwal={modalFormState.nilaiAwal}
              onSimpan={tanganiSimpan}
              onBatal={tutupModalForm}
              onError={(pesan) => ui.notif('gagal', pesan)}
              opsiUsaha={opsiUsaha}
              opsiUsers={opsiUsers}
              opsiUnit={opsiUnit}
              opsiRoles={opsiRoles}
              opsiMenus={opsiMenus}
              opsiIot={opsiIot}
              opsiAlokasi={opsiAlokasi}
              opsiShift={opsiShift}
              opsiKriteriaPoin={opsiKriteriaPoin}
              opsiJadwal={opsiJadwal}
              profile={profile}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
