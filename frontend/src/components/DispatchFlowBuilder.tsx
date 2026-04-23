import { useState, useCallback, useRef, createContext, useContext } from 'react';
import ReactFlow, {
  Node, Edge, Controls, Background, BackgroundVariant,
  useNodesState, useEdgesState, addEdge, Connection,
  MarkerType, NodeProps, Handle, Position, Panel,
  MiniMap, useReactFlow, ReactFlowProvider, NodeChange,
  EdgeProps, getBezierPath, EdgeLabelRenderer,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Phone, Clock, Calendar, Globe, Hash, Zap, Users, User,
  PhoneCall, MessageSquare, Voicemail, GitBranch, RefreshCw,
  Shuffle, AlignJustify, X, Trash2, Check, ArrowRight,
  Plus, ChevronUp, ChevronDown, GripVertical,
} from 'lucide-react';
import type {
  Condition, ConditionType, LeafAction, ActionType,
  FlowNodeData_Condition, FlowNodeData_Action, FlowNodeData_End,
  DistributionStrategy, RetryConfig,
  RouteGroupAction, RouteAgentAction, RouteExternalAction,
  PlayMessageAction, VoicemailAction,
  ScheduleCondition, HolidayCondition, LanguageCondition,
  CallerNumberCondition, IntentCondition, AgentAvailabilityCondition,
} from '../types/dispatch';
import {
  CONDITION_LABELS, ACTION_LABELS, STRATEGY_LABELS, COUNTRY_LABELS,
  DAYS_FR, DAYS_SHORT, DEFAULT_RETRY, DEFAULT_VOICEMAIL,
  newConditionId, newNodeId, DEFAULT_CONDITIONS,
} from '../types/dispatch';

// ─── Contexte partagé (évite d'injecter groups/staff dans chaque nœud) ───────

const FlowContext = createContext<{ groups: StaffGroup[]; staff: StaffMember[] }>({
  groups: [], staff: [],
});

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StaffGroup {
  id: string; name: string; role?: string | null;
  members: { id: string; first_name: string; last_name: string; role: string; enabled: boolean }[];
}
export interface StaffMember {
  id: string; first_name: string; last_name: string; role: string; enabled: boolean;
}

interface Props {
  groups: StaffGroup[];
  staff: StaffMember[];
  nodes: Node[];
  edges: Edge[];
  onSave: (nodes: Node[], edges: Edge[]) => Promise<void>;
  saving?: boolean;
}

// ─── Couleurs ─────────────────────────────────────────────────────────────────

const C = {
  navy:   '#141F28',
  orange: '#C7601D',
  green:  '#16A34A',
  red:    '#DC2626',
  grey:   '#64748B',
  border: 'rgba(52,68,83,0.12)',
  bg:     '#F8F9FB',
};

// ─── Icônes ───────────────────────────────────────────────────────────────────

function CondIcon({ type }: { type: ConditionType }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'always':             return <ArrowRight className={cls} />;
    case 'schedule':           return <Clock className={cls} />;
    case 'holiday':            return <Calendar className={cls} />;
    case 'language':           return <Globe className={cls} />;
    case 'caller_number':      return <Hash className={cls} />;
    case 'intent':             return <Zap className={cls} />;
    case 'agent_availability': return <Users className={cls} />;
  }
}

