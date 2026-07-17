(function () {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => window.NyxTheme.toggleTheme());
  });
  window.NyxTheme.applyTheme(window.NyxTheme.currentTheme());

  const alertEl = document.getElementById('loginAlert');
  function showError(msg) {
    alertEl.innerHTML = `<div class="badge badge-red" style="display:block;width:100%;box-sizing:border-box;padding:10px 12px;margin-bottom:14px;text-transform:none;font-size:12.5px;font-weight:500">${Nyx.escapeHtml(msg)}</div>`;
  }

  // Already logged in? Skip straight to the portal.
  Nyx.apiFetch('/auth/me').then((data) => {
    if (data && data.user) window.location.href = 'portal.html';
  }).catch(() => {});

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    alertEl.innerHTML = '';
    try {
      await Nyx.apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
        }),
      });
      window.location.href = 'portal.html';
    } catch (err) {
      showError(err.message || 'Login failed.');
      btn.disabled = false;
    }
  });
})();
