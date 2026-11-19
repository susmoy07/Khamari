import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/index.js';
import { sanitizePublicUser } from '../repositories/UserRepository.js';
import { signToken } from '../middleware/authMiddleware.js';

const ALLOWED_ROLES = ['FARMER', 'BUYER', 'INSTITUTION', 'BAZAAR_COMMITTEE'];

export async function register(req, res, next) {
  try {
    const {
      full_name,
      email,
      phone,
      password,
      role,
      organization_name = null,
      region,
    } = req.body;

    if (!full_name || !email || !phone || !password || !role || !region) {
      return res.status(400).json({
        success: false,
        error:
          'full_name, email, phone, password, role, and region are required.',
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}.`,
      });
    }

    const existingEmail = await userRepository.findByEmail(email.trim().toLowerCase());
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const existingPhone = await userRepository.findByPhone(phone.trim());
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        error: 'An account with this phone number already exists.',
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await userRepository.createUser({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password_hash,
      role,
      organization_name: organization_name ? organization_name.trim() : null,
      region: region.trim(),
      is_verified: false,
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'email and password are required.',
      });
    }

    const userRecord = await userRepository.findByEmail(email.trim().toLowerCase());
    if (!userRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const matches = await bcrypt.compare(password, userRecord.password_hash);
    if (!matches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const user = sanitizePublicUser(userRecord);

    const token = signToken(user);
    return res.json({
      success: true,
      data: { user, token },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  return res.json({
    success: true,
    data: { user: req.user },
  });
}
