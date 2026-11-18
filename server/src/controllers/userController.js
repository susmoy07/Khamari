import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/index.js';
import { enrichCropWithFairPriceIndicator } from './cropController.js';

async function dispatchOtpEmail({ to, fullName, otp }) {
  const subject = `Khamari Account Verification OTP: ${otp}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #d1fae5;border-radius:16px;">
      <h2 style="color:#064e3b;margin:0 0 8px;">Khamari Identity &amp; Email Verification</h2>
      <p style="color:#334155;font-size:14px;">Hello ${fullName},</p>
      <p style="color:#334155;font-size:14px;">Use this 6-digit OTP code to confirm your email and verify your Khamari trader ID:</p>
      <div style="margin:20px 0;padding:16px;background:#ecfdf5;border-radius:12px;text-align:center;font-family:monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#065f46;">
        ${otp}
      </div>
      <p style="color:#64748b;font-size:12px;">This verification code expires in 10 minutes.</p>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM || 'Khamari <onboarding@resend.dev>',
          to,
          subject,
          html,
        }),
      });
      if (res.ok) return 'email';
    } catch (err) {
      console.warn('[Mail:Resend] Falling back to console OTP preview:', err.message);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
      });
      return 'email';
    } catch (err) {
      console.warn('[Mail:SMTP] Falling back to console OTP preview:', err.message);
    }
  }

  console.log(`[Khamari:OTP] Email OTP for ${to} (${fullName}): ${otp} (valid 10m)`);
  return 'console_preview';
}

export async function getPublicProfile(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });
    }

    const maskNid = req.user?.id !== userId;
    const data = await userRepository.getPublicProfileWithStats(userId, { maskNid });
    if (!data) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }

    return res.json({
      success: true,
      data: {
        profile: data.profile,
        stats: data.stats,
        crops: data.crops.map(enrichCropWithFairPriceIndicator),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const {
      full_name,
      phone,
      organization_name,
      region,
      bio,
      nid_number,
      address,
      specialty_crops,
      years_experience,
    } = req.body;

    const fields = {};

    if (full_name !== undefined) {
      if (!String(full_name).trim()) {
        return res.status(400).json({ success: false, error: 'Full name cannot be empty.' });
      }
      fields.full_name = String(full_name).trim();
    }

    if (phone !== undefined) {
      const cleanedPhone = String(phone).trim();
      if (!cleanedPhone) {
        return res.status(400).json({ success: false, error: 'Phone number cannot be empty.' });
      }
      const existingPhone = await userRepository.findByPhone(cleanedPhone);
      if (existingPhone && existingPhone.id !== req.user.id) {
        return res.status(409).json({
          success: false,
          error: 'An account with this phone number already exists.',
        });
      }
      fields.phone = cleanedPhone;
    }

    if (organization_name !== undefined) {
      fields.organization_name = String(organization_name).trim() || null;
    }

    if (region !== undefined) {
      if (!String(region).trim()) {
        return res.status(400).json({ success: false, error: 'Region cannot be empty.' });
      }
      fields.region = String(region).trim();
    }

    if (bio !== undefined) fields.bio = String(bio).trim() || null;
    if (nid_number !== undefined) fields.nid_number = String(nid_number).trim() || null;
    if (address !== undefined) fields.address = String(address).trim() || null;
    if (specialty_crops !== undefined) {
      fields.specialty_crops = String(specialty_crops).trim() || null;
    }

    if (years_experience !== undefined) {
      if (years_experience === '' || years_experience === null) {
        fields.years_experience = null;
      } else {
        const yrs = Number(years_experience);
        if (!Number.isFinite(yrs) || yrs < 0 || yrs > 100) {
          return res.status(400).json({
            success: false,
            error: 'Years of experience must be between 0 and 100.',
          });
        }
        fields.years_experience = Math.round(yrs);
      }
    }

    const user = await userRepository.updateProfile(req.user.id, fields);
    return res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function uploadMyAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please choose an image file (JPEG, PNG, or WebP).',
      });
    }

    const avatar_url = `/uploads/${req.file.filename}`;
    const user = await userRepository.updateProfile(req.user.id, { avatar_url });
    return res.json({
      success: true,
      data: { user, avatar_url },
    });
  } catch (err) {
    next(err);
  }
}

export async function changeMyPassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: 'current_password and new_password are required.',
      });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long.',
      });
    }

    const record = await userRepository.findByIdPrivate(req.user.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const matches = await bcrypt.compare(String(current_password), record.password_hash);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect.',
      });
    }

    const nextHash = await bcrypt.hash(String(new_password), 10);
    await userRepository.updatePassword(req.user.id, nextHash);

    return res.json({
      success: true,
      data: { message: 'Password updated successfully.' },
    });
  } catch (err) {
    next(err);
  }
}

export async function sendMyVerificationOtp(req, res, next) {
  try {
    const submittedNid = req.body?.nid_number ? String(req.body.nid_number).trim() : '';
    const finalNid = submittedNid || req.user.nid_number || '';

    if (!finalNid || finalNid.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Enter your National ID / Krishi ID / Trade License (min 5 characters) before requesting OTP.',
      });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otp_code_hash = await bcrypt.hash(otp, 10);
    const otp_expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await userRepository.saveOtp(req.user.id, {
      otp_code_hash,
      otp_expires_at,
      nid_number: finalNid,
    });

    const deliveredVia = await dispatchOtpEmail({
      to: req.user.email,
      fullName: req.user.full_name,
      otp,
    });

    return res.json({
      success: true,
      data: {
        message:
          deliveredVia === 'email'
            ? `A 6-digit verification OTP was sent to ${req.user.email}.`
            : `OTP generated for ${req.user.email} (local mail preview mode).`,
        email: req.user.email,
        deliveredVia,
        expiresInSeconds: 600,
        ...(deliveredVia === 'console_preview' ? { dev_otp: otp } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyMyOtp(req, res, next) {
  try {
    const rawOtp = String(req.body?.otp ?? '').trim();
    const submittedNid = req.body?.nid_number ? String(req.body.nid_number).trim() : null;

    if (!/^\d{6}$/.test(rawOtp)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter the 6-digit OTP code.',
      });
    }

    const record = await userRepository.findByIdPrivate(req.user.id);
    if (!record || !record.otp_code_hash || !record.otp_expires_at) {
      return res.status(400).json({
        success: false,
        error: 'No active OTP found. Please request a verification code first.',
      });
    }

    if (new Date(record.otp_expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'This OTP code has expired. Please request a new one.',
      });
    }

    const valid = await bcrypt.compare(rawOtp, record.otp_code_hash);
    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP code. Please verify and try again.',
      });
    }

    const user = await userRepository.markVerified(req.user.id, { nid_number: submittedNid });
    return res.json({
      success: true,
      data: {
        user,
        message: 'Your ID and email have been verified successfully!',
      },
    });
  } catch (err) {
    next(err);
  }
}
