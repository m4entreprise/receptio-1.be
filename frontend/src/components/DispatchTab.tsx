import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, X, Trash2, GripVertical, ChevronUp, ChevronDown,
  Clock, Calendar, Globe, Hash, Zap, Users, User, PhoneCall,
  MessageSquare, Voicemail, Info, AlertCircle, Check,
  ArrowRight, RefreshCw, AlignJustify, Shuffle, GitBranch,
} from 'lucide-react';
import DispatchFlowBuilder from './DispatchFlowBuilder';
import type {
  DispatchRule, Condition, ConditionType, Action, ActionType, LeafAction,
  FallbackStep, DistributionStrategy, RetryConfig,
  RouteGroupAction, RouteAgentAction, RouteExternalAction,
  PlayMessageAction, VoicemailAction, ConditionalBranch, RouteConditionalAction,
  ScheduleCondition, HolidayCondition, LanguageCondition,
  CallerNumberCondition, IntentCondition, AgentAvailabilityCondition,
} from '../types/dispatch';
import {
  CONDITION_LABELS, ACTION_LABELS, STRATEGY_LABELS, COUNTRY_LABELS,
  DEFAULT_RETRY, DEFAULT_VOICEMAIL,
  newConditionId, newFallbackId,
  DAYS_FR,
} from '../types/dispatch';

// ─── Types locaux ─────────────────────────────────────────────────────────────

