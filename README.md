# RepairPhone — Tempahan Slot Repair Telefon

App web untuk pelanggan tempah slot repair telefon, dengan dua jenis servis:

- **Walk-in ke kedai** — pelanggan pilih tarikh & masa untuk datang ke kedai.
- **Pickup dari rumah** — pelanggan isi alamat, pilih tetingkap masa, rider ambil telefon.

## Ciri-ciri

**Pelanggan** (`/`)
- Pilih servis → tarikh → slot masa (tunjuk baki slot kosong, slot penuh/lepas ditutup)
- Isi jenama, model, masalah telefon dan maklumat diri
- Dapat nombor rujukan (cth `RP-NHTWLU`) + butang hantar butiran ke WhatsApp kedai
- Semak status & batal tempahan guna no. rujukan + no. telefon

**Admin** (`/admin.html`)
- Senarai tempahan ikut tarikh / jenis servis, dengan jumlah ringkas
- Kemas kini status (Dijadualkan → Diterima → Dalam pembaikan → Siap → Selesai) dan harga repair
- Klik nombor telefon untuk terus WhatsApp pelanggan
- Eksport semua tempahan ke CSV (backup / Excel)

## Jalankan

```bash
npm install
ADMIN_KEY=katalaluan-anda npm start
```

Buka http://localhost:3000 (pelanggan) dan http://localhost:3000/admin.html (admin).

Pembolehubah persekitaran: `PORT`, `ADMIN_KEY`, `DATA_FILE`, `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_WHATSAPP`.

## Tetapan kedai

Ubah `src/config.js` untuk: waktu slot, kapasiti setiap slot, caj pickup, hari tutup / cuti,
senarai jenama, senarai masalah & harga anggaran, dan berapa hari ke hadapan boleh tempah.

Tempahan disimpan dalam `data/bookings.json`.

## Lancar online

Lihat **[DEPLOY.md](DEPLOY.md)** — panduan untuk Render, Railway atau VPS sendiri.

## Ujian

```bash
npm test
```
