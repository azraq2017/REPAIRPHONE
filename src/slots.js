// Logik slot: tarikh dibuka, masa slot, dan baki kapasiti.

function nowParts(timezone, now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekday(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

function slotLabel(service, time) {
  return `${time} – ${fromMinutes(toMinutes(time) + service.slotMinutes)}`;
}

function isDateOpen(config, dateStr) {
  return !config.closedWeekdays.includes(weekday(dateStr)) && !config.closedDates.includes(dateStr);
}

// Senarai tarikh yang boleh ditempah bermula hari ini.
function bookableDates(config, now = new Date()) {
  const { date: today } = nowParts(config.timezone, now);
  const out = [];
  for (let i = 0; i < config.bookingWindowDays; i++) {
    const d = addDays(today, i);
    out.push({ date: d, open: isDateOpen(config, d) });
  }
  return out;
}

// Slot untuk satu tarikh & jenis servis, dengan baki kapasiti.
function slotsFor(config, bookings, type, dateStr, now = new Date()) {
  const service = config.services[type];
  if (!service) throw new Error('Jenis servis tidak sah');
  const { date: today, minutes: nowMin } = nowParts(config.timezone, now);
  const lastDate = addDays(today, config.bookingWindowDays - 1);
  const inWindow = dateStr >= today && dateStr <= lastDate;
  const open = inWindow && isDateOpen(config, dateStr);

  return service.slots.map((time) => {
    const taken = bookings.filter(
      (b) => b.type === type && b.date === dateStr && b.time === time && b.status !== 'dibatalkan',
    ).length;
    const remaining = Math.max(0, service.capacity - taken);
    const tooSoon = dateStr === today && toMinutes(time) < nowMin + config.minLeadMinutes;
    return {
      time,
      label: slotLabel(service, time),
      remaining,
      available: open && !tooSoon && remaining > 0,
    };
  });
}

module.exports = { nowParts, isValidDate, addDays, bookableDates, slotsFor, slotLabel, isDateOpen };
