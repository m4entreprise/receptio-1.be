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
  NodeProps,
  Handle,
  Position,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Phone, Plus, Settings, Trash2, Layers, User, MessageSquare, PhoneOff, GitBranch, Check } from 'lucide-react';

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

type NodeType = 'start' | 'condition' | 'action' | 'fallback';

interface FlowNodeData {
  type: NodeType;
  label: string;
  config?: {
    conditionType?: 'always' | 'intent' | 'time' | 'caller';
    intents?: string[];
    timeRange?: { start: string; end: string };
    actionType?: 'transfer_group' | 'transfer_agent' | 'voicemail' | 'hangup';
    targetGroupId?: string;
    targetStaffId?: string;
    distributionStrategy?: 'sequential' | 'random' | 'simultaneous';
  };
  onEdit?: () => void;
  onDelete?: () => void;
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
  agent_order: string[];
  fallback_type: 'voicemail' | 'none' | 'group' | 'agent';
  fallback_group_id: string | null;
  fallback_staff_id: string | null;
  position_x?: number | null;
  position_y?: number | null;
  target_group_name: string | null;
  target_group_role: string | null;
  target_staff_first_name: string | null;
  target_staff_last_name: string | null;
  fallback_group_name: string | null;
  fallback_staff_first_name: string | null;
  fallback_staff_last_name: string | null;
}

interface DispatchFlowBuilderProps {
  rules: DispatchRule[];
  groups: StaffGroup[];
  staff: StaffMember[];
  onRuleClick: (rule: DispatchRule) => void;
  onCreateRule: (nodeType?: 'condition' | 'action' | 'fallback') => void;
  onDeleteRule: (ruleId: string) => void;
  onUpdatePositions: (updates: { id: string; x: number; y: number }[]) => void;
}

function StartNode() {
  return (
    <div className="relative">
      <Handle type="source" position={Position.Bottom} className="!bg-[#344453]" />
      <div className="flex items-center gap-2 rounded-2xl border-2 border-[#344453] bg-[#344453] px-6 py-4 shadow-lg">
        <Phone className="h-5 w-5 text-white" />
        <span className="text-sm font-semibold text-white">Appel entrant</span>
      </div>
    </div>
  );
}

