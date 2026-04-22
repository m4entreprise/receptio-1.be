import { query } from '../config/database';
import logger from '../utils/logger';
import type {
  DispatchRule, DispatchTarget, CallContext, Condition, Action, FallbackStep,
  ScheduleCondition, HolidayCondition, LanguageCondition,
  CallerNumberCondition, IntentCondition, AgentAvailabilityCondition,
} from '../types/dispatch';

// ─── Calendriers des jours fériés (BE, FR, LU, NL, DE, CH) ─────────────────
const HOLIDAYS: Record<string, string[]> = {
  BE: [
    '2024-01-01','2024-04-01','2024-05-01','2024-05-09','2024-05-20',
    '2024-07-21','2024-08-15','2024-11-01','2024-11-11','2024-12-25',
    '2025-01-01','2025-04-21','2025-05-01','2025-05-29','2025-06-09',
    '2025-07-21','2025-08-15','2025-11-01','2025-11-11','2025-12-25',
    '2026-01-01','2026-04-06','2026-05-01','2026-05-14','2026-05-25',
    '2026-07-21','2026-08-17','2026-11-02','2026-11-11','2026-12-25',
  ],
  FR: [
    '2024-01-01','2024-04-01','2024-05-01','2024-05-08','2024-05-09',
    '2024-05-20','2024-07-14','2024-08-15','2024-11-01','2024-11-11','2024-12-25',
    '2025-01-01','2025-04-21','2025-05-01','2025-05-08','2025-05-29',
    '2025-06-09','2025-07-14','2025-08-15','2025-11-01','2025-11-11','2025-12-25',
    '2026-01-01','2026-04-06','2026-05-01','2026-05-08','2026-05-14',
    '2026-05-25','2026-07-14','2026-08-17','2026-11-02','2026-11-11','2026-12-25',
  ],
  LU: [
    '2024-01-01','2024-04-01','2024-05-01','2024-05-09','2024-05-20',
    '2024-06-23','2024-08-15','2024-11-01','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-21','2025-05-01','2025-05-29','2025-06-09',
    '2025-06-23','2025-08-15','2025-11-01','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-06','2026-05-01','2026-05-14','2026-05-25',
    '2026-06-23','2026-08-17','2026-11-02','2026-12-25','2026-12-28',
  ],
  NL: [
    '2024-01-01','2024-03-29','2024-04-01','2024-04-27','2024-05-09',
    '2024-05-20','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-04-26','2025-05-05',
    '2025-05-29','2025-06-09','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-04-25','2026-05-14',
    '2026-05-25','2026-12-25','2026-12-26',
  ],
  DE: [
    '2024-01-01','2024-03-29','2024-04-01','2024-05-01','2024-05-09',
    '2024-05-20','2024-10-03','2024-12-25','2024-12-26',
    '2025-01-01','2025-04-18','2025-04-21','2025-05-01','2025-05-29',
    '2025-06-09','2025-10-03','2025-12-25','2025-12-26',
    '2026-01-01','2026-04-03','2026-04-06','2026-05-01','2026-05-14',
    '2026-05-25','2026-10-03','2026-12-25','2026-12-26',
  ],
  CH: [
    '2024-01-01','2024-01-02','2024-03-29','2024-04-01','2024-05-01',
    '2024-05-09','2024-05-20','2024-08-01','2024-12-25','2024-12-26',
    '2025-01-01','2025-01-02','2025-04-18','2025-04-21','2025-05-01',
    '2025-05-29','2025-06-09','2025-08-01','2025-12-25','2025-12-26',
    '2026-01-01','2026-01-02','2026-04-03','2026-04-06','2026-05-01',
    '2026-05-14','2026-05-25','2026-08-03','2026-12-25','2026-12-26',
  ],
};

// ─── Helpers planning ────────────────────────────────────────────────────────

