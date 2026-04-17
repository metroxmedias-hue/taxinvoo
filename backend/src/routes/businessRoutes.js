import { Router } from 'express';
import { createBusinessController, getBusinessController, updateBusinessController } from '../controllers/businessController.js';
import { requireTenant } from '../middleware/tenantContext.js';

const router = Router();

router.post('/', createBusinessController);
router.get('/:id', requireTenant, getBusinessController);
router.put('/:id', requireTenant, updateBusinessController);

export default router;
