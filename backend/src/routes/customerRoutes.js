import { Router } from 'express';
import { createCustomerController, getCustomerController, updateCustomerController } from '../controllers/customerController.js';
import { requireTenant } from '../middleware/tenantContext.js';

const router = Router();

router.post('/', requireTenant, createCustomerController);
router.get('/:id', requireTenant, getCustomerController);
router.put('/:id', requireTenant, updateCustomerController);

export default router;
