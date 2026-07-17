(function () {
  async function apiFetch(path, options = {}) {
    const opts = { credentials: 'include', ...options };
    opts.headers = { ...(options.headers || {}) };
    if (options.body && !(options.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(`/api${path}`, opts);
    if (res.status === 204) return null;
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* no body */
    }
    if (!res.ok) {
      const message = (data && data.error && data.error.message) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.code = data && data.error && data.error.code;
      throw err;
    }
    return data;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return '\u2014';
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: iso.length <= 10 ? 'UTC' : undefined });
  }

  function fmtDateTime(iso) {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function fmtMoney(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return '\u2014';
    return `${currency || 'USD'} ${Number(amount).toFixed(2)}`;
  }

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(`${dateStr}T00:00:00Z`).getTime();
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - todayUtc) / 86400000);
  }

  window.Nyx = { apiFetch, escapeHtml, fmtDate, fmtDateTime, fmtMoney, daysUntil };
})();
