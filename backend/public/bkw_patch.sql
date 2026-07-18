-- BKW PATCH SQL SCHEMA & DATA DUMP --

-- 1. Patch unit_kategori (jika belum ada unit Kantin)
INSERT IGNORE INTO unit_kategori (id, nama_kategori, usaha_id, created_at, updated_at) VALUES (5, 'Kantin', 2, NOW(), NOW());

-- DROP & CREATE TABLE produk_jasa --
DROP TABLE IF EXISTS `produk_jasa`;
CREATE TABLE `produk_jasa` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `usaha_id` int(11) unsigned NOT NULL,
  `unit_id` int(11) unsigned DEFAULT NULL,
  `nama_produk` varchar(100) NOT NULL,
  `tipe` enum('barang','jasa','sewa') NOT NULL DEFAULT 'barang',
  `harga_beli` decimal(15,2) NOT NULL DEFAULT 0.00,
  `harga_jual` decimal(15,2) NOT NULL DEFAULT 0.00,
  `stok` int(11) NOT NULL DEFAULT 0,
  `stok_minimum` int(11) NOT NULL DEFAULT 0,
  `is_stok_dikelola` tinyint(1) NOT NULL DEFAULT 0,
  `satuan` varchar(20) NOT NULL DEFAULT 'pcs',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `produk_jasa_usaha_id_foreign` (`usaha_id`),
  KEY `produk_jasa_unit_id_foreign` (`unit_id`),
  CONSTRAINT `produk_jasa_unit_id_foreign` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE CASCADE ON UPDATE SET NULL,
  CONSTRAINT `produk_jasa_usaha_id_foreign` FOREIGN KEY (`usaha_id`) REFERENCES `usaha` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- INSERT DATA FOR produk_jasa --
INSERT INTO `produk_jasa` (`id`, `usaha_id`, `unit_id`, `nama_produk`, `tipe`, `harga_beli`, `harga_jual`, `stok`, `stok_minimum`, `is_stok_dikelola`, `satuan`, `created_at`, `updated_at`) VALUES ('25', '2', '5', 'Mie Goreng', 'barang', '4000.00', '5000.00', '8', '1', '1', 'pcs', '2026-07-18 01:01:19', '2026-07-18 13:55:08');
INSERT INTO `produk_jasa` (`id`, `usaha_id`, `unit_id`, `nama_produk`, `tipe`, `harga_beli`, `harga_jual`, `stok`, `stok_minimum`, `is_stok_dikelola`, `satuan`, `created_at`, `updated_at`) VALUES ('26', '2', '5', 'Telur', 'barang', '3000.00', '4000.00', '2', '1', '1', 'pcs', '2026-07-18 01:01:51', '2026-07-18 14:06:57');
INSERT INTO `produk_jasa` (`id`, `usaha_id`, `unit_id`, `nama_produk`, `tipe`, `harga_beli`, `harga_jual`, `stok`, `stok_minimum`, `is_stok_dikelola`, `satuan`, `created_at`, `updated_at`) VALUES ('27', '2', '5', 'Mie Goreng Telur', 'barang', '0.00', '10000.00', '0', '0', '0', 'pcs', '2026-07-18 01:03:28', '2026-07-18 01:03:28');

