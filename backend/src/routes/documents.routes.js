const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { HttpError } = require('../utils/errors');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const { documentUpload } = require('../upload/multer.config');
const documentsRepo = require('../repositories/documents.repo');

const router = express.Router();
router.use(requireAuth);

function serialize(d) {
  return {
    id: d.id,
    clientId: d.client_id,
    docType: d.doc_type,
    description: d.description,
    filename: d.filename,
    mimeType: d.mime_type,
    fileSize: d.file_size,
    createdAt: d.created_at,
    downloadUrl: `/api/documents/${d.id}/download`,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const items = req.query.clientId
        ? (await documentsRepo.listAll()).filter((d) => String(d.client_id) === String(req.query.clientId))
        : await documentsRepo.listAll();
      res.json({ documents: items.map(serialize) });
    } else {
      const items = await documentsRepo.listForClient(req.user.id);
      res.json({ documents: items.map(serialize) });
    }
  })
);

router.post(
  '/',
  requireAdmin,
  documentUpload.single('file'),
  asyncHandler(async (req, res) => {
    const { clientId, docType, description } = req.body || {};
    if (!clientId || !docType || !req.file) {
      throw new HttpError(400, 'clientId, docType and file are required', 'BAD_REQUEST');
    }
    const doc = await documentsRepo.create({
      clientId,
      docType,
      description,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileData: req.file.buffer,
      fileSize: req.file.size,
      uploadedBy: req.user.id,
    });
    res.status(201).json({ document: serialize(doc) });
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const doc = await documentsRepo.getWithFile(req.params.id);
    if (!doc) throw new HttpError(404, 'Document not found', 'NOT_FOUND');
    if (req.user.role !== 'admin' && doc.client_id !== req.user.id) {
      throw new HttpError(404, 'Document not found', 'NOT_FOUND');
    }
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename.replace(/"/g, '')}"`);
    res.send(Buffer.from(doc.file_data));
  })
);

router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    await documentsRepo.remove(req.params.id);
    res.status(204).end();
  })
);

module.exports = router;
