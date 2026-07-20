import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const NotaPublik = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transaksi, setTransaksi] = useState(null);

  useEffect(() => {
    const fetchNota = async () => {
      try {
        const response = await fetch(`http://localhost:8080/api/transaksi-publik/detail/${id}`);
        const res = await response.json();
        if (response.ok && res.status === 'sukses') {
          setTransaksi(res.data);
        } else {
          setError(res.pesan || 'Transaksi tidak ditemukan.');
        }
      } catch (err) {
        setError('Gagal menghubungkan ke server.');
      } finally {
        setLoading(false);
      }
    };
    fetchNota();
  }, [id]);

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val));
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-dark text-white">
        <div className="text-center">
          <div className="spinner-border text-primary mb-2" role="status" />
          <div className="small">Memuat Nota Belanja...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex align-items-center justify-content-center vh-100 bg-dark text-white p-3">
        <div className="text-center bg-danger-subtle text-danger p-4 rounded-3" style={{ maxWidth: '400px' }}>
          <h4 className="fw-bold mb-2">Error</h4>
          <p className="small mb-0">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light py-5 px-3 d-flex align-items-center justify-content-center text-dark" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
      {/* Thermal Slip Styled Container */}
      <div className="bg-white p-4 p-sm-5 shadow-sm rounded-3 w-100" style={{ maxWidth: '480px', border: '1px solid #e2e8f0' }}>
        
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="fw-bold mb-1" style={{ letterSpacing: '1px' }}>{transaksi.nama_usaha || 'BKW'}</h3>
          <div className="small text-muted">{transaksi.nama_unit || 'Unit Kasir'}</div>
          <div className="small text-muted">Cabang/Alamat Usaha</div>
          <div className="mt-2" style={{ borderBottom: '2px dashed #cbd5e1' }} />
        </div>

        {/* Info */}
        <div className="mb-4 small text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
          <div className="d-flex justify-content-between">
            <span>No. Invoice:</span>
            <strong className="text-dark">{transaksi.nomor_invoice}</strong>
          </div>
          <div className="d-flex justify-content-between">
            <span>Tanggal:</span>
            <span className="text-dark">{new Date(transaksi.created_at).toLocaleString('id-ID')}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>Kasir:</span>
            <span className="text-dark">{transaksi.nama_kasir || `User #${transaksi.kasir_id}`}</span>
          </div>
          <div className="d-flex justify-content-between">
            <span>Pelanggan:</span>
            <span className="text-dark">{transaksi.nama_pelanggan || 'Umum/Tamu'}</span>
          </div>
          {transaksi.wa_pelanggan && (
            <div className="d-flex justify-content-between">
              <span>WhatsApp:</span>
              <span className="text-dark">{transaksi.wa_pelanggan}</span>
            </div>
          )}
          <div className="mt-3" style={{ borderBottom: '1px dashed #cbd5e1' }} />
        </div>

        {/* Items */}
        <div className="mb-4">
          <div className="d-flex justify-content-between fw-bold mb-2 small" style={{ fontSize: '0.8rem' }}>
            <span>Item Produk</span>
            <span>Total</span>
          </div>
          <div className="d-flex flex-column gap-2.5">
            {transaksi.detail?.map(d => {
              const statusLabels = {
                Menunggu: '⏳ Antrean',
                Dikerjakan: '🍳 Proses',
                Selesai: '✓ Selesai'
              };
              const showStatus = d.status_pengerjaan && d.status_pengerjaan !== 'Selesai';
              return (
                <div key={d.id} className="small d-flex justify-content-between align-items-start" style={{ fontSize: '0.8rem' }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div className="d-flex align-items-center gap-1.5 flex-wrap">
                      <span className="fw-semibold">{d.nama_produk}</span>
                      {showStatus && (
                        <span className={`badge ${d.status_pengerjaan === 'Menunggu' ? 'bg-warning text-dark' : 'bg-info'} border-0 ms-1`} style={{ fontSize: '0.58rem', padding: '0.1rem 0.3rem' }}>
                          {statusLabels[d.status_pengerjaan]}
                        </span>
                      )}
                    </div>
                    <div className="text-muted text-xs" style={{ fontSize: '0.72rem' }}>
                      {d.tipe === 'sewa' ? (
                        `${d.qty}m (${(d.qty / 60).toFixed(1)} Jam) x ${formatRupiah(d.harga_satuan)}/jam`
                      ) : (
                        `${d.qty} x ${formatRupiah(d.harga_satuan)}`
                      )}
                    </div>
                  </div>
                  <div className="fw-bold">{formatRupiah(d.subtotal ? d.subtotal : d.harga_satuan * d.qty)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3" style={{ borderBottom: '2px dashed #cbd5e1' }} />
        </div>

        {/* Totals */}
        <div className="mb-4 small" style={{ fontSize: '0.82rem' }}>
          <div className="d-flex justify-content-between fw-bold fs-6">
            <span>Grand Total:</span>
            <span>{formatRupiah(transaksi.total_harga)}</span>
          </div>
          
          <div className="d-flex justify-content-between mt-2 text-muted">
            <span>Status Pembayaran:</span>
            {transaksi.status_pembayaran === 'lunas' ? (
              <span className="badge bg-success-subtle text-success border-0 px-2 py-0.5" style={{ fontSize: '0.7rem' }}>Lunas ({transaksi.metode_pembayaran?.toUpperCase()})</span>
            ) : (
              <span className="badge bg-danger-subtle text-danger border-0 px-2 py-0.5" style={{ fontSize: '0.7rem' }}>Hutang / Belum Lunas</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-5">
          <div className="small text-muted italic" style={{ fontSize: '0.72rem' }}>Terima kasih atas kunjungan Anda!</div>
          <div className="small text-muted" style={{ fontSize: '0.65rem' }}>Nota ini adalah bukti pembayaran digital resmi.</div>
          
          {/* Print button (hidden on print) */}
          <div className="mt-4 d-print-none">
            <button
              onClick={() => window.print()}
              className="btn btn-outline-dark btn-sm w-100 py-2"
              style={{ borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}
            >
              🖨️ Cetak Struk Belanja
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NotaPublik;
