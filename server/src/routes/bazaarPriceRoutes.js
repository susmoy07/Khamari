import { Router } from 'express';
import {
  getLatestBenchmarks,
  listBazaarPrices,
  publishBazaarPrice,
} from '../controllers/bazaarPriceController.js';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', listBazaarPrices);
router.get('/latest', getLatestBenchmarks);
router.post(
  '/',
  authenticate,
  authorizeRoles('BAZAAR_COMMITTEE', 'ADMIN'),
  publishBazaarPrice
);

export default router;
