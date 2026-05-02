// ─────────────────────────────────────────────────
//  UI — Rendering & interaction
// ─────────────────────────────────────────────────

const UI = (() => {

  let _activeDest = CONFIG.DESTINATIONS[0];
  let _activeTrip = null;
  let _editingEntry = null;
  let _selectedEntry = null;
  let _pendingTags = [];
  let _pendingRating = 0;
  let _selectedPhotoIds = [];
  let _availablePhotos = [];

  // ── Screen switches ───────────────────────────

  function showAuth() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
  }

  function showApp() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    _renderUser();
    _renderDestList();
    _wireSecondaryButtons();
    selectDest(_activeDest);
  }

  function _wireSecondaryButtons() {
    const b2 = document.getElementById('btn-new-entry-2');
    const s2 = document.getElementById('btn-sync-2');
    if (b2) b2.onclick = () => openNew();
    if (s2) s2.onclick = () => window.runSync && window.runSync();
  }

  // ── User ──────────────────────────────────────

  function _renderUser() {
    const profile = Auth.getProfile();
    if (!profile) return;
    const el = document.getElementById('user-name');
    if (el) el.textContent = profile.given_name || profile.name || '';
  }

  // ── Dest list ─────────────────────────────────

  function _renderDestList() {
    const list = document.getElementById('dest-list');
    if (!list) return;
    const colors = { lv: '#F7C948', sc: '#5ECFCF', pnw: '#E8433A' };
    list.innerHTML = CONFIG.DESTINATIONS.map(dest => {
      const count = Store.getEntries(dest.id).length;
      const trips = Store.getTrips(dest.id);
      const isActive = dest.id === _activeDest.id;
      let html = `
        <div class="dest-item ${isActive ? 'active' : ''}"
             onclick="UI.selectDest(UI.getDestById('${dest.id}'))">
          <div class="dest-bar" style="background:${colors[dest.id] || '#888'};"></div>
          <span>${dest.emoji} ${dest.name}</span>
          <span class="dest-badge">${count}</span>
        </div>`;
      if (isActive && trips.length) {
        trips.slice(0, 3).forEach(t => {
          html += `<div class="dest-sub ${_activeTrip && _activeTrip.id === t.id ? 'active' : ''}"
                        onclick="event.stopPropagation();UI.selectTrip('${t.id}')">
                     · ${t.label}
                   </div>`;
        });
      }
      return html;
    }).join('');
  }

  function getDestById(id) {
    return CONFIG.DESTINATIONS.find(d => d.id === id);
  }

  // ── Select destination ────────────────────────

  function selectDest(dest) {
    _activeDest = dest;
    _activeTrip = null;
    _selectedEntry = null;
    _renderDestList();
    _renderDestHeader();
    _renderDetailPane(null);
    renderEntries();
    _updateStatusBar();
  }

  function _renderDestHeader() {
    const dest = _activeDest;
    const el = document.getElementById('dest-emoji');
    if (el) el.textContent = dest.emoji;
    const titleEl = document.getElementById('dest-title');
    if (titleEl) titleEl.textContent = dest.name;
    const trips = Store.getTrips(dest.id);
    const entries = Store.getEntries(dest.id);
    const lastSync = Store.getLastSync();
    let meta = `${trips.length} trip${trips.length !== 1 ? 's' : ''} · ${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`;
    if (lastSync) meta += ` · synced ${_relativeTime(lastSync)}`;
    const metaEl = document.getElementById('dest-meta');
    if (metaEl) metaEl.textContent = meta;
    _renderTripTabs();
  }

  function _renderTripTabs() {
    const tabsEl = document.getElementById('trip-tabs');
    if (!tabsEl) return;
    const trips = Store.getTrips(_activeDest.id);
    let html = `<div class="trip-tab ${_activeTrip === null ? 'active' : ''}" onclick="UI.selectTrip(null)">All</div>`;
    trips.forEach(trip => {
      const active = _activeTrip && _activeTrip.id === trip.id;
      html += `<div class="trip-tab ${active ? 'active' : ''}" onclick="UI.selectTrip('${trip.id}')">
        ${trip.label} <span style="color:var(--hint);font-size:8px;margin-left:3px;">${trip.photoCount}✦</span>
      </div>`;
    });
    const unlinked = Store.getEntries(_activeDest.id).filter(e => !e.tripId);
    if (unlinked.length) {
      html += `<div class="trip-tab ${_activeTrip === 'unlinked' ? 'active' : ''}" onclick="UI.selectTrip('unlinked')">Manual</div>`;
    }
    tabsEl.innerHTML = html;
  }

  function selectTrip(tripId) {
    _activeTrip = tripId === 'unlinked' ? 'unlinked'
      : tripId ? Store.getTrip(tripId) : null;
    _renderTripTabs();
    _renderDestList();
    renderEntries();
  }

  // ── Entries list ──────────────────────────────

  function renderEntries() {
    const listEl = document.getElementById('entries-list');
    if (!listEl) return;

    let entries;
    if (_activeTrip === null) {
      entries = Store.getEntries(_activeDest.id);
    } else if (_activeTrip === 'unlinked') {
      entries = Store.getEntries(_activeDest.id).filter(e => !e.tripId);
    } else {
      entries = Store.getEntries(_activeDest.id, _activeTrip.id);
    }

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!entries.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${_activeDest.emoji}</span>
          <div class="empty-title">No entries yet</div>
          <div class="empty-body">Hit "+ New" to start logging your ${_activeDest.name} memories.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = entries.map(e => {
      const stars = e.rating ? '★'.repeat(e.rating) + '☆'.repeat(5 - e.rating) : '';
      const isSelected = _selectedEntry && _selectedEntry.id === e.id;
      return `
        <div class="entry-card ${isSelected ? 'selected' : ''}" onclick="UI._selectEntry('${e.id}')">
          <div class="entry-cell"><div class="entry-icon">JE</div>${_esc(e.title)}</div>
          <div class="entry-cell entry-cell-sub">${_formatDateShort(e.date)}</div>
          <div class="entry-cell entry-cell-sub">Entry</div>
          <div class="entry-cell"><span class="entry-stars">${stars}</span></div>
        </div>`;
    }).join('');

    _updateStatusBar(entries.length);
  }

  function _selectEntry(id) {
    const entry = Store.getEntry(id);
    _selectedEntry = entry;
    renderEntries();
    _renderDetailPane(entry);
  }

  // ── Detail pane ───────────────────────────────

  function _renderDetailPane(entry) {
    const titleEl  = document.getElementById('detail-title');
    const dateEl   = document.getElementById('detail-date');
    const quoteEl  = document.getElementById('detail-quote');
    const quoteTxt = document.getElementById('detail-quote-text');
    const quoteAtt = document.getElementById('detail-quote-attr');
    const propsEl  = document.getElementById('detail-props');
    const tagsEl   = document.getElementById('detail-tags');
    const delBtn   = document.getElementById('btn-detail-delete');
    const editBtn  = document.getElementById('btn-detail-edit');
    const openBtn  = document.getElementById('btn-detail-open');

    if (!entry) {
      if (titleEl) titleEl.textContent = '—';
      if (dateEl) dateEl.textContent = '';
      if (quoteEl) quoteEl.style.display = 'none';
      if (propsEl) propsEl.innerHTML = '';
      if (tagsEl) tagsEl.innerHTML = '';
      if (delBtn) delBtn.classList.add('hidden');
      if (editBtn) editBtn.classList.add('hidden');
      if (openBtn) openBtn.classList.add('hidden');
      return;
    }

    if (titleEl) titleEl.textContent = entry.title;
    if (dateEl) dateEl.textContent = `${_formatDate(entry.date)} · ${_activeDest.name}`;

    if (entry.text && quoteEl) {
      quoteEl.style.display = '';
      if (quoteTxt) quoteTxt.textContent = `"${entry.text.substring(0, 120)}${entry.text.length > 120 ? '…' : ''}"`;
      if (quoteAtt) quoteAtt.textContent = `${entry.title} · ${_formatDate(entry.date)}`;
    } else if (quoteEl) {
      quoteEl.style.display = 'none';
    }

    if (propsEl) {
      const trip = entry.tripId ? Store.getTrip(entry.tripId) : null;
      propsEl.innerHTML = `
        ${trip ? `<div class="detail-prop"><span class="detail-prop-key">Trip</span><span class="detail-prop-val">${trip.label}</span></div>` : ''}
        <div class="detail-prop"><span class="detail-prop-key">Photos</span><span class="detail-prop-val">${(entry.photoIds || []).length} linked</span></div>
        ${entry.rating ? `<div class="detail-prop"><span class="detail-prop-key">Rating</span><span class="detail-prop-val" style="color:#C8A840;letter-spacing:2px;">${'★'.repeat(entry.rating)}${'☆'.repeat(5 - entry.rating)}</span></div>` : ''}
      `;
    }

    if (tagsEl) {
      tagsEl.innerHTML = (entry.tags || []).map(t =>
        `<span class="detail-tag">${t}</span>`
      ).join('');
    }

    if (delBtn) { delBtn.classList.remove('hidden'); delBtn.onclick = () => _deleteEntryFromDetail(entry.id); }
    if (editBtn) { editBtn.classList.remove('hidden'); editBtn.onclick = () => openEntry(entry.id); }
    if (openBtn) { openBtn.classList.remove('hidden'); openBtn.onclick = () => openEntry(entry.id); }
  }

  function _deleteEntryFromDetail(id) {
    if (!confirm('Delete this entry?')) return;
    Store.deleteEntry(id);
    _selectedEntry = null;
    _renderDetailPane(null);
    _renderDestList();
    _renderDestHeader();
    renderEntries();
  }

  // ── Entry modal ───────────────────────────────

  function openNew() {
    _editingEntry = null;
    _pendingTags = [];
    _pendingRating = 0;
    _selectedPhotoIds = [];
    _availablePhotos = _getTripPhotos();
    document.getElementById('modal-title').textContent = `New entry — ${_activeDest.name}`;
    document.getElementById('f-title').value = '';
    document.getElementById('f-date').value = _todayStr();
    document.getElementById('f-text').value = '';
    document.getElementById('btn-delete-entry').classList.add('hidden');
    document.getElementById('btn-save-entry').onclick = _saveEntry;
    _renderTagSelector();
    _renderStars();
    _renderPhotoGrid();
    openModal('entry-modal');
  }

  function openEntry(id) {
    const entry = Store.getEntry(id);
    if (!entry) return;
    _editingEntry = entry;
    _pendingTags = [...(entry.tags || [])];
    _pendingRating = entry.rating || 0;
    _selectedPhotoIds = [...(entry.photoIds || [])];
    _availablePhotos = _getTripPhotos(entry.tripId);
    document.getElementById('modal-title').textContent = 'Edit entry';
    document.getElementById('f-title').value = entry.title;
    document.getElementById('f-date').value = entry.date;
    document.getElementById('f-text').value = entry.text;
    document.getElementById('btn-delete-entry').classList.remove('hidden');
    document.getElementById('btn-delete-entry').onclick = () => { Store.deleteEntry(id); closeModal('entry-modal'); _selectedEntry = null; _renderDetailPane(null); _renderDestList(); _renderDestHeader(); renderEntries(); };
    document.getElementById('btn-save-entry').onclick = _saveEntry;
    _renderTagSelector();
    _renderStars();
    _renderPhotoGrid();
    openModal('entry-modal');
  }

  function _getTripPhotos(tripId) {
    if (!tripId && _activeTrip && _activeTrip !== 'unlinked') tripId = _activeTrip.id;
    if (!tripId) return [];
    const trip = Store.getTrip(tripId);
    return trip ? (trip.photos || []) : [];
  }

  function _renderTagSelector() {
    document.getElementById('f-tags').innerHTML = _activeDest.tags.map(t =>
      `<span class="tag-opt ${_pendingTags.includes(t) ? 'selected' : ''}" onclick="UI._toggleTag('${t}')">${t}</span>`
    ).join('');
  }

  function _toggleTag(t) {
    const i = _pendingTags.indexOf(t);
    if (i >= 0) _pendingTags.splice(i, 1); else _pendingTags.push(t);
    document.querySelectorAll('.tag-opt').forEach(el => {
      el.classList.toggle('selected', _pendingTags.includes(el.textContent.trim()));
    });
  }

  function _renderStars() {
    document.getElementById('f-stars').innerHTML = [1, 2, 3, 4, 5].map(i =>
      `<span class="star ${_pendingRating >= i ? 'on' : ''}" onclick="UI._setRating(${i})">★</span>`
    ).join('');
  }

  function _setRating(n) {
    _pendingRating = n;
    document.querySelectorAll('#f-stars .star').forEach((s, i) => s.classList.toggle('on', i < n));
  }

  function _renderPhotoGrid() {
    const grid = document.getElementById('f-photos-grid');
    const section = document.getElementById('f-photos-section');
    if (!_availablePhotos.length) { section.style.display = 'none'; return; }
    section.style.display = '';
    grid.innerHTML = _availablePhotos.map(p => `
      <div class="photo-thumb-wrap ${_selectedPhotoIds.includes(p.id) ? 'selected' : ''}"
           onclick="UI._togglePhoto('${p.id}')" data-photoid="${p.id}">
        <img src="${Photos.thumbUrl(p.baseUrl, 160)}" alt="" loading="lazy">
        <div class="photo-check">✓</div>
      </div>`
    ).join('');
  }

  function _togglePhoto(id) {
    const i = _selectedPhotoIds.indexOf(id);
    if (i >= 0) _selectedPhotoIds.splice(i, 1); else _selectedPhotoIds.push(id);
    document.querySelector(`[data-photoid="${id}"]`)?.classList.toggle('selected', _selectedPhotoIds.includes(id));
  }

  function _saveEntry() {
    const title = document.getElementById('f-title').value.trim();
    if (!title) { document.getElementById('f-title').focus(); return; }
    const entry = {
      id:       _editingEntry ? _editingEntry.id : `e_${Date.now()}`,
      destId:   _activeDest.id,
      tripId:   (_activeTrip && _activeTrip !== 'unlinked') ? _activeTrip.id : (_editingEntry?.tripId || null),
      title,
      date:     document.getElementById('f-date').value,
      text:     document.getElementById('f-text').value.trim(),
      tags:     _pendingTags,
      rating:   _pendingRating,
      photoIds: _selectedPhotoIds
    };
    Store.saveEntry(entry);
    closeModal('entry-modal');
    _selectedEntry = entry;
    _renderDestList();
    _renderDestHeader();
    renderEntries();
    _renderDetailPane(entry);
  }

  // ── Status bar ────────────────────────────────

  function _updateStatusBar(count) {
    const entries = count !== undefined ? count : Store.getEntries(_activeDest.id).length;
    const countEl = document.getElementById('status-count');
    const destEl  = document.getElementById('status-dest');
    const syncEl  = document.getElementById('status-sync');
    if (countEl) countEl.textContent = `${entries} entr${entries !== 1 ? 'ies' : 'y'}`;
    if (destEl)  destEl.textContent  = _activeDest.name;
    if (syncEl) {
      const last = Store.getLastSync();
      syncEl.textContent = last ? `Synced ${_relativeTime(last)}` : 'Not synced';
    }
  }

  // ── Ticker update ─────────────────────────────

  function updateTicker() {
    const el = document.getElementById('ticker-inner');
    if (!el) return;
    const parts = CONFIG.DESTINATIONS.map(d => {
      const trips = Store.getTrips(d.id).length;
      const entries = Store.getEntries(d.id).length;
      return `<span class="tick-hi">${d.name}</span><span class="tick-sep">—</span>${trips} trip${trips !== 1 ? 's' : ''} · ${entries} entr${entries !== 1 ? 'ies' : 'y'}`;
    });
    const last = Store.getLastSync();
    if (last) parts.push(`Last sync ${_relativeTime(last)}`);
    el.innerHTML = parts.join('<span class="tick-sep">—</span>') + '<span class="tick-sep">—</span>';
  }

  // ── Lightbox ──────────────────────────────────

  function openLightbox(url, caption) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox-caption').textContent = caption || '';
    document.getElementById('lightbox').classList.remove('hidden');
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    document.getElementById('lightbox-img').src = '';
  }

  // ── Sync banner ───────────────────────────────

  function showSyncBanner(msg) {
    document.getElementById('sync-status-text').textContent = msg;
    document.getElementById('sync-banner').classList.remove('hidden');
  }

  function hideSyncBanner() {
    document.getElementById('sync-banner').classList.add('hidden');
    _updateStatusBar();
    updateTicker();
  }

  // ── Modal ─────────────────────────────────────

  function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  // ── Utilities ─────────────────────────────────

  function _esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _todayStr() { return new Date().toISOString().split('T')[0]; }
  function _formatDate(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[+m-1]} ${+day}, ${y}`;
  }
  function _formatDateShort(d) {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return `${m} · ${day} · ${y.slice(2)}`;
  }
  function _relativeTime(iso) {
    const diff = Date.now() - new Date(iso);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return {
    showAuth, showApp, selectDest, selectTrip, getDestById,
    renderEntries, openNew, openEntry,
    openModal, closeModal,
    openLightbox, closeLightbox,
    showSyncBanner, hideSyncBanner,
    updateTicker,
    _selectEntry, _toggleTag, _setRating, _togglePhoto
  };
})();
