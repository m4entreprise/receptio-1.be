import { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node, Edge, Controls, Background, BackgroundVariant,
  useNodesState, useEdgesState, MarkerType, NodeProps,
  Handle, Position, Panel, MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Phone, ChevronDown, Clock, Calendar, Globe, Hash,
  Zap, Users, User, PhoneCall, MessageSquare, Voicemail,
  ArrowRight, GitBranch, RefreshCw, Shuffle, Play, AlignJustify,
} from 'lucide-react';
import type {
  DispatchRule, Condition, Action, FallbackStep,
  DistributionStrategy, RouteConditionalAction,
} from '../types/dispatch';
import {
  STRATEGY_LABELS,
  DAYS_SHORT, COUNTRY_LABELS,
} from '../types/dispatch';

// ─── Props du composant ───────────────────────────────────────────────────────

interface Props {
  rules: DispatchRule[];
  groups: { id: string; name: string; role?: string | null }[];
  staff: { id: string; first_name: string; last_name: string; role: string }[];
  onRuleClick: (rule: DispatchRule) => void;
  onCreateRule: () => void;
  onDeleteRule: (id: string) => void;
  onUpdatePositions: (
    updates: { id: string; node_positions: Record<string, { x: number; y: number }> }[]
  ) => void;
}

// ─── Couleurs de la palette ───────────────────────────────────────────────────

const C = {
  navy:    '#344453',
  orange:  '#C7601D',
  green:   '#2D9D78',
  yellow:  '#E6A817',
  red:     '#D94052',
  bg:      '#F8F9FB',
  border:  'rgba(52,68,83,0.12)',
};

// ─── Icônes par type de condition ─────────────────────────────────────────────

function CondIcon({ type }: { type: Condition['type'] }) {
  const cls = 'h-3 w-3 shrink-0';
  switch (type) {
    case 'schedule':           return <Clock className={cls} />;
    case 'holiday':            return <Calendar className={cls} />;
    case 'language':           return <Globe className={cls} />;
    case 'caller_number':      return <Hash className={cls} />;
    case 'intent':             return <Zap className={cls} />;
    case 'agent_availability': return <Users className={cls} />;
    default:                   return <AlignJustify className={cls} />;
  }
}

// ─── Icônes par type d'action ─────────────────────────────────────────────────

function ActionIcon({ type }: { type: Action['type'] }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'route_group':       return <Users className={cls} />;
    case 'route_agent':       return <User className={cls} />;
    case 'route_external':    return <PhoneCall className={cls} />;
    case 'play_message':      return <MessageSquare className={cls} />;
    case 'voicemail':         return <Voicemail className={cls} />;
    case 'route_conditional': return <GitBranch className={cls} />;
  }
}

// ─── Icône de stratégie de distribution ──────────────────────────────────────

function StratIcon({ strategy }: { strategy: DistributionStrategy }) {
  const cls = 'h-3 w-3 shrink-0';
  switch (strategy) {
    case 'sequential':   return <AlignJustify className={cls} />;
    case 'simultaneous': return <GitBranch className={cls} />;
    case 'random':       return <Shuffle className={cls} />;
    case 'round_robin':  return <RefreshCw className={cls} />;
  }
}

// ─── Résumé d'une condition en langage naturel ────────────────────────────────

function conditionSummary(cond: Condition): string {
  switch (cond.type) {
    case 'always': return 'Toujours';
    case 'schedule': {
      const days = cond.days.map(d => DAYS_SHORT[d] ?? d).join(' ');
      return `${days} · ${cond.time_start}–${cond.time_end}`;
    }
    case 'holiday':
      return cond.match === 'on_holiday'
        ? `Jour férié ${COUNTRY_LABELS[cond.country] ?? cond.country}`
        : `Hors jours fériés ${COUNTRY_LABELS[cond.country] ?? cond.country}`;
    case 'language':
      return `Langue : ${cond.languages.join(', ').toUpperCase()}`;
    case 'caller_number':
      return `N° appelant (${cond.patterns.slice(0, 2).join(', ')}${cond.patterns.length > 2 ? '…' : ''})`;
    case 'intent':
      return `IA : ${cond.intents.slice(0, 3).join(', ')}${cond.intents.length > 3 ? '…' : ''}`;
    case 'agent_availability':
      return cond.check === 'any_available' ? 'Si agents disponibles' : 'Si aucun agent dispo';
  }
}

