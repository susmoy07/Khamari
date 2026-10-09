import { Router } from 'express';
import {
  createDirectOrder,
  createOrderFromNegotiation,
  getOrderById,
  getOrderReceipt,
  listMyOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listMyOrders);
router.get('/:id', getOrderById);
router.get('/:id/receipt', getOrderReceipt);
router.post(
  '/',
  authorizeRoles('BUYER', 'INSTITUTION', 'ADMIN'),
  createDirectOrder
);
router.post('/from-negotiation/:negotiationId', createOrderFromNegotiation);
router.patch('/:id/status', updateOrderStatus);

export default router;
