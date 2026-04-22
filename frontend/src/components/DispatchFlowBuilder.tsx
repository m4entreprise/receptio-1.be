import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Phone, Plus, Settings, Trash2, Layers, User, MessageSquare, PhoneOff } from 'lucide-react';

interface StaffGroup {
  id: string;
  name: string;
  role: string | null;
  color?: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface DispatchRule {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  condition_type: 'always' | 'intent';
  conditions: { intents?: string[] };
  target_type: 'group' | 'agent';
  target_group_id: string | null;
  target_staff_id: string | null;
  distribution_strategy: 'sequential' | 'random' | 'simultaneous';
  fallback_type: 'voicemail' | 'none' | 'group' | 'agent';
  fallback_group_id: string | null;
  fallback_staff_id: string | null;
  position_x?: number;
  position_y?: number;
  target_group_name?: string | null;
  target_staff_first_name?: string | null;
  target_staff_last_name?: string | null;
  fallback_group_name?: string | null;
}

interface DispatchFlowBuilderProps {
  rules: DispatchRule[];
  groups: StaffGroup[];
  staff: StaffMember[];
  onRuleClick: (rule: DispatchRule) => void;
  onCreateRule: () => void;
  onDeleteRule: (ruleId: string) => void;
  onUpdatePositions: (updates: { id: string; x: number; y: number }[]) => void;
}

const nodeTypes = {
  start: StartNode,
  rule: RuleNode,
  end: EndNode,
};

function StartNode() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-[#344453] bg-[#344453] px-6 py-4 shadow-lg">
      <Phone className="h-5 w-5 text-white" />
      <span className="text-sm font-semibold text-white">Appel entrant</span>
    </div>
  );
}

function RuleNode({ data }: { data: any }) {
  const rule = data.rule as DispatchRule;
  const bgColor = rule.enabled ? 'bg-white' : 'bg-[#344453]/5';
  const borderColor = rule.enabled ? 'border-[#344453]/15' : 'border-[#344453]/8';

  return (
    <div className={`min-w-[280px] rounded-2xl border-2 ${borderColor} ${bgColor} shadow-lg transition-all hover:shadow-xl`}>
      <div className="flex items-center justify-between border-b border-[#344453]/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#344453]/10 text-xs font-bold text-[#344453]">
            {rule.priority + 1}
          </span>
          <span className="text-sm font-semibold text-[#141F28]">{rule.name}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => data.onEdit(rule)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => data.onDelete(rule.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[#344453]/40">Condition</span>
          <span className="rounded-lg bg-[#344453]/8 px-2 py-1 font-medium text-[#344453]">
            {rule.condition_type === 'always'
              ? 'Toujours'
              : (rule.conditions?.intents || []).join(', ') || 'Intent IA'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[#344453]/40">Cible</span>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#C7601D]/10 px-2 py-1">
            {rule.target_type === 'group' ? (
              <Layers className="h-3 w-3 text-[#C7601D]" />
            ) : (
              <User className="h-3 w-3 text-[#C7601D]" />
            )}
            <span className="font-medium text-[#C7601D]">
              {rule.target_type === 'group'
                ? rule.target_group_name || 'Groupe'
                : `${rule.target_staff_first_name || ''} ${rule.target_staff_last_name || ''}`.trim() || 'Agent'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[#344453]/40">Fallback</span>
          <div className="flex items-center gap-1.5 rounded-lg bg-[#2D9D78]/10 px-2 py-1">
            {rule.fallback_type === 'voicemail' ? (
              <MessageSquare className="h-3 w-3 text-[#2D9D78]" />
            ) : rule.fallback_type === 'none' ? (
              <PhoneOff className="h-3 w-3 text-[#2D9D78]" />
            ) : null}
            <span className="font-medium text-[#2D9D78]">
              {rule.fallback_type === 'voicemail'
                ? 'Messagerie'
                : rule.fallback_type === 'none'
                ? 'Raccrocher'
                : rule.fallback_group_name || 'Autre'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EndNode({ data }: { data: any }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#344453]/25 bg-white px-6 py-4 shadow-sm">
      <span className="text-sm font-medium text-[#344453]/50">{data.label}</span>
    </div>
  );
}

export default function DispatchFlowBuilder({
  rules,
  groups,
  staff,
  onRuleClick,
  onCreateRule,
  onDeleteRule,
  onUpdatePositions,
}: DispatchFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, type: 'smoothstep' }, eds)),
    [setEdges]
  );

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    const startNode: Node = {
      id: 'start',
      type: 'start',
      position: { x: 400, y: 50 },
      data: {},
      draggable: false,
    };
    newNodes.push(startNode);

    let yOffset = 200;
    const xCenter = 400;

    rules.forEach((rule, idx) => {
      const ruleNode: Node = {
        id: rule.id,
        type: 'rule',
        position: {
          x: rule.position_x !== undefined ? rule.position_x : xCenter - 140,
          y: rule.position_y !== undefined ? rule.position_y : yOffset,
        },
        data: {
          rule,
          onEdit: onRuleClick,
          onDelete: onDeleteRule,
        },
      };
      newNodes.push(ruleNode);

      if (idx === 0) {
        newEdges.push({
          id: `start-${rule.id}`,
          source: 'start',
          target: rule.id,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#344453' },
          style: { stroke: '#344453', strokeWidth: 2 },
        });
      } else {
        newEdges.push({
          id: `${rules[idx - 1].id}-${rule.id}`,
          source: rules[idx - 1].id,
          target: rule.id,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#344453' },
          style: { stroke: '#344453', strokeWidth: 2 },
        });
      }

      yOffset += 220;
    });

    if (rules.length > 0) {
      const endNode: Node = {
        id: 'end',
        type: 'end',
        position: { x: xCenter - 100, y: yOffset },
        data: { label: 'Fin du flux' },
        draggable: false,
      };
      newNodes.push(endNode);

      newEdges.push({
        id: `${rules[rules.length - 1].id}-end`,
        source: rules[rules.length - 1].id,
        target: 'end',
        type: 'smoothstep',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#344453' },
        style: { stroke: '#344453', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [rules, onRuleClick, onDeleteRule, setNodes, setEdges]);

  const handleNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      if (node.id === 'start' || node.id === 'end') return;
      setHasChanges(true);
    },
    []
  );

  const handleSavePositions = useCallback(() => {
    const updates = nodes
      .filter((n) => n.id !== 'start' && n.id !== 'end')
      .map((n) => ({
        id: n.id,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      }));
    onUpdatePositions(updates);
    setHasChanges(false);
  }, [nodes, onUpdatePositions]);

  return (
    <div className="relative h-[700px] w-full overflow-hidden rounded-[20px] border border-[#344453]/10 bg-[#F8F9FB] shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#344453" style={{ opacity: 0.15 }} />
        <Controls
          className="rounded-xl border border-[#344453]/10 bg-white shadow-sm"
          showInteractive={false}
        />
        <Panel position="top-right" className="space-y-2">
          <button
            onClick={onCreateRule}
            className="flex items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#b35519]"
          >
            <Plus className="h-4 w-4" />
            Nouvelle règle
          </button>
          {hasChanges && (
            <button
              onClick={handleSavePositions}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D9D78] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#268a66]"
            >
              Sauvegarder positions
            </button>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
