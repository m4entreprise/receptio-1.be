import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, X, Check, AlertCircle, Info, GripVertical } from 'lucide-react';
import Layout from '../components/Layout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CallIntent {
  id: string;
  label: string;
  description: string | null;
  keywords: string | null;
  color: string;
  position: number;
  is_active: boolean;
}

const PRESET_COLORS = [
  '#344453', '#C7601D', '#D94052', '#2D9D78',
  '#7C5CBF', '#1D7BC7', '#C7A81D', '#6B7280',
];

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
      <div className="w-full max-w-lg rounded-[24px] border border-[#344453]/10 bg-white shadow-2xl max-h-[90vh] flex flex-col">
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

// ── Formulaire intent ─────────────────────────────────────────────────────────

function IntentModal({
  intent,
  onSave,
  onClose,
}: {
  intent: CallIntent | null;
  onSave: (data: Partial<CallIntent>) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(intent?.label ?? '');
  const [description, setDescription] = useState(intent?.description ?? '');
  const [keywords, setKeywords] = useState(intent?.keywords ?? '');
  const [color, setColor] = useState(intent?.color ?? '#344453');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await onSave({ label: label.trim(), description: description || null, keywords: keywords || null, color });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={intent ? 'Modifier l\'intent' : 'Nouvel intent'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-[#344453]/70 mb-1.5">
            Label <span className="text-[#D94052]">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="ex : sinistre, urgence, devis…"
            className="w-full rounded-xl border border-[#344453]/15 bg-[#344453]/3 px-3 py-2.5 text-sm text-[#141F28] placeholder-[#344453]/40 focus:border-[#344453]/40 focus:outline-none"
            required
          />
          <p className="mt-1 text-[11px] text-[#344453]/50">
            Ce label sera retourné exactement par l'IA lors de la classification.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[#344453]/70 mb-1.5">
            Description <span className="text-[#344453]/40">(optionnel)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="ex : Appel relatif à un sinistre déclaré ou en cours"
            className="w-full rounded-xl border border-[#344453]/15 bg-[#344453]/3 px-3 py-2.5 text-sm text-[#141F28] placeholder-[#344453]/40 focus:border-[#344453]/40 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[#344453]/50">
            Aide l'IA à distinguer les cas ambigus.
          </p>
        </div>

        {/* Mots-clés */}
        <div>
          <label className="block text-xs font-medium text-[#344453]/70 mb-1.5">
            Mots-clés <span className="text-[#344453]/40">(optionnel)</span>
          </label>
          <input
            type="text"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            placeholder="ex : accident, dégât, déclaration, blessé"
            className="w-full rounded-xl border border-[#344453]/15 bg-[#344453]/3 px-3 py-2.5 text-sm text-[#141F28] placeholder-[#344453]/40 focus:border-[#344453]/40 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-[#344453]/50">
            Mots-clés séparés par des virgules. Renforce la précision de la classification.
          </p>
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-xs font-medium text-[#344453]/70 mb-2">
            Couleur <span className="text-[#344453]/40">(pour les analytics)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-7 w-7 rounded-full border-2 transition"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#141F28' : 'transparent',
                  transform: color === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded-full border border-[#344453]/15"
              title="Couleur personnalisée"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#344453]/15 px-4 py-2 text-sm text-[#344453]/70 hover:bg-[#344453]/5 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="rounded-xl bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3848] disabled:opacity-50 transition"
          >
            {saving ? 'Enregistrement…' : intent ? 'Modifier' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function SettingsIntents() {
  const [intents, setIntents] = useState<CallIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CallIntent | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  const loadIntents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/intents', { headers: authHeaders() });
      setIntents(data.intents ?? []);
    } catch {
      showToast('Erreur lors du chargement des intents', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIntents(); }, [loadIntents]);

  async function handleSave(intentData: Partial<CallIntent>) {
    if (editing) {
      await axios.patch(`/api/intents/${editing.id}`, intentData, { headers: authHeaders() });
      showToast('Intent modifié');
    } else {
      await axios.post('/api/intents', { ...intentData, position: intents.length }, { headers: authHeaders() });
      showToast('Intent créé');
    }
    await loadIntents();
  }

  async function handleToggle(intent: CallIntent) {
    try {
      await axios.patch(`/api/intents/${intent.id}`, { isActive: !intent.is_active }, { headers: authHeaders() });
      showToast(intent.is_active ? 'Intent désactivé' : 'Intent activé', 'info');
      await loadIntents();
    } catch {
      showToast('Erreur', 'error');
    }
  }

  async function handleDelete(intent: CallIntent) {
    if (!confirm(`Supprimer l'intent "${intent.label}" ? Cette action est irréversible.`)) return;
    try {
      await axios.delete(`/api/intents/${intent.id}`, { headers: authHeaders() });
      showToast('Intent supprimé');
      await loadIntents();
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    }
  }

  function openCreate() {
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(intent: CallIntent) {
    setEditing(intent);
    setShowModal(true);
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#F7F8FA]">
        {/* Header */}
        <div className="bg-[#141F28] px-6 py-8 md:px-10">
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: 'var(--font-title)' }}
          >
            Intents de qualification
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Configurez les catégories dans lesquelles l'IA classifie automatiquement chaque appel.
          </p>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
          {/* Explication */}
          <div className="mb-6 rounded-2xl border border-[#344453]/10 bg-white p-5">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#344453]/50" />
              <div className="text-sm text-[#344453]/70 space-y-1">
                <p>
                  À la fin de chaque appel, l'IA analyse la transcription et classe l'appel dans
                  l'un des intents que vous définissez ici. Le label doit être explicite et unique.
                </p>
                <p>
                  Ces intents sont utilisés dans les <strong>analytics</strong> et peuvent servir
                  à configurer des règles de <strong>routage automatique</strong>.
                </p>
                <p className="text-[#C7601D]">
                  Si aucun intent n'est configuré, l'IA utilisera les catégories par défaut :
                  rdv, info, urgence, reclamation, autre.
                </p>
              </div>
            </div>
          </div>

          {/* Liste */}
          <div className="rounded-2xl border border-[#344453]/10 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#344453]/10 px-5 py-4">
              <span className="text-sm font-medium text-[#141F28]">
                {intents.length} intent{intents.length !== 1 ? 's' : ''} configuré{intents.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-xl bg-[#344453] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2a3848] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvel intent
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#344453]/20 border-t-[#344453]" />
              </div>
            ) : intents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#344453]/8">
                  <GripVertical className="h-5 w-5 text-[#344453]/40" />
                </div>
                <p className="text-sm text-[#344453]/60">
                  Aucun intent configuré. Les catégories par défaut sont utilisées.
                </p>
                <button
                  onClick={openCreate}
                  className="mt-1 rounded-xl bg-[#344453] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a3848] transition"
                >
                  Créer mon premier intent
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-[#344453]/8">
                {intents.map(intent => (
                  <li key={intent.id} className="flex items-center gap-4 px-5 py-4">
                    {/* Couleur */}
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: intent.color }}
                    />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[#141F28]">{intent.label}</span>
                        {!intent.is_active && (
                          <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 text-[10px] font-medium text-[#344453]/50">
                            Désactivé
                          </span>
                        )}
                      </div>
                      {intent.description && (
                        <p className="mt-0.5 truncate text-xs text-[#344453]/60">{intent.description}</p>
                      )}
                      {intent.keywords && (
                        <p className="mt-0.5 text-[11px] text-[#344453]/40">
                          Mots-clés : {intent.keywords}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toggle actif/inactif */}
                      <button
                        onClick={() => handleToggle(intent)}
                        title={intent.is_active ? 'Désactiver' : 'Activer'}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                          intent.is_active
                            ? 'bg-[#2D9D78]/10 text-[#2D9D78] hover:bg-[#2D9D78]/20'
                            : 'bg-[#344453]/8 text-[#344453]/50 hover:bg-[#344453]/15'
                        }`}
                      >
                        {intent.is_active ? 'Actif' : 'Inactif'}
                      </button>
                      <button
                        onClick={() => openEdit(intent)}
                        className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#344453]/8 hover:text-[#344453] transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(intent)}
                        className="rounded-lg p-1.5 text-[#344453]/40 hover:bg-[#D94052]/8 hover:text-[#D94052] transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Note routage */}
          {intents.length > 0 && (
            <p className="mt-4 text-center text-xs text-[#344453]/50">
              Pour utiliser ces intents dans le routage automatique, configurez vos{' '}
              <a href="/settings" className="underline hover:text-[#344453]">règles de dispatch</a>.
            </p>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <IntentModal
          intent={editing}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}
