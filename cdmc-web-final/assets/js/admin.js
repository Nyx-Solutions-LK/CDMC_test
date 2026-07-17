(function () {
  'use strict';

  const els = {};
  let currentUserId = null;

  function showAlert(html, type) {
    els.alert.className = 'alert alert-' + (type || 'success');
    els.alert.innerHTML = html;
    els.alert.style.display = '';
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async function loadUsers() {
    const data = await CDMC.apiFetch('/admin/users?page=1&pageSize=50');
    els.userCount.textContent = data.totalItems;
    els.tbody.innerHTML = data.items.map((u) => {
      const isSelf = u.id === currentUserId;
      const isPrimary = Boolean(u.isPrimaryAdmin);
      const statusBadge = u.isDisabled
        ? '<span class="badge badge-disabled">Disabled</span>'
        : '<span class="badge bg-success">Active</span>';
      const typeBadge = `<span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-user'}">${u.role.toUpperCase()}</span>${isPrimary ? ' <span class="badge bg-dark" title="Primary admin — protected from disable/demote">PRIMARY</span>' : ''}`;
      let actions;
      if (isPrimary) {
        // Primary admin is protected: can reset own password like anyone
        // else, but can never be disabled or demoted via this panel.
        actions = isSelf
          ? '<span class="text-muted small">(you &mdash; primary admin)</span>'
          : `<div class="d-flex gap-1 flex-wrap align-items-center">
              <button class="btn btn-sm btn-outline-warning" title="Reset Password" data-reset="${u.id}" data-username="${CDMC.escapeHtml(u.username)}"><i class="fa fa-key"></i></button>
              <span class="text-muted small" title="The primary admin cannot be disabled or demoted">Protected</span>
            </div>`;
      } else if (isSelf) {
        actions = '<span class="text-muted small">(you)</span>';
      } else {
        actions = `<div class="d-flex gap-1 flex-wrap">
            <button class="btn btn-sm btn-outline-warning" title="Reset Password" data-reset="${u.id}" data-username="${CDMC.escapeHtml(u.username)}"><i class="fa fa-key"></i></button>
            <button class="btn btn-sm ${u.isDisabled ? 'btn-outline-success' : 'btn-outline-secondary'}" title="${u.isDisabled ? 'Enable' : 'Disable'}" data-toggle="${u.id}" data-disabled="${u.isDisabled}"><i class="fa ${u.isDisabled ? 'fa-user-check' : 'fa-user-slash'}"></i></button>
            <select class="form-select form-select-sm" style="width:auto" data-role="${u.id}">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </div>`;
      }
      return `<tr class="${u.isDisabled ? 'table-danger opacity-75' : ''}">
        <td><strong>${CDMC.escapeHtml(u.username)}</strong></td>
        <td>${CDMC.escapeHtml(u.email)}</td>
        <td>${CDMC.escapeHtml(u.phoneNumber) || '&mdash;'}</td>
        <td>${CDMC.escapeHtml(u.courseId) || '&mdash;'}</td>
        <td>${typeBadge}</td>
        <td>${statusBadge}</td>
        <td class="small text-muted">${fmtDate(u.createdAt)}</td>
        <td>${actions}</td>
      </tr>`;
    }).join('');

    els.tbody.querySelectorAll('[data-reset]').forEach((btn) => {
      btn.addEventListener('click', () => resetPassword(btn.dataset.reset, btn.dataset.username));
    });
    els.tbody.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => toggleDisabled(btn.dataset.toggle, btn.dataset.disabled === 'true'));
    });
    els.tbody.querySelectorAll('[data-role]').forEach((sel) => {
      sel.addEventListener('change', () => changeRole(sel.dataset.role, sel.value));
    });
  }

  async function resetPassword(uid, username) {
    if (!confirm(`Reset password for ${username}?`)) return;
    try {
      const data = await CDMC.apiFetch(`/admin/users/${uid}/reset-password`, { method: 'POST' });
      showAlert(`Password reset for <strong>${CDMC.escapeHtml(username)}</strong>. New password: <strong>${CDMC.escapeHtml(data.generatedPassword)}</strong>`, 'success');
    } catch (err) {
      showAlert(err.message || 'Could not reset password.', 'danger');
    }
  }

  async function toggleDisabled(uid, isDisabled) {
    try {
      await CDMC.apiFetch(`/admin/users/${uid}`, { method: 'PATCH', body: JSON.stringify({ isDisabled: !isDisabled }) });
      showAlert('Account status updated.', 'success');
      loadUsers();
    } catch (err) {
      showAlert(err.message || 'Could not update account status.', 'danger');
      loadUsers();
    }
  }

  async function changeRole(uid, role) {
    try {
      await CDMC.apiFetch(`/admin/users/${uid}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      showAlert('User role updated.', 'success');
      loadUsers();
    } catch (err) {
      showAlert(err.message || 'Could not update role.', 'danger');
      loadUsers();
    }
  }

  function csvEscapeCell(value) {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function downloadCsv(filename, header, rows) {
    const lines = [header.map(csvEscapeCell).join(',')]
      .concat(rows.map((row) => row.map(csvEscapeCell).join(',')));
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderImportResult(data) {
    const parts = [];
    if (data.created.length > 0) {
      parts.push(`<div class="alert alert-success mb-2">
          <strong>${data.created.length}</strong> user${data.created.length === 1 ? '' : 's'} created.
          <button type="button" class="btn btn-sm btn-outline-success ms-2" id="downloadImportedBtn"><i class="fa fa-file-download me-1"></i>Download credentials CSV</button>
          <div class="small text-muted mt-1">This is the only time these passwords are shown &mdash; download or copy them now.</div>
        </div>`);
    }
    if (data.skipped.length > 0) {
      const items = data.skipped.map((s) => `<li><strong>${CDMC.escapeHtml(s.name)}</strong> (row ${s.row}) &mdash; ${CDMC.escapeHtml(s.reason)}</li>`).join('');
      parts.push(`<div class="alert alert-danger mb-0">
          <strong>${data.skipped.length}</strong> row${data.skipped.length === 1 ? '' : 's'} could not be added:
          <ul class="mb-0 mt-2">${items}</ul>
        </div>`);
    }
    if (parts.length === 0) {
      parts.push('<div class="alert alert-warning mb-0">The file had no data rows.</div>');
    }
    els.bulkImportResult.innerHTML = parts.join('');
    els.bulkImportResult.style.display = '';

    const dlBtn = document.getElementById('downloadImportedBtn');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        downloadCsv(
          'cdmc-imported-users.csv',
          ['username', 'email', 'courseId', 'phoneNumber', 'password'],
          data.created.map((u) => [u.username, u.email, u.courseId || '', u.phoneNumber || '', u.generatedPassword])
        );
      });
    }
  }

  async function bulkImport() {
    const file = els.bulkImportFile.files[0];
    if (!file) {
      showAlert('Choose a CSV file first.', 'danger');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    els.bulkImportBtn.disabled = true;
    try {
      const data = await CDMC.apiFetch('/admin/users/bulk-import', { method: 'POST', body: fd });
      renderImportResult(data);
      els.bulkImportFile.value = '';
      loadUsers();
    } catch (err) {
      showAlert(err.message || 'Could not import users.', 'danger');
    } finally {
      els.bulkImportBtn.disabled = false;
    }
  }

  function bulkExport() {
    // Plain navigation (not apiFetch) so the browser handles the CSV download
    // via Content-Disposition — same-origin session cookie is sent either way.
    // Includes each user's real current password (decrypted server-side) —
    // does not reset or change anyone's password.
    window.location.href = '/api/admin/users/bulk-export';
  }

  function bulkExportResetPasswords() {
    if (!confirm('This resets a NEW password for every user (each will need to change it on next login) and downloads a CSV with those passwords. Continue?')) return;
    window.location.href = '/api/admin/users/bulk-export-reset-passwords';
  }

  async function init() {
    els.alert = document.getElementById('adminAlert');
    els.form = document.getElementById('addUserForm');
    els.userCount = document.getElementById('userCount');
    els.tbody = document.getElementById('usersTableBody');
    els.bulkImportFile = document.getElementById('bulkImportFile');
    els.bulkImportBtn = document.getElementById('bulkImportBtn');
    els.bulkExportBtn = document.getElementById('bulkExportBtn');
    els.bulkExportResetBtn = document.getElementById('bulkExportResetBtn');
    els.bulkImportResult = document.getElementById('bulkImportResult');

    const user = await CDMC.requireUser({ admin: true });
    if (!user) return;
    currentUserId = user.id;

    els.bulkImportBtn.addEventListener('click', bulkImport);
    els.bulkExportBtn.addEventListener('click', bulkExport);
    els.bulkExportResetBtn.addEventListener('click', bulkExportResetPasswords);

    els.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(els.form);
      const payload = {
        username: fd.get('username'),
        email: fd.get('email'),
        phoneNumber: fd.get('phoneNumber') || undefined,
        courseId: fd.get('courseId') || undefined,
        role: fd.get('role'),
      };
      try {
        const data = await CDMC.apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
        showAlert(`User '<strong>${CDMC.escapeHtml(data.user.username)}</strong>' created. Auto-generated password: <strong>${CDMC.escapeHtml(data.generatedPassword)}</strong> &mdash; share this with the user.`, 'success');
        els.form.reset();
        loadUsers();
      } catch (err) {
        showAlert(err.message || 'Could not create user.', 'danger');
      }
    });

    loadUsers();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
