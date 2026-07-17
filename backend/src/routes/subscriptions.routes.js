const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const subscriptionsRepo = require('../repositories/subscriptions.repo');

const router = express.Router();
router.use(requireAuth);

function serialize(s) {
  return {
    id: s.id,
    clientId: s.client_id,
    name: s.name,
    description: s.description,
    cost: s.cost === null ? null : Number(s.cost),
    currency: s.currency,
    nextRenewalDate: s.next_renewal_date,
    status: s.status,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const items = req.query.clientId
        ? (await subscriptionsRepo.listAll()).filter((s) => String(s.client_id) === String(req.query.clientId))
        : await subscriptionsRepo.listAll();
      res.json({ subscriptions: items.map(serialize) });
    } else {
      const items = await subscriptionsRepo.listForClient(req.user.id);
      res.json({ subscriptions: items.map(serialize) });
    }
  })
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { clientId, name, description, cost, currency, nextRenewalDate } = req.body || {};
    if (!clientId || !name) {
      throw new HttpError(400, 'clientId and name are required', 'BAD_REQUEST');
    }
    const sub = await subscriptionsRepo.create({ clientId, name, description, cost, currency, nextRenewalDate });
    res.status(201).json({ subscription: serialize(sub) });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const sub = await subscriptionsRepo.update(req.params.id, req.body || {});
    if (!sub) throw new HttpError(404, 'Subscription not found', 'NOT_FOUND');
    res.json({ subscription: serialize(sub) });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await subscriptionsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
