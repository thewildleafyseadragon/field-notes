// ─────────────────────────────────────────────────
//  PHOTOS — Google Photos API + trip clustering
// ─────────────────────────────────────────────────

const Photos = (() => {

  const BASE = 'https://photoslibrary.googleapis.com/v1';

  // ── Fetch all photos with location metadata ───

  async function scanAll(onProgress) {
    const token = Auth.getToken();
    if (!token) return [];

    let allItems = [];
    let pageToken = null;
    let page = 0;

    do {
      page++;
      if (onProgress) onProgress(`Scanning photos… page ${page}`);

      const body = { pageSize: 100 };
      if (pageToken) body.pageToken = pageToken;

      const resp = await fetch(`${BASE}/mediaItems:search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        console.error('[Photos] API error', resp.status);
        break;
      }

      const data = await resp.json();
      const items = data.mediaItems || [];
      allItems = allItems.concat(items);
      pageToken = data.nextPageToken;

      // Safety: max 20 pages (~2000 photos) to avoid rate limits on first run
      if (page >= 20) break;

    } while (pageToken);

    return allItems;
  }

  // ── Check if a photo falls within a destination bbox ──

  function _inBounds(photo, dest) {
    const loc = photo.mediaMetadata?.location;
    if (!loc) return false;
    const lat = parseFloat(loc.latitude);
    const lng = parseFloat(loc.longitude);
    const [minLat, maxLat, minLng, maxLng] = dest.bounds;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  }

  // ── Cluster photos into trips ─────────────────
  //  A "trip" is a contiguous run of days where photos
  //  exist for a destination, with gaps <= GAP_DAYS treated
  //  as the same trip.

  const GAP_DAYS = 2; // days of silence before starting a new trip

  function clusterIntoTrips(photos, dest) {
    // Filter to this destination
    const destPhotos = photos.filter(p => _inBounds(p, dest));
    if (!destPhotos.length) return [];

    // Sort by date ascending
    destPhotos.sort((a, b) => {
      const da = new Date(a.mediaMetadata?.creationTime || 0);
      const db = new Date(b.mediaMetadata?.creationTime || 0);
      return da - db;
    });

    // Group into clusters by date proximity
    const trips = [];
    let current = null;

    for (const photo of destPhotos) {
      const ts = new Date(photo.mediaMetadata?.creationTime || 0);
      const dayMs = 86400000;

      if (!current) {
        current = { photos: [photo], startDate: ts, endDate: ts };
      } else {
        const gap = (ts - current.endDate) / dayMs;
        if (gap <= GAP_DAYS) {
          current.photos.push(photo);
          current.endDate = ts;
        } else {
          trips.push(_finalizeTrip(current, dest, trips.length + 1));
          current = { photos: [photo], startDate: ts, endDate: ts };
        }
      }
    }
    if (current) trips.push(_finalizeTrip(current, dest, trips.length + 1));

    return trips.reverse(); // most recent first
  }

  function _finalizeTrip(raw, dest, index) {
    const start = raw.startDate;
    const end = raw.endDate;
    const nights = Math.round((end - start) / 86400000);
    const label = _tripLabel(start, end, dest, index);
    return {
      id: `${dest.id}_${start.toISOString().split('T')[0]}`,
      destId: dest.id,
      label,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      nights,
      photoCount: raw.photos.length,
      photos: raw.photos.map(p => ({
        id: p.id,
        baseUrl: p.baseUrl,
        filename: p.filename,
        date: p.mediaMetadata?.creationTime,
        width: p.mediaMetadata?.width,
        height: p.mediaMetadata?.height
      }))
    };
  }

  function _tripLabel(start, end, dest, index) {
    const month = start.toLocaleString('en-US', { month: 'long' });
    const year = start.getFullYear();
    return `${month} ${year}`;
  }

  // ── Get a refreshed photo URL (they expire after ~1hr) ──

  async function refreshPhotoUrl(photoId) {
    const token = Auth.getToken();
    const resp = await fetch(`${BASE}/mediaItems/${photoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    return data.baseUrl;
  }

  // ── Build thumbnail URL from baseUrl ─────────

  function thumbUrl(baseUrl, size = 200) {
    return `${baseUrl}=w${size}-h${size}-c`;
  }

  function fullUrl(baseUrl, maxDim = 1200) {
    return `${baseUrl}=w${maxDim}-h${maxDim}`;
  }

  return { scanAll, clusterIntoTrips, refreshPhotoUrl, thumbUrl, fullUrl };
})();
