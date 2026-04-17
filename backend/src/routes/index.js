import { Router } from 'express';
import businessRoutes from './businessRoutes.js';
import customerRoutes from './customerRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';

const router = Router();

router.use('/business', businessRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);

export default router;