function ActionIcon({ type }: { type: LeafAction['type'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0';
  switch (type) {
    case 'route_group':    return <Users className={cls} />;
    case 'route_agent':    return <User className={cls} />;
    case 'route_external': return <PhoneCall className={cls} />;
    case 'play_message':   return <MessageSquare className={cls} />;
    case 'voicemail':      return <Voicemail className={cls} />;
  }
}

function StratIcon({ strategy }: { strategy: DistributionStrategy }) {
  const cls = 'h-3 w-3';
  switch (strategy) {
    case 'sequential':   return <AlignJustify className={cls} />;
    case 'simultaneous': return <GitBranch className={cls} />;
    case 'random':       return <Shuffle className={cls} />;
    case 'round_robin':  return <RefreshCw className={cls} />;
  }
}

// ─── Résumés ──────────────────────────────────────────────────────────────────

function condSummary(cond: Condition): string {
  switch (cond.type) {
    case 'always': return 'Toujours actif';
    case 'schedule': {
      const days = cond.days.map(d => DAYS_SHORT[d] ?? d).join(' ');
      return `${days} · ${cond.time_start}–${cond.time_end}`;
    }
    case 'holiday':
      return cond.match === 'on_holiday'
        ? `Jour férié (${COUNTRY_LABELS[cond.country] ?? cond.country})`
        : `Hors jours fériés (${COUNTRY_LABELS[cond.country] ?? cond.country})`;
    case 'language': return `Langue : ${cond.languages.join(', ').toUpperCase()}`;
    case 'caller_number': return `N° : ${cond.patterns.slice(0,2).join(', ')}${cond.patterns.length > 2 ? '…' : ''}`;
    case 'intent': return `IA : ${cond.intents.slice(0,3).join(', ')}${cond.intents.length > 3 ? '…' : ''}`;
    case 'agent_availability': return cond.check === 'any_available' ? 'Si agents dispo' : 'Si aucun dispo';
  }
}

function actionSummary(action: LeafAction, groups: StaffGroup[], staff: StaffMember[]): string {
  switch (action.type) {
    case 'route_group': {
      const g = groups.find(x => x.id === action.group_id);
      const strat = STRATEGY_LABELS[action.distribution_strategy]?.label ?? '';
      return g ? `${g.name} · ${strat}` : 'Groupe non défini';
    }
    case 'route_agent': {
      const s = staff.find(x => x.id === action.agent_id);
      return s ? `${s.first_name} ${s.last_name}` : 'Agent non défini';
    }
    case 'route_external': return action.label || action.phone_number || '—';
    case 'play_message':   return `"${action.message_text.slice(0, 35)}${action.message_text.length > 35 ? '…' : ''}"`;
    case 'voicemail':      return 'Messagerie vocale';
  }
}

// ─── Nœud : Entrée ───────────────────────────────────────────────────────────

function EntryNode() {
  return (
    <div style={{ background: C.navy, borderRadius: 20 }}
      className="flex items-center gap-3 px-5 py-3.5 shadow-lg select-none">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <Phone className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50">Entrée</p>
        <p className="text-sm font-bold text-white">Appel entrant</p>
      </div>
      <Handle type="source" id="out" position={Position.Bottom}
        style={{ background: C.navy, border: '2px solid white', width: 10, height: 10 }} />
    </div>
  );
}

// ─── Nœud : Condition ─────────────────────────────────────────────────────────

function ConditionNode({ data, selected }: NodeProps<FlowNodeData_Condition>) {
  const { condition, label } = data;
  return (
    <div style={{
      width: 260,
      background: 'white',
      borderRadius: 16,
      border: `2px solid ${selected ? C.orange : C.border}`,
      boxShadow: selected
        ? `0 0 0 3px ${C.orange}25, 0 4px 20px rgba(52,68,83,0.12)`
        : '0 2px 12px rgba(52,68,83,0.08)',
    }}>
      {/* Bande colorée gauche */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background: C.orange, borderRadius:'16px 0 0 16px' }} />

      <Handle type="target" id="in" position={Position.Top}
        style={{ background: C.grey, border: '2px solid white', width: 10, height: 10 }} />

      <div className="px-4 py-3" style={{ paddingLeft: 20 }}>
        {/* Badge type */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: C.orange + '15', color: C.orange }}>
            <CondIcon type={condition.type} />
            {CONDITION_LABELS[condition.type]}
          </span>
        </div>
        {/* Libellé */}
        <p className="text-xs font-semibold text-[#141F28] leading-tight">
          {label || CONDITION_LABELS[condition.type]}
        </p>
        {/* Résumé */}
        <p className="mt-0.5 text-[10px] text-[#344453]/55 leading-tight">
          {condSummary(condition)}
        </p>
      </div>

      {/* Handles YES / NO */}
      <div className="flex justify-between px-4 pb-2.5" style={{ paddingLeft: 20 }}>
        <span className="text-[9px] font-bold text-green-600">OUI</span>
        <span className="text-[9px] font-bold text-red-500">NON</span>
      </div>

      <Handle type="source" id="yes" position={Position.Bottom}
        style={{ left: '28%', background: C.green, border: '2px solid white', width: 10, height: 10 }} />
      <Handle type="source" id="no" position={Position.Bottom}
        style={{ left: '72%', background: C.red, border: '2px solid white', width: 10, height: 10 }} />
    </div>
  );
}

// ─── Nœud : Action ───────────────────────────────────────────────────────────

