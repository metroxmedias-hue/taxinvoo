import { Router } from 'express';
import { createInvoiceController } from '../controllers/invoiceController.js';
import { requireTenant } from '../middleware/tenantContext.js';

const router = Router();

router.post('/', requireTenant, createInvoiceController);

export default router;
