const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAdmin, serializeUser } = require('../auth/middleware');
const { generateRandomPassword, hashPassword } = require('../auth/passwords');
const usersRepo = require('../repositories/users.repo');

const router = express.Router();
router.use(requireAdmin);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clients = await usersRepo.listClients();
    res.json({ clients: clients.map(serializeUser) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, email, companyName } = req.body || {};
    if (!username || !email) {
      throw new HttpError(400, 'username and email are required', 'BAD_REQUEST');
    }
    const generatedPassword = generateRandomPassword();
    const passwordHash = await hashPassword(generatedPassword);
    try {
      const user = await usersRepo.createUser({
        username,
        email,
        companyName,
        role: 'client',
        passwordHash,
      });
      res.status(201).json({ client: serializeUser(user), generatedPassword });
    } catch (err) {
      if (typeof err.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
        throw new HttpError(409, 'Username or email already in use', 'DUPLICATE');
      }
      throw err;
    }
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { companyName, email, isDisabled } = req.body || {};
    const user = await usersRepo.updateUser(req.params.id, { companyName, email, isDisabled });
    if (!user) throw new HttpError(404, 'Client not found', 'NOT_FOUND');
    res.json({ client: serializeUser(user) });
  })
);

router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const client = await usersRepo.findById(req.params.id);
    if (!client || client.role !== 'client') {
      throw new HttpError(404, 'Client not found', 'NOT_FOUND');
    }
    const generatedPassword = generateRandomPassword();
    const passwordHash = await hashPassword(generatedPassword);
    await usersRepo.setPasswordHash(client.id, passwordHash, true);
    res.json({ generatedPassword });
  })
);

module.exports = router;