function ConditionNode({ data }: NodeProps<FlowNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-[#344453]" />
      <div className="min-w-[240px] rounded-2xl border-2 border-[#E6A817]/30 bg-white shadow-lg transition-all hover:shadow-xl">
        <div className="flex items-center justify-between border-b border-[#344453]/10 bg-[#E6A817]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#E6A817]" />
            <span className="text-sm font-semibold text-[#141F28]">{data.label}</span>
          </div>
          <div className="flex gap-1">
            {data.onEdit && (
              <button
                onClick={data.onEdit}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
            {data.onDelete && (
              <button
                onClick={data.onDelete}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-2 text-xs">
            {data.config?.conditionType === 'intent' && (
              <div className="rounded-lg bg-[#E6A817]/10 px-3 py-2">
                <span className="font-medium text-[#E6A817]">
                  Intent: {data.config.intents?.join(', ') || 'Non défini'}
                </span>
              </div>
            )}
            {data.config?.conditionType === 'time' && (
              <div className="rounded-lg bg-[#E6A817]/10 px-3 py-2">
                <span className="font-medium text-[#E6A817]">
                  Horaire: {data.config.timeRange?.start} - {data.config.timeRange?.end}
                </span>
              </div>
            )}
            {data.config?.conditionType === 'always' && (
              <div className="rounded-lg bg-[#E6A817]/10 px-3 py-2">
                <span className="font-medium text-[#E6A817]">Toujours</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="!bg-[#2D9D78] !left-[25%]" />
      <Handle type="source" position={Position.Bottom} id="false" className="!bg-[#D94052] !left-[75%]" />
    </div>
  );
}

function ActionNode({ data }: NodeProps<FlowNodeData>) {
  const getActionIcon = () => {
    switch (data.config?.actionType) {
      case 'transfer_group':
        return <Layers className="h-4 w-4 text-[#C7601D]" />;
      case 'transfer_agent':
        return <User className="h-4 w-4 text-[#C7601D]" />;
      case 'voicemail':
        return <MessageSquare className="h-4 w-4 text-[#C7601D]" />;
      case 'hangup':
        return <PhoneOff className="h-4 w-4 text-[#C7601D]" />;
      default:
        return <Phone className="h-4 w-4 text-[#C7601D]" />;
    }
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-[#344453]" />
      <div className="min-w-[240px] rounded-2xl border-2 border-[#C7601D]/30 bg-white shadow-lg transition-all hover:shadow-xl">
        <div className="flex items-center justify-between border-b border-[#344453]/10 bg-[#C7601D]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            {getActionIcon()}
            <span className="text-sm font-semibold text-[#141F28]">{data.label}</span>
          </div>
          <div className="flex gap-1">
            {data.onEdit && (
              <button
                onClick={data.onEdit}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            )}
            {data.onDelete && (
              <button
                onClick={data.onDelete}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-2 text-xs">
            {data.config?.distributionStrategy && (
              <div className="rounded-lg bg-[#C7601D]/10 px-3 py-2">
                <span className="font-medium text-[#C7601D]">
                  {data.config.distributionStrategy === 'sequential' && 'Séquentiel'}
                  {data.config.distributionStrategy === 'random' && 'Aléatoire'}
                  {data.config.distributionStrategy === 'simultaneous' && 'Simultané'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#344453]" />
    </div>
  );
}

function FallbackNode({ data }: NodeProps<FlowNodeData>) {
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-[#344453]" />
      <div className="min-w-[200px] rounded-2xl border-2 border-[#2D9D78]/30 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#344453]/10 bg-[#2D9D78]/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#2D9D78]" />
            <span className="text-sm font-semibold text-[#141F28]">{data.label}</span>
          </div>
          {data.onDelete && (
            <button
              onClick={data.onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] hover:bg-[#D94052]/12"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = {
  start: StartNode,
  condition: ConditionNode,
  action: ActionNode,
  fallback: FallbackNode,
};

export default function DispatchFlowBuilder({
  rules,
  groups: _groups,
  staff: _staff,
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
    const newNodes: Node<FlowNodeData>[] = [];
    const newEdges: Edge[] = [];

    const startNode: Node<FlowNodeData> = {
      id: 'start',
      type: 'start',
      position: { x: 400, y: 50 },
      data: { type: 'start', label: 'Appel entrant' },
      draggable: false,
    };
    newNodes.push(startNode);

    if (rules.length === 0) {
      setNodes(newNodes);
      setEdges([]);
      return;
    }

    let yOffset = 200;
    const xCenter = 400;

    rules.forEach((rule, idx) => {
      const conditionNode: Node<FlowNodeData> = {
        id: `${rule.id}-condition`,
        type: 'condition',
        position: {
          x: rule.position_x !== undefined && rule.position_x !== null ? rule.position_x : xCenter - 120,
          y: rule.position_y !== undefined && rule.position_y !== null ? rule.position_y : yOffset,
        },
        data: {
          type: 'condition',
          label: rule.name,
          config: {
            conditionType: rule.condition_type,
            intents: rule.conditions?.intents,
          },
          onEdit: () => onRuleClick(rule),
          onDelete: () => onDeleteRule(rule.id),
        },
      };
      newNodes.push(conditionNode);

      const actionNode: Node<FlowNodeData> = {
        id: `${rule.id}-action`,
        type: 'action',
        position: {
          x: xCenter - 120,
          y: yOffset + 180,
        },
        data: {
          type: 'action',
          label: rule.target_type === 'group' ? (rule.target_group_name || 'Groupe') : 'Agent',
          config: {
            actionType: rule.target_type === 'group' ? 'transfer_group' : 'transfer_agent',
            targetGroupId: rule.target_group_id || undefined,
            targetStaffId: rule.target_staff_id || undefined,
            distributionStrategy: rule.distribution_strategy,
          },
        },
      };
      newNodes.push(actionNode);

      if (rule.fallback_type !== 'none') {
        const fallbackNode: Node<FlowNodeData> = {
          id: `${rule.id}-fallback`,
          type: 'fallback',
          position: {
            x: xCenter + 150,
            y: yOffset + 180,
          },
          data: {
            type: 'fallback',
            label: rule.fallback_type === 'voicemail' ? 'Messagerie' : 'Autre',
          },
        };
        newNodes.push(fallbackNode);

        newEdges.push({
          id: `${rule.id}-action-fallback`,
          source: `${rule.id}-action`,
          target: `${rule.id}-fallback`,
          sourceHandle: null,
          type: 'smoothstep',
          animated: true,
          label: 'Pas de réponse',
          labelStyle: { fontSize: 10, fill: '#D94052' },
          labelBgStyle: { fill: 'white' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#D94052' },
          style: { stroke: '#D94052', strokeWidth: 2, strokeDasharray: '5,5' },
        });
      }

      if (idx === 0) {
        newEdges.push({
          id: `start-${rule.id}`,
          source: 'start',
          target: `${rule.id}-condition`,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#344453' },
          style: { stroke: '#344453', strokeWidth: 2 },
        });
      }

      newEdges.push({
        id: `${rule.id}-condition-action`,
        source: `${rule.id}-condition`,
        sourceHandle: 'true',
        target: `${rule.id}-action`,
        type: 'smoothstep',
        animated: true,
        label: 'Oui',
        labelStyle: { fontSize: 10, fill: '#2D9D78' },
        labelBgStyle: { fill: 'white' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#2D9D78' },
        style: { stroke: '#2D9D78', strokeWidth: 2 },
      });

      if (idx < rules.length - 1) {
        newEdges.push({
          id: `${rule.id}-condition-next`,
          source: `${rule.id}-condition`,
          sourceHandle: 'false',
          target: `${rules[idx + 1].id}-condition`,
          type: 'smoothstep',
          animated: true,
          label: 'Non',
          labelStyle: { fontSize: 10, fill: '#D94052' },
          labelBgStyle: { fill: 'white' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#D94052' },
          style: { stroke: '#D94052', strokeWidth: 2 },
        });
      }

      yOffset += 360;
    });

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

  const [showNodeMenu, setShowNodeMenu] = useState(false);

  const handleAddNode = (type: 'condition' | 'action' | 'fallback') => {
    setShowNodeMenu(false);
    onCreateRule(type);
  };

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
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        connectionLineStyle={{ stroke: '#344453', strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#344453" style={{ opacity: 0.15 }} />
        <Controls
          className="rounded-xl border border-[#344453]/10 bg-white shadow-sm"
          showInteractive={false}
        />
        <Panel position="top-right" className="space-y-2">
          <div className="relative">
            <button
              onClick={() => setShowNodeMenu(!showNodeMenu)}
              className="flex items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#b35519]"
            >
              <Plus className="h-4 w-4" />
              Ajouter un nœud
            </button>
            {showNodeMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 space-y-1 rounded-2xl border border-[#344453]/10 bg-white p-2 shadow-xl">
                <button
                  onClick={() => handleAddNode('condition')}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-[#E6A817]/5"
                >
                  <GitBranch className="h-4 w-4 text-[#E6A817]" />
                  <div>
                    <p className="text-sm font-semibold text-[#141F28]">Condition</p>
                    <p className="text-xs text-[#344453]/50">Intent, horaire, appelant…</p>
                  </div>
                </button>
                <button
                  onClick={() => handleAddNode('action')}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-[#C7601D]/5"
                >
                  <Phone className="h-4 w-4 text-[#C7601D]" />
                  <div>
                    <p className="text-sm font-semibold text-[#141F28]">Action</p>
                    <p className="text-xs text-[#344453]/50">Transfert, messagerie…</p>
                  </div>
                </button>
                <button
                  onClick={() => handleAddNode('fallback')}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-[#2D9D78]/5"
                >
                  <MessageSquare className="h-4 w-4 text-[#2D9D78]" />
                  <div>
                    <p className="text-sm font-semibold text-[#141F28]">Fallback</p>
                    <p className="text-xs text-[#344453]/50">Si pas de réponse</p>
                  </div>
                </button>
              </div>
            )}
          </div>
          {hasChanges && (
            <button
              onClick={handleSavePositions}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#2D9D78] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#268a66]"
            >
              <Check className="h-4 w-4" />
              Sauvegarder
            </button>
          )}
        </Panel>
        <Panel position="bottom-left" className="rounded-xl border border-[#344453]/10 bg-white p-3 shadow-sm">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#2D9D78]" />
              <span className="text-[#344453]/60">Condition vraie</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#D94052]" />
              <span className="text-[#344453]/60">Condition fausse</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-dashed border-[#D94052]" />
              <span className="text-[#344453]/60">Fallback</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
