const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { isValidDate, bookableDates, slotsFor, slotLabel } = require('./slots');

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

function createApp({ config, store, adminKey, now = () => new Date() }) {
  const app = express();
  app.use(express.json({ limit: '50kb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

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

  app.post('/api/bookings', (req, res) => {
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

  app.get('/api/bookings/:ref', (req, res) => {
    const b = findOwned(req, res);
    if (b) res.json(publicView(config, b));
  });

  app.post('/api/bookings/:ref/cancel', (req, res) => {
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
    if (!ok) return res.status(401).json({ error: 'Kata laluan admin salah' });
    next();
  }

  app.get('/api/admin/bookings', requireAdmin, (req, res) => {
    const { date, type } = req.query;
    let list = store.all();
    if (date) list = list.filter((b) => b.date === date);
    if (type) list = list.filter((b) => b.type === type);
    list = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    res.json({ statuses: config.statuses, bookings: list.map((b) => publicView(config, b)) });
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

  return app;
}

module.exports = { createApp, normalizePhone };
