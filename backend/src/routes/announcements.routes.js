const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const usersRepo = require('../repositories/users.repo');
const announcementsRepo = require('../repositories/announcements.repo');

const router = express.Router();
router.use(requireAuth);

function serialize(a, clientsById) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    audienceType: a.audience_type,
    clientId: a.client_id,
    clientName: a.client_id && clientsById ? clientsById.get(a.client_id) : undefined,
    createdAt: a.created_at,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const [items, clients] = await Promise.all([announcementsRepo.listAll(), usersRepo.listClients()]);
      const clientsById = new Map(clients.map((c) => [c.id, c.company_name || c.username]));
      res.json({ announcements: items.map((a) => serialize(a, clientsById)) });
    } else {
      const items = await announcementsRepo.listForClient(req.user.id);
      res.json({ announcements: items.map((a) => serialize(a)) });
    }
  })
);

router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, body, audienceType, clientId } = req.body || {};
    if (!title || !body || !audienceType) {
      throw new HttpError(400, 'title, body and audienceType are required', 'BAD_REQUEST');
    }
    if (audienceType === 'single' && !clientId) {
      throw new HttpError(400, 'clientId is required when audienceType is "single"', 'BAD_REQUEST');
    }
    const announcement = await announcementsRepo.create({
      title,
      body,
      audienceType,
      clientId: clientId || null,
      createdBy: req.user.id,
    });
    res.status(201).json({ announcement: serialize(announcement) });
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await announcementsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
