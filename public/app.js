(() => {
  const $ = (id) => document.getElementById(id);
  const WD = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
  const MON = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
  const STATUS = {
    dijadualkan: 'Dijadualkan', diterima: 'Telefon diterima', dalam_pembaikan: 'Dalam pembaikan',
    siap: 'Siap', selesai: 'Selesai', dibatalkan: 'Dibatalkan',
  };

  let cfg = null;
  const state = { type: '', date: '', time: '', slotLabel: '' };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rm = (n) => (n ? `RM${n}` : 'Percuma');
  const fmtDate = (d) => {
    const x = new Date(`${d}T00:00:00Z`);
    return `${WD[x.getUTCDay()]}, ${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  };

  async function api(url, opts = {}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ralat rangkaian. Cuba lagi.');
    return data;
  }

  function show(el, on) { el.classList.toggle('hidden', !on); }

  // ---------- Tabs ----------
  function tab(which) {
    $('tabBook').classList.toggle('active', which === 'book');
    $('tabCheck').classList.toggle('active', which === 'check');
    show($('bookView'), which === 'book');
    show($('checkView'), which === 'check');
  }
  $('tabBook').onclick = () => tab('book');
  $('tabCheck').onclick = () => tab('check');

  // ---------- Init ----------
  async function init() {
    cfg = await api('/api/config');
    document.title = `Tempah Repair — ${cfg.shop.name}`;
    $('shopName').textContent = cfg.shop.name;
    $('footer').textContent = `${cfg.shop.name} · ${cfg.shop.address}`;

    $('serviceChoices').innerHTML = Object.entries(cfg.services).map(([k, s]) => `
      <button type="button" class="choice" data-type="${k}">
        <span class="t">${esc(s.label)}</span>
        <span class="d">${esc(s.description)}</span>
        <span class="fee">${s.fee ? `Caj ${rm(s.fee)}` : 'Tiada caj tambahan'}</span>
      </button>`).join('');
    $('serviceChoices').querySelectorAll('.choice').forEach((b) => { b.onclick = () => pickType(b.dataset.type); });

    $('brand').insertAdjacentHTML('beforeend', cfg.brands.map((b) => `<option>${esc(b)}</option>`).join(''));
    $('issue').insertAdjacentHTML('beforeend', cfg.issues.map((i) =>
      `<option value="${i.id}">${esc(i.label)}${i.from ? ` (dari RM${i.from})` : ''}</option>`).join(''));

    renderDates();
    renderSummary();
  }

  function pickType(type) {
    state.type = type;
    $('serviceChoices').querySelectorAll('.choice').forEach((b) => b.classList.toggle('selected', b.dataset.type === type));
    $('pickupCard').hidden = type !== 'pickup';
    $('slotHint').textContent = type === 'pickup'
      ? 'Pilih tetingkap masa rider datang ambil telefon.'
      : 'Pilih masa anda datang ke kedai.';
    renderDates();
    if (state.date) loadSlots();
    else autoPickDate();
  }

  // Pilih tarikh terawal yang masih ada slot kosong
  async function autoPickDate() {
    for (const d of cfg.dates.filter((x) => x.open)) {
      const { slots } = await api(`/api/slots?type=${state.type}&date=${d.date}`);
      if (slots.some((s) => s.available)) {
        state.date = d.date;
        break;
      }
    }
    renderDates();
    loadSlots();
    const sel = $('dates').querySelector('.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function renderDates() {
    $('dates').innerHTML = cfg.dates.map((d) => {
      const x = new Date(`${d.date}T00:00:00Z`);
      return `<button type="button" class="date${d.date === state.date ? ' selected' : ''}" data-date="${d.date}" ${d.open && state.type ? '' : 'disabled'}
        title="${d.open ? '' : 'Tutup'}">
        <span class="wd">${WD[x.getUTCDay()]}</span><span class="dd">${x.getUTCDate()}</span><span class="mm">${MON[x.getUTCMonth()]}</span>
      </button>`;
    }).join('');
    $('dates').querySelectorAll('.date').forEach((b) => {
      b.onclick = () => { state.date = b.dataset.date; renderDates(); loadSlots(); };
    });
  }

  async function loadSlots() {
    state.time = ''; state.slotLabel = '';
    renderSummary();
    if (!state.type || !state.date) { $('slots').innerHTML = ''; return; }
    $('slots').innerHTML = '<span class="muted">Memuatkan slot…</span>';
    try {
      const { slots } = await api(`/api/slots?type=${state.type}&date=${state.date}`);
      if (!slots.some((s) => s.available)) {
        $('slots').innerHTML = '<span class="muted">Tiada slot kosong pada tarikh ini. Sila pilih tarikh lain.</span>';
        return;
      }
      $('slots').innerHTML = slots.map((s) => `
        <button type="button" class="slot" data-time="${s.time}" data-label="${esc(s.label)}" ${s.available ? '' : 'disabled'}>
          ${esc(s.label)}<span class="r">${s.available ? `${s.remaining} slot kosong` : (s.remaining ? 'Tidak tersedia' : 'Penuh')}</span>
        </button>`).join('');
      $('slots').querySelectorAll('.slot').forEach((b) => {
        b.onclick = () => {
          state.time = b.dataset.time; state.slotLabel = b.dataset.label;
          $('slots').querySelectorAll('.slot').forEach((x) => x.classList.toggle('selected', x === b));
          renderSummary();
        };
      });
    } catch (e) {
      $('slots').innerHTML = `<span class="muted">${esc(e.message)}</span>`;
    }
  }

  function renderSummary() {
    const s = cfg && cfg.services[state.type];
    const rows = [
      ['Servis', s ? s.label : '—'],
      ['Tarikh', state.date && state.type ? fmtDate(state.date) : '—'],
      ['Masa', state.slotLabel || '—'],
      ['Caj servis', s ? rm(s.fee) : '—'],
    ];
    $('summary').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  $('issue').onchange = () => { $('notesReq').textContent = $('issue').value === 'other' ? '(wajib)' : '(pilihan)'; };

  // ---------- Submit ----------
  $('bookForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('bookErr');
    show(err, false);
    const fail = (m) => { err.textContent = m; show(err, true); };
    if (!state.type) return fail('Sila pilih jenis servis.');
    if (!state.time) return fail('Sila pilih tarikh dan slot masa.');

    const payload = {
      type: state.type, date: state.date, time: state.time,
      brand: $('brand').value, model: $('model').value, issue: $('issue').value, notes: $('notes').value,
      name: $('name').value, phone: $('phone').value,
      address: $('address').value, postcode: $('postcode').value,
    };
    $('submitBtn').disabled = true;
    $('submitBtn').textContent = 'Menghantar…';
    try {
      const b = await api('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
      showDone(b);
    } catch (e) {
      fail(e.message);
      if (/penuh|tidak tersedia/i.test(e.message)) loadSlots();
    } finally {
      $('submitBtn').disabled = false;
      $('submitBtn').textContent = 'Sahkan tempahan';
    }
  };

  function bookingRows(b) {
    const issue = cfg.issues.find((i) => i.id === b.issue);
    const rows = [
      ['Servis', b.typeLabel],
      ['Tarikh', fmtDate(b.date)],
      ['Masa', b.slotLabel],
      ['Telefon', `${b.brand} ${b.model}`],
      ['Masalah', issue ? issue.label : b.issue],
      ['Nama', b.name],
      ['No. telefon', b.phone],
    ];
    if (b.type === 'pickup') rows.push(['Alamat', `${b.address}, ${b.postcode}`]);
    else rows.push(['Lokasi kedai', cfg.shop.address]);
    rows.push(['Caj servis', rm(b.fee)]);
    if (b.quote != null) rows.push(['Harga repair', `RM${b.quote}`]);
    return rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  }

  function showDone(b) {
    show($('bookForm'), false);
    show($('doneView'), true);
    $('doneRef').textContent = b.ref;
    $('doneSummary').innerHTML = bookingRows(b);
    const msg = `Salam, saya ${b.name}. Saya dah tempah slot repair.\nRujukan: ${b.ref}\n${b.typeLabel}: ${fmtDate(b.date)}, ${b.slotLabel}\nTelefon: ${b.brand} ${b.model}`;
    $('waBtn').href = `https://wa.me/${cfg.shop.whatsapp}?text=${encodeURIComponent(msg)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('newBtn').onclick = () => { location.reload(); };

  // ---------- Semak ----------
  let current = null;
  $('checkForm').onsubmit = async (ev) => {
    ev.preventDefault();
    show($('checkErr'), false);
    show($('checkResult'), false);
    show($('cancelOk'), false);
    try {
      const ref = $('cRef').value.trim().toUpperCase();
      current = await api(`/api/bookings/${encodeURIComponent(ref)}?phone=${encodeURIComponent($('cPhone').value)}`);
      renderCheck();
    } catch (e) {
      $('checkErr').textContent = e.message;
      show($('checkErr'), true);
    }
  };

  function renderCheck() {
    $('rRef').textContent = current.ref;
    $('rStatus').textContent = STATUS[current.status] || current.status;
    $('rStatus').className = `badge ${current.status}`;
    $('rSummary').innerHTML = bookingRows(current);
    show($('cancelBtn'), current.status === 'dijadualkan');
    show($('checkResult'), true);
  }

  $('cancelBtn').onclick = async () => {
    if (!confirm('Batal tempahan ini?')) return;
    try {
      current = await api(`/api/bookings/${encodeURIComponent(current.ref)}/cancel`, {
        method: 'POST', body: JSON.stringify({ phone: current.phone }),
      });
      renderCheck();
      show($('cancelOk'), true);
    } catch (e) {
      $('checkErr').textContent = e.message;
      show($('checkErr'), true);
    }
  };

  init().catch((e) => {
    document.querySelector('main').innerHTML = `<div class="card"><div class="alert err">${esc(e.message)}</div></div>`;
  });
})();
