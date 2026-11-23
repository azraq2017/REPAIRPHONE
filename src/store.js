// Simpanan ringkas dalam fail JSON. Node berjalan satu-thread, jadi semakan
// kapasiti + simpan dalam satu panggilan segerak tidak boleh bertindih.
const fs = require('fs');
const path = require('path');

function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let bookings = [];
  if (fs.existsSync(file)) {
    bookings = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(bookings, null, 2));
    fs.renameSync(tmp, file);
  }

  return {
    all: () => bookings,
    find: (ref) => bookings.find((b) => b.ref === ref),
    insert(b) {
      bookings.push(b);
      save();
      return b;
    },
    update(ref, patch) {
      const b = bookings.find((x) => x.ref === ref);
      if (!b) return null;
      Object.assign(b, patch, { updatedAt: new Date().toISOString() });
      save();
      return b;
    },
  };
}

module.exports = { createStore };