function ActionNode({ data, selected }: NodeProps<FlowNodeData_Action>) {
  const { groups, staff } = useContext(FlowContext);
  const { action, label } = data;
  return (
    <div style={{
      width: 260,
      background: 'white',
      borderRadius: 16,
      border: `2px solid ${selected ? C.navy : C.border}`,
      boxShadow: selected
        ? `0 0 0 3px ${C.navy}20, 0 4px 20px rgba(52,68,83,0.12)`
        : '0 2px 12px rgba(52,68,83,0.08)',
    }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background: C.navy, borderRadius:'16px 0 0 16px' }} />

      <Handle type="target" id="in" position={Position.Top}
        style={{ background: C.grey, border: '2px solid white', width: 10, height: 10 }} />

      <div className="px-4 py-3" style={{ paddingLeft: 20 }}>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: C.navy + '12', color: C.navy }}>
            <ActionIcon type={action.type} />
            {ACTION_LABELS[action.type]}
          </span>
          {action.type === 'route_group' && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px]"
              style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.grey }}>
              <StratIcon strategy={action.distribution_strategy} />
              {STRATEGY_LABELS[action.distribution_strategy]?.label}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-[#141F28]">
          {label || ACTION_LABELS[action.type]}
        </p>
        <p className="mt-0.5 text-[10px] text-[#344453]/55">
          {actionSummary(action, groups, staff)}
        </p>
        {action.type === 'route_group' && (
          <p className="mt-0.5 text-[9px] text-[#344453]/40">
            {action.retry.max_attempts === 0 ? '∞' : action.retry.max_attempts} essai{action.retry.max_attempts !== 1 ? 's' : ''} · {action.retry.ring_duration}s
          </p>
        )}
      </div>

      <div className="px-4 pb-2.5 text-center" style={{ paddingLeft: 20 }}>
        <span className="text-[9px] font-bold text-[#344453]/35">SI ÉCHEC →</span>
      </div>

      <Handle type="source" id="out" position={Position.Bottom}
        style={{ background: C.grey, border: '2px solid white', width: 10, height: 10 }} />
    </div>
  );
}

// ─── Nœud : Fin de flux ───────────────────────────────────────────────────────

function EndNode({ data }: NodeProps<FlowNodeData_End>) {
  return (
    <div style={{
      borderRadius: 14, border: `2px dashed ${C.red}50`,
      background: C.red + '06', padding: '10px 18px', minWidth: 160,
    }} className="flex items-center gap-2.5">
      <Handle type="target" id="in" position={Position.Top}
        style={{ background: C.red, border: '2px solid white' }} />
      <Voicemail className="h-4 w-4 shrink-0" style={{ color: C.red }} />
      <div>
        <p className="text-[10px] font-semibold text-[#344453]/50">Fin de flux</p>
        <p className="text-xs font-medium text-[#344453]/70">{data.label || 'Aucune correspondance'}</p>
      </div>
    </div>
  );
}

// ─── Arête supprimable ────────────────────────────────────────────────────────

function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, label,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const stroke = (style as React.CSSProperties & { stroke?: string })?.stroke ?? '#94A3B8';

  return (
    <>
      <path id={id} d={edgePath} style={style}
        className="react-flow__edge-path" markerEnd={markerEnd as string} />
      {/* Zone de clic large invisible pour faciliter la sélection */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={12} className="react-flow__edge-interaction" />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          className="nodrag nopan"
        >
          {/* Label Oui / Non / Sinon */}
          {label && (
            <span style={{
              background: stroke,
              color: 'white',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              lineHeight: 1.4,
              userSelect: 'none',
            }}>
              {label as string}
            </span>
          )}

          {/* Bouton supprimer */}
          <button
            type="button"
            onClick={() => setEdges(es => es.filter(e => e.id !== id))}
            title="Supprimer cette connexion"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `1.5px solid ${stroke}`,
              background: 'white',
              color: stroke,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = stroke;
              (e.currentTarget as HTMLButtonElement).style.color = 'white';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'white';
              (e.currentTarget as HTMLButtonElement).style.color = stroke;
            }}
          >
            <X style={{ width: 9, height: 9, strokeWidth: 3 }} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { default: DeletableEdge };

const nodeTypes = {
  entry:     EntryNode,
  condition: ConditionNode,
  action:    ActionNode,
  end:       EndNode,
};

// ─── Palette gauche ───────────────────────────────────────────────────────────

const COND_PALETTE: { type: ConditionType; icon: JSX.Element; desc: string }[] = [
  { type: 'always',             icon: <ArrowRight className="h-3.5 w-3.5" />, desc: 'Toujours vrai' },
  { type: 'schedule',           icon: <Clock className="h-3.5 w-3.5" />,      desc: 'Plage horaire' },
  { type: 'holiday',            icon: <Calendar className="h-3.5 w-3.5" />,   desc: 'Jours fériés' },
  { type: 'language',           icon: <Globe className="h-3.5 w-3.5" />,      desc: 'Langue appelant' },
  { type: 'caller_number',      icon: <Hash className="h-3.5 w-3.5" />,       desc: 'Numéro appelant' },
  { type: 'intent',             icon: <Zap className="h-3.5 w-3.5" />,        desc: 'Intention IA' },
  { type: 'agent_availability', icon: <Users className="h-3.5 w-3.5" />,      desc: 'Dispo équipe' },
];

