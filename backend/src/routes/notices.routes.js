const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const { parsePagination, buildPageResult } = require('../utils/pagination');
const noticesRepo = require('../repositories/notices.repo');
const { validateHttpUrl } = require('../utils/validateUrl');

const publicRouter = express.Router();
const adminRouter = express.Router();

function serializeNotice(notice) {
  return {
    id: notice.id,
    title: notice.title,
    body: notice.body,
    linkUrl: notice.link_url || null,
    createdAt: notice.created_at,
    updatedAt: notice.updated_at,
  };
}

publicRouter.use(requireAuth);

publicRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = parsePagination(req.query);
    const { items, totalItems } = await noticesRepo.listNoticesPage({ limit, offset });
    res.json(buildPageResult(items.map(serializeNotice), totalItems, page, pageSize));
  })
);

publicRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const notice = await noticesRepo.getNotice(req.params.id);
    if (!notice) throw new HttpError(404, 'Notice not found', 'NOT_FOUND');
    res.json(serializeNotice(notice));
  })
);

adminRouter.use(requireAdmin);

adminRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = parsePagination(req.query);
    const { items, totalItems } = await noticesRepo.listNoticesPage({ limit, offset });
    res.json(buildPageResult(items.map(serializeNotice), totalItems, page, pageSize));
  })
);

adminRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, body, linkUrl } = req.body || {};
    if (!title || !body) {
      throw new HttpError(400, 'title and body are required', 'BAD_REQUEST');
    }
    const validLinkUrl = validateHttpUrl(linkUrl, 'linkUrl');
    const notice = await noticesRepo.createNotice({ title, body, linkUrl: validLinkUrl, createdBy: req.user.id });
    res.status(201).json(serializeNotice(notice));
  })
);

adminRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { title, body, linkUrl } = req.body || {};
    const validLinkUrl = linkUrl !== undefined ? validateHttpUrl(linkUrl, 'linkUrl') : undefined;
    const notice = await noticesRepo.updateNotice(req.params.id, { title, body, linkUrl: validLinkUrl });
    if (!notice) throw new HttpError(404, 'Notice not found', 'NOT_FOUND');
    res.json(serializeNotice(notice));
  })
);

adminRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await noticesRepo.deleteNotice(req.params.id);
    res.status(204).end();
  })
);

module.exports = { publicRouter, adminRouter };