interface StaffGroup {
  id: string; name: string; role?: string | null;
  members: { id: string; first_name: string; last_name: string; role: string; enabled: boolean }[];
}
interface StaffMember {
  id: string; first_name: string; last_name: string; role: string; enabled: boolean;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div className="flex h-[30vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
    </div>
  );
}
function Banner({ msg, type = 'error' }: { msg: string; type?: 'error' | 'info' }) {
  const color = type === 'error' ? '#D94052' : '#344453';
  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm`}
      style={{ borderColor: color + '20', background: color + '06', color }}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

const DAYS_LIST = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;

// ─── Résumé en langage naturel ────────────────────────────────────────────────

function NaturalSummary({
  rule, groups, staff,
}: { rule: Partial<DispatchRule>; groups: StaffGroup[]; staff: StaffMember[] }) {
  const parts: string[] = [];

  if (rule.condition_operator === 'ALWAYS' || !rule.conditions?.length) {
    parts.push('Pour tous les appels');
  } else {
    const op = rule.condition_operator === 'OR' ? 'ou' : 'et';
    const conds = (rule.conditions ?? []).map(c => {
      if (c.type === 'schedule') {
        const days = c.days.map(d => DAYS_FR[d]?.slice(0,3)).join(', ');
        return `${days} de ${c.time_start} à ${c.time_end}`;
      }
      if (c.type === 'holiday') return c.match === 'on_holiday' ? `les jours fériés (${COUNTRY_LABELS[c.country]})` : `hors jours fériés`;
      if (c.type === 'language') return `si langue ${c.languages.join('/')}`;
      if (c.type === 'caller_number') return `si appelant ${c.patterns[0] ?? '?'}`;
      if (c.type === 'intent') return `si détection "${c.intents.slice(0,2).join('", "')}"`;
      if (c.type === 'agent_availability') return c.check === 'any_available' ? 'si agents disponibles' : 'si aucun agent dispo';
      return '';
    }).filter(Boolean);
    parts.push(`Si ${conds.join(` ${op} `)}`);
  }

  if (rule.action) {
    const a = rule.action;
    if (a.type === 'route_group') {
      const grp = groups.find(g => g.id === a.group_id);
      const name = grp ? grp.name : 'le groupe';
      const strat = STRATEGY_LABELS[a.distribution_strategy]?.label?.toLowerCase();
      const max = a.retry.max_attempts;
      parts.push(`→ diriger vers ${name} (${strat}, ${max === 0 ? '∞' : max} essai${max !== 1 ? 's' : ''} de ${a.retry.ring_duration}s)`);
    } else if (a.type === 'route_agent') {
      const s = staff.find(x => x.id === a.agent_id);
      parts.push(`→ appeler ${s ? `${s.first_name} ${s.last_name}` : 'l\'agent'} pendant ${a.ring_duration}s`);
    } else if (a.type === 'route_external') {
      parts.push(`→ transférer vers ${a.label ?? a.phone_number}`);
    } else if (a.type === 'play_message') {
      parts.push(`→ lire un message vocal`);
    } else if (a.type === 'voicemail') {
      parts.push(`→ messagerie vocale`);
    }
  }

  if (rule.fallback_chain?.length) {
    const labels = rule.fallback_chain.map(s => s.label).join(' → ');
    parts.push(`Si échec : ${labels}`);
  }

  return (
    <div className="rounded-[14px] border border-[#344453]/10 bg-[#344453]/4 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/40 mb-1">
        Résumé
      </p>
      <p className="text-xs leading-5 text-[#344453]/75">{parts.join('. ')}.</p>
    </div>
  );
}

// ─── Sous-composants avec état local (éviter les hooks dans des IIFEs) ──────

function CallerNumberEditor({ cond, onChange, inputCls }: {
  cond: CallerNumberCondition;
  onChange: (c: CallerNumberCondition) => void;
  inputCls: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => { if (draft.trim()) { onChange({ ...cond, patterns: [...cond.patterns, draft.trim()] }); setDraft(''); } };
  return (
    <div className="space-y-2">
      <select value={cond.mode} onChange={e => onChange({ ...cond, mode: e.target.value as CallerNumberCondition['mode'] })}
        className={inputCls}>
        <option value="starts_with">Commence par</option>
        <option value="equals">Exact</option>
        <option value="contains">Contient</option>
      </select>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="+32, +33..."
          onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); add(); } }}
          className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add}
          className="rounded-xl border border-[#344453]/12 px-3 py-2 text-sm text-[#344453]/55 hover:bg-[#344453]/5 transition">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cond.patterns.map(p => (
          <span key={p} className="inline-flex items-center gap-1 rounded-full bg-[#344453] px-2.5 py-0.5 text-xs text-white">
            {p}
            <button type="button" onClick={() => onChange({ ...cond, patterns: cond.patterns.filter(x => x !== p) })}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function IntentEditor({ cond, onChange, inputCls }: {
  cond: IntentCondition;
  onChange: (c: IntentCondition) => void;
  inputCls: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const kw = draft.trim().replace(/,+$/, '');
    if (kw) { onChange({ ...cond, intents: [...cond.intents, kw] }); setDraft(''); }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['any','all'] as const).map(m => (
          <button key={m} type="button"
            onClick={() => onChange({ ...cond, match_mode: m })}
            className={`flex-1 rounded-xl border py-2 text-xs font-medium transition ${
              cond.match_mode === m ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/12 text-[#344453]/55 hover:bg-[#344453]/5'
            }`}>
            {m === 'any' ? 'L\'un des mots' : 'Tous les mots'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Ex: urgence, panne, rappel..."
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); add(); } }}
          className={`flex-1 ${inputCls}`} />
        <button type="button" onClick={add}
          className="rounded-xl border border-[#344453]/12 px-3 py-2 text-sm text-[#344453]/55 hover:bg-[#344453]/5 transition">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cond.intents.map(kw => (
          <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-[#E6A817] px-2.5 py-0.5 text-xs text-white">
            {kw}
            <button type="button" onClick={() => onChange({ ...cond, intents: cond.intents.filter(x => x !== kw) })}>
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Éditeur de condition ─────────────────────────────────────────────────────

function ConditionEditor({
  cond, groups, onChange, onRemove,
}: {
  cond: Condition;
  groups: StaffGroup[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const iconClass = 'h-3.5 w-3.5 shrink-0';
  const condIcons: Record<ConditionType, JSX.Element> = {
    always:             <AlignJustify className={iconClass} />,
    schedule:           <Clock className={iconClass} />,
    holiday:            <Calendar className={iconClass} />,
    language:           <Globe className={iconClass} />,
    caller_number:      <Hash className={iconClass} />,
    intent:             <Zap className={iconClass} />,
    agent_availability: <Users className={iconClass} />,
  };

  const changeType = (t: ConditionType) => {
    const base = { id: cond.id };
    const defaults: Record<ConditionType, Condition> = {
      always:             { ...base, type: 'always' },
      schedule:           { ...base, type: 'schedule', days: ['monday','tuesday','wednesday','thursday','friday'], time_start: '09:00', time_end: '18:00' },
      holiday:            { ...base, type: 'holiday', country: 'BE', match: 'not_on_holiday' },
      language:           { ...base, type: 'language', languages: ['fr'] },
      caller_number:      { ...base, type: 'caller_number', mode: 'starts_with', patterns: [] },
      intent:             { ...base, type: 'intent', intents: [], match_mode: 'any' },
      agent_availability: { ...base, type: 'agent_availability', group_id: '', check: 'any_available' },
    };
    onChange(defaults[t]);
  };

  const inputCls = 'block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm text-[#141F28] outline-none focus:border-[#344453]/30 focus:bg-white transition';

  return (
    <div className="rounded-[16px] border border-[#344453]/10 bg-[#F8F9FB] p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {/* Type picker */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Object.keys(CONDITION_LABELS) as ConditionType[]).map(t => (
            <button
              key={t} type="button"
              onClick={() => changeType(t)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                cond.type === t
                  ? 'bg-[#344453] text-white'
                  : 'border border-[#344453]/12 text-[#344453]/55 hover:bg-[#344453]/5'
              }`}
            >
              {condIcons[t]}
              {CONDITION_LABELS[t]}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12 transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Champs spécifiques au type */}
      {cond.type === 'schedule' && (() => {
        const s = cond as ScheduleCondition;
        return (
          <div className="space-y-2.5">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/45">Jours</p>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_LIST.map(d => (
                  <button key={d} type="button"
                    onClick={() => {
                      const days = s.days.includes(d)
                        ? s.days.filter(x => x !== d)
                        : [...s.days, d];
                      onChange({ ...s, days });
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      s.days.includes(d)
                        ? 'bg-[#344453] text-white'
                        : 'border border-[#344453]/15 text-[#344453]/45 hover:bg-[#344453]/5'
                    }`}
                  >
                    {DAYS_FR[d]?.slice(0,1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="time" value={s.time_start}
                onChange={e => onChange({ ...s, time_start: e.target.value })}
                className="flex-1 rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30" />
              <ArrowRight className="h-4 w-4 shrink-0 text-[#344453]/30" />
              <input type="time" value={s.time_end}
                onChange={e => onChange({ ...s, time_end: e.target.value })}
                className="flex-1 rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30" />
            </div>
          </div>
        );
      })()}

      {cond.type === 'holiday' && (() => {
        const h = cond as HolidayCondition;
        return (
          <div className="flex gap-2">
            <select value={h.country} onChange={e => onChange({ ...h, country: e.target.value as HolidayCondition['country'] })}
              className={`flex-1 ${inputCls}`}>
              {Object.entries(COUNTRY_LABELS).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <select value={h.match} onChange={e => onChange({ ...h, match: e.target.value as HolidayCondition['match'] })}
              className={`flex-1 ${inputCls}`}>
              <option value="not_on_holiday">Hors jours fériés</option>
              <option value="on_holiday">Lors des jours fériés</option>
            </select>
          </div>
        );
      })()}

      {cond.type === 'language' && (() => {
        const l = cond as LanguageCondition;
        return (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/45">Langues (codes ISO 639-1)</p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {(['fr','nl','en','de','es','it'] as const).map(lang => (
                <button key={lang} type="button"
                  onClick={() => {
                    const langs = l.languages.includes(lang)
                      ? l.languages.filter(x => x !== lang)
                      : [...l.languages, lang];
                    onChange({ ...l, languages: langs });
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition ${
                    l.languages.includes(lang)
                      ? 'bg-[#344453] text-white'
                      : 'border border-[#344453]/12 text-[#344453]/50 hover:bg-[#344453]/5'
                  }`}
                >{lang}</button>
              ))}
            </div>
          </div>
        );
      })()}

      {cond.type === 'caller_number' && (
        <CallerNumberEditor
          cond={cond as CallerNumberCondition}
          onChange={c => onChange(c)}
          inputCls={inputCls}
        />
      )}

      {cond.type === 'intent' && (
        <IntentEditor
          cond={cond as IntentCondition}
          onChange={c => onChange(c)}
          inputCls={inputCls}
        />
      )}


      {cond.type === 'agent_availability' && (() => {
        const av = cond as AgentAvailabilityCondition;
        return (
          <div className="flex gap-2">
            <select value={av.group_id} onChange={e => onChange({ ...av, group_id: e.target.value })}
              className={`flex-1 ${inputCls}`}>
              <option value="">Sélectionner un groupe…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={av.check} onChange={e => onChange({ ...av, check: e.target.value as AgentAvailabilityCondition['check'] })}
              className={`flex-1 ${inputCls}`}>
              <option value="any_available">Au moins 1 dispo</option>
              <option value="all_unavailable">Tous indisponibles</option>
            </select>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Dispatch conditionnel (branche par branche) ──────────────────────────────

function newBranch(): ConditionalBranch {
  return {
    id: `branch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    label: '',
    condition: { id: newConditionId(), type: 'intent', intents: [], match_mode: 'any' },
    action: { ...DEFAULT_VOICEMAIL },
  };
}

function ConditionalRouteSection({
  action, groups, staff, onChange,
}: {
  action: RouteConditionalAction;
  groups: StaffGroup[];
  staff: StaffMember[];
  onChange: (a: RouteConditionalAction) => void;
}) {
  const updateBranch = (idx: number, branch: ConditionalBranch) => {
    const branches = [...action.branches];
    branches[idx] = branch;
    onChange({ ...action, branches });
  };
  const removeBranch = (idx: number) => {
    onChange({ ...action, branches: action.branches.filter((_, i) => i !== idx) });
  };
  const moveBranch = (idx: number, dir: -1 | 1) => {
    const branches = [...action.branches];
    const ni = idx + dir;
    if (ni < 0 || ni >= branches.length) return;
    [branches[idx], branches[ni]] = [branches[ni], branches[idx]];
    onChange({ ...action, branches });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#C7601D]/20 bg-[#C7601D]/4 px-3 py-2 text-xs text-[#C7601D]/80">
        <strong>Dispatch conditionnel</strong> — les branches sont évaluées dans l'ordre. La première dont la condition est validée est exécutée. Si aucune ne correspond, l'action par défaut est utilisée.
      </div>

      {/* Branches */}
      {action.branches.map((branch, idx) => (
        <div key={branch.id} className="rounded-2xl border border-[#344453]/12 bg-white p-3 space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveBranch(idx, -1)} disabled={idx === 0}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/35 hover:bg-[#344453]/5 disabled:opacity-20 transition">
              <ChevronUp className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => moveBranch(idx, 1)} disabled={idx === action.branches.length - 1}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/35 hover:bg-[#344453]/5 disabled:opacity-20 transition">
              <ChevronDown className="h-3 w-3" />
            </button>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C7601D] text-[9px] font-bold text-white">{idx + 1}</span>
            <input type="text" value={branch.label}
              onChange={e => updateBranch(idx, { ...branch, label: e.target.value })}
              placeholder="Nom de la branche (ex: Département IT)"
              className="flex-1 rounded-xl border border-[#344453]/12 bg-[#F8F9FB] px-2.5 py-1.5 text-xs outline-none focus:border-[#344453]/30 transition" />
            <button type="button" onClick={() => removeBranch(idx)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Condition</p>
            <ConditionEditor cond={branch.condition} groups={groups}
              onChange={c => updateBranch(idx, { ...branch, condition: c })}
              onRemove={() => {}} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Action</p>
            <ActionEditor action={branch.action} groups={groups} staff={staff} allowConditional={false}
              onChange={a => updateBranch(idx, { ...branch, action: a as LeafAction })} />
          </div>
        </div>
      ))}

      <button type="button"
        onClick={() => onChange({ ...action, branches: [...action.branches, newBranch()] })}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#C7601D]/30 py-2 text-xs font-medium text-[#C7601D]/70 hover:bg-[#C7601D]/4 transition">
        <Plus className="h-3.5 w-3.5" /> Ajouter une branche
      </button>

      {/* Action par défaut */}
      <div className="rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
          Action par défaut (aucune branche ne correspond)
        </p>
        <ActionEditor action={action.default_action} groups={groups} staff={staff} allowConditional={false}
          onChange={a => onChange({ ...action, default_action: a as LeafAction })} />
      </div>
    </div>
  );
}

// ─── Éditeur d'action ─────────────────────────────────────────────────────────

function ActionEditor({
  action, groups, staff, label, onChange, allowConditional = true,
}: {
  action: Action;
  groups: StaffGroup[];
  staff: StaffMember[];
  label?: string;
  onChange: (a: Action) => void;
  allowConditional?: boolean;
}) {
  const inputCls = 'block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm text-[#141F28] outline-none focus:border-[#344453]/30 transition';

  const changeType = (t: ActionType) => {
    if (t === 'route_conditional') {
      onChange({ type: 'route_conditional', branches: [newBranch()], default_action: { ...DEFAULT_VOICEMAIL } });
      return;
    }
    const defaults: Record<Exclude<ActionType, 'route_conditional'>, Action> = {
      route_group:    { type: 'route_group', group_id: '', distribution_strategy: 'sequential', agent_order: [], retry: { ...DEFAULT_RETRY } },
      route_agent:    { type: 'route_agent', agent_id: '', ring_duration: 30 },
      route_external: { type: 'route_external', phone_number: '', label: '' },
      play_message:   { type: 'play_message', message_text: '' },
      voicemail:      { ...DEFAULT_VOICEMAIL },
    };
    onChange(defaults[t]);
  };

  const allTypes = Object.keys(ACTION_LABELS) as ActionType[];
  const visibleTypes = allowConditional ? allTypes : allTypes.filter(t => t !== 'route_conditional');

  const iconMap: Record<ActionType, JSX.Element> = {
    route_group:       <Users className="h-3.5 w-3.5" />,
    route_agent:       <User className="h-3.5 w-3.5" />,
    route_external:    <PhoneCall className="h-3.5 w-3.5" />,
    play_message:      <MessageSquare className="h-3.5 w-3.5" />,
    voicemail:         <Voicemail className="h-3.5 w-3.5" />,
    route_conditional: <GitBranch className="h-3.5 w-3.5" />,
  };

  const stratIcons: Record<DistributionStrategy, JSX.Element> = {
    sequential:   <AlignJustify className="h-3 w-3" />,
    simultaneous: <GitBranch className="h-3 w-3" />,
    random:       <Shuffle className="h-3 w-3" />,
    round_robin:  <RefreshCw className="h-3 w-3" />,
  };

  return (
    <div className="space-y-3">
      {label && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#344453]/40">{label}</p>}

      {/* Sélecteur de type */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {visibleTypes.map(t => (
          <button key={t} type="button"
            onClick={() => changeType(t)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition ${
              action.type === t
                ? 'border-[#C7601D] bg-[#C7601D]/8 text-[#C7601D]'
                : 'border-[#344453]/10 text-[#344453]/50 hover:bg-[#344453]/4'
            }`}
          >
            {iconMap[t]}
            <span className="text-[10px] font-medium leading-tight">{ACTION_LABELS[t]}</span>
          </button>
        ))}
      </div>

      {/* Champs spécifiques au type */}
      {action.type === 'route_group' && (() => {
        const a = action as RouteGroupAction;
        const grp = groups.find(g => g.id === a.group_id);
        return (
          <div className="space-y-3">
            <select value={a.group_id} onChange={e => {
              const g = groups.find(x => x.id === e.target.value);
              onChange({ ...a, group_id: e.target.value, agent_order: g?.members.map(m => m.id) ?? [] });
            }} className={inputCls}>
              <option value="">Sélectionner un groupe…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.role ? ` (${g.role})` : ''}</option>)}
            </select>

            {/* Stratégie de distribution */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Stratégie</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {(Object.keys(STRATEGY_LABELS) as DistributionStrategy[]).map(s => (
                  <button key={s} type="button"
                    onClick={() => onChange({ ...a, distribution_strategy: s })}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
                      a.distribution_strategy === s
                        ? 'border-[#344453] bg-[#344453] text-white'
                        : 'border-[#344453]/10 text-[#344453]/55 hover:bg-[#344453]/5'
                    }`}
                  >
                    {stratIcons[s]}
                    {STRATEGY_LABELS[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordre des agents (sequential uniquement) */}
            {a.distribution_strategy === 'sequential' && grp && grp.members.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Ordre d'appel</p>
                <div className="space-y-1.5">
                  {(a.agent_order?.length ? a.agent_order : grp.members.map(m => m.id)).map((agentId, i, arr) => {
                    const m = grp.members.find(x => x.id === agentId);
                    if (!m) return null;
                    const moveAgent = (dir: -1 | 1) => {
                      const newOrder = [...arr];
                      const si = i + dir;
                      if (si < 0 || si >= newOrder.length) return;
                      [newOrder[i], newOrder[si]] = [newOrder[si], newOrder[i]];
                      onChange({ ...a, agent_order: newOrder });
                    };
                    return (
                      <div key={agentId} className="flex items-center gap-2 rounded-xl border border-[#344453]/8 bg-white px-3 py-2">
                        <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#344453]/25" />
                        <span className="w-4 text-xs font-mono text-[#344453]/35">{i + 1}</span>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#344453] text-[9px] font-bold text-white">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <span className="flex-1 text-xs font-medium text-[#141F28]">
                          {m.first_name} {m.last_name}
                        </span>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => moveAgent(-1)} disabled={i === 0}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button type="button" onClick={() => moveAgent(1)} disabled={i === arr.length - 1}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Configuration des tentatives */}
            <RetryEditor retry={a.retry} onChange={r => onChange({ ...a, retry: r })} />
          </div>
        );
      })()}

      {action.type === 'route_agent' && (() => {
        const a = action as RouteAgentAction;
        return (
          <div className="space-y-2">
            <select value={a.agent_id} onChange={e => onChange({ ...a, agent_id: e.target.value })}
              className={inputCls}>
              <option value="">Sélectionner un agent…</option>
              {staff.filter(s => s.enabled).map(s => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>
              ))}
            </select>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[#344453]/55 whitespace-nowrap">Sonnerie</label>
              <input type="range" min={5} max={120} step={5} value={a.ring_duration}
                onChange={e => onChange({ ...a, ring_duration: Number(e.target.value) })}
                className="flex-1 accent-[#C7601D]" />
              <span className="w-12 text-right text-xs font-mono text-[#344453]/65">{a.ring_duration}s</span>
            </div>
          </div>
        );
      })()}

      {action.type === 'route_external' && (() => {
        const a = action as RouteExternalAction;
        return (
          <div className="space-y-2">
            <input type="tel" value={a.phone_number} onChange={e => onChange({ ...a, phone_number: e.target.value })}
              placeholder="+32499000000" className={inputCls} />
            <input type="text" value={a.label ?? ''} onChange={e => onChange({ ...a, label: e.target.value })}
              placeholder="Libellé (ex: Siège social)" className={inputCls} />
          </div>
        );
      })()}

      {action.type === 'play_message' && (() => {
        const a = action as PlayMessageAction;
        return (
          <textarea rows={3} value={a.message_text}
            onChange={e => onChange({ ...a, message_text: e.target.value })}
            placeholder="Ex : Nos bureaux sont fermés. Rappellez-nous du lundi au vendredi de 9h à 18h."
            className="block w-full resize-none rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
        );
      })()}

      {action.type === 'voicemail' && (() => {
        const a = action as VoicemailAction;
        return (
          <textarea rows={2} value={a.greeting_text ?? ''}
            onChange={e => onChange({ ...a, greeting_text: e.target.value })}
            placeholder="Message d'accueil avant le bip (laisser vide pour message par défaut)"
            className="block w-full resize-none rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
        );
      })()}

      {action.type === 'route_conditional' && (
        <ConditionalRouteSection
          action={action as RouteConditionalAction}
          groups={groups}
          staff={staff}
          onChange={a => onChange(a)}
        />
      )}
    </div>
  );
}

// ─── Éditeur de tentatives de sonnerie ───────────────────────────────────────

function RetryEditor({ retry, onChange }: { retry: RetryConfig; onChange: (r: RetryConfig) => void }) {
  return (
    <div className="rounded-[14px] border border-[#344453]/8 bg-[#F8F9FB] p-3 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
        Tentatives de sonnerie
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-[#344453]/50">Essais max</label>
          <div className="flex items-center gap-1.5">
            <input type="number" min={0} max={99} value={retry.max_attempts}
              onChange={e => onChange({ ...retry, max_attempts: Number(e.target.value) })}
              className="w-full rounded-xl border border-[#344453]/12 bg-white px-2.5 py-1.5 text-sm text-center font-mono outline-none focus:border-[#344453]/30 transition" />
          </div>
          <p className="mt-0.5 text-[9px] text-[#344453]/35 text-center">0 = infini</p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-[#344453]/50">Sonnerie (s)</label>
          <input type="number" min={5} max={120} step={5} value={retry.ring_duration}
            onChange={e => onChange({ ...retry, ring_duration: Number(e.target.value) })}
            className="w-full rounded-xl border border-[#344453]/12 bg-white px-2.5 py-1.5 text-sm text-center font-mono outline-none focus:border-[#344453]/30 transition" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-[#344453]/50">Pause (s)</label>
          <input type="number" min={0} max={30} value={retry.between_attempts_delay}
            onChange={e => onChange({ ...retry, between_attempts_delay: Number(e.target.value) })}
            className="w-full rounded-xl border border-[#344453]/12 bg-white px-2.5 py-1.5 text-sm text-center font-mono outline-none focus:border-[#344453]/30 transition" />
        </div>
      </div>
    </div>
  );
}

// ─── Éditeur de la chaîne de fallback ────────────────────────────────────────

function FallbackChainEditor({
  chain, groups, staff, onChange,
}: {
  chain: FallbackStep[];
  groups: StaffGroup[];
  staff: StaffMember[];
  onChange: (chain: FallbackStep[]) => void;
}) {
  const addStep = () => {
    const newStep: FallbackStep = {
      id: newFallbackId(),
      label: 'Messagerie vocale',
      action: { ...DEFAULT_VOICEMAIL },
    };
    onChange([...chain, newStep]);
  };

  const updateStep = (idx: number, step: FallbackStep) => {
    const next = [...chain];
    next[idx] = step;
    onChange(next);
  };

  const removeStep = (idx: number) => {
    onChange(chain.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...chain];
    const si = idx + dir;
    if (si < 0 || si >= next.length) return;
    [next[idx], next[si]] = [next[si], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {chain.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#344453]/15 px-4 py-6 text-center">
          <Voicemail className="mx-auto mb-2 h-8 w-8 text-[#344453]/20" />
          <p className="text-sm font-medium text-[#344453]/50">Aucun fallback configuré</p>
          <p className="text-xs text-[#344453]/35">Si personne ne répond, l'appel se termine sans action</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chain.map((step, i) => (
            <div key={step.id} className="rounded-[16px] border border-[#344453]/10 bg-[#F8F9FB] p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#344453]/10 text-[10px] font-bold text-[#344453]/60">
                  {i + 1}
                </div>
                <input
                  type="text"
                  value={step.label}
                  onChange={e => updateStep(i, { ...step, label: e.target.value })}
                  placeholder="Libellé de cette étape"
                  className="flex-1 rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-xs font-medium text-[#141F28] outline-none focus:border-[#344453]/30 transition"
                />
                <div className="flex gap-1">
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === chain.length - 1}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeStep(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12 transition">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ActionEditor
                action={step.action}
                groups={groups}
                staff={staff}
                onChange={a => updateStep(i, { ...step, action: a })}
              />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addStep}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#344453]/20 py-2.5 text-sm text-[#344453]/50 hover:bg-[#344453]/4 transition">
        <Plus className="h-4 w-4" />
        Ajouter une étape de secours
      </button>
    </div>
  );
}

// ─── Composant principal DispatchTab ──────────────────────────────────────────

export default function DispatchTab() {
  const [rules, setRules]     = useState<DispatchRule[]>([]);
  const [groups, setGroups]   = useState<StaffGroup[]>([]);
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Drawer
  const [showDrawer, setShowDrawer]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState('');
  const [drawerTab, setDrawerTab]       = useState<'conditions' | 'action' | 'fallback'>('conditions');

  // Formulaire
  const [name, setName]                               = useState('');
  const [description, setDescription]                 = useState('');
  const [condOp, setCondOp]                           = useState<DispatchRule['condition_operator']>('ALWAYS');
  const [conditions, setConditions]                   = useState<Condition[]>([]);
  const [action, setAction]                           = useState<Action>({ type: 'route_group', group_id: '', distribution_strategy: 'sequential', agent_order: [], retry: { ...DEFAULT_RETRY } });
  const [fallbackChain, setFallbackChain]             = useState<FallbackStep[]>([]);

  // ─── API ───────────────────────────────────────────────────────────────────
  const fetchRules  = useCallback(async () => { const r = await axios.get('/api/dispatch-rules'); setRules(r.data.rules ?? []); }, []);
  const fetchGroups = useCallback(async () => { const r = await axios.get('/api/staff-groups'); setGroups(r.data.groups ?? []); }, []);
  const fetchStaff  = useCallback(async () => { const r = await axios.get('/api/staff'); setStaff(r.data.staff ?? []); }, []);

  useEffect(() => {
    Promise.all([fetchRules(), fetchGroups(), fetchStaff()]).finally(() => setLoading(false));
  }, [fetchRules, fetchGroups, fetchStaff]);

  // ─── Drawer helpers ───────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setName(''); setDescription('');
    setCondOp('ALWAYS'); setConditions([]);
    setAction({ type: 'route_group', group_id: '', distribution_strategy: 'sequential', agent_order: [], retry: { ...DEFAULT_RETRY } });
    setFallbackChain([]);
    setSaveError(''); setDrawerTab('conditions');
    setShowDrawer(true);
  };

  const openEdit = (rule: DispatchRule) => {
    setEditingId(rule.id);
    setName(rule.name);
    setDescription(rule.description ?? '');
    setCondOp(rule.condition_operator);
    setConditions(rule.conditions ?? []);
    setAction(rule.action);
    setFallbackChain(rule.fallback_chain ?? []);
    setSaveError(''); setDrawerTab('conditions');
    setShowDrawer(true);
  };

  const closeDrawer = () => { setShowDrawer(false); setSaveError(''); };

  // ─── Sauvegarde ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { setSaveError('Le nom est obligatoire.'); setDrawerTab('conditions'); return; }
    setSaving(true); setSaveError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        condition_operator: condOp,
        conditions,
        action,
        fallback_chain: fallbackChain,
      };
      if (editingId) await axios.patch(`/api/dispatch-rules/${editingId}`, payload);
      else await axios.post('/api/dispatch-rules', payload);
      closeDrawer(); await fetchRules();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setSaveError(e?.response?.data?.error ?? 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  // ─── Suppression ──────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette règle de dispatch ?')) return;
    try { await axios.delete(`/api/dispatch-rules/${id}`); await fetchRules(); }
    catch { setError('Erreur lors de la suppression.'); }
  };

  // ─── Activation / désactivation ───────────────────────────────────────────
  const handleToggle = async (rule: DispatchRule) => {
    try {
      await axios.patch(`/api/dispatch-rules/${rule.id}`, { enabled: !rule.enabled });
      await fetchRules();
    } catch { setError('Erreur lors de la mise à jour.'); }
  };

  // ─── Réordonnancement ─────────────────────────────────────────────────────
  const handleReorder = async (id: string, dir: -1 | 1) => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(r => r.id === id);
    const ni = idx + dir;
    if (ni < 0 || ni >= sorted.length) return;
    const newOrder = [...sorted];
    [newOrder[idx], newOrder[ni]] = [newOrder[ni], newOrder[idx]];
    try {
      await axios.post('/api/dispatch-rules/reorder', { order: newOrder.map(r => r.id) });
      await fetchRules();
    } catch { setError('Erreur lors du réordonnancement.'); }
  };

  // ─── Mise à jour positions ────────────────────────────────────────────────
  const handleUpdatePositions = async (
    updates: { id: string; node_positions: Record<string, { x: number; y: number }> }[]
  ) => {
    try {
      await Promise.all(
        updates.map(({ id, node_positions }) =>
          axios.patch(`/api/dispatch-rules/${id}`, { node_positions })
        )
      );
    } catch { /* silencieux */ }
  };

  // ─── Gestion des conditions ───────────────────────────────────────────────
  const addCondition = () => {
    const cond: Condition = { id: newConditionId(), type: 'schedule', days: ['monday','tuesday','wednesday','thursday','friday'], time_start: '09:00', time_end: '18:00' };
    setConditions(prev => [...prev, cond]);
  };
  const updateCondition = (idx: number, c: Condition) => setConditions(prev => prev.map((x, i) => i === idx ? c : x));
  const removeCondition = (idx: number) => setConditions(prev => prev.filter((_, i) => i !== idx));

  // ─── Rendu ────────────────────────────────────────────────────────────────
  if (loading) return <Loader />;

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#344453]/55">
          {rules.length} règle{rules.length !== 1 ? 's' : ''} · {rules.filter(r => r.enabled).length} active{rules.filter(r => r.enabled).length !== 1 ? 's' : ''}
        </p>
        <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519]">
          <Plus className="h-4 w-4" /> Nouvelle règle
        </button>
      </div>

      {/* Bandeau d'info */}
      <div className="flex items-start gap-3 rounded-[16px] border border-[#344453]/10 bg-[#344453]/4 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]/45" />
        <p className="text-xs leading-5 text-[#344453]/60">
          Les règles sont évaluées dans l'ordre de priorité. La première règle dont les conditions sont remplies est appliquée.
          Si l'action échoue (aucun agent disponible), la chaîne de fallback est parcourue dans l'ordre.
        </p>
      </div>

      {error && <Banner msg={error} />}

      {/* Liste des règles (priorité) */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((rule, i) => (
            <div key={rule.id}
              className="flex items-center gap-3 rounded-2xl border border-[#344453]/10 bg-white px-4 py-3 transition hover:border-[#344453]/20"
              style={{ opacity: rule.enabled ? 1 : 0.55 }}
            >
              {/* Priorité + réordonnancement */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <button onClick={() => handleReorder(rule.id, -1)} disabled={i === 0}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/35 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <span className="text-[11px] font-bold text-[#344453]/40 font-mono">{rule.priority + 1}</span>
                <button onClick={() => handleReorder(rule.id, 1)} disabled={i === sorted.length - 1}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#344453]/10 text-[#344453]/35 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Info principale */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#141F28]">{rule.name}</p>
                  <span className="shrink-0 text-[10px] font-medium text-[#344453]/40 uppercase tracking-wider">
                    {rule.condition_operator === 'ALWAYS' ? 'Toujours' : `${rule.conditions.length} cond.`}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[#344453]/50">
                  {rule.action.type === 'route_group' && (() => {
                    const g = groups.find(x => x.id === (rule.action as any).group_id);
                    return g ? `→ ${g.name}` : '→ Groupe non trouvé';
                  })()}
                  {rule.action.type === 'route_agent' && (() => {
                    const s = staff.find(x => x.id === (rule.action as any).agent_id);
                    return s ? `→ ${s.first_name} ${s.last_name}` : '→ Agent non trouvé';
                  })()}
                  {rule.action.type === 'route_external' && `→ ${(rule.action as any).phone_number}`}
                  {rule.action.type === 'play_message' && '→ Message vocal'}
                  {rule.action.type === 'voicemail' && '→ Messagerie vocale'}
                  {rule.fallback_chain.length > 0 && ` · ${rule.fallback_chain.length} fallback${rule.fallback_chain.length > 1 ? 's' : ''}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(rule)}
                  className={`flex h-5 w-9 items-center rounded-full border transition ${
                    rule.enabled
                      ? 'border-[#2D9D78]/30 bg-[#2D9D78] justify-end pr-0.5'
                      : 'border-[#344453]/15 bg-[#344453]/10 justify-start pl-0.5'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full bg-white shadow" />
                </button>
                <button onClick={() => openEdit(rule)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453]/55 hover:bg-[#344453]/5 transition">
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(rule.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12 transition">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Canvas React Flow */}
      <DispatchFlowBuilder
        rules={rules}
        groups={groups}
        staff={staff}
        onRuleClick={openEdit}
        onCreateRule={openCreate}
        onDeleteRule={handleDelete}
        onUpdatePositions={handleUpdatePositions}
      />

      {/* ─── Drawer d'édition ─────────────────────────────────────────────── */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="relative ml-auto flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">

            {/* Header du drawer */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#344453]/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-[-0.03em] text-[#141F28]"
                  style={{ fontFamily: 'var(--font-title)' }}>
                  {editingId ? 'Modifier la règle' : 'Nouvelle règle de dispatch'}
                </h2>
                {editingId && <p className="text-xs text-[#344453]/45 mt-0.5">{name}</p>}
              </div>
              <button onClick={closeDrawer}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Corps du drawer */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-5">

                {saveError && <Banner msg={saveError} />}

                {/* Nom */}
                <div>
                  <label className="block text-sm font-medium text-[#344453] mb-1.5">
                    Nom de la règle <span className="text-[#D94052]">*</span>
                  </label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ex : Heures d'ouverture, Service urgences…"
                    className="block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none focus:border-[#344453]/25 focus:bg-white transition"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#344453] mb-1.5">
                    Description <span className="text-[#344453]/40 text-xs">(optionnel)</span>
                  </label>
                  <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                    className="block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none focus:border-[#344453]/25 focus:bg-white transition" />
                </div>

                {/* Résumé en langage naturel */}
                <NaturalSummary
                  rule={{ condition_operator: condOp, conditions, action, fallback_chain: fallbackChain }}
                  groups={groups}
                  staff={staff}
                />

                {/* Onglets */}
                <div className="flex gap-1 rounded-2xl border border-[#344453]/10 bg-[#F8F9FB] p-1">
                  {([
                    { key: 'conditions', label: 'Conditions', count: condOp === 'ALWAYS' ? null : conditions.length },
                    { key: 'action',     label: 'Action',     count: null },
                    { key: 'fallback',   label: 'Si échec',   count: fallbackChain.length || null },
                  ] as const).map(({ key, label, count }) => (
                    <button key={key} type="button"
                      onClick={() => setDrawerTab(key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition ${
                        drawerTab === key
                          ? 'bg-white text-[#141F28] shadow-sm'
                          : 'text-[#344453]/50 hover:text-[#344453]/75'
                      }`}
                    >
                      {label}
                      {count !== null && count > 0 && (
                        <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                          drawerTab === key ? 'bg-[#C7601D] text-white' : 'bg-[#344453]/12 text-[#344453]/55'
                        }`}>{count}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* ──── Tab : Conditions ──────────────────────────────────── */}
                {drawerTab === 'conditions' && (
                  <div className="space-y-4">
                    {/* Opérateur */}
                    <div>
                      <p className="mb-2 text-sm font-medium text-[#344453]">Déclenchement</p>
                      <div className="flex gap-2">
                        {([
                          { val: 'ALWAYS', label: 'Toujours', desc: 'Pas de filtre' },
                          { val: 'AND',    label: 'Toutes les conditions', desc: 'ET logique' },
                          { val: 'OR',     label: 'L\'une des conditions', desc: 'OU logique' },
                        ] as const).map(({ val, label, desc }) => (
                          <button key={val} type="button"
                            onClick={() => setCondOp(val)}
                            className={`flex-1 rounded-2xl border py-3 px-2 text-center transition ${
                              condOp === val
                                ? 'border-[#344453] bg-[#344453] text-white'
                                : 'border-[#344453]/12 text-[#344453]/55 hover:bg-[#344453]/4'
                            }`}
                          >
                            <p className="text-xs font-semibold">{label}</p>
                            <p className="mt-0.5 text-[10px] opacity-60">{desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Liste de conditions */}
                    {condOp !== 'ALWAYS' && (
                      <div className="space-y-2">
                        {conditions.map((cond, i) => (
                          <ConditionEditor
                            key={cond.id}
                            cond={cond}
                            groups={groups}
                            onChange={c => updateCondition(i, c)}
                            onRemove={() => removeCondition(i)}
                          />
                        ))}
                        <button type="button" onClick={addCondition}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#344453]/20 py-2.5 text-sm text-[#344453]/50 hover:bg-[#344453]/4 transition">
                          <Plus className="h-4 w-4" />
                          Ajouter une condition
                        </button>
                      </div>
                    )}

                    {condOp === 'ALWAYS' && (
                      <div className="rounded-2xl border border-dashed border-[#2D9D78]/30 bg-[#2D9D78]/4 px-4 py-4 text-center">
                        <Check className="mx-auto mb-2 h-6 w-6 text-[#2D9D78]/60" />
                        <p className="text-sm font-medium text-[#2D9D78]/80">Cette règle s'applique à tous les appels</p>
                        <p className="text-xs text-[#2D9D78]/55 mt-0.5">Idéale comme règle par défaut (priorité basse)</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ──── Tab : Action ──────────────────────────────────────── */}
                {drawerTab === 'action' && (
                  <ActionEditor
                    action={action}
                    groups={groups}
                    staff={staff}
                    label="Que faire quand les conditions sont remplies ?"
                    onChange={setAction}
                  />
                )}

                {/* ──── Tab : Fallback ────────────────────────────────────── */}
                {drawerTab === 'fallback' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 rounded-[14px] border border-[#E6A817]/25 bg-[#E6A817]/6 px-3 py-2.5">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E6A817]" />
                      <p className="text-xs text-[#E6A817]/90 leading-5">
                        Si l'action principale échoue (agent indisponible, groupe hors horaire), ces étapes sont essayées dans l'ordre.
                      </p>
                    </div>
                    <FallbackChainEditor
                      chain={fallbackChain}
                      groups={groups}
                      staff={staff}
                      onChange={setFallbackChain}
                    />
                  </div>
                )}

              </div>
            </div>

            {/* Footer du drawer */}
            <div className="shrink-0 border-t border-[#344453]/10 p-6">
              <div className="flex gap-3">
                <button type="button" onClick={closeDrawer}
                  className="flex-1 rounded-2xl border border-[#344453]/15 py-3 text-sm font-medium text-[#344453]/65 hover:bg-[#344453]/4 transition">
                  Annuler
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 rounded-2xl bg-[#C7601D] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519] disabled:opacity-60">
                  {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer la règle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
