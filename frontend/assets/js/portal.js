(function () {
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => btn.addEventListener('click', () => NyxTheme.toggleTheme()));
  NyxTheme.applyTheme(NyxTheme.currentTheme());

  const state = {
    user: null,
    clients: [],
    selectedClientId: {}, // per-section admin client picker: { subscriptions: id, maintenance: id, documents: id, invoices: id }
    invoiceItemsDraft: [],
  };

  const NAV_ITEMS = [
    { id: 'announcements', label: 'Announcements', icon: '\u25C6' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '\u27F3' },
    { id: 'maintenance', label: 'Maintenance', icon: '\u2699' },
    { id: 'invoices', label: 'Invoices', icon: '\u25A4', badgeKey: 'invoices' },
    { id: 'documents', label: 'Documents', icon: '\u25A5' },
    { id: 'contact', label: 'Contact Us', icon: '\u2709' },
  ];
  const ADMIN_NAV_ITEMS = [
    { id: 'clients', label: 'Clients', icon: '\u25CE' },
    { id: 'messages', label: 'Messages', icon: '\u270E', badgeKey: 'messages' },
  ];

  const badges = { invoices: 0, messages: 0 };

  // ---------------- toast / modal helpers ----------------
  function toast(msg, type = '') {
    const stack = document.getElementById('toastStack');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  function openModal(title, bodyHtml, footerHtml) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal">
          <div class="modal-header"><h3>${Nyx.escapeHtml(title)}</h3><button class="modal-close" id="modalCloseBtn">&times;</button></div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        </div>
      </div>`;
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });
  }
  function closeModal() {
    document.getElementById('modalRoot').innerHTML = '';
    state.invoiceItemsDraft = [];
  }
  window.NyxCloseModal = closeModal;

  // ---------------- nav / routing ----------------
  function currentRoute() {
    return (window.location.hash || '#announcements').replace('#', '');
  }

  function renderNav() {
    const items = NAV_ITEMS.slice();
    const groups = [{ label: null, items }];
    if (state.user.role === 'admin') groups.push({ label: 'Admin', items: ADMIN_NAV_ITEMS });

    const active = currentRoute();
    let html = '';
    groups.forEach((g) => {
      if (g.label) html += `<div class="nav-group-label">${g.label}</div>`;
      g.items.forEach((item) => {
        const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
        html += `<div class="nav-link ${active === item.id ? 'active' : ''}" data-nav="${item.id}">
          <span class="nav-icon">${item.icon}</span> ${item.label}
          ${badgeCount > 0 ? `<span class="nav-badge">${badgeCount}</span>` : ''}
        </div>`;
      });
    });
    document.getElementById('navLinks').innerHTML = html;
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.nav;
        if (id === 'account') { window.location.hash = 'account'; }
        else window.location.hash = id;
      });
    });
  }

  const TITLES = {
    announcements: 'Announcements', subscriptions: 'Subscriptions', maintenance: 'Maintenance',
    invoices: 'Invoices', documents: 'Documents', contact: 'Contact Us', clients: 'Clients',
    messages: 'Contact Messages', account: 'Account Settings',
  };

  const RENDERERS = {
    announcements: renderAnnouncements, subscriptions: renderSubscriptions, maintenance: renderMaintenance,
    invoices: renderInvoices, documents: renderDocuments, contact: renderContact, clients: renderClients,
    messages: renderMessages, account: renderAccount,
  };

  async function route() {
    const id = currentRoute();
    if ((id === 'clients' || id === 'messages') && state.user.role !== 'admin') {
      window.location.hash = 'announcements';
      return;
    }
    document.getElementById('topbarTitle').textContent = TITLES[id] || 'Nyx Solutions';
    renderNav();
    const content = document.getElementById('content');
    content.innerHTML = '<div class="text-muted" style="padding:40px;text-align:center">Loading&hellip;</div>';
    try {
      await (RENDERERS[id] || renderAnnouncements)(content);
    } catch (err) {
      content.innerHTML = `<div class="card"><p class="text-muted mb-0">Could not load this page: ${Nyx.escapeHtml(err.message)}</p></div>`;
    }
  }

  // ---------------- boot ----------------
  async function boot() {
    let me;
    try {
      me = await Nyx.apiFetch('/auth/me');
    } catch (e) {
      me = null;
    }
    if (!me || !me.user) {
      window.location.href = 'login.html';
      return;
    }
    state.user = me.user;
    document.getElementById('userAvatar').textContent = (state.user.companyName || state.user.username).slice(0, 2).toUpperCase();
    document.getElementById('userChipName').textContent = state.user.companyName || state.user.username;

    document.getElementById('logoutLink').addEventListener('click', async () => {
      await Nyx.apiFetch('/auth/logout', { method: 'POST' });
      window.location.href = 'login.html';
    });

    if (state.user.role === 'admin') {
      state.clients = (await Nyx.apiFetch('/admin/clients')).clients;
    } else {
      refreshInvoiceBadge();
    }

    if (state.user.mustChangePassword) {
      forcePasswordChange();
    }

    window.addEventListener('hashchange', route);
    await route();
  }

  async function refreshInvoiceBadge() {
    try {
      const data = await Nyx.apiFetch('/invoices/unseen-count');
      badges.invoices = data.count;
      renderNav();
    } catch (e) { /* ignore */ }
  }

  function forcePasswordChange() {
    openModal('Set a New Password', `
      <p class="text-muted" style="margin-top:0">For security, please set a new password before continuing.</p>
      <div id="pwErr"></div>
      <div class="field"><label>Current (temporary) password</label><input type="password" id="pwCurrent" required></div>
      <div class="field"><label>New password (min 8 characters)</label><input type="password" id="pwNew" required></div>
      <div class="field"><label>Confirm new password</label><input type="password" id="pwConfirm" required></div>
    `, `<button class="btn btn-primary" id="pwSubmit">Set Password</button>`);
    document.getElementById('modalCloseBtn').style.display = 'none';
    document.getElementById('modalBackdrop').style.pointerEvents = 'auto';
    document.getElementById('pwSubmit').addEventListener('click', async () => {
      const cur = document.getElementById('pwCurrent').value;
      const next = document.getElementById('pwNew').value;
      const confirm = document.getElementById('pwConfirm').value;
      const errEl = document.getElementById('pwErr');
      errEl.innerHTML = '';
      if (next !== confirm) {
        errEl.innerHTML = `<p style="color:var(--red);font-size:12.5px">Passwords do not match.</p>`;
        return;
      }
      try {
        await Nyx.apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: cur, newPassword: next }) });
        state.user.mustChangePassword = false;
        closeModal();
        toast('Password updated.', 'success');
      } catch (err) {
        errEl.innerHTML = `<p style="color:var(--red);font-size:12.5px">${Nyx.escapeHtml(err.message)}</p>`;
      }
    });
  }

  function clientLabel(client) {
    return client.companyName || client.username;
  }

  function clientOptions(selectedId) {
    return state.clients.map((c) => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${Nyx.escapeHtml(clientLabel(c))}</option>`).join('');
  }

  // ================= ANNOUNCEMENTS =================
  async function renderAnnouncements(content) {
    const data = await Nyx.apiFetch('/announcements');
    const isAdmin = state.user.role === 'admin';
    let html = '';
    html += `<div class="section-header"><h2>Announcements</h2>${isAdmin ? '<button class="btn btn-primary" id="newAnnBtn">+ New Announcement</button>' : ''}</div>`;
    if (data.announcements.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u25C6</div>No announcements yet.</div></div>`;
    } else {
      html += data.announcements.map((a) => `
        <div class="card">
          <div class="card-title">${Nyx.escapeHtml(a.title)}
            <span class="badge ${a.audienceType === 'all' ? 'badge-blue' : 'badge-purple'}">${a.audienceType === 'all' ? 'All Clients' : Nyx.escapeHtml(a.clientName || 'Client')}</span>
          </div>
          <div class="card-sub">${Nyx.fmtDateTime(a.createdAt)}</div>
          <p style="white-space:pre-line;margin:0">${Nyx.escapeHtml(a.body)}</p>
          ${isAdmin ? `<div style="margin-top:12px"><button class="btn btn-sm btn-danger" data-del-ann="${a.id}">Delete</button></div>` : ''}
        </div>`).join('');
    }
    content.innerHTML = html;

    if (isAdmin) {
      document.getElementById('newAnnBtn').addEventListener('click', () => {
        openModal('New Announcement', `
          <div class="field"><label>Title</label><input type="text" id="annTitle" required></div>
          <div class="field"><label>Message</label><textarea id="annBody" rows="4" required></textarea></div>
          <div class="field"><label>Audience</label>
            <select id="annAudience">
              <option value="all">All Clients</option>
              <option value="single">Single Client</option>
            </select>
          </div>
          <div class="field" id="annClientWrap" style="display:none"><label>Client</label><select id="annClient">${clientOptions()}</select></div>
        `, `<button class="btn btn-primary" id="annSubmit">Post Announcement</button>`);
        document.getElementById('annAudience').addEventListener('change', (e) => {
          document.getElementById('annClientWrap').style.display = e.target.value === 'single' ? '' : 'none';
        });
        document.getElementById('annSubmit').addEventListener('click', async () => {
          try {
            await Nyx.apiFetch('/announcements', {
              method: 'POST',
              body: JSON.stringify({
                title: document.getElementById('annTitle').value.trim(),
                body: document.getElementById('annBody').value.trim(),
                audienceType: document.getElementById('annAudience').value,
                clientId: document.getElementById('annClient').value,
              }),
            });
            closeModal();
            toast('Announcement posted.', 'success');
            route();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      content.querySelectorAll('[data-del-ann]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this announcement?')) return;
          await Nyx.apiFetch(`/announcements/${btn.dataset.delAnn}`, { method: 'DELETE' });
          route();
        });
      });
    }
  }

  // ================= SUBSCRIPTIONS =================
  async function renderSubscriptions(content) {
    const isAdmin = state.user.role === 'admin';
    const clientId = isAdmin ? (state.selectedClientId.subscriptions || (state.clients[0] && state.clients[0].id)) : null;
    if (isAdmin) state.selectedClientId.subscriptions = clientId;
    const qs = isAdmin && clientId ? `?clientId=${clientId}` : '';
    const data = await Nyx.apiFetch(`/subscriptions${qs}`);

    let html = `<div class="section-header"><h2>Subscriptions</h2>`;
    if (isAdmin) {
      html += `<div class="flex gap-8">
        <select class="client-picker" id="subClientPicker">${clientOptions(clientId)}</select>
        <button class="btn btn-primary" id="newSubBtn">+ Add Subscription</button>
      </div>`;
    }
    html += `</div>`;

    if (data.subscriptions.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u27F3</div>No subscriptions${isAdmin ? ' for this client' : ''} yet.</div></div>`;
    } else {
      html += `<div class="card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Description</th><th>Cost</th><th>Next Renewal</th><th>Status</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody>`;
      data.subscriptions.forEach((s) => {
        const days = Nyx.daysUntil(s.nextRenewalDate);
        const soon = days !== null && days <= 7 && days >= 0;
        html += `<tr>
          <td><strong>${Nyx.escapeHtml(s.name)}</strong></td>
          <td class="text-muted">${Nyx.escapeHtml(s.description || '\u2014')}</td>
          <td>${Nyx.fmtMoney(s.cost, s.currency)}</td>
          <td>${Nyx.fmtDate(s.nextRenewalDate)} ${soon ? `<span class="badge badge-orange">${days === 0 ? 'today' : days + 'd'}</span>` : ''}</td>
          <td><span class="badge ${s.status === 'active' ? 'badge-green' : 'badge-muted'}">${s.status}</span></td>
          ${isAdmin ? `<td><button class="btn btn-sm" data-edit-sub="${s.id}">Edit</button> <button class="btn btn-sm btn-danger" data-del-sub="${s.id}">Delete</button></td>` : ''}
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    }
    content.innerHTML = html;
    if (!isAdmin) return;

    document.getElementById('subClientPicker').addEventListener('change', (e) => {
      state.selectedClientId.subscriptions = e.target.value;
      route();
    });
    document.getElementById('newSubBtn').addEventListener('click', () => openSubModal(null, clientId));
    content.querySelectorAll('[data-edit-sub]').forEach((btn) => {
      const sub = data.subscriptions.find((s) => String(s.id) === btn.dataset.editSub);
      btn.addEventListener('click', () => openSubModal(sub, clientId));
    });
    content.querySelectorAll('[data-del-sub]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this subscription?')) return;
        await Nyx.apiFetch(`/subscriptions/${btn.dataset.delSub}`, { method: 'DELETE' });
        route();
      });
    });
  }

  function openSubModal(sub, clientId) {
    const editing = Boolean(sub);
    openModal(editing ? 'Edit Subscription' : 'Add Subscription', `
      <div class="field"><label>Name</label><input type="text" id="subName" value="${sub ? Nyx.escapeHtml(sub.name) : ''}" required></div>
      <div class="field"><label>Description</label><textarea id="subDesc" rows="2">${sub ? Nyx.escapeHtml(sub.description || '') : ''}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Cost (leave blank if none)</label><input type="number" step="0.01" id="subCost" value="${sub && sub.cost !== null ? sub.cost : ''}"></div>
        <div class="field"><label>Currency</label><input type="text" id="subCurrency" value="${sub ? sub.currency : 'USD'}" maxlength="8"></div>
      </div>
      <div class="field"><label>Next Renewal Date</label><input type="date" id="subRenewal" value="${sub ? (sub.nextRenewalDate || '') : ''}"></div>
      ${editing ? `<div class="field"><label>Status</label><select id="subStatus"><option value="active" ${sub.status === 'active' ? 'selected' : ''}>Active</option><option value="cancelled" ${sub.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></div>` : ''}
    `, `<button class="btn btn-primary" id="subSubmit">${editing ? 'Save Changes' : 'Add Subscription'}</button>`);

    document.getElementById('subSubmit').addEventListener('click', async () => {
      const payload = {
        name: document.getElementById('subName').value.trim(),
        description: document.getElementById('subDesc').value.trim(),
        cost: document.getElementById('subCost').value,
        currency: document.getElementById('subCurrency').value.trim() || 'USD',
        nextRenewalDate: document.getElementById('subRenewal').value,
      };
      try {
        if (editing) {
          payload.status = document.getElementById('subStatus').value;
          await Nyx.apiFetch(`/subscriptions/${sub.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        } else {
          payload.clientId = clientId;
          await Nyx.apiFetch('/subscriptions', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeModal();
        toast('Saved.', 'success');
        route();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ================= MAINTENANCE =================
  async function renderMaintenance(content) {
    const isAdmin = state.user.role === 'admin';
    const clientId = isAdmin ? (state.selectedClientId.maintenance || (state.clients[0] && state.clients[0].id)) : state.user.id;
    if (isAdmin) state.selectedClientId.maintenance = clientId;

    const [quota, reqData] = await Promise.all([
      Nyx.apiFetch(`/maintenance/quota${isAdmin ? `?clientId=${clientId}` : ''}`),
      Nyx.apiFetch(`/maintenance/requests${isAdmin ? `?clientId=${clientId}` : ''}`),
    ]);
    const pct = quota.quotaTotal > 0 ? Math.min(100, Math.round((quota.used / quota.quotaTotal) * 100)) : 0;
    const warn = pct >= 80;

    let html = `<div class="section-header"><h2>Maintenance</h2>`;
    if (isAdmin) {
      html += `<div class="flex gap-8">
        <select class="client-picker" id="maintClientPicker">${clientOptions(clientId)}</select>
        <button class="btn btn-outline-blue" id="editQuotaBtn">Set Quota</button>
        <button class="btn btn-primary" id="newReqBtn">+ New Request</button>
      </div>`;
    } else {
      html += `<button class="btn btn-primary" id="newReqBtn">+ New Request</button>`;
    }
    html += `</div>`;

    html += `<div class="card">
      <div class="card-title">Quota Usage</div>
      <div class="card-sub">${quota.used} of ${quota.quotaTotal} used &middot; ${quota.remaining} remaining</div>
      <div class="progress"><div class="progress-bar ${warn ? 'warn' : ''}" style="width:${pct}%"></div></div>
    </div>`;

    html += `<div class="card"><div class="card-title mb-0">Request History</div>`;
    if (reqData.requests.length === 0) {
      html += `<div class="empty-state"><div class="icon">\u2699</div>No maintenance requests yet.</div>`;
    } else {
      html += `<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Description</th><th>Hours</th><th>Status</th><th>Requested</th>${isAdmin ? '<th></th>' : ''}</tr></thead><tbody>`;
      reqData.requests.forEach((r) => {
        html += `<tr>
          <td><strong>${Nyx.escapeHtml(r.subject)}</strong></td>
          <td class="text-muted">${Nyx.escapeHtml(r.description || '\u2014')}</td>
          <td>${r.hoursUsed}</td>
          <td><span class="badge ${r.status === 'resolved' ? 'badge-green' : 'badge-orange'}">${r.status}</span></td>
          <td>${Nyx.fmtDate(r.createdAt)}</td>
          ${isAdmin ? `<td><button class="btn btn-sm" data-resolve-req="${r.id}">${r.status === 'resolved' ? 'Reopen' : 'Resolve'}</button></td>` : ''}
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
    content.innerHTML = html;

    document.getElementById('newReqBtn').addEventListener('click', () => openMaintReqModal(clientId, isAdmin));
    if (isAdmin) {
      document.getElementById('maintClientPicker').addEventListener('change', (e) => {
        state.selectedClientId.maintenance = e.target.value;
        route();
      });
      document.getElementById('editQuotaBtn').addEventListener('click', () => {
        openModal('Set Maintenance Quota', `
          <div class="field"><label>Quota Total (hours)</label><input type="number" step="0.5" id="quotaInput" value="${quota.quotaTotal}"></div>
        `, `<button class="btn btn-primary" id="quotaSubmit">Save</button>`);
        document.getElementById('quotaSubmit').addEventListener('click', async () => {
          try {
            await Nyx.apiFetch(`/maintenance/quota/${clientId}`, { method: 'PATCH', body: JSON.stringify({ quotaTotal: document.getElementById('quotaInput').value }) });
            closeModal();
            toast('Quota updated.', 'success');
            route();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      content.querySelectorAll('[data-resolve-req]').forEach((btn) => {
        const req = reqData.requests.find((r) => String(r.id) === btn.dataset.resolveReq);
        btn.addEventListener('click', () => {
          if (req.status === 'resolved') {
            Nyx.apiFetch(`/maintenance/requests/${req.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'pending' }) }).then(route);
            return;
          }
          openModal('Resolve Request', `
            <p class="text-muted" style="margin-top:0">${Nyx.escapeHtml(req.subject)}</p>
            <div class="field"><label>Hours used</label><input type="number" step="0.5" id="resolveHours" value="${req.hoursUsed || 0}"></div>
          `, `<button class="btn btn-primary" id="resolveSubmit">Mark Resolved</button>`);
          document.getElementById('resolveSubmit').addEventListener('click', async () => {
            try {
              await Nyx.apiFetch(`/maintenance/requests/${req.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', hoursUsed: document.getElementById('resolveHours').value }) });
              closeModal();
              toast('Request resolved.', 'success');
              route();
            } catch (err) { toast(err.message, 'error'); }
          });
        });
      });
    }
  }

  function openMaintReqModal(clientId, isAdmin) {
    openModal('New Maintenance Request', `
      <div class="field"><label>Subject</label><input type="text" id="reqSubject" required></div>
      <div class="field"><label>Description</label><textarea id="reqDesc" rows="3"></textarea></div>
      ${isAdmin ? `<div class="field"><label>Hours (if already known)</label><input type="number" step="0.5" id="reqHours" value="0"></div>` : ''}
    `, `<button class="btn btn-primary" id="reqSubmit">Submit Request</button>`);
    document.getElementById('reqSubmit').addEventListener('click', async () => {
      try {
        const payload = { subject: document.getElementById('reqSubject').value.trim(), description: document.getElementById('reqDesc').value.trim() };
        if (isAdmin) {
          payload.clientId = clientId;
          payload.hoursUsed = document.getElementById('reqHours').value;
        }
        await Nyx.apiFetch('/maintenance/requests', { method: 'POST', body: JSON.stringify(payload) });
        closeModal();
        toast('Request submitted.', 'success');
        route();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ================= INVOICES =================
  async function renderInvoices(content) {
    const isAdmin = state.user.role === 'admin';
    const clientId = isAdmin ? (state.selectedClientId.invoices || (state.clients[0] && state.clients[0].id)) : null;
    if (isAdmin) state.selectedClientId.invoices = clientId;
    const qs = isAdmin && clientId ? `?clientId=${clientId}` : '';
    const data = await Nyx.apiFetch(`/invoices${qs}`);

    let html = `<div class="section-header"><h2>Invoices</h2>`;
    if (isAdmin) {
      html += `<div class="flex gap-8">
        <select class="client-picker" id="invClientPicker">${clientOptions(clientId)}</select>
        <button class="btn btn-primary" id="newInvBtn">+ New Invoice</button>
      </div>`;
    }
    html += `</div>`;

    if (data.invoices.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u25A4</div>No invoices yet.</div></div>`;
    } else {
      data.invoices.forEach((inv) => {
        const statusBadge = inv.status === 'paid' ? 'badge-green' : inv.status === 'published' ? 'badge-orange' : 'badge-muted';
        const daysLeft = Nyx.daysUntil(inv.dueDate);
        html += `<div class="card">
          <div class="card-title">Invoice #${inv.id} &middot; ${Nyx.fmtDate(inv.periodStart)} &ndash; ${Nyx.fmtDate(inv.periodEnd)}
            <span class="badge ${statusBadge}">${inv.status}</span>
          </div>
          <div class="card-sub">Due ${Nyx.fmtDate(inv.dueDate)} ${inv.status !== 'paid' && daysLeft !== null && daysLeft <= 5 ? `<span class="badge badge-orange" style="margin-left:6px">${daysLeft < 0 ? 'overdue' : daysLeft + 'd left'}</span>` : ''}</div>
          <div class="table-wrap"><table><tbody>
            ${inv.items.map((it) => `<tr><td>${Nyx.escapeHtml(it.description)}</td><td style="text-align:right">${Nyx.fmtMoney(it.amount, inv.currency)}</td></tr>`).join('')}
            <tr><td style="font-weight:700">Total Due</td><td style="text-align:right;font-weight:700">${Nyx.fmtMoney(inv.total, inv.currency)}</td></tr>
          </tbody></table></div>
          ${inv.notes ? `<p class="text-muted" style="margin:12px 0 0">${Nyx.escapeHtml(inv.notes)}</p>` : ''}
          <div class="flex gap-8 wrap" style="margin-top:14px">
            <a class="btn btn-sm btn-outline-blue" href="/api/invoices/${inv.id}/download">Download</a>
            ${isAdmin && inv.status === 'draft' ? `<button class="btn btn-sm btn-primary" data-publish-inv="${inv.id}">Publish</button><button class="btn btn-sm btn-danger" data-del-inv="${inv.id}">Delete Draft</button>` : ''}
            ${isAdmin && inv.status === 'published' ? `<button class="btn btn-sm btn-primary" data-paid-inv="${inv.id}">Mark Paid</button>` : ''}
          </div>
        </div>`;
      });
    }
    content.innerHTML = html;
    if (!isAdmin) {
      const unseen = data.invoices.filter((inv) => !inv.viewedAt);
      if (unseen.length > 0) {
        await Promise.all(unseen.map((inv) => Nyx.apiFetch(`/invoices/${inv.id}`).catch(() => {})));
        badges.invoices = 0;
        renderNav();
      }
      return;
    }
    document.getElementById('invClientPicker').addEventListener('change', (e) => {
      state.selectedClientId.invoices = e.target.value;
      route();
    });
    document.getElementById('newInvBtn').addEventListener('click', () => openInvoiceModal(clientId));
    content.querySelectorAll('[data-publish-inv]').forEach((btn) => btn.addEventListener('click', async () => {
      try { await Nyx.apiFetch(`/invoices/${btn.dataset.publishInv}/publish`, { method: 'POST' }); toast('Invoice published.', 'success'); route(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    content.querySelectorAll('[data-paid-inv]').forEach((btn) => btn.addEventListener('click', async () => {
      await Nyx.apiFetch(`/invoices/${btn.dataset.paidInv}/mark-paid`, { method: 'POST' });
      toast('Invoice marked paid.', 'success');
      route();
    }));
    content.querySelectorAll('[data-del-inv]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this draft invoice?')) return;
      await Nyx.apiFetch(`/invoices/${btn.dataset.delInv}`, { method: 'DELETE' });
      route();
    }));
  }

  async function openInvoiceModal(clientId) {
    state.invoiceItemsDraft = [];
    const [subs, maint] = await Promise.all([
      Nyx.apiFetch(`/subscriptions?clientId=${clientId}`),
      Nyx.apiFetch(`/maintenance/requests?clientId=${clientId}`),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    renderInvoiceModalBody(clientId, subs.subscriptions, maint.requests, today);
  }

  function renderInvoiceModalBody(clientId, subs, maintReqs, today) {
    const itemsHtml = state.invoiceItemsDraft.map((it, idx) => `
      <tr><td>${Nyx.escapeHtml(it.description)}</td><td style="text-align:right">${Number(it.amount).toFixed(2)}</td>
      <td><button type="button" class="btn btn-sm btn-danger" data-rm-item="${idx}">&times;</button></td></tr>`).join('');
    const total = state.invoiceItemsDraft.reduce((s, it) => s + Number(it.amount), 0);

    openModal('New Invoice', `
      <div class="field-row">
        <div class="field"><label>Period Start</label><input type="date" id="invPeriodStart" value="${today}"></div>
        <div class="field"><label>Period End</label><input type="date" id="invPeriodEnd" value="${today}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Due Date</label><input type="date" id="invDueDate" value="${today}"></div>
        <div class="field"><label>Currency</label><input type="text" id="invCurrency" value="USD" maxlength="8"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="invNotes" rows="2"></textarea></div>

      <label>Line Items</label>
      <div class="table-wrap" style="margin-bottom:10px"><table><tbody id="invItemsBody">${itemsHtml || '<tr><td class="text-muted" colspan="3">No items yet.</td></tr>'}</tbody>
        <tfoot><tr><td style="font-weight:700">Total</td><td style="text-align:right;font-weight:700">${total.toFixed(2)}</td><td></td></tr></tfoot>
      </table></div>

      <div class="field-row" style="align-items:flex-end">
        <div class="field"><label>Add from Subscription</label>
          <select id="invSubPick"><option value="">Select&hellip;</option>${subs.map((s) => `<option value="${s.id}">${Nyx.escapeHtml(s.name)} (${s.cost === null ? 'no cost' : s.cost})</option>`).join('')}</select>
        </div>
        <button type="button" class="btn btn-sm" id="invAddSubBtn" style="margin-bottom:14px">Add</button>
      </div>
      <div class="field-row" style="align-items:flex-end">
        <div class="field"><label>Add from Maintenance</label>
          <select id="invMaintPick"><option value="">Select&hellip;</option>${maintReqs.filter((r) => r.hoursUsed > 0).map((r) => `<option value="${r.id}">${Nyx.escapeHtml(r.subject)} (${r.hoursUsed}h)</option>`).join('')}</select>
        </div>
        <button type="button" class="btn btn-sm" id="invAddMaintBtn" style="margin-bottom:14px">Add</button>
      </div>
      <div class="field-row" style="align-items:flex-end">
        <div class="field"><label>Custom item description</label><input type="text" id="invCustomDesc"></div>
        <div class="field" style="max-width:120px"><label>Amount</label><input type="number" step="0.01" id="invCustomAmount"></div>
        <button type="button" class="btn btn-sm" id="invAddCustomBtn" style="margin-bottom:14px">Add</button>
      </div>
    `, `<button class="btn btn-outline-blue" id="invSaveDraftBtn">Save as Draft</button><button class="btn btn-primary" id="invPublishBtn">Save &amp; Publish</button>`);

    document.getElementById('invAddSubBtn').addEventListener('click', () => {
      const sel = document.getElementById('invSubPick');
      const sub = subs.find((s) => String(s.id) === sel.value);
      if (!sub) return;
      state.invoiceItemsDraft.push({ description: sub.name, amount: sub.cost || 0, sourceType: 'subscription', sourceId: sub.id });
      renderInvoiceModalBody(clientId, subs, maintReqs, today);
    });
    document.getElementById('invAddMaintBtn').addEventListener('click', () => {
      const sel = document.getElementById('invMaintPick');
      const r = maintReqs.find((x) => String(x.id) === sel.value);
      if (!r) return;
      state.invoiceItemsDraft.push({ description: `${r.subject} (${r.hoursUsed}h)`, amount: 0, sourceType: 'maintenance', sourceId: r.id });
      renderInvoiceModalBody(clientId, subs, maintReqs, today);
    });
    document.getElementById('invAddCustomBtn').addEventListener('click', () => {
      const desc = document.getElementById('invCustomDesc').value.trim();
      const amt = document.getElementById('invCustomAmount').value;
      if (!desc || amt === '') return;
      state.invoiceItemsDraft.push({ description: desc, amount: Number(amt), sourceType: 'custom' });
      renderInvoiceModalBody(clientId, subs, maintReqs, today);
    });
    content_bindRemoveItems(clientId, subs, maintReqs, today);

    const collectPayload = () => ({
      clientId,
      periodStart: document.getElementById('invPeriodStart').value,
      periodEnd: document.getElementById('invPeriodEnd').value,
      dueDate: document.getElementById('invDueDate').value,
      currency: document.getElementById('invCurrency').value.trim() || 'USD',
      notes: document.getElementById('invNotes').value.trim(),
      items: state.invoiceItemsDraft,
    });

    document.getElementById('invSaveDraftBtn').addEventListener('click', async () => {
      try {
        await Nyx.apiFetch('/invoices', { method: 'POST', body: JSON.stringify(collectPayload()) });
        closeModal();
        toast('Invoice saved as draft.', 'success');
        route();
      } catch (err) { toast(err.message, 'error'); }
    });
    document.getElementById('invPublishBtn').addEventListener('click', async () => {
      try {
        const created = await Nyx.apiFetch('/invoices', { method: 'POST', body: JSON.stringify(collectPayload()) });
        await Nyx.apiFetch(`/invoices/${created.invoice.id}/publish`, { method: 'POST' });
        closeModal();
        toast('Invoice published.', 'success');
        route();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function content_bindRemoveItems(clientId, subs, maintReqs, today) {
    document.querySelectorAll('[data-rm-item]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.invoiceItemsDraft.splice(Number(btn.dataset.rmItem), 1);
        renderInvoiceModalBody(clientId, subs, maintReqs, today);
      });
    });
  }

  // ================= DOCUMENTS =================
  async function renderDocuments(content) {
    const isAdmin = state.user.role === 'admin';
    const clientId = isAdmin ? (state.selectedClientId.documents || (state.clients[0] && state.clients[0].id)) : null;
    if (isAdmin) state.selectedClientId.documents = clientId;
    const qs = isAdmin && clientId ? `?clientId=${clientId}` : '';
    const data = await Nyx.apiFetch(`/documents${qs}`);

    let html = `<div class="section-header"><h2>Documents</h2>`;
    if (isAdmin) {
      html += `<div class="flex gap-8">
        <select class="client-picker" id="docClientPicker">${clientOptions(clientId)}</select>
        <button class="btn btn-primary" id="newDocBtn">+ Upload Document</button>
      </div>`;
    }
    html += `</div>`;

    if (data.documents.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u25A5</div>No documents yet.</div></div>`;
    } else {
      html += `<div class="card"><div class="table-wrap"><table><thead><tr><th>Type</th><th>Description</th><th>File</th><th>Uploaded</th><th></th></tr></thead><tbody>`;
      data.documents.forEach((d) => {
        html += `<tr>
          <td><span class="badge badge-purple">${Nyx.escapeHtml(d.docType)}</span></td>
          <td class="text-muted">${Nyx.escapeHtml(d.description || '\u2014')}</td>
          <td>${Nyx.escapeHtml(d.filename)}</td>
          <td>${Nyx.fmtDate(d.createdAt)}</td>
          <td><a class="btn btn-sm btn-outline-blue" href="${d.downloadUrl}">Download</a></td>
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    }
    content.innerHTML = html;
    if (!isAdmin) return;

    document.getElementById('docClientPicker').addEventListener('change', (e) => {
      state.selectedClientId.documents = e.target.value;
      route();
    });
    document.getElementById('newDocBtn').addEventListener('click', () => {
      openModal('Upload Document', `
        <div class="field"><label>Document Type</label><input type="text" id="docType" placeholder="e.g. Contract, Report" required></div>
        <div class="field"><label>Description</label><textarea id="docDesc" rows="2"></textarea></div>
        <div class="field"><label>File</label><input type="file" id="docFile" required></div>
      `, `<button class="btn btn-primary" id="docSubmit">Upload</button>`);
      document.getElementById('docSubmit').addEventListener('click', async () => {
        const file = document.getElementById('docFile').files[0];
        if (!file) { toast('Choose a file first.', 'error'); return; }
        const fd = new FormData();
        fd.append('clientId', clientId);
        fd.append('docType', document.getElementById('docType').value.trim());
        fd.append('description', document.getElementById('docDesc').value.trim());
        fd.append('file', file);
        try {
          await Nyx.apiFetch('/documents', { method: 'POST', body: fd });
          closeModal();
          toast('Document uploaded.', 'success');
          route();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  // ================= CONTACT =================
  async function renderContact(content) {
    content.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">Get in Touch</div>
          <p class="card-sub mb-0"></p>
          <p><strong>Email:</strong> hello@nyxsolutions.com</p>
          <p><strong>Phone:</strong> +1 (555) 019-2044</p>
          <p><strong>Address:</strong> 128 Meridian Ave, Suite 400<br>San Francisco, CA 94107</p>
          <p class="text-muted mb-0">Support hours: Mon&ndash;Fri, 9am&ndash;6pm</p>
        </div>
        <div class="card">
          <div class="card-title">Send Us a Question</div>
          <div class="field"><label>Name</label><input type="text" id="ctName" value="${state.user.companyName ? Nyx.escapeHtml(state.user.companyName) : ''}"></div>
          <div class="field"><label>Email</label><input type="email" id="ctEmail" value="${Nyx.escapeHtml(state.user.email || '')}"></div>
          <div class="field"><label>Message</label><textarea id="ctMessage" rows="5"></textarea></div>
          <button class="btn btn-primary" id="ctSubmit">Send Message</button>
        </div>
      </div>`;
    document.getElementById('ctSubmit').addEventListener('click', async () => {
      try {
        await Nyx.apiFetch('/contact', {
          method: 'POST',
          body: JSON.stringify({
            name: document.getElementById('ctName').value.trim(),
            email: document.getElementById('ctEmail').value.trim(),
            message: document.getElementById('ctMessage').value.trim(),
          }),
        });
        document.getElementById('ctMessage').value = '';
        toast('Message sent — we\u2019ll be in touch.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ================= CLIENTS (admin) =================
  async function renderClients(content) {
    let html = `<div class="section-header"><h2>Clients</h2><button class="btn btn-primary" id="newClientBtn">+ Add Client</button></div>`;
    if (state.clients.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u25CE</div>No clients yet.</div></div>`;
    } else {
      html += `<div class="card"><div class="table-wrap"><table><thead><tr><th>Company</th><th>Username</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>`;
      state.clients.forEach((c) => {
        html += `<tr>
          <td><strong>${Nyx.escapeHtml(c.companyName || '\u2014')}</strong></td>
          <td>${Nyx.escapeHtml(c.username)}</td>
          <td class="text-muted">${Nyx.escapeHtml(c.email)}</td>
          <td><span class="badge ${c.isDisabled ? 'badge-red' : 'badge-green'}">${c.isDisabled ? 'Disabled' : 'Active'}</span></td>
          <td class="flex gap-8">
            <button class="btn btn-sm" data-reset-client="${c.id}">Reset Password</button>
            <button class="btn btn-sm ${c.isDisabled ? '' : 'btn-danger'}" data-toggle-client="${c.id}">${c.isDisabled ? 'Enable' : 'Disable'}</button>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
    }
    content.innerHTML = html;

    document.getElementById('newClientBtn').addEventListener('click', () => {
      openModal('Add Client', `
        <div class="field"><label>Company Name</label><input type="text" id="ncCompany"></div>
        <div class="field"><label>Username</label><input type="text" id="ncUsername" required></div>
        <div class="field"><label>Email</label><input type="email" id="ncEmail" required></div>
      `, `<button class="btn btn-primary" id="ncSubmit">Create Client</button>`);
      document.getElementById('ncSubmit').addEventListener('click', async () => {
        try {
          const res = await Nyx.apiFetch('/admin/clients', {
            method: 'POST',
            body: JSON.stringify({
              companyName: document.getElementById('ncCompany').value.trim(),
              username: document.getElementById('ncUsername').value.trim(),
              email: document.getElementById('ncEmail').value.trim(),
            }),
          });
          state.clients = (await Nyx.apiFetch('/admin/clients')).clients;
          closeModal();
          openModal('Client Created', `<p>Share these credentials with the client &mdash; shown only once.</p>
            <div class="field"><label>Username</label><input type="text" readonly value="${Nyx.escapeHtml(res.client.username)}"></div>
            <div class="field"><label>Temporary Password</label><input type="text" readonly value="${Nyx.escapeHtml(res.generatedPassword)}"></div>`, `<button class="btn btn-primary" onclick="NyxCloseModal()">Done</button>`);
          route();
        } catch (err) { toast(err.message, 'error'); }
      });
    });

    content.querySelectorAll('[data-reset-client]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Reset this client\u2019s password?')) return;
        const res = await Nyx.apiFetch(`/admin/clients/${btn.dataset.resetClient}/reset-password`, { method: 'POST' });
        openModal('Password Reset', `<p>New temporary password &mdash; shown only once.</p>
          <div class="field"><input type="text" readonly value="${Nyx.escapeHtml(res.generatedPassword)}"></div>`, `<button class="btn btn-primary" onclick="NyxCloseModal()">Done</button>`);
      });
    });
    content.querySelectorAll('[data-toggle-client]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const client = state.clients.find((c) => String(c.id) === btn.dataset.toggleClient);
        await Nyx.apiFetch(`/admin/clients/${client.id}`, { method: 'PATCH', body: JSON.stringify({ isDisabled: !client.isDisabled }) });
        state.clients = (await Nyx.apiFetch('/admin/clients')).clients;
        route();
      });
    });
  }

  // ================= MESSAGES (admin contact inbox) =================
  async function renderMessages(content) {
    const data = await Nyx.apiFetch('/contact');
    badges.messages = data.messages.filter((m) => m.status === 'new').length;
    renderNav();
    let html = `<div class="section-header"><h2>Contact Messages</h2></div>`;
    if (data.messages.length === 0) {
      html += `<div class="card"><div class="empty-state"><div class="icon">\u270E</div>No messages yet.</div></div>`;
    } else {
      html += data.messages.map((m) => `
        <div class="card">
          <div class="card-title">${Nyx.escapeHtml(m.name)} <span class="badge ${m.status === 'new' ? 'badge-orange' : 'badge-muted'}">${m.status}</span></div>
          <div class="card-sub">${Nyx.escapeHtml(m.email)} &middot; ${Nyx.fmtDateTime(m.createdAt)}</div>
          <p style="white-space:pre-line;margin:0 0 12px">${Nyx.escapeHtml(m.message)}</p>
          ${m.status === 'new' ? `<button class="btn btn-sm" data-read-msg="${m.id}">Mark as Read</button>` : ''}
        </div>`).join('');
    }
    content.innerHTML = html;
    content.querySelectorAll('[data-read-msg]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await Nyx.apiFetch(`/contact/${btn.dataset.readMsg}`, { method: 'PATCH', body: JSON.stringify({ status: 'read' }) });
        route();
      });
    });
  }

  // ================= ACCOUNT =================
  async function renderAccount(content) {
    content.innerHTML = `
      <div class="card" style="max-width:420px">
        <div class="card-title">Change Password</div>
        <div id="acctErr"></div>
        <div class="field"><label>Current Password</label><input type="password" id="acctCurrent"></div>
        <div class="field"><label>New Password</label><input type="password" id="acctNew"></div>
        <div class="field"><label>Confirm New Password</label><input type="password" id="acctConfirm"></div>
        <button class="btn btn-primary" id="acctSubmit">Update Password</button>
      </div>`;
    document.getElementById('acctSubmit').addEventListener('click', async () => {
      const errEl = document.getElementById('acctErr');
      errEl.innerHTML = '';
      const next = document.getElementById('acctNew').value;
      if (next !== document.getElementById('acctConfirm').value) {
        errEl.innerHTML = `<p style="color:var(--red);font-size:12.5px">Passwords do not match.</p>`;
        return;
      }
      try {
        await Nyx.apiFetch('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword: document.getElementById('acctCurrent').value, newPassword: next }),
        });
        toast('Password updated.', 'success');
        document.getElementById('acctCurrent').value = '';
        document.getElementById('acctNew').value = '';
        document.getElementById('acctConfirm').value = '';
      } catch (err) {
        errEl.innerHTML = `<p style="color:var(--red);font-size:12.5px">${Nyx.escapeHtml(err.message)}</p>`;
      }
    });
  }

  boot();
})();