// ─── Résumé de l'action principale ───────────────────────────────────────────

function actionSummary(
  action: Action,
  groups: Props['groups'],
  staff: Props['staff'],
): string {
  switch (action.type) {
    case 'route_group': {
      const grp = groups.find(g => g.id === action.group_id);
      const name = grp ? grp.name : 'Groupe';
      const strat = STRATEGY_LABELS[action.distribution_strategy]?.label ?? action.distribution_strategy;
      const max = action.retry.max_attempts;
      const attempts = max === 0 ? '∞ essais' : `${max} essai${max > 1 ? 's' : ''}`;
      return `${name} · ${strat} · ${attempts}`;
    }
    case 'route_agent': {
      const s = staff.find(x => x.id === action.agent_id);
      return s ? `${s.first_name} ${s.last_name}` : 'Agent';
    }
    case 'route_external':
      return action.label ?? action.phone_number;
    case 'play_message':
      return `"${action.message_text.slice(0, 40)}${action.message_text.length > 40 ? '…' : ''}"`;
    case 'voicemail':
      return 'Messagerie vocale';
    case 'route_conditional': {
      const rc = action as RouteConditionalAction;
      return `${rc.branches.length} branche${rc.branches.length > 1 ? 's' : ''} conditionnelle${rc.branches.length > 1 ? 's' : ''}`;
    }
  }
}

// ─── Nœud : Appel entrant ────────────────────────────────────────────────────

function StartNode() {
  return (
    <div
      style={{ background: C.navy, borderRadius: 20 }}
      className="flex items-center gap-3 px-5 py-3.5 shadow-lg"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <Phone className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Entrée</p>
        <p className="text-sm font-bold text-white">Appel entrant</p>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: C.navy, border: '2px solid white' }} />
    </div>
  );
}

// ─── Nœud : Règle de dispatch ─────────────────────────────────────────────────

interface RuleNodeData {
  rule: DispatchRule;
  groups: Props['groups'];
  staff: Props['staff'];
  onClick: (rule: DispatchRule) => void;
  isLast: boolean;
}

