const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../src/config');
const { createStore } = require('../src/store');
const { createApp } = require('../src/app');

// Isnin 23 Nov 2026, 10:00 waktu Malaysia
const NOW = new Date('2026-11-23T02:00:00Z');

async function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
  const store = createStore(path.join(dir, 'b.json'));
  const app = createApp({ config, store, adminKey: 'rahsia', now: () => NOW });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(base + url, {
      method, headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  return { call, close: () => server.close() };
}

const walkin = {
  type: 'walkin', date: '2026-11-24', time: '10:00', name: 'Ali', phone: '012-345 6789',
  brand: 'Samsung', model: 'Galaxy A54', issue: 'screen',
};

test('tarikh: Ahad ditutup, tetingkap 14 hari', async () => {
  const t = await setup();
  const { body } = await t.call('GET', '/api/config');
  assert.strictEqual(body.dates.length, 14);
  assert.strictEqual(body.dates[0].date, '2026-11-23');
  assert.strictEqual(body.dates.find((d) => d.date === '2026-11-29').open, false); // Ahad
  t.close();
});

test('slot hari ini terlalu awal tidak tersedia', async () => {
  const t = await setup();
  const { body } = await t.call('GET', '/api/slots?type=walkin&date=2026-11-23');
  const byTime = Object.fromEntries(body.slots.map((s) => [s.time, s.available]));
  assert.strictEqual(byTime['10:00'], false);
  assert.strictEqual(byTime['11:00'], true);
  t.close();
});

test('walk-in: tempah, kapasiti penuh, semak & batal', async () => {
  const t = await setup();
  for (let i = 0; i < config.services.walkin.capacity; i++) {
    const r = await t.call('POST', '/api/bookings', walkin);
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.ref, /^RP-[A-Z0-9]{6}$/);
    assert.strictEqual(r.body.phone, '0123456789');
  }
  const full = await t.call('POST', '/api/bookings', walkin);
  assert.strictEqual(full.status, 409);

  const { body: list } = await t.call('GET', '/api/admin/bookings?date=2026-11-24', null, { 'x-admin-key': 'rahsia' });
  const ref = list.bookings[0].ref;

  assert.strictEqual((await t.call('GET', `/api/bookings/${ref}?phone=0199999999`)).status, 404);
  const got = await t.call('GET', `/api/bookings/${ref.toLowerCase()}?phone=60123456789`);
  assert.strictEqual(got.status, 200);

  const c = await t.call('POST', `/api/bookings/${ref}/cancel`, { phone: '0123456789' });
  assert.strictEqual(c.body.status, 'dibatalkan');

  // Slot dibebaskan semula selepas batal
  const again = await t.call('POST', '/api/bookings', walkin);
  assert.strictEqual(again.status, 201);
  t.close();
});

test('pickup memerlukan alamat & poskod, dan kenakan caj', async () => {
  const t = await setup();
  const base = { ...walkin, type: 'pickup', time: '12:00' };
  const bad = await t.call('POST', '/api/bookings', base);
  assert.strictEqual(bad.status, 400);
  const ok = await t.call('POST', '/api/bookings', { ...base, address: '12, Jalan Mawar 3, Taman Bunga', postcode: '43000' });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.body.fee, config.services.pickup.fee);
  assert.strictEqual(ok.body.slotLabel, '12:00 – 14:00');
  t.close();
});

test('tolak tarikh tutup & slot tidak wujud', async () => {
  const t = await setup();
  assert.strictEqual((await t.call('POST', '/api/bookings', { ...walkin, date: '2026-11-29' })).status, 409);
  assert.strictEqual((await t.call('POST', '/api/bookings', { ...walkin, time: '13:00' })).status, 400);
  assert.strictEqual((await t.call('POST', '/api/bookings', { ...walkin, date: '2027-01-30' })).status, 409);
  t.close();
});

test('admin: perlu kata laluan, kemas kini status', async () => {
  const t = await setup();
  assert.strictEqual((await t.call('GET', '/api/admin/bookings')).status, 401);
  const { body: b } = await t.call('POST', '/api/bookings', walkin);
  const r = await t.call('PATCH', `/api/admin/bookings/${b.ref}`, { status: 'diterima', quote: 250 }, { 'x-admin-key': 'rahsia' });
  assert.strictEqual(r.body.status, 'diterima');
  assert.strictEqual(r.body.quote, 250);
  // Selepas diterima, pelanggan tidak boleh batal sendiri
  assert.strictEqual((await t.call('POST', `/api/bookings/${b.ref}/cancel`, { phone: walkin.phone })).status, 400);
  t.close();
});
