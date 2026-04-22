import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../utils/authz';

const router = Router();

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const scheduleSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

const groupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  role: z.string().optional(),
  schedule: scheduleSchema.optional(),
  enabled: z.boolean().optional(),
});

// GET /api/staff-groups — list all groups with their members
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;

    const groupsResult = await query(
      `SELECT g.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'first_name', s.first_name,
              'last_name', s.last_name,
              'phone_number', s.phone_number,
              'role', s.role,
              'enabled', s.enabled,
              'custom_schedule', sgm.custom_schedule,
              'priority', sgm.priority
            ) ORDER BY sgm.priority ASC NULLS LAST, s.first_name
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS members
       FROM staff_groups g
       LEFT JOIN staff_group_members sgm ON sgm.group_id = g.id
       LEFT JOIN staff s ON s.id = sgm.staff_id
       WHERE g.company_id = $1
       GROUP BY g.id
       ORDER BY g.created_at ASC`,
      [companyId]
    );

    res.json({ groups: groupsResult.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff-groups — create a new group (admin only)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');

    const { companyId } = req.user!;
    const data = groupSchema.parse(req.body);

    const result = await query(
      `INSERT INTO staff_groups (company_id, name, description, role, schedule, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        companyId,
        data.name,
        data.description ?? null,
        data.role ?? null,
        data.schedule ? JSON.stringify(data.schedule) : null,
        data.enabled ?? true,
      ]
    );

    res.status(201).json({ group: { ...result.rows[0], members: [] } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/staff-groups/:id — update group (admin only)
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');

    const { companyId } = req.user!;
    const { id } = req.params;
    const data = groupSchema.partial().parse(req.body);

    if (Object.keys(data).length === 0) {
      throw new AppError('No fields to update', 400);
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(data.description); }
    if (data.role !== undefined) { setClauses.push(`role = $${idx++}`); values.push(data.role); }
    if (data.schedule !== undefined) { setClauses.push(`schedule = $${idx++}`); values.push(JSON.stringify(data.schedule)); }
    if (data.enabled !== undefined) { setClauses.push(`enabled = $${idx++}`); values.push(data.enabled); }

    values.push(id, companyId);

    const result = await query(
      `UPDATE staff_groups SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx++}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) throw new AppError('Group not found', 404);

    res.json({ group: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/staff-groups/:id — delete group (admin only)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');

    const { companyId } = req.user!;
    const { id } = req.params;

    const result = await query(
      `DELETE FROM staff_groups WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (result.rowCount === 0) throw new AppError('Group not found', 404);

    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff-groups/:id/members — add a staff member to the group
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');

    const { companyId } = req.user!;
    const { id: groupId } = req.params;
    const { staffId } = z.object({ staffId: z.string().uuid() }).parse(req.body);

    // Verify group belongs to company
    const groupCheck = await query(
      `SELECT id FROM staff_groups WHERE id = $1 AND company_id = $2`,
      [groupId, companyId]
    );
    if (groupCheck.rowCount === 0) throw new AppError('Group not found', 404);

    // Verify staff belongs to company
    const staffCheck = await query(
      `SELECT id FROM staff WHERE id = $1 AND company_id = $2`,
      [staffId, companyId]
    );
    if (staffCheck.rowCount === 0) throw new AppError('Staff member not found', 404);

    await query(
      `INSERT INTO staff_group_members (group_id, staff_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [groupId, staffId]
    );

    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/staff-groups/:id/members/:staffId — remove a staff member from the group
router.delete('/:id/members/:staffId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');

    const { companyId } = req.user!;
    const { id: groupId, staffId } = req.params;

    // Verify group belongs to company
    const groupCheck = await query(
      `SELECT id FROM staff_groups WHERE id = $1 AND company_id = $2`,
      [groupId, companyId]
    );
    if (groupCheck.rowCount === 0) throw new AppError('Group not found', 404);

    await query(
      `DELETE FROM staff_group_members WHERE group_id = $1 AND staff_id = $2`,
      [groupId, staffId]
    );

    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
});

export default router;
