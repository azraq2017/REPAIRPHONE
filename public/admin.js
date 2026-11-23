(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LABEL = {
    dijadualkan: 'Dijadualkan', diterima: 'Telefon diterima', dalam_pembaikan: 'Dalam pembaikan',
    siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
  };
  let key = sessionStorageGet('adminKey');
  let statuses = [];

  function sessionStorageGet(k) { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* abaikan */ } }

  async function api(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-key': key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Ralat'); e.status = res.status; throw e; }
    return data;
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
  $('fDate').value = today;

  async function load() {
    $('panelErr').classList.add('hidden');
    const q = new URLSearchParams();
    if ($('fDate').value) q.set('date', $('fDate').value);
    if ($('fType').value) q.set('type', $('fType').value);
    try {
      const data = await api(`/api/admin/bookings?${q}`);
      statuses = data.statuses;
      $('loginCard').classList.add('hidden');
      $('panel').classList.remove('hidden');
      render(data.bookings);
    } catch (e) {
      if (e.status === 401) {
        $('panel').classList.add('hidden');
        $('loginCard').classList.remove('hidden');
        if (key) { $('loginErr').textContent = e.message; $('loginErr').classList.remove('hidden'); }
        return;
      }
      $('panelErr').textContent = e.message; $('panelErr').classList.remove('hidden');
    }
  }

  function render(list) {
    const active = list.filter((b) => b.status !== 'dibatalkan');
    $('stats').innerHTML = [
      ['Jumlah', active.length],
      ['Walk-in', active.filter((b) => b.type === 'walkin').length],
      ['Pickup', active.filter((b) => b.type === 'pickup').length],
      ['Dibatalkan', list.length - active.length],
    ].map(([k, v]) => `<div><b>${v}</b>${k}</div>`).join('');

    if (!list.length) { $('list').innerHTML = '<div class="card muted">Tiada tempahan.</div>'; return; }
    $('list').innerHTML = list.map((b) => `
      <div class="bitem" data-ref="${esc(b.ref)}">
        <div class="head">
          <strong>${esc(b.date)} · ${esc(b.slotLabel)} · ${esc(b.type === 'pickup' ? 'PICKUP' : 'WALK-IN')}</strong>
          <span class="badge ${esc(b.status)}">${esc(LABEL[b.status] || b.status)}</span>
        </div>
        <div class="meta">${esc(b.ref)} · ${esc(b.name)} · <a href="https://wa.me/6${esc(b.phone)}" target="_blank" rel="noopener">${esc(b.phone)}</a></div>
        <div class="meta">${esc(b.brand)} ${esc(b.model)} — ${esc(b.issue)}${b.notes ? `: ${esc(b.notes)}` : ''}</div>
        ${b.type === 'pickup' ? `<div class="meta">📍 ${esc(b.address)}, ${esc(b.postcode)}</div>` : ''}
        <div class="ctrl">
          <select class="st">${statuses.map((s) => `<option value="${s}" ${s === b.status ? 'selected' : ''}>${LABEL[s] || s}</option>`).join('')}</select>
          <input class="qt" type="number" min="0" step="1" placeholder="Harga RM" value="${b.quote ?? ''}">
          <button class="btn save" type="button">Simpan</button>
        </div>
      </div>`).join('');
    $('list').querySelectorAll('.bitem').forEach((el) => {
      el.querySelector('.save').onclick = async () => {
        const body = { status: el.querySelector('.st').value };
        const q = el.querySelector('.qt').value;
        if (q !== '') body.quote = Number(q);
        try {
          await api(`/api/admin/bookings/${encodeURIComponent(el.dataset.ref)}`, { method: 'PATCH', body: JSON.stringify(body) });
          load();
        } catch (e) { alert(e.message); }
      };
    });
  }

  $('loginForm').onsubmit = (ev) => {
    ev.preventDefault();
    key = $('key').value;
    sessionStorageSet('adminKey', key);
    $('loginErr').classList.add('hidden');
    load();
  };
  $('fDate').onchange = load;
  $('fType').onchange = load;
  $('allBtn').onclick = () => { $('fDate').value = ''; load(); };

  if (key) load();
})();