const ACTION_PALETTE: { type: ActionType; icon: JSX.Element; desc: string }[] = [
  { type: 'route_group',    icon: <Users className="h-3.5 w-3.5" />,       desc: 'Groupe d\'agents' },
  { type: 'route_agent',    icon: <User className="h-3.5 w-3.5" />,        desc: 'Agent direct' },
  { type: 'route_external', icon: <PhoneCall className="h-3.5 w-3.5" />,   desc: 'Numéro externe' },
  { type: 'play_message',   icon: <MessageSquare className="h-3.5 w-3.5" />, desc: 'Lire un message' },
  { type: 'voicemail',      icon: <Voicemail className="h-3.5 w-3.5" />,   desc: 'Messagerie' },
];

function PaletteItem({ nodeType, subType, icon, label, desc }: {
  nodeType: string; subType: string; icon: JSX.Element; label: string; desc: string;
}) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('nodeType', nodeType);
    e.dataTransfer.setData('subType', subType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const bg   = nodeType === 'condition' ? C.orange + '10' : nodeType === 'action' ? C.navy + '08' : C.red + '08';
  const col  = nodeType === 'condition' ? C.orange : nodeType === 'action' ? C.navy : C.red;
  const bord = nodeType === 'condition' ? C.orange + '30' : nodeType === 'action' ? C.navy + '20' : C.red + '25';

  return (
    <div draggable onDragStart={onDragStart} title={desc}
      className="flex cursor-grab items-center gap-2 rounded-xl px-2.5 py-2 transition active:cursor-grabbing hover:brightness-95"
      style={{ background: bg, border: `1px solid ${bord}`, color: col }}>
      {icon}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold leading-tight" style={{ color: col }}>{label}</p>
        <p className="truncate text-[9px] leading-tight" style={{ color: col + 'AA' }}>{desc}</p>
      </div>
    </div>
  );
}

function NodePalette() {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-[#344453]/8 bg-[#F8F9FB] p-3"
      style={{ height: '100%' }}>
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#344453]/40">Conditions</p>
      {COND_PALETTE.map(item => (
        <PaletteItem key={item.type} nodeType="condition" subType={item.type}
          icon={item.icon} label={CONDITION_LABELS[item.type]} desc={item.desc} />
      ))}

      <div className="my-1 border-t border-[#344453]/8" />
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#344453]/40">Actions</p>
      {ACTION_PALETTE.map(item => (
        <PaletteItem key={item.type} nodeType="action" subType={item.type}
          icon={item.icon} label={ACTION_LABELS[item.type]} desc={item.desc} />
      ))}

      <div className="my-1 border-t border-[#344453]/8" />
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#344453]/40">Terminaison</p>
      <PaletteItem nodeType="end" subType="end"
        icon={<Voicemail className="h-3.5 w-3.5" />} label="Fin de flux" desc="Aucune correspondance" />

      <div className="mt-auto pt-3 text-[9px] leading-relaxed text-[#344453]/35">
        <p className="font-semibold mb-1">Comment utiliser :</p>
        <p>1. Glissez un nœud sur le canvas</p>
        <p>2. Connectez les poignées</p>
        <p>3. Cliquez pour configurer</p>
        <p className="mt-1 text-green-600 font-medium">● OUI (vert)</p>
        <p className="text-red-500 font-medium">● NON (rouge)</p>
        <p className="text-slate-400 font-medium">● SI ÉCHEC (gris)</p>
      </div>
    </div>
  );
}

// ─── Panneau éditeur de nœud (droite) ────────────────────────────────────────

function DAYS_LIST_CONST() {
  return ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
}

