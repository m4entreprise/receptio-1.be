import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Pencil, Phone, X, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: string;
  voicemail_message: string | null;
  enabled: boolean;
  created_at: string;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  role: 'Secrétaire',
  voicemailMessage: '',
};

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('/api/staff');
      setStaff(res.data.staff || []);
    } catch {
      setError('Impossible de charger l\'équipe.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setShowForm(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setForm({
      firstName: member.first_name,
      lastName: member.last_name,
      phoneNumber: member.phone_number,
      role: member.role,
      voicemailMessage: member.voicemail_message || '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        await axios.patch(`/api/staff/${editingId}`, {
          firstName: form.firstName,
          lastName: form.lastName,
          phoneNumber: form.phoneNumber,
          role: form.role,
          voicemailMessage: form.voicemailMessage || undefined,
        });
      } else {
        await axios.post('/api/staff', {
          firstName: form.firstName,
          lastName: form.lastName,
          phoneNumber: form.phoneNumber,
          role: form.role,
          voicemailMessage: form.voicemailMessage || undefined,
        });
      }
      setShowForm(false);
      await fetchStaff();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce membre de l\'équipe ?')) return;
    try {
      await axios.delete(`/api/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('Erreur lors de la suppression.');
    }
  };

  const toggleEnabled = async (member: StaffMember) => {
    try {
      await axios.patch(`/api/staff/${member.id}`, { enabled: !member.enabled });
      setStaff((prev) =>
        prev.map((s) => (s.id === member.id ? { ...s, enabled: !s.enabled } : s))
      );
    } catch {
      setError('Erreur lors de la mise à jour.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
            <p className="text-sm font-medium text-[#344453]/50">Chargement de l'équipe…</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        {/* Hero header */}
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
              <Sparkles className="h-3.5 w-3.5" />
              Gestion de l'équipe
            </div>
            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
                Vos secrétaires, en un clic.
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Ajoutez les membres de votre équipe, configurez leur numéro de renvoi et leur message de messagerie vocale personnalisé.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 rounded-[28px] border border-[#344453]/10 bg-white p-5 shadow-sm sm:p-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Équipe</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>{staff.length}</p>
              <p className="mt-1 text-sm text-[#344453]/50">{staff.filter((s) => s.enabled).length} actif{staff.filter((s) => s.enabled).length !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519]"
            >
              <Plus className="h-4 w-4" />
              Ajouter un membre
            </button>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
            {error}
          </div>
        )}

        {/* Form modal overlay */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-lg rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                  {editingId ? 'Modifier le membre' : 'Nouveau membre'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Prénom</label>
                    <input
                      required
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Nom</label>
                    <input
                      required
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#344453]">Numéro de téléphone (renvoi d'appel)</label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 focus-within:border-[#344453]/25 focus-within:bg-white">
                    <Phone className="h-4 w-4 shrink-0 text-[#344453]/35" />
                    <input
                      required
                      type="tel"
                      placeholder="+32 470 12 34 56"
                      value={form.phoneNumber}
                      onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                      className="w-full bg-transparent text-sm text-[#141F28] outline-none placeholder:text-[#344453]/30"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[#344453]/45">Le numéro vers lequel l'appel sera transféré.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#344453]">Fonction</label>
                  <input
                    type="text"
                    placeholder="Secrétaire, Assistant(e), Réceptionniste…"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#344453]">Message de messagerie vocale</label>
                  <textarea
                    rows={3}
                    placeholder={`Bonjour, ${form.firstName || '[Prénom]'} ${form.lastName || '[Nom]'} a essayé de vous joindre. N'hésitez pas à nous recontacter.`}
                    value={form.voicemailMessage}
                    onChange={(e) => setForm({ ...form, voicemailMessage: e.target.value })}
                    className="mt-1.5 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#141F28] outline-none transition focus:border-[#344453]/25 focus:bg-white"
                  />
                  <p className="mt-1.5 text-xs text-[#344453]/45">Laissez vide pour utiliser le message automatique.</p>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-full bg-[#344453] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:opacity-50"
                  >
                    {saving ? 'Sauvegarde…' : editingId ? 'Enregistrer' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Staff list */}
        <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
          <div className="border-b border-[#344453]/8 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Membres de l'équipe</h2>
                <p className="mt-0.5 text-sm text-[#344453]/55">Gérez vos secrétaires et agents de renvoi d'appel.</p>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-6">
            {staff.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-[#344453]/25" />
                <p className="text-base font-medium text-[#141F28]">Aucun membre pour l'instant</p>
                <p className="mt-2 text-sm text-[#344453]/55">Ajoutez votre première secrétaire en cliquant sur « Ajouter un membre ».</p>
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className={`rounded-[24px] border transition ${
                      member.enabled
                        ? 'border-[#344453]/8 bg-[#F8F9FB]'
                        : 'border-[#344453]/5 bg-[#344453]/4 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#344453] text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-title)' }}>
                          {member.first_name[0]}{member.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-[#141F28]">
                            {member.first_name} {member.last_name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#344453]/50">
                            <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 font-medium text-[#344453]">{member.role}</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{member.phone_number}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleEnabled(member)}
                          title={member.enabled ? 'Désactiver' : 'Activer'}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                            member.enabled
                              ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78] hover:bg-[#2D9D78]/15'
                              : 'border-[#344453]/15 bg-white text-[#344453]/40 hover:bg-[#344453]/5'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => openEdit(member)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5"
                        >
                          {expandedId === member.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <button
                          onClick={() => handleDelete(member.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] transition hover:bg-[#D94052]/12"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {expandedId === member.id && (
                      <div className="border-t border-[#344453]/8 px-4 py-4 sm:px-5">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Message de messagerie vocale</p>
                        <p className="mt-2 text-sm leading-6 text-[#344453]/65 italic">
                          {member.voicemail_message ||
                            `Bonjour, ${member.first_name} ${member.last_name} a essayé de vous joindre. N'hésitez pas à nous recontacter.`}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