function RuleNode({ data }: NodeProps<RuleNodeData>) {
  const { rule, groups, staff, onClick, isLast } = data;

  const opColor = rule.condition_operator === 'ALWAYS' ? C.green
    : rule.condition_operator === 'OR' ? C.yellow
    : C.orange;

  const opLabel = rule.condition_operator === 'ALWAYS' ? 'TOUJOURS'
    : rule.condition_operator === 'OR' ? 'OU'
    : 'ET';

  return (
    <div
      className="relative cursor-pointer transition-all"
      onClick={() => onClick(rule)}
      style={{
        width: 310,
        background: 'white',
        borderRadius: 20,
        border: `1.5px solid ${rule.enabled ? C.border : 'rgba(52,68,83,0.06)'}`,
        boxShadow: rule.enabled
          ? '0 4px 24px rgba(52,68,83,0.10), 0 1px 4px rgba(52,68,83,0.06)'
          : '0 2px 8px rgba(52,68,83,0.04)',
        opacity: rule.enabled ? 1 : 0.55,
      }}
    >
      {/* ─── Bordure gauche colorée selon priorité ─────────────────────────── */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
          background: rule.enabled ? C.orange : C.border,
          borderRadius: '20px 0 0 20px',
        }}
      />

      {/* ─── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5" style={{ paddingLeft: 20 }}>
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: rule.enabled ? C.orange : C.navy + '40', fontSize: 10 }}
        >
          {rule.priority + 1}
        </span>
        <p className="flex-1 truncate text-sm font-semibold text-[#141F28]">{rule.name}</p>
        {!rule.enabled && (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(52,68,83,0.08)', color: C.navy + '80' }}
          >
            off
          </span>
        )}
      </div>

      {/* ─── Conditions ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3" style={{ paddingLeft: 20 }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ background: opColor + '18', color: opColor }}
          >
            {opLabel}
          </span>
        </div>

        {rule.conditions.length === 0 ? (
          <p className="text-xs text-[#344453]/35 italic">Aucune condition définie</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {rule.conditions.slice(0, 4).map(cond => (
              <span
                key={cond.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: C.bg, color: C.navy, border: `1px solid ${C.border}` }}
              >
                <CondIcon type={cond.type} />
                {conditionSummary(cond)}
              </span>
            ))}
            {rule.conditions.length > 4 && (
              <span className="text-[10px] text-[#344453]/40">+{rule.conditions.length - 4}</span>
            )}
          </div>
        )}
      </div>

      {/* ─── Séparateur ─────────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(52,68,83,0.07)', marginLeft: 20 }} />

      {/* ─── Action principale ───────────────────────────────────────────────── */}
      <div className="px-4 py-3" style={{ paddingLeft: 20 }}>
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[#344453]/40">
          Action
        </p>

        {rule.action.type === 'route_conditional' ? (
          /* Dispatch conditionnel : afficher les branches */
          <div className="space-y-1">
            {(rule.action as RouteConditionalAction).branches.slice(0, 3).map((branch, i) => (
              <div key={branch.id} className="flex items-center gap-2">
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: C.orange }}
                >{i + 1}</span>
                <span className="truncate text-[10px] text-[#344453]/60">
                  {branch.label || conditionSummary(branch.condition)}
                </span>
                <ArrowRight className="h-2.5 w-2.5 shrink-0 text-[#344453]/25" />
                <ActionIcon type={branch.action.type} />
              </div>
            ))}
            {(rule.action as RouteConditionalAction).branches.length > 3 && (
              <p className="text-[10px] text-[#344453]/35 pl-5">
                +{(rule.action as RouteConditionalAction).branches.length - 3} autre{(rule.action as RouteConditionalAction).branches.length - 3 > 1 ? 's' : ''}
              </p>
            )}
            <div className="flex items-center gap-2 pt-0.5 border-t border-[#344453]/6 mt-1">
              <span className="text-[10px] text-[#344453]/35 italic">Par défaut :</span>
              <ActionIcon type={(rule.action as RouteConditionalAction).default_action.type} />
            </div>
          </div>
        ) : (
          /* Action simple */
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
              style={{ background: C.orange + '15', color: C.orange }}
            >
              <ActionIcon type={rule.action.type} />
            </div>
            <p className="text-xs font-medium text-[#141F28] leading-tight">
              {actionSummary(rule.action, groups, staff)}
            </p>
            {rule.action.type === 'route_group' && (
              <div
                className="ml-auto flex items-center gap-0.5 shrink-0 rounded-full px-1.5 py-0.5"
                style={{ background: C.bg, border: `1px solid ${C.border}` }}
              >
                <StratIcon strategy={rule.action.distribution_strategy} />
                <span className="text-[9px] text-[#344453]/55 ml-0.5">
                  {STRATEGY_LABELS[rule.action.distribution_strategy]?.label}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Chaîne de fallback (si définie) ───────────────────────────────── */}
      {rule.fallback_chain.length > 0 && (
        <>
          <div style={{ height: 1, background: 'rgba(52,68,83,0.07)', marginLeft: 20 }} />
          <div className="px-4 py-2.5" style={{ paddingLeft: 20 }}>
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-[#344453]/40">
              Si échec
            </p>
            <div className="space-y-1">
              {rule.fallback_chain.slice(0, 3).map((step: FallbackStep, i) => (
                <div key={step.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-[#344453]/30 w-3 shrink-0">{i + 1}.</span>
                  <ActionIcon type={step.action.type} />
                  <span className="text-[10px] text-[#344453]/65 truncate">{step.label}</span>
                </div>
              ))}
              {rule.fallback_chain.length > 3 && (
                <p className="text-[10px] text-[#344453]/35 pl-5">
                  +{rule.fallback_chain.length - 3} étape{rule.fallback_chain.length - 3 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── Handles React Flow ─────────────────────────────────────────────── */}
      <Handle type="target" position={Position.Top}
        style={{ background: C.navy, border: '2px solid white', width: 10, height: 10 }} />
      {!isLast && (
        <Handle type="source" position={Position.Bottom}
          style={{ background: C.navy, border: '2px solid white', width: 10, height: 10 }} />
      )}
    </div>
  );
}

// ─── Nœud : Fin de flux (aucune règle) ───────────────────────────────────────

function EndNode() {
  return (
    <div
      style={{
        borderRadius: 16, border: `2px dashed ${C.red}40`,
        background: C.red + '06', padding: '12px 20px',
      }}
      className="flex items-center gap-3"
    >
      <Handle type="target" position={Position.Top}
        style={{ background: C.red, border: '2px solid white' }} />
      <Voicemail className="h-4 w-4 shrink-0" style={{ color: C.red }} />
      <div>
        <p className="text-xs font-semibold" style={{ color: C.red }}>Aucune règle applicable</p>
        <p className="text-[10px] text-[#344453]/40">Messagerie vocale par défaut</p>
      </div>
    </div>
  );
}

// ─── Nœud : Bouton d'ajout de règle ──────────────────────────────────────────

function AddRuleNode({ data }: NodeProps<{ onAdd: () => void }>) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Top}
        style={{ background: 'transparent', border: 'none' }} />
      <button
        onClick={data.onAdd}
        className="flex items-center gap-2 rounded-full border-2 border-dashed px-5 py-2.5 text-sm font-medium transition hover:bg-[#C7601D]/6"
        style={{ borderColor: C.orange + '50', color: C.orange + 'CC' }}
      >
        <Play className="h-3.5 w-3.5" />
        Ajouter une règle
      </button>
    </div>
  );
}

// ─── Types de nœuds enregistrés ───────────────────────────────────────────────

const nodeTypes = {
  startNode:   StartNode,
  ruleNode:    RuleNode,
  endNode:     EndNode,
  addRuleNode: AddRuleNode,
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function DispatchFlowBuilder({
  rules, groups, staff, onRuleClick, onCreateRule, onUpdatePositions,
}: Props) {

  // ─── Construire les nœuds et les arêtes à partir des règles ──────────────
  const { initialNodes, initialEdges } = useMemo(() => {
    const CANVAS_CX = 400;
    const NODE_H    = 260; // hauteur estimée d'un nœud de règle
    const GAP       = 60;  // espace vertical entre nœuds

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Nœud START
    nodes.push({
      id: 'start',
      type: 'startNode',
      position: { x: CANVAS_CX - 100, y: 0 },
      data: {},
      draggable: false,
      selectable: false,
    });

    const sorted = [...rules].sort((a, b) => a.priority - b.priority);

    sorted.forEach((rule, i) => {
      const savedPos = rule.node_positions?.['rule'];
      const x = savedPos?.x ?? CANVAS_CX - 155;
      const y = savedPos?.y ?? 100 + i * (NODE_H + GAP);

      nodes.push({
        id: rule.id,
        type: 'ruleNode',
        position: { x, y },
        data: {
          rule,
          groups,
          staff,
          onClick: onRuleClick,
          isLast: i === sorted.length - 1,
        },
      });

      // Arête : START → première règle
      if (i === 0) {
        edges.push({
          id: `start-${rule.id}`,
          source: 'start',
          target: rule.id,
          type: 'smoothstep',
          style: { stroke: C.navy + '60', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: C.navy + '60' },
        });
      } else {
        // Arête : règle N → règle N+1 (condition non remplie)
        edges.push({
          id: `${sorted[i - 1].id}-${rule.id}`,
          source: sorted[i - 1].id,
          target: rule.id,
          type: 'smoothstep',
          label: 'Sinon',
          labelStyle: { fontSize: 10, fill: C.navy + '80', fontWeight: 600 },
          labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
          labelBgPadding: [4, 6] as [number, number],
          labelBgBorderRadius: 6,
          style: { stroke: C.navy + '35', strokeWidth: 1.5, strokeDasharray: '5 4' },
          markerEnd: { type: MarkerType.ArrowClosed, color: C.navy + '35' },
        });
      }
    });

    // Nœud intermédiaire : Ajouter une règle
    const addY = sorted.length > 0
      ? 100 + sorted.length * (NODE_H + GAP) + 10
      : 180;

    nodes.push({
      id: 'add-rule',
      type: 'addRuleNode',
      position: { x: CANVAS_CX - 80, y: addY },
      data: { onAdd: onCreateRule },
      draggable: false,
      selectable: false,
    });

    if (sorted.length > 0) {
      edges.push({
        id: `${sorted[sorted.length - 1].id}-add`,
        source: sorted[sorted.length - 1].id,
        target: 'add-rule',
        type: 'smoothstep',
        style: { stroke: C.orange + '30', strokeWidth: 1.5, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: C.orange + '30' },
      });
    } else {
      edges.push({
        id: 'start-add',
        source: 'start',
        target: 'add-rule',
        type: 'smoothstep',
        style: { stroke: C.navy + '30', strokeWidth: 1.5, strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed, color: C.navy + '30' },
      });
    }

    // Nœud END
    const endY = addY + 80;
    nodes.push({
      id: 'end',
      type: 'endNode',
      position: { x: CANVAS_CX - 130, y: endY },
      data: {},
      draggable: false,
      selectable: false,
    });
    edges.push({
      id: 'add-end',
      source: 'add-rule',
      target: 'end',
      style: { stroke: 'transparent' },
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [rules, groups, staff, onRuleClick, onCreateRule]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange]          = useEdgesState(initialEdges);

  // Synchroniser quand les règles changent (nouvelle règle, reorder, etc.)
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Sauvegarder les positions après drag
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.id || node.id === 'start' || node.id === 'end' || node.id === 'add-rule') return;
      const rule = rules.find(r => r.id === node.id);
      if (!rule) return;
      const updated = {
        ...rule.node_positions,
        rule: { x: node.position.x, y: node.position.y },
      };
      onUpdatePositions([{ id: node.id, node_positions: updated }]);
    },
    [rules, onUpdatePositions]
  );

  return (
    <div
      style={{
        height: 600,
        borderRadius: 24,
        border: `1.5px solid ${C.border}`,
        overflow: 'hidden',
        background: '#FAFBFC',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={1.8}
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(52,68,83,0.06)" />
        <Controls
          showInteractive={false}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(52,68,83,0.08)',
          }}
        />
        <MiniMap
          nodeColor={() => C.orange + '80'}
          maskColor="rgba(248,249,251,0.85)"
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 12,
          }}
        />
        <Panel position="top-right">
          <div
            className="flex items-center gap-3 rounded-[14px] px-4 py-2.5 text-xs text-[#344453]/55"
            style={{ background: 'white', border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(52,68,83,0.06)' }}
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown className="h-3 w-3 text-[#344453]/40" />
              Glisser pour réorganiser
            </span>
            <span className="h-3 w-px bg-[#344453]/15" />
            <span className="flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3 text-[#344453]/40" />
              Cliquer pour modifier
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
