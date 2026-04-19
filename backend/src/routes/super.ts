import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../config/database';
import {
  authenticateSuperAdmin,
  generateSuperAdminToken,
  generateImpersonationToken,
  SuperAdminRequest,
} from '../middleware/superAuth';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/auth/login', async (req, res: Response, next) => {
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string() })
      .parse(req.body);

    const result = await query('SELECT * FROM super_admins WHERE email = $1', [email]);
    if (!result.rows.length) throw new AppError('Invalid credentials', 401);

    const admin = result.rows[0];
    if (!(await bcrypt.compare(password, admin.password_hash)))
      throw new AppError('Invalid credentials', 401);

    await query('UPDATE super_admins SET last_login_at = NOW() WHERE id = $1', [admin.id]);

    const token = generateSuperAdminToken({ id: admin.id, email: admin.email });
    logger.info('Super admin login', { id: admin.id, email: admin.email });

    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) {
    next(err);
  }
});

// Créer le premier super admin (protégé par SUPERADMIN_BOOTSTRAP_SECRET)
router.post('/auth/bootstrap', async (req, res: Response, next) => {
  try {
    const bootstrapSecret = process.env.SUPERADMIN_BOOTSTRAP_SECRET;
    if (!bootstrapSecret || req.headers['x-bootstrap-secret'] !== bootstrapSecret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { email, password, name } = z
      .object({ email: z.string().email(), password: z.string().min(12), name: z.string() })
      .parse(req.body);

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO super_admins (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Companies ─────────────────────────────────────────────────────────────────

router.get('/companies', authenticateSuperAdmin, async (_req: SuperAdminRequest, res: Response, next) => {
  try {
    const result = await query(`
      SELECT
        c.id, c.name, c.email, c.phone_number, c.settings, c.created_at,
        COUNT(DISTINCT u.id)::int AS user_count,
        COUNT(DISTINCT ca.id)::int AS total_calls,
        COUNT(DISTINCT CASE WHEN ca.created_at >= NOW() - INTERVAL '30 days' THEN ca.id END)::int AS calls_last_30d,
        COALESCE(SUM(CASE WHEN ca.created_at >= NOW() - INTERVAL '30 days' THEN ca.duration ELSE 0 END), 0)::int AS duration_last_30d
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN calls ca ON ca.company_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/companies', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { name, email, phoneNumber, offer } = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        phoneNumber: z.string().optional(),
        offer: z.enum(['A', 'B']).optional(),
      })
      .parse(req.body);

    const settings: Record<string, any> = { timezone: 'Europe/Brussels', language: 'fr' };
    if (offer) settings.offer = offer;

    const result = await query(
      'INSERT INTO companies (name, email, phone_number, settings) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, phoneNumber ?? null, settings]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/companies/:id', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const body = z
      .object({
        name: z.string().optional(),
        phoneNumber: z.string().optional(),
        suspended: z.boolean().optional(),
        offer: z.enum(['A', 'B']).optional(),
      })
      .parse(req.body);

    const company = await query('SELECT * FROM companies WHERE id = $1', [id]);
    if (!company.rows.length) throw new AppError('Company not found', 404);

    const current = company.rows[0];
    const settings = { ...current.settings };
    if (body.offer !== undefined) settings.offer = body.offer;
    if (body.suspended !== undefined) settings.suspended = body.suspended;

    const result = await query(
      `UPDATE companies SET
        name = COALESCE($1, name),
        phone_number = COALESCE($2, phone_number),
        settings = $3,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [body.name ?? null, body.phoneNumber ?? null, settings, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/companies/:id', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM companies WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) throw new AppError('Company not found', 404);
    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

// ── Impersonation ─────────────────────────────────────────────────────────────

router.post(
  '/companies/:id/impersonate',
  authenticateSuperAdmin,
  async (req: SuperAdminRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const companyResult = await query('SELECT * FROM companies WHERE id = $1', [id]);
      if (!companyResult.rows.length) throw new AppError('Company not found', 404);
      const company = companyResult.rows[0];

      // Get first admin user of the company
      const userResult = await query(
        "SELECT * FROM users WHERE company_id = $1 AND role = 'admin' ORDER BY created_at ASC LIMIT 1",
        [id]
      );
      if (!userResult.rows.length) throw new AppError('No admin user found for this company', 404);
      const user = userResult.rows[0];

      const token = generateImpersonationToken({
        id: user.id,
        email: user.email,
        companyId: id,
        role: user.role,
      });

      // Audit log
      await query(
        'INSERT INTO impersonation_logs (super_admin_id, super_admin_email, company_id, company_name) VALUES ($1, $2, $3, $4)',
        [req.superAdmin!.id, req.superAdmin!.email, id, company.name]
      );

      logger.warn('Impersonation started', {
        superAdmin: req.superAdmin!.email,
        company: company.name,
        companyId: id,
      });

      res.json({ token, user: { id: user.id, email: user.email, companyId: id, role: user.role } });
    } catch (err) {
      next(err);
    }
  }
);

// ── Billing ───────────────────────────────────────────────────────────────────

router.get('/billing', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { from, to } = z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query);

    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const result = await query(
      `SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.email AS company_email,
        c.settings->>'offer' AS offer,
        COUNT(DISTINCT ca.id)::int AS total_calls,
        COUNT(DISTINCT CASE WHEN ca.direction = 'inbound' THEN ca.id END)::int AS inbound_calls,
        COUNT(DISTINCT CASE WHEN ca.direction = 'outbound' THEN ca.id END)::int AS outbound_calls,
        COALESCE(SUM(ca.duration), 0)::int AS total_duration_seconds,
        COUNT(DISTINCT CASE WHEN ca.status = 'missed' THEN ca.id END)::int AS missed_calls
       FROM companies c
       LEFT JOIN calls ca ON ca.company_id = c.id
         AND ca.created_at >= $1
         AND ca.created_at <= $2
       GROUP BY c.id
       ORDER BY total_calls DESC`,
      [dateFrom, dateTo]
    );

    res.json({ from: dateFrom, to: dateTo, rows: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/billing/export', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { from, to } = z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(req.query);

    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const result = await query(
      `SELECT
        c.id AS company_id,
        c.name AS company_name,
        c.email AS company_email,
        c.settings->>'offer' AS offer,
        COUNT(DISTINCT ca.id)::int AS total_calls,
        COUNT(DISTINCT CASE WHEN ca.direction = 'inbound' THEN ca.id END)::int AS inbound_calls,
        COUNT(DISTINCT CASE WHEN ca.direction = 'outbound' THEN ca.id END)::int AS outbound_calls,
        COALESCE(SUM(ca.duration), 0)::int AS total_duration_seconds,
        COUNT(DISTINCT CASE WHEN ca.status = 'missed' THEN ca.id END)::int AS missed_calls
       FROM companies c
       LEFT JOIN calls ca ON ca.company_id = c.id
         AND ca.created_at >= $1
         AND ca.created_at <= $2
       GROUP BY c.id
       ORDER BY company_name ASC`,
      [dateFrom, dateTo]
    );

    const headers = [
      'ID',
      'Entreprise',
      'Email',
      'Offre',
      'Total appels',
      'Entrants',
      'Sortants',
      'Durée totale (s)',
      'Manqués',
    ];
    const rows = result.rows.map((r: Record<string, any>) => [
      r.company_id,
      r.company_name,
      r.company_email,
      r.offer ?? '',
      r.total_calls,
      r.inbound_calls,
      r.outbound_calls,
      r.total_duration_seconds,
      r.missed_calls,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `billing_${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM pour Excel
  } catch (err) {
    next(err);
  }
});

// ── Impersonation logs ────────────────────────────────────────────────────────

router.get(
  '/impersonation-logs',
  authenticateSuperAdmin,
  async (_req: SuperAdminRequest, res: Response, next) => {
    try {
      const result = await query(
        'SELECT * FROM impersonation_logs ORDER BY created_at DESC LIMIT 200'
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
