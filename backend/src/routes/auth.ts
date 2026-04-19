import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken, generateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import logger from '../utils/logger';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().min(2),
  companyPhone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

function buildAuthUser(row: Record<string, any>) {
  return {
    id: row.id,
    email: row.email,
    companyId: row.company_id,
    role: row.role,
    status: row.status,
    staffId: row.staff_id ?? null,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    permissions: row.permissions,
  };
}

router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const companyResult = await query(
      `INSERT INTO companies (name, email, phone_number, settings) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`,
      [data.companyName, data.email, data.companyPhone || null, {}]
    );

    const companyId = companyResult.rows[0].id;

    const userResult = await query(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, status, activated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
       RETURNING id, email, company_id, role, status, staff_id, first_name, last_name`,
      [companyId, data.email, passwordHash, data.firstName || null, data.lastName || null, 'owner', 'active']
    );

    const meResult = await query(
      `SELECT u.id, u.email, u.company_id, u.role, u.status, u.staff_id, u.first_name, u.last_name,
              c.settings
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [userResult.rows[0].id]
    );

    const user = meResult.rows[0];
    user.permissions = {
      callsRead: true,
      callDetailRead: true,
      callRecordingsRead: true,
      callTransfer: true,
      callDelete: true,
      outboundRead: true,
      outboundCreate: true,
      outboundManage: true,
      outboundAllRead: true,
      analyticsRead: true,
      staffManage: true,
      knowledgeBaseManage: true,
      settingsManage: true,
      intentsManage: true,
      qaManage: true,
      auditLogsRead: true,
      memberManage: true,
      outboundScope: 'all',
    };
    const token = generateToken({
      id: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
    });

    logger.info('User registered', { userId: user.id, email: user.email });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: buildAuthUser(user),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const result = await query(
      `SELECT u.id, u.email, u.password_hash, u.company_id, u.role, u.status, u.staff_id, u.first_name, u.last_name
       FROM users u
       WHERE u.email = $1`,
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const user = result.rows[0];
    if (user.status === 'disabled') {
      throw new AppError('Compte désactivé', 403);
    }
    if (user.status === 'invited') {
      throw new AppError('Invitation non activée', 403);
    }
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const meResult = await query(
      `SELECT u.id, u.email, u.company_id, u.role, u.status, u.staff_id, u.first_name, u.last_name,
              c.settings
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [user.id]
    );

    const hydratedUser = meResult.rows[0];
    hydratedUser.permissions = hydratedUser.role === 'owner' || hydratedUser.role === 'admin'
      ? {
          callsRead: true,
          callDetailRead: true,
          callRecordingsRead: true,
          callTransfer: true,
          callDelete: true,
          outboundRead: true,
          outboundCreate: true,
          outboundManage: true,
          outboundAllRead: true,
          analyticsRead: true,
          staffManage: true,
          knowledgeBaseManage: true,
          settingsManage: true,
          intentsManage: true,
          qaManage: true,
          auditLogsRead: true,
          memberManage: true,
          outboundScope: 'all',
        }
      : ((hydratedUser.settings?.memberAccessPolicy?.agent || {
          callsRead: true,
          callDetailRead: true,
          callRecordingsRead: true,
          callTransfer: false,
          callDelete: false,
          outboundRead: true,
          outboundCreate: true,
          outboundManage: false,
          outboundAllRead: false,
          analyticsRead: false,
          staffManage: false,
          knowledgeBaseManage: false,
          settingsManage: false,
          intentsManage: false,
          qaManage: false,
          auditLogsRead: false,
          memberManage: false,
          outboundScope: 'own',
        }));

    const token = generateToken({
      id: hydratedUser.id,
      email: hydratedUser.email,
      companyId: hydratedUser.company_id,
      role: hydratedUser.role,
    });

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: buildAuthUser(hydratedUser),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/accept-invitation', async (req: Request, res: Response, next) => {
  try {
    const data = acceptInvitationSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(data.token).digest('hex');

    const invitationResult = await query(
      `SELECT i.*, c.name AS company_name
       FROM user_invitations i
       JOIN companies c ON c.id = i.company_id
       WHERE i.token_hash = $1`,
      [tokenHash]
    );

    if (invitationResult.rows.length === 0) {
      throw new AppError('Invitation introuvable', 404);
    }

    const invitation = invitationResult.rows[0];
    if (invitation.status !== 'pending') {
      throw new AppError('Invitation déjà utilisée ou révoquée', 400);
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      throw new AppError('Invitation expirée', 400);
    }

    const existingUser = await query('SELECT id FROM users WHERE email = $1', [invitation.email]);
    if (existingUser.rows.length > 0) {
      throw new AppError('Un compte existe déjà pour cet email', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userResult = await query(
      `INSERT INTO users (
        company_id, email, password_hash, first_name, last_name, role,
        status, staff_id, invited_by_user_id, invited_at, activated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING id, email, company_id, role, status, staff_id, first_name, last_name`,
      [
        invitation.company_id,
        invitation.email,
        passwordHash,
        data.firstName || null,
        data.lastName || null,
        invitation.role,
        invitation.staff_id || null,
        invitation.invited_by_user_id || null,
      ]
    );

    await query(
      `UPDATE user_invitations
       SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP, accepted_by_user_id = $1
       WHERE id = $2`,
      [userResult.rows[0].id, invitation.id]
    );

    const token = generateToken({
      id: userResult.rows[0].id,
      email: userResult.rows[0].email,
      companyId: userResult.rows[0].company_id,
      role: userResult.rows[0].role,
    });

    res.status(201).json({
      message: 'Invitation acceptée',
      token,
      user: {
        ...buildAuthUser({
          ...userResult.rows[0],
          permissions: {
            callsRead: true,
            callDetailRead: true,
            callRecordingsRead: true,
            callTransfer: false,
            callDelete: false,
            outboundRead: true,
            outboundCreate: true,
            outboundManage: false,
            outboundAllRead: false,
            analyticsRead: false,
            staffManage: false,
            knowledgeBaseManage: false,
            settingsManage: false,
            intentsManage: false,
            qaManage: false,
            auditLogsRead: false,
            memberManage: false,
            outboundScope: 'own',
          },
        }),
      },
      companyName: invitation.company_name,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
