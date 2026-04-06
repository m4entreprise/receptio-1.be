import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

interface MonitoringCallRow {
  id: string;
  caller_number?: string | null;
  created_at: string;
  duration?: number | null;
  status: string;
  ended_at?: string | null;
  summary?: string | null;
  intent?: string | null;
}

interface CallEventRow {
  id: string;
  call_id: string;
  event_type: string;
  data: Record<string, any>;
  timestamp: string;
}

interface BbisTurnMetrics {
  eventType: string;
  timestamp: string;
  turnIndex: number;
  actionType: string | null;
  turnIntent: string | null;
  transcriptText: string;
  transcriptLength: number;
  replyText: string;
  replyLength: number;
  sttDurationMs: number | null;
  llmDurationMs: number | null;
  processingDurationMs: number | null;
  ttsDurationMs: number | null;
  totalDurationMs: number | null;
  audioDurationMs: number | null;
  inputAudioMs: number | null;
  speechDurationMs: number | null;
  silenceDurationMs: number | null;
  sttConfidence: number | null;
  sttModel: string | null;
  llmModel: string | null;
  ttsModel: string | null;
  ttsVoice: string | null;
  providerStt: string | null;
  providerLlm: string | null;
  providerTts: string | null;
  transferRequested: boolean;
  bargeInTriggered: boolean;
  errorStage: string | null;
  errorMessage: string | null;
  source: string | null;
}