function getTimezoneInfo(timezone: string, now: Date): { weekday: string; time: string; date: string } {
  const tz = timezone || 'Europe/Brussels';
  try {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' })
      .format(now).toLowerCase();

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const hour   = parts.find(p => p.type === 'hour')?.value   ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const year  = dateParts.find(p => p.type === 'year')?.value  ?? '2024';
    const month = dateParts.find(p => p.type === 'month')?.value ?? '01';
    const day   = dateParts.find(p => p.type === 'day')?.value   ?? '01';
    const date = `${year}-${month}-${day}`;

    return { weekday, time, date };
  } catch {
    return { weekday: 'monday', time: '12:00', date: new Date().toISOString().slice(0, 10) };
  }
}

function isGroupScheduleOpen(schedule: any, timezone: string, now: Date): boolean {
  if (!schedule) return true;
  const { weekday, time } = getTimezoneInfo(timezone, now);
  const day = schedule[weekday];
  if (!day?.enabled) return false;
  return time >= day.open && time < day.close;
}

// ─── Évaluateurs de conditions ───────────────────────────────────────────────

function evalSchedule(cond: ScheduleCondition, ctx: CallContext): boolean {
  const { weekday, time } = getTimezoneInfo(ctx.timezone, ctx.now);
  if (!cond.days.includes(weekday as any)) return false;
  return time >= cond.time_start && time < cond.time_end;
}

function evalHoliday(cond: HolidayCondition, ctx: CallContext): boolean {
  const { date } = getTimezoneInfo(ctx.timezone, ctx.now);
  const holidays = HOLIDAYS[cond.country] ?? HOLIDAYS['BE'];
  const isHoliday = holidays.includes(date);
  return cond.match === 'on_holiday' ? isHoliday : !isHoliday;
}

function evalLanguage(cond: LanguageCondition, ctx: CallContext): boolean {
  if (!ctx.language) return true; // Si langue inconnue, ne pas bloquer
  const lang = ctx.language.toLowerCase();
  return cond.languages.some(l => lang.startsWith(l.toLowerCase()));
}

function evalCallerNumber(cond: CallerNumberCondition, ctx: CallContext): boolean {
  if (!ctx.callerNumber) return false;
  return cond.patterns.some(pattern => {
    switch (cond.mode) {
      case 'equals':      return ctx.callerNumber === pattern;
      case 'starts_with': return ctx.callerNumber!.startsWith(pattern);
      case 'contains':    return ctx.callerNumber!.includes(pattern);
      default:            return false;
    }
  });
}

function evalIntent(cond: IntentCondition, ctx: CallContext): boolean {
  if (!ctx.speechText) return cond.intents.length === 0;
  const lower = ctx.speechText.toLowerCase();
  if (cond.match_mode === 'all') {
    return cond.intents.every(kw => lower.includes(kw.toLowerCase().trim()));
  }
  return cond.intents.some(kw => lower.includes(kw.toLowerCase().trim()));
}

async function evalAgentAvailability(
  cond: AgentAvailabilityCondition,
  ctx: CallContext,
): Promise<boolean> {
  const groupResult = await query(
    `SELECT schedule FROM staff_groups WHERE id = $1 AND company_id = $2 AND enabled = true`,
    [cond.group_id, ctx.companyId]
  );
  if (groupResult.rows.length === 0) {
    return cond.check === 'all_unavailable';
  }
  const open = isGroupScheduleOpen(groupResult.rows[0].schedule, ctx.timezone, ctx.now);

  if (cond.check === 'any_available') {
    if (!open) return false;
    const cnt = await query(
      `SELECT COUNT(*) AS c FROM staff_group_members sgm
       JOIN staff s ON s.id = sgm.staff_id
       WHERE sgm.group_id = $1 AND s.enabled = true AND s.phone_number IS NOT NULL`,
      [cond.group_id]
    );
    return parseInt(cnt.rows[0]?.c ?? '0') > 0;
  }
  return !open;
}

// ─── Évaluation d'un ensemble de conditions ───────────────────────────────────

