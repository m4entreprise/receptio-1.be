import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;

    const result = await query(
      'SELECT id, name, phone_number, email, settings, created_at FROM companies WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const data = updateCompanySchema.parse(req.body);

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(data.phoneNumber);
    }

    if (data.settings) {
      updates.push(`settings = $${paramCount++}`);
      values.push(data.settings);
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    values.push(companyId);

    const result = await query(
      `UPDATE companies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING id, name, phone_number, email, settings`,
      values
    );

    res.json({ company: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
