(function () {
  'use strict';

  const PAGE_SIZE = 6;
  const SLOT_COUNT = 3;
  const DEFAULT_LANGUAGES = ['Sinhala', 'English', 'Tamil'];

  let state = {
    page: 1,
    filterDate: '',
    isAdmin: false,
    allDatesCache: null,
    editingId: null,
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
  // Converts a UTC ISO string to the "YYYY-MM-DDTHH:mm" value a
  // datetime-local input expects, expressed in Sri Lanka (Asia/Colombo,
  // UTC+5:30) time regardless of the browser's own timezone.
  function toColomboLocalInputValue(iso) {
    if (!iso) return '';
    const colomboMs = new Date(iso).getTime() + (5 * 60 + 30) * 60000;
    const d = new Date(colomboMs);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  function showAlert(msg, type) {
    els.alert.className = 'alert alert-' + (type || 'success');
    els.alert.textContent = msg;
    els.alert.style.display = '';
    setTimeout(() => { els.alert.style.display = 'none'; }, 4000);
  }

  async function fetchAllForDateIndex() {
    try {
      const data = await CDMC.apiFetch('/messages?page=1&pageSize=50');
      state.allDatesCache = new Set(data.items.map((m) => toDateKey(m.publishAt)));
    } catch (e) {
      state.allDatesCache = new Set();
    }
  }

  async function loadList() {
    const data = await CDMC.apiFetch(`/messages?page=${state.page}&pageSize=${PAGE_SIZE}`);
    let items = data.items;
    let totalItems = data.totalItems;
    let totalPages = data.totalPages;

    if (state.filterDate) {
      items = items.filter((m) => toDateKey(m.publishAt) === state.filterDate);
      totalItems = items.length;
      totalPages = 1;
    }

    renderCount(totalItems);
    renderList(items);
    renderPagination(state.filterDate ? 1 : totalPages);
  }

  function renderCount(total) {
    if (state.filterDate) {
      els.count.textContent = `${total} message${total !== 1 ? 's' : ''} on ${fmtDate(state.filterDate + 'T00:00:00')}`;
    } else {
      els.count.textContent = `${total} message${total !== 1 ? 's' : ''} total`;
    }
  }

  function renderList(items) {
    if (items.length === 0) {
      els.list.innerHTML = `<div class="text-center text-muted py-5">
        <i class="fa fa-comments fa-3x mb-3 d-block"></i>
        ${state.filterDate ? 'No messages found for this date.' : 'No messages have been posted yet.'}
      </div>`;
      return;
    }
    els.list.innerHTML = items.map((msg) => {
      const adminBtns = state.isAdmin ? `
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-info" title="See who has read this" data-analytics="${msg.id}"><i class="fa fa-chart-bar"></i></button>
          <button class="btn btn-sm btn-outline-primary" data-edit="${msg.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${msg.id}">Delete</button>
        </div>` : '';

      const readBtn = msg.readByMe
        ? `<button class="btn btn-sm btn-success" disabled title="Marked read${msg.readAt ? ' on ' + fmtDateTime(msg.readAt) : ''}"><i class="fa fa-check me-1"></i>Read</button>`
        : `<button class="btn btn-sm btn-outline-success" data-mark-read="${msg.id}" title="Mark as read"><i class="fa fa-check me-1"></i>Mark as Read</button>`;

      const slots = (msg.slots || []).filter((s) => (s.title && s.title.trim()) || (s.body && s.body.trim()) || s.playbackUrl);
      const langTabs = slots.length > 1 ? slots.map((slot, i) => `
        <div class="form-check form-check-inline">
          <input class="form-check-input lang-radio" type="radio" name="lang_${msg.id}" id="lang_${msg.id}_${slot.id}"
                 value="${slot.id}" ${i === 0 ? 'checked' : ''} data-msg="${msg.id}">
          <label class="form-check-label small" for="lang_${msg.id}_${slot.id}">${CDMC.escapeHtml(slot.languageLabel)}</label>
        </div>`).join('') : '';

      const panes = slots.map((slot, i) => `
        <div class="msg-pane" data-msg="${msg.id}" data-slot="${slot.id}" style="${i === 0 ? '' : 'display:none'}">
          ${slot.title ? `<h5 class="mb-2">${CDMC.escapeHtml(slot.title)}</h5>` : ''}
          ${slot.body ? `<p style="white-space:pre-line">${CDMC.escapeHtml(slot.body)}</p>` : ''}
          ${slot.playbackUrl ? `
            <div class="mt-3 p-3 bg-light rounded">
              <p class="small text-muted mb-2"><i class="fa fa-volume-up me-1"></i>${CDMC.escapeHtml(slot.languageLabel)} Audio</p>
              <audio controls class="audio-player">
                <source src="${slot.playbackUrl}">
                Your browser does not support audio.
              </audio>
              ${slot.sourceType === 'upload' ? `<br><a href="${slot.playbackUrl}" download class="btn btn-sm btn-outline-success mt-2"><i class="fa fa-download me-1"></i>Download Audio</a>` : ''}
            </div>` : `<p class="text-muted small mb-0"><i class="fa fa-volume-mute me-1"></i>No audio for this language.</p>`}
        </div>`).join('');

      const dateDisplay = state.isAdmin
        ? `${fmtDateTime(msg.publishAt)}${msg.isScheduled ? ' <span class="badge bg-warning text-dark ms-1">Scheduled</span>' : ''}`
        : fmtDate(msg.publishAt);

      return `<div class="cdmc-card message-card card p-4 mb-4" id="msg-${msg.id}">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
          <small class="text-muted"><i class="fa fa-calendar-alt me-1"></i>${dateDisplay}</small>
          <div class="lang-radio-group" role="group">${langTabs}</div>
          <div class="d-flex gap-2 flex-wrap">${readBtn}${adminBtns}</div>
        </div>
        ${panes}
        ${state.isAdmin ? `<div class="read-analytics-panel mt-3" data-analytics-panel="${msg.id}" style="display:none"></div>` : ''}
      </div>`;
    }).join('');

    els.list.querySelectorAll('.lang-radio').forEach((radio) => {
      radio.addEventListener('change', function () {
        const msgId = this.dataset.msg;
        const slotId = this.value;
        els.list.querySelectorAll(`.msg-pane[data-msg="${msgId}"]`).forEach((el) => {
          el.style.display = el.dataset.slot === slotId ? '' : 'none';
        });
      });
    });
    els.list.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(items.find((m) => String(m.id) === btn.dataset.edit)));
    });
    els.list.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteMessage(btn.dataset.delete));
    });
    els.list.querySelectorAll('[data-mark-read]').forEach((btn) => {
      btn.addEventListener('click', () => markRead(btn.dataset.markRead, btn));
    });
    els.list.querySelectorAll('[data-analytics]').forEach((btn) => {
      btn.addEventListener('click', () => toggleReadAnalytics(btn.dataset.analytics, btn));
    });
  }

  async function markRead(id, btn) {
    btn.disabled = true;
    try {
      await CDMC.apiFetch(`/messages/${id}/read`, { method: 'POST' });
      btn.outerHTML = '<button class="btn btn-sm btn-success" disabled title="Marked read just now"><i class="fa fa-check me-1"></i>Read</button>';
    } catch (err) {
      btn.disabled = false;
      showAlert(err.message || 'Could not mark as read.', 'danger');
    }
  }

  async function toggleReadAnalytics(id, btn) {
    const panel = document.querySelector(`[data-analytics-panel="${id}"]`);
    if (!panel) return;

    // Already open -> this click collapses it back.
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      btn.classList.remove('btn-info', 'text-white');
      btn.classList.add('btn-outline-info');
      btn.title = 'See who has read this';
      return;
    }

    panel.style.display = '';
    btn.classList.remove('btn-outline-info');
    btn.classList.add('btn-info', 'text-white');
    btn.title = 'Hide read-by list';
    panel.innerHTML = '<p class="text-muted small mb-0"><i class="fa fa-spinner fa-spin me-1"></i>Loading…</p>';

    try {
      const data = await CDMC.apiFetch(`/admin/messages/${id}/reads`);
      if (data.readers.length === 0) {
        panel.innerHTML = '<div class="border-top pt-3"><p class="text-muted small mb-0">No one has read this message yet.</p></div>';
      } else {
        panel.innerHTML = `<div class="border-top pt-3">
          <p class="small fw-bold mb-2">Read by ${data.totalReads} user${data.totalReads === 1 ? '' : 's'}:</p>
          <ul class="list-group">${data.readers.map((r) => `
            <li class="list-group-item d-flex justify-content-between align-items-center py-2">
              <strong>${CDMC.escapeHtml(r.username)}</strong>
              <span class="small text-muted">${fmtDateTime(r.readAt)}</span>
            </li>`).join('')}</ul>
        </div>`;
      }
    } catch (err) {
      panel.innerHTML = `<div class="border-top pt-3"><p class="text-danger small mb-0">${CDMC.escapeHtml(err.message || 'Could not load read analytics.')}</p></div>`;
    }
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
      if (!disabled) a.addEventListener('click', (e) => { e.preventDefault(); state.page = page; loadList(); });
      li.appendChild(a);
      return li;
    };
    els.pagination.appendChild(mk('« Prev', state.page - 1, state.page <= 1, false));
    for (let i = 1; i <= totalPages; i++) els.pagination.appendChild(mk(String(i), i, false, i === state.page));
    els.pagination.appendChild(mk('Next »', state.page + 1, state.page >= totalPages, false));
  }

  // ---- Admin form: 3 fixed language slots ----

  function slotFieldBlock(index) {
    return `<div class="border rounded p-3 mb-3 bg-light" data-slot-block="${index}">
      <h6 class="mb-3 text-muted">Language ${index + 1}</h6>
      <div class="mb-2">
        <label class="form-label small">Language</label>
        <input type="text" class="form-control" name="slot${index}LanguageLabel" value="${DEFAULT_LANGUAGES[index]}" required>
        <div class="form-text">Defaults to ${DEFAULT_LANGUAGES[index]} — change it to any language you like.</div>
      </div>
      <div class="mb-2">
        <label class="form-label small">Title <span class="text-muted">(optional)</span></label>
        <input type="text" class="form-control" name="slot${index}Title">
      </div>
      <div class="mb-3">
        <label class="form-label small">Message <span class="text-muted">(optional)</span></label>
        <textarea class="form-control" name="slot${index}Body" rows="3"></textarea>
      </div>
      <div class="mb-2">
        <label class="form-label small d-block">Audio <span class="text-muted">(optional)</span></label>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="slot${index}SourceType" id="slot${index}None" value="none" checked>
          <label class="form-check-label small" for="slot${index}None">None</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="slot${index}SourceType" id="slot${index}Upload" value="upload">
          <label class="form-check-label small" for="slot${index}Upload">Upload File</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="slot${index}SourceType" id="slot${index}Url" value="url">
          <label class="form-check-label small" for="slot${index}Url">External URL</label>
        </div>
      </div>
      <div class="mb-0" data-slot-upload="${index}" style="display:none">
        <input type="file" name="slot${index}AudioFile" class="form-control" accept="audio/*">
      </div>
      <div class="mb-0" data-slot-url="${index}" style="display:none">
        <input type="url" name="slot${index}ExternalUrl" class="form-control" placeholder="https://example.com/audio.mp3">
      </div>
      <div class="mb-0 small text-muted" data-slot-existing-audio="${index}" style="display:none"></div>
    </div>`;
  }

  function wireSlotBlock(index) {
    const wrap = els.slotFields;
    const noneRadio = wrap.querySelector(`#slot${index}None`);
    const uploadRadio = wrap.querySelector(`#slot${index}Upload`);
    const urlRadio = wrap.querySelector(`#slot${index}Url`);
    const uploadField = wrap.querySelector(`[data-slot-upload="${index}"]`);
    const urlField = wrap.querySelector(`[data-slot-url="${index}"]`);
    function sync() {
      uploadField.style.display = uploadRadio.checked ? '' : 'none';
      urlField.style.display = urlRadio.checked ? '' : 'none';
    }
    noneRadio.addEventListener('change', sync);
    uploadRadio.addEventListener('change', sync);
    urlRadio.addEventListener('change', sync);
  }

  function renderSlotFields() {
    let html = '';
    for (let i = 0; i < SLOT_COUNT; i++) html += slotFieldBlock(i);
    els.slotFields.innerHTML = html;
    for (let i = 0; i < SLOT_COUNT; i++) wireSlotBlock(i);
  }

  function startEdit(message) {
    if (!message) return;
    state.editingId = message.id;
    els.form.id.value = message.id;
    els.formTitle.textContent = 'Edit Message';
    els.submitBtn.textContent = 'Save Changes';
    els.cancelBtn.style.display = '';

    const slots = message.slots || [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = slots.find((s) => s.sortOrder === i) || slots[i];
      const block = els.slotFields.querySelector(`[data-slot-block="${i}"]`);
      if (!slot || !block) continue;
      block.querySelector(`[name="slot${i}LanguageLabel"]`).value = slot.languageLabel;
      block.querySelector(`[name="slot${i}Title"]`).value = slot.title;
      block.querySelector(`[name="slot${i}Body"]`).value = slot.body;
      const existingNote = block.querySelector(`[data-slot-existing-audio="${i}"]`);
      if (slot.playbackUrl) {
        existingNote.style.display = '';
        existingNote.innerHTML = `<i class="fa fa-circle-info me-1"></i>Currently has ${slot.sourceType === 'upload' ? 'an uploaded' : 'a linked'} audio file. Choose "None" to remove it, or leave "Upload File"/"External URL" selected without changing anything to keep it as-is.`;
        // Pre-select the radio that matches the current state, without
        // requiring the admin to touch it if they want to keep the audio.
        const radio = block.querySelector(`[name="slot${i}SourceType"][value="${slot.sourceType}"]`);
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
    }
    els.formWrap.scrollIntoView({ behavior: 'smooth' });

    if (message.isScheduled) {
      els.publishModeSchedule.checked = true;
      els.scheduleDateTimeWrap.style.display = '';
      els.scheduledAtInput.value = toColomboLocalInputValue(message.scheduledAt);
    } else {
      els.publishModeNow.checked = true;
      els.scheduleDateTimeWrap.style.display = 'none';
      els.scheduledAtInput.value = '';
    }
  }

  function resetForm() {
    state.editingId = null;
    els.form.reset();
    els.form.id.value = '';
    els.formTitle.textContent = 'Post New Message';
    els.submitBtn.textContent = 'Publish Message';
    els.cancelBtn.style.display = 'none';
    els.publishModeNow.checked = true;
    els.scheduleDateTimeWrap.style.display = 'none';
    els.scheduledAtInput.value = '';
    renderSlotFields();
  }

  async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
      await CDMC.apiFetch(`/admin/messages/${id}`, { method: 'DELETE' });
      showAlert('Message deleted.', 'success');
      await fetchAllForDateIndex();
      loadList();
    } catch (err) {
      showAlert(err.message || 'Could not delete message.', 'danger');
    }
  }

  // ---- Calendar (client-side date filter) ----

  function renderCalendar() {
    const today = new Date();
    let viewYear = state.calYear, viewMonth = state.calMonth;
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
    for (let i = 0; i < firstDay; i++) els.calGrid.appendChild(document.createElement('div')).className = 'cal-day';
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
      els.filterText.textContent = 'Showing messages from ' + fmtDate(state.filterDate + 'T00:00:00');
    } else {
      els.filterBar.style.display = 'none';
    }
  }

  async function init() {
    els.alert = document.getElementById('messagesAlert');
    els.formWrap = document.getElementById('messageFormWrap');
    els.form = document.getElementById('messageForm');
    els.formTitle = document.getElementById('messageFormTitle');
    els.submitBtn = document.getElementById('messageSubmitBtn');
    els.cancelBtn = document.getElementById('messageCancelBtn');
    els.slotFields = document.getElementById('slotFields');
    els.count = document.getElementById('messagesCount');
    els.list = document.getElementById('messagesList');
    els.pagination = document.getElementById('messagesPagination');
    els.filterBar = document.getElementById('messagesFilterBar');
    els.filterText = document.getElementById('messagesFilterText');
    els.calToggle = document.getElementById('calToggleMessages');
    els.cal = document.getElementById('calMessages');
    els.calGrid = document.getElementById('calGridM');
    els.calLabel = document.getElementById('calLabelM');
    els.calPrev = document.getElementById('calPrevM');
    els.calNext = document.getElementById('calNextM');
    els.calClear = document.getElementById('calClearM');
    els.publishModeNow = document.getElementById('publishModeNow');
    els.publishModeSchedule = document.getElementById('publishModeSchedule');
    els.scheduleDateTimeWrap = document.getElementById('scheduleDateTimeWrap');
    els.scheduledAtInput = document.getElementById('scheduledAt');

    const user = await CDMC.requireUser();
    if (!user) return;
    state.isAdmin = user.role === 'admin';
    if (state.isAdmin) {
      els.formWrap.style.display = '';
      renderSlotFields();
    }

    const today = new Date();
    state.calYear = today.getFullYear();
    state.calMonth = today.getMonth();

    els.cancelBtn.addEventListener('click', resetForm);
    document.getElementById('messagesFilterClear').addEventListener('click', (e) => {
      e.preventDefault();
      state.filterDate = '';
      state.page = 1;
      updateFilterBar();
      loadList();
    });

    els.calToggle.addEventListener('click', (e) => { e.stopPropagation(); els.cal.classList.toggle('open'); renderCalendar(); });
    els.calPrev.addEventListener('click', () => { state.calMonth--; if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; } renderCalendar(); });
    els.calNext.addEventListener('click', () => { state.calMonth++; if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; } renderCalendar(); });
    els.calClear.addEventListener('click', () => { state.filterDate = ''; state.page = 1; els.cal.classList.remove('open'); updateFilterBar(); loadList(); });
    document.addEventListener('click', (e) => { if (!els.cal.contains(e.target) && e.target !== els.calToggle) els.cal.classList.remove('open'); });

    if (els.publishModeNow) {
      [els.publishModeNow, els.publishModeSchedule].forEach((radio) => {
        radio.addEventListener('change', () => {
          const scheduling = els.publishModeSchedule.checked;
          els.scheduleDateTimeWrap.style.display = scheduling ? '' : 'none';
          els.scheduledAtInput.required = scheduling;
        });
      });
    }

    els.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(els.form);
      // Always send an explicit scheduledAt (empty string clears any
      // schedule), regardless of the hidden input's leftover value.
      const scheduling = els.publishModeSchedule.checked;
      if (scheduling && !els.scheduledAtInput.value) {
        showAlert('Pick a date and time to schedule for.', 'danger');
        return;
      }
      fd.set('scheduledAt', scheduling ? els.scheduledAtInput.value : '');
      try {
        if (state.editingId) {
          await CDMC.apiFetch(`/admin/messages/${state.editingId}`, { method: 'PATCH', body: fd });
          showAlert('Message updated.', 'success');
        } else {
          await CDMC.apiFetch('/admin/messages', { method: 'POST', body: fd });
          showAlert('Message published.', 'success');
        }
        resetForm();
        await fetchAllForDateIndex();
        loadList();
      } catch (err) {
        showAlert(err.message || 'Could not save message.', 'danger');
      }
    });

    await fetchAllForDateIndex();
    loadList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