function isBbisTurnEvent(event: CallEventRow): boolean {
  return ['bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript'].includes(event.event_type);
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true';
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseTurnEvent(event: CallEventRow): BbisTurnMetrics {
  const data = event.data || {};

  return {
    eventType: event.event_type,
    timestamp: event.timestamp,
    turnIndex: toNumber(data.turnIndex) || 0,
    actionType: toStringOrNull(data.actionType),
    turnIntent: toStringOrNull(data.turnIntent),
    transcriptText: typeof data.transcriptText === 'string' ? data.transcriptText : '',
    transcriptLength: toNumber(data.transcriptLength) || 0,
    replyText: typeof data.replyText === 'string' ? data.replyText : '',
    replyLength: toNumber(data.replyLength) || 0,
    sttDurationMs: toNumber(data.sttDurationMs),
    llmDurationMs: toNumber(data.llmDurationMs),
    processingDurationMs: toNumber(data.processingDurationMs) ?? toNumber(data.totalDurationMs),
    ttsDurationMs: toNumber(data.ttsDurationMs),
    totalDurationMs: toNumber(data.processingDurationMs) ?? toNumber(data.totalDurationMs),
    audioDurationMs: toNumber(data.audioDurationMs),
    inputAudioMs: toNumber(data.inputAudioMs),
    speechDurationMs: toNumber(data.speechDurationMs),
    silenceDurationMs: toNumber(data.silenceDurationMs),
    sttConfidence: toNumber(data.sttConfidence),
    sttModel: toStringOrNull(data.sttModel),
    llmModel: toStringOrNull(data.llmModel),
    ttsModel: toStringOrNull(data.ttsModel),
    ttsVoice: toStringOrNull(data.ttsVoice),
    providerStt: toStringOrNull(data.providerStt),
    providerLlm: toStringOrNull(data.providerLlm),
    providerTts: toStringOrNull(data.providerTts),
    transferRequested: toBoolean(data.transferRequested),
    bargeInTriggered: toBoolean(data.bargeInTriggered),
    errorStage: toStringOrNull(data.errorStage),
    errorMessage: toStringOrNull(data.errorMessage),
    source: toStringOrNull(data.source),
  };
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (filtered.length === 0) {
    return null;
  }

  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function percentile(values: Array<number | null | undefined>, ratio: number): number | null {
  const filtered = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);

  if (filtered.length === 0) {
    return null;
  }

  const index = Math.min(filtered.length - 1, Math.max(0, Math.ceil(filtered.length * ratio) - 1));
  return filtered[index];
}

function maxValue(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return filtered.length ? Math.max(...filtered) : null;
}

function buildAggregateFromTurns(turns: BbisTurnMetrics[]) {
  const completedTurns = turns.filter((turn) => turn.eventType === 'bbis.turn.completed');
  const failedTurns = turns.filter((turn) => turn.eventType === 'bbis.turn.failed');
  const noTranscriptTurns = turns.filter((turn) => turn.eventType === 'bbis.turn.no_transcript');
  const totalTurns = turns.length;
  const bargeInCount = turns.filter((turn) => turn.bargeInTriggered).length;
  const transferCount = turns.filter((turn) => turn.transferRequested).length;

  return {
    totalTurns,
    completedTurns: completedTurns.length,
    failedTurns: failedTurns.length,
    noTranscriptTurns: noTranscriptTurns.length,
    bargeInCount,
    transferCount,
    avgSttMs: average(turns.map((turn) => turn.sttDurationMs)),
    avgLlmMs: average(turns.map((turn) => turn.llmDurationMs)),
    avgTtsMs: average(turns.map((turn) => turn.ttsDurationMs)),
    avgPlaybackMs: average(turns.map((turn) => turn.audioDurationMs)),
    avgProcessingMs: average(turns.map((turn) => turn.processingDurationMs)),
    avgTotalMs: average(turns.map((turn) => turn.processingDurationMs ?? turn.totalDurationMs)),
    avgInputAudioMs: average(turns.map((turn) => turn.inputAudioMs)),
    avgSpeechMs: average(turns.map((turn) => turn.speechDurationMs)),
    avgSilenceMs: average(turns.map((turn) => turn.silenceDurationMs)),
    avgConfidence: average(turns.map((turn) => turn.sttConfidence !== null ? Math.round(turn.sttConfidence * 100) : null)),
    maxPlaybackMs: maxValue(turns.map((turn) => turn.audioDurationMs)),
    maxProcessingMs: maxValue(turns.map((turn) => turn.processingDurationMs)),
    maxTotalMs: maxValue(turns.map((turn) => turn.processingDurationMs ?? turn.totalDurationMs)),
    p95ProcessingMs: percentile(turns.map((turn) => turn.processingDurationMs), 0.95),
    p95TotalMs: percentile(turns.map((turn) => turn.processingDurationMs ?? turn.totalDurationMs), 0.95),
    errorRate: totalTurns === 0 ? 0 : Number(((failedTurns.length / totalTurns) * 100).toFixed(1)),
    noTranscriptRate: totalTurns === 0 ? 0 : Number(((noTranscriptTurns.length / totalTurns) * 100).toFixed(1)),
    bargeInRate: totalTurns === 0 ? 0 : Number(((bargeInCount / totalTurns) * 100).toFixed(1)),
    transferRate: totalTurns === 0 ? 0 : Number(((transferCount / totalTurns) * 100).toFixed(1)),
  };
}

function normalizeDateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

router.get('/bbis', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 60)));

    const params: any[] = [companyId];
    let whereClause = 'WHERE c.company_id = $1';

    if (from) {
      params.push(from);
      whereClause += ` AND c.created_at >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      whereClause += ` AND c.created_at <= $${params.length}`;
    }

    const callsResult = await query(
      `SELECT DISTINCT c.id, c.caller_number, c.created_at, c.duration, c.status, c.ended_at,
              cs.summary, cs.intent
       FROM calls c
       INNER JOIN call_events ce ON ce.call_id = c.id
       LEFT JOIN call_summaries cs ON cs.call_id = c.id
       ${whereClause}
         AND ce.event_type IN ('bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
       ORDER BY c.created_at DESC`,
      params
    );

    const allCalls = callsResult.rows as MonitoringCallRow[];

    if (allCalls.length === 0) {
      res.json({
        filters: { from, to, limit },
        overview: {
          totalCalls: 0,
          totalTurns: 0,
          avgSttMs: null,
          avgLlmMs: null,
          avgTtsMs: null,
          avgPlaybackMs: null,
          avgProcessingMs: null,
          avgTotalMs: null,
          p95ProcessingMs: null,
          p95TotalMs: null,
          errorRate: 0,
          noTranscriptRate: 0,
          transferRate: 0,
          bargeInRate: 0,
        },
        charts: {
          volumeByDay: [],
          latencyByDay: [],
          stageAverages: [],
        },
        calls: [],
      });
      return;
    }

    const callIds = allCalls.map((call) => call.id);
    const eventsResult = await query(
      `SELECT id, call_id, event_type, data, timestamp
       FROM call_events
       WHERE call_id = ANY($1::uuid[])
         AND event_type IN ('bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
       ORDER BY timestamp ASC`,
      [callIds]
    );

    const eventRows = eventsResult.rows as CallEventRow[];
    const turnsByCall = new Map<string, BbisTurnMetrics[]>();

    for (const event of eventRows) {
      const parsed = parseTurnEvent(event);
      const existing = turnsByCall.get(event.call_id) || [];
      existing.push(parsed);
      turnsByCall.set(event.call_id, existing);
    }

    const callMetrics = allCalls.map((call) => {
      const turns = (turnsByCall.get(call.id) || []).sort((a, b) => a.turnIndex - b.turnIndex || a.timestamp.localeCompare(b.timestamp));
      const aggregate = buildAggregateFromTurns(turns);

      return {
        callId: call.id,
        callerNumber: call.caller_number || 'Numéro inconnu',
        createdAt: call.created_at,
        duration: call.duration || 0,
        endedAt: call.ended_at || null,
        status: call.status,
        summary: call.summary || null,
        intent: call.intent || null,
        ...aggregate,
      };
    });

    const allTurns = callMetrics.flatMap((call) => turnsByCall.get(call.callId) || []);
    const overview = {
      totalCalls: allCalls.length,
      ...buildAggregateFromTurns(allTurns),
    };

    const volumeByDayMap = new Map<string, { date: string; calls: number; turns: number; errors: number }>();
    const latencyByDayMap = new Map<string, { date: string; totalValues: number[]; playbackValues: number[]; sttValues: number[]; llmValues: number[]; ttsValues: number[] }>();

    for (const call of callMetrics) {
      const date = normalizeDateKey(call.createdAt);
      const volumeEntry = volumeByDayMap.get(date) || { date, calls: 0, turns: 0, errors: 0 };
      volumeEntry.calls += 1;
      volumeEntry.turns += call.totalTurns;
      volumeEntry.errors += call.failedTurns;
      volumeByDayMap.set(date, volumeEntry);
    }

    for (const turn of allTurns) {
      const date = normalizeDateKey(turn.timestamp);
      const latencyEntry = latencyByDayMap.get(date) || { date, totalValues: [], playbackValues: [], sttValues: [], llmValues: [], ttsValues: [] };
      if (turn.totalDurationMs !== null) {
        latencyEntry.totalValues.push(turn.totalDurationMs);
      }
      if (turn.audioDurationMs !== null) {
        latencyEntry.playbackValues.push(turn.audioDurationMs);
      }
      if (turn.sttDurationMs !== null) {
        latencyEntry.sttValues.push(turn.sttDurationMs);
      }
      if (turn.llmDurationMs !== null) {
        latencyEntry.llmValues.push(turn.llmDurationMs);
      }
      if (turn.ttsDurationMs !== null) {
        latencyEntry.ttsValues.push(turn.ttsDurationMs);
      }
      latencyByDayMap.set(date, latencyEntry);
    }

    const volumeByDay = Array.from(volumeByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const latencyByDay = Array.from(latencyByDayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        avgTotalMs: average(entry.totalValues),
        avgPlaybackMs: average(entry.playbackValues),
        avgSttMs: average(entry.sttValues),
        avgLlmMs: average(entry.llmValues),
        avgTtsMs: average(entry.ttsValues),
      }));

    const stageAverages = [
      { stage: 'STT', value: overview.avgSttMs },
      { stage: 'LLM', value: overview.avgLlmMs },
      { stage: 'TTS', value: overview.avgTtsMs },
      { stage: 'LATENCE', value: overview.avgProcessingMs },
      { stage: 'PLAYBACK', value: overview.avgPlaybackMs },
    ];

    res.json({
      filters: { from, to, limit },
      overview,
      charts: {
        volumeByDay,
        latencyByDay,
        stageAverages,
      },
      calls: callMetrics.slice(0, limit),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/bbis/calls/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const callResult = await query(
      `SELECT c.id, c.caller_number, c.created_at, c.duration, c.status, c.ended_at,
              t.text AS transcription_text, t.language, t.confidence,
              cs.summary, cs.intent
       FROM calls c
       LEFT JOIN transcriptions t ON t.call_id = c.id
       LEFT JOIN call_summaries cs ON cs.call_id = c.id
       WHERE c.id = $1 AND c.company_id = $2`,
      [id, companyId]
    );

    if (callResult.rows.length === 0) {
      throw new AppError('Call not found', 404);
    }

    const eventsResult = await query(
      `SELECT id, call_id, event_type, data, timestamp
       FROM call_events
       WHERE call_id = $1
       ORDER BY timestamp ASC`,
      [id]
    );

    const events = eventsResult.rows as CallEventRow[];
    const bbisTurns = events
      .filter(isBbisTurnEvent)
      .map(parseTurnEvent)
      .sort((a, b) => a.turnIndex - b.turnIndex || a.timestamp.localeCompare(b.timestamp));

    res.json({
      call: callResult.rows[0],
      metrics: buildAggregateFromTurns(bbisTurns),
      turns: bbisTurns,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        timestamp: event.timestamp,
        data: event.data || {},
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
