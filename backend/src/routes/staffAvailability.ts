import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../utils/authz';
import { writeAuditLogFromRequest } from '../utils/audit';

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

const availabilitySchema = z.object({
  schedule: scheduleSchema.optional(),
  timezone: z.string().optional(),
});

const exceptionSchema = z.object({
  exceptionType: z.enum(['absence', 'holiday', 'custom_hours', 'available']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customHours: z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  reason: z.string().optional(),
});

const groupMemberScheduleSchema = z.object({
  customSchedule: scheduleSchema.optional(),
  priority: z.number().int().optional(),
});

// ============================================================================
// Staff individual availability
// ============================================================================

// GET /api/staff/:staffId/availability
router.get('/:staffId/availability', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { staffId } = req.params;

    // Verify staff belongs to company
    const staffCheck = await query(
      'SELECT id FROM staff WHERE id = $1 AND company_id = $2',
      [staffId, companyId]
    );
    if (staffCheck.rowCount === 0) throw new AppError('Staff member not found', 404);

    const result = await query(
      'SELECT * FROM staff_availability WHERE staff_id = $1',
      [staffId]
    );

    res.json({ availability: result.rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/staff/:staffId/availability
router.put('/:staffId/availability', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { staffId } = req.params;
    const data = availabilitySchema.parse(req.body);

    // Verify staff belongs to company
    const staffCheck = await query(
      'SELECT id FROM staff WHERE id = $1 AND company_id = $2',
      [staffId, companyId]
    );
    if (staffCheck.rowCount === 0) throw new AppError('Staff member not found', 404);

    const result = await query(
      `INSERT INTO staff_availability (staff_id, company_id, schedule, timezone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (staff_id) DO UPDATE
       SET schedule = EXCLUDED.schedule,
           timezone = EXCLUDED.timezone,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        staffId,
        companyId,
        data.schedule ? JSON.stringify(data.schedule) : null,
        data.timezone || 'Europe/Brussels',
      ]
    );

    await writeAuditLogFromRequest(req, {
      action: 'staff.availability.updated',
      entityType: 'staff_availability',
      entityId: result.rows[0].id,
      targetLabel: `Staff ${staffId} availability`,
      after: result.rows[0],
    });

    res.json({ availability: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Staff schedule exceptions (absences, holidays, custom hours)
// ============================================================================

// GET /api/staff/:staffId/exceptions
router.get('/:staffId/exceptions', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { staffId } = req.params;

    // Verify staff belongs to company
    const staffCheck = await query(
      'SELECT id FROM staff WHERE id = $1 AND company_id = $2',
      [staffId, companyId]
    );
    if (staffCheck.rowCount === 0) throw new AppError('Staff member not found', 404);

    const result = await query(
      `SELECT * FROM staff_schedule_exceptions
       WHERE staff_id = $1
       ORDER BY start_date ASC`,
      [staffId]
    );

    res.json({ exceptions: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/:staffId/exceptions
router.post('/:staffId/exceptions', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { staffId } = req.params;
    const data = exceptionSchema.parse(req.body);

    // Verify staff belongs to company
    const staffCheck = await query(
      'SELECT id FROM staff WHERE id = $1 AND company_id = $2',
      [staffId, companyId]
    );
    if (staffCheck.rowCount === 0) throw new AppError('Staff member not found', 404);

    const result = await query(
      `INSERT INTO staff_schedule_exceptions 
       (staff_id, company_id, exception_type, start_date, end_date, custom_hours, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        staffId,
        companyId,
        data.exceptionType,
        data.startDate,
        data.endDate,
        data.customHours ? JSON.stringify(data.customHours) : null,
        data.reason || null,
      ]
    );

    await writeAuditLogFromRequest(req, {
      action: 'staff.exception.created',
      entityType: 'staff_schedule_exception',
      entityId: result.rows[0].id,
      targetLabel: `${data.exceptionType} for staff ${staffId}`,
      after: result.rows[0],
    });

    res.status(201).json({ exception: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/staff/:staffId/exceptions/:exceptionId
router.patch('/:staffId/exceptions/:exceptionId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { staffId, exceptionId } = req.params;
    const data = exceptionSchema.partial().parse(req.body);

    if (Object.keys(data).length === 0) throw new AppError('No fields to update', 400);

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.exceptionType !== undefined) { setClauses.push(`exception_type = $${idx++}`); values.push(data.exceptionType); }
    if (data.startDate !== undefined) { setClauses.push(`start_date = $${idx++}`); values.push(data.startDate); }
    if (data.endDate !== undefined) { setClauses.push(`end_date = $${idx++}`); values.push(data.endDate); }
    if (data.customHours !== undefined) { setClauses.push(`custom_hours = $${idx++}`); values.push(JSON.stringify(data.customHours)); }
    if (data.reason !== undefined) { setClauses.push(`reason = $${idx++}`); values.push(data.reason); }

    values.push(exceptionId, staffId, companyId);

    const result = await query(
      `UPDATE staff_schedule_exceptions SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND staff_id = $${idx++} AND company_id = $${idx++}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) throw new AppError('Exception not found', 404);

    await writeAuditLogFromRequest(req, {
      action: 'staff.exception.updated',
      entityType: 'staff_schedule_exception',
      entityId: exceptionId,
      targetLabel: `Exception for staff ${staffId}`,
      after: result.rows[0],
    });

    res.json({ exception: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/staff/:staffId/exceptions/:exceptionId
router.delete('/:staffId/exceptions/:exceptionId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { staffId, exceptionId } = req.params;

    const result = await query(
      'DELETE FROM staff_schedule_exceptions WHERE id = $1 AND staff_id = $2 AND company_id = $3',
      [exceptionId, staffId, companyId]
    );

    if (result.rowCount === 0) throw new AppError('Exception not found', 404);

    await writeAuditLogFromRequest(req, {
      action: 'staff.exception.deleted',
      entityType: 'staff_schedule_exception',
      entityId: exceptionId,
      targetLabel: `Exception for staff ${staffId}`,
    });

    res.json({ message: 'Exception deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Per-group custom schedules for staff members
// ============================================================================

// PATCH /api/staff-groups/:groupId/members/:staffId/schedule
router.patch('/groups/:groupId/members/:staffId/schedule', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { groupId, staffId } = req.params;
    const data = groupMemberScheduleSchema.parse(req.body);

    // Verify group belongs to company
    const groupCheck = await query(
      'SELECT id FROM staff_groups WHERE id = $1 AND company_id = $2',
      [groupId, companyId]
    );
    if (groupCheck.rowCount === 0) throw new AppError('Group not found', 404);

    // Verify membership exists
    const memberCheck = await query(
      'SELECT id FROM staff_group_members WHERE group_id = $1 AND staff_id = $2',
      [groupId, staffId]
    );
    if (memberCheck.rowCount === 0) throw new AppError('Staff member not in this group', 404);

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.customSchedule !== undefined) {
      setClauses.push(`custom_schedule = $${idx++}`);
      values.push(data.customSchedule ? JSON.stringify(data.customSchedule) : null);
    }
    if (data.priority !== undefined) {
      setClauses.push(`priority = $${idx++}`);
      values.push(data.priority);
    }

    if (setClauses.length === 0) throw new AppError('No fields to update', 400);

    values.push(groupId, staffId);

    const result = await query(
      `UPDATE staff_group_members SET ${setClauses.join(', ')}
       WHERE group_id = $${idx++} AND staff_id = $${idx++}
       RETURNING *`,
      values
    );

    await writeAuditLogFromRequest(req, {
      action: 'staff.group_schedule.updated',
      entityType: 'staff_group_member',
      entityId: result.rows[0].id,
      targetLabel: `Staff ${staffId} schedule in group ${groupId}`,
      after: result.rows[0],
    });

    res.json({ member: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
