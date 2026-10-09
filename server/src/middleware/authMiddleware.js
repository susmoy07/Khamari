import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/index.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      region: user.region,
      email: user.email,
    },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Missing Bearer token.',
      });
    }

    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await userRepository.findPublicById(decoded.sub);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account associated with this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token.',
    });
  }
}

export async function optionalAuthenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.slice(7).trim();
    const decoded = jwt.verify(token, env.jwt.secret);
    const user = await userRepository.findPublicById(decoded.sub);
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid optional token and proceed anonymously
  }
  next();
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }

    next();
  };
}
