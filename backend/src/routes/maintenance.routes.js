const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const maintenanceRepo = require('../repositories/maintenance.repo');

const router = express.Router();
router.use(requireAuth);

function serializeRequest(r) {
  return {
    id: r.id,
    clientId: r.client_id,
    subject: r.subject,
    description: r.description,
    hoursUsed: Number(r.hours_used),
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

// Quota + used + remaining, for the logged-in client (or ?clientId= for admin).
router.get(
  '/quota',
  asyncHandler(async (req, res) => {
    const clientId = req.user.role === 'admin' ? req.query.clientId : req.user.id;
    if (!clientId) throw new HttpError(400, 'clientId is required', 'BAD_REQUEST');
    const [quota, used] = await Promise.all([
      maintenanceRepo.getQuota(clientId),
      maintenanceRepo.getUsedHours(clientId),
    ]);
    const total = Number(quota.quota_total);
    res.json({ quotaTotal: total, used, remaining: Math.max(0, total - used) });
  })
);

router.patch(
  '/quota/:clientId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { quotaTotal } = req.body || {};
    if (quotaTotal === undefined || quotaTotal === null || quotaTotal === '') {
      throw new HttpError(400, 'quotaTotal is required', 'BAD_REQUEST');
    }
    const quota = await maintenanceRepo.setQuota(req.params.clientId, quotaTotal);
    res.json({ quotaTotal: Number(quota.quota_total) });
  })
);

router.get(
  '/requests',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const items = req.query.clientId
        ? (await maintenanceRepo.listAll()).filter((r) => String(r.client_id) === String(req.query.clientId))
        : await maintenanceRepo.listAll();
      res.json({ requests: items.map(serializeRequest) });
    } else {
      const items = await maintenanceRepo.listForClient(req.user.id);
      res.json({ requests: items.map(serializeRequest) });
    }
  })
);

router.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const { subject, description, clientId, hoursUsed } = req.body || {};
    if (!subject) throw new HttpError(400, 'subject is required', 'BAD_REQUEST');
    let targetClientId = req.user.id;
    if (req.user.role === 'admin') {
      if (!clientId) throw new HttpError(400, 'clientId is required for admin-created requests', 'BAD_REQUEST');
      targetClientId = clientId;
    }
    const request = await maintenanceRepo.create({
      clientId: targetClientId,
      subject,
      description,
      hoursUsed: req.user.role === 'admin' ? hoursUsed : 0,
      createdBy: req.user.id,
    });
    res.status(201).json({ request: serializeRequest(request) });
  })
);

router.patch(
  '/requests/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status, hoursUsed } = req.body || {};
    const request = await maintenanceRepo.update(req.params.id, { status, hoursUsed });
    if (!request) throw new HttpError(404, 'Request not found', 'NOT_FOUND');
    res.json({ request: serializeRequest(request) });
  })
);

module.exports = router;
