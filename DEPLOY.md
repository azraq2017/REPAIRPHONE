# Panduan Lancar Online

App ini menyimpan tempahan dalam satu fail (`bookings.json`). Hosting yang dipilih **mesti ada
storan berterusan (persistent disk / volume)**. Kalau tiada, semua tempahan akan hilang setiap kali
app di-deploy semula atau restart.

Atas sebab yang sama, jalankan **satu instance sahaja** (jangan scale ke 2+ mesin).

## Sebelum mula

1. Kemas kini `src/config.js`: waktu slot, kapasiti, caj pickup, hari tutup, cuti umum, jenama, harga.
2. Sediakan maklumat ini untuk dimasukkan sebagai *environment variables*:

| Nama | Contoh | Nota |
|---|---|---|
| `ADMIN_KEY` | (rentetan rawak panjang) | **Wajib**, min 12 aksara. Kata laluan halaman admin. |
| `SHOP_NAME` | `Kedai Repair Ali` | |
| `SHOP_ADDRESS` | `No. 5, Jalan Besar, 43000 Kajang` | Ditunjuk kepada pelanggan walk-in |
| `SHOP_WHATSAPP` | `60123456789` | Tanpa `+` atau `-` |
| `NODE_ENV` | `production` | |
| `DATA_FILE` | `/var/data/bookings.json` | Mesti dalam folder disk berterusan |

## Pilihan A — Render (paling mudah, disyorkan)

Kos: plan Starter (~USD 7/bulan) + disk 1 GB (~USD 0.25/bulan). Server di Singapura.

1. Daftar di https://render.com dan sambungkan akaun GitHub anda.
2. Klik **New → Blueprint**, pilih repo `REPAIRPHONE`. Render akan baca `render.yaml`.
3. Isi `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_WHATSAPP` bila diminta. `ADMIN_KEY` dijana automatik.
   Lihat nilainya di **Environment** untuk log masuk admin.
4. Klik **Apply**. Selepas siap, app boleh dibuka di `https://repairphone-booking.onrender.com`.

## Pilihan B — Railway

Kos: plan Hobby (~USD 5/bulan, termasuk penggunaan asas).

1. Daftar di https://railway.com → **New Project → Deploy from GitHub repo** → pilih `REPAIRPHONE`.
   Railway akan guna `Dockerfile` secara automatik.
2. Klik service → **Variables**: tambah `ADMIN_KEY`, `SHOP_NAME`, `SHOP_ADDRESS`, `SHOP_WHATSAPP`,
   dan `RAILWAY_RUN_UID=0` (supaya app boleh tulis ke volume).
3. Klik kanan service → **Attach Volume**, mount path: `/data`.
4. **Settings → Networking → Generate Domain** untuk dapat alamat `*.up.railway.app`.

## Pilihan C — VPS sendiri (cth. DigitalOcean, Vultr, Exabytes)

```bash
docker build -t repairphone .
docker run -d --name repairphone --restart unless-stopped -p 3000:3000 \
  -e ADMIN_KEY=kata-laluan-panjang-anda -e SHOP_NAME="Kedai Anda" \
  -e SHOP_ADDRESS="Alamat kedai" -e SHOP_WHATSAPP=60123456789 \
  -v repairphone-data:/data repairphone
```

Letak Caddy atau Nginx di hadapan untuk HTTPS.

## Domain sendiri (cth. `tempah.kedaianda.com`)

1. Di Render/Railway, tambah *custom domain* dalam tetapan service.
2. Di tempat anda beli domain, tambah rekod **CNAME** seperti yang diarahkan.
3. Sijil HTTPS dibuat automatik.

## Selepas lancar — semak

- [ ] Buka laman utama, buat satu tempahan ujian
- [ ] Buka `/admin.html`, log masuk, tukar status tempahan ujian kepada **Dibatalkan**
- [ ] Restart / redeploy app, pastikan tempahan ujian masih ada (bukti disk berfungsi)
- [ ] Butang WhatsApp membuka nombor kedai yang betul

## Backup

Di halaman admin, klik **Eksport CSV** untuk muat turun semua tempahan (boleh dibuka dalam Excel).
Buat sekurang-kurangnya seminggu sekali.

## Keselamatan yang sudah ada

- HTTPS (oleh hosting), header keselamatan (CSP, anti-clickjacking)
- Had kadar: 10 tempahan/jam setiap IP, 30 semakan tempahan/15 minit, 20 log masuk admin gagal/15 minit
- Semakan tempahan memerlukan nombor rujukan **dan** nombor telefon yang sepadan
- App enggan berjalan dalam production tanpa `ADMIN_KEY` yang cukup panjang
