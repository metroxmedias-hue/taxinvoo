import { asyncHandler } from '../utils/asyncHandler.js';
import { validateCustomerPayload } from '../utils/validators.js';
import { createCustomer, getCustomerById, updateCustomerById } from '../services/customerService.js';

export const createCustomerController = asyncHandler(async (req, res) => {
  const payload = validateCustomerPayload(req.body);
  const customer = await createCustomer(payload, req.tenant.userId, req.tenant.businessId);
  res.status(201).json({ success: true, data: customer });
});

export const getCustomerController = asyncHandler(async (req, res) => {
  const customer = await getCustomerById(req.params.id, req.tenant.userId, req.tenant.businessId);
  res.json({ success: true, data: customer });
});

export const updateCustomerController = asyncHandler(async (req, res) => {
  const updates = validateCustomerPayload(req.body, { partial: true });
  const customer = await updateCustomerById(req.params.id, req.tenant.userId, req.tenant.businessId, updates);
  res.json({ success: true, data: customer });
});
