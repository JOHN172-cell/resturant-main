(() => {
  'use strict';
  const sessionKey = 'taste-africa-admin-session';
  const logout = () => {
    const token = sessionStorage.getItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true }).catch(() => {});
  };

  // Reservations is an admin route: never restore an old browser session.
  logout();
  const gate = document.createElement('section');
  gate.className = 'staff-auth-gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-labelledby', 'staff-auth-title');
  gate.innerHTML = `
    <div class="staff-auth-card">
      <p class="eyebrow">Taste Africa staff</p><h1 id="staff-auth-title">Staff access</h1>
      <p>Sign in to manage reservations.</p>
      <form class="staff-auth-form">
        <label>Username<input name="username" autocomplete="username" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="staff-auth-error" aria-live="polite"></p><button class="staff-auth-submit" type="submit">Unlock panel</button>
      </form>
    </div>`;
  document.body.append(gate);
  const form = gate.querySelector('form');
  const error = gate.querySelector('.staff-auth-error');
  form.elements.username.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.elements.username.value.trim(), password: form.elements.password.value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      sessionStorage.setItem(sessionKey, result.token);
      document.body.classList.remove('staff-locked');
      gate.remove();
      window.dispatchEvent(new Event('admin:authenticated'));
    } catch (loginError) {
      error.textContent = loginError.message;
      form.elements.password.value = '';
      form.elements.password.focus();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') logout(); });
  window.addEventListener('pagehide', logout);
})();
