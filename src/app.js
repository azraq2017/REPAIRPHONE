const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { isValidDate, bookableDates, slotsFor, slotLabel } = require('./slots');
const { rateLimit } = require('./ratelimit');

function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.startsWith('60')) d = d.slice(1); // 6012... -> 012...
  return d;
}

function isValidPhone(p) {
  return /^01\d{8,9}$/.test(normalizePhone(p));
}

function makeRef(store) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref;
  do {
    ref = 'RP-' + Array.from(crypto.randomBytes(6), (x) => chars[x % chars.length]).join('');
  } while (store.find(ref));
  return ref;
}

function str(v, max = 300) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function publicView(config, b) {
  const service = config.services[b.type];
  return { ...b, typeLabel: service.label, slotLabel: slotLabel(service, b.time) };
}

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // elak formula injection dalam Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
}

function createApp({ config, store, adminKey, now = () => new Date(), trustProxy = 1, limits = {} }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy); // hosting (Render/Railway/Fly) berada di belakang proxy
  app.use(securityHeaders);

  app.get('/healthz', (req, res) => res.json({ ok: true }));

  app.use(express.json({ limit: '50kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const L = { create: 10, lookup: 30, admin: 20, ...limits };
  const createLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: L.create, message: 'Terlalu banyak tempahan dari peranti ini. Sila hubungi kedai melalui WhatsApp.' });
  const lookupLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: L.lookup });
  const adminFailLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: L.admin, message: 'Terlalu banyak cubaan log masuk. Cuba lagi dalam 15 minit.' });

  app.get('/api/config', (req, res) => {
    const services = Object.fromEntries(
      Object.entries(config.services).map(([k, s]) => [k, { label: s.label, description: s.description, fee: s.fee }]),
    );
    res.json({
      shop: config.shop,
      services,
      brands: config.brands,
      issues: config.issues,
      dates: bookableDates(config, now()),
    });
  });

  app.get('/api/slots', (req, res) => {
    const { date, type } = req.query;
    if (!config.services[type]) return res.status(400).json({ error: 'Jenis servis tidak sah' });
    if (!isValidDate(date)) return res.status(400).json({ error: 'Tarikh tidak sah' });
    res.json({ date, type, slots: slotsFor(config, store.all(), type, date, now()) });
  });

  app.post('/api/bookings', createLimit, (req, res) => {
    const body = req.body || {};
    const type = str(body.type, 20);
    const date = str(body.date, 10);
    const time = str(body.time, 5);
    const name = str(body.name, 100);
    const phone = normalizePhone(body.phone);
    const brand = str(body.brand, 50);
    const model = str(body.model, 100);
    const issue = str(body.issue, 30);
    const notes = str(body.notes, 1000);
    const address = str(body.address, 300);
    const postcode = str(body.postcode, 5);

    const errors = [];
    if (!config.services[type]) errors.push('Sila pilih jenis servis');
    if (!isValidDate(date)) errors.push('Sila pilih tarikh');
    if (!name) errors.push('Nama diperlukan');
    if (!isValidPhone(phone)) errors.push('Nombor telefon tidak sah (cth: 0123456789)');
    if (!config.brands.includes(brand)) errors.push('Sila pilih jenama telefon');
    if (!model) errors.push('Model telefon diperlukan');
    if (!config.issues.some((i) => i.id === issue)) errors.push('Sila pilih masalah');
    if (issue === 'other' && !notes) errors.push('Sila terangkan masalah telefon');
    if (type === 'pickup') {
      if (address.length < 10) errors.push('Alamat pickup penuh diperlukan');
      if (!/^\d{5}$/.test(postcode)) errors.push('Poskod tidak sah');
    }
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const slot = slotsFor(config, store.all(), type, date, now()).find((s) => s.time === time);
    if (!slot) return res.status(400).json({ error: 'Slot masa tidak sah' });
    if (!slot.available) return res.status(409).json({ error: 'Maaf, slot ini sudah penuh atau tidak tersedia. Sila pilih slot lain.' });

    const ts = new Date().toISOString();
    const booking = store.insert({
      ref: makeRef(store),
      type, date, time, name, phone, brand, model, issue, notes,
      address: type === 'pickup' ? address : '',
      postcode: type === 'pickup' ? postcode : '',
      fee: config.services[type].fee,
      status: 'dijadualkan',
      createdAt: ts,
      updatedAt: ts,
    });
    res.status(201).json(publicView(config, booking));
  });

  // Pelanggan semak tempahan: perlukan rujukan + nombor telefon yang sepadan
  function findOwned(req, res) {
    const b = store.find(String(req.params.ref || '').toUpperCase());
    const phone = normalizePhone(req.query.phone || (req.body && req.body.phone));
    if (!b || b.phone !== phone) {
      res.status(404).json({ error: 'Tempahan tidak dijumpai. Semak semula nombor rujukan & telefon.' });
      return null;
    }
    return b;
  }

  app.get('/api/bookings/:ref', lookupLimit, (req, res) => {
    const b = findOwned(req, res);
    if (b) res.json(publicView(config, b));
  });

  app.post('/api/bookings/:ref/cancel', lookupLimit, (req, res) => {
    const b = findOwned(req, res);
    if (!b) return;
    if (b.status !== 'dijadualkan') {
      return res.status(400).json({ error: 'Tempahan ini tidak boleh dibatalkan lagi. Sila hubungi kedai.' });
    }
    res.json(publicView(config, store.update(b.ref, { status: 'dibatalkan' })));
  });

  // ---- Admin ----
  function requireAdmin(req, res, next) {
    const key = String(req.get('x-admin-key') || '');
    const ok = adminKey && key.length === adminKey.length
      && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(adminKey));
    if (!ok) return adminFailLimit(req, res, () => res.status(401).json({ error: 'Kata laluan admin salah' }));
    next();
  }

  // Eksport semua tempahan sebagai CSV (untuk backup / Excel)
  app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
    const cols = ['ref', 'status', 'type', 'date', 'time', 'name', 'phone', 'brand', 'model', 'issue', 'notes',
      'address', 'postcode', 'fee', 'quote', 'adminNotes', 'createdAt', 'updatedAt'];
    const rows = [...store.all()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const csv = [cols.join(','), ...rows.map((b) => cols.map((c) => csvCell(b[c])).join(','))].join('\r\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="tempahan-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);
  });

  app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    const { date, type } = req.query;
    let list = store.all();
    if (date) list = list.filter((b) => b.date === date);
    if (type) list = list.filter((b) => b.type === type);
    list = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    res.json({ statuses: config.statuses, issues: config.issues, bookings: list.map((b) => publicView(config, b)) });
  });

  app.patch('/api/admin/bookings/:ref', requireAdmin, (req, res) => {
    const b = store.find(req.params.ref);
    if (!b) return res.status(404).json({ error: 'Tempahan tidak dijumpai' });
    const patch = {};
    if (req.body.status !== undefined) {
      if (!config.statuses.includes(req.body.status)) return res.status(400).json({ error: 'Status tidak sah' });
      patch.status = req.body.status;
    }
    if (req.body.quote !== undefined) {
      const q = Number(req.body.quote);
      if (!Number.isFinite(q) || q < 0) return res.status(400).json({ error: 'Harga tidak sah' });
      patch.quote = q;
    }
    if (req.body.adminNotes !== undefined) patch.adminNotes = str(req.body.adminNotes, 1000);
    res.json(publicView(config, store.update(b.ref, patch)));
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Tidak dijumpai' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data tidak sah' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data terlalu besar' });
    console.error(err);
    res.status(500).json({ error: 'Ralat pelayan. Sila cuba lagi.' });
  });

  return app;
}

module.exports = { createApp, normalizePhone };
