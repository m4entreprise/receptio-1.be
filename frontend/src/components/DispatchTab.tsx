import { useEffect, useState, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import axios from 'axios';
import { AlertCircle, RefreshCw } from 'lucide-react';
import DispatchFlowBuilder, { StaffGroup, StaffMember } from './DispatchFlowBuilder';
import { useAuth } from '../contexts/AuthContext';

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
    </div>
  );
}

function Banner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {msg}
    </div>
  );
}

// ─── Nœud d'entrée par défaut ─────────────────────────────────────────────────

const ENTRY_NODE: Node = {
  id: 'entry',
  type: 'entry',
  position: { x: 400, y: 60 },
  data: {},
};

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DispatchTab() {
  const { token } = useAuth();
  const headers   = { Authorization: `Bearer ${token}` };

  const [groups, setGroups]   = useState<StaffGroup[]>([]);
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [nodes, setNodes]     = useState<Node[]>([ENTRY_NODE]);
  const [edges, setEdges]     = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [saveOk, setSaveOk]   = useState(false);

  // ─── Chargement initial ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      axios.get('/api/staff-groups', { headers }).then(r => r.data),
      axios.get('/api/staff', { headers }).then(r => r.data),
      axios.get('/api/dispatch/flow', { headers }).then(r => r.data),
    ])
      .then(([groupsData, staffData, flowData]) => {
        if (cancelled) return;
        setGroups(groupsData.groups ?? groupsData ?? []);
        setStaff((staffData.staff ?? staffData ?? []).filter((s: StaffMember) => s.enabled));

        const flowNodes: Node[] = flowData.nodes ?? [ENTRY_NODE];
        const flowEdges: Edge[] = flowData.edges ?? [];

        // S'assurer qu'il y a toujours un nœud entry
        if (!flowNodes.find((n: Node) => n.id === 'entry')) {
          flowNodes.unshift(ENTRY_NODE);
        }

        setNodes(flowNodes);
        setEdges(flowEdges);
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.data?.error ?? 'Erreur de chargement');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [token]);

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  const handleSave = useCallback(async (newNodes: Node[], newEdges: Edge[]) => {
    setSaving(true);
    setError('');
    try {
      await axios.put('/api/dispatch/flow', { nodes: newNodes, edges: newEdges }, { headers });
      setNodes(newNodes);
      setEdges(newEdges);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur de sauvegarde';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }, [token]);

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (loading) return <Loader />;

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      {/* Bandeau d'erreur */}
      {error && (
        <div className="px-4 pt-3">
          <Banner msg={error} />
        </div>
      )}

      {/* Confirmation de sauvegarde */}
      {saveOk && (
        <div className="flex items-center gap-2 border-b border-green-100 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
          <RefreshCw className="h-3.5 w-3.5" />
          Flow sauvegardé avec succès
        </div>
      )}

      {/* Instructions */}
      <div className="border-b border-[#344453]/8 bg-[#F8F9FB] px-4 py-2.5 text-xs text-[#344453]/55">
        <span className="font-semibold text-[#344453]/70">Flow builder :</span>{' '}
        glissez des nœuds depuis la palette gauche · connectez les poignées · cliquez pour configurer · enregistrez.
      </div>

      {/* Flow builder — prend tout l'espace restant */}
      <div className="flex-1 min-h-0">
        <DispatchFlowBuilder
          groups={groups}
          staff={staff}
          nodes={nodes}
          edges={edges}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
