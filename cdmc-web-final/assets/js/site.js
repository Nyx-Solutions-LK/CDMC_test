/**
 * Site-wide auth/nav wiring.
 * Every page includes this after the header markup. It calls GET /api/auth/me
 * to find out if a session is active, then shows/hides the nav links and
 * fills in the "logged in as ..." badge / login button accordingly.
 */
(function () {
  'use strict';

  window.CDMC = window.CDMC || {};

  async function apiFetch(path, options) {
    options = options || {};
    options.credentials = 'include';
    options.headers = Object.assign({}, options.headers);
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch('/api' + path, options);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* empty body (e.g. 204) */
    }
    if (!res.ok) {
      const message = (data && data.error && data.error.message) || 'Request failed';
      const err = new Error(message);
      err.status = res.status;
      err.code = data && data.error && data.error.code;
      throw err;
    }
    return data;
  }
  window.CDMC.apiFetch = apiFetch;

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  window.CDMC.escapeHtml = escapeHtml;

  function renderNav(user) {
    const authArea = document.getElementById('navAuthArea');
    const membersLinks = document.querySelectorAll('.nav-members-only');
    const adminLinks = document.querySelectorAll('.nav-admin-only');

    membersLinks.forEach((el) => (el.style.display = user ? '' : 'none'));
    adminLinks.forEach((el) => (el.style.display = user && user.role === 'admin' ? '' : 'none'));

    if (!authArea) return;

    if (!user) {
      authArea.innerHTML = '<a href="login.html" class="btn btn-light btn-sm cdmc-auth-btn">Login</a>';
      return;
    }

    authArea.innerHTML = `
      <div class="dropdown">
        <div class="cdmc-user-badge" style="cursor:pointer" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="fa fa-user-circle"></i>
          ${escapeHtml(user.username)}
          ${user.role === 'admin' ? '<span class="admin-tag">ADMIN</span>' : ''}
          <i class="fa fa-caret-down ms-1" style="font-size:0.75rem"></i>
        </div>
        <ul class="dropdown-menu dropdown-menu-end mt-1">
          <li><a class="dropdown-item" href="change_password.html"><i class="fa fa-key me-2"></i>Change Password</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" id="logoutLink"><i class="fa fa-sign-out-alt me-2"></i>Logout</a></li>
        </ul>
      </div>`;

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await apiFetch('/auth/logout', { method: 'POST' });
        } catch (err) {
          /* ignore — clear client state regardless */
        }
        window.location.href = 'index.html';
      });
    }
  }

  async function loadCurrentUser() {
    try {
      const data = await apiFetch('/auth/me');
      window.CDMC.currentUser = data.user || null;
    } catch (err) {
      window.CDMC.currentUser = null;
    }
    renderNav(window.CDMC.currentUser);
    document.dispatchEvent(new CustomEvent('cdmc:user-loaded', { detail: window.CDMC.currentUser }));
    return window.CDMC.currentUser;
  }
  window.CDMC.loadCurrentUser = loadCurrentUser;

  /**
   * Guards a page that requires login (and optionally admin). Redirects to
   * login.html (or index.html) if the requirement isn't met. Resolves with
   * the user object when the check passes.
   */
  window.CDMC.requireUser = async function requireUser({ admin } = {}) {
    const user = await loadCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }
    if (admin && user.role !== 'admin') {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  };

  document.addEventListener('DOMContentLoaded', loadCurrentUser);
})();
