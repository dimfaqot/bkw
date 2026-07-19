import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useUI, LazyLoading } from '../contexts/UIContext.jsx';
import { 
  LogOut, User, Users, Shield, Briefcase, Phone, Mail, Sun, Moon, Edit3, HelpCircle, 
  Layers, Menu, Home, ShoppingCart, BarChart2, Settings, Database, Trash2, Plus, Calendar, MapPin, RefreshCw, UserCheck, Clock,
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

const formatRupiah = (val) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(val || 0));
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
    return matched ? String(matched.label || '') : '';
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
          const matched = options.find(opt => String(opt.label || '').toLowerCase() === String(currentCari || '').toLowerCase());
          if (matched) {
            setCari(String(matched.label || ''));
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
      const targetLabel = matched ? String(matched.label || '') : '';
      if (matched && cari !== targetLabel) {
        setCari(targetLabel);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const filteredOptions = options.filter(opt => 
    String(opt.label || '').toLowerCase().includes(String(cari || '').toLowerCase())
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

const ModalForm = ({ tabel, isEdit, dataAwal, onSimpan, onBatal, onError, opsiUsaha, opsiUsers, opsiUnit, opsiRoles, opsiMenus, opsiIot = [], opsiAlokasi = [], opsiShift = [], opsiKriteriaPoin = [], opsiJadwal = [], opsiProduk = [], profile }) => {
  const [formState, setFormState] = useState(dataAwal);
  const [shiftTersedia, setShiftTersedia] = useState([]);
  const [loadingShift, setLoadingShift] = useState(false);
  const [pesanLibur, setPesanLibur] = useState('');

  const isRoot = profile?.role?.toLowerCase() === 'root';

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
    } else if (tabel === 'lembur') {
      dataAkhir.karyawan_id = ekstrakId(dataAkhir.karyawan_id, opsiUsers.map(u => ({ value: u.id, label: u.nama })));
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
    } else if (tabel === 'produk_jasa') {
      dataAkhir.usaha_id = ekstrakId(dataAkhir.usaha_id, opsiUsaha.map(u => ({ value: u.id, label: u.nama_usaha })));
      dataAkhir.unit_id = ekstrakId(dataAkhir.unit_id, opsiUnit.map(u => ({ value: u.id, label: u.nama_unit })));
    } else if (tabel === 'produk_komposisi') {
      dataAkhir.produk_induk_id = ekstrakId(dataAkhir.produk_induk_id, opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} [${p.tipe}]` })));
      
      if (isEdit) {
        dataAkhir.produk_bahan_id = ekstrakId(dataAkhir.produk_bahan_id, opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} (${p.stok || 0} ${p.satuan})` })));
      } else {
        // Ekstrak ID untuk setiap baris bahan baku
        dataAkhir.bahan = (dataAkhir.bahan || []).map(item => ({
          produk_bahan_id: ekstrakId(item.produk_bahan_id, opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} (${p.stok || 0} ${p.satuan})` }))),
          jumlah: item.jumlah
        }));
      }
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
      if (!dataAkhir.kategori) { onError('Kategori unit wajib dipilih.'); return; }
    } else if (tabel === 'produk_jasa') {
      if (!dataAkhir.nama_produk?.trim()) { onError('Nama produk/jasa wajib diisi.'); return; }
      if (!dataAkhir.harga_jual) { onError('Harga jual wajib diisi.'); return; }
    } else if (tabel === 'produk_komposisi') {
      if (!dataAkhir.produk_induk_id) { onError('Silakan pilih produk menu utama.'); return; }
      
      if (isEdit) {
        if (!dataAkhir.produk_bahan_id) { onError('Silakan pilih produk bahan baku.'); return; }
        if (!dataAkhir.jumlah || Number(dataAkhir.jumlah) <= 0) { onError('Jumlah takaran wajib diisi dan bernilai positif.'); return; }
      } else {
        if (!dataAkhir.bahan || dataAkhir.bahan.length === 0) { onError('Silakan tambah minimal 1 bahan baku.'); return; }
        for (let i = 0; i < dataAkhir.bahan.length; i++) {
          const item = dataAkhir.bahan[i];
          if (!item.produk_bahan_id) { onError(`Silakan pilih bahan baku pada baris ke-${i+1}.`); return; }
          if (!item.jumlah || Number(item.jumlah) <= 0) { onError(`Jumlah takaran pada baris ke-${i+1} wajib diisi dan bernilai positif.`); return; }
        }
      }
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
    } else if (tabel === 'lembur') {
      if (!dataAkhir.karyawan_id) { onError('Silakan pilih Karyawan.'); return; }
      if (!dataAkhir.usaha_id) { onError('Silakan pilih Usaha.'); return; }
      if (!dataAkhir.tanggal) { onError('Tanggal lembur wajib diisi.'); return; }
      if (!dataAkhir.jam_mulai) { onError('Jam mulai lembur wajib diisi.'); return; }
      if (!dataAkhir.jam_selesai) { onError('Jam selesai lembur wajib diisi.'); return; }

      // Validasi tabrakan shift
      const dateParts = dataAkhir.tanggal.split('-');
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10) - 1;
      const d = parseInt(dateParts[2], 10);
      const dateObj = new Date(y, m, d);
      const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];

      const liburHariIni = opsiJadwal.find(
        j => j.karyawan_id == dataAkhir.karyawan_id && j.hari === namaHari
      );

      if (!liburHariIni) {
        const jadwalRutin = opsiJadwal.find(
          j => j.karyawan_id == dataAkhir.karyawan_id && (!j.hari || j.hari === '')
        );
        if (jadwalRutin) {
          const shiftObj = opsiShift.find(s => s.id == jadwalRutin.shift_id);
          if (shiftObj) {
            const timeToMinutes = (t) => {
              if (!t) return 0;
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            const s1 = timeToMinutes(shiftObj.jam_mulai);
            let e1 = timeToMinutes(shiftObj.jam_selesai);
            const s2 = timeToMinutes(dataAkhir.jam_mulai);
            let e2 = timeToMinutes(dataAkhir.jam_selesai);

            if (e1 < s1) e1 += 1440;
            if (e2 < s2) e2 += 1440;

            if (s1 < e2 && s2 < e1) {
              onError(`Gagal menyimpan: Jam lembur bertabrakan dengan jadwal shift kerja karyawan (${shiftObj.nama_shift}: ${shiftObj.jam_mulai.substring(0, 5)} - ${shiftObj.jam_selesai.substring(0, 5)})!`);
              return;
            }
          }
        }
      }
    }
    onSimpan(dataAkhir);
  };

  // Dynamic overlap check for lembur warning
  let infoTabrakanShift = null;
  if (tabel === 'lembur' && formState?.karyawan_id && formState?.tanggal && formState?.jam_mulai && formState?.jam_selesai) {
    const dateParts = formState.tanggal.split('-');
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10) - 1;
    const d = parseInt(dateParts[2], 10);
    const dateObj = new Date(y, m, d);
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];

    const liburHariIni = opsiJadwal.find(
      j => j.karyawan_id == formState.karyawan_id && j.hari === namaHari
    );

    if (!liburHariIni) {
      const jadwalRutin = opsiJadwal.find(
        j => j.karyawan_id == formState.karyawan_id && (!j.hari || j.hari === '')
      );
      if (jadwalRutin) {
        const shiftObj = opsiShift.find(s => s.id == jadwalRutin.shift_id);
        if (shiftObj) {
          const timeToMinutes = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          const s1 = timeToMinutes(shiftObj.jam_mulai);
          let e1 = timeToMinutes(shiftObj.jam_selesai);
          const s2 = timeToMinutes(formState.jam_mulai);
          let e2 = timeToMinutes(formState.jam_selesai);

          if (e1 < s1) e1 += 1440;
          if (e2 < s2) e2 += 1440;

          if (s1 < e2 && s2 < e1) {
            infoTabrakanShift = `${shiftObj.nama_shift} (${shiftObj.jam_mulai.substring(0, 5)} - ${shiftObj.jam_selesai.substring(0, 5)})`;
          }
        }
      }
    }
  }

  // Dynamic shift guide for lembur
  let petunjukShift = null;
  let isShiftExist = false;
  if (tabel === 'lembur' && formState?.karyawan_id && formState?.tanggal) {
    const dateParts = formState.tanggal.split('-');
    const y = parseInt(dateParts[0], 10);
    const m = parseInt(dateParts[1], 10) - 1;
    const d = parseInt(dateParts[2], 10);
    const dateObj = new Date(y, m, d);
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];

    const liburHariIni = opsiJadwal.find(
      j => j.karyawan_id == formState.karyawan_id && j.hari === namaHari
    );

    if (!liburHariIni) {
      const jadwalRutin = opsiJadwal.find(
        j => j.karyawan_id == formState.karyawan_id && (!j.hari || j.hari === '')
      );
      if (jadwalRutin) {
        const shiftObj = opsiShift.find(s => s.id == jadwalRutin.shift_id);
        if (shiftObj) {
          isShiftExist = true;
          petunjukShift = `Shift Kerja: ${shiftObj.nama_shift} (${shiftObj.jam_mulai.substring(0, 5)} - ${shiftObj.jam_selesai.substring(0, 5)})`;
        }
      }
    }
  }

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
              <label className="form-label small fw-semibold">Kode Usaha</label>
              <input type="text" name="kode_usaha" className="form-control input-premium" value={formState.kode_usaha || ''} onChange={handleChange} placeholder="cth: BKW (maks. 50 karakter)" />
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
            <div className="mt-3">
              <label className="form-label small fw-semibold">Logo Usaha (Format Gambar, Maks. 2MB)</label>
              <input
                type="file"
                name="logo_file"
                accept="image/*"
                className="form-control input-premium"
                onChange={(e) => {
                  const file = e.target.files[0];
                  setFormState(prev => ({ ...prev, logo: file }));
                }}
              />
              {formState.id && typeof formState.logo === 'string' && formState.logo && (
                <div className="small text-muted mt-1 d-flex align-items-center gap-2">
                  <span>Logo Aktif:</span>
                  <img
                    src={`http://localhost:8080/api/ambil-logo/${formState.logo}`}
                    alt="Logo Usaha"
                    style={{ height: '30px', objectFit: 'contain', borderRadius: '4px' }}
                  />
                  <code>{formState.logo}</code>
                </div>
              )}
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
            <div>
              <label className="form-label small fw-semibold">Kode Unit</label>
              <input type="text" name="kode_unit" className="form-control input-premium" value={formState.kode_unit || ''} onChange={handleChange} placeholder="cth: KTN (maks. 50 karakter)" />
            </div>
            <div>
              <label className="form-label small fw-semibold">Kategori Unit (Fitur)</label>
              <PilihRelasi
                name="kategori"
                placeholder="Pilih kategori unit..."
                value={formState.kategori || ''}
                onChange={handleChange}
                dropUp={true}
                options={[
                  { value: 'kantin', label: '💼 Kantin (F&B / Kelola Stok)' },
                  { value: 'billiard', label: '🎱 Billiard (IoT & Sewa Jam-Jaman)' },
                  { value: 'rental_mobil', label: '🚗 Rental Mobil (Sewa Aset & Opsi Tambahan)' },
                  { value: 'salon', label: '💅 Salon (Jasa Treatment & Stylist)' },
                  { value: 'multimedia', label: '📸 Multimedia (Studio & Hybrid POS)' },
                  { value: 'cuci_kendaraan', label: '🧼 Cuci Kendaraan (Antrean Layanan & Komisi)' }
                ]}
              />
            </div>
          </>
        )}
        {tabel === 'produk_jasa' && (
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
              <label className="form-label small fw-semibold">Pilih Unit Cabang</label>
              <PilihRelasi
                name="unit_id"
                placeholder="Pilih unit cabang..."
                value={formState.unit_id || ''}
                onChange={handleChange}
                options={opsiUnit.filter(u => u.usaha_id == (formState.usaha_id || profile?.usaha_id)).map(u => ({ value: u.id, label: u.nama_unit }))}
              />
            </div>
            <div>
              <label className="form-label small fw-semibold">Tipe Produk / Layanan</label>
              <select
                name="tipe"
                className="form-select input-premium"
                value={formState.tipe || ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormState(prev => ({
                    ...prev,
                    tipe: val,
                    is_stok_dikelola: val === 'barang' ? '' : '0',
                    butuh_persiapan: '0'
                  }));
                }}
              >
                <option value="">-- Pilih Tipe --</option>
                <option value="barang">📦 Barang Fisik</option>
                <option value="jasa">💅 Layanan Jasa</option>
                <option value="sewa">🚗 Sewa Alat/Aset</option>
              </select>
            </div>

            {formState.tipe === 'barang' && (
              <div className="fade-in mt-3">
                <label className="form-label small fw-semibold">Kelola Stok?</label>
                <select
                  name="is_stok_dikelola"
                  className="form-select input-premium"
                  value={formState.is_stok_dikelola ?? ''}
                  onChange={e => {
                    const val = e.target.value;
                    setFormState(prev => ({ ...prev, is_stok_dikelola: val }));
                  }}
                >
                  <option value="">-- Kelola Stok? --</option>
                  <option value="0">Tidak (Stok Tanpa Batas / Jasa)</option>
                  <option value="1">Ya (Barang Fisik)</option>
                </select>
              </div>
            )}

            {formState.tipe === 'barang' && formState.is_stok_dikelola !== '' && (
              <div className="d-flex align-items-center justify-content-between p-2 rounded mt-3 fade-in" style={{background:'var(--bg-card)', border:'1px solid var(--border-color)'}}>
                <div>
                  <div className="small fw-semibold">🍳 Butuh Persiapan / Dapur</div>
                  <div className="text-muted" style={{fontSize:'0.72rem'}}>Aktifkan jika produk perlu diolah dulu (masuk antrean Job Board)</div>
                </div>
                <div className="form-check form-switch mb-0 ms-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="switchButuhPersiapan"
                    checked={formState.butuh_persiapan == '1'}
                    onChange={e => {
                      const val = e.target.checked ? '1' : '0';
                      setFormState(prev => ({ ...prev, butuh_persiapan: val }));
                    }}
                    style={{width:'2.5em', height:'1.3em', cursor:'pointer'}}
                  />
                </div>
              </div>
            )}

            {((formState.tipe && formState.tipe !== 'barang') ||
              (formState.tipe === 'barang' && formState.is_stok_dikelola !== '')) && (
              <div className="fade-in mt-3 pt-3 border-top" style={{ borderColor: 'var(--warna-border)' }}>
                <div>
                  <label className="form-label small fw-semibold">Nama Produk / Jasa / Sewa</label>
                  <input type="text" name="nama_produk" className="form-control input-premium" value={formState.nama_produk || ''} onChange={handleChange} placeholder="cth: Kopi Susu, Sewa Meja, Potong Rambut" />
                </div>
                {formState.tipe === 'barang' && (
                  <div>
                    <label className="form-label small fw-semibold">Harga Beli (HPP)</label>
                    <input type="number" name="harga_beli" className="form-control input-premium" value={formState.harga_beli || '0'} onChange={handleChange} />
                  </div>
                )}
                <div>
                  <label className="form-label small fw-semibold">Harga Jual</label>
                  <input type="number" name="harga_jual" className="form-control input-premium" value={formState.harga_jual || '0'} onChange={handleChange} />
                </div>
                {formState.tipe === 'barang' && formState.is_stok_dikelola == '1' && (
                  <>
                    <div>
                      <label className="form-label small fw-semibold">Stok Saat Ini</label>
                      <input type="number" name="stok" className="form-control input-premium" value={formState.stok ?? '0'} onChange={handleChange} />
                    </div>
                    <div>
                      <label className="form-label small fw-semibold">Minimum Stok Alert</label>
                      <input type="number" name="stok_minimum" className="form-control input-premium" value={formState.stok_minimum ?? '0'} onChange={handleChange} />
                    </div>
                  </>
                )}
                <div>
                  <label className="form-label small fw-semibold">Satuan</label>
                  <input type="text" name="satuan" className="form-control input-premium" value={formState.satuan ?? 'pcs'} onChange={handleChange} placeholder="pcs, porsi, jam, hari" />
                </div>
              </div>
            )}
          </>
        )}
        {tabel === 'produk_komposisi' && (
          <>
            <div>
              <label className="form-label small fw-semibold">Pilih Menu Produk (Induk)</label>
              <PilihRelasi
                name="produk_induk_id"
                placeholder="Pilih produk utama yang dijual..."
                value={formState.produk_induk_id || ''}
                onChange={handleChange}
                options={opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} [${p.tipe}]` }))}
              />
            </div>

            <div className="mt-3">
              <label className="form-label small fw-semibold d-flex justify-content-between align-items-center mb-2">
                <span>Daftar Bahan Baku / Penunjang</span>
                {!isEdit && (
                  <button
                    type="button"
                    className="tombol-premium py-1 px-2"
                    style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => {
                      const newBahan = [...(formState.bahan || [])];
                      newBahan.push({ produk_bahan_id: '', jumlah: '1.00' });
                      setFormState(prev => ({ ...prev, bahan: newBahan }));
                    }}
                  >
                    + Tambah Bahan Baku
                  </button>
                )}
              </label>

              {isEdit ? (
                // Mode Edit: Hanya mengedit satu bahan yang dipilih
                <div className="p-3 rounded-3 mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--warna-border)' }}>
                  <div>
                    <label className="form-label small text-muted">Bahan Mentah / Penunjang</label>
                    <PilihRelasi
                      name="produk_bahan_id"
                      placeholder="Pilih bahan baku/wadah..."
                      value={formState.produk_bahan_id || ''}
                      onChange={handleChange}
                      dropUp={true}
                      options={opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} (${p.stok || 0} ${p.satuan})` }))}
                    />
                  </div>
                  <div className="mt-2">
                    <label className="form-label small text-muted">Jumlah Takaran</label>
                    <input type="number" step="any" name="jumlah" className="form-control input-premium" value={formState.jumlah || '1.00'} onChange={handleChange} />
                  </div>
                </div>
              ) : (
                // Mode Tambah Baru: Bisa menambahkan banyak bahan sekaligus secara dinamis
                (formState.bahan || []).map((row, idx) => (
                  <div key={idx} className="p-3 rounded-3 mb-2 d-flex flex-column gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--warna-border)' }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="fw-semibold text-muted" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>BAHAN #{idx + 1}</span>
                      {formState.bahan.length > 1 && (
                        <button
                          type="button"
                          className="btn-ikon-premium px-2 py-1"
                          style={{ color: 'var(--warna-bahaya)', border: 'none', background: 'rgba(239,68,68,0.08)', fontSize: '0.65rem' }}
                          onClick={() => {
                            const newBahan = formState.bahan.filter((_, bIdx) => bIdx !== idx);
                            setFormState(prev => ({ ...prev, bahan: newBahan }));
                          }}
                        >
                          ✕ Hapus
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="form-label small text-muted mb-1">Pilih Bahan Mentah</label>
                      <PilihRelasi
                        name={`produk_bahan_id_${idx}`}
                        placeholder="Pilih bahan baku/wadah..."
                        value={row.produk_bahan_id || ''}
                        onChange={(e) => {
                          const newBahan = [...formState.bahan];
                          newBahan[idx].produk_bahan_id = e.target.value;
                          setFormState(prev => ({ ...prev, bahan: newBahan }));
                        }}
                        dropUp={true}
                        options={opsiProduk.map(p => ({ value: p.id, label: `${p.nama_produk} (${p.stok || 0} ${p.satuan})` }))}
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted mb-1">Jumlah Takaran</label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Jumlah takaran..."
                        className="form-control input-premium"
                        value={row.jumlah || ''}
                        onChange={(e) => {
                          const newBahan = [...formState.bahan];
                          newBahan[idx].jumlah = e.target.value;
                          setFormState(prev => ({ ...prev, bahan: newBahan }));
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
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
            <div>
              <label className="form-label small fw-semibold">Gaji Pokok</label>
              <input
                type="number"
                name="gaji_pokok"
                className="form-control input-premium"
                value={formState.gaji_pokok ?? '0'}
                onChange={handleChange}
                placeholder="cth: 2500000"
              />
            </div>
          </>
        )}
        {tabel === 'pengeluaran' && (
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
              <label className="form-label small fw-semibold">Pilih Unit (Opsional)</label>
              <PilihRelasi
                name="unit_id"
                placeholder="Pengeluaran Global Cabang"
                value={formState.unit_id || ''}
                onChange={handleChange}
                options={opsiUnit.filter(u => u.usaha_id == (formState.usaha_id || profile?.usaha_id)).map(u => ({ value: u.id, label: u.nama_unit }))}
              />
            </div>

            <div>
              <label className="form-label small fw-semibold">Pilih Kategori Pengeluaran</label>
              <select
                name="kategori"
                className="form-select input-premium"
                value={formState.kategori || ''}
                onChange={e => {
                  const val = e.target.value;
                  setFormState(prev => ({
                    ...prev,
                    kategori: val,
                    karyawan_gaji_id: '',
                    produk_id: '',
                    qty: '1',
                    harga_satuan: '0',
                    diskon: '0',
                    nominal_total: '0',
                    deskripsi_keperluan: ''
                  }));
                }}
              >
                <option value="">-- Pilih Kategori --</option>
                <option value="Gaji">💵 Gaji Karyawan</option>
                <option value="Bahan Baku">📦 Bahan Baku / Restok</option>
                <option value="Inv">🏢 Inventaris (Aset)</option>
                <option value="Operasional">⚡ Operasional</option>
                <option value="Lain-lain">⚙️ Lain-lain</option>
              </select>
            </div>

            {formState.kategori === 'Gaji' && (
              <div className="fade-in mt-3">
                <div>
                  <label className="form-label small fw-semibold">Pilih Penerima Gaji</label>
                  <PilihRelasi
                    name="karyawan_gaji_id"
                    placeholder="Pilih karyawan..."
                    value={formState.karyawan_gaji_id || ''}
                    onChange={e => {
                      const empId = e.target.value;
                      // Cari gaji pokok dari user_role milik user tersebut (jika ada)
                      // Kita bisa melacak dari opsiUsers atau relasi opsional lainnya
                      setFormState(prev => ({
                        ...prev,
                        karyawan_gaji_id: empId
                      }));
                    }}
                    options={opsiUsers.map(u => ({ value: u.id, label: `${u.nama} (${u.wa})` }))}
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold">Nominal Gaji</label>
                  <input
                    type="number"
                    name="nominal_total"
                    className="form-control input-premium"
                    value={formState.nominal_total || '0'}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {(formState.kategori === 'Bahan Baku' || formState.kategori === 'Inv') && (
              <div className="fade-in mt-3">
                {formState.kategori === 'Bahan Baku' ? (
                  <div>
                    <label className="form-label small fw-semibold">Pilih Produk / Barang</label>
                    <PilihRelasi
                      name="produk_id"
                      placeholder="Pilih produk untuk restok..."
                      value={formState.produk_id || ''}
                      onChange={handleChange}
                      options={opsiProduk
                        .filter(p => {
                          const kelolaStok = p.is_stok_dikelola == 1 || p.is_stok_dikelola === '1';
                          const matchUnit = !formState.unit_id || p.unit_id == formState.unit_id;
                          return kelolaStok && matchUnit;
                        })
                        .map(p => ({ value: p.id, label: `${p.nama_produk} (Stok: ${p.stok || 0} ${p.satuan})` }))
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <label className="form-label small fw-semibold">Nama Barang / Aset Inventaris</label>
                    <input
                      type="text"
                      name="deskripsi_keperluan"
                      className="form-control input-premium"
                      value={formState.deskripsi_keperluan || ''}
                      onChange={handleChange}
                      placeholder="cth: Kulkas Showcase Polytron, Laptop Admin"
                    />
                  </div>
                )}
                <div className="row g-2 mt-2">
                  <div className="col-4">
                    <label className="form-label small fw-semibold">Jumlah (Qty)</label>
                    <input
                      type="number"
                      name="qty"
                      className="form-control input-premium"
                      value={formState.qty ?? '1'}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="col-8">
                    <label className="form-label small fw-semibold">Harga Satuan</label>
                    <input
                      type="number"
                      name="harga_satuan"
                      className="form-control input-premium"
                      value={formState.harga_satuan || '0'}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold">Diskon / Potongan</label>
                  <input
                    type="number"
                    name="diskon"
                    className="form-control input-premium"
                    value={formState.diskon || '0'}
                    onChange={handleChange}
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold text-muted">Nominal Total (Otomatis)</label>
                  <input
                    type="text"
                    disabled
                    className="form-control input-premium bg-dark text-success fw-bold"
                    value={formatRupiah((Number(formState.harga_satuan || 0) * Number(formState.qty || 1)) - Number(formState.diskon || 0))}
                  />
                </div>
              </div>
            )}

            {(formState.kategori === 'Operasional' || formState.kategori === 'Lain-lain') && (
              <div className="fade-in mt-3">
                <div>
                  <label className="form-label small fw-semibold">Keperluan / Item</label>
                  <input
                    type="text"
                    name="deskripsi_keperluan"
                    className="form-control input-premium"
                    value={formState.deskripsi_keperluan || ''}
                    onChange={handleChange}
                    placeholder="cth: Beli bensin motor operasional, Bayar PDAM"
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold">Nominal Pengeluaran</label>
                  <input
                    type="number"
                    name="nominal_total"
                    className="form-control input-premium"
                    value={formState.nominal_total || '0'}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {formState.kategori !== '' && (
              <div className="fade-in mt-3 pt-3 border-top" style={{ borderColor: 'var(--warna-border)' }}>
                <div>
                  <label className="form-label small fw-semibold">Penanggung Jawab (PIC)</label>
                  <PilihRelasi
                    name="penanggung_jawab_id"
                    placeholder="Pilih penanggung jawab..."
                    value={formState.penanggung_jawab_id || ''}
                    onChange={handleChange}
                    options={opsiUsers.map(u => ({ value: u.id, label: u.nama }))}
                    dropUp={true}
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold">Catatan / Keterangan Tambahan</label>
                  <textarea
                    name="keterangan"
                    className="form-control input-premium"
                    value={formState.keterangan || ''}
                    onChange={handleChange}
                    rows="2"
                    placeholder="cth: Nota hilang, dibeli di toko makmur..."
                  />
                </div>
                <div className="mt-2">
                  <label className="form-label small fw-semibold">Tanggal Pengeluaran</label>
                  <input
                    type="date"
                    name="tanggal"
                    className="form-control input-premium"
                    value={formState.tanggal || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
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

            {isShiftExist && petunjukShift && (
              <div className="alert alert-info p-2 mt-2 mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.75rem', borderRadius: '8px', border: '1px dashed var(--warna-utama)' }}>
                <span>ℹ️</span>
                <span>
                  <strong>Panduan Shift:</strong> {petunjukShift}
                </span>
              </div>
            )}

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

            {infoTabrakanShift && (
              <div className="alert alert-danger p-2 mt-2 mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.75rem', borderRadius: '8px', border: '1px dashed var(--warna-bahaya)' }}>
                <span>⚠️</span>
                <span>
                  <strong>Peringatan:</strong> Jam lembur bertabrakan dengan jadwal shift kerja karyawan: <strong>{infoTabrakanShift}</strong>!
                </span>
              </div>
            )}

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
  const [logoDataUrl, setLogoDataUrl] = useState(null); // base64 data URL logo untuk cetak PDF
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState('');
  const [sidebarTerbuka, setSidebarTerbuka] = useState(true);
  const [menuAktif, setMenuAktif] = useState('beranda');
  const [openAccordion, setOpenAccordion] = useState(null); // Track opened accordion group
  const [mobileSubmenuGroup, setMobileSubmenuGroup] = useState(null); // Track opened mobile submenu
  
  // Job Board States & Handlers
  const [jobBoardList, setJobBoardList] = useState([]);

  const dapatkanEmojiPekerjaan = (kategori) => {
    switch (kategori) {
      case 'kantin':
        return '👨‍🍳';
      case 'cuci_kendaraan':
        return '🧼';
      case 'salon':
        return '💅';
      case 'billiard':
        return '🎱';
      case 'multimedia':
        return '📸';
      case 'rental_mobil':
        return '🚗';
      default:
        return '⚙️';
    }
  };
  
  const ambilJobBoard = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('http://localhost:8080/api/transaksi/job-board', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === 'sukses') {
        setJobBoardList(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching job board:', err);
    }
  }, []);

  const scrollKeJobBoard = useCallback((delay = 400) => {
    setTimeout(() => {
      const element = document.getElementById('job-board-widget');
      if (element) {
        const headerOffset = 75; // Offset for mobile fixed navbar
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, delay);
  }, []);

  const handleKlaimJob = async (detailId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const yakin = await ui.notif('konfirmasi', 'Apakah Anda yakin ingin mengambil/mengerjakan tugas ini?');
    if (!yakin) return;
    ui.loading(true, 'fullscreen', 'Mengambil pekerjaan...');
    try {
      const response = await fetch(`http://localhost:8080/api/transaksi/job-board/klaim/${detailId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      ui.loading(false);
      if (response.ok && data.status === 'sukses') {
        ui.notif('sukses', data.pesan);
        ambilJobBoard();
        fetchTotalPoin();
      } else {
        ui.notif('gagal', data.pesan || 'Gagal mengklaim pekerjaan.');
      }
    } catch (err) {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const handleSelesaiJob = async (detailId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const yakin = await ui.notif('konfirmasi', 'Apakah Anda yakin pekerjaan ini telah selesai dikerjakan?');
    if (!yakin) return;
    ui.loading(true, 'fullscreen', 'Menyelesaikan pekerjaan...');
    try {
      const response = await fetch(`http://localhost:8080/api/transaksi/job-board/selesai/${detailId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      ui.loading(false);
      if (response.ok && data.status === 'sukses') {
        ui.notif('sukses', data.pesan);
        ambilJobBoard();
        fetchTotalPoin();
      } else {
        ui.notif('gagal', data.pesan || 'Gagal menyelesaikan pekerjaan.');
      }
    } catch (err) {
      ui.loading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };
  
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
  const [filterBulanPengeluaran, setFilterBulanPengeluaran] = useState('');
  const [filterTahunPengeluaran, setFilterTahunPengeluaran] = useState('');
  const [filterUnitPengeluaran, setFilterUnitPengeluaran] = useState('');
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
  const [opsiProduk, setOpsiProduk] = useState([]);

  // State khusus untuk Kasir POS
  const [posProducts, setPosProducts] = useState([]);
  const [posLoading, setPosLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [filterUnitPos, setFilterUnitPos] = useState('');
  const [uangJaminanPos, setUangJaminanPos] = useState(0);
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  const [transaksiLoading, setTransaksiLoading] = useState(false);

  const [filterTanggalPos, setFilterTanggalPos] = useState(new Date().toISOString().substring(0, 10));
  const [searchRiwayatQuery, setSearchRiwayatQuery] = useState('');
  const [pembayaranTipePos, setPembayaranTipePos] = useState('lunas'); // lunas / belum_bayar
  const [metodePembayaranPos, setMetodePembayaranPos] = useState('cash'); // cash / qris / tap
  const [pelangganIdPos, setPelangganIdPos] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showDropdownMember, setShowDropdownMember] = useState(false);
  const [showTambahMemberModal, setShowTambahMemberModal] = useState(false);
  const [namaMemberBaru, setNamaMemberBaru] = useState('');
  const [waMemberBaru, setWaMemberBaru] = useState('');
  const [memberBaruTerdaftar, setMemberBaruTerdaftar] = useState(null);
  const [showDetailNotaModal, setShowDetailNotaModal] = useState(false);
  const [selectedTransaksi, setSelectedTransaksi] = useState(null);
  const [waNotaManual, setWaNotaManual] = useState('');

  const [pilihanProdukHutang, setPilihanProdukHutang] = useState('');
  const [pilihanQtyHutang, setPilihanQtyHutang] = useState(1);
  const [metodePelunasanHutang, setMetodePelunasanHutang] = useState('cash');

  // State Laporan Finansial
  const [laporanData, setLaporanData] = useState(null);
  const [laporanLoading, setLaporanLoading] = useState(false);
  const [laporanFilter, setLaporanFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().substring(0, 10),
    end_date: new Date().toISOString().substring(0, 10),
    unit_id: ''
  });
  const [subTabLaporan, setSubTabLaporan] = useState('penjualan');
  const [isCetakMode, setIsCetakMode] = useState(null); // null / 'singkat' / 'detail'

  // Konversi logo usaha ke Data URL agar bisa di-render saat print (gambar tidak di-load dari display:none)
  useEffect(() => {
    const logoNama = profile?.logo_usaha;
    if (!logoNama) { setLogoDataUrl(null); return; }
    const url = `http://localhost:8080/api/ambil-logo/${logoNama}`;
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result);
        reader.readAsDataURL(blob);
      })
      .catch(() => setLogoDataUrl(null));
  }, [profile?.logo_usaha]);

  // Trigger window.print() saat isCetakMode berubah
  useEffect(() => {
    if (isCetakMode) {
      const judulAsli = document.title;
      const urlAsli = window.location.href;
      const timer = setTimeout(() => {
        // Kosongkan judul & URL agar header/footer browser tidak muncul di PDF
        document.title = ' ';
        window.history.replaceState(null, '', '/');
        window.print();
        // Kembalikan setelah dialog cetak selesai
        window.onafterprint = () => {
          document.title = judulAsli;
          window.history.replaceState(null, '', urlAsli);
          window.onafterprint = null;
        };
        setIsCetakMode(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isCetakMode]);

  const ambilLaporanData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLaporanLoading(true);
    try {
      const query = new URLSearchParams({
        start_date: laporanFilter.start_date,
        end_date: laporanFilter.end_date,
        unit_id: laporanFilter.unit_id
      });
      const response = await fetch(`http://localhost:8080/api/manajemen/laporan-ringkasan?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (response.ok && res.status === 'sukses') {
        setLaporanData(res.data);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal memuat data laporan.');
      }
    } catch (err) {
      ui.notif('gagal', 'Kesalahan koneksi saat memuat laporan.');
    } finally {
      setLaporanLoading(false);
    }
  }, [laporanFilter.start_date, laporanFilter.end_date, laporanFilter.unit_id, ui]);

  useEffect(() => {
    if (menuAktif === 'laporan') {
      ambilLaporanData();
    }
  }, [menuAktif, laporanFilter.start_date, laporanFilter.end_date, laporanFilter.unit_id]);

  useEffect(() => {
    if (profile?.usaha_id) {
      const activeUsaha = opsiUsaha?.find(u => u.id == profile.usaha_id);
      const currentLogo = profile.logo_usaha || activeUsaha?.logo;
      
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      
      if (currentLogo) {
        link.href = `http://localhost:8080/api/ambil-logo/${currentLogo}`;
      } else {
        link.href = '/favicon.ico';
      }
    } else {
      let link = document.querySelector("link[rel~='icon']");
      if (link) {
        link.href = '/favicon.ico';
      }
    }
  }, [profile, opsiUsaha]);

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

    const butuhUsaha = bolehBaca('usaha') || bolehBaca('unit') || bolehBaca('user_role') || bolehBaca('iot_alokasi') || bolehBaca('shift') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi') || bolehBaca('kriteria_poin') || bolehBaca('points') || bolehBaca('perizinan') || bolehBaca('produk_jasa') || bolehBaca('transaksi') || bolehBaca('produk_komposisi') || bolehBaca('pengeluaran');
    const butuhUsers = bolehBaca('users') || bolehBaca('user_role') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi') || bolehBaca('points') || bolehBaca('perizinan') || bolehBaca('transaksi') || bolehBaca('transaksi_detail') || bolehBaca('pengeluaran');
    const butuhUnit = bolehBaca('unit') || bolehBaca('user_role') || bolehBaca('iot_alokasi') || bolehBaca('produk_jasa') || bolehBaca('produk_komposisi') || bolehBaca('pengeluaran');
    const butuhRoles = bolehBaca('roles') || bolehBaca('user_role') || bolehBaca('role_permissions');
    const butuhMenus = bolehBaca('menus') || bolehBaca('role_permissions');
    const butuhIot = bolehBaca('iot') || bolehBaca('iot_alokasi');
    const butuhAlokasi = bolehBaca('iot_alokasi');
    const butuhShift = bolehBaca('shift') || bolehBaca('jadwal_karyawan') || bolehBaca('absensi');
    const butuhKriteriaPoin = bolehBaca('kriteria_poin') || bolehBaca('points');
    const butuhJadwal = bolehBaca('jadwal_karyawan') || bolehBaca('absensi');
    const butuhProduk = bolehBaca('produk_jasa') || bolehBaca('produk_komposisi') || bolehBaca('pengeluaran');
    
    const safeFetch = async (url) => {
      try {
        const r = await fetch(url, { headers });
        if (!r.ok) return [];
        const json = await r.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch { return []; }
    };

    // Hanya fetch tabel yang user punya izin baca atau dibutuhkan oleh menu relasional
    const [dUsaha, dUsers, dUnit, dRoles, dMenus, dIot, dAlokasi, dShift, dKriteria, dJadwal, dProduk] = await Promise.all([
      butuhUsaha ? safeFetch('http://localhost:8080/api/manajemen/ambil/usaha') : Promise.resolve([]),
      butuhUsers ? safeFetch(profile?.role?.toLowerCase() === 'kasir' ? 'http://localhost:8080/api/transaksi/members' : 'http://localhost:8080/api/manajemen/ambil/users') : Promise.resolve([]),
      butuhUnit ? safeFetch('http://localhost:8080/api/manajemen/ambil/unit') : Promise.resolve([]),
      butuhRoles ? safeFetch('http://localhost:8080/api/manajemen/ambil/roles') : Promise.resolve([]),
      butuhMenus ? safeFetch('http://localhost:8080/api/manajemen/ambil/menus') : Promise.resolve([]),
      butuhIot ? safeFetch('http://localhost:8080/api/manajemen/ambil/iot') : Promise.resolve([]),
      butuhAlokasi ? safeFetch('http://localhost:8080/api/manajemen/ambil/iot_alokasi') : Promise.resolve([]),
      butuhShift ? safeFetch('http://localhost:8080/api/manajemen/ambil/shift') : Promise.resolve([]),
      butuhKriteriaPoin ? safeFetch('http://localhost:8080/api/manajemen/ambil/kriteria_poin') : Promise.resolve([]),
      butuhJadwal ? safeFetch('http://localhost:8080/api/manajemen/ambil/jadwal_karyawan') : Promise.resolve([]),
      butuhProduk ? safeFetch('http://localhost:8080/api/manajemen/ambil/produk_jasa') : Promise.resolve([])
    ]);

    setOpsiUsaha(dUsaha);
    setOpsiUsers(dUsers);
    setOpsiRoles(dRoles);
    setOpsiMenus(dMenus);
    setOpsiAlokasi(dAlokasi);
    setOpsiShift(dShift);
    setOpsiKriteriaPoin(dKriteria);
    setOpsiJadwal(dJadwal);
    setOpsiProduk(dProduk || []);

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
  const [tipeAbsenAktif, setTipeAbsenAktif] = useState('rutin'); // 'rutin' atau 'lembur'
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
        
        let targetMenu = 'beranda';
        let shouldScrollJobBoard = false;
        
        if (tautan) {
          if (tautan === '/dashboard' || tautan === 'beranda') {
            targetMenu = 'beranda';
            shouldScrollJobBoard = true;
          } else {
            targetMenu = tautan;
          }
        }
        
        setMenuAktif(targetMenu);
        
        if (shouldScrollJobBoard) {
          scrollKeJobBoard(400);
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
      if (menuParam === '/dashboard' || menuParam === 'beranda') {
        setMenuAktif('beranda');
        scrollKeJobBoard(800);
      } else {
        setMenuAktif(menuParam);
      }
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
          ambilJobBoard();
        }

        // B. Jika notifikasi diklik, arahkan ke sub-menu yang ditargetkan secara instan
        if (event.data.type === 'NAVIGATE_MENU') {
          const urlObj = new URL(event.data.url, window.location.origin);
          const menuParam = urlObj.searchParams.get('menu');
          if (menuParam) {
            if (menuParam === '/dashboard' || menuParam === 'beranda') {
              setMenuAktif('beranda');
              scrollKeJobBoard(400);
            } else {
              setMenuAktif(menuParam);
            }
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      };
    }
  }, [ambilNotifikasi, ambilRiwayatPerizinan, ambilJobBoard]);

  // Polling Job Board setiap 10 detik
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || ['member'].includes(profile?.role?.toLowerCase())) return;

    ambilJobBoard();

    const interval = setInterval(() => {
      ambilJobBoard();
    }, 10000);

    return () => clearInterval(interval);
  }, [profile, ambilJobBoard]);

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
    
    if (menuAktif === 'kasir') {
      setTabelTerpilih(null);
      lastTabelRef.current = null;
      fetchPosProducts();
      fetchRiwayatTransaksi(filterTanggalPos);
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
  }, [menuAktif, menuGroups, filterTanggalPos]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const parent = document.getElementById('searchable-member-wrapper');
      if (parent && !parent.contains(e.target)) {
        setShowDropdownMember(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchPosProducts = async () => {
    setPosLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE_URL}/manajemen/ambil/produk_jasa`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await r.json();
      if (r.ok && json.status === 'sukses') {
        setPosProducts(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
    setPosLoading(false);
  };

  const fetchRiwayatTransaksi = async (tgl = filterTanggalPos) => {
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE_URL}/transaksi/riwayat?tanggal=${tgl}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await r.json();
      if (r.ok && json.status === 'sukses') {
        setRiwayatTransaksi(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const tambahKeKeranjang = (prod) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id);
      if (existing) {
        if (prod.tipe === 'barang' && prod.is_stok_dikelola == 1 && existing.qty >= prod.stok) {
          ui.notif('gagal', `Stok '${prod.nama_produk}' tidak mencukupi untuk ditambah lagi.`);
          return prev;
        }
        return prev.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      } else {
        if (prod.tipe === 'barang' && prod.is_stok_dikelola == 1 && prod.stok <= 0) {
          ui.notif('gagal', `Stok '${prod.nama_produk}' sedang habis.`);
          return prev;
        }
        return [...prev, { ...prod, qty: 1 }];
      }
    });
  };

  const kurangiDariKeranjang = (prodId) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === prodId);
      if (existing && existing.qty > 1) {
        return prev.map(item => item.id === prodId ? { ...item, qty: item.qty - 1 } : item);
      } else {
        return prev.filter(item => item.id !== prodId);
      }
    });
  };

  const hapusDariKeranjang = (prodId) => {
    setCart(prev => prev.filter(item => item.id !== prodId));
  };

  const resetKeranjang = () => {
    setCart([]);
    setUangJaminanPos(0);
  };

  const prosesCheckout = async () => {
    if (cart.length === 0) {
      ui.notif('gagal', 'Keranjang belanja kosong.');
      return;
    }

    // Deteksi unit secara otomatis dari produk di keranjang jika filterUnitPos kosong (Semua Kategori Unit)
    let unitTerdeteksi = filterUnitPos;
    if (!unitTerdeteksi && cart.length > 0) {
      unitTerdeteksi = cart[0].unit_id || '';
    }

    if (!unitTerdeteksi) {
      ui.notif('gagal', 'Pilih unit terlebih dahulu sebelum melakukan transaksi.');
      return;
    }

    if (opsiShift.length === 0) {
      ui.notif('gagal', 'Tidak ada shift kerja terdaftar untuk cabang usaha ini. Transaksi dinonaktifkan.');
      return;
    }

    if (pembayaranTipePos === 'belum_bayar' && !pelangganIdPos) {
      ui.notif('gagal', 'Pilih pelanggan terlebih dahulu untuk transaksi Bayar Nanti (Hutang).');
      return;
    }

    const setuju = await ui.notif('konfirmasi', 'Apakah Anda yakin ingin memproses transaksi ini?');
    if (!setuju) return;

    setTransaksiLoading(true);
    ui.loading(true, 'fullscreen', 'Memproses pembayaran...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/transaksi/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          unit_id: Number(unitTerdeteksi),
          uang_jaminan: uangJaminanPos,
          pelanggan_id: pelangganIdPos ? Number(pelangganIdPos) : null,
          status_pembayaran: pembayaranTipePos,
          metode_pembayaran: pembayaranTipePos === 'lunas' ? metodePembayaranPos : null,
          items: cart.map(item => ({
            produk_id: item.id,
            qty: item.qty
          }))
        })
      });
      const resData = await response.json();
      ui.loading(false);
      setTransaksiLoading(false);
      if (response.ok && resData.status === 'sukses') {
        ui.notif('sukses', resData.pesan || 'Transaksi berhasil!');
        
        // Membuka modal detail nota secara otomatis setelah checkout berhasil HANYA jika bayar sekarang (lunas)
        const txId = resData.data?.transaksi_id;
        if (pembayaranTipePos === 'lunas' && txId) {
          try {
            const detailRes = await fetch(`${API_BASE_URL}/transaksi-publik/detail/${txId}`);
            const detailJson = await detailRes.json();
            if (detailRes.ok && detailJson.status === 'sukses') {
              setSelectedTransaksi(detailJson.data);
              setShowDetailNotaModal(true);
            }
          } catch (err) {
            console.error('Gagal memuat detail nota baru:', err);
          }
        }

        resetKeranjang();
        setPelangganIdPos('');
        setMemberSearchQuery('');
        setPembayaranTipePos('lunas');
        setMetodePembayaranPos('cash');
        fetchPosProducts();
        fetchRiwayatTransaksi(filterTanggalPos);
      } else {
        const pesanError =
          resData.pesan ||
          resData.messages?.error ||
          (Array.isArray(resData.messages) ? resData.messages.join(' ') : null) ||
          'Gagal memproses transaksi. Silakan cek stok bahan baku.';
        ui.notif('gagal', pesanError);
      }
    } catch (err) {
      ui.loading(false);
      setTransaksiLoading(false);
      ui.notif('gagal', 'Terjadi kesalahan koneksi.');
    }
  };

  const tambahMemberBaru = async (e) => {
    if (e) e.preventDefault();
    if (!namaMemberBaru || !waMemberBaru) {
      ui.notif('gagal', 'Nama dan WhatsApp wajib diisi.');
      return;
    }
    
    ui.loading(true, 'fullscreen', 'Mendaftarkan member...');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/transaksi/tambah-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nama: namaMemberBaru,
          wa: waMemberBaru
        })
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', res.pesan || 'Member berhasil didaftarkan!');
        setMemberBaruTerdaftar(res.data);
        setNamaMemberBaru('');
        setWaMemberBaru('');
        // Refresh options
        fetchGlobalOptions();
        // Auto select
        setPelangganIdPos(String(res.data.id));
        setMemberSearchQuery(`${res.data.nama} (${res.data.wa})`);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal mendaftarkan member.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Kesalahan koneksi saat mendaftarkan member.');
    }
  };

  const simpanTambahanPesananHutang = async () => {
    if (!selectedTransaksi) return;
    ui.loading(true, 'fullscreen', 'Menyimpan tambahan pesanan...');
    try {
      const gabungItems = () => {
        const map = {};
        selectedTransaksi.detail.forEach(d => {
          map[d.produk_id] = (map[d.produk_id] || 0) + Number(d.qty);
        });
        if (pilihanProdukHutang) {
          const pid = Number(pilihanProdukHutang);
          map[pid] = (map[pid] || 0) + Number(pilihanQtyHutang);
        }
        return Object.keys(map).map(pid => ({
          produk_id: Number(pid),
          qty: map[pid]
        }));
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/transaksi/update-hutang/${selectedTransaksi.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: gabungItems()
        })
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', res.pesan || 'Tambahan pesanan berhasil disimpan!');
        setShowDetailNotaModal(false);
        setSelectedTransaksi(null);
        setPilihanProdukHutang('');
        setPilihanQtyHutang(1);
        fetchPosProducts();
        fetchRiwayatTransaksi(filterTanggalPos);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal menyimpan tambahan pesanan.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Kesalahan koneksi saat menyimpan tambahan.');
    }
  };

  const bayarLunasHutang = async () => {
    if (!selectedTransaksi) return;
    const konf = await ui.notif('konfirmasi', `Apakah Anda yakin ingin melunasi tagihan ini dengan metode ${metodePelunasanHutang.toUpperCase()}?`);
    if (!konf) return;

    ui.loading(true, 'fullscreen', 'Memproses pelunasan...');
    try {
      const gabungItems = () => {
        const map = {};
        selectedTransaksi.detail.forEach(d => {
          map[d.produk_id] = (map[d.produk_id] || 0) + Number(d.qty);
        });
        if (pilihanProdukHutang) {
          const pid = Number(pilihanProdukHutang);
          map[pid] = (map[pid] || 0) + Number(pilihanQtyHutang);
        }
        return Object.keys(map).map(pid => ({
          produk_id: Number(pid),
          qty: map[pid]
        }));
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/transaksi/lunasi-hutang/${selectedTransaksi.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          metode_pembayaran: metodePelunasanHutang,
          items: pilihanProdukHutang ? gabungItems() : []
        })
      });
      const res = await response.json();
      ui.loading(false);
      if (response.ok && res.status === 'sukses') {
        ui.notif('sukses', res.pesan || 'Tagihan berhasil dilunasi!');
        
        // Memuat ulang detail nota untuk menampilkan status lunas dan tombol cetak/kirim
        try {
          const detailRes = await fetch(`${API_BASE_URL}/transaksi-publik/detail/${selectedTransaksi.id}`);
          const detailJson = await detailRes.json();
          if (detailRes.ok && detailJson.status === 'sukses') {
            setSelectedTransaksi(detailJson.data);
          } else {
            setShowDetailNotaModal(false);
            setSelectedTransaksi(null);
          }
        } catch (err) {
          console.error('Gagal memperbarui detail nota:', err);
          setShowDetailNotaModal(false);
          setSelectedTransaksi(null);
        }

        setPilihanProdukHutang('');
        setPilihanQtyHutang(1);
        fetchPosProducts();
        fetchRiwayatTransaksi(filterTanggalPos);
      } else {
        ui.notif('gagal', res.pesan || 'Gagal melunasi tagihan.');
      }
    } catch {
      ui.loading(false);
      ui.notif('gagal', 'Kesalahan koneksi saat pelunasan.');
    }
  };

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
  const bukaAbsenModal = async (defaultTipe = 'rutin') => {
    // Cek apakah ada koordinat toko
    const usahaData = opsiUsaha.find(u => u.id == profile?.usaha_id);
    const tokoLat = parseFloat(usahaData?.latitude);
    const tokoLng = parseFloat(usahaData?.longitude);
    const radiusAbsen = parseFloat(usahaData?.radius_absen) || 100;

    setTipeAbsenAktif(typeof defaultTipe === 'string' ? defaultTipe : 'rutin');
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
    const lemburId = absenLemburId ? parseInt(absenLemburId, 10) : null;

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
        let tolSebelum = 120; // default 2 jam
        let tolTerlambat = 15; // default 15 menit

        // Cari toleransi dari shift rutin hari ini (jika ada)
        const rutinObj = tugasHariIni?.jadwal_rutin || tugasHariIni?.jadwal_pengganti;
        if (rutinObj) {
          tolSebelum = parseInt(rutinObj.toleransi_sebelum) || 0;
          tolTerlambat = parseInt(rutinObj.toleransi_terlambat) || 0;
        } else {
          // Cari shift rutin default dari opsiJadwal (mengikuti namaHari bisnis hari ini)
          const dateParts = lemburObj.tanggal.split('-');
          const y = parseInt(dateParts[0], 10);
          const m = parseInt(dateParts[1], 10) - 1;
          const d = parseInt(dateParts[2], 10);
          const dateObj = new Date(y, m, d);
          const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dateObj.getDay()];

          const liburHariIni = opsiJadwal.find(
            j => j.karyawan_id == profile?.user_id && j.hari === namaHari
          );

          if (!liburHariIni) {
            const jadwalRutin = opsiJadwal.find(
              j => j.karyawan_id == profile?.user_id && (!j.hari || j.hari === '')
            );
            if (jadwalRutin) {
              const shiftObj = opsiShift.find(s => s.id == jadwalRutin.shift_id);
              if (shiftObj) {
                tolSebelum = parseInt(shiftObj.toleransi_sebelum) || 0;
                tolTerlambat = parseInt(shiftObj.toleransi_terlambat) || 0;
              }
            }
          }
        }

        targetShift = {
          jam_mulai: lemburObj.jam_mulai,
          jam_selesai: lemburObj.jam_selesai,
          toleransi_sebelum: tolSebelum,
          toleransi_terlambat: tolTerlambat
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
        if (Array.isArray(todayAbsensi)) {
          setTodayAbsensi(prev => [...prev, { id: json.id_baru, karyawan_id: profile?.user_id, jam_masuk: nowLocalStr, jam_pulang: null, status_kehadiran: statusKehadiran, lembur_id: lemburId }]);
        } else {
          setTodayAbsensi([{ id: json.id_baru, karyawan_id: profile?.user_id, jam_masuk: nowLocalStr, jam_pulang: null, status_kehadiran: statusKehadiran, lembur_id: lemburId }]);
        }
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

  const tanganiAbsenPulang = async (targetId = null) => {
    const activeAbsen = targetId 
      ? (Array.isArray(todayAbsensi) ? todayAbsensi.find(a => a.id === targetId) : todayAbsensi)
      : (Array.isArray(todayAbsensi) ? todayAbsensi.find(a => tipeAbsenAktif === 'lembur' ? !!a.lembur_id : !a.lembur_id) : todayAbsensi);

    if (!activeAbsen?.id) {
      ui.notif('gagal', 'Data absensi hari ini tidak ditemukan.');
      return;
    }
    const nowLocalStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16);

    // Tentukan status pulang dari tugas hari ini
    let statusPulang = null;
    let targetShift = null;

    if (activeAbsen?.lembur_id) {
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
      const res = await fetch(`http://localhost:8080/api/absen/pulang/${activeAbsen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ jam_pulang: nowLocalStr, status_pulang: statusPulang })
      });
      const json = await res.json();
      if (res.ok && json.status === 'sukses') {
        const infoPoin = json.nilai_poin ? ` (${json.nilai_poin > 0 ? '+' : ''}${json.nilai_poin} poin)` : '';
        ui.notif('sukses', `Absen Pulang berhasil!${infoPoin}`);
        if (Array.isArray(todayAbsensi)) {
          setTodayAbsensi(prev => prev.map(a => a.id === activeAbsen.id ? { ...a, jam_pulang: nowLocalStr } : a));
        } else {
          setTodayAbsensi(prev => ({ ...prev, jam_pulang: nowLocalStr }));
        }
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
    
    // Batch insert khusus untuk produk_komposisi saat tambah data baru
    if (tabelTerpilih === 'produk_komposisi' && !isEdit) {
      ui.loading(true, 'fullscreen', 'Menyimpan seluruh bahan resep...');
      const token = localStorage.getItem('token');
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      try {
        // Kirim request ke backend satu per satu untuk setiap bahan secara paralel
        const promises = (dataForm.bahan || []).map(item => {
          const payload = {
            produk_induk_id: dataForm.produk_induk_id,
            produk_bahan_id: item.produk_bahan_id,
            jumlah: item.jumlah
          };
          return fetch(`http://localhost:8080/api/manajemen/tambah/produk_komposisi`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
        });
        
        const responses = await Promise.all(promises);
        
        // Periksa apakah ada request yang gagal
        let adaGagal = false;
        let pesanGagal = '';
        
        for (let i = 0; i < responses.length; i++) {
          const r = responses[i];
          if (!r.ok) {
            adaGagal = true;
            const res = await r.json();
            
            // Ekstrak pesan kesalahan dari backend
            if (res.errors && typeof res.errors === 'object') {
              pesanGagal = Object.values(res.errors).join(', ');
            } else if (res.messages) {
              if (typeof res.messages === 'object') {
                pesanGagal = Object.values(res.messages).join(', ');
              } else {
                pesanGagal = String(res.messages);
              }
            } else if (res.pesan) {
              pesanGagal = res.pesan;
            } else {
              pesanGagal = 'Gagal menyimpan salah satu bahan.';
            }
            break;
          }
        }
        
        if (adaGagal) {
          ui.notif('gagal', `Gagal menyimpan: ${pesanGagal}`);
        } else {
          ui.notif('sukses', 'Seluruh bahan resep berhasil disimpan!');
          tutupModalForm();
          await ambilDataTabel(tabelTerpilih, true);
          await fetchGlobalOptions();
        }
      } catch (err) {
        ui.notif('gagal', 'Koneksi gagal saat menyimpan bahan resep.');
      } finally {
        ui.tutupLoading();
      }
      return;
    }

    let url = isEdit 
      ? `http://localhost:8080/api/manajemen/ubah/${tabelTerpilih}/${dataForm.id}` 
      : `http://localhost:8080/api/manajemen/tambah/${tabelTerpilih}`;
    let method = isEdit ? 'PUT' : 'POST';
    const token = localStorage.getItem('token');
    
    let headers = { 'Authorization': `Bearer ${token}` };
    let bodyPayload;

    if (tabelTerpilih === 'perizinan' || tabelTerpilih === 'usaha') {
      const statusSaatIni = dataForm.status;
      const roleUser = profile?.role?.toLowerCase();
      const isEvaluasiAtasan = tabelTerpilih === 'perizinan' && isEdit 
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
          ? `http://localhost:8080/api/manajemen/ubah/${tabelTerpilih}/${dataForm.id}` 
          : (tabelTerpilih === 'perizinan' 
              ? `http://localhost:8080/api/perizinan/ajukan` 
              : `http://localhost:8080/api/manajemen/tambah/${tabelTerpilih}`);
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
    fetchGlobalOptions();
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
        nilaiAwal = { nama_usaha: '', kode_usaha: '', alamat: '', tanggal_berdiri: '', no_izin: '', latitude: '', longitude: '', radius_absen: '100' };
      } else if (targetTabel === 'unit') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', nama_unit: '', kode_unit: '', kategori: 'kantin' };
      } else if (targetTabel === 'produk_jasa') {
        nilaiAwal = { usaha_id: profile?.usaha_id || '', unit_id: '', nama_produk: '', tipe: '', harga_beli: '0', harga_jual: '0', stok: '0', stok_minimum: '0', is_stok_dikelola: '', butuh_persiapan: '0', satuan: 'pcs' };
      } else if (targetTabel === 'roles') {
        nilaiAwal = { nama_role: '', deskripsi: '' };
      } else if (targetTabel === 'user_role') {
        nilaiAwal = { user_id: '', usaha_id: profile?.usaha_id || '', unit_id: '', role_id: '', gaji_pokok: '0' };
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
      } else if (targetTabel === 'pengeluaran') {
        nilaiAwal = { 
          usaha_id: profile?.usaha_id || '', 
          unit_id: '', 
          kategori: '', 
          deskripsi_keperluan: '', 
          keterangan: '', 
          karyawan_gaji_id: '', 
          produk_id: '', 
          qty: '1', 
          harga_satuan: '0', 
          diskon: '0', 
          nominal_total: '0', 
          penanggung_jawab_id: '', 
          tanggal: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 10) 
        };
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
      } else if (targetTabel === 'lembur') {
        const today = new Date().toISOString().substring(0, 10);
        nilaiAwal = { 
          usaha_id: profile?.usaha_id || '', 
          karyawan_id: '', 
          tanggal: today, 
          jam_mulai: '', 
          jam_selesai: '', 
          keterangan: '', 
          status: 'ditunjuk', 
          catatan_penolakan: '' 
        };
      } else if (targetTabel === 'produk_komposisi') {
        nilaiAwal = { produk_induk_id: '', produk_bahan_id: '', jumlah: '1.00', bahan: [{ produk_bahan_id: '', jumlah: '1.00' }] };
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
      return ['No.', 'Usaha Induk', 'Nama Unit', 'Kategori', 'Aksi'];
    } else if (tabel === 'produk_jasa') {
      return ['No.', 'Usaha', 'Unit', 'Nama Produk', 'Tipe', 'HPP (Harga Beli)', 'Harga Jual', 'Stok', 'Min. Stok', 'Satuan', 'Aksi'];
    } else if (tabel === 'produk_komposisi') {
      return ['No.', 'Produk Menu (Induk)', 'Bahan Mentah / Penunjang', 'Jumlah Takaran', 'Aksi'];
    } else if (tabel === 'roles') {
      return ['No.', 'Nama Role', 'Keterangan', 'Aksi'];
    } else if (tabel === 'user_role') {
      return ['No.', 'User', 'Usaha', 'Unit', 'Role', 'Gaji Pokok', 'Aksi'];
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
    } else if (tabel === 'pengeluaran') {
      return ['No.', 'Tanggal', 'Kategori', 'No. Inv', 'Unit', 'Detail Keperluan / Item', 'Nominal Total', 'Penanggung Jawab (PIC)', 'Pencatat', 'Catatan', 'Aksi'];
    } else if (tabel === 'points') {
      return ['No.', 'Karyawan', 'Jumlah Poin', 'Sumber', 'Atasan Penilai', 'Keterangan', 'Tanggal', 'Cabang', 'Aksi'];
    } else if (tabel === 'perizinan') {
      return ['No.', 'Karyawan', 'Karyawan Pengganti', 'Jenis Izin', 'Tanggal', 'Alasan', 'Status', 'Catatan / Penyetuju', 'Cabang', 'Aksi'];
    } else if (tabel === 'lembur') {
      return ['No.', 'Karyawan', 'Tanggal', 'Jam Mulai', 'Jam Selesai', 'Keterangan', 'Status', 'Cabang', 'Aksi'];
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
      const kategoriLabels = {
        kantin: '💼 Kantin',
        billiard: '🎱 Billiard',
        rental_mobil: '🚗 Rental Mobil',
        salon: '💅 Salon',
        multimedia: '📸 Multimedia',
        cuci_kendaraan: '🚗 Cuci Kendaraan'
      };
      return (
        <>
          <td>{noUrut}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td className="fw-bold">{baris.nama_unit}</td>
          <td><span className="badge bg-info">{kategoriLabels[baris.kategori] || baris.kategori || '-'}</span></td>
        </>
      );
    } else if (tabel === 'produk_jasa') {
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;
      const namaUnit = baris.unit_id ? (opsiUnit.find(u => u.id == baris.unit_id)?.nama_unit || baris.unit_id) : <span className="text-muted italic">Global</span>;
      const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
      const tipeLabels = { barang: '📦 Barang', jasa: '💅 Jasa', sewa: '🚗 Sewa' };
      return (
        <>
          <td>{noUrut}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
          <td><span className="badge bg-light text-dark">{namaUnit}</span></td>
          <td className="fw-bold text-main">{baris.nama_produk}</td>
          <td><span className="badge bg-info">{tipeLabels[baris.tipe] || baris.tipe}</span></td>
          <td><code className="text-main">{formatRupiah(baris.harga_beli)}</code></td>
          <td><strong className="text-main">{formatRupiah(baris.harga_jual)}</strong></td>
          <td>
            {baris.is_stok_dikelola == 1 ? (
              <span className={Number(baris.stok) <= Number(baris.stok_minimum) ? 'text-danger fw-bold' : 'text-main'}>
                {baris.stok} {baris.satuan} {Number(baris.stok) <= Number(baris.stok_minimum) && '⚠️'}
              </span>
            ) : (
              <span className="text-muted">-</span>
            )}
          </td>
          <td><span className="text-muted small">{baris.is_stok_dikelola == 1 ? `${baris.stok_minimum} ${baris.satuan}` : '-'}</span></td>
          <td><span className="text-main">{baris.satuan}</span></td>
        </>
      );
    } else if (tabel === 'produk_komposisi') {
      const namaInduk = baris.nama_produk_induk || `Produk #${baris.produk_induk_id}`;
      const namaBahan = baris.nama_produk_bahan || `Bahan #${baris.produk_bahan_id}`;
      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">🍜 {namaInduk}</td>
          <td className="text-main">📦 {namaBahan}</td>
          <td><strong className="text-primary">{baris.jumlah}</strong></td>
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
          <td><strong className="text-main">{formatRupiah(baris.gaji_pokok)}</strong></td>
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
          <td>
            {shiftNama === 'Lembur' 
              ? <span className="badge bg-warning text-dark">Lembur</span> 
              : <span className="badge bg-light text-dark">{shiftNama}</span>}
          </td>
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
    } else if (tabel === 'pengeluaran') {
      const tglFormatted = baris.tanggal 
        ? new Date(baris.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-';

      const kategoriBadges = {
        'Gaji': 'bg-success',
        'Bahan Baku': 'bg-primary',
        'Inv': 'bg-info',
        'Operasional': 'bg-warning text-dark',
        'Lain-lain': 'bg-secondary'
      };

      const detailKeperluan = (() => {
        if (baris.kategori === 'Gaji') {
          return `Penerima Gaji: ${baris.nama_karyawan_gaji || `ID: ${baris.karyawan_gaji_id}`}`;
        }
        if (baris.kategori === 'Bahan Baku') {
          const diskonTeks = Number(baris.diskon || 0) > 0 ? ` [Diskon: ${formatRupiah(baris.diskon)}]` : '';
          return `Restok: ${baris.nama_produk || `ID: ${baris.produk_id}`} (${baris.qty} ${baris.satuan || 'pcs'} @ ${formatRupiah(baris.harga_satuan)})${diskonTeks}`;
        }
        if (baris.kategori === 'Inv') {
          const diskonTeks = Number(baris.diskon || 0) > 0 ? ` [Diskon: ${formatRupiah(baris.diskon)}]` : '';
          return `Aset: ${baris.deskripsi_keperluan || 'Aset Baru'} (${baris.qty} pcs @ ${formatRupiah(baris.harga_satuan)})${diskonTeks}`;
        }
        return baris.deskripsi_keperluan || '-';
      })();

      return (
        <>
          <td>{noUrut}</td>
          <td><span className="text-main small">{tglFormatted}</span></td>
          <td><span className={`badge ${kategoriBadges[baris.kategori] || 'bg-dark'}`}>{baris.kategori}</span></td>
          <td><code className="text-main small">{baris.nomor_inventaris || '-'}</code></td>
          <td><span className="badge bg-light text-dark">{baris.nama_unit || 'Global'}</span></td>
          <td><span className="text-main small">{detailKeperluan}</span></td>
          <td><strong className="text-danger">{formatRupiah(baris.nominal_total)}</strong></td>
          <td><span className="badge bg-dark fw-normal">{baris.nama_penanggung_jawab || '-'}</span></td>
          <td><span className="text-muted small">{baris.nama_pencatat || '-'}</span></td>
          <td><span className="text-muted small" style={{ fontSize: '0.72rem' }}>{baris.keterangan || '-'}</span></td>
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
    } else if (tabel === 'lembur') {
      const formatTgl = (t) => {
        if (!t) return '-';
        const d = new Date(t);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      const karyawanObj = opsiUsers.find(u => u.id == baris.karyawan_id);
      const namaKaryawan = karyawanObj ? karyawanObj.nama : (baris.nama_karyawan || `Karyawan #${baris.karyawan_id}`);
      const namaUsaha = opsiUsaha.find(u => u.id == baris.usaha_id)?.nama_usaha || baris.usaha_id;

      const badgeStatus = {
        ditunjuk: <span className="badge bg-info">Ditunjuk</span>,
        diterima: <span className="badge bg-success">Diterima</span>,
        ditolak: <span className="badge bg-danger">Ditolak</span>
      }[baris.status] || <span className="badge bg-secondary">{baris.status}</span>;

      return (
        <>
          <td>{noUrut}</td>
          <td className="fw-bold text-main">{namaKaryawan}</td>
          <td><code>{formatTgl(baris.tanggal)}</code></td>
          <td><code>{baris.jam_mulai ? baris.jam_mulai.substring(0, 5) : '-'}</code></td>
          <td><code>{baris.jam_selesai ? baris.jam_selesai.substring(0, 5) : '-'}</code></td>
          <td className="small text-muted">{baris.keterangan || '-'}</td>
          <td>{badgeStatus}</td>
          <td><span className="badge bg-secondary">{namaUsaha}</span></td>
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
                            {(() => {
                              const activeUsaha = opsiUsaha.find(u => u.id == profile?.usaha_id);
                              if (activeUsaha?.logo) {
                                return (
                                  <img 
                                    src={`http://localhost:8080/api/ambil-logo/${activeUsaha.logo}`} 
                                    alt="Logo" 
                                    style={{ height: '24px', width: '24px', objectFit: 'contain', borderRadius: '4px' }} 
                                  />
                                );
                              }
                              return <Briefcase size={20} className="text-muted" />;
                            })()}
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
                                onClick={() => bukaAbsenModal('lembur')}
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
                  {/* WIDGET JOB BOARD (ANTREAN PEKERJAAN TERBUKA) */}
                  {!['member'].includes(profile?.role?.toLowerCase()) && (
                    <div className="col-12 mt-4" id="job-board-widget">
                      <div className="kartu-premium fade-in">
                        <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                          <h4 className="fw-bold mb-0 text-main d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                            <span>🛎️ Job Board - Antrean Pekerjaan Terbuka</span>
                          </h4>
                          <span className="badge bg-primary" style={{ backgroundColor: 'var(--warna-utama)' }}>
                            {jobBoardList.length} Pekerjaan Aktif
                          </span>
                        </div>

                        {jobBoardList.length === 0 ? (
                          <div className="p-4 rounded-3 text-center text-muted small" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px dashed var(--warna-border)' }}>
                            Tidak ada antrean pekerjaan aktif saat ini.
                          </div>
                        ) : (
                          <div className="row g-3">
                            {jobBoardList.map(job => {
                              const isMyJob = String(job.petugas_id) === String(profile?.user_id);
                              const isDikerjakan = job.status_pengerjaan === 'Dikerjakan';
                              const statusColor = job.status_pengerjaan === 'Menunggu' ? 'warning text-dark' : 'info';
                              
                              return (
                                <div key={job.id} className="col-12 col-md-6 col-lg-4">
                                  <div className="p-3 rounded-3 h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                                    <div>
                                      <div className="d-flex justify-content-between align-items-start mb-2">
                                        <span className={`badge bg-${statusColor}`} style={{ fontSize: '0.65rem' }}>
                                          {job.status_pengerjaan === 'Menunggu' ? '⏳ Menunggu' : `⚙️ Proses`}
                                        </span>
                                        <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                                          {new Date(job.waktu_nota).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <h5 className="fw-bold text-main mb-1" style={{ fontSize: '0.8rem' }}>
                                        {dapatkanEmojiPekerjaan(job.kategori_unit)} {job.nama_produk}
                                      </h5>
                                      <div className="text-muted small mb-2">
                                        Jumlah: <strong className="text-main">{job.qty} {job.satuan}</strong>
                                      </div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                        Nota: <strong className="text-main">{job.nomor_invoice}</strong>
                                      </div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                        Pelanggan: <strong className="text-main">{job.nama_pelanggan || 'Pelanggan Umum'}</strong>
                                      </div>
                                      {isDikerjakan && (
                                        <div className="text-muted mt-2" style={{ fontSize: '0.7rem' }}>
                                          Petugas: <span className="badge bg-light text-dark text-capitalize">{job.nama_petugas || 'Karyawan'}</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-3 pt-2 border-top" style={{ borderColor: 'var(--warna-border)' }}>
                                      {job.status_pengerjaan === 'Menunggu' ? (
                                        <button
                                          onClick={() => handleKlaimJob(job.id)}
                                          className="w-100 tombol-premium py-1.5 d-flex align-items-center justify-content-center gap-1"
                                          style={{ fontSize: '0.75rem' }}
                                        >
                                          {dapatkanEmojiPekerjaan(job.kategori_unit)} Ambil Tugas
                                        </button>
                                      ) : isMyJob ? (
                                        <button
                                          onClick={() => handleSelesaiJob(job.id)}
                                          className="w-100 tombol-premium py-1.5 d-flex align-items-center justify-content-center gap-1"
                                          style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                        >
                                          ✅ Selesai Dikerjakan
                                        </button>
                                      ) : (
                                        <button
                                          disabled
                                          className="w-100 tombol-sekunder-premium py-1.5 text-muted border-0"
                                          style={{ fontSize: '0.75rem', cursor: 'not-allowed' }}
                                        >
                                          🔒 Sedang Dikerjakan Koki Lain
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
              )}
              
              {menuAktif === 'kasir' && (() => {
                const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
                
                // Saring produk berdasarkan pencarian & filter unit
                // Hanya tampilkan produk yang memiliki harga jual > 0 (bukan bahan baku internal)
                const produkTersaring = posProducts.filter(p => {
                  const matchSearch = p.nama_produk.toLowerCase().includes(searchProductQuery.toLowerCase());
                  const matchUnit = filterUnitPos ? String(p.unit_id) === String(filterUnitPos) : true;
                  const matchHarga = Number(p.harga_jual) > 0; // Sembunyikan bahan baku (harga 0)
                  return matchSearch && matchUnit && matchHarga;
                });

                // Hitung total belanjaan di keranjang
                const totalBelanja = cart.reduce((total, item) => total + (item.harga_jual * item.qty), 0);

                return (
                  <div className="row g-4 fade-in">
                    {/* Sisi Kiri: Katalog Produk */}
                    <div className="col-12 col-lg-8">
                      <div className="kartu-premium p-3 p-sm-4">
                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
                          <div>
                            <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                              <ShoppingCart size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                              <span>Katalog Kasir POS</span>
                            </h4>
                            <div className="text-muted small">Pilih menu produk kantin atau jasa layanan untuk ditransaksikan.</div>
                          </div>
                        </div>

                        {/* Peringatan jika tidak ada shift terdaftar */}
                        {opsiShift.length === 0 && (
                          <div className="alert alert-danger py-2.5 px-3 small mb-4 d-flex align-items-center gap-2 border-0" style={{ borderRadius: '8px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.08)' }}>
                            <span>⚠️</span>
                            <div><strong>Peringatan:</strong> Tidak ada shift kerja yang terdaftar untuk cabang usaha ini. Transaksi kasir dinonaktifkan. Silakan hubungi admin/supervisor untuk mendaftarkan shift.</div>
                          </div>
                        )}

                        {/* Search & Filter Unit */}
                        <div className="row g-2 mb-4">
                          <div className="col-12 col-sm-7 position-relative">
                            <div className="position-absolute d-flex align-items-center justify-content-center" style={{ top: 0, bottom: 0, left: '15px', color: 'var(--text-secondary)', opacity: 0.7, pointerEvents: 'none' }}>
                              <Search size={16} />
                            </div>
                            <input 
                              type="text" 
                              className="form-control input-premium w-100" 
                              style={{ paddingLeft: '40px', fontSize: '0.85rem' }} 
                              placeholder="Cari nama produk/jasa..." 
                              value={searchProductQuery}
                              onChange={(e) => setSearchProductQuery(e.target.value)}
                            />
                          </div>
                          <div className="col-12 col-sm-5">
                            <select
                              className="form-select input-premium w-100"
                              style={{ fontSize: '0.85rem' }}
                              value={filterUnitPos}
                              onChange={e => setFilterUnitPos(e.target.value)}
                            >
                              <option value="">Semua Kategori Unit</option>
                              {opsiUnit.filter(u => !profile?.usaha_id || u.usaha_id == profile.usaha_id).map(u => (
                                <option key={u.id} value={u.id}>Unit: {u.nama_unit} ({u.kategori})</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Product Grid */}
                        {posLoading ? (
                          <div className="text-center py-5">
                            <span className="spinner-border spinner-border-sm text-primary me-2" />
                            Memuat daftar produk...
                          </div>
                        ) : produkTersaring.length === 0 ? (
                          <div className="text-center py-5 text-muted small" style={{ border: '1px dashed var(--warna-border)', borderRadius: '10px' }}>
                            Tidak ada produk/jasa yang ditemukan.
                          </div>
                        ) : (
                          <div className="row g-3" style={{ maxHeight: '550px', overflowY: 'auto', paddingRight: '5px' }}>
                            {produkTersaring.map(prod => {
                              const cartItem = cart.find(item => item.id === prod.id);
                              const isStokMenipis = prod.is_stok_dikelola == 1 && Number(prod.stok) <= Number(prod.stok_minimum);
                              return (
                                <div key={prod.id} className="col-12 col-sm-6">
                                  <div 
                                    className="p-3 rounded-3 d-flex flex-column justify-content-between h-100"
                                    style={{ 
                                      backgroundColor: 'var(--bg-kartu)', 
                                      border: cartItem ? '1.5px solid var(--warna-utama)' : '1px solid var(--warna-border)',
                                      boxShadow: cartItem ? '0 4px 12px rgba(99, 102, 241, 0.08)' : 'none',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <div>
                                      <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                        <span className="fw-bold text-main" style={{ fontSize: '0.82rem' }}>{prod.nama_produk}</span>
                                        <span className="badge bg-light text-dark" style={{ fontSize: '0.6rem' }}>{prod.nama_unit || 'Global'}</span>
                                      </div>
                                      
                                      <div className="d-flex align-items-center justify-content-between mt-1 mb-2">
                                        <span className="text-primary fw-bold" style={{ fontSize: '0.8rem', color: 'var(--warna-utama)' }}>{formatRupiah(prod.harga_jual)}</span>
                                        
                                        {prod.is_stok_dikelola == 1 ? (
                                          <span className={`badge ${isStokMenipis ? 'bg-danger' : 'bg-secondary'}`} style={{ fontSize: '0.62rem' }}>
                                            Stok: {prod.stok} {prod.satuan} {isStokMenipis && '⚠️'}
                                          </span>
                                        ) : (
                                          <span className="text-muted small" style={{ fontSize: '0.65rem' }}>Non-Stok</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action Counter */}
                                    <div className="mt-2">
                                      {cartItem ? (
                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                          <button 
                                            onClick={() => kurangiDariKeranjang(prod.id)}
                                            className="btn btn-sm btn-outline-danger py-1 px-2.5 d-flex align-items-center justify-content-center"
                                            style={{ borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                          >-</button>
                                          <span className="fw-bold text-main" style={{ fontSize: '0.85rem' }}>{cartItem.qty} {prod.satuan}</span>
                                          <button 
                                            onClick={() => tambahKeKeranjang(prod)}
                                            className="btn btn-sm btn-outline-primary py-1 px-2.5 d-flex align-items-center justify-content-center"
                                            style={{ borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}
                                            disabled={prod.is_stok_dikelola == 1 && cartItem.qty >= prod.stok}
                                          >+</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => tambahKeKeranjang(prod)}
                                          className="tombol-premium border-0 w-100 py-1 px-3 d-flex align-items-center justify-content-center gap-1"
                                          style={{ fontSize: '0.72rem', borderRadius: '8px' }}
                                          disabled={prod.is_stok_dikelola == 1 && prod.stok <= 0}
                                        >
                                          <Plus size={12} />
                                          <span>Pilih</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sisi Kanan: Keranjang Belanja & Pembayaran */}
                    <div className="col-12 col-lg-4">
                      <div className="kartu-premium p-3 p-sm-4 h-100 d-flex flex-column justify-content-between" style={{ minHeight: '400px' }}>
                        <div>
                          <h4 className="fw-bold mb-3 pb-2 d-flex align-items-center gap-2" style={{ borderBottom: '1px solid var(--warna-border)' }}>
                            <ShoppingCart size={18} className="text-primary" />
                            <span style={{ fontSize: '0.85rem' }}>Keranjang Transaksi</span>
                          </h4>

                          {cart.length === 0 ? (
                            <div className="text-center py-5 text-muted small italic">Keranjang belanja kosong. Silakan pilih produk dari katalog.</div>
                          ) : (
                            <div className="d-flex flex-column gap-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {cart.map(item => (
                                <div key={item.id} className="d-flex align-items-center justify-content-between pb-2" style={{ borderBottom: '1px dashed var(--warna-border)' }}>
                                  <div style={{ maxWidth: '60%' }}>
                                    <div className="fw-bold text-main" style={{ fontSize: '0.78rem' }}>{item.nama_produk}</div>
                                    <div className="text-muted small" style={{ fontSize: '0.68rem' }}>
                                      {item.qty} x {formatRupiah(item.harga_jual)}
                                    </div>
                                  </div>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="fw-bold text-main" style={{ fontSize: '0.78rem' }}>{formatRupiah(item.harga_jual * item.qty)}</span>
                                    <button 
                                      onClick={() => hapusDariKeranjang(item.id)}
                                      className="btn btn-link text-danger p-0 ms-1"
                                      title="Hapus"
                                      style={{ border: 'none', background: 'none' }}
                                    >🗑️</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {cart.length > 0 && (
                          <div className="mt-4 pt-3" style={{ borderTop: '1.5px solid var(--warna-border)' }}>
                            {/* Summary */}
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <span className="text-muted small">Total Pembayaran:</span>
                              <span className="fs-5 fw-bold text-main" style={{ color: 'var(--warna-utama)' }}>{formatRupiah(totalBelanja)}</span>
                            </div>

                            {/* Tipe Pembayaran (Lunas vs Hutang) */}
                            <div className="mb-3">
                              <label className="text-muted small d-block mb-1">Tipe Transaksi:</label>
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setPembayaranTipePos('lunas')}
                                  className={`border-0 flex-fill py-1.5 px-3 small d-flex align-items-center justify-content-center gap-1`}
                                  style={{
                                    fontSize: '0.72rem',
                                    borderRadius: '8px',
                                    backgroundColor: pembayaranTipePos === 'lunas' ? 'var(--warna-utama, #6366f1)' : 'rgba(255,255,255,0.03)',
                                    color: pembayaranTipePos === 'lunas' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                    fontWeight: 600,
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  💳 Bayar Sekarang
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPembayaranTipePos('belum_bayar')}
                                  className={`border-0 flex-fill py-1.5 px-3 small d-flex align-items-center justify-content-center gap-1`}
                                  style={{
                                    fontSize: '0.72rem',
                                    borderRadius: '8px',
                                    backgroundColor: pembayaranTipePos === 'belum_bayar' ? 'var(--warna-utama, #6366f1)' : 'rgba(255,255,255,0.03)',
                                    color: pembayaranTipePos === 'belum_bayar' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                    fontWeight: 600,
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  ⚠️ Bayar Nanti
                                </button>
                              </div>
                            </div>

                            {/* Pilihan Pelanggan (Selalu Muncul) */}
                            <div className="mb-3 fade-in" id="searchable-member-wrapper" style={{ position: 'relative', zIndex: showDropdownMember ? 200 : 'auto' }}>
                              <div className="d-flex align-items-center justify-content-between mb-1">
                                <label className="text-muted small mb-0">
                                  Pilih Member {pembayaranTipePos === 'belum_bayar' ? '(Wajib)' : '(Opsional)'}:
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemberBaruTerdaftar(null);
                                    setShowTambahMemberModal(true);
                                  }}
                                  className="btn btn-link text-primary p-0 d-flex align-items-center gap-0.5 border-0"
                                  style={{ fontSize: '0.68rem', textDecoration: 'none', color: 'var(--warna-utama)' }}
                                >
                                  ➕ Tambah Baru
                                </button>
                              </div>

                              <div className="position-relative">
                                <input
                                  type="text"
                                  className="form-control input-premium text-main py-1.5 px-3"
                                  style={{ fontSize: '0.78rem', borderRadius: '8px', paddingRight: pelangganIdPos ? '2.2rem' : undefined }}
                                  placeholder="Ketik nama atau wa member..."
                                  value={memberSearchQuery}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setMemberSearchQuery(val);
                                    if (!val) {
                                      setPelangganIdPos('');
                                    }
                                    setShowDropdownMember(true);
                                  }}
                                  onFocus={() => setShowDropdownMember(true)}
                                  onBlur={() => setTimeout(() => setShowDropdownMember(false), 200)}
                                />
                                {pelangganIdPos && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPelangganIdPos('');
                                      setMemberSearchQuery('');
                                    }}
                                    className="position-absolute end-0 top-50 translate-middle-y btn btn-link text-danger p-0 border-0 me-2"
                                    style={{ fontSize: '0.75rem', textDecoration: 'none', lineHeight: 1 }}
                                    title="Hapus pilihan"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {/* Dropdown menu pencarian */}
                              {showDropdownMember && (() => {
                                const query = memberSearchQuery.toLowerCase();
                                const filteredMembers = opsiUsers.filter(u => {
                                  if (!query) return true;
                                  return u.nama.toLowerCase().includes(query) || u.wa.toLowerCase().includes(query);
                                });

                                return (
                                  <div
                                    className="w-100 rounded-3 shadow-lg p-1 mt-1"
                                    style={{
                                      position: 'absolute',
                                      zIndex: 9999,
                                      maxHeight: '160px',
                                      overflowY: 'auto',
                                      top: '100%',
                                      left: 0,
                                      backgroundColor: '#1e293b',
                                      border: '1px solid var(--warna-border)',
                                    }}
                                  >
                                    {filteredMembers.length === 0 ? (
                                      <div className="text-muted small py-2 px-3 italic text-white">Tidak ada member cocok.</div>
                                    ) : (
                                      filteredMembers.map(u => (
                                        <div
                                          key={u.id}
                                          onMouseDown={() => {
                                            setPelangganIdPos(String(u.id));
                                            setMemberSearchQuery(`${u.nama} (${u.wa})`);
                                            setShowDropdownMember(false);
                                          }}
                                          className="py-1.5 px-3 rounded-2 text-white small"
                                          style={{
                                            cursor: 'pointer',
                                            fontSize: '0.76rem',
                                            transition: 'background 0.15s'
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          👤 {u.nama} ({u.wa})
                                        </div>
                                      ))
                                    )}
                                  </div>
                                );
                              })()}
                            </div>


                            {/* Pilihan Metode Pembayaran (Jika Bayar Sekarang) */}
                            {pembayaranTipePos === 'lunas' && (
                              <div className="mb-3 fade-in">
                                <label className="text-muted small d-block mb-1.5">Metode Pembayaran:</label>
                                <div className="d-flex gap-1.5 p-1 rounded-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--warna-border)' }}>
                                  <button
                                    type="button"
                                    onClick={() => setMetodePembayaranPos('cash')}
                                    className="border-0 flex-fill py-1.5 px-2 small text-center"
                                    style={{
                                      fontSize: '0.74rem',
                                      borderRadius: '6px',
                                      backgroundColor: metodePembayaranPos === 'cash' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                      color: metodePembayaranPos === 'cash' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    💵 Cash
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMetodePembayaranPos('qris')}
                                    className="border-0 flex-fill py-1.5 px-2 small text-center"
                                    style={{
                                      fontSize: '0.74rem',
                                      borderRadius: '6px',
                                      backgroundColor: metodePembayaranPos === 'qris' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                      color: metodePembayaranPos === 'qris' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    📱 QRIS
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setMetodePembayaranPos('tap')}
                                    className="border-0 flex-fill py-1.5 px-2 small text-center"
                                    style={{
                                      fontSize: '0.74rem',
                                      borderRadius: '6px',
                                      backgroundColor: metodePembayaranPos === 'tap' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                      color: metodePembayaranPos === 'tap' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    🔲 Tap
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Buttons */}
                            <div className="d-flex gap-2">
                              <button
                                onClick={resetKeranjang}
                                className="tombol-sekunder-premium border-0 flex-fill text-center py-2 text-danger"
                                style={{ fontSize: '0.78rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)' }}
                              >
                                Reset
                              </button>
                              <button
                                onClick={prosesCheckout}
                                className="tombol-premium border-0 flex-fill text-center py-2"
                                style={{ fontSize: '0.78rem', borderRadius: '10px' }}
                                disabled={transaksiLoading}
                              >
                                {transaksiLoading ? 'Proses...' : 'Proses / Simpan'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Baris Bawah: Riwayat Transaksi Penjualan */}
                    <div className="col-12">
                      <div className="kartu-premium p-3 p-sm-4 mt-2">
                        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                          <span>📝 Riwayat Transaksi Penjualan</span>
                        </h4>

                        {/* Filter Tanggal & Pencarian Realtime */}
                        <div className="row g-2 mb-3">
                          <div className="col-12 col-sm-4">
                            <label className="text-muted small mb-1 d-block" style={{ fontSize: '0.72rem' }}>Filter Tanggal Siklus:</label>
                            <input
                              type="date"
                              className="form-control input-premium w-100 py-1.5 px-2 text-main"
                              style={{ fontSize: '0.78rem' }}
                              value={filterTanggalPos}
                              onChange={e => setFilterTanggalPos(e.target.value)}
                            />
                          </div>
                          <div className="col-12 col-sm-8">
                            <label className="text-muted small mb-1 d-block" style={{ fontSize: '0.72rem' }}>Pencarian Realtime:</label>
                            <input
                              type="text"
                              className="form-control input-premium w-100 py-1.5 px-3 text-main"
                              style={{ fontSize: '0.78rem' }}
                              placeholder="Cari nomor invoice, nama kasir, nama member, no WA, barang..."
                              value={searchRiwayatQuery}
                              onChange={e => setSearchRiwayatQuery(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Summary Bar */}
                        {(() => {
                          const query = searchRiwayatQuery.toLowerCase();
                          const filtered = riwayatTransaksi.filter(tx => {
                            if (!query) return true;
                            const matchInvoice = tx.nomor_invoice.toLowerCase().includes(query);
                            const matchKasir = (tx.nama_kasir || '').toLowerCase().includes(query);
                            const matchPelanggan = (tx.nama_pelanggan || '').toLowerCase().includes(query);
                            const matchWa = (tx.wa_pelanggan || '').toLowerCase().includes(query);
                            const matchItems = tx.detail?.some(d => d.nama_produk.toLowerCase().includes(query));
                            return matchInvoice || matchKasir || matchPelanggan || matchWa || matchItems;
                          });

                          const totalCash = filtered.filter(t => t.status_pembayaran === 'lunas' && t.metode_pembayaran === 'cash').reduce((sum, t) => sum + Number(t.total_harga), 0);
                          const totalQris = filtered.filter(t => t.status_pembayaran === 'lunas' && t.metode_pembayaran === 'qris').reduce((sum, t) => sum + Number(t.total_harga), 0);
                          const totalTap = filtered.filter(t => t.status_pembayaran === 'lunas' && t.metode_pembayaran === 'tap').reduce((sum, t) => sum + Number(t.total_harga), 0);
                          const totalHutang = filtered.filter(t => t.status_pembayaran === 'belum_bayar').reduce((sum, t) => sum + Number(t.total_harga), 0);
                          const totalSemua = totalCash + totalQris + totalTap + totalHutang;
                          const jumlahTransaksi = filtered.length;

                          return (
                            <div className="row g-2 mb-4">
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem' }}>💵 Cash</div>
                                  <div className="fw-bold text-success" style={{ fontSize: '0.8rem' }}>{formatRupiah(totalCash)}</div>
                                </div>
                              </div>
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem' }}>📱 QRIS</div>
                                  <div className="fw-bold text-info" style={{ fontSize: '0.8rem' }}>{formatRupiah(totalQris)}</div>
                                </div>
                              </div>
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem' }}>🔲 Tap</div>
                                  <div className="fw-bold text-warning" style={{ fontSize: '0.8rem' }}>{formatRupiah(totalTap)}</div>
                                </div>
                              </div>
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem' }}>⚠️ Hutang</div>
                                  <div className="fw-bold text-danger" style={{ fontSize: '0.8rem' }}>{formatRupiah(totalHutang)}</div>
                                </div>
                              </div>
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem', fontWeight: 600 }}>✅ Total Semua</div>
                                  <div className="fw-bold" style={{ fontSize: '0.8rem', color: 'var(--warna-utama, #6366f1)' }}>{formatRupiah(totalSemua)}</div>
                                </div>
                              </div>
                              <div className="col-6 col-sm-4 col-md-2">
                                <div className="p-2 rounded-3 text-center" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                  <div className="text-muted small" style={{ fontSize: '0.65rem', fontWeight: 600 }}>📊 Transaksi</div>
                                  <div className="fw-bold" style={{ fontSize: '0.8rem', color: 'var(--warna-utama, #6366f1)' }}>{jumlahTransaksi} Tx</div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {riwayatTransaksi.length === 0 ? (
                          <div className="text-muted small py-3 italic text-center">Belum ada riwayat transaksi penjualan untuk cabang usaha ini.</div>
                        ) : (
                          (() => {
                            const query = searchRiwayatQuery.toLowerCase();
                            const filtered = riwayatTransaksi.filter(tx => {
                              if (!query) return true;
                              const matchInvoice = tx.nomor_invoice.toLowerCase().includes(query);
                              const matchKasir = (tx.nama_kasir || '').toLowerCase().includes(query);
                              const matchPelanggan = (tx.nama_pelanggan || '').toLowerCase().includes(query);
                              const matchWa = (tx.wa_pelanggan || '').toLowerCase().includes(query);
                              const matchItems = tx.detail?.some(d => d.nama_produk.toLowerCase().includes(query));
                              return matchInvoice || matchKasir || matchPelanggan || matchWa || matchItems;
                            });

                            if (filtered.length === 0) {
                              return <div className="text-muted small py-3 italic text-center">Tidak ada transaksi yang cocok dengan pencarian.</div>;
                            }

                            return (
                              <div className="table-responsive">
                                <table className="table tabel-premium align-middle mb-0">
                                  <thead>
                                    <tr>
                                      <th>No. Invoice</th>
                                      <th>Tanggal</th>
                                      <th>Kasir</th>
                                      <th>Pelanggan</th>
                                      <th>Total Belanja</th>
                                      <th>Detail Item</th>
                                      <th>Status</th>
                                      <th>Aksi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filtered.map(tx => (
                                      <tr key={tx.id}>
                                        <td className="fw-bold text-main" style={{ fontSize: '0.78rem' }}><code>{tx.nomor_invoice}</code></td>
                                        <td className="text-main" style={{ fontSize: '0.78rem' }}>{new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="text-main" style={{ fontSize: '0.78rem' }}>{tx.nama_kasir || `User #${tx.kasir_id}`}</td>
                                        <td className="text-main" style={{ fontSize: '0.78rem' }}>{tx.nama_pelanggan ? `${tx.nama_pelanggan} (${tx.wa_pelanggan})` : <span className="text-muted">-</span>}</td>
                                        <td className="fw-bold text-main" style={{ fontSize: '0.78rem' }}>{formatRupiah(tx.total_harga)}</td>
                                        <td>
                                          <div className="d-flex flex-column gap-1">
                                            {tx.detail?.map(d => (
                                              <span key={d.id} className="small text-muted" style={{ fontSize: '0.68rem' }}>
                                                • {d.nama_produk} ({d.qty} x {formatRupiah(d.harga_satuan)})
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td>
                                          {tx.status_pembayaran === 'lunas' ? (
                                            <span className="badge py-1 px-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', fontSize: '0.68rem', borderRadius: '6px' }}>Lunas ({tx.metode_pembayaran?.toUpperCase()})</span>
                                          ) : (
                                            <span className="badge py-1 px-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.68rem', borderRadius: '6px' }}>Hutang</span>
                                          )}
                                        </td>
                                        <td>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedTransaksi(tx);
                                              setShowDetailNotaModal(true);
                                            }}
                                            className="tombol-premium border-0 py-1 px-2.5 d-inline-flex align-items-center justify-content-center"
                                            style={{ fontSize: '0.68rem', borderRadius: '6px' }}
                                          >
                                            Detail
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* DYNAMIC CRUD PANEL */}
              {(() => {
                let currentMenu = null;
                menuGroups.forEach(g => {
                  const m = g.menus.find(x => x.url === menuAktif);
                  if (m) currentMenu = m;
                });
                
                if (!currentMenu || !currentMenu.tabel || currentMenu.url === 'kasir' || currentMenu.url === 'laporan') return null;
                
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

                  // Filter Bulan, Tahun & Unit khusus pengeluaran
                  if (currentMenu.tabel === 'pengeluaran') {
                    if (row.tanggal) {
                      const parts = row.tanggal.split('-');
                      if (parts.length >= 2) {
                        const y = parts[0];
                        const m = parts[1];
                        if (filterBulanPengeluaran && m !== filterBulanPengeluaran) return false;
                        if (filterTahunPengeluaran && y !== filterTahunPengeluaran) return false;
                      }
                    }
                    if (filterUnitPengeluaran && String(row.unit_id) !== String(filterUnitPengeluaran)) return false;
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

                  // Khusus tabel pengeluaran: cari berdasarkan kategori, nama unit, atau detail keperluan
                  if (currentMenu.tabel === 'pengeluaran') {
                    const kategori = row.kategori || '';
                    const unit = row.nama_unit || '';
                    const detailKeperluan = (() => {
                      if (row.kategori === 'Gaji') {
                        return row.nama_karyawan_gaji || '';
                      }
                      if (row.kategori === 'Bahan Baku') {
                        return row.nama_produk || '';
                      }
                      if (row.kategori === 'Inv') {
                        return row.deskripsi_keperluan || '';
                      }
                      return row.deskripsi_keperluan || '';
                    })();
                    
                    return kategori.toLowerCase().includes(lowerKeyword) || 
                           unit.toLowerCase().includes(lowerKeyword) || 
                           detailKeperluan.toLowerCase().includes(lowerKeyword);
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

                    {/* Filter Bar khusus untuk Pengeluaran */}
                    {currentMenu.tabel === 'pengeluaran' && (() => {
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

                      const totalPengeluaran = dataTabelFiltered.reduce((acc, r) => acc + (parseFloat(r.nominal_total) || 0), 0);

                      return (
                        <div className="mb-4 p-3 rounded-3" style={{ background: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                          <div className="d-flex flex-wrap align-items-center gap-3">
                            <span className="fw-semibold text-main d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                              📅 Filter:
                            </span>
                            
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
                                value={filterUnitPengeluaran}
                                onChange={e => setFilterUnitPengeluaran(e.target.value)}
                              >
                                <option value="">Semua Unit</option>
                                {opsiUnit.map(un => (
                                  <option key={un.id} value={un.id}>{un.nama_unit}</option>
                                ))}
                              </select>
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <select
                                className="form-select form-select-sm input-premium"
                                style={{ width: 'auto', fontSize: '0.72rem', padding: '0.2rem 1.8rem 0.2rem 0.5rem' }}
                                value={filterBulanPengeluaran}
                                onChange={e => setFilterBulanPengeluaran(e.target.value)}
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
                                value={filterTahunPengeluaran}
                                onChange={e => setFilterTahunPengeluaran(e.target.value)}
                              >
                                <option value="">Semua Tahun</option>
                                {tahunList.map(t => (
                                  <option key={t} value={String(t)}>{t}</option>
                                ))}
                              </select>
                            </div>

                            {(filterBulanPengeluaran || filterTahunPengeluaran || filterUnitPengeluaran || filterUsahaGlobal) && (
                              <button 
                                onClick={() => {
                                  setFilterBulanPengeluaran('');
                                  setFilterTahunPengeluaran('');
                                  setFilterUnitPengeluaran('');
                                  setFilterUsahaGlobal('');
                                }} 
                                className="tombol-sekunder-premium btn-sm border-0" 
                                style={{ fontSize: '0.68rem', padding: '0.2rem 0.6rem', borderRadius: '15px' }}
                              >
                                Reset Filter
                              </button>
                            )}

                            {/* Summary info */}
                            <div className="ms-sm-auto d-flex flex-wrap gap-2 align-items-center">
                              <div className="d-flex align-items-center gap-1" style={{ background: 'rgba(99,102,241,0.05)', borderRadius: '12px', padding: '3px 10px', border: '1px solid rgba(99,102,241,0.15)' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Jumlah Data:</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warna-utama)' }}>
                                  {dataTabelFiltered.length}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: 'var(--warna-teks-sekunder)' }}>item</span>
                              </div>

                              <div className="d-flex align-items-center gap-1" style={{ background: 'rgba(239,68,68,0.06)', borderRadius: '12px', padding: '3px 10px', border: '1px solid rgba(239,68,68,0.15)' }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Total Pengeluaran:</span>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warna-bahaya)', fontFamily: 'monospace' }}>
                                  {formatRupiah(totalPengeluaran)}
                                </span>
                              </div>
                            </div>

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

              {menuAktif === 'laporan' && (() => {
                const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
                
                if (laporanLoading && !laporanData) {
                  return (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="text-muted mt-2 small">Memuat laporan finansial...</p>
                    </div>
                  );
                }

                if (!laporanData) {
                  return (
                    <div className="alert alert-warning text-center">
                      Gagal memuat data laporan atau akses ditolak.
                    </div>
                  );
                }

                // Render Svg Chart logic inside
                const chartWidth = 600;
                const chartHeight = 220;
                const paddingLeft = 60;
                const paddingRight = 20;
                const paddingTop = 20;
                const paddingBottom = 40;
                const points = laporanData.grafik || [];
                const N = points.length;
                const maxPenjualan = Math.max(...points.map(p => p.penjualan), 0);
                const maxPengeluaran = Math.max(...points.map(p => p.pengeluaran), 0);
                const maxVal = Math.max(maxPenjualan, maxPengeluaran, 1000);

                const getX = (index) => {
                  if (N <= 1) return paddingLeft;
                  return paddingLeft + (index / (N - 1)) * (chartWidth - paddingLeft - paddingRight);
                };

                const getY = (val) => {
                  return chartHeight - paddingBottom - (val / maxVal) * (chartHeight - paddingTop - paddingBottom);
                };

                let penjualanPath = "";
                let pengeluaranPath = "";
                let penjualanAreaPath = "";
                let pengeluaranAreaPath = "";

                points.forEach((p, idx) => {
                  const x = getX(idx);
                  const yPenjualan = getY(p.penjualan);
                  const yPengeluaran = getY(p.pengeluaran);

                  if (idx === 0) {
                    penjualanPath = `M ${x} ${yPenjualan}`;
                    pengeluaranPath = `M ${x} ${yPengeluaran}`;
                    penjualanAreaPath = `M ${x} ${chartHeight - paddingBottom} L ${x} ${yPenjualan}`;
                    pengeluaranAreaPath = `M ${x} ${chartHeight - paddingBottom} L ${x} ${yPengeluaran}`;
                  } else {
                    penjualanPath += ` L ${x} ${yPenjualan}`;
                    pengeluaranPath += ` L ${x} ${yPengeluaran}`;
                    penjualanAreaPath += ` L ${x} ${yPenjualan}`;
                    pengeluaranAreaPath += ` L ${x} ${yPengeluaran}`;
                  }

                  if (idx === N - 1) {
                    penjualanAreaPath += ` L ${x} ${chartHeight - paddingBottom} Z`;
                    pengeluaranAreaPath += ` L ${x} ${chartHeight - paddingBottom} Z`;
                  }
                });

                const gridCount = 4;
                const gridLines = [];
                for (let i = 0; i <= gridCount; i++) {
                  const val = (maxVal / gridCount) * i;
                  const y = getY(val);
                  gridLines.push(
                    <g key={i}>
                      <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="var(--warna-border)" strokeDasharray="4 4" />
                      <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="10" fill={theme === 'dark' ? '#a0aec0' : '#718096'}>
                        {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(val)}
                      </text>
                    </g>
                  );
                }

                const stepX = Math.max(1, Math.floor(N / 6));
                const xLabels = [];
                points.forEach((p, idx) => {
                  if (idx % stepX === 0 || idx === N - 1) {
                    xLabels.push(
                      <text key={idx} x={getX(idx)} y={chartHeight - 15} textAnchor="middle" fontSize="10" fill={theme === 'dark' ? '#a0aec0' : '#718096'}>
                        {p.tanggal}
                      </text>
                    );
                  }
                });

                const renderCategoryBars = () => {
                  const cats = laporanData.pengeluaran_kategori || {};
                  const maxNom = Math.max(...Object.values(cats), 1);
                  return (
                    <div className="d-flex flex-column gap-3 mt-2">
                      {Object.entries(cats).map(([cat, val]) => {
                        const pct = Math.round((val / maxNom) * 100);
                        return (
                          <div key={cat}>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="small fw-semibold">{cat}</span>
                              <span className="small text-muted">{formatRupiah(val)}</span>
                            </div>
                            <div className="progress" style={{ height: '8px', backgroundColor: 'var(--bg-halaman)' }}>
                              <div 
                                className={`progress-bar ${cat === 'Gaji' ? 'bg-primary' : (cat === 'Bahan Baku' ? 'bg-success' : (cat === 'Inv' ? 'bg-info' : 'bg-warning'))}`} 
                                style={{ width: `${pct}%`, borderRadius: '4px' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <div className="fade-in laporan-page">
                    {/* STYLES KHUSUS PRINT PDF & RESPONSIVE FONT */}
                    <style dangerouslySetInnerHTML={{ __html: `
                      @page {
                        size: 210mm 330mm;
                        margin: 0;
                      }
                      @media print {
                        body {
                          background: white !important;
                          color: black !important;
                        }
                        .topbar-premium,
                        .leftbar-premium,
                        .bottombar-premium,
                        footer,
                        .noprint {
                          display: none !important;
                        }
                        .konten-utama-wrapper main > *:not(.laporan-page) {
                          display: none !important;
                        }
                        .laporan-page > *:not(.print-container) {
                          display: none !important;
                        }
                        .konten-utama-wrapper {
                          margin: 0 !important;
                          padding: 0 !important;
                          width: 100% !important;
                          position: absolute !important;
                          left: 0 !important;
                          top: 0 !important;
                        }
                        main {
                          padding: 0 !important;
                          margin: 0 !important;
                        }
                        .print-container {
                          display: block !important;
                          width: 100% !important;
                          background: white !important;
                          color: black !important;
                          padding: 8mm 12mm !important;
                          box-sizing: border-box !important;
                        }
                      }
                      
                      /* Font size mobile responsive */
                      @media (max-width: 575.98px) {
                        .laporan-page, .laporan-page span, .laporan-page td, .laporan-page th, .laporan-page div {
                          font-size: 0.78rem !important;
                        }
                        .laporan-card-title {
                          font-size: 0.85rem !important;
                        }
                      }
                    ` }} />

                    {/* PRINT SHEET WRAPPER (hanya muncul saat mencetak) */}
                    {isCetakMode && (
                      <div className="print-container d-none d-print-block bg-white text-dark">
                        {/* KOP SURAT */}
                        <div className="d-flex justify-content-between align-items-start mb-3 pb-3" style={{ borderBottom: '2px solid #111' }}>
                          <div className="d-flex align-items-center gap-3">
                            {logoDataUrl && (
                              <img
                                src={logoDataUrl}
                                alt="Logo"
                                style={{ height: '60px', width: 'auto', objectFit: 'contain', display: 'block' }}
                              />
                            )}
                            <div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111', lineHeight: 1.2 }}>
                                {profile?.nama_usaha || 'Laporan Finansial'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>
                                Periode: {formatTanggal(laporanFilter.start_date, 'sedang')} s/d {formatTanggal(laporanFilter.end_date, 'sedang')}
                                {laporanFilter.unit_id && (
                                  <span> &middot; Cabang: {opsiUnit.find(u => u.id == laporanFilter.unit_id)?.nama_unit || ''}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'right', paddingTop: '4px' }}>
                            <div>Dicetak: {new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</div>
                            <div style={{ marginTop: '2px' }}>{new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}</div>
                          </div>
                        </div>

                        {/* ===== HALAMAN 1: RINGKASAN BULANAN PER TAHUN ===== */}
                        {(laporanData?.ringkasan_bulanan || []).map((tahunData) => {
                          const totalPend = tahunData.bulan.reduce((s, b) => s + b.pendapatan, 0);
                          const totalPengl = tahunData.bulan.reduce((s, b) => s + b.pengeluaran, 0);
                          const totalSaldo = totalPend - totalPengl;
                          return (
                            <div key={tahunData.tahun} style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', borderBottom: '1px solid #999', paddingBottom: '4px', marginBottom: '8px' }}>
                                RINGKASAN KEUANGAN TAHUN {tahunData.tahun}
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#111', color: '#fff' }}>
                                    <th style={{ padding: '5px 8px', textAlign: 'left', width: '5%' }}>No</th>
                                    <th style={{ padding: '5px 8px', textAlign: 'left', width: '20%' }}>Bulan</th>
                                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Pemasukan (Rp)</th>
                                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Pengeluaran (Rp)</th>
                                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Saldo (Rp)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tahunData.bulan.map((b, idx) => (
                                    <tr key={b.bulan} style={{ backgroundColor: idx % 2 === 0 ? '#f9f9f9' : '#fff' }}>
                                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{idx + 1}</td>
                                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 500 }}>{b.nama_bulan}</td>
                                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                                        {b.pendapatan > 0 ? b.pendapatan.toLocaleString('id-ID') : '-'}
                                      </td>
                                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>
                                        {b.pengeluaran > 0 ? b.pengeluaran.toLocaleString('id-ID') : '-'}
                                      </td>
                                      <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', color: b.saldo >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                                        {b.saldo !== 0 ? b.saldo.toLocaleString('id-ID') : '-'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ backgroundColor: '#111', color: '#fff', fontWeight: 700 }}>
                                    <td colSpan={2} style={{ padding: '5px 8px' }}>TOTAL {tahunData.tahun}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{totalPend.toLocaleString('id-ID')}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>{totalPengl.toLocaleString('id-ID')}</td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right', color: totalSaldo >= 0 ? '#86efac' : '#fca5a5' }}>
                                      {totalSaldo.toLocaleString('id-ID')}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          );
                        })}

                        {/* Grand Total (jika lebih dari 1 tahun) */}
                        {(laporanData?.ringkasan_bulanan || []).length > 1 && (() => {
                          const allBulan = (laporanData.ringkasan_bulanan || []).flatMap(t => t.bulan);
                          const gPend  = allBulan.reduce((s, b) => s + b.pendapatan, 0);
                          const gPengl = allBulan.reduce((s, b) => s + b.pengeluaran, 0);
                          const gSaldo = gPend - gPengl;
                          return (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginTop: '4px' }}>
                              <tbody>
                                <tr style={{ backgroundColor: '#1e3a5f', color: '#fff', fontWeight: 700 }}>
                                  <td colSpan={2} style={{ padding: '6px 8px', width: '25%' }}>TOTAL KESELURUHAN</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{gPend.toLocaleString('id-ID')}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{gPengl.toLocaleString('id-ID')}</td>
                                  <td style={{ padding: '6px 8px', textAlign: 'right', color: gSaldo >= 0 ? '#86efac' : '#fca5a5' }}>
                                    {gSaldo.toLocaleString('id-ID')}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          );
                        })()}

                        {/* Page break — halaman 2 dst: Detail Transaksi */}
                        <div style={{ pageBreakAfter: 'always', height: '0' }} />

                        {/* Judul Halaman 2 — sama stylenya dengan halaman 1 */}
                        {(() => {
                          const namaBulanId = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
                          const dStart = new Date(laporanFilter.start_date);
                          const dEnd   = new Date(laporanFilter.end_date);
                          const bulanStart = namaBulanId[dStart.getMonth()];
                          const bulanEnd   = namaBulanId[dEnd.getMonth()];
                          const tahunStart = dStart.getFullYear();
                          const tahunEnd   = dEnd.getFullYear();

                          let labelBulanTahun;
                          if (tahunStart === tahunEnd && dStart.getMonth() === dEnd.getMonth()) {
                            // Rentang 1 bulan: "BULAN MEI TAHUN 2026"
                            labelBulanTahun = `BULAN ${bulanStart.toUpperCase()} TAHUN ${tahunStart}`;
                          } else if (tahunStart === tahunEnd) {
                            // Beda bulan, tahun sama: "MEI S/D JULI 2026"
                            labelBulanTahun = `${bulanStart.toUpperCase()} S/D ${bulanEnd.toUpperCase()} TAHUN ${tahunStart}`;
                          } else {
                            // Beda tahun: "MEI 2025 S/D JULI 2026"
                            labelBulanTahun = `${bulanStart.toUpperCase()} ${tahunStart} S/D ${bulanEnd.toUpperCase()} ${tahunEnd}`;
                          }

                          const jenis = isCetakMode === 'singkat' ? 'SINGKAT (REKAP HARIAN)' : 'DETAIL TRANSAKSI';
                          return (
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', borderBottom: '1px solid #999', paddingBottom: '4px', marginBottom: '16px', textAlign: 'center' }}>
                              LAPORAN KEUANGAN {jenis} {labelBulanTahun}
                            </div>
                          );
                        })()}

                        {/* Ringkasan Ringkas */}
                        <div className="row g-2 mb-4 text-center">
                          <div className="col-4 border p-2">
                            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Total Pendapatan</div>
                            <div className="fw-bold" style={{ fontSize: '0.9rem' }}>{formatRupiah(laporanData.statistik.total_pendapatan)}</div>
                          </div>
                          <div className="col-4 border p-2">
                            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Total Pengeluaran</div>
                            <div className="fw-bold" style={{ fontSize: '0.9rem' }}>{formatRupiah(laporanData.statistik.total_pengeluaran)}</div>
                          </div>
                          <div className="col-4 border p-2">
                            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Laba Bersih</div>
                            <div className={`fw-bold ${laporanData.statistik.laba_bersih >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.9rem' }}>
                              {formatRupiah(laporanData.statistik.laba_bersih)}
                            </div>
                          </div>
                        </div>

                        {/* Print Tabel data sesuai format */}
                        {isCetakMode === 'singkat' ? (
                          <table className="table table-bordered table-sm small">
                            <thead>
                              <tr className="bg-light">
                                <th>No</th>
                                <th>Tanggal</th>
                                <th className="text-end">Total Penjualan</th>
                                <th className="text-end">Total Pengeluaran</th>
                                <th className="text-end">Laba Bersih</th>
                              </tr>
                            </thead>
                            <tbody>
                              {laporanData.grafik.map((row, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td>{row.tanggal}</td>
                                  <td className="text-end">{formatRupiah(row.penjualan)}</td>
                                  <td className="text-end">{formatRupiah(row.pengeluaran)}</td>
                                  <td className={`text-end ${row.penjualan - row.pengeluaran >= 0 ? 'text-success' : 'text-danger'}`}>
                                    {formatRupiah(row.penjualan - row.pengeluaran)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <>
                            <h5 className="fw-bold mb-2" style={{ fontSize: '0.85rem' }}>1. Rincian Transaksi Penjualan</h5>
                            <table className="table table-bordered table-sm small mb-4">
                              <thead>
                                <tr className="bg-light">
                                  <th>No</th>
                                  <th>No. Invoice</th>
                                  <th>Tanggal</th>
                                  <th>Unit</th>
                                  <th>Kasir</th>
                                  <th>Metode</th>
                                  <th className="text-end">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {laporanData.rincian.penjualan.length === 0 ? (
                                  <tr><td colSpan="7" className="text-center text-muted">Tidak ada transaksi penjualan</td></tr>
                                ) : (
                                  laporanData.rincian.penjualan.map((row, idx) => (
                                    <tr key={idx}>
                                      <td>{idx + 1}</td>
                                      <td>{row.nomor_invoice}</td>
                                      <td>{formatTanggal(row.tanggal, 'singkat')}</td>
                                      <td>{row.nama_unit || '-'}</td>
                                      <td>{row.nama_kasir || '-'}</td>
                                      <td className="text-uppercase">{row.metode_pembayaran || '-'}</td>
                                      <td className="text-end">{formatRupiah(row.total_harga)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>

                            <h5 className="fw-bold mb-2" style={{ fontSize: '0.85rem' }}>2. Rincian Pengeluaran</h5>
                            <table className="table table-bordered table-sm small">
                              <thead>
                                <tr className="bg-light">
                                  <th>No</th>
                                  <th>No. Inv / Aset</th>
                                  <th>Tanggal</th>
                                  <th>Unit</th>
                                  <th>Kategori</th>
                                  <th>Keperluan</th>
                                  <th className="text-end">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {laporanData.rincian.pengeluaran.length === 0 ? (
                                  <tr><td colSpan="7" className="text-center text-muted">Tidak ada data pengeluaran</td></tr>
                                ) : (
                                  laporanData.rincian.pengeluaran.map((row, idx) => (
                                    <tr key={idx}>
                                      <td>{idx + 1}</td>
                                      <td>{row.nomor_inventaris || '-'}</td>
                                      <td>{formatTanggal(row.tanggal, 'singkat')}</td>
                                      <td>{row.nama_unit || '-'}</td>
                                      <td>{row.kategori}</td>
                                      <td>{row.detail_keperluan}</td>
                                      <td className="text-end">{formatRupiah(row.nominal_total)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </>
                        )}

                        <div className="text-end mt-5 pt-3 small" style={{ borderTop: '1px solid #ddd', fontSize: '0.7rem' }}>
                          Dicetak pada: {new Date().toLocaleString('id-ID')}
                        </div>
                      </div>
                    )}

                    {/* INTERFACE MONITOR DASHBOARD (Hanya tampil di layar browser) */}
                    <div className="noprint Laporan-halaman-aktif">
                      {/* FILTER PANEL */}
                      <div className="kartu-premium p-3 p-sm-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                          <div>
                            <h4 className="fw-bold mb-1 d-flex align-items-center gap-2">
                              <BarChart2 size={20} className="text-primary" style={{ color: 'var(--warna-utama)' }} />
                              <span>Laporan & Analisis Finansial</span>
                            </h4>
                            <div className="text-muted small">Kelola pencarian, periode keuangan, dan cetak rangkuman usaha Anda.</div>
                          </div>
                          <div className="d-flex flex-column flex-sm-row gap-2 w-100 w-sm-auto align-items-end">
                            <div>
                              <label className="form-label small fw-semibold mb-1" style={{ fontSize: '0.7rem' }}>Dari Tanggal</label>
                              <input 
                                type="date" 
                                className="form-control input-premium" 
                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                value={laporanFilter.start_date}
                                onChange={(e) => setLaporanFilter(prev => ({ ...prev, start_date: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="form-label small fw-semibold mb-1" style={{ fontSize: '0.7rem' }}>Hingga Tanggal</label>
                              <input 
                                type="date" 
                                className="form-control input-premium" 
                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                value={laporanFilter.end_date}
                                onChange={(e) => setLaporanFilter(prev => ({ ...prev, end_date: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="form-label small fw-semibold mb-1" style={{ fontSize: '0.7rem' }}>Unit / Cabang</label>
                              <select 
                                className="form-select input-premiumSelect" 
                                style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                value={laporanFilter.unit_id}
                                onChange={(e) => setLaporanFilter(prev => ({ ...prev, unit_id: e.target.value }))}
                              >
                                <option value="">Semua Cabang / Unit</option>
                                {opsiUnit.map(u => (
                                  <option key={u.id} value={u.id}>{u.nama_unit}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* SUMMARY CARDS METRICS */}
                      <div className="row g-3 mb-4">
                        <div className="col-12 col-sm-6 col-lg-3">
                          <div className="p-3 rounded-3 h-100" style={{ backgroundColor: 'var(--warna-bg-kartu)', border: '1px solid var(--warna-border)' }}>
                            <div className="text-muted small">Total Pendapatan (Penjualan)</div>
                            <div className="fw-bold text-main fs-4 mt-1">{formatRupiah(laporanData.statistik.total_pendapatan)}</div>
                            <div className="text-muted small mt-1">{laporanData.statistik.jumlah_transaksi_sales} Tx Penjualan</div>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                          <div className="p-3 rounded-3 h-100" style={{ backgroundColor: 'var(--warna-bg-kartu)', border: '1px solid var(--warna-border)' }}>
                            <div className="text-muted small">Total Pengeluaran</div>
                            <div className="fw-bold text-main fs-4 mt-1 text-danger">{formatRupiah(laporanData.statistik.total_pengeluaran)}</div>
                            <div className="text-muted small mt-1">{laporanData.statistik.jumlah_transaksi_expense} Nota Belanja</div>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                          <div className="p-3 rounded-3 h-100" style={{ backgroundColor: 'var(--warna-bg-kartu)', border: '1px solid var(--warna-border)' }}>
                            <div className="text-muted small">Laba Bersih</div>
                            <div className={`fw-bold fs-4 mt-1 ${laporanData.statistik.laba_bersih >= 0 ? 'text-success' : 'text-danger'}`}>
                              {formatRupiah(laporanData.statistik.laba_bersih)}
                            </div>
                            <div className="text-muted small mt-1">Margin Laba: {laporanData.statistik.margin_keuntungan}%</div>
                          </div>
                        </div>
                        <div className="col-12 col-sm-6 col-lg-3">
                          <div className="p-3 rounded-3 h-100" style={{ backgroundColor: 'var(--warna-bg-kartu)', border: '1px solid var(--warna-border)' }}>
                            <div className="text-muted small">Estimasi HPP (Produk Terjual)</div>
                            <div className="fw-bold text-main fs-4 mt-1 text-warning">{formatRupiah(laporanData.statistik.estimasi_hpp)}</div>
                            <div className="text-muted small mt-1">Berdasarkan HPP master produk</div>
                          </div>
                        </div>
                      </div>

                      {/* TREN ANALYTICS BANNER */}
                      <div className="p-3 rounded-3 mb-4 d-flex align-items-start gap-3" 
                           style={{ 
                             backgroundColor: laporanData.tren.status_tren === 'naik' ? 'rgba(16, 185, 129, 0.08)' : (laporanData.tren.status_tren === 'turun' ? 'rgba(239, 68, 68, 0.08)' : 'var(--warna-bg-kartu)'),
                             border: `1px solid ${laporanData.tren.status_tren === 'naik' ? '#10b981' : (laporanData.tren.status_tren === 'turun' ? '#ef4444' : 'var(--warna-border)')}`
                           }}>
                        <div className="fs-3">
                          {laporanData.tren.status_tren === 'naik' ? '📈' : (laporanData.tren.status_tren === 'turun' ? '📉' : '⚖️')}
                        </div>
                        <div>
                          <h6 className="fw-bold mb-1">
                            Tren Laba Bersih: {laporanData.tren.status_tren === 'naik' ? 'Meningkat' : (laporanData.tren.status_tren === 'turun' ? 'Menurun' : 'Stabil')}
                          </h6>
                          <p className="mb-0 small text-muted" style={{ lineHeight: '1.4' }}>
                            {laporanData.tren.teks_kesimpulan}
                          </p>
                        </div>
                      </div>

                      {/* MAIN GRID: GRAPH & CHARTS */}
                      <div className="row g-4 mb-4">
                        {/* Sisi Kiri: Line Chart Tren Finansial */}
                        <div className="col-12 col-lg-8">
                          <div className="kartu-premium h-100 p-3 p-sm-4">
                            <h5 className="fw-bold mb-1">Grafik Tren Arus Kas Masuk & Keluar</h5>
                            <div className="text-muted small mb-3">Garis hijau melambangkan penjualan kotor, garis merah pengeluaran operasional.</div>
                            <div className="d-flex align-items-center gap-3 mb-2 justify-content-end">
                              <div className="d-flex align-items-center gap-1.5 small" style={{ fontSize: '0.75rem' }}>
                                <span className="d-inline-block rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: '#10b981' }} />
                                <span>Penjualan</span>
                              </div>
                              <div className="d-flex align-items-center gap-1.5 small" style={{ fontSize: '0.75rem' }}>
                                <span className="d-inline-block rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: '#ef4444' }} />
                                <span>Pengeluaran</span>
                              </div>
                            </div>
                            {points.length > 0 ? (
                              <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mt-3">
                                <defs>
                                  <linearGradient id="gradPenjualan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(16, 185, 129, 0.2)" />
                                    <stop offset="100%" stopColor="rgba(16, 185, 129, 0.0)" />
                                  </linearGradient>
                                  <linearGradient id="gradPengeluaran" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(239, 68, 68, 0.2)" />
                                    <stop offset="100%" stopColor="rgba(239, 68, 68, 0.0)" />
                                  </linearGradient>
                                </defs>
                                {gridLines}
                                {/* Areas */}
                                <path d={penjualanAreaPath} fill="url(#gradPenjualan)" />
                                <path d={pengeluaranAreaPath} fill="url(#gradPengeluaran)" />
                                {/* Lines */}
                                <path d={penjualanPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                <path d={pengeluaranPath} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                {xLabels}
                              </svg>
                            ) : (
                              <div className="text-center py-5 text-muted small">Tidak ada data untuk grafik.</div>
                            )}
                          </div>
                        </div>

                        {/* Sisi Kanan: Alokasi Biaya Kategori */}
                        <div className="col-12 col-lg-4">
                          <div className="kartu-premium h-100 p-3 p-sm-4">
                            <h5 className="fw-bold mb-1">Distribusi Pengeluaran</h5>
                            <div className="text-muted small mb-3">Persentase pengeluaran berdasarkan kategori.</div>
                            {renderCategoryBars()}
                          </div>
                        </div>
                      </div>

                      {/* INSIGHTS / REKOMENDASI PINTAR */}
                      <div className="kartu-premium p-3 p-sm-4 mb-4">
                        <h5 className="fw-bold mb-3 d-flex align-items-center gap-2">
                          <span>💡 Rekomendasi Peningkatan Operasional</span>
                        </h5>
                        {laporanData.rekomendasi.length === 0 ? (
                          <p className="text-muted small mb-0">Tidak ada saran khusus untuk periode ini.</p>
                        ) : (
                          <div className="d-flex flex-column gap-2">
                            {laporanData.rekomendasi.map((rek, idx) => (
                              <div key={idx} className="p-2.5 rounded-3 small d-flex align-items-start gap-2" style={{ backgroundColor: 'var(--bg-halaman)', border: '1px solid var(--warna-border)' }}>
                                <span className="text-primary">✨</span>
                                <span className="text-muted" style={{ lineHeight: '1.4' }}>{rek}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* PRINT & DOWNLOAD ACTIONS BUTTONS */}
                      <div className="kartu-premium p-3 p-sm-4 mb-4 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3">
                        <div>
                          <h5 className="fw-bold mb-1">Cetak Dokumen Laporan</h5>
                          <div className="text-muted small">Cetak laporan harian singkat atau rincian penuh per transaksi ke berkas fisik/PDF.</div>
                        </div>
                        <div className="d-flex gap-2 w-100 w-sm-auto">
                          <button 
                            onClick={() => setIsCetakMode('singkat')}
                            className="tombol-sekunder-premium border-0 py-2 px-3 text-main"
                            style={{ fontSize: '0.78rem', borderRadius: '10px' }}
                          >
                            🖨️ Cetak Rekap Harian
                          </button>
                          <button 
                            onClick={() => setIsCetakMode('detail')}
                            className="tombol-premium border-0 py-2 px-3"
                            style={{ fontSize: '0.78rem', borderRadius: '10px' }}
                          >
                            🖨️ Cetak Detail Transaksi
                          </button>
                        </div>
                      </div>

                      {/* DRILL-DOWN TABLES PANEL */}
                      <div className="kartu-premium p-3 p-sm-4">
                        <div className="d-flex align-items-center justify-content-between mb-4 border-bottom pb-3">
                          <h5 className="fw-bold mb-0">Rincian Buku Kas</h5>
                          <div className="d-flex gap-1.5">
                            <button 
                              onClick={() => setSubTabLaporan('penjualan')}
                              className={`tombol-sekunder-premium border-0 py-1.5 px-3 ${subTabLaporan === 'penjualan' ? 'aktif bg-primary text-white' : ''}`}
                              style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                              Penjualan
                            </button>
                            <button 
                              onClick={() => setSubTabLaporan('pengeluaran')}
                              className={`tombol-sekunder-premium border-0 py-1.5 px-3 ${subTabLaporan === 'pengeluaran' ? 'aktif bg-primary text-white' : ''}`}
                              style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                            >
                              Pengeluaran
                            </button>
                          </div>
                        </div>

                        {subTabLaporan === 'penjualan' ? (
                          <div className="table-responsive">
                            <table className={`table ${theme === 'dark' ? 'table-dark' : ''} table-hover table-striped align-middle small`} style={{ backgroundColor: 'transparent', borderColor: 'var(--warna-border)' }}>
                              <thead>
                                <tr>
                                  <th>No. Invoice</th>
                                  <th>Tanggal</th>
                                  <th>Unit Cabang</th>
                                  <th>Kasir</th>
                                  <th>Pembayaran</th>
                                  <th className="text-end">Nominal Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {laporanData.rincian.penjualan.length === 0 ? (
                                  <tr><td colSpan="6" className="text-center text-muted">Tidak ada transaksi penjualan dalam rentang waktu ini.</td></tr>
                                ) : (
                                  laporanData.rincian.penjualan.map((row) => (
                                    <tr key={row.id}>
                                      <td className="fw-semibold text-main">{row.nomor_invoice}</td>
                                      <td>{formatTanggal(row.tanggal, 'singkat')}</td>
                                      <td>{row.nama_unit || '-'}</td>
                                      <td>{row.nama_kasir || '-'}</td>
                                      <td>
                                        <span className="badge bg-success text-uppercase" style={{ fontSize: '0.65rem' }}>
                                          {row.metode_pembayaran}
                                        </span>
                                      </td>
                                      <td className="text-end fw-semibold text-success">{formatRupiah(row.total_harga)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <table className={`table ${theme === 'dark' ? 'table-dark' : ''} table-hover table-striped align-middle small`} style={{ backgroundColor: 'transparent', borderColor: 'var(--warna-border)' }}>
                              <thead>
                                <tr>
                                  <th>No. Inv / Aset</th>
                                  <th>Tanggal</th>
                                  <th>Unit Cabang</th>
                                  <th>Kategori</th>
                                  <th>Keterangan Keperluan</th>
                                  <th className="text-end">Nominal Belanja</th>
                                </tr>
                              </thead>
                              <tbody>
                                {laporanData.rincian.pengeluaran.length === 0 ? (
                                  <tr><td colSpan="6" className="text-center text-muted">Tidak ada transaksi pengeluaran dalam rentang waktu ini.</td></tr>
                                ) : (
                                  laporanData.rincian.pengeluaran.map((row) => (
                                    <tr key={row.id}>
                                      <td className="fw-semibold text-main">{row.nomor_inventaris || '-'}</td>
                                      <td>{formatTanggal(row.tanggal, 'singkat')}</td>
                                      <td>{row.nama_unit || '-'}</td>
                                      <td>
                                        <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>
                                          {row.kategori}
                                        </span>
                                      </td>
                                      <td>{row.detail_keperluan}</td>
                                      <td className="text-end fw-semibold text-danger">{formatRupiah(row.nominal_total)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

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
        <footer className="text-center text-muted small py-3 mt-auto d-none d-sm-block noprint" style={{ borderTop: '1px solid var(--warna-border)' }}>
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
        const targetAbsen = Array.isArray(todayAbsensi)
          ? todayAbsensi.find(a => tipeAbsenAktif === 'lembur' ? !!a.lembur_id : !a.lembur_id)
          : (tipeAbsenAktif === 'lembur' ? (todayAbsensi?.lembur_id ? todayAbsensi : null) : (!todayAbsensi?.lembur_id ? todayAbsensi : null));

        const sudahAbsenMasuk = !!targetAbsen?.jam_masuk;
        const sudahAbsenPulang = !!targetAbsen?.jam_pulang;

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

              {/* TABS TIPE ABSENSI (RUTIN VS LEMBUR) */}
              {(tugasHariIni?.jadwal_rutin || tugasHariIni?.jadwal_pengganti || tugasHariIni?.lembur_aktif) && (
                <div className="d-flex gap-2 mb-3">
                  {(tugasHariIni?.jadwal_rutin || tugasHariIni?.jadwal_pengganti) && (
                    <button
                      className="flex-fill py-2 px-3 text-center border-0"
                      onClick={() => setTipeAbsenAktif('rutin')}
                      style={{
                        fontSize: '0.72rem',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        fontWeight: 600,
                        backgroundColor: tipeAbsenAktif === 'rutin' ? 'var(--warna-utama)' : 'rgba(255,255,255,0.04)',
                        color: tipeAbsenAktif === 'rutin' ? '#fff' : 'var(--warna-teks-sekunder)',
                        boxShadow: tipeAbsenAktif === 'rutin' ? '0 2px 8px rgba(99,102,241,0.25)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      💼 Shift Reguler
                    </button>
                  )}
                  {tugasHariIni?.lembur_aktif && (
                    <button
                      className="flex-fill py-2 px-3 text-center border-0"
                      onClick={() => setTipeAbsenAktif('lembur')}
                      style={{
                        fontSize: '0.72rem',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                        fontWeight: 600,
                        backgroundColor: tipeAbsenAktif === 'lembur' ? '#f59e0b' : 'rgba(255,255,255,0.04)',
                        color: tipeAbsenAktif === 'lembur' ? '#fff' : 'var(--warna-teks-sekunder)',
                        boxShadow: tipeAbsenAktif === 'lembur' ? '0 2px 8px rgba(245,158,11,0.25)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Lembur
                    </button>
                  )}
                </div>
              )}

              {/* Detail Acuan Kerja Aktif */}
              <div className="mb-3 p-2 rounded-2" style={{ border: '1px solid var(--warna-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div className="mb-1" style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--warna-teks-sekunder)' }}>
                  📌 Acuan Tugas / Jam Kerja
                </div>
                <div className="fw-bold text-main" style={{ fontSize: '0.78rem' }}>
                  {tipeAbsenAktif === 'lembur' ? (
                    tugasHariIni?.lembur_aktif ? (
                      <div className="d-flex flex-column gap-0.5">
                        <span className="text-warning">Lembur: {tugasHariIni.lembur_aktif.jam_mulai.substring(0, 5)} - {tugasHariIni.lembur_aktif.jam_selesai.substring(0, 5)}</span>
                        {tugasHariIni.lembur_aktif.keterangan && <span className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>Ket: {tugasHariIni.lembur_aktif.keterangan}</span>}
                      </div>
                    ) : (
                      <span className="text-muted italic">Tidak ada tugas lembur hari ini.</span>
                    )
                  ) : (
                    (tugasHariIni?.jadwal_rutin || tugasHariIni?.jadwal_pengganti) ? (
                      <span>
                        Shift: {tugasHariIni?.jadwal_rutin?.nama_shift || tugasHariIni?.jadwal_pengganti?.nama_shift} ({tugasHariIni?.jadwal_rutin?.jam_mulai?.substring(0, 5) || tugasHariIni?.jadwal_pengganti?.jam_mulai?.substring(0, 5)} - {tugasHariIni?.jadwal_rutin?.jam_selesai?.substring(0, 5) || tugasHariIni?.jadwal_pengganti?.jam_selesai?.substring(0, 5)})
                      </span>
                    ) : (
                      <span className="text-muted italic">Tidak ada shift reguler terjadwal.</span>
                    )
                  )}
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
                        {sudahAbsenMasuk ? formatWaktu(targetAbsen.jam_masuk) : '--:--'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--warna-teks-sekunder)' }}>Pulang</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: sudahAbsenPulang ? '#6366f1' : 'var(--warna-teks-sekunder)', fontFamily: 'monospace' }}>
                        {sudahAbsenPulang ? formatWaktu(targetAbsen.jam_pulang) : '--:--'}
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
                          }[targetAbsen.status_kehadiran] || <span>{targetAbsen.status_kehadiran}</span>}
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
                    onClick={() => tanganiAbsenMasuk(tipeAbsenAktif === 'lembur' ? tugasHariIni?.lembur_aktif?.id : null)}
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
                    onClick={() => tanganiAbsenPulang(targetAbsen?.id)}
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
              opsiProduk={opsiProduk}
              profile={profile}
            />
          </div>
        </div>
      )}
      {/* ===== MODAL TAMBAH MEMBER CEPAT ===== */}
      {showTambahMemberModal && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            zIndex: 9995,
            backgroundColor: 'rgba(11, 15, 25, 0.65)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease forwards'
          }}
        >
          <div className="kartu-premium fade-in w-100" style={{ maxWidth: '420px', padding: '1.5rem' }}>
            <div className="d-flex align-items-center justify-content-between pb-2 mb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
              <h4 className="fw-bold mb-0 text-main" style={{ fontSize: '0.85rem' }}>➕ Tambah Member Baru</h4>
              <button
                type="button"
                onClick={() => {
                  setShowTambahMemberModal(false);
                  setMemberBaruTerdaftar(null);
                }}
                className="btn btn-link text-main p-0 border-0"
                style={{ fontSize: '0.9rem', textDecoration: 'none' }}
              >✕</button>
            </div>

            {memberBaruTerdaftar ? (
              <div className="text-center py-2">
                <div className="text-success fw-bold mb-2" style={{ fontSize: '0.85rem' }}>✅ Member Berhasil Didaftarkan!</div>
                <p className="text-muted mb-4" style={{ fontSize: '0.75rem' }}>
                  Member <strong>{memberBaruTerdaftar.nama}</strong> telah berhasil dibuat.<br/>
                  Password login sementara adalah 4 digit terakhir nomor WA yaitu: <strong>{memberBaruTerdaftar.wa.substring(memberBaruTerdaftar.wa.length - 4)}</strong>.
                </p>
                <div className="d-flex flex-column gap-2">
                  <a
                    href={`https://wa.me/${memberBaruTerdaftar.wa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Halo ${memberBaruTerdaftar.nama},\nPendaftaran Member Anda di BKW berhasil!\n\nDetail Akun Anda:\nUsername/WA: ${memberBaruTerdaftar.wa}\nPassword Sementara: ${memberBaruTerdaftar.wa.substring(memberBaruTerdaftar.wa.length - 4)}\n\nTautan Login: http://localhost:5173/login`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tombol-premium border-0 text-center py-2 small d-flex align-items-center justify-content-center gap-2"
                    style={{ fontSize: '0.78rem', borderRadius: '8px', textDecoration: 'none' }}
                  >
                    💬 Kirim Info Akses via WA
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTambahMemberModal(false);
                      setMemberBaruTerdaftar(null);
                    }}
                    className="tombol-sekunder-premium border-0 py-2 small"
                    style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={tambahMemberBaru}>
                <div className="mb-3">
                  <label className="text-muted small mb-1 d-block" style={{ fontSize: '0.7rem' }}>Nama Lengkap:</label>
                  <input
                    type="text"
                    required
                    className="form-control input-premium text-main"
                    style={{ fontSize: '0.8rem' }}
                    placeholder="Nama pelanggan..."
                    value={namaMemberBaru}
                    onChange={e => setNamaMemberBaru(e.target.value)}
                  />
                </div>
                <div className="mb-3">
                  <label className="text-muted small mb-1 d-block" style={{ fontSize: '0.7rem' }}>Nomor WhatsApp:</label>
                  <input
                    type="text"
                    required
                    className="form-control input-premium text-main"
                    style={{ fontSize: '0.8rem' }}
                    placeholder="Contoh: 0858xxxxxxxx..."
                    value={waMemberBaru}
                    onChange={e => setWaMemberBaru(e.target.value)}
                  />
                </div>
                <div className="d-flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowTambahMemberModal(false)}
                    className="tombol-sekunder-premium border-0 flex-fill py-2 small"
                    style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="tombol-premium border-0 flex-fill py-2 small"
                    style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                  >
                    Daftarkan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ===== MODAL DETAIL NOTA & EDIT HUTANG ===== */}
      {showDetailNotaModal && selectedTransaksi && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{
            zIndex: 9993,
            backgroundColor: 'rgba(11, 15, 25, 0.65)',
            backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease forwards'
          }}
        >
          <div className="kartu-premium fade-in w-100" style={{ maxWidth: '580px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex align-items-center justify-content-between pb-2 mb-3" style={{ borderBottom: '1px solid var(--warna-border)' }}>
              <h4 className="fw-bold mb-0 text-main" style={{ fontSize: '0.85rem' }}>
                📄 Detail Transaksi: {selectedTransaksi.nomor_invoice}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setShowDetailNotaModal(false);
                  setSelectedTransaksi(null);
                  setPilihanProdukHutang('');
                  setPilihanQtyHutang(1);
                  setWaNotaManual('');
                }}
                className="btn btn-link text-main p-0 border-0"
                style={{ fontSize: '0.9rem', textDecoration: 'none' }}
              >✕</button>
            </div>

            {/* Receipt Content */}
            <div className="p-3 mb-3 rounded-3" style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
              <div className="row g-2 mb-3 text-muted">
                <div className="col-6">Kasir: <strong className="text-main">{selectedTransaksi.nama_kasir || `User #${selectedTransaksi.kasir_id}`}</strong></div>
                <div className="col-6 text-end">Waktu: <strong className="text-main">{new Date(selectedTransaksi.created_at).toLocaleString('id-ID')}</strong></div>
                <div className="col-12">
                  Pelanggan: <strong className="text-main">{selectedTransaksi.nama_pelanggan ? `${selectedTransaksi.nama_pelanggan} (${selectedTransaksi.wa_pelanggan})` : 'Umum/Tamu'}</strong>
                </div>
                <div className="col-6">
                  Status: {selectedTransaksi.status_pembayaran === 'lunas' ? (
                    <span className="badge bg-success" style={{ fontSize: '0.62rem' }}>Lunas ({selectedTransaksi.metode_pembayaran?.toUpperCase()})</span>
                  ) : (
                    <span className="badge bg-danger" style={{ fontSize: '0.62rem' }}>Hutang (Belum Lunas)</span>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="mt-3">
                <div className="fw-bold text-main mb-2" style={{ borderBottom: '1px dashed var(--warna-border)', paddingBottom: '4px' }}>Daftar Belanja:</div>
                <div className="d-flex flex-column gap-2">
                  {selectedTransaksi.detail?.map(d => (
                    <div key={d.id} className="d-flex justify-content-between align-items-center">
                      <div className="text-main">• {d.nama_produk} (x{d.qty})</div>
                      <div className="fw-bold text-main">{formatRupiah(d.harga_satuan * d.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 fw-bold text-main" style={{ borderTop: '1px solid var(--warna-border)' }}>
                  <span>Total Tagihan:</span>
                  <span className="fs-6" style={{ color: 'var(--warna-utama)' }}>{formatRupiah(selectedTransaksi.total_harga)}</span>
                </div>
              </div>
            </div>

            {/* ACTION PANEL BERDASARKAN STATUS */}
            {selectedTransaksi.status_pembayaran === 'belum_bayar' ? (
              (() => {
                // Periksa apakah transaksi dalam siklus yang sama
                const shiftPertama = opsiShift[0];
                let isBisaEdit = false;

                const parseSafeDate = (dateStr) => {
                  if (!dateStr) return new Date();
                  const cleaned = String(dateStr).replace(' ', 'T');
                  const d = new Date(cleaned);
                  if (isNaN(d.getTime())) {
                    const parts = String(dateStr).split(/[- :]/);
                    if (parts.length >= 5) {
                      return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0);
                    }
                    return new Date();
                  }
                  return d;
                };

                const getLocalDateString = (dt) => {
                  const year = dt.getFullYear();
                  const month = String(dt.getMonth() + 1).padStart(2, '0');
                  const day = String(dt.getDate()).padStart(2, '0');
                  return `${year}-${month}-${day}`;
                };

                const txDate = parseSafeDate(selectedTransaksi.created_at);
                const nowDate = new Date();

                if (shiftPertama) {
                  const dapatkanSiklus = (dt) => {
                    const jamMulai = shiftPertama.jam_mulai;
                    const toleransi = Number(shiftPertama.toleransi_sebelum);
                    const dateStr = getLocalDateString(dt);
                    
                    const [h, m, s] = jamMulai.split(':');
                    const cycleStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), Number(h), Number(m), Number(s) || 0).getTime() - (toleransi * 60 * 1000) + (15 * 60 * 1000);
                    
                    if (dt.getTime() >= cycleStart) {
                      return dateStr;
                    } else {
                      const prevDate = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
                      return getLocalDateString(prevDate);
                    }
                  };

                  isBisaEdit = dapatkanSiklus(nowDate) === dapatkanSiklus(txDate);
                } else {
                  isBisaEdit = getLocalDateString(nowDate) === getLocalDateString(txDate);
                }

                return (
                  <div>
                    {isBisaEdit ? (
                      <div className="p-3 mb-4 rounded-3" style={{ border: '1px solid rgba(99,102,241,0.15)', backgroundColor: 'rgba(99,102,241,0.02)' }}>
                        <div className="fw-bold mb-2 text-main" style={{ fontSize: '0.78rem' }}>➕ Tambah Item Pesanan (Siklus Aktif):</div>
                        <div className="row g-2">
                          <div className="col-12 col-sm-8">
                            <select
                              value={pilihanProdukHutang}
                              onChange={e => setPilihanProdukHutang(e.target.value)}
                              className="form-select input-premium text-main py-1 px-2"
                              style={{ fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                              <option value="">-- Pilih Tambah Produk --</option>
                              {posProducts.filter(p => Number(p.harga_jual) > 0).map(p => (
                                <option key={p.id} value={p.id}>{p.nama_produk} ({formatRupiah(p.harga_jual)})</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-12 col-sm-4">
                            <input
                              type="number"
                              min="1"
                              value={pilihanQtyHutang}
                              onChange={e => setPilihanQtyHutang(Number(e.target.value))}
                              className="form-control input-premium text-main py-1 text-center"
                              style={{ fontSize: '0.75rem', borderRadius: '6px' }}
                              placeholder="Qty..."
                            />
                          </div>
                        </div>

                        <div className="d-flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={simpanTambahanPesananHutang}
                            className="tombol-sekunder-premium border-0 flex-fill py-1.5 px-3 small"
                            style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                          >
                            💾 Simpan Tambahan Pesanan
                          </button>
                        </div>

                        {/* Pelunasan Panel */}
                        <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--warna-border)' }}>
                          <label className="text-muted small mb-1.5 d-block">Metode Pelunasan:</label>
                          <div className="d-flex flex-column gap-2">
                            <div className="d-flex gap-1.5 p-1 rounded-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--warna-border)' }}>
                              <button
                                type="button"
                                onClick={() => setMetodePelunasanHutang('cash')}
                                className="border-0 flex-fill py-1.5 px-2 small text-center"
                                style={{
                                  fontSize: '0.74rem',
                                  borderRadius: '6px',
                                  backgroundColor: metodePelunasanHutang === 'cash' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                  color: metodePelunasanHutang === 'cash' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                              >
                                💵 Cash
                              </button>
                              <button
                                type="button"
                                onClick={() => setMetodePelunasanHutang('qris')}
                                className="border-0 flex-fill py-1.5 px-2 small text-center"
                                style={{
                                  fontSize: '0.74rem',
                                  borderRadius: '6px',
                                  backgroundColor: metodePelunasanHutang === 'qris' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                  color: metodePelunasanHutang === 'qris' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                              >
                                📱 QRIS
                              </button>
                              <button
                                type="button"
                                onClick={() => setMetodePelunasanHutang('tap')}
                                className="border-0 flex-fill py-1.5 px-2 small text-center"
                                style={{
                                  fontSize: '0.74rem',
                                  borderRadius: '6px',
                                  backgroundColor: metodePelunasanHutang === 'tap' ? 'var(--warna-utama, #6366f1)' : 'transparent',
                                  color: metodePelunasanHutang === 'tap' ? '#fff' : 'var(--teks-redup, #94a3b8)',
                                  fontWeight: 600,
                                  transition: 'all 0.2s'
                                }}
                              >
                                🔲 Tap
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={bayarLunasHutang}
                              className="tombol-premium border-0 w-100 py-2 small text-center mt-1"
                              style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                            >
                              💰 Bayar Lunas Sekarang
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning py-2 px-3 small mb-4 border-0" style={{ borderRadius: '8px', color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.06)' }}>
                        ⚠️ Transaksi ini berada di luar siklus berjalan dan telah bersifat <strong>FINAL</strong> sebagai hutang. Item pesanan tidak dapat diubah kembali.
                      </div>
                    )}

                    {/* WA Penagihan link */}
                    {selectedTransaksi.wa_pelanggan && (
                      <a
                        href={`https://wa.me/${selectedTransaksi.wa_pelanggan.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                          `Halo ${selectedTransaksi.nama_pelanggan},\nKami dari BKW ingin mengingatkan mengenai tagihan belanja Anda sebesar ${formatRupiah(selectedTransaksi.total_harga)} (Nomor Invoice: ${selectedTransaksi.nomor_invoice}) yang saat ini berstatus belum lunas.\n\nAnda dapat melihat detail nota digital Anda melalui tautan berikut:\nhttp://localhost:5173/nota/${selectedTransaksi.id}\n\nTerima kasih atas kerja samanya.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tombol-sekunder-premium border-0 w-100 text-center py-2.5 small d-flex align-items-center justify-content-center gap-2 mb-2 text-danger"
                        style={{ fontSize: '0.78rem', borderRadius: '10px', textDecoration: 'none', background: 'rgba(239, 68, 68, 0.05)' }}
                      >
                        ⚠️ Kirim WA Penagihan Hutang
                      </a>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="d-flex flex-column gap-2 mb-2">
                {/* Cetak Struk */}
                <button
                  type="button"
                  onClick={() => window.open(`http://localhost:5173/nota/${selectedTransaksi.id}`, '_blank')}
                  className="tombol-premium border-0 w-100 text-center py-2.5 small d-flex align-items-center justify-content-center gap-2"
                  style={{ fontSize: '0.78rem', borderRadius: '10px' }}
                >
                  🖨️ Cetak Struk / Buka Digital Receipt
                </button>

                {/* WA Struk link */}
                {selectedTransaksi.wa_pelanggan ? (
                  <a
                    href={`https://wa.me/${selectedTransaksi.wa_pelanggan.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Halo ${selectedTransaksi.nama_pelanggan},\nTerima kasih telah berbelanja di BKW!\n\nBerikut adalah tautan nota digital resmi untuk transaksi belanja Anda (Nomor Invoice: ${selectedTransaksi.nomor_invoice}) sebesar ${formatRupiah(selectedTransaksi.total_harga)}:\nhttp://localhost:5173/nota/${selectedTransaksi.id}\n\nSemoga hari Anda menyenangkan!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tombol-sekunder-premium border-0 w-100 text-center py-2.5 small d-flex align-items-center justify-content-center gap-2 text-main"
                    style={{ fontSize: '0.78rem', borderRadius: '10px', textDecoration: 'none' }}
                  >
                    💬 Kirim Nota via WhatsApp
                  </a>
                ) : (
                  <div className="p-2.5 rounded-3 mb-1" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--warna-border)' }}>
                    <label className="text-muted small mb-1.5 d-block" style={{ fontSize: '0.7rem' }}>Kirim Nota ke WhatsApp Lain:</label>
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        className="form-control input-premium text-main py-1 px-2.5"
                        style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                        placeholder="Contoh: 08xxxxxxxx..."
                        value={waNotaManual}
                        onChange={e => setWaNotaManual(e.target.value)}
                      />
                      <button
                        type="button"
                        disabled={!waNotaManual}
                        onClick={() => {
                          const cleanWa = waNotaManual.replace(/[^0-9]/g, '');
                          if (!cleanWa) {
                            ui.notif('gagal', 'Nomor WA tidak valid.');
                            return;
                          }
                          window.open(`https://wa.me/${cleanWa}?text=${encodeURIComponent(
                            `Halo,\nTerima kasih telah berbelanja di BKW!\n\nBerikut adalah tautan nota digital resmi untuk transaksi belanja Anda (Nomor Invoice: ${selectedTransaksi.nomor_invoice}) sebesar ${formatRupiah(selectedTransaksi.total_harga)}:\nhttp://localhost:5173/nota/${selectedTransaksi.id}\n\nSemoga hari Anda menyenangkan!`
                          )}`, '_blank');
                        }}
                        className="tombol-sekunder-premium border-0 py-1.5 px-3 small d-flex align-items-center justify-content-center gap-1.5"
                        style={{ fontSize: '0.78rem', borderRadius: '8px' }}
                      >
                        💬 Kirim
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setShowDetailNotaModal(false);
                setSelectedTransaksi(null);
                setPilihanProdukHutang('');
                setPilihanQtyHutang(1);
                setWaNotaManual('');
              }}
              className="tombol-sekunder-premium border-0 w-100 py-2 small"
              style={{ fontSize: '0.78rem', borderRadius: '10px' }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
