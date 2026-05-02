const Auth = (() => {
  let _accessToken = null;
  let _userProfile = null;

  function signIn(onSuccess) {
    if (!window.google || !window.google.accounts) {
      alert('Google is still loading. Wait 2 seconds and try again.');
      return;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          const el = document.getElementById('auth-error');
          if (el) { el.textContent = 'Sign-in failed: ' + resp.error; el.classList.remove('hidden'); }
          return;
        }
        _accessToken = resp.access_token;
        const expiry = Date.now() + ((resp.expires_in || 3600) * 1000);
        localStorage.setItem('fn_token', JSON.stringify({ token: _accessToken, expiry }));
        await _fetchProfile();
        if (onSuccess) onSuccess();
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  }

  async function restoreSession() {
    const stored = localStorage.getItem('fn_token');
    if (!stored) return false;
    try {
      const { token, expiry } = JSON.parse(stored);
      if (Date.now() > expiry) { localStorage.removeItem('fn_token'); return false; }
      _accessToken = token;
      await _fetchProfile();
      return !!_userProfile;
    } catch {
      localStorage.removeItem('fn_token');
      return false;
    }
  }

  async function _fetchProfile() {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: 'Bearer ' + _accessToken }
      });
      if (r.ok) _userProfile = await r.json();
    } catch {}
  }

  function signOut() {
    if (_accessToken && window.google) google.accounts.oauth2.revoke(_accessToken);
    _accessToken = null;
    _userProfile = null;
    localStorage.removeItem('fn_token');
    window.location.reload();
  }

  function handleRedirect() { return Promise.resolve(false); }
  function getToken()   { return _accessToken; }
  function getProfile() { return _userProfile; }
  function isSignedIn() { return !!_accessToken; }

  return { signIn, handleRedirect, restoreSession, signOut, getToken, getProfile, isSignedIn };
})();