-- DROP & CREATE TABLE transaksi --
DROP TABLE IF EXISTS `transaksi`;
CREATE TABLE `transaksi` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `usaha_id` int(11) unsigned NOT NULL,
  `unit_id` int(11) unsigned DEFAULT NULL,
  `nomor_invoice` varchar(50) NOT NULL,
  `kasir_id` int(11) unsigned NOT NULL,
  `pelanggan_id` int(11) unsigned DEFAULT NULL,
  `total_harga` decimal(15,2) NOT NULL DEFAULT 0.00,
  `uang_jaminan` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status_pembayaran` enum('belum_bayar','lunas') NOT NULL DEFAULT 'belum_bayar',
  `metode_pembayaran` enum('cash','qris','tap') DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transaksi_usaha_id_foreign` (`usaha_id`),
  KEY `transaksi_kasir_id_foreign` (`kasir_id`),
  KEY `fk_transaksi_unit` (`unit_id`),
  KEY `fk_transaksi_pelanggan` (`pelanggan_id`),
  CONSTRAINT `fk_transaksi_pelanggan` FOREIGN KEY (`pelanggan_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_transaksi_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transaksi_kasir_id_foreign` FOREIGN KEY (`kasir_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transaksi_usaha_id_foreign` FOREIGN KEY (`usaha_id`) REFERENCES `usaha` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- INSERT DATA FOR transaksi --
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('7', '2', NULL, 'INV-20260718-A4559E', '8', NULL, '19000.00', '0.00', 'lunas', NULL, '2026-07-18 01:04:26', '2026-07-18 01:04:26');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('10', '2', NULL, 'INV-20260718-1B0078', '8', NULL, '49000.00', '0.00', 'lunas', NULL, '2026-07-18 01:08:24', '2026-07-18 01:08:24');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('12', '2', '5', 'SC/KANTIN/20260718/0001', '8', '9', '13000.00', '0.00', 'lunas', 'qris', '2026-07-18 13:22:36', '2026-07-18 13:39:44');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('13', '2', '5', 'SC/KANTIN/20260718/0002', '8', '8', '18000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:31:37', '2026-07-18 13:38:22');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('14', '2', '5', 'SC/KANTIN/20260718/0003', '8', NULL, '5000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:39:58', '2026-07-18 13:39:58');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('15', '2', '5', 'SC/KANTIN/20260718/0004', '8', '2', '5000.00', '0.00', 'lunas', 'tap', '2026-07-18 13:42:28', '2026-07-18 14:07:14');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('17', '2', '5', 'SC/KANTIN/20260718/0005', '8', NULL, '5000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:51:15', '2026-07-18 13:51:15');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('18', '2', '5', 'SC/KANTIN/20260718/0006', '8', NULL, '4000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:54:53', '2026-07-18 13:54:53');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('19', '2', '5', 'SC/KANTIN/20260718/0007', '8', '2', '10000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:55:08', '2026-07-18 13:55:08');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('20', '2', '5', 'SC/KANTIN/20260718/0008', '8', '8', '8000.00', '0.00', 'lunas', 'cash', '2026-07-18 13:55:32', '2026-07-18 14:06:39');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('21', '2', '5', 'SC/KANTIN/20260718/0009', '8', NULL, '4000.00', '0.00', 'lunas', 'cash', '2026-07-18 14:01:52', '2026-07-18 14:01:52');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('22', '2', '5', 'SC/KANTIN/20260718/0010', '8', '8', '8000.00', '0.00', 'lunas', 'qris', '2026-07-18 14:02:04', '2026-07-18 14:02:31');
INSERT INTO `transaksi` (`id`, `usaha_id`, `unit_id`, `nomor_invoice`, `kasir_id`, `pelanggan_id`, `total_harga`, `uang_jaminan`, `status_pembayaran`, `metode_pembayaran`, `created_at`, `updated_at`) VALUES ('23', '2', '5', 'SC/KANTIN/20260718/0011', '8', '2', '4000.00', '0.00', 'lunas', 'tap', '2026-07-18 14:06:57', '2026-07-18 14:07:07');

-- DROP & CREATE TABLE transaksi_detail --
DROP TABLE IF EXISTS `transaksi_detail`;
CREATE TABLE `transaksi_detail` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `transaksi_id` int(11) unsigned NOT NULL,
  `produk_id` int(11) unsigned NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 1,
  `harga_satuan` decimal(15,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(15,2) NOT NULL DEFAULT 0.00,
  `tipe_sewa` enum('open','reguler') DEFAULT NULL,
  `waktu_mulai` datetime DEFAULT NULL,
  `waktu_selesai` datetime DEFAULT NULL,
  `durasi_menit` int(11) DEFAULT NULL,
  `status_sewa` enum('aktif','selesai') DEFAULT NULL,
  `petugas_id` int(11) unsigned DEFAULT NULL,
  `komisi_petugas` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transaksi_detail_transaksi_id_foreign` (`transaksi_id`),
  KEY `transaksi_detail_produk_id_foreign` (`produk_id`),
  KEY `transaksi_detail_petugas_id_foreign` (`petugas_id`),
  CONSTRAINT `transaksi_detail_petugas_id_foreign` FOREIGN KEY (`petugas_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE SET NULL,
  CONSTRAINT `transaksi_detail_produk_id_foreign` FOREIGN KEY (`produk_id`) REFERENCES `produk_jasa` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transaksi_detail_transaksi_id_foreign` FOREIGN KEY (`transaksi_id`) REFERENCES `transaksi` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- INSERT DATA FOR transaksi_detail --
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('8', '7', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:04:26', '2026-07-18 01:04:26');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('9', '7', '26', '1', '4000.00', '4000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:04:26', '2026-07-18 01:04:26');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('10', '7', '27', '1', '10000.00', '10000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:04:26', '2026-07-18 01:04:26');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('15', '10', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:08:24', '2026-07-18 01:08:24');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('16', '10', '26', '6', '4000.00', '24000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:08:24', '2026-07-18 01:08:24');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('17', '10', '27', '2', '10000.00', '20000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 01:08:24', '2026-07-18 01:08:24');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('18', '12', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:22:36', '2026-07-18 13:22:36');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('19', '12', '26', '2', '4000.00', '8000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:27:20', '2026-07-18 13:38:00');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('20', '13', '26', '2', '4000.00', '8000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:31:37', '2026-07-18 13:37:47');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('21', '13', '27', '1', '10000.00', '10000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:31:58', '2026-07-18 13:31:58');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('22', '14', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:39:58', '2026-07-18 13:39:58');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('23', '15', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:42:28', '2026-07-18 13:42:28');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('24', '17', '25', '1', '5000.00', '5000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:51:15', '2026-07-18 13:51:15');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('25', '18', '26', '1', '4000.00', '4000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:54:53', '2026-07-18 13:54:53');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('26', '19', '27', '1', '10000.00', '10000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:55:08', '2026-07-18 13:55:08');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('27', '20', '26', '2', '4000.00', '8000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 13:55:32', '2026-07-18 13:55:42');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('28', '21', '26', '1', '4000.00', '4000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 14:01:52', '2026-07-18 14:01:52');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('29', '22', '26', '2', '4000.00', '8000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 14:02:04', '2026-07-18 14:02:19');
INSERT INTO `transaksi_detail` (`id`, `transaksi_id`, `produk_id`, `qty`, `harga_satuan`, `subtotal`, `tipe_sewa`, `waktu_mulai`, `waktu_selesai`, `durasi_menit`, `status_sewa`, `petugas_id`, `komisi_petugas`, `created_at`, `updated_at`) VALUES ('30', '23', '26', '1', '4000.00', '4000.00', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', '2026-07-18 14:06:57', '2026-07-18 14:06:57');

-- DROP & CREATE TABLE produk_komposisi --
DROP TABLE IF EXISTS `produk_komposisi`;
CREATE TABLE `produk_komposisi` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `produk_induk_id` int(11) unsigned NOT NULL,
  `produk_bahan_id` int(11) unsigned NOT NULL,
  `jumlah` decimal(15,2) NOT NULL DEFAULT 1.00,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `produk_komposisi_produk_induk_id_foreign` (`produk_induk_id`),
  KEY `produk_komposisi_produk_bahan_id_foreign` (`produk_bahan_id`),
  CONSTRAINT `produk_komposisi_produk_bahan_id_foreign` FOREIGN KEY (`produk_bahan_id`) REFERENCES `produk_jasa` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `produk_komposisi_produk_induk_id_foreign` FOREIGN KEY (`produk_induk_id`) REFERENCES `produk_jasa` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- INSERT DATA FOR produk_komposisi --
INSERT INTO `produk_komposisi` (`id`, `produk_induk_id`, `produk_bahan_id`, `jumlah`, `created_at`, `updated_at`) VALUES ('17', '27', '26', '1.00', '2026-07-18 01:03:55', '2026-07-18 01:03:55');
INSERT INTO `produk_komposisi` (`id`, `produk_induk_id`, `produk_bahan_id`, `jumlah`, `created_at`, `updated_at`) VALUES ('18', '27', '25', '1.00', '2026-07-18 01:03:55', '2026-07-18 01:03:55');

