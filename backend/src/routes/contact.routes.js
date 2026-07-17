const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAdmin } = require('../auth/middleware');
const contactRepo = require('../repositories/contact.repo');

const router = express.Router();

function serialize(m) {
  return {
    id: m.id,
    clientId: m.client_id,
    name: m.name,
    email: m.email,
    message: m.message,
    status: m.status,
    createdAt: m.created_at,
  };
}

// Open to anyone (logged in or not) — a prospective client without an
// account yet should still be able to reach out.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      throw new HttpError(400, 'name, email and message are required', 'BAD_REQUEST');
    }
    const clientId = req.user && req.user.role === 'client' ? req.user.id : null;
    const saved = await contactRepo.create({ clientId, name, email, message });
    res.status(201).json({ message: serialize(saved) });
  })
);

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const items = await contactRepo.listAll();
    res.json({ messages: items.map(serialize) });
  })
);

router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const saved = await contactRepo.markRead(req.params.id);
    if (!saved) throw new HttpError(404, 'Message not found', 'NOT_FOUND');
    res.json({ message: serialize(saved) });
  })
);

module.exports = router;
