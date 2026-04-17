import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { validateBusinessPayload } from '../utils/validators.js';
import { createBusiness, getBusinessById, updateBusinessById } from '../services/businessService.js';

export const createBusinessController = asyncHandler(async (req, res) => {
  const userId = String(req.header('x-user-id') || '').trim();
  if (!userId) {
    throw new HttpError(401, 'Missing x-user-id header.');
  }

  const payload = validateBusinessPayload(req.body);
  const business = await createBusiness(payload, userId);
  res.status(201).json({ success: true, data: business });
});

export const getBusinessController = asyncHandler(async (req, res) => {
  const { businessId, userId } = req.tenant;
  if (req.params.id !== businessId) {
    throw new HttpError(403, 'Cannot access another tenant business profile.');
  }

  const business = await getBusinessById(userId, req.params.id);

  res.json({ success: true, data: business });
});

export const updateBusinessController = asyncHandler(async (req, res) => {
  const { businessId, userId } = req.tenant;
  if (req.params.id !== businessId) {
    throw new HttpError(403, 'Cannot update another tenant business profile.');
  }

  await getBusinessById(userId, req.params.id);

  const updates = validateBusinessPayload(req.body, { partial: true });
  const updated = await updateBusinessById(userId, req.params.id, updates);
  res.json({ success: true, data: updated });
});
