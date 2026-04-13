import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Edit2, ChevronRight, X, Check, AlertCircle, Info } from 'lucide-react';
import Layout from '../components/Layout';
import AgentCoachingProfile from '../components/qa/AgentCoachingProfile';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisTemplate {
  id: string;
  name: string;
  callType: string;
  promptTemplate: string;
  version: number;
  isActive: boolean;
  criteriaCount?: number;
  resultsCount?: number;
}

interface AnalysisCriteria {
  id: string;
  templateId: string;
  label: string;
  description: string | null;
  weight: number;
  type: 'boolean' | 'score_0_5' | 'text';
  required: boolean;
  position: number;
}

const CALL_TYPE_LABELS: Record<string, string> = {
  '*': 'Tous les appels',
  sinistre: 'Sinistre',
  nouvelle_affaire: 'Nouvelle affaire',
  urgence: 'Urgence',
};

const CRITERIA_TYPE_LABELS: Record<string, string> = {
  boolean: 'Oui / Non',
  score_0_5: 'Note 0–5',
  text: 'Texte libre',
};

const PROMPT_VARIABLES = ['{{TRANSCRIPTION}}', '{{CRITERES}}', '{{INTENT}}'];

const DEFAULT_PROMPT = `Tu analyses la transcription d'un appel téléphonique pour évaluer la qualité du traitement.

## Transcription
{{TRANSCRIPTION}}

## Intent détecté
{{INTENT}}

## Critères d'évaluation
{{CRITERES}}

Évalue chaque critère selon son type et retourne un JSON structuré.`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

