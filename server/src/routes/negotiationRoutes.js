import { Router } from 'express';
import {
  getNegotiationDetail,
  listMyNegotiations,
  postCounterOffer,
  postMessage,
  respondToNegotiation,
  startNegotiation,
} from '../controllers/negotiationController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', listMyNegotiations);
router.get('/:id', getNegotiationDetail);
router.post(
  '/',
  authorizeRoles('BUYER', 'INSTITUTION', 'ADMIN'),
  startNegotiation
);
router.post('/:id/messages', postMessage);
router.post('/:id/offer', postCounterOffer);
router.patch('/:id/respond', respondToNegotiation);

export default router;
