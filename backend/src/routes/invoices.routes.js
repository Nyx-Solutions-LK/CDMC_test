const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const invoicesRepo = require('../repositories/invoices.repo');
const usersRepo = require('../repositories/users.repo');

const router = express.Router();
router.use(requireAuth);

function computeTotal(items) {
  return (items || []).reduce((sum, it) => sum + Number(it.amount), 0);
}

function serialize(inv) {
  return {
    id: inv.id,
    clientId: inv.client_id,
    periodStart: inv.period_start,
    periodEnd: inv.period_end,
    dueDate: inv.due_date,
    currency: inv.currency,
    notes: inv.notes,
    status: inv.status,
    createdAt: inv.created_at,
    publishedAt: inv.published_at,
    paidAt: inv.paid_at,
    viewedAt: inv.viewed_at,
    total: computeTotal(inv.items),
    items: (inv.items || []).map((it) => ({
      id: it.id,
      description: it.description,
      amount: Number(it.amount),
      sourceType: it.source_type,
      sourceId: it.source_id,
    })),
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const items = req.query.clientId
        ? (await invoicesRepo.listAll()).filter((i) => String(i.client_id) === String(req.query.clientId))
        : await invoicesRepo.listAll();
      res.json({ invoices: items.map(serialize) });
    } else {
      const items = await invoicesRepo.listForClient(req.user.id);
      res.json({ invoices: items.map(serialize) });
    }
  })
);

router.get(
  '/unseen-count',
  asyncHandler(async (req, res) => {
    const items = await invoicesRepo.listForClient(req.user.id);
    const count = items.filter((i) => !i.viewed_at).length;
    res.json({ count });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const invoice = await invoicesRepo.getById(req.params.id);
    if (!invoice) throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    if (req.user.role !== 'admin') {
      if (invoice.client_id !== req.user.id || invoice.status === 'draft') {
        throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
      }
      await invoicesRepo.markViewed(invoice.id);
      invoice.viewed_at = invoice.viewed_at || new Date().toISOString();
    }
    res.json({ invoice: serialize(invoice) });
  })
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { clientId, periodStart, periodEnd, dueDate, currency, notes, items } = req.body || {};
    if (!clientId || !periodStart || !periodEnd || !dueDate) {
      throw new HttpError(400, 'clientId, periodStart, periodEnd and dueDate are required', 'BAD_REQUEST');
    }
    const invoice = await invoicesRepo.create({ clientId, periodStart, periodEnd, dueDate, currency, notes, items, createdBy: req.user.id });
    res.status(201).json({ invoice: serialize(invoice) });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await invoicesRepo.getById(req.params.id);
    if (!existing) throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    if (existing.status !== 'draft' && req.body.items !== undefined) {
      throw new HttpError(400, 'Only draft invoices can have their line items changed', 'BAD_REQUEST');
    }
    const invoice = await invoicesRepo.update(req.params.id, req.body || {});
    res.json({ invoice: serialize(invoice) });
  })
);

router.post(
  '/:id/publish',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await invoicesRepo.getById(req.params.id);
    if (!existing) throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    if (!existing.items || existing.items.length === 0) {
      throw new HttpError(400, 'Add at least one line item before publishing', 'BAD_REQUEST');
    }
    const invoice = await invoicesRepo.setStatus(req.params.id, 'published', 'published_at');
    res.json({ invoice: serialize(await invoicesRepo.getById(invoice.id)) });
  })
);

router.post(
  '/:id/mark-paid',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const invoice = await invoicesRepo.setStatus(req.params.id, 'paid', 'paid_at');
    if (!invoice) throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    res.json({ invoice: serialize(await invoicesRepo.getById(invoice.id)) });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await invoicesRepo.getById(req.params.id);
    if (existing && existing.status !== 'draft') {
      throw new HttpError(400, 'Only draft invoices can be deleted', 'BAD_REQUEST');
    }
    await invoicesRepo.remove(req.params.id);
    res.status(204).end();
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const invoice = await invoicesRepo.getById(req.params.id);
    if (!invoice) throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    if (req.user.role !== 'admin' && (invoice.client_id !== req.user.id || invoice.status === 'draft')) {
      throw new HttpError(404, 'Invoice not found', 'NOT_FOUND');
    }
    const client = await usersRepo.findById(invoice.client_id);
    const total = computeTotal(invoice.items);
    const fmtMoney = (n) => `${invoice.currency} ${Number(n).toFixed(2)}`;
    const rowsHtml = invoice.items
      .map((it) => `<tr><td>${escapeHtml(it.description)}</td><td style="text-align:right">${fmtMoney(it.amount)}</td></tr>`)
      .join('');
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Invoice #${invoice.id}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #1a1a2e; padding: 40px; max-width: 720px; margin: 0 auto; }
  h1 { color: #6c3ce9; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  .total-row td { font-weight: bold; border-top: 2px solid #1a1a2e; }
  .meta { color: #555; margin-bottom: 24px; }
  .status { display:inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight:bold; text-transform:uppercase; }
  .status.paid { background:#d7f7e3; color:#0d8a4f; }
  .status.published { background:#ffe9cc; color:#b8600a; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>Nyx Solutions</h1>
  <p class="meta">Invoice #${invoice.id} &middot; <span class="status ${invoice.status}">${invoice.status}</span></p>
  <p><strong>Billed to:</strong> ${escapeHtml(client ? (client.company_name || client.username) : 'Client')}</p>
  <p><strong>Period:</strong> ${invoice.period_start} to ${invoice.period_end}<br>
     <strong>Due:</strong> ${invoice.due_date}</p>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="total-row"><td>Total Due</td><td style="text-align:right">${fmtMoney(total)}</td></tr></tfoot>
  </table>
  ${invoice.notes ? `<p style="margin-top:24px"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ''}
  <p style="margin-top:40px;color:#888;font-size:13px">Use your browser's Print &rarr; Save as PDF to keep a PDF copy of this invoice.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nyx-invoice-${invoice.id}.html"`);
    res.send(html);
  })
);

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

module.exports = router;