function ConditionForm({ condition, groups, onChange }: {
  condition: Condition; groups: StaffGroup[]; onChange: (c: Condition) => void;
}) {
  const inputCls = 'block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition';
  const days = DAYS_LIST_CONST();

  const changeType = (t: ConditionType) => {
    const base = { ...DEFAULT_CONDITIONS[t], id: newConditionId() };
    onChange(base);
  };

  return (
    <div className="space-y-3">
      {/* Sélecteur de type */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(CONDITION_LABELS) as ConditionType[]).map(t => (
          <button key={t} type="button" onClick={() => changeType(t)}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium transition ${
              condition.type === t
                ? 'border-[#C7601D] bg-[#C7601D]/8 text-[#C7601D]'
                : 'border-[#344453]/10 text-[#344453]/50 hover:bg-[#344453]/4'
            }`}>
            <CondIcon type={t} />
            {CONDITION_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Champs par type */}
      {condition.type === 'schedule' && (() => {
        const c = condition as ScheduleCondition;
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {days.map(d => (
                <button key={d} type="button"
                  onClick={() => onChange({ ...c, days: c.days.includes(d) ? c.days.filter(x => x !== d) : [...c.days, d] })}
                  className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition ${
                    c.days.includes(d) ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/15 text-[#344453]/50'
                  }`}>
                  {DAYS_FR[d]?.slice(0,2)}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="time" value={c.time_start} onChange={e => onChange({ ...c, time_start: e.target.value })} className={inputCls} />
              <span className="self-center text-[#344453]/30">→</span>
              <input type="time" value={c.time_end} onChange={e => onChange({ ...c, time_end: e.target.value })} className={inputCls} />
            </div>
          </div>
        );
      })()}

      {condition.type === 'holiday' && (() => {
        const c = condition as HolidayCondition;
        return (
          <div className="flex gap-2">
            <select value={c.country} onChange={e => onChange({ ...c, country: e.target.value as HolidayCondition['country'] })} className={`flex-1 ${inputCls}`}>
              {Object.entries(COUNTRY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={c.match} onChange={e => onChange({ ...c, match: e.target.value as HolidayCondition['match'] })} className={`flex-1 ${inputCls}`}>
              <option value="on_holiday">Est férié</option>
              <option value="not_on_holiday">N'est pas férié</option>
            </select>
          </div>
        );
      })()}

      {condition.type === 'language' && (() => {
        const c = condition as LanguageCondition;
        return (
          <div className="flex flex-wrap gap-1.5">
            {['fr','nl','en','de','es','it','pt'].map(lang => (
              <button key={lang} type="button"
                onClick={() => onChange({ ...c, languages: c.languages.includes(lang) ? c.languages.filter(x => x !== lang) : [...c.languages, lang] })}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium uppercase transition ${
                  c.languages.includes(lang) ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/15 text-[#344453]/50'
                }`}>{lang}</button>
            ))}
          </div>
        );
      })()}

      {condition.type === 'caller_number' && (() => {
        const c = condition as CallerNumberCondition;
        return (
          <div className="space-y-2">
            <select value={c.mode} onChange={e => onChange({ ...c, mode: e.target.value as CallerNumberCondition['mode'] })} className={inputCls}>
              <option value="equals">Égal à</option>
              <option value="starts_with">Commence par</option>
              <option value="contains">Contient</option>
            </select>
            <PatternEditor patterns={c.patterns} onChange={p => onChange({ ...c, patterns: p })} />
          </div>
        );
      })()}

      {condition.type === 'intent' && (() => {
        const c = condition as IntentCondition;
        return (
          <div className="space-y-2">
            <select value={c.match_mode} onChange={e => onChange({ ...c, match_mode: e.target.value as IntentCondition['match_mode'] })} className={inputCls}>
              <option value="any">L'un des mots</option>
              <option value="all">Tous les mots</option>
            </select>
            <PatternEditor patterns={c.intents} onChange={p => onChange({ ...c, intents: p })} placeholder="Mot-clé (ex: panne)" />
          </div>
        );
      })()}

      {condition.type === 'agent_availability' && (() => {
        const c = condition as AgentAvailabilityCondition;
        return (
          <div className="flex gap-2">
            <select value={c.group_id} onChange={e => onChange({ ...c, group_id: e.target.value })} className={`flex-1 ${inputCls}`}>
              <option value="">Sélectionner un groupe…</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={c.check} onChange={e => onChange({ ...c, check: e.target.value as AgentAvailabilityCondition['check'] })} className={`flex-1 ${inputCls}`}>
              <option value="any_available">Au moins 1 dispo</option>
              <option value="all_unavailable">Tous indisponibles</option>
            </select>
          </div>
        );
      })()}
    </div>
  );
}

function PatternEditor({ patterns, onChange, placeholder = 'Valeur…' }: {
  patterns: string[]; onChange: (p: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !patterns.includes(v)) { onChange([...patterns, v]); setDraft(''); }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-sm outline-none focus:border-[#344453]/30 transition" />
        <button type="button" onClick={add}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#344453] text-white hover:bg-[#1f2d38] transition">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {patterns.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {patterns.map(p => (
            <span key={p} className="inline-flex items-center gap-1 rounded-full border border-[#344453]/12 bg-[#F8F9FB] px-2.5 py-0.5 text-[11px] font-medium text-[#344453]">
              {p}
              <button type="button" onClick={() => onChange(patterns.filter(x => x !== p))} className="text-[#344453]/40 hover:text-red-500 transition">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RetryForm({ retry, onChange }: { retry: RetryConfig; onChange: (r: RetryConfig) => void }) {
  return (
    <div className="rounded-xl border border-[#344453]/8 bg-[#F8F9FB] p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Tentatives de sonnerie</p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { key: 'max_attempts',          label: 'Essais',     hint: '0=∞' },
          { key: 'ring_duration',         label: 'Sonnerie s', hint: '' },
          { key: 'between_attempts_delay',label: 'Pause s',    hint: '' },
        ] as const).map(({ key, label, hint }) => (
          <div key={key}>
            <label className="mb-1 block text-[10px] text-[#344453]/50">{label}</label>
            <input type="number" min={0} value={retry[key]}
              onChange={e => onChange({ ...retry, [key]: Number(e.target.value) })}
              className="w-full rounded-xl border border-[#344453]/12 bg-white px-2 py-1.5 text-center text-sm font-mono outline-none focus:border-[#344453]/30 transition" />
            {hint && <p className="mt-0.5 text-center text-[9px] text-[#344453]/35">{hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionForm({ action, groups, staff, onChange }: {
  action: LeafAction; groups: StaffGroup[]; staff: StaffMember[]; onChange: (a: LeafAction) => void;
}) {
  const inputCls = 'block w-full rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition';

  const changeType = (t: LeafAction['type']) => {
    const defs: Record<LeafAction['type'], LeafAction> = {
      route_group:    { type:'route_group',    group_id:'',    distribution_strategy:'sequential', agent_order:[], retry:{...DEFAULT_RETRY} },
      route_agent:    { type:'route_agent',    agent_id:'',    ring_duration:30 },
      route_external: { type:'route_external', phone_number:'', label:'' },
      play_message:   { type:'play_message',   message_text:'' },
      voicemail:      { ...DEFAULT_VOICEMAIL },
    };
    onChange(defs[t]);
  };

  return (
    <div className="space-y-3">
      {/* Sélecteur de type action */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {(Object.keys(ACTION_LABELS).filter(t => t !== 'route_conditional') as LeafAction['type'][]).map(t => (
          <button key={t} type="button" onClick={() => changeType(t)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition ${
              action.type === t
                ? 'border-[#141F28] bg-[#141F28]/8 text-[#141F28]'
                : 'border-[#344453]/10 text-[#344453]/50 hover:bg-[#344453]/4'
            }`}>
            <ActionIcon type={t} />
            <span className="text-[10px] font-medium leading-tight">{ACTION_LABELS[t]}</span>
          </button>
        ))}
      </div>

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
            <div className="grid grid-cols-2 gap-1.5">
              {(['sequential','simultaneous','random','round_robin'] as DistributionStrategy[]).map(s => (
                <button key={s} type="button" onClick={() => onChange({ ...a, distribution_strategy: s })}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[11px] font-medium transition ${
                    a.distribution_strategy === s ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/10 text-[#344453]/55 hover:bg-[#344453]/5'
                  }`}>
                  <StratIcon strategy={s} />
                  {STRATEGY_LABELS[s].label}
                </button>
              ))}
            </div>
            {/* Ordre agents */}
            {a.distribution_strategy === 'sequential' && grp && grp.members.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">Ordre d'appel</p>
                {(a.agent_order?.length ? a.agent_order : grp.members.map(m => m.id)).map((agentId, i, arr) => {
                  const m = grp.members.find(x => x.id === agentId);
                  if (!m) return null;
                  const move = (dir: -1 | 1) => {
                    const o = [...arr]; const ni = i + dir;
                    if (ni < 0 || ni >= o.length) return;
                    [o[i], o[ni]] = [o[ni], o[i]];
                    onChange({ ...a, agent_order: o });
                  };
                  return (
                    <div key={agentId} className="flex items-center gap-1.5 rounded-xl border border-[#344453]/8 bg-white px-2.5 py-1.5">
                      <GripVertical className="h-3 w-3 text-[#344453]/25" />
                      <span className="w-4 text-[10px] font-mono text-[#344453]/35">{i+1}</span>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#344453] text-[8px] font-bold text-white">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                      <span className="flex-1 text-[11px] font-medium text-[#141F28]">{m.first_name} {m.last_name}</span>
                      <button type="button" onClick={() => move(-1)} disabled={i===0} className="flex h-5 w-5 items-center justify-center rounded border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => move(1)} disabled={i===arr.length-1} className="flex h-5 w-5 items-center justify-center rounded border border-[#344453]/10 text-[#344453]/40 hover:bg-[#344453]/5 disabled:opacity-20 transition">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <RetryForm retry={a.retry} onChange={r => onChange({ ...a, retry: r })} />
          </div>
        );
      })()}

      {action.type === 'route_agent' && (() => {
        const a = action as RouteAgentAction;
        return (
          <div className="space-y-2">
            <select value={a.agent_id} onChange={e => onChange({ ...a, agent_id: e.target.value })} className={inputCls}>
              <option value="">Sélectionner un agent…</option>
              {staff.filter(s => s.enabled).map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
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
          <textarea rows={3} value={a.message_text} onChange={e => onChange({ ...a, message_text: e.target.value })}
            placeholder="Message lu à l'appelant…"
            className="block w-full resize-none rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
        );
      })()}

      {action.type === 'voicemail' && (() => {
        const a = action as VoicemailAction;
        return (
          <textarea rows={2} value={a.greeting_text ?? ''} onChange={e => onChange({ ...a, greeting_text: e.target.value })}
            placeholder="Message d'accueil avant le bip (optionnel)"
            className="block w-full resize-none rounded-xl border border-[#344453]/12 bg-white px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
        );
      })()}
    </div>
  );
}

function NodeEditorPanel({ node, groups, staff, onUpdate, onDelete, onClose }: {
  node: Node; groups: StaffGroup[]; staff: StaffMember[];
  onUpdate: (n: Node) => void; onDelete: () => void; onClose: () => void;
}) {
  const isEntry = node.id === 'entry';

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-[#344453]/8 bg-white"
      style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#344453]/8 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#344453]/40">
            {node.type === 'condition' ? 'Condition' : node.type === 'action' ? 'Action' : node.type === 'end' ? 'Fin' : 'Entrée'}
          </p>
          <p className="text-sm font-semibold text-[#141F28]">
            {node.type === 'condition' ? (node.data as FlowNodeData_Condition).label || 'Configuration'
              : node.type === 'action' ? (node.data as FlowNodeData_Action).label || 'Configuration'
              : node.type === 'end' ? 'Fin de flux'
              : 'Appel entrant'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEntry && (
            <button type="button" onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 transition">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#344453]/12 text-[#344453]/50 hover:bg-[#344453]/5 transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        {!isEntry && node.type !== 'entry' && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
              Libellé
            </label>
            <input type="text"
              value={(node.data as { label?: string }).label ?? ''}
              onChange={e => onUpdate({ ...node, data: { ...node.data, label: e.target.value } })}
              placeholder="Nom de ce nœud…"
              className="block w-full rounded-xl border border-[#344453]/12 bg-[#F8F9FB] px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
          </div>
        )}

        {/* Formulaire selon le type */}
        {node.type === 'condition' && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
              Type de condition
            </label>
            <ConditionForm
              condition={(node.data as FlowNodeData_Condition).condition}
              groups={groups}
              onChange={c => onUpdate({ ...node, data: { ...node.data, condition: c } })}
            />
          </div>
        )}

        {node.type === 'action' && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
              Type d'action
            </label>
            <ActionForm
              action={(node.data as FlowNodeData_Action).action}
              groups={groups}
              staff={staff}
              onChange={a => onUpdate({ ...node, data: { ...node.data, action: a } })}
            />
          </div>
        )}

        {node.type === 'end' && (
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-[#344453]/40">
              Message de fin (optionnel)
            </label>
            <input type="text"
              value={(node.data as FlowNodeData_End).label ?? ''}
              onChange={e => onUpdate({ ...node, data: { ...node.data, label: e.target.value } })}
              placeholder="Aucune correspondance"
              className="block w-full rounded-xl border border-[#344453]/12 bg-[#F8F9FB] px-3 py-2 text-sm outline-none focus:border-[#344453]/30 transition" />
          </div>
        )}

        {node.type === 'entry' && (
          <p className="text-sm text-[#344453]/50">
            Le nœud d'entrée représente l'appel entrant. Il ne peut pas être supprimé ni configuré.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers : creation de nœud ──────────────────────────────────────────────

function makeNode(nodeType: string, subType: string, position: { x: number; y: number }): Node {
  const id = newNodeId();

  if (nodeType === 'condition') {
    const ct = subType as ConditionType;
    const baseCond = { ...DEFAULT_CONDITIONS[ct], id: newConditionId() };
    return {
      id, type: 'condition', position,
      data: { label: CONDITION_LABELS[ct], condition: baseCond },
    };
  }

  if (nodeType === 'action') {
    const at = subType as LeafAction['type'];
    const defs: Record<LeafAction['type'], LeafAction> = {
      route_group:    { type:'route_group',    group_id:'',    distribution_strategy:'sequential', agent_order:[], retry:{...DEFAULT_RETRY} },
      route_agent:    { type:'route_agent',    agent_id:'',    ring_duration:30 },
      route_external: { type:'route_external', phone_number:'', label:'' },
      play_message:   { type:'play_message',   message_text:'' },
      voicemail:      { ...DEFAULT_VOICEMAIL },
    };
    return {
      id, type: 'action', position,
      data: { label: ACTION_LABELS[at], action: defs[at] },
    };
  }

  // end
  return { id, type: 'end', position, data: { label: 'Aucune correspondance' } };
}

// ─── Helper : style des arêtes ───────────────────────────────────────────────

function styledEdge(edge: Edge): Edge {
  const handle = edge.sourceHandle;
  const stroke = handle === 'yes' ? C.green : handle === 'no' ? C.red : C.grey;
  const label  = handle === 'yes' ? 'Oui' : handle === 'no' ? 'Non' : handle === 'out' ? 'Sinon' : '';
  return {
    ...edge,
    style: { stroke, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
    label,
    labelStyle: { fontSize: 10, fontWeight: 700, fill: 'white' },
    labelBgStyle: { fill: stroke, rx: 6, padding: 3 },
    labelBgPadding: [6, 3] as [number, number],
  };
}

// ─── Détection de cycle (BFS depuis target, cherche source) ──────────────────

function wouldCreateCycle(source: string, target: string, edges: Edge[]): boolean {
  const visited = new Set<string>();
  const queue = [target];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    edges.filter(e => e.source === current).forEach(e => queue.push(e.target));
  }
  return false;
}

// ─── Composant principal (inner, a besoin de ReactFlowProvider) ───────────────

function FlowBuilderInner({ groups, staff, nodes: initNodes, edges: initEdges, onSave, saving }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges.map(styledEdge));
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [dirty, setDirty]                 = useState(false);
  const { screenToFlowPosition }          = useReactFlow();
  const wrapperRef                        = useRef<HTMLDivElement>(null);

  // ─── Garde-fou : connexions invalides ──────────────────────────────────────
  const isValidConnection = useCallback((connection: Connection) => {
    const { source, target, sourceHandle } = connection;
    if (!source || !target) return false;
    // Boucle sur soi-même
    if (source === target) return false;
    // Le nœud entry ne peut pas être une cible
    if (target === 'entry') return false;
    // Un nœud end ne peut pas être une source
    const sourceNode = nodes.find(n => n.id === source);
    if (sourceNode?.type === 'end') return false;
    // La poignée source est déjà utilisée (chaque handle = max 1 arête sortante)
    if (edges.some(e => e.source === source && e.sourceHandle === sourceHandle)) return false;
    // Détection de cycle
    if (wouldCreateCycle(source, target, edges)) return false;
    return true;
  }, [nodes, edges]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge(styledEdge({
      ...connection,
      id: `edge-${Date.now()}`,
    } as Edge), eds));
    setDirty(true);
  }, [setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const filtered = changes.filter(c => !(c.type === 'remove' && c.id === 'entry'));
    onNodesChange(filtered);
    if (filtered.some(c => c.type !== 'select')) setDirty(true);
  }, [onNodesChange]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    const subType  = e.dataTransfer.getData('subType');
    if (!nodeType) return;

    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode  = makeNode(nodeType, subType, position);

    setNodes(ns => [...ns, newNode]);
    setDirty(true);
  }, [screenToFlowPosition, setNodes]);

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null;

  const handleSave = useCallback(async () => {
    await onSave(nodes, edges);
    setDirty(false);
  }, [nodes, edges, onSave]);

  return (
    <FlowContext.Provider value={{ groups, staff }}>
      <div className="flex" style={{ height: '100%', overflow: 'hidden' }}>
        <NodePalette />

        <div ref={wrapperRef} className="relative flex-1"
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={(changes) => { onEdgesChange(changes); setDirty(true); }}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
          >
            <Controls />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(52,68,83,0.08)" />
            <MiniMap
              nodeColor={n => n.type === 'condition' ? C.orange : n.type === 'action' ? C.navy : C.grey}
              style={{ border: `1px solid ${C.border}`, borderRadius: 12 }}
            />
            <Panel position="top-right">
              <div className="flex items-center gap-2">
                {dirty && (
                  <span className="rounded-full bg-[#C7601D]/10 px-2.5 py-1 text-[11px] font-medium text-[#C7601D]">
                    Modifications non sauvegardées
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
                  style={{ background: dirty && !saving ? C.navy : C.grey }}>
                  {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Enregistrer
                </button>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeEditorPanel
            node={selectedNode}
            groups={groups}
            staff={staff}
            onUpdate={updated => {
              setNodes(ns => ns.map(n => n.id === updated.id ? updated : n));
              setDirty(true);
            }}
            onDelete={() => {
              setNodes(ns => ns.filter(n => n.id !== selectedId));
              setEdges(es => es.filter(e => e.source !== selectedId && e.target !== selectedId));
              setSelectedId(null);
              setDirty(true);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </FlowContext.Provider>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function DispatchFlowBuilder(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
