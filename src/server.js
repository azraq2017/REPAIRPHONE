const path = require('path');
const config = require('./config');
const { createStore } = require('./store');
const { createApp } = require('./app');

const isProd = process.env.NODE_ENV === 'production';
const adminKey = process.env.ADMIN_KEY || '';

if (isProd && adminKey.length < 12) {
  console.error('RALAT: ADMIN_KEY mesti ditetapkan (sekurang-kurangnya 12 aksara) dalam production.');
  process.exit(1);
}
if (!adminKey) {
  console.warn('AMARAN: ADMIN_KEY tidak ditetapkan — halaman admin dikunci. Jalankan dengan ADMIN_KEY=katalaluan npm start');
}

const dataFile = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'bookings.json');
const store = createStore(dataFile);
const trustProxy = process.env.TRUST_PROXY === undefined ? 1 : Number(process.env.TRUST_PROXY);
const app = createApp({ config, store, adminKey, trustProxy });
const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`${config.shop.name} booking berjalan di port ${port} (data: ${dataFile})`);
});

function shutdown(signal) {
  console.log(`${signal} diterima, menutup pelayan…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
