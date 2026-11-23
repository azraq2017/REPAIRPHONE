const path = require('path');
const config = require('./config');
const { createStore } = require('./store');
const { createApp } = require('./app');

const adminKey = process.env.ADMIN_KEY;
if (!adminKey) {
  console.warn('AMARAN: ADMIN_KEY tidak ditetapkan — halaman admin dikunci. Jalankan dengan ADMIN_KEY=katalaluan npm start');
}

const store = createStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'bookings.json'));
const app = createApp({ config, store, adminKey });
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`${config.shop.name} booking berjalan di http://localhost:${port}`);
  console.log(`Admin: http://localhost:${port}/admin.html`);
});
