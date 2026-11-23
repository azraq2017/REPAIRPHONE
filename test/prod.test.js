const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../src/config');
const { createStore } = require('../src/store');
const { createApp } = require('../src/app');

const NOW = new Date('2026-11-23T02:00:00Z');

async function setup(limits) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-'));
  const store = createStore(path.join(dir, 'b.json'));
  const app = createApp({ config, store, adminKey: 'rahsia-panjang-12', now: () => NOW, limits });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => server.close() };
}

const booking = {
  type: 'walkin', date: '2026-11-24', time: '11:00', name: 'Ali, "Abu"', phone: '0123456789',
  brand: 'Apple', model: 'iPhone 12', issue: 'other', notes: '=HYPERLINK("x")',
};
const post = (base, body) => fetch(`${base}/api/bookings`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('health check & header keselamatan', async () => {
  const t = await setup();
  const r = await fetch(`${t.base}/healthz`);
  assert.strictEqual(r.status, 200);
  const page = await fetch(`${t.base}/`);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.strictEqual(page.headers.get('x-frame-options'), 'DENY');
  assert.strictEqual(page.headers.get('x-powered-by'), null);
  t.close();
});

test('JSON rosak & laluan API tidak wujud pulangkan JSON', async () => {
  const t = await setup();
  const bad = await fetch(`${t.base}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{x' });
  assert.strictEqual(bad.status, 400);
  const nf = await fetch(`${t.base}/api/tiada`);
  assert.strictEqual(nf.status, 404);
  assert.ok((await nf.json()).error);
  t.close();
});

test('had kadar tempahan', async () => {
  const t = await setup({ create: 2 });
  assert.strictEqual((await post(t.base, booking)).status, 201);
  assert.strictEqual((await post(t.base, booking)).status, 201);
  const r = await post(t.base, booking);
  assert.strictEqual(r.status, 429);
  assert.ok(r.headers.get('retry-after'));
  t.close();
});

test('had kadar hanya kira log masuk admin yang gagal', async () => {
  const t = await setup({ admin: 2 });
  const get = (key) => fetch(`${t.base}/api/admin/bookings`, { headers: { 'x-admin-key': key } });
  for (let i = 0; i < 5; i++) assert.strictEqual((await get('rahsia-panjang-12')).status, 200);
  assert.strictEqual((await get('salah')).status, 401);
  assert.strictEqual((await get('salah')).status, 401);
  assert.strictEqual((await get('salah')).status, 429);
  t.close();
});

test('eksport CSV terlindung & selamat untuk Excel', async () => {
  const t = await setup();
  await post(t.base, booking);
  assert.strictEqual((await fetch(`${t.base}/api/admin/export.csv`)).status, 401);
  const r = await fetch(`${t.base}/api/admin/export.csv`, { headers: { 'x-admin-key': 'rahsia-panjang-12' } });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/csv/);
  const text = await r.text();
  assert.match(text, /"Ali, ""Abu"""/);
  assert.match(text, /"'=HYPERLINK\(""x""\)"/);
  t.close();
});
