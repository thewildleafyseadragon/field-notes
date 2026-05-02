// ─────────────────────────────────────────────────
//  APP — Entry point, wires everything together
// ─────────────────────────────────────────────────

(async function init() {

  // Seed sample data if this is the first visit
  Store.seedIfEmpty();

  // Wire sign-in button — GIS uses a popup, callback fires on success
  document.getElementById('btn-signin').addEventListener('click', () => {
    Auth.signIn(async () => {
      UI.showApp();
      await runSync();
    });
  });

  document.getElementById('btn-signout').addEventListener('click', () => Auth.signOut());
  document.getElementById('btn-new-entry').addEventListener('click', () => UI.openNew());
  document.getElementById('btn-sync').addEventListener('click', () => runSync());

  // Try to restore existing session from localStorage
  const restored = await Auth.restoreSession();
  if (restored) {
    UI.showApp();
  } else {
    UI.showAuth();
  }

})();

// ── Google Photos Sync ────────────────────────────

async function runSync() {
  if (!Auth.isSignedIn()) return;

  UI.showSyncBanner('Connecting to Google Photos…');

  try {
    const allPhotos = await Photos.scanAll((msg) => {
      UI.showSyncBanner(msg);
    });

    UI.showSyncBanner(`Clustering ${allPhotos.length} photos into trips…`);

    let totalTrips = 0;
    for (const dest of CONFIG.DESTINATIONS) {
      const trips = Photos.clusterIntoTrips(allPhotos, dest);
      if (trips.length) {
        Store.upsertTrips(trips);
        totalTrips += trips.length;
      }
    }

    Store.setLastSync();
    UI.hideSyncBanner();

    UI.selectDest(UI.getDestById(CONFIG.DESTINATIONS[0].id));

    if (totalTrips === 0) {
      showNotice('Sync complete. No geotagged photos found yet for your destinations. Make sure location was enabled on your camera when you took them.');
    } else {
      showNotice(`Sync complete — found ${totalTrips} trip${totalTrips !== 1 ? 's' : ''} from your Google Photos.`);
    }

  } catch (err) {
    UI.hideSyncBanner();
    console.error('[Sync]', err);
    showNotice(`Sync failed: ${err.message}`);
  }
}

// ── Simple toast notice ───────────────────────────

function showNotice(msg) {
  let el = document.getElementById('fn-notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fn-notice';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:#1e1e1e;border:0.5px solid rgba(255,255,255,0.14);
      border-radius:10px;padding:10px 18px;font-family:'Josefin Sans',sans-serif;
      font-size:12px;color:#8a857c;z-index:300;max-width:480px;text-align:center;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);transition:opacity .4s;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 5000);
}
