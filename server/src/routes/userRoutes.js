import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';
import { uploadCropImage } from '../middleware/uploadMiddleware.js';
import {
  changeMyPassword,
  getPublicProfile,
  sendMyVerificationOtp,
  updateMyProfile,
  uploadMyAvatar,
  verifyMyOtp,
} from '../controllers/userController.js';

const router = Router();

router.patch('/me/profile', authenticate, updateMyProfile);
router.post('/me/avatar', authenticate, uploadCropImage.single('avatar'), uploadMyAvatar);
router.patch('/me/password', authenticate, changeMyPassword);
router.post('/me/send-otp', authenticate, sendMyVerificationOtp);
router.post('/me/verify-otp', authenticate, verifyMyOtp);
router.get('/:id/profile', optionalAuthenticate, getPublicProfile);

export default router;
