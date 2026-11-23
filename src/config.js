// Tetapan kedai. Ubah nilai di sini ikut operasi sebenar kedai anda.
module.exports = {
  shop: {
    name: process.env.SHOP_NAME || 'RepairPhone',
    address: process.env.SHOP_ADDRESS || 'No. 1, Jalan Contoh, 50000 Kuala Lumpur',
    // Nombor WhatsApp kedai dalam format antarabangsa tanpa "+" (cth: 60123456789)
    whatsapp: process.env.SHOP_WHATSAPP || '60123456789',
  },

  timezone: 'Asia/Kuala_Lumpur',

  // Berapa hari ke hadapan pelanggan boleh tempah
  bookingWindowDays: 14,
  // Slot mesti sekurang-kurangnya sekian minit dari masa sekarang
  minLeadMinutes: 60,

  // Hari tutup: 0 = Ahad, 1 = Isnin, ... 6 = Sabtu
  closedWeekdays: [0],
  // Tarikh cuti khas (YYYY-MM-DD)
  closedDates: [],

  services: {
    walkin: {
      label: 'Walk-in ke kedai',
      description: 'Bawa sendiri telefon ke kedai pada slot masa yang dipilih.',
      fee: 0,
      // Slot setiap jam; kapasiti = bilangan pelanggan per slot
      slots: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      slotMinutes: 60,
      capacity: 3,
    },
    pickup: {
      label: 'Pickup dari rumah',
      description: 'Rider kami ambil telefon di rumah anda dan hantar semula selepas siap.',
      fee: 15, // RM, caj pickup & hantar semula
      // Tetingkap masa pickup (2 jam)
      slots: ['10:00', '12:00', '14:00', '16:00'],
      slotMinutes: 120,
      capacity: 2,
    },
  },

  brands: ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Huawei', 'Realme', 'Honor', 'Lain-lain'],

  issues: [
    { id: 'screen', label: 'Skrin pecah / rosak', from: 120 },
    { id: 'battery', label: 'Tukar bateri', from: 80 },
    { id: 'charging', label: 'Port charging / tak boleh cas', from: 60 },
    { id: 'camera', label: 'Kamera', from: 90 },
    { id: 'speaker', label: 'Speaker / mikrofon', from: 60 },
    { id: 'water', label: 'Masuk air', from: 100 },
    { id: 'software', label: 'Software / hang / lupa password', from: 50 },
    { id: 'other', label: 'Lain-lain (terangkan)', from: null },
  ],

  statuses: ['dijadualkan', 'diterima', 'dalam_pembaikan', 'siap', 'selesai', 'dibatalkan'],
};
