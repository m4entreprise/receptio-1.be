import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';
import { query } from '../config/database';
import { normalizeAgentAccessPolicy, isTenantAdminRole } from '../utils/authz';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];

interface TokenPayload {
  id: string;
  email: string;
  companyId: string;
  role: string;
}

function getAdminPermissions() {
  return {
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
    outboundScope: 'all' as const,
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  (async () => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      const result = await query(
        `SELECT u.id, u.email, u.company_id, u.role, u.status, u.staff_id, u.first_name, u.last_name,
                c.settings
         FROM users u
         JOIN companies c ON c.id = u.company_id
         WHERE u.id = $1 AND u.company_id = $2`,
        [decoded.id, decoded.companyId]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const row = result.rows[0];
      if (row.status !== 'active') {
        res.status(403).json({ error: row.status === 'disabled' ? 'Account disabled' : 'Account not active yet' });
        return;
      }

      const settings = row.settings || {};
      const permissions = isTenantAdminRole(row.role)
        ? getAdminPermissions()
        : normalizeAgentAccessPolicy(settings?.memberAccessPolicy?.agent);

      req.user = {
        id: row.id,
        email: row.email,
        companyId: row.company_id,
        role: row.role,
        status: row.status,
        staffId: row.staff_id,
        firstName: row.first_name,
        lastName: row.last_name,
        permissions,
      };
      next();
    } catch (error) {
      res.status(403).json({ error: 'Invalid or expired token' });
    }
  })().catch(() => {
    res.status(500).json({ error: 'Authentication failed' });
  });
};

export const generateToken = (user: {
  id: string;
  email: string;
  companyId: string;
  role: string;
}) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};
