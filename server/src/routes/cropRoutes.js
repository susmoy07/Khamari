import { Router } from 'express';
import {
  createCrop,
  deleteCrop,
  getCropById,
  listCrops,
  previewCropPrice,
  updateCrop,
} from '../controllers/cropController.js';
import {
  authenticate,
  authorizeRoles,
  optionalAuthenticate,
} from '../middleware/authMiddleware.js';
import { uploadCropImage } from '../middleware/uploadMiddleware.js';

const router = Router();

router.get('/', listCrops);
router.get('/:id', getCropById);
router.post('/:id/price-preview', optionalAuthenticate, previewCropPrice);

router.post(
  '/',
  authenticate,
  authorizeRoles('FARMER', 'ADMIN'),
  uploadCropImage.single('image'),
  createCrop
);

router.patch(
  '/:id',
  authenticate,
  authorizeRoles('FARMER', 'ADMIN'),
  uploadCropImage.single('image'),
  updateCrop
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles('FARMER', 'ADMIN'),
  deleteCrop
);

export default router;