// ── Composants internes ───────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  const colors = {
    success: 'bg-[#2D9D78]/10 border-[#2D9D78]/20 text-[#2D9D78]',
    error: 'bg-[#D94052]/10 border-[#D94052]/20 text-[#D94052]',
    info: 'bg-[#344453]/10 border-[#344453]/20 text-[#344453]',
  };
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg text-sm font-medium ${colors[type]}`}
    >
      {type === 'success' ? <Check className="h-4 w-4" /> : type === 'error' ? <AlertCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-[24px] border border-[#344453]/10 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[#344453]/10 px-6 py-4">
          <h2 className="text-base font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[#344453]/50 hover:bg-[#344453]/8 hover:text-[#344453] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function SettingsQA() {
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AnalysisTemplate | null>(null);
  const [criteria, setCriteria] = useState<AnalysisCriteria[]>([]);
  const [loading, setLoading] = useState(false);
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [staff, setStaff] = useState<Array<{ id: string; first_name: string; last_name: string; enabled?: boolean }>>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  // Modals
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AnalysisTemplate | null>(null);
  const [showCriterionModal, setShowCriterionModal] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<AnalysisCriteria | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Formulaires
  const [tForm, setTForm] = useState({
    name: '',
    callType: '*',
    promptTemplate: DEFAULT_PROMPT,
  });
  const [cForm, setCForm] = useState({
    label: '',
    description: '',
    weight: 10,
    type: 'boolean' as 'boolean' | 'score_0_5' | 'text',
    required: false,
    position: 0,
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Chargement ────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/qa/templates', { headers: authHeaders() });
      // Normalise snake_case → camelCase
      const normalized = (data.templates || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        name: t.name,
        callType:       t.call_type       ?? t.callType       ?? '*',
        promptTemplate: t.prompt_template ?? t.promptTemplate ?? '',
        version:        t.version         ?? 1,
        isActive:       t.is_active       ?? t.isActive       ?? true,
        criteriaCount:  Number(t.criteria_count ?? t.criteriaCount ?? 0),
        resultsCount:   Number(t.results_count  ?? t.resultsCount  ?? 0),
      }));
      setTemplates(normalized as AnalysisTemplate[]);
    } catch {
      showToast('Impossible de charger les templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadCriteria = useCallback(async (templateId: string) => {
    setCriteriaLoading(true);
    try {
      const { data } = await axios.get(`/api/qa/templates/${templateId}/criteria`, {
        headers: authHeaders(),
      });
      const normalized = (data.criteria || []).map((c: Record<string, unknown>) => ({
        id:          c.id,
        templateId:  c.template_id ?? c.templateId,
        label:       c.label,
        description: c.description ?? null,
        weight:      Number(c.weight ?? 10),
        type:        c.type ?? 'boolean',
        required:    Boolean(c.required),
        position:    Number(c.position ?? 0),
      }));
      setCriteria(normalized as AnalysisCriteria[]);
    } catch {
      showToast('Impossible de charger les critères', 'error');
    } finally {
      setCriteriaLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    axios.get('/api/staff', { headers: authHeaders() }).then((res) => {
      const enabled = (res.data.staff || []).filter((member: { enabled?: boolean }) => member.enabled !== false);
      setStaff(enabled);
      if (enabled.length > 0) setSelectedStaffId(enabled[0].id);
    }).catch(() => {
      setStaff([]);
    });
  }, []);

  useEffect(() => {
    if (selectedTemplate) loadCriteria(selectedTemplate.id);
    else setCriteria([]);
  }, [selectedTemplate, loadCriteria]);

  // ── Templates CRUD ────────────────────────────────────────────────────────

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTForm({ name: '', callType: '*', promptTemplate: DEFAULT_PROMPT });
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t: AnalysisTemplate) => {
    setEditingTemplate(t);
    setTForm({ name: t.name, callType: t.callType, promptTemplate: t.promptTemplate });
    setShowTemplateModal(true);
  };

  const saveTemplate = async () => {
    if (!tForm.name.trim()) { showToast('Le nom est requis', 'error'); return; }
    if (!tForm.promptTemplate.trim()) { showToast('Le template de prompt est requis', 'error'); return; }
    try {
      if (editingTemplate) {
        const { data } = await axios.patch(
          `/api/qa/templates/${editingTemplate.id}`,
          { name: tForm.name, callType: tForm.callType, promptTemplate: tForm.promptTemplate },
          { headers: authHeaders() }
        );
        const t = data.template;
        const updated: AnalysisTemplate = {
          id: t.id, name: t.name,
          callType: t.call_type ?? t.callType ?? '*',
          promptTemplate: t.prompt_template ?? t.promptTemplate ?? '',
          version: t.version ?? 1,
          isActive: t.is_active ?? t.isActive ?? true,
        };
        if (data.versioned) {
          showToast(`Version v${updated.version} créée — l'ancienne version est archivée`, 'info');
        } else {
          showToast('Template mis à jour');
        }
        if (selectedTemplate?.id === editingTemplate.id) {
          setSelectedTemplate(updated);
        }
      } else {
        await axios.post(
          '/api/qa/templates',
          { name: tForm.name, callType: tForm.callType, promptTemplate: tForm.promptTemplate },
          { headers: authHeaders() }
        );
        showToast('Template créé');
      }
      setShowTemplateModal(false);
      loadTemplates();
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const deleteTemplate = async (t: AnalysisTemplate) => {
    if (!confirm(`Supprimer le template "${t.name}" ?`)) return;
    try {
      const { data } = await axios.delete(`/api/qa/templates/${t.id}`, { headers: authHeaders() });
      showToast(data.softDeleted ? 'Template archivé (des analyses existent)' : 'Template supprimé', 'info');
      if (selectedTemplate?.id === t.id) setSelectedTemplate(null);
      loadTemplates();
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  // ── Critères CRUD ─────────────────────────────────────────────────────────

  const openNewCriterion = () => {
    setEditingCriterion(null);
    setCForm({ label: '', description: '', weight: 10, type: 'boolean', required: false, position: criteria.length });
    setShowCriterionModal(true);
  };

  const openEditCriterion = (c: AnalysisCriteria) => {
    setEditingCriterion(c);
    setCForm({
      label: c.label,
      description: c.description || '',
      weight: c.weight,
      type: c.type,
      required: c.required,
      position: c.position,
    });
    setShowCriterionModal(true);
  };

  const saveCriterion = async () => {
    if (!cForm.label.trim()) { showToast('Le label est requis', 'error'); return; }
    if (!selectedTemplate) return;
    try {
      if (editingCriterion) {
        await axios.patch(
          `/api/qa/criteria/${editingCriterion.id}`,
          { ...cForm, description: cForm.description || null },
          { headers: authHeaders() }
        );
        showToast('Critère mis à jour');
      } else {
        await axios.post(
          `/api/qa/templates/${selectedTemplate.id}/criteria`,
          { ...cForm, description: cForm.description || null },
          { headers: authHeaders() }
        );
        showToast('Critère ajouté');
      }
      setShowCriterionModal(false);
      loadCriteria(selectedTemplate.id);
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const deleteCriterion = async (c: AnalysisCriteria) => {
    if (!confirm(`Supprimer le critère "${c.label}" ?`)) return;
    try {
      await axios.delete(`/api/qa/criteria/${c.id}`, { headers: authHeaders() });
      showToast('Critère supprimé');
      if (selectedTemplate) loadCriteria(selectedTemplate.id);
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const totalWeight = criteria.filter((c) => c.type !== 'text').reduce((s, c) => s + c.weight, 0);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Modals */}
      {showTemplateModal && (
        <Modal
          title={editingTemplate ? 'Modifier le template' : 'Nouveau template d\'analyse'}
          onClose={() => setShowTemplateModal(false)}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Nom du template *</label>
              <input
                value={tForm.name}
                onChange={(e) => setTForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex. Audit sinistre v1"
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Applicable sur</label>
              <select
                value={tForm.callType}
                onChange={(e) => setTForm((f) => ({ ...f, callType: e.target.value }))}
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
              >
                {Object.entries(CALL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#344453]/60">Template de prompt *</label>
                <div className="flex gap-1">
                  {PROMPT_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTForm((f) => ({ ...f, promptTemplate: f.promptTemplate + '\n' + v }))}
                      className="rounded-lg border border-[#344453]/15 bg-[#F8F9FB] px-2 py-1 text-[10px] font-mono text-[#344453]/60 hover:bg-[#344453]/8 hover:text-[#344453] transition"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={tForm.promptTemplate}
                onChange={(e) => setTForm((f) => ({ ...f, promptTemplate: e.target.value }))}
                rows={12}
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none font-mono resize-y"
              />
              <p className="mt-1.5 text-[11px] text-[#344453]/40">
                Utilisez {'{{TRANSCRIPTION}}'}, {'{{CRITERES}}'}, {'{{INTENT}}'} pour injecter les données de l'appel.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="rounded-full border border-[#344453]/15 px-5 py-2 text-sm text-[#344453]/70 hover:bg-[#344453]/5 transition"
              >
                Annuler
              </button>
              <button
                onClick={saveTemplate}
                className="rounded-full bg-[#344453] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a3844] transition"
              >
                {editingTemplate ? 'Enregistrer' : 'Créer le template'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCriterionModal && (
        <Modal
          title={editingCriterion ? 'Modifier le critère' : 'Nouveau critère'}
          onClose={() => setShowCriterionModal(false)}
        >
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Label *</label>
              <input
                value={cForm.label}
                onChange={(e) => setCForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="ex. Proposition d'hospitalisation"
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Description (pour Mistral)</label>
              <input
                value={cForm.description}
                onChange={(e) => setCForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="ex. L'agent a-t-il explicitement proposé une hospitalisation ?"
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Type de réponse</label>
                <select
                  value={cForm.type}
                  onChange={(e) => setCForm((f) => ({ ...f, type: e.target.value as 'boolean' | 'score_0_5' | 'text' }))}
                  className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
                >
                  {Object.entries(CRITERIA_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">
                  Poids ({cForm.type === 'text' ? 'ignoré' : `${cForm.weight}%`})
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cForm.weight}
                  disabled={cForm.type === 'text'}
                  onChange={(e) => setCForm((f) => ({ ...f, weight: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none disabled:opacity-40"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#344453]/60 mb-1.5">Position</label>
                <input
                  type="number"
                  min={0}
                  value={cForm.position}
                  onChange={(e) => setCForm((f) => ({ ...f, position: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <div
                    onClick={() => setCForm((f) => ({ ...f, required: !f.required }))}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      cForm.required ? 'bg-[#344453]' : 'bg-[#344453]/20'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        cForm.required ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-[#344453]/70">Critère obligatoire</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCriterionModal(false)}
                className="rounded-full border border-[#344453]/15 px-5 py-2 text-sm text-[#344453]/70 hover:bg-[#344453]/5 transition"
              >
                Annuler
              </button>
              <button
                onClick={saveCriterion}
                className="rounded-full bg-[#344453] px-5 py-2 text-sm font-medium text-white hover:bg-[#2a3844] transition"
              >
                {editingCriterion ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#344453]/45 mb-1">
              <Link to="/settings" className="hover:text-[#344453] transition">Paramètres</Link>
              <ChevronRight className="h-3 w-3" />
              <span>Qualité IA</span>
            </div>
            <h1
              className="text-xl font-bold text-[#141F28] sm:text-2xl"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              Templates d'analyse QA
            </h1>
            <p className="mt-1 text-sm text-[#344453]/55">
              Configurez vos critères d'évaluation. Chaque template est analysé par Mistral sur vos transcriptions.
            </p>
          </div>
          <button
            onClick={openNewTemplate}
            className="inline-flex items-center gap-2 rounded-full bg-[#344453] px-4 py-2.5 text-sm font-medium text-white shadow-[0_4px_12px_rgba(52,68,83,0.22)] hover:bg-[#2a3844] transition"
          >
            <Plus className="h-4 w-4" />
            Nouveau template
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Liste templates ── */}
          <div>
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">
              Templates ({templates.filter((t) => t.isActive).length} actif{templates.filter((t) => t.isActive).length !== 1 ? 's' : ''})
            </p>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" />
              </div>
            )}

            {!loading && templates.length === 0 && (
              <div className="rounded-[20px] border border-dashed border-[#344453]/20 bg-white p-8 text-center">
                <p className="text-sm font-medium text-[#344453]/60">Aucun template configuré</p>
                <p className="mt-1 text-xs text-[#344453]/40">Créez votre premier template pour analyser la qualité de vos appels.</p>
              </div>
            )}

            <div className="space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                  className={`cursor-pointer rounded-[20px] border bg-white p-4 shadow-sm transition ${
                    selectedTemplate?.id === t.id
                      ? 'border-[#344453]/40 shadow-md'
                      : 'border-[#344453]/10 hover:border-[#344453]/25'
                  } ${!t.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[#141F28]">{t.name}</p>
                        <span className="shrink-0 rounded-full border border-[#344453]/15 px-2 py-0.5 text-[10px] font-mono text-[#344453]/50">
                          v{t.version}
                        </span>
                        {!t.isActive && (
                          <span className="shrink-0 rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] text-[#344453]/50">
                            archivé
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[#344453]/45">
                        <span>{CALL_TYPE_LABELS[t.callType] || t.callType}</span>
                        <span>·</span>
                        <span>{t.criteriaCount ?? 0} critère{(t.criteriaCount ?? 0) !== 1 ? 's' : ''}</span>
                        {(t.resultsCount ?? 0) > 0 && (
                          <>
                            <span>·</span>
                            <span>{t.resultsCount} analyse{(t.resultsCount ?? 0) !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditTemplate(t); }}
                        className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTemplate(t); }}
                        className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#D94052]/8 hover:text-[#D94052] transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Builder de critères ── */}
          <div>
            {!selectedTemplate ? (
              <div className="rounded-[20px] border border-dashed border-[#344453]/20 bg-white p-8 text-center">
                <p className="text-sm text-[#344453]/50">Sélectionnez un template pour gérer ses critères</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">
                      Critères — {selectedTemplate.name}
                    </p>
                    {criteria.length > 0 && (
                      <p className={`mt-0.5 text-xs ${totalWeight === 100 ? 'text-[#2D9D78]' : 'text-[#C7601D]'}`}>
                        Poids total : {totalWeight}%{totalWeight !== 100 ? ' (recommandé : 100%)' : ' ✓'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={openNewCriterion}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#344453]/8 px-3 py-1.5 text-xs font-medium text-[#344453] hover:bg-[#344453]/15 transition"
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter
                  </button>
                </div>

                {criteriaLoading && (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#344453]/20 border-t-[#344453]" />
                  </div>
                )}

                {!criteriaLoading && criteria.length === 0 && (
                  <div className="rounded-[20px] border border-dashed border-[#344453]/20 bg-white p-6 text-center">
                    <p className="text-sm text-[#344453]/50">Aucun critère défini</p>
                    <p className="mt-1 text-xs text-[#344453]/35">Ajoutez des critères pour guider l'analyse Mistral.</p>
                  </div>
                )}

                <div className="space-y-2">
                  {criteria.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-[16px] border border-[#344453]/10 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-[#141F28]">{c.label}</p>
                            <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] font-medium text-[#344453]/60">
                              {CRITERIA_TYPE_LABELS[c.type]}
                            </span>
                            {c.type !== 'text' && (
                              <span className="rounded-full bg-[#C7601D]/8 px-2 py-0.5 text-[10px] font-medium text-[#C7601D]">
                                {c.weight}%
                              </span>
                            )}
                            {c.required && (
                              <span className="rounded-full bg-[#D94052]/8 px-2 py-0.5 text-[10px] font-medium text-[#D94052]">
                                obligatoire
                              </span>
                            )}
                          </div>
                          {c.description && (
                            <p className="mt-1 text-xs text-[#344453]/50 line-clamp-2">{c.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => openEditCriterion(c)}
                            className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteCriterion(c)}
                            className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#D94052]/8 hover:text-[#D94052] transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#344453]/45 font-medium">Coaching QA</p>
              <h2 className="mt-2 text-xl font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                Profil individuel agent
              </h2>
              <p className="mt-1 text-sm text-[#344453]/55">
                Suivez les axes de progression d'un agent sur les 30 derniers jours.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded-xl border border-[#344453]/20 bg-[#F8F9FB] px-4 py-2.5 text-sm text-[#141F28] focus:border-[#344453]/50 focus:outline-none"
              >
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5">
            {selectedStaffId ? (
              <AgentCoachingProfile staffId={selectedStaffId} period="30d" />
            ) : (
              <div className="rounded-[20px] border border-dashed border-[#344453]/20 bg-[#F8F9FB] p-8 text-center text-sm text-[#344453]/50">
                Aucun agent disponible pour le coaching QA.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
