import { useEffect, useState } from 'react';
import {
  Users, Plus, Trash2, Pencil, Phone, X, Check, Sparkles,
  ChevronDown, ChevronUp, Layers, Clock, UserPlus, GitBranch, ArrowRight, Info,
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';

/* ─── Types ──────────────────────────────────────────────────────────────── */

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

interface DaySchedule { enabled: boolean; open: string; close: string; }
interface WeeklySchedule {
  monday: DaySchedule; tuesday: DaySchedule; wednesday: DaySchedule;
  thursday: DaySchedule; friday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule;
}
interface GroupMember { id: string; first_name: string; last_name: string; phone_number: string; role: string; enabled: boolean; }
interface StaffGroup {
  id: string; name: string; description: string | null; role: string | null;
  schedule: WeeklySchedule; enabled: boolean; members: GroupMember[]; created_at: string;
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
  target_group_name: string | null;
  target_group_role: string | null;
  target_staff_first_name: string | null;
  target_staff_last_name: string | null;
  fallback_group_name: string | null;
  fallback_staff_first_name: string | null;
  fallback_staff_last_name: string | null;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const DAYS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: 'monday', label: 'Lun' }, { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mer' }, { key: 'thursday', label: 'Jeu' },
  { key: 'friday', label: 'Ven' }, { key: 'saturday', label: 'Sam' },
  { key: 'sunday', label: 'Dim' },
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  monday:    { enabled: true,  open: '08:00', close: '18:00' },
  tuesday:   { enabled: true,  open: '08:00', close: '18:00' },
  wednesday: { enabled: true,  open: '08:00', close: '18:00' },
  thursday:  { enabled: true,  open: '08:00', close: '18:00' },
  friday:    { enabled: true,  open: '08:00', close: '18:00' },
  saturday:  { enabled: false, open: '08:00', close: '18:00' },
  sunday:    { enabled: false, open: '08:00', close: '18:00' },
};

const emptyStaffForm = { firstName: '', lastName: '', phoneNumber: '', role: 'Secrétaire', voicemailMessage: '' };
const emptyGroupForm = { name: '', description: '', role: '', schedule: DEFAULT_SCHEDULE };
const emptyRuleForm = {
  name: '',
  description: '',
  conditionType: 'always' as 'always' | 'intent',
  intentKeywords: '',
  targetType: 'group' as 'group' | 'agent',
  targetGroupId: '',
  targetStaffId: '',
  distributionStrategy: 'sequential' as 'sequential' | 'random' | 'simultaneous',
  agentOrder: [] as string[],
  fallbackType: 'voicemail' as 'voicemail' | 'none' | 'group' | 'agent',
  fallbackGroupId: '',
  fallbackStaffId: '',
};

/* ═══════════════════════════════════════════════════════════════════════════
   STAFF TAB
═══════════════════════════════════════════════════════════════════════════ */

function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyStaffForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get('/api/staff');
      setStaff(res.data.staff || []);
    } catch { setError('Impossible de charger l\'équipe.'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingId(null); setForm({ ...emptyStaffForm }); setError(''); setShowForm(true); };
  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setForm({ firstName: m.first_name, lastName: m.last_name, phoneNumber: m.phone_number, role: m.role, voicemailMessage: m.voicemail_message || '' });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { firstName: form.firstName, lastName: form.lastName, phoneNumber: form.phoneNumber, role: form.role, voicemailMessage: form.voicemailMessage || undefined };
      if (editingId) await axios.patch(`/api/staff/${editingId}`, payload);
      else await axios.post('/api/staff', payload);
      setShowForm(false); await fetchStaff();
    } catch (err: any) { setError(err?.response?.data?.error || 'Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce membre de l\'équipe ?')) return;
    try { await axios.delete(`/api/staff/${id}`); setStaff(prev => prev.filter(s => s.id !== id)); }
    catch { setError('Erreur lors de la suppression.'); }
  };

  const toggleEnabled = async (m: StaffMember) => {
    try {
      await axios.patch(`/api/staff/${m.id}`, { enabled: !m.enabled });
      setStaff(prev => prev.map(s => s.id === m.id ? { ...s, enabled: !s.enabled } : s));
    } catch { setError('Erreur lors de la mise à jour.'); }
  };

  if (loading) return (
    <div className="flex h-[30vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats + add button */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Membres</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>{staff.length}</p>
          <p className="mt-0.5 text-sm text-[#344453]/50">{staff.filter(s => s.enabled).length} actif{staff.filter(s => s.enabled).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519]">
          <Plus className="h-4 w-4" /> Ajouter un membre
        </button>
      </div>

      {error && <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                {editingId ? 'Modifier le membre' : 'Nouveau membre'}
              </h2>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-4 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-[#344453]">Prénom</label>
                  <input required type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#344453]">Nom</label>
                  <input required type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Numéro de téléphone (renvoi d'appel)</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 focus-within:border-[#344453]/25 focus-within:bg-white">
                  <Phone className="h-4 w-4 shrink-0 text-[#344453]/35" />
                  <input required type="tel" placeholder="+32 470 12 34 56" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} className="w-full bg-transparent text-sm outline-none placeholder:text-[#344453]/30" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Fonction</label>
                <input type="text" placeholder="Secrétaire, Assistant(e), Réceptionniste…" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Message de messagerie vocale</label>
                <textarea rows={3} placeholder={`Bonjour, ${form.firstName || '[Prénom]'} ${form.lastName || '[Nom]'} a essayé de vous joindre. N'hésitez pas à nous recontacter.`} value={form.voicemailMessage} onChange={e => setForm({ ...form, voicemailMessage: e.target.value })} className="mt-1.5 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
                <p className="mt-1.5 text-xs text-[#344453]/45">Laissez vide pour utiliser le message automatique.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-full bg-[#344453] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:opacity-50">
                  {saving ? 'Sauvegarde…' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
        <div className="border-b border-[#344453]/8 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]"><Users className="h-5 w-5" /></div>
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
              {staff.map(member => (
                <div key={member.id} className={`rounded-[24px] border transition ${member.enabled ? 'border-[#344453]/8 bg-[#F8F9FB]' : 'border-[#344453]/5 bg-[#344453]/4 opacity-60'}`}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#344453] text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-title)' }}>
                        {member.first_name[0]}{member.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-[#141F28]">{member.first_name} {member.last_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#344453]/50">
                          <span className="rounded-full bg-[#344453]/8 px-2 py-0.5 font-medium text-[#344453]">{member.role}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{member.phone_number}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleEnabled(member)} title={member.enabled ? 'Désactiver' : 'Activer'} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${member.enabled ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78] hover:bg-[#2D9D78]/15' : 'border-[#344453]/15 bg-white text-[#344453]/40 hover:bg-[#344453]/5'}`}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(member)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setExpandedId(expandedId === member.id ? null : member.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5">
                        {expandedId === member.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(member.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] transition hover:bg-[#D94052]/12">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {expandedId === member.id && (
                    <div className="border-t border-[#344453]/8 px-4 py-4 sm:px-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Message de messagerie vocale</p>
                      <p className="mt-2 text-sm leading-6 text-[#344453]/65 italic">
                        {member.voicemail_message || `Bonjour, ${member.first_name} ${member.last_name} a essayé de vous joindre. N'hésitez pas à nous recontacter.`}
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
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULE EDITOR
═══════════════════════════════════════════════════════════════════════════ */

function ScheduleEditor({ schedule, onChange }: { schedule: WeeklySchedule; onChange: (s: WeeklySchedule) => void }) {
  const updateDay = (day: keyof WeeklySchedule, field: keyof DaySchedule, value: boolean | string) => {
    onChange({ ...schedule, [day]: { ...schedule[day], [field]: value } });
  };

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const day = schedule[key];
        return (
          <div key={key} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 transition ${day.enabled ? 'border-[#344453]/12 bg-[#F8F9FB]' : 'border-[#344453]/6 bg-transparent opacity-50'}`}>
            <button type="button" onClick={() => updateDay(key, 'enabled', !day.enabled)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${day.enabled ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/20 text-[#344453]/40'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {label}
            </button>
            <input type="time" value={day.open} disabled={!day.enabled} onChange={e => updateDay(key, 'open', e.target.value)} className="rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-sm text-[#141F28] outline-none disabled:opacity-40" style={{ fontFamily: 'var(--font-mono)' }} />
            <span className="text-xs text-[#344453]/40">→</span>
            <input type="time" value={day.close} disabled={!day.enabled} onChange={e => updateDay(key, 'close', e.target.value)} className="rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-sm text-[#141F28] outline-none disabled:opacity-40" style={{ fontFamily: 'var(--font-mono)' }} />
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUPS TAB
═══════════════════════════════════════════════════════════════════════════ */

function GroupsTab() {
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyGroupForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { Promise.all([fetchGroups(), fetchStaff()]).finally(() => setLoading(false)); }, []);

  const fetchGroups = async () => {
    const res = await axios.get('/api/staff-groups');
    setGroups(res.data.groups || []);
  };
  const fetchStaff = async () => {
    const res = await axios.get('/api/staff');
    setAllStaff(res.data.staff || []);
  };

  const openCreate = () => { setEditingId(null); setForm({ ...emptyGroupForm, schedule: DEFAULT_SCHEDULE }); setError(''); setShowForm(true); };
  const openEdit = (g: StaffGroup) => {
    setEditingId(g.id);
    setForm({ name: g.name, description: g.description || '', role: g.role || '', schedule: g.schedule || DEFAULT_SCHEDULE });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { name: form.name, description: form.description || undefined, role: form.role || undefined, schedule: form.schedule };
      if (editingId) await axios.patch(`/api/staff-groups/${editingId}`, payload);
      else await axios.post('/api/staff-groups', payload);
      setShowForm(false); await fetchGroups();
    } catch (err: any) { setError(err?.response?.data?.error || 'Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Supprimer ce groupe ?')) return;
    try { await axios.delete(`/api/staff-groups/${id}`); setGroups(prev => prev.filter(g => g.id !== id)); }
    catch { setError('Erreur lors de la suppression.'); }
  };

  const toggleGroupEnabled = async (g: StaffGroup) => {
    try {
      await axios.patch(`/api/staff-groups/${g.id}`, { enabled: !g.enabled });
      setGroups(prev => prev.map(gr => gr.id === g.id ? { ...gr, enabled: !gr.enabled } : gr));
    } catch { setError('Erreur lors de la mise à jour.'); }
  };

  const addMember = async (groupId: string, staffId: string) => {
    try { await axios.post(`/api/staff-groups/${groupId}/members`, { staffId }); await fetchGroups(); }
    catch (err: any) { setError(err?.response?.data?.error || 'Erreur lors de l\'ajout.'); }
  };

  const removeMember = async (groupId: string, staffId: string) => {
    try { await axios.delete(`/api/staff-groups/${groupId}/members/${staffId}`); await fetchGroups(); }
    catch { setError('Erreur lors de la suppression du membre.'); }
  };

  const activeDays = (schedule: WeeklySchedule) =>
    DAYS.filter(d => schedule[d.key]?.enabled).map(d => d.label).join(', ') || 'Aucun jour';

  if (loading) return (
    <div className="flex h-[30vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Stats + add */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Groupes</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>{groups.length}</p>
          <p className="mt-0.5 text-sm text-[#344453]/50">{groups.filter(g => g.enabled).length} actif{groups.filter(g => g.enabled).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519]">
          <Plus className="h-4 w-4" /> Créer un groupe
        </button>
      </div>

      {error && <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm py-8 px-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                {editingId ? 'Modifier le groupe' : 'Nouveau groupe'}
              </h2>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-4 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#344453]">Nom du groupe <span className="text-[#D94052]">*</span></label>
                <input required type="text" placeholder="Ex: Support client, Ventes, Direction…" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Rôle / type de groupe</label>
                <input type="text" placeholder="Ex: support, ventes, urgences, direction…" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
                <p className="mt-1.5 text-xs text-[#344453]/45">Utilisé par l'IA pour orienter les appels vers ce groupe.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Description</label>
                <textarea rows={2} placeholder="Décrivez le rôle de ce groupe…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
              </div>
              <div>
                <label className="mb-3 block text-sm font-medium text-[#344453]">Horaires de disponibilité</label>
                <ScheduleEditor schedule={form.schedule} onChange={s => setForm({ ...form, schedule: s })} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-full bg-[#344453] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:opacity-50">
                  {saving ? 'Sauvegarde…' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups list */}
      <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
        <div className="border-b border-[#344453]/8 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]"><Layers className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Groupes d'agents</h2>
              <p className="mt-0.5 text-sm text-[#344453]/55">Organisez votre équipe en groupes pour le dispatch d'appels.</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          {groups.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
              <Layers className="mx-auto mb-4 h-12 w-12 text-[#344453]/25" />
              <p className="text-base font-medium text-[#141F28]">Aucun groupe pour l'instant</p>
              <p className="mt-2 text-sm text-[#344453]/55">Créez votre premier groupe pour organiser le dispatch d'appels par l'IA.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const membersInGroup = group.members.map(m => m.id);
                const availableStaff = allStaff.filter(s => !membersInGroup.includes(s.id));
                const isExpanded = expandedId === group.id;

                return (
                  <div key={group.id} className={`rounded-[24px] border transition ${group.enabled ? 'border-[#344453]/8 bg-[#F8F9FB]' : 'border-[#344453]/5 bg-[#344453]/4 opacity-60'}`}>
                    {/* Group header */}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#344453] text-white">
                          <Layers className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#141F28]">{group.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#344453]/50">
                            {group.role && <span className="rounded-full bg-[#C7601D]/10 px-2 py-0.5 font-medium text-[#C7601D]">{group.role}</span>}
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{group.members.length} membre{group.members.length !== 1 ? 's' : ''}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{activeDays(group.schedule)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleGroupEnabled(group)} title={group.enabled ? 'Désactiver' : 'Activer'} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${group.enabled ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78] hover:bg-[#2D9D78]/15' : 'border-[#344453]/15 bg-white text-[#344453]/40 hover:bg-[#344453]/5'}`}>
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(group)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : group.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        <button onClick={() => handleDeleteGroup(group.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] transition hover:bg-[#D94052]/12">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: members + schedule */}
                    {isExpanded && (
                      <div className="border-t border-[#344453]/8 px-4 py-4 sm:px-5 space-y-5">
                        {/* Description */}
                        {group.description && (
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>Description</p>
                            <p className="mt-1.5 text-sm text-[#344453]/65">{group.description}</p>
                          </div>
                        )}

                        {/* Schedule summary */}
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Horaires</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DAYS.map(({ key, label }) => {
                              const day = group.schedule?.[key];
                              return (
                                <div key={key} className={`rounded-xl border px-3 py-1.5 text-xs ${day?.enabled ? 'border-[#344453]/15 bg-white text-[#141F28]' : 'border-[#344453]/6 text-[#344453]/30'}`} style={{ fontFamily: 'var(--font-mono)' }}>
                                  <span className="font-medium">{label}</span>
                                  {day?.enabled && <span className="ml-1.5 text-[#344453]/50">{day.open}–{day.close}</span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Members */}
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-[#344453]/40 mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Membres du groupe</p>
                          {group.members.length === 0 ? (
                            <p className="text-sm text-[#344453]/45 italic">Aucun membre assigné.</p>
                          ) : (
                            <div className="space-y-2">
                              {group.members.map(m => (
                                <div key={m.id} className="flex items-center justify-between rounded-2xl border border-[#344453]/8 bg-white px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white ${m.enabled ? 'bg-[#344453]' : 'bg-[#344453]/40'}`}>
                                      {m.first_name[0]}{m.last_name[0]}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-[#141F28]">{m.first_name} {m.last_name}</p>
                                      <p className="text-xs text-[#344453]/45">{m.role}</p>
                                    </div>
                                  </div>
                                  <button onClick={() => removeMember(group.id, m.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] transition hover:bg-[#D94052]/12">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add member dropdown */}
                          {availableStaff.length > 0 && (
                            <div className="mt-3 flex items-center gap-2">
                              <UserPlus className="h-4 w-4 shrink-0 text-[#344453]/40" />
                              <select
                                defaultValue=""
                                onChange={e => { if (e.target.value) { addMember(group.id, e.target.value); e.target.value = ''; } }}
                                className="flex-1 rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-3 py-2 text-sm text-[#344453] outline-none focus:border-[#344453]/25 focus:bg-white"
                              >
                                <option value="">Ajouter un membre…</option>
                                {availableStaff.map(s => (
                                  <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DISPATCH TAB
═══════════════════════════════════════════════════════════════════════════ */

function DispatchTab() {
  const [rules, setRules] = useState<DispatchRule[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyRuleForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchRules(), fetchGroups(), fetchStaff()]).finally(() => setLoading(false));
  }, []);

  const fetchRules = async () => {
    const res = await axios.get('/api/dispatch-rules');
    setRules(res.data.rules || []);
  };
  const fetchGroups = async () => {
    const res = await axios.get('/api/staff-groups');
    setGroups(res.data.groups || []);
  };
  const fetchStaff = async () => {
    const res = await axios.get('/api/staff');
    setAllStaff(res.data.staff || []);
  };

  const openCreate = () => { setEditingId(null); setForm({ ...emptyRuleForm }); setError(''); setShowForm(true); };
  const openEdit = (r: DispatchRule) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      description: r.description || '',
      conditionType: r.condition_type,
      intentKeywords: (r.conditions?.intents || []).join(', '),
      targetType: r.target_type,
      targetGroupId: r.target_group_id || '',
      targetStaffId: r.target_staff_id || '',
      distributionStrategy: r.distribution_strategy,
      agentOrder: r.agent_order || [],
      fallbackType: r.fallback_type,
      fallbackGroupId: r.fallback_group_id || '',
      fallbackStaffId: r.fallback_staff_id || '',
    });
    setError(''); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        conditionType: form.conditionType,
        conditions: form.conditionType === 'intent'
          ? { intents: form.intentKeywords.split(',').map(s => s.trim()).filter(Boolean) }
          : {},
        targetType: form.targetType,
        targetGroupId: form.targetType === 'group' ? (form.targetGroupId || null) : null,
        targetStaffId: form.targetType === 'agent' ? (form.targetStaffId || null) : null,
        distributionStrategy: form.distributionStrategy,
        agentOrder: form.distributionStrategy === 'sequential' ? form.agentOrder : [],
        fallbackType: form.fallbackType,
        fallbackGroupId: form.fallbackType === 'group' ? (form.fallbackGroupId || null) : null,
        fallbackStaffId: form.fallbackType === 'agent' ? (form.fallbackStaffId || null) : null,
      };
      if (editingId) await axios.patch(`/api/dispatch-rules/${editingId}`, payload);
      else await axios.post('/api/dispatch-rules', payload);
      setShowForm(false); await fetchRules();
    } catch (err: any) { setError(err?.response?.data?.error || 'Erreur lors de la sauvegarde.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette règle de dispatch ?')) return;
    try { await axios.delete(`/api/dispatch-rules/${id}`); setRules(prev => prev.filter(r => r.id !== id)); }
    catch { setError('Erreur lors de la suppression.'); }
  };

  const toggleEnabled = async (r: DispatchRule) => {
    try {
      await axios.patch(`/api/dispatch-rules/${r.id}`, { enabled: !r.enabled });
      setRules(prev => prev.map(rl => rl.id === r.id ? { ...rl, enabled: !rl.enabled } : rl));
    } catch { setError('Erreur lors de la mise à jour.'); }
  };

  const moveRule = async (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= rules.length) return;
    const newRules = [...rules];
    [newRules[idx], newRules[swapIdx]] = [newRules[swapIdx], newRules[idx]];
    setRules(newRules);
    try { await axios.post('/api/dispatch-rules/reorder', { order: newRules.map(r => r.id) }); }
    catch { await fetchRules(); }
  };

  const handleGroupChange = (groupId: string) => {
    const grp = groups.find(g => g.id === groupId);
    const memberIds = grp ? grp.members.map(m => m.id) : [];
    setForm(prev => ({ ...prev, targetGroupId: groupId, agentOrder: memberIds }));
  };

  const moveAgent = (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= form.agentOrder.length) return;
    const newOrder = [...form.agentOrder];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setForm(prev => ({ ...prev, agentOrder: newOrder }));
  };

  const strategyLabel = (s: string) => {
    if (s === 'sequential') return 'Séquentiel';
    if (s === 'random') return 'Aléatoire';
    if (s === 'simultaneous') return 'Simultané';
    return s;
  };

  const fallbackLabel = (r: DispatchRule) => {
    if (r.fallback_type === 'voicemail') return 'Messagerie vocale';
    if (r.fallback_type === 'none') return 'Raccrocher';
    if (r.fallback_type === 'group') return r.fallback_group_name || 'Groupe de repli';
    if (r.fallback_type === 'agent') return `${r.fallback_staff_first_name || ''} ${r.fallback_staff_last_name || ''}`.trim() || 'Agent de repli';
    return '—';
  };

  if (loading) return (
    <div className="flex h-[30vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#344453]/10 border-t-[#344453]" />
    </div>
  );

  const selectedGroup = groups.find(g => g.id === form.targetGroupId);
  const selectedGroupMembers = selectedGroup ? selectedGroup.members : [];

  return (
    <div className="space-y-5">
      {/* Stats + create */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#344453]/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Règles</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.05em] text-[#141F28]" style={{ fontFamily: 'var(--font-mono)' }}>{rules.length}</p>
          <p className="mt-0.5 text-sm text-[#344453]/50">{rules.filter(r => r.enabled).length} active{rules.filter(r => r.enabled).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-5 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(199,96,29,0.28)] transition hover:bg-[#b35519]">
          <Plus className="h-4 w-4" /> Créer une règle
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-[22px] border border-[#344453]/12 bg-[#344453]/5 px-5 py-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#344453]/55" />
        <div>
          <p className="text-sm font-medium text-[#344453]">Comment fonctionne le dispatch ?</p>
          <p className="mt-1 text-sm leading-6 text-[#344453]/60">
            Les règles s'appliquent avec l'Offre A + Routage intelligent, ou avec l'Offre Bbis. L'IA évalue les règles dans l'ordre de priorité et transfère l'appel vers la première cible disponible selon la stratégie choisie.
          </p>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm px-4 py-8">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
                {editingId ? 'Modifier la règle' : 'Nouvelle règle de dispatch'}
              </h2>
              <button onClick={() => setShowForm(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-4 rounded-2xl border border-[#D94052]/20 bg-[#D94052]/6 px-4 py-3 text-sm text-[#D94052]">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-5 space-y-5">

              {/* Name + description */}
              <div>
                <label className="block text-sm font-medium text-[#344453]">Nom de la règle <span className="text-[#D94052]">*</span></label>
                <input required type="text" placeholder="Ex: Transfert support, Dispatch ventes…" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#344453]">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1.5 block w-full resize-none rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
              </div>

              {/* Condition */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#344453]">Déclencheur</label>
                <div className="flex gap-2">
                  {(['always', 'intent'] as const).map(ct => (
                    <button key={ct} type="button" onClick={() => setForm({ ...form, conditionType: ct })}
                      className={`flex-1 rounded-2xl border py-2.5 text-sm font-medium transition ${form.conditionType === ct ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/15 text-[#344453]/60 hover:bg-[#344453]/5'}`}>
                      {ct === 'always' ? 'Toujours' : 'Par intention IA'}
                    </button>
                  ))}
                </div>
                {form.conditionType === 'intent' && (
                  <div className="mt-3">
                    <input type="text" placeholder="Ex: support, urgence, rendez-vous (séparés par virgule)" value={form.intentKeywords} onChange={e => setForm({ ...form, intentKeywords: e.target.value })} className="block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none transition focus:border-[#344453]/25 focus:bg-white" />
                    <p className="mt-1.5 text-xs text-[#344453]/45">L'IA appliquera cette règle quand l'intention détectée correspond à un de ces mots-clés.</p>
                  </div>
                )}
              </div>

              {/* Target */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#344453]">Cible du transfert</label>
                <div className="flex gap-2 mb-3">
                  {(['group', 'agent'] as const).map(tt => (
                    <button key={tt} type="button" onClick={() => setForm({ ...form, targetType: tt, targetGroupId: '', targetStaffId: '', agentOrder: [] })}
                      className={`flex-1 rounded-2xl border py-2.5 text-sm font-medium transition ${form.targetType === tt ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/15 text-[#344453]/60 hover:bg-[#344453]/5'}`}>
                      {tt === 'group' ? "Groupe d'agents" : 'Agent spécifique'}
                    </button>
                  ))}
                </div>

                {form.targetType === 'group' && (
                  <div className="space-y-3">
                    <select value={form.targetGroupId} onChange={e => handleGroupChange(e.target.value)}
                      className="block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453] outline-none focus:border-[#344453]/25 focus:bg-white">
                      <option value="">Sélectionner un groupe…</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.role ? ` (${g.role})` : ''}</option>)}
                    </select>

                    {form.targetGroupId && (
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Stratégie de distribution</label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            { val: 'sequential', label: 'Séquentiel', desc: 'En ordre défini' },
                            { val: 'random', label: 'Aléatoire', desc: 'Au hasard' },
                            { val: 'simultaneous', label: 'Simultané', desc: 'Tous en même temps' },
                          ] as const).map(({ val, label, desc }) => (
                            <button key={val} type="button" onClick={() => setForm({ ...form, distributionStrategy: val })}
                              className={`rounded-2xl border py-3 text-center transition ${form.distributionStrategy === val ? 'border-[#C7601D] bg-[#C7601D]/8 text-[#C7601D]' : 'border-[#344453]/12 text-[#344453]/55 hover:bg-[#344453]/5'}`}>
                              <p className="text-xs font-semibold">{label}</p>
                              <p className="mt-0.5 text-[10px] opacity-70">{desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.targetGroupId && form.distributionStrategy === 'sequential' && form.agentOrder.length > 0 && (
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-[#344453]/45" style={{ fontFamily: 'var(--font-mono)' }}>Ordre de priorité</label>
                        <div className="space-y-2">
                          {form.agentOrder.map((agentId, i) => {
                            const member = selectedGroupMembers.find(m => m.id === agentId) || allStaff.find(s => s.id === agentId);
                            return (
                              <div key={agentId} className="flex items-center gap-3 rounded-2xl border border-[#344453]/8 bg-[#F8F9FB] px-4 py-2.5">
                                <span className="w-5 text-xs font-semibold text-[#344453]/40" style={{ fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#344453] text-white text-xs font-semibold">
                                  {member ? `${member.first_name[0]}${member.last_name[0]}` : '?'}
                                </div>
                                <p className="flex-1 text-sm font-medium text-[#141F28]">
                                  {member ? `${member.first_name} ${member.last_name}` : agentId}
                                </p>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => moveAgent(i, -1)} disabled={i === 0} className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#344453]/12 text-[#344453]/50 hover:bg-[#344453]/5 disabled:opacity-25">
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" onClick={() => moveAgent(i, 1)} disabled={i === form.agentOrder.length - 1} className="flex h-7 w-7 items-center justify-center rounded-xl border border-[#344453]/12 text-[#344453]/50 hover:bg-[#344453]/5 disabled:opacity-25">
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {form.targetType === 'agent' && (
                  <select value={form.targetStaffId} onChange={e => setForm({ ...form, targetStaffId: e.target.value })}
                    className="block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453] outline-none focus:border-[#344453]/25 focus:bg-white">
                    <option value="">Sélectionner un agent…</option>
                    {allStaff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
                  </select>
                )}
              </div>

              {/* Fallback */}
              <div>
                <label className="mb-2 block text-sm font-medium text-[#344453]">Si personne ne répond…</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: 'voicemail', label: 'Messagerie vocale' },
                    { val: 'none', label: 'Raccrocher' },
                    { val: 'group', label: 'Autre groupe' },
                    { val: 'agent', label: 'Autre agent' },
                  ] as const).map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setForm({ ...form, fallbackType: val, fallbackGroupId: '', fallbackStaffId: '' })}
                      className={`rounded-2xl border py-2.5 text-sm font-medium transition ${form.fallbackType === val ? 'border-[#344453] bg-[#344453] text-white' : 'border-[#344453]/15 text-[#344453]/60 hover:bg-[#344453]/5'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.fallbackType === 'group' && (
                  <select value={form.fallbackGroupId} onChange={e => setForm({ ...form, fallbackGroupId: e.target.value })}
                    className="mt-3 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453] outline-none focus:border-[#344453]/25 focus:bg-white">
                    <option value="">Sélectionner un groupe de repli…</option>
                    {groups.filter(g => g.id !== form.targetGroupId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                {form.fallbackType === 'agent' && (
                  <select value={form.fallbackStaffId} onChange={e => setForm({ ...form, fallbackStaffId: e.target.value })}
                    className="mt-3 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm text-[#344453] outline-none focus:border-[#344453]/25 focus:bg-white">
                    <option value="">Sélectionner un agent de repli…</option>
                    {allStaff.filter(s => s.id !== form.targetStaffId).map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role}</option>)}
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5">Annuler</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-full bg-[#344453] py-3 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(52,68,83,0.22)] transition hover:bg-[#2a3642] disabled:opacity-50">
                  {saving ? 'Sauvegarde…' : editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules list */}
      <section className="rounded-[28px] border border-[#344453]/10 bg-white shadow-sm">
        <div className="border-b border-[#344453]/8 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#344453]/8 text-[#344453]"><GitBranch className="h-5 w-5" /></div>
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>Règles de dispatch</h2>
              <p className="mt-0.5 text-sm text-[#344453]/55">Définissez comment les appels sont routés vers vos agents, par ordre de priorité.</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          {rules.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
              <GitBranch className="mx-auto mb-4 h-12 w-12 text-[#344453]/25" />
              <p className="text-base font-medium text-[#141F28]">Aucune règle pour l'instant</p>
              <p className="mt-2 text-sm text-[#344453]/55">Créez votre première règle pour configurer le routage des appels.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div key={rule.id} className={`rounded-[24px] border transition ${rule.enabled ? 'border-[#344453]/8 bg-[#F8F9FB]' : 'border-[#344453]/5 bg-[#344453]/4 opacity-60'}`}>
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#344453]/15 bg-white text-xs font-semibold text-[#344453]/50" style={{ fontFamily: 'var(--font-mono)' }}>
                        {idx + 1}
                      </div>
                      <div className="space-y-2">
                        <p className="font-semibold text-[#141F28]">{rule.name}</p>
                        {rule.description && <p className="text-xs text-[#344453]/50">{rule.description}</p>}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded-full border border-[#344453]/15 bg-white px-2.5 py-1 font-medium text-[#344453]">
                            {rule.condition_type === 'always' ? 'Toujours' : `Intent: ${(rule.conditions?.intents || []).join(', ')}`}
                          </span>
                          <ArrowRight className="h-3 w-3 text-[#344453]/30" />
                          <span className="rounded-full border border-[#C7601D]/20 bg-[#C7601D]/8 px-2.5 py-1 font-medium text-[#C7601D]">
                            {rule.target_type === 'group'
                              ? `${rule.target_group_name || 'Groupe'} · ${strategyLabel(rule.distribution_strategy)}`
                              : `${rule.target_staff_first_name || ''} ${rule.target_staff_last_name || ''}`.trim() || 'Agent'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-[#344453]/30" />
                          <span className="rounded-full border border-[#2D9D78]/20 bg-[#2D9D78]/8 px-2.5 py-1 font-medium text-[#2D9D78]">
                            {fallbackLabel(rule)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => toggleEnabled(rule)} title={rule.enabled ? 'Désactiver' : 'Activer'}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${rule.enabled ? 'border-[#2D9D78]/25 bg-[#2D9D78]/8 text-[#2D9D78] hover:bg-[#2D9D78]/15' : 'border-[#344453]/15 bg-white text-[#344453]/40 hover:bg-[#344453]/5'}`}>
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(rule)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => moveRule(idx, -1)} disabled={idx === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5 disabled:opacity-30">
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button onClick={() => moveRule(idx, 1)} disabled={idx === rules.length - 1} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#344453]/15 bg-white text-[#344453] transition hover:bg-[#344453]/5 disabled:opacity-30">
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#D94052]/20 bg-[#D94052]/6 text-[#D94052] transition hover:bg-[#D94052]/12">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT PAGE
═══════════════════════════════════════════════════════════════════════════ */

type Tab = 'membres' | 'groupes' | 'dispatch';

export default function Staff() {
  const [activeTab, setActiveTab] = useState<Tab>('membres');

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        {/* Hero header */}
        <section className="overflow-hidden rounded-[28px] border border-[#344453]/15 bg-[#141F28] p-5 text-white shadow-[0_24px_60px_rgba(20,31,40,0.18)] sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/50" style={{ fontFamily: 'var(--font-mono)' }}>
            <Sparkles className="h-3.5 w-3.5" />
            Gestion de l'équipe
          </div>
          <div className="mt-5 space-y-3">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl" style={{ fontFamily: 'var(--font-title)' }}>
              Votre équipe, organisée.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Gérez vos membres d'équipe, organisez-les en groupes et configurez les règles de dispatch intelligent.
            </p>
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 rounded-[20px] border border-[#344453]/10 bg-white p-1.5 shadow-sm">
          {([
            { id: 'membres', label: 'Membres', icon: Users },
            { id: 'groupes', label: 'Groupes', icon: Layers },
            { id: 'dispatch', label: 'Dispatch', icon: GitBranch },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] py-2.5 text-sm font-medium transition ${
                activeTab === id
                  ? 'bg-[#344453] text-white shadow-[0_4px_14px_rgba(52,68,83,0.18)]'
                  : 'text-[#344453]/60 hover:bg-[#344453]/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'membres' ? <StaffTab /> : activeTab === 'groupes' ? <GroupsTab /> : <DispatchTab />}
      </div>
    </Layout>
  );
}
