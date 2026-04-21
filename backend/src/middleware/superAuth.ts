import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SUPER_JWT_SECRET = process.env.SUPERADMIN_JWT_SECRET || 'superadmin-secret-change-me';
const SUPER_JWT_EXPIRES_IN = '8h';

export interface SuperAdminRequest extends Request {
  superAdmin?: {
    id: string;
    email: string;
  };
}

export const authenticateSuperAdmin = (
  req: SuperAdminRequest,
  res: Response,
  next: NextFunction
): void => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Super admin token required' });
    return;
  }
  try {
    const decoded = jwt.verify(token, SUPER_JWT_SECRET) as any;
    if (decoded.role !== 'superadmin') {
      res.status(403).json({ error: 'Not a super admin token' });
      return;
    }
    req.superAdmin = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired super admin token' });
  }
};

export const generateSuperAdminToken = (admin: { id: string; email: string }) =>
  jwt.sign({ id: admin.id, email: admin.email, role: 'superadmin' }, SUPER_JWT_SECRET, {
    expiresIn: SUPER_JWT_EXPIRES_IN,
  });

export const generateImpersonationToken = (user: {
  id: string;
  email: string;
  companyId: string;
  role: string;
}) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(
    { id: user.id, email: user.email, companyId: user.companyId, role: user.role, impersonated: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};