async function evaluateConditions(rule: DispatchRule, ctx: CallContext): Promise<boolean> {
  if (rule.condition_operator === 'ALWAYS' || rule.conditions.length === 0) return true;

  const results = await Promise.all(
    rule.conditions.map(async (cond: Condition): Promise<boolean> => {
      switch (cond.type) {
        case 'always':             return true;
        case 'schedule':           return evalSchedule(cond, ctx);
        case 'holiday':            return evalHoliday(cond, ctx);
        case 'language':           return evalLanguage(cond, ctx);
        case 'caller_number':      return evalCallerNumber(cond, ctx);
        case 'intent':             return evalIntent(cond, ctx);
        case 'agent_availability': return evalAgentAvailability(cond, ctx);
        default:                   return false;
      }
    })
  );

  return rule.condition_operator === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ─── Résolution des numéros cibles ────────────────────────────────────────────

async function resolveActionNumbers(
  action: Action,
  companyId: string,
  timezone: string,
  now: Date,
  ruleId: string,
): Promise<{ numbers: string[]; strategy: 'sequential' | 'simultaneous' | 'random' } | null> {

  switch (action.type) {
    case 'route_group': {
      const grp = await query(
        `SELECT schedule FROM staff_groups WHERE id = $1 AND company_id = $2 AND enabled = true`,
        [action.group_id, companyId]
      );
      if (!grp.rows.length) return null;
      if (!isGroupScheduleOpen(grp.rows[0].schedule, timezone, now)) {
        logger.info('dispatch: group outside scheduled hours', { groupId: action.group_id });
        return null;
      }

      const members = await query(
        `SELECT s.id, s.phone_number
         FROM staff_group_members sgm
         JOIN staff s ON s.id = sgm.staff_id
         WHERE sgm.group_id = $1 AND s.enabled = true AND s.phone_number IS NOT NULL
         ORDER BY sgm.priority ASC NULLS LAST, s.first_name ASC`,
        [action.group_id]
      );
      const list: { id: string; phone_number: string }[] = members.rows;
      if (!list.length) return null;

      const strat = action.distribution_strategy;

      if (strat === 'simultaneous') {
        return { numbers: list.map(m => m.phone_number), strategy: 'simultaneous' };
      }
      if (strat === 'random') {
        const picked = list[Math.floor(Math.random() * list.length)];
        return { numbers: [picked.phone_number], strategy: 'random' };
      }
      if (strat === 'round_robin') {
        // Incrément atomique du curseur
        const rrResult = await query(
          `UPDATE dispatch_rules
           SET round_robin_index = (round_robin_index + 1) % $1
           WHERE id = $2
           RETURNING (round_robin_index + $1 - 1) % $1 AS used_index`,
          [list.length, ruleId]
        );
        const idx = parseInt(rrResult.rows[0]?.used_index ?? '0');
        return { numbers: [list[idx].phone_number], strategy: 'sequential' };
      }
      // Sequential : respecter agent_order si défini
      const order: string[] = action.agent_order ?? [];
      if (order.length > 0) {
        for (const agentId of order) {
          const m = list.find(x => x.id === agentId);
          if (m) return { numbers: [m.phone_number], strategy: 'sequential' };
        }
      }
      return { numbers: [list[0].phone_number], strategy: 'sequential' };
    }

    case 'route_agent': {
      const res = await query(
        `SELECT phone_number FROM staff WHERE id = $1 AND company_id = $2 AND enabled = true`,
        [action.agent_id, companyId]
      );
      const ph = res.rows[0]?.phone_number;
      return ph ? { numbers: [ph], strategy: 'sequential' } : null;
    }

    case 'route_external': {
      return action.phone_number
        ? { numbers: [action.phone_number], strategy: 'sequential' }
        : null;
    }

    // play_message et voicemail ne génèrent pas de numéros — gérés par Twilio directement
    default:
      return null;
  }
}

// ─── Résolution de la chaîne de fallback ─────────────────────────────────────

async function resolveFallbackChain(
  chain: FallbackStep[],
  companyId: string,
  timezone: string,
  now: Date,
): Promise<{ type: 'voicemail' | 'external' | 'message' | 'none'; number?: string; message?: string } | null> {
  for (const step of chain) {
    const act = step.action;

    if (act.type === 'voicemail') {
      return { type: 'voicemail', message: act.greeting_text };
    }
    if (act.type === 'play_message') {
      return { type: 'message', message: act.message_text };
    }
    if (act.type === 'route_external' && act.phone_number) {
      return { type: 'external', number: act.phone_number };
    }
    if (act.type === 'route_agent') {
      const res = await query(
        `SELECT phone_number FROM staff WHERE id = $1 AND company_id = $2 AND enabled = true`,
        [act.agent_id, companyId]
      );
      const ph = res.rows[0]?.phone_number;
      if (ph) return { type: 'external', number: ph };
    }
    if (act.type === 'route_group') {
      const grp = await query(
        `SELECT schedule FROM staff_groups WHERE id = $1 AND company_id = $2 AND enabled = true`,
        [act.group_id, companyId]
      );
      if (!grp.rows.length) continue;
      if (!isGroupScheduleOpen(grp.rows[0].schedule, timezone, now)) continue;
      const first = await query(
        `SELECT s.phone_number FROM staff_group_members sgm
         JOIN staff s ON s.id = sgm.staff_id
         WHERE sgm.group_id = $1 AND s.enabled = true AND s.phone_number IS NOT NULL
         LIMIT 1`,
        [act.group_id]
      );
      const ph = first.rows[0]?.phone_number;
      if (ph) return { type: 'external', number: ph };
    }
  }
  return null;
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

export async function resolveDispatchTarget(
  companyId: string,
  speechText?: string,
  callerNumber?: string,
  language?: string,
): Promise<DispatchTarget | null> {

  const companyRes = await query(
    `SELECT settings FROM companies WHERE id = $1`,
    [companyId]
  );
  const timezone: string = companyRes.rows[0]?.settings?.timezone ?? 'Europe/Brussels';
  const now = new Date();

  const ctx: CallContext = { companyId, callerNumber, language, speechText, timezone, now };

  const rulesRes = await query(
    `SELECT * FROM dispatch_rules
     WHERE company_id = $1 AND enabled = true
     ORDER BY priority ASC, created_at ASC`,
    [companyId]
  );

  for (const row of rulesRes.rows) {
    const rule: DispatchRule = {
      ...row,
      conditions:     Array.isArray(row.conditions) ? row.conditions : [],
      fallback_chain: Array.isArray(row.fallback_chain) ? row.fallback_chain : [],
      node_positions: row.node_positions ?? {},
    };

    const matches = await evaluateConditions(rule, ctx);
    if (!matches) {
      logger.info('dispatch: conditions not met', { ruleId: rule.id, name: rule.name });
      continue;
    }

    const resolved = await resolveActionNumbers(rule.action, companyId, timezone, now, rule.id);
    const fallback = await resolveFallbackChain(rule.fallback_chain, companyId, timezone, now);

    if (!resolved || resolved.numbers.length === 0) {
      // Aucun agent disponible → tenter le fallback directement
      logger.info('dispatch: action has no numbers, trying fallback', { ruleId: rule.id });
      if (fallback) {
        return {
          numbers: fallback.type === 'external' && fallback.number ? [fallback.number] : [],
          strategy: 'sequential',
          ruleId: rule.id,
          ruleName: rule.name,
          fallbackType: fallback.type,
          fallbackNumber: fallback.number,
          fallbackMessage: fallback.message,
        };
      }
      continue; // Essayer la règle suivante
    }

    logger.info('dispatch: rule matched', {
      ruleId: rule.id,
      ruleName: rule.name,
      numbers: resolved.numbers.length,
      strategy: resolved.strategy,
    });

    return {
      numbers:       resolved.numbers,
      strategy:      resolved.strategy,
      ruleId:        rule.id,
      ruleName:      rule.name,
      fallbackType:  fallback?.type ?? 'none',
      fallbackNumber: fallback?.number,
      fallbackMessage: fallback?.message,
    };
  }

  logger.info('dispatch: no rule matched for company', { companyId });
  return null;
}
