// Had kadar ringkas dalam memori (per IP, tetingkap tetap). Cukup untuk satu instance.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  timer.unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let h = hits.get(key);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(key, h);
    }
    h.count++;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: message || 'Terlalu banyak cubaan. Sila cuba sebentar lagi.' });
    }
    next();
  };
}

module.exports = { rateLimit };
