// ─────────────────────────────────────────────────
//  STORE — Local persistence (localStorage)
//  Stores journal entries and discovered photo trips
// ─────────────────────────────────────────────────

const Store = (() => {

  const KEYS = {
    entries:   'fn_entries',
    trips:     'fn_trips',
    lastSync:  'fn_last_sync'
  };

  // ── Internal helpers ──────────────────────────

  function _load(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ── ENTRIES ───────────────────────────────────

  function getEntries(destId, tripId) {
    const all = _load(KEYS.entries);
    return all.filter(e =>
      (!destId || e.destId === destId) &&
      (!tripId || e.tripId === tripId)
    );
  }

  function getEntry(id) {
    return _load(KEYS.entries).find(e => e.id === id);
  }

  function saveEntry(entry) {
    const all = _load(KEYS.entries);
    const idx = all.findIndex(e => e.id === entry.id);
    if (idx >= 0) {
      all[idx] = entry;
    } else {
      all.push({ ...entry, id: entry.id || `e_${Date.now()}` });
    }
    _save(KEYS.entries, all);
    return entry;
  }

  function deleteEntry(id) {
    const all = _load(KEYS.entries).filter(e => e.id !== id);
    _save(KEYS.entries, all);
  }

  // ── TRIPS (from Google Photos sync) ──────────

  function getTrips(destId) {
    const all = _load(KEYS.trips);
    return destId ? all.filter(t => t.destId === destId) : all;
  }

  function upsertTrips(newTrips) {
    const existing = _load(KEYS.trips);
    for (const trip of newTrips) {
      const idx = existing.findIndex(t => t.id === trip.id);
      if (idx >= 0) {
        // Merge: keep journal entries, update photos
        existing[idx] = { ...existing[idx], ...trip };
      } else {
        existing.push(trip);
      }
    }
    _save(KEYS.trips, existing);
  }

  function getTrip(id) {
    return _load(KEYS.trips).find(t => t.id === id);
  }

  // ── LAST SYNC ─────────────────────────────────

  function getLastSync() {
    return localStorage.getItem(KEYS.lastSync);
  }

  function setLastSync() {
    localStorage.setItem(KEYS.lastSync, new Date().toISOString());
  }

  // ── SEED DATA (first run) ─────────────────────

  function seedIfEmpty() {
    const entries = _load(KEYS.entries);
    if (entries.length) return;

    const seeds = [
      {
        id: 'seed_1',
        destId: 'lv',
        tripId: null,
        title: 'Dinner at Spago',
        date: '2025-05-10',
        text: "Wolfgang Puck's flagship did not disappoint. The smoked salmon pizza is everything. Started at the bar with a Negroni before being seated. The room hums with energy.",
        tags: ['dining'],
        rating: 5,
        photoIds: []
      },
      {
        id: 'seed_2',
        destId: 'lv',
        tripId: null,
        title: 'Late night at Omnia',
        date: '2025-05-11',
        text: "Stunning LED chandelier ceiling. Got there around midnight. The rooftop was the real discovery — quieter, cooler, with unreal views of the strip at 1am.",
        tags: ['nightlife'],
        rating: 4,
        photoIds: []
      },
      {
        id: 'seed_3',
        destId: 'sc',
        tripId: null,
        title: 'Eilean Donan Castle',
        date: '2024-09-03',
        text: "Three lochs converging, mountains looming, and this ancient castle reflected in the still water. Misty morning made it feel like stepping into another century.",
        tags: ['castle', 'history'],
        rating: 5,
        photoIds: []
      }
    ];

    _save(KEYS.entries, seeds);
  }

  return {
    getEntries, getEntry, saveEntry, deleteEntry,
    getTrips, upsertTrips, getTrip,
    getLastSync, setLastSync,
    seedIfEmpty
  };
})();
