import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleSuccess, handleError } from '../lib/responseHandler';
import { SignupRequestSchema, LoginRequestSchema, UpdateProfileSchema, RequestPhoneVerificationSchema, CheckPhoneVerificationSchema, ResetPasswordSchema, ChangePasswordSchema } from '../schemas/api';
import { createPhoneVerificationProof, createSessionToken, hashPin, requireAuth, verifyPhoneVerificationProof, verifyPin } from '../lib/auth';
import { normalizePakistaniPhone } from '../lib/phone';
import { phoneVerification } from '../lib/phoneVerification';

export const authRouter = Router();

authRouter.post('/phone/request', async (req: Request, res: Response) => {
  const parsed = RequestPhoneVerificationSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Phone number check karein', parsed.error.format());
  const phone = normalizePakistaniPhone(parsed.data.phone);
  try {
    await phoneVerification.start(phone);
    return handleSuccess(res, 200, 'Code bhej diya • SMS check karein', { expiresInSeconds: 600, resendAfterSeconds: 60 });
  } catch (error) {
    if (error instanceof Error && error.message === 'WAIT_BEFORE_RESEND') {
      return handleError(res, 429, 'Thori dair ruk kar code dobara bhejein');
    }
    return handleError(res, 502, 'Code nahi bheja ja saka • Dobara koshish karein');
  }
});

authRouter.post('/phone/verify', async (req: Request, res: Response) => {
  const parsed = CheckPhoneVerificationSchema.safeParse(req.body);
  if (!parsed.success) return handleError(res, 400, 'Code check karein', parsed.error.format());
  const phone = normalizePakistaniPhone(parsed.data.phone);
  try {
    const approved = await phoneVerification.check(phone, parsed.data.code);
    if (!approved) return handleError(res, 400, 'Code ghalat ya expire ho gaya');
    return handleSuccess(res, 200, 'Phone verify ho gaya', {
      phoneVerificationToken: createPhoneVerificationProof(phone),
    });
  } catch {
    return handleError(res, 502, 'Code verify nahi ho saka • Dobara koshish karein');
  }
});

// POST /api/auth/signup
authRouter.post('/signup', async (req: Request, res: Response) => {
  const parseResult = SignupRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid signup details', parseResult.error.format());
  }

  const { name, email, password, role, sector, phoneVerificationToken } = parseResult.data;
  const phone = normalizePakistaniPhone(parseResult.data.phone);
  if (!verifyPhoneVerificationProof(phoneVerificationToken, phone)) {
    return handleError(res, 400, 'Phone pehle verify karein');
  }

  // Check if phone already registered
  const existing = await db.getUserByPhone(phone);
  if (existing) {
    return handleError(res, 409, 'User with this phone number already exists', { phone });
  }

  const newUser = await db.createUser({
    name,
    phone,
    email: email || '',
    role,
    sector: sector || 'F-7',
    phoneVerifiedAt: new Date(),
  });
  await db.setPasswordHash(newUser.id, await hashPin(password));

  const token = createSessionToken(newUser.id, newUser.role);

  return handleSuccess(res, 201, 'User account created successfully', {
    user: newUser,
    token,
  });
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const parseResult = LoginRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid login credentials', parseResult.error.format());
  }

  const { password, role } = parseResult.data;
  const phone = normalizePakistaniPhone(parseResult.data.phone);

  const user = await db.getUserByPhone(phone);
  if (!user) {
    return handleError(res, 401, 'Phone ya PIN sahi nahi • Dobara check karein');
  }
  if (role && user.role !== role) return handleError(res, 403, 'Please choose the correct account type');

  const storedHash = await db.getPasswordHash(user.id);
  if (!storedHash || !(await verifyPin(password, storedHash))) {
    return handleError(res, 401, 'Phone ya PIN sahi nahi • Dobara check karein');
  }

  const token = createSessionToken(user.id, user.role);

  return handleSuccess(res, 200, 'Login successful', {
    user,
    token,
  });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth(), async (_req: Request, res: Response) => {
  const userId = res.locals.auth.userId as string;

  const user = await db.getUserById(userId);
  if (!user) {
    return handleError(res, 404, 'User profile not found', { userId });
  }

  return handleSuccess(res, 200, 'Profile retrieved', { user });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth(), async (req: Request, res: Response) => {
  const userId = res.locals.auth.userId as string;
  const parseResult = UpdateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid profile update data', parseResult.error.format());
  }

  const updated = await db.updateUserProfile(userId, parseResult.data);
  if (!updated) {
    return handleError(res, 404, 'User not found', { userId });
  }

  return handleSuccess(res, 200, 'Profile updated successfully', { user: updated });
});

// POST /api/auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  const parseResult = ResetPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid reset password data', parseResult.error.format());
  }

  const { newPassword, phoneVerificationToken } = parseResult.data;
  const phone = normalizePakistaniPhone(parseResult.data.phone);

  if (!verifyPhoneVerificationProof(phoneVerificationToken, phone)) {
    return handleError(res, 400, 'Phone pehle verify karein');
  }

  const user = await db.getUserByPhone(phone);
  if (!user) {
    return handleError(res, 404, 'User with this phone number was not found', { phone });
  }

  const newHash = await hashPin(newPassword);
  await db.setPasswordHash(user.id, newHash);

  const token = createSessionToken(user.id, user.role);

  return handleSuccess(res, 200, 'PIN / Password updated successfully', {
    user,
    token,
  });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth(), async (req: Request, res: Response) => {
  const userId = res.locals.auth.userId as string;
  const parseResult = ChangePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return handleError(res, 400, 'Invalid change password data', parseResult.error.format());
  }

  const { currentPassword, newPassword } = parseResult.data;
  const storedHash = await db.getPasswordHash(userId);
  if (!storedHash || !(await verifyPin(currentPassword, storedHash))) {
    return handleError(res, 401, 'Mojooda PIN durust nahi hai');
  }

  const newHash = await hashPin(newPassword);
  await db.setPasswordHash(userId, newHash);

  return handleSuccess(res, 200, 'PIN kamyabi se tabdeel ho gaya hai');
});

