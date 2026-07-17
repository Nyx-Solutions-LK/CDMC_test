(function () {
  'use strict';

  const PAGE_SIZE = 8;
  let state = {
    page: 1,
    filterDate: '',
    isAdmin: false,
    allDatesCache: null, // Set of 'YYYY-MM-DD' strings that have notices (best-effort, from loaded pages)
  };

  const els = {};

  function fmtDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function toDateKey(iso) {
    return new Date(iso).toISOString().slice(0, 10);
  }

  function showAlert(msg, type) {
    els.alert.className = 'alert alert-' + (type || 'success');
    els.alert.textContent = msg;
    els.alert.style.display = '';
    setTimeout(() => { els.alert.style.display = 'none'; }, 4000);
  }

  async function fetchAllForDateIndex() {
    // Best-effort: pull a large page to know which dates have notices, for the
    // calendar's "has-entries" highlighting. The API doesn't expose a
    // dedicated date-index endpoint, so we approximate with a big pageSize.
    try {
      const data = await CDMC.apiFetch('/notices?page=1&pageSize=50');
      state.allDatesCache = new Set(data.items.map((n) => toDateKey(n.createdAt)));
    } catch (e) {
      state.allDatesCache = new Set();
    }
  }

  async function loadList() {
    const data = await CDMC.apiFetch(`/notices?page=${state.page}&pageSize=${PAGE_SIZE}`);
    let items = data.items;
    let totalItems = data.totalItems;
    let totalPages = data.totalPages;

    if (state.filterDate) {
      items = items.filter((n) => toDateKey(n.createdAt) === state.filterDate);
      // When filtering client-side we can't trust server pagination counts,
      // so just show what's on the current page that matches.
      totalItems = items.length;
      totalPages = 1;
    }

    renderCount(totalItems);
    renderList(items);
    renderPagination(state.filterDate ? 1 : totalPages);
  }

  function renderCount(total) {
    if (state.filterDate) {
      els.count.textContent = `${total} meeting${total !== 1 ? 's' : ''} on ${fmtDate(state.filterDate + 'T00:00:00')}`;
    } else {
      els.count.textContent = `${total} meeting${total !== 1 ? 's' : ''} total`;
    }
  }

  function renderList(items) {
    if (items.length === 0) {
      els.list.innerHTML = `<div class="text-center text-muted py-5">
        <i class="fa fa-bell fa-3x mb-3 d-block"></i>
        ${state.filterDate ? 'No meetings found for this date.' : 'No meetings have been posted yet.'}
      </div>`;
      return;
    }
    els.list.innerHTML = items.map((n) => {
      const adminBtns = state.isAdmin ? `
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-edit="${n.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${n.id}">Delete</button>
        </div>` : '';
      const updated = n.updatedAt && n.updatedAt !== n.createdAt ? ` &middot; Updated ${fmtDate(n.updatedAt)}` : '';
      const linkRow = n.linkUrl ? `
        <div class="entry-link-row">
          <a href="${n.linkUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">
            Join Meeting <i class="fa fa-arrow-right ms-1"></i>
          </a>
          <button type="button" class="btn btn-sm btn-outline-secondary btn-copy-link" data-copy-url="${CDMC.escapeHtml(n.linkUrl)}">
            <i class="fa fa-link me-1"></i>Copy Link
          </button>
        </div>` : '';
      return `<div class="cdmc-card notice-card card p-4 mb-4">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h5 class="mb-1">${CDMC.escapeHtml(n.title)}</h5>
            <small class="text-muted">Posted ${fmtDateTime(n.createdAt)}${updated}</small>
          </div>
          ${adminBtns}
        </div>
        <p class="mt-3 mb-0" style="white-space:pre-line">${CDMC.escapeHtml(n.body)}</p>
        ${linkRow}
      </div>`;
    }).join('');

    els.list.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(items.find((n) => String(n.id) === btn.dataset.edit)));
    });
    els.list.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteNotice(btn.dataset.delete));
    });
    els.list.querySelectorAll('[data-copy-url]').forEach((btn) => {
      btn.addEventListener('click', () => copyLink(btn));
    });
  }

  function copyLink(btn) {
    const url = btn.dataset.copyUrl;
    navigator.clipboard.writeText(url).then(() => {
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fa fa-check me-1"></i>Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = original; btn.classList.remove('copied'); }, 1800);
    }).catch(() => {
      showAlert('Could not copy link — please copy it manually.', 'danger');
    });
  }

  function renderPagination(totalPages) {
    els.pagination.innerHTML = '';
    if (totalPages <= 1) return;
    const mk = (label, page, disabled, active) => {
      const li = document.createElement('li');
      li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
      const a = document.createElement('a');
      a.className = 'page-link';
      a.href = '#';
      a.textContent = label;
      if (!disabled) {
        a.addEventListener('click', (e) => { e.preventDefault(); state.page = page; loadList(); });
      }
      li.appendChild(a);
      return li;
    };
    els.pagination.appendChild(mk('« Prev', state.page - 1, state.page <= 1, false));
    for (let i = 1; i <= totalPages; i++) {
      els.pagination.appendChild(mk(String(i), i, false, i === state.page));
    }
    els.pagination.appendChild(mk('Next »', state.page + 1, state.page >= totalPages, false));
  }

  function startEdit(notice) {
    if (!notice) return;
    els.form.id.value = notice.id;
    els.form.title.value = notice.title;
    els.form.body.value = notice.body;
    els.form.linkUrl.value = notice.linkUrl || '';
    els.formTitle.textContent = 'Edit Meeting';
    els.submitBtn.textContent = 'Update Meeting';
    els.cancelBtn.style.display = '';
    els.formWrap.scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    els.form.reset();
    els.form.id.value = '';
    els.formTitle.textContent = 'Post New Meeting';
    els.submitBtn.textContent = 'Publish Meeting';
    els.cancelBtn.style.display = 'none';
  }

  async function deleteNotice(id) {
    if (!confirm('Delete this meeting?')) return;
    try {
      await CDMC.apiFetch(`/admin/notices/${id}`, { method: 'DELETE' });
      showAlert('Meeting deleted.', 'success');
      await fetchAllForDateIndex();
      loadList();
    } catch (err) {
      showAlert(err.message || 'Could not delete meeting.', 'danger');
    }
  }

  function renderCalendar() {
    const today = new Date();
    let viewYear = state.calYear;
    let viewMonth = state.calMonth;
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dows = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    els.calLabel.textContent = months[viewMonth] + ' ' + viewYear;
    els.calGrid.innerHTML = '';
    dows.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      els.calGrid.appendChild(el);
    });
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) {
      els.calGrid.appendChild(document.createElement('div')).className = 'cal-day';
    }
    const pad = (n) => String(n).padStart(2, '0');
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const el = document.createElement('div');
      el.className = 'cal-day';
      el.textContent = d;
      const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
      if (isToday) el.classList.add('today-marker');
      if (state.allDatesCache && state.allDatesCache.has(dateStr)) {
        el.classList.add('has-entries');
        if (dateStr === state.filterDate) el.classList.add('selected');
        el.addEventListener('click', () => {
          state.filterDate = dateStr;
          state.page = 1;
          els.cal.classList.remove('open');
          updateFilterBar();
          loadList();
        });
      }
      els.calGrid.appendChild(el);
    }
  }

  function updateFilterBar() {
    if (state.filterDate) {
      els.filterBar.style.display = '';
      els.filterText.textContent = 'Showing meetings from ' + fmtDate(state.filterDate + 'T00:00:00');
    } else {
      els.filterBar.style.display = 'none';
    }
  }

  async function init() {
    els.alert = document.getElementById('noticesAlert');
    els.formWrap = document.getElementById('noticeFormWrap');
    els.form = document.getElementById('noticeForm');
    els.formTitle = document.getElementById('noticeFormTitle');
    els.submitBtn = document.getElementById('noticeSubmitBtn');
    els.cancelBtn = document.getElementById('noticeCancelBtn');
    els.count = document.getElementById('noticesCount');
    els.list = document.getElementById('noticesList');
    els.pagination = document.getElementById('noticesPagination');
    els.filterBar = document.getElementById('noticesFilterBar');
    els.filterText = document.getElementById('noticesFilterText');
    els.calToggle = document.getElementById('calToggleNotices');
    els.cal = document.getElementById('calNotices');
    els.calGrid = document.getElementById('calGridN');
    els.calLabel = document.getElementById('calLabelN');
    els.calPrev = document.getElementById('calPrevN');
    els.calNext = document.getElementById('calNextN');
    els.calClear = document.getElementById('calClearN');

    const user = await CDMC.requireUser();
    if (!user) return;
    state.isAdmin = user.role === 'admin';
    if (state.isAdmin) els.formWrap.style.display = '';

    const today = new Date();
    state.calYear = today.getFullYear();
    state.calMonth = today.getMonth();

    els.cancelBtn.addEventListener('click', resetForm);
    document.getElementById('noticesFilterClear').addEventListener('click', (e) => {
      e.preventDefault();
      state.filterDate = '';
      state.page = 1;
      updateFilterBar();
      loadList();
    });

    els.calToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      els.cal.classList.toggle('open');
      renderCalendar();
    });
    els.calPrev.addEventListener('click', () => {
      state.calMonth--;
      if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
      renderCalendar();
    });
    els.calNext.addEventListener('click', () => {
      state.calMonth++;
      if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
      renderCalendar();
    });
    els.calClear.addEventListener('click', () => {
      state.filterDate = '';
      state.page = 1;
      els.cal.classList.remove('open');
      updateFilterBar();
      loadList();
    });
    document.addEventListener('click', (e) => {
      if (!els.cal.contains(e.target) && e.target !== els.calToggle) els.cal.classList.remove('open');
    });

    els.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.form.id.value;
      const title = els.form.title.value.trim();
      const body = els.form.body.value.trim();
      const linkUrl = els.form.linkUrl.value.trim();
      if (!title || !body) return;
      try {
        if (id) {
          await CDMC.apiFetch(`/admin/notices/${id}`, { method: 'PATCH', body: JSON.stringify({ title, body, linkUrl }) });
          showAlert('Meeting updated.', 'success');
        } else {
          await CDMC.apiFetch('/admin/notices', { method: 'POST', body: JSON.stringify({ title, body, linkUrl }) });
          showAlert('Meeting published.', 'success');
        }
        resetForm();
        await fetchAllForDateIndex();
        loadList();
      } catch (err) {
        showAlert(err.message || 'Could not save meeting.', 'danger');
      }
    });

    await fetchAllForDateIndex();
    loadList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
