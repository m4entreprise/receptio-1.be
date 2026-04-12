import { query } from '../config/database';
import logger from '../utils/logger';

export interface DispatchTarget {
  numbers: string[];
  strategy: 'sequential' | 'random' | 'simultaneous';
  ruleId: string;
  ruleName: string;
  fallbackType: 'voicemail' | 'none' | 'group' | 'agent';
  fallbackNumber?: string;
}

/**
 * Returns true if the current time (in the given timezone) falls within the
 * group's weekly schedule.
 */
function isWithinSchedule(schedule: any, timezone: string): boolean {
  if (!schedule) return true; // No schedule = always available

  try {
    const now = new Date();

    // Get weekday name and current HH:MM in the company's timezone
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const weekday = weekdayFormatter.format(now).toLowerCase(); // 'monday', 'tuesday', …
    const timeParts = timeFormatter.formatToParts(now);
    const hour = timeParts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = timeParts.find(p => p.type === 'minute')?.value ?? '00';
    const currentTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

    const day = schedule[weekday];
    if (!day || !day.enabled) {
      logger.info('dispatch: group not available today', { weekday, timezone });
      return false;
    }

    const available = currentTime >= day.open && currentTime < day.close;
    if (!available) {
      logger.info('dispatch: group outside scheduled hours', { weekday, currentTime, open: day.open, close: day.close, timezone });
    }
    return available;
  } catch (err: any) {
    logger.warn('dispatch: schedule check failed, defaulting to available', { error: err.message });
    return true; // Safe default: let the call through if check fails
  }
}

/**
 * Resolve a dispatch target for an inbound call.
 * Iterates enabled rules in priority order, returns the first match.
 *
 * @param companyId  The company to look up rules for
 * @param speechText The caller's speech (used for intent matching)
 */
export async function resolveDispatchTarget(
  companyId: string,
  speechText?: string
): Promise<DispatchTarget | null> {
  // Fetch company timezone for schedule checks
  const companyResult = await query(
    `SELECT settings FROM companies WHERE id = $1`,
    [companyId]
  );
  const timezone: string = companyResult.rows[0]?.settings?.timezone ?? 'Europe/Brussels';

  const rulesResult = await query(
    `SELECT * FROM dispatch_rules
     WHERE company_id = $1 AND enabled = true
     ORDER BY priority ASC, created_at ASC`,
    [companyId]
  );

  for (const rule of rulesResult.rows) {
    if (!matchesCondition(rule, speechText)) continue;

    const numbers = await resolveNumbers(rule, timezone);
    if (numbers.length === 0) {
      logger.info('dispatch: rule matched but no reachable agents (outside hours or none configured)', { ruleId: rule.id, ruleName: rule.name });
      continue;
    }

    const fallbackNumber = await resolveFallbackNumber(rule);

    logger.info('dispatch: rule matched', {
      ruleId: rule.id,
      ruleName: rule.name,
      strategy: rule.distribution_strategy,
      numbersCount: numbers.length,
      fallbackType: rule.fallback_type,
    });

    return {
      numbers,
      strategy: rule.distribution_strategy as DispatchTarget['strategy'],
      ruleId: rule.id,
      ruleName: rule.name,
      fallbackType: rule.fallback_type as DispatchTarget['fallbackType'],
      fallbackNumber: fallbackNumber ?? undefined,
    };
  }

  return null;
}

function matchesCondition(rule: any, speechText?: string): boolean {
  if (rule.condition_type === 'always') return true;

  if (rule.condition_type === 'intent' && speechText) {
    const intents: string[] = rule.conditions?.intents ?? [];
    if (intents.length === 0) return true; // intent rule with no keywords = always
    const lower = speechText.toLowerCase();
    return intents.some(kw => lower.includes(kw.toLowerCase().trim()));
  }

  return false;
}

async function resolveNumbers(rule: any, timezone: string): Promise<string[]> {
  // Target: specific agent (no schedule check — individual agents don't have schedules)
  if (rule.target_type === 'agent' && rule.target_staff_id) {
    const result = await query(
      `SELECT phone_number FROM staff WHERE id = $1 AND enabled = true`,
      [rule.target_staff_id]
    );
    return result.rows.map((r: any) => r.phone_number).filter(Boolean);
  }

  // Target: group — check schedule before returning members
  if (rule.target_type === 'group' && rule.target_group_id) {
    // Fetch group schedule along with members
    const groupResult = await query(
      `SELECT schedule FROM staff_groups WHERE id = $1 AND enabled = true`,
      [rule.target_group_id]
    );

    if (groupResult.rows.length === 0) return []; // Group disabled or not found

    const schedule = groupResult.rows[0].schedule;
    if (!isWithinSchedule(schedule, timezone)) {
      return []; // Outside scheduled hours → no agents available from this group
    }

    const membersResult = await query(
      `SELECT s.id, s.phone_number
       FROM staff_group_members sgm
       JOIN staff s ON s.id = sgm.staff_id
       WHERE sgm.group_id = $1 AND s.enabled = true AND s.phone_number IS NOT NULL`,
      [rule.target_group_id]
    );
    const members: { id: string; phone_number: string }[] = membersResult.rows;
    if (members.length === 0) return [];

    const strategy = rule.distribution_strategy || 'sequential';

    if (strategy === 'simultaneous') {
      return members.map(m => m.phone_number);
    }

    if (strategy === 'random') {
      const picked = members[Math.floor(Math.random() * members.length)];
      return [picked.phone_number];
    }

    // sequential: respect agent_order if defined
    const agentOrder: string[] = rule.agent_order ?? [];
    if (agentOrder.length > 0) {
      for (const agentId of agentOrder) {
        const member = members.find(m => m.id === agentId);
        if (member) return [member.phone_number];
      }
    }

    // fallback: first available member
    return [members[0].phone_number];
  }

  return [];
}

async function resolveFallbackNumber(rule: any): Promise<string | null> {
  if (rule.fallback_type === 'agent' && rule.fallback_staff_id) {
    const result = await query(
      `SELECT phone_number FROM staff WHERE id = $1 AND enabled = true`,
      [rule.fallback_staff_id]
    );
    return result.rows[0]?.phone_number ?? null;
  }

  if (rule.fallback_type === 'group' && rule.fallback_group_id) {
    const result = await query(
      `SELECT s.phone_number
       FROM staff_group_members sgm
       JOIN staff s ON s.id = sgm.staff_id
       WHERE sgm.group_id = $1 AND s.enabled = true AND s.phone_number IS NOT NULL
       LIMIT 1`,
      [rule.fallback_group_id]
    );
    return result.rows[0]?.phone_number ?? null;
  }

  return null;
}
