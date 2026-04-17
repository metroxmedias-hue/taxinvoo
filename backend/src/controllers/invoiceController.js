import { asyncHandler } from '../utils/asyncHandler.js';
import { validateInvoicePayload } from '../utils/validators.js';
import { createInvoice } from '../services/invoiceService.js';

export const createInvoiceController = asyncHandler(async (req, res) => {
  const payload = validateInvoicePayload(req.body);
  const invoice = await createInvoice(payload, req.tenant.userId, req.tenant.businessId);
  res.status(201).json({ success: true, data: invoice });
});
