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

const LICENSE_KEYS = ['offer_a', 'offer_b', 'smart_routing', 'outbound_license'] as const;

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

// ── Licences ──────────────────────────────────────────────────────────────────

router.get('/companies/:id/licenses', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM company_licenses WHERE company_id = $1 ORDER BY activated_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.put('/companies/:id/licenses', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { licenses } = z
      .object({
        licenses: z.array(
          z.object({
            license_key: z.enum(LICENSE_KEYS),
            active: z.boolean(),
            notes: z.string().optional(),
          })
        ),
      })
      .parse(req.body);

    for (const lic of licenses) {
      const existing = await query(
        'SELECT * FROM company_licenses WHERE company_id = $1 AND license_key = $2',
        [id, lic.license_key]
      );

      if (existing.rows.length === 0) {
        if (lic.active) {
          await query(
            'INSERT INTO company_licenses (company_id, license_key, active, activated_at, notes) VALUES ($1, $2, true, NOW(), $3)',
            [id, lic.license_key, lic.notes ?? null]
          );
        }
      } else {
        const cur = existing.rows[0];
        if (lic.active && !cur.active) {
          await query(
            'UPDATE company_licenses SET active = true, activated_at = NOW(), deactivated_at = NULL WHERE company_id = $1 AND license_key = $2',
            [id, lic.license_key]
          );
        } else if (!lic.active && cur.active) {
          await query(
            'UPDATE company_licenses SET active = false, deactivated_at = NOW() WHERE company_id = $1 AND license_key = $2',
            [id, lic.license_key]
          );
        }
        if (lic.notes !== undefined) {
          await query(
            'UPDATE company_licenses SET notes = $1 WHERE company_id = $2 AND license_key = $3',
            [lic.notes, id, lic.license_key]
          );
        }
      }
    }

    const result = await query(
      'SELECT * FROM company_licenses WHERE company_id = $1 ORDER BY activated_at ASC',
      [id]
    );
    logger.info('Licenses updated', { companyId: id, updatedBy: req.superAdmin?.email });
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ── Tarifs ────────────────────────────────────────────────────────────────────

router.get('/billing/rates', authenticateSuperAdmin, async (_req: SuperAdminRequest, res: Response, next) => {
  try {
    const result = await query('SELECT * FROM billing_rates ORDER BY rate_type, key');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/billing/rates/:key', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { key } = req.params;
    const { rate_cents } = z.object({ rate_cents: z.number().int().min(0) }).parse(req.body);

    // Archiver le tarif en cours
    await query(
      'UPDATE billing_rates_history SET effective_to = NOW() WHERE rate_key = $1 AND effective_to IS NULL',
      [key]
    );
    // Nouveau tarif dans l'historique
    await query(
      'INSERT INTO billing_rates_history (rate_key, rate_cents, effective_from, changed_by_email) VALUES ($1, $2, NOW(), $3)',
      [key, rate_cents, req.superAdmin?.email ?? null]
    );
    // Mettre à jour le tarif courant
    const result = await query(
      'UPDATE billing_rates SET rate_cents = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
      [rate_cents, key]
    );
    if (!result.rows.length) throw new AppError('Rate not found', 404);
    logger.info('Billing rate updated', { key, rate_cents, updatedBy: req.superAdmin?.email });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── Facturation ───────────────────────────────────────────────────────────────

// Calcule les frais d'une licence en tenant compte des changements de tarif sur la période.
// Si le tarif change de 29€ à 49€ au milieu de la période, les deux sous-périodes sont facturées
// séparément au tarif qui était en vigueur à ce moment-là.
function calcLicenseFeeWithHistory(
  licFrom: Date,
  licTo: Date,
  licenseKey: string,
  ratesHistory: Record<string, any>[]
): { fee_cents: number; days_active: number } {
  const relevantRates = ratesHistory.filter(
    (r) =>
      r.rate_key === licenseKey &&
      new Date(r.effective_from) < licTo &&
      (r.effective_to === null || new Date(r.effective_to) > licFrom)
  );

  let fee_cents = 0;
  let days_active = 0;

  for (const r of relevantRates) {
    const periodFrom = new Date(Math.max(licFrom.getTime(), new Date(r.effective_from).getTime()));
    const periodTo = r.effective_to
      ? new Date(Math.min(licTo.getTime(), new Date(r.effective_to).getTime()))
      : licTo;
    const d = Math.max(0, (periodTo.getTime() - periodFrom.getTime()) / (1000 * 86400));
    fee_cents += Math.round(r.rate_cents * (d / 30));
    days_active += d;
  }

  return { fee_cents, days_active: Math.round(days_active) };
}

function buildBillingRows(
  companies: Record<string, any>[],
  allLicenses: Record<string, any>[],
  ratesHistory: Record<string, any>[],
  ratesMeta: Record<string, any>,
  callCostsByCompany: Record<string, { inbound_minutes: number; outbound_minutes: number; inbound_cost_cents: number; outbound_cost_cents: number }>,
  dateFrom: Date,
  dateTo: Date
) {
  const licensesByCompany: Record<string, any[]> = {};
  for (const lic of allLicenses) {
    if (!licensesByCompany[lic.company_id]) licensesByCompany[lic.company_id] = [];
    licensesByCompany[lic.company_id].push(lic);
  }

  return companies.map((company) => {
    const licenses = licensesByCompany[company.company_id] || [];
    let license_fees_cents = 0;
    const active_licenses: any[] = [];

    for (const lic of licenses) {
      const licFrom = new Date(Math.max(dateFrom.getTime(), new Date(lic.activated_at).getTime()));
      const licTo = lic.deactivated_at
        ? new Date(Math.min(dateTo.getTime(), new Date(lic.deactivated_at).getTime()))
        : dateTo;

      const { fee_cents, days_active } = calcLicenseFeeWithHistory(licFrom, licTo, lic.license_key, ratesHistory);
      license_fees_cents += fee_cents;

      // Tarif courant pour affichage (peut être différent du tarif historique réel)
      const currentMonthlyRate = ratesMeta[lic.license_key]?.rate_cents ?? 0;
      active_licenses.push({
        key: lic.license_key,
        label: ratesMeta[lic.license_key]?.label ?? lic.license_key,
        active: lic.active,
        activated_at: lic.activated_at,
        deactivated_at: lic.deactivated_at,
        days_active,
        monthly_rate_cents: currentMonthlyRate,
        fee_cents,
      });
    }

    const costs = callCostsByCompany[company.company_id] ?? {
      inbound_minutes: 0,
      outbound_minutes: 0,
      inbound_cost_cents: 0,
      outbound_cost_cents: 0,
    };
    const total_cents = license_fees_cents + costs.inbound_cost_cents + costs.outbound_cost_cents;

    return {
      ...company,
      active_licenses,
      license_fees_cents,
      inbound_minutes: costs.inbound_minutes,
      outbound_minutes: costs.outbound_minutes,
      inbound_cost_cents: costs.inbound_cost_cents,
      outbound_cost_cents: costs.outbound_cost_cents,
      total_cents,
    };
  });
}

// Requête SQL de coûts d'appels avec historique des tarifs.
// Si inbound_per_min passe de 0,03€ à 0,05€ en cours de période,
// les appels avant le changement sont facturés à 0,03€ et ceux après à 0,05€.
const CALL_COSTS_SQL = `
  WITH grouped AS (
    SELECT
      ca.company_id,
      ca.direction,
      brh.rate_cents,
      CEIL(SUM(ca.duration)::float / 60)::int AS minutes
    FROM calls ca
    JOIN billing_rates_history brh
      ON brh.rate_key = CASE WHEN ca.direction = 'inbound' THEN 'inbound_per_min' ELSE 'outbound_per_min' END
      AND ca.created_at >= brh.effective_from
      AND (brh.effective_to IS NULL OR ca.created_at < brh.effective_to)
    WHERE ca.created_at >= $1 AND ca.created_at <= $2
      AND ca.direction IN ('inbound', 'outbound')
    GROUP BY ca.company_id, ca.direction, brh.rate_cents
  )
  SELECT
    company_id,
    COALESCE(SUM(CASE WHEN direction = 'inbound' THEN minutes ELSE 0 END), 0)::int AS inbound_minutes,
    COALESCE(SUM(CASE WHEN direction = 'outbound' THEN minutes ELSE 0 END), 0)::int AS outbound_minutes,
    COALESCE(SUM(CASE WHEN direction = 'inbound' THEN minutes * rate_cents ELSE 0 END), 0)::int AS inbound_cost_cents,
    COALESCE(SUM(CASE WHEN direction = 'outbound' THEN minutes * rate_cents ELSE 0 END), 0)::int AS outbound_cost_cents
  FROM grouped
  GROUP BY company_id
`;

router.get('/billing', authenticateSuperAdmin, async (req: SuperAdminRequest, res: Response, next) => {
  try {
    const { from, to } = z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(req.query);

    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const [callsResult, licensesResult, ratesHistoryResult, ratesCurrentResult, callCostsResult] = await Promise.all([
      query(
        `SELECT
          c.id AS company_id, c.name AS company_name, c.email AS company_email,
          COUNT(DISTINCT ca.id)::int AS total_calls,
          COUNT(DISTINCT CASE WHEN ca.direction = 'inbound' THEN ca.id END)::int AS inbound_calls,
          COUNT(DISTINCT CASE WHEN ca.direction = 'outbound' THEN ca.id END)::int AS outbound_calls,
          COALESCE(SUM(ca.duration), 0)::int AS total_duration_seconds,
          COUNT(DISTINCT CASE WHEN ca.status = 'missed' THEN ca.id END)::int AS missed_calls
         FROM companies c
         LEFT JOIN calls ca ON ca.company_id = c.id AND ca.created_at >= $1 AND ca.created_at <= $2
         GROUP BY c.id ORDER BY c.name ASC`,
        [dateFrom, dateTo]
      ),
      query(
        `SELECT cl.company_id, cl.license_key, cl.active, cl.activated_at, cl.deactivated_at
         FROM company_licenses cl
         WHERE cl.activated_at <= $2 AND (cl.deactivated_at IS NULL OR cl.deactivated_at >= $1)`,
        [dateFrom, dateTo]
      ),
      // Historique des tarifs couvrant la période (pour le calcul correct des licences et appels)
      query(
        `SELECT rate_key, rate_cents, effective_from, effective_to
         FROM billing_rates_history
         WHERE effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $1)`,
        [dateFrom, dateTo]
      ),
      query('SELECT key, rate_cents, rate_type, label FROM billing_rates'),
      query(CALL_COSTS_SQL, [dateFrom, dateTo]),
    ]);

    const ratesMeta: Record<string, any> = {};
    for (const r of ratesCurrentResult.rows) {
      ratesMeta[r.key] = { label: r.label, rate_type: r.rate_type, rate_cents: r.rate_cents };
    }

    const callCostsByCompany: Record<string, any> = {};
    for (const r of callCostsResult.rows) {
      callCostsByCompany[r.company_id] = r;
    }

    const rows = buildBillingRows(
      callsResult.rows,
      licensesResult.rows,
      ratesHistoryResult.rows,
      ratesMeta,
      callCostsByCompany,
      dateFrom,
      dateTo
    );
    res.json({ from: dateFrom, to: dateTo, rates: ratesMeta, rows });
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

    const [callsResult, licensesResult, ratesHistoryResult, ratesCurrentResult, callCostsResult] = await Promise.all([
      query(
        `SELECT
          c.id AS company_id, c.name AS company_name, c.email AS company_email,
          COUNT(DISTINCT ca.id)::int AS total_calls,
          COUNT(DISTINCT CASE WHEN ca.direction = 'inbound' THEN ca.id END)::int AS inbound_calls,
          COUNT(DISTINCT CASE WHEN ca.direction = 'outbound' THEN ca.id END)::int AS outbound_calls,
          COALESCE(SUM(ca.duration), 0)::int AS total_duration_seconds,
          COUNT(DISTINCT CASE WHEN ca.status = 'missed' THEN ca.id END)::int AS missed_calls
         FROM companies c
         LEFT JOIN calls ca ON ca.company_id = c.id AND ca.created_at >= $1 AND ca.created_at <= $2
         GROUP BY c.id ORDER BY c.name ASC`,
        [dateFrom, dateTo]
      ),
      query(
        `SELECT cl.company_id, cl.license_key, cl.active, cl.activated_at, cl.deactivated_at
         FROM company_licenses cl
         WHERE cl.activated_at <= $2 AND (cl.deactivated_at IS NULL OR cl.deactivated_at >= $1)`,
        [dateFrom, dateTo]
      ),
      query(
        `SELECT rate_key, rate_cents, effective_from, effective_to FROM billing_rates_history
         WHERE effective_from <= $2 AND (effective_to IS NULL OR effective_to >= $1)`,
        [dateFrom, dateTo]
      ),
      query('SELECT key, rate_cents, rate_type, label FROM billing_rates'),
      query(CALL_COSTS_SQL, [dateFrom, dateTo]),
    ]);

    const ratesMeta: Record<string, any> = {};
    for (const r of ratesCurrentResult.rows) {
      ratesMeta[r.key] = { label: r.label, rate_type: r.rate_type, rate_cents: r.rate_cents };
    }
    const callCostsByCompany: Record<string, any> = {};
    for (const r of callCostsResult.rows) callCostsByCompany[r.company_id] = r;

    const rows = buildBillingRows(
      callsResult.rows, licensesResult.rows, ratesHistoryResult.rows,
      ratesMeta, callCostsByCompany, dateFrom, dateTo
    );

    const headers = [
      'ID', 'Entreprise', 'Email',
      'Licences actives', 'Frais licences (€)',
      'Total appels', 'Appels entrants', 'Appels sortants', 'Appels manqués',
      'Minutes entrants', 'Coût entrants (€)',
      'Minutes sortants', 'Coût sortants (€)',
      'Total (€)',
    ];

    const csvRows = rows.map((r) => [
      r.company_id,
      r.company_name,
      r.company_email,
      r.active_licenses.filter((l: any) => l.active).map((l: any) => l.key).join('; '),
      (r.license_fees_cents / 100).toFixed(2),
      r.total_calls,
      r.inbound_calls,
      r.outbound_calls,
      r.missed_calls,
      r.inbound_minutes,
      (r.inbound_cost_cents / 100).toFixed(2),
      r.outbound_minutes,
      (r.outbound_cost_cents / 100).toFixed(2),
      (r.total_cents / 100).toFixed(2),
    ]);

    const csv = [headers, ...csvRows]
      .map((row) => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const filename = `billing_${dateFrom.toISOString().slice(0, 10)}_${dateTo.toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
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

// ── Journal d'audit ───────────────────────────────────────────────────────────

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
