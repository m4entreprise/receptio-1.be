import { useState } from 'react';
import { Clock, Plus, X, Calendar, AlertCircle } from 'lucide-react';

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface ScheduleException {
  id: string;
  exception_type: 'absence' | 'holiday' | 'custom_hours' | 'available';
  start_date: string;
  end_date: string;
  custom_hours?: { open: string; close: string };
  reason?: string;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
}

interface StaffGroup {
  id: string;
  name: string;
  schedule?: WeeklySchedule;
}

interface AdvancedScheduleManagerProps {
  staff: StaffMember;
  groups: StaffGroup[];
  baseSchedule: WeeklySchedule | null;
  exceptions: ScheduleException[];
  onUpdateBaseSchedule: (schedule: WeeklySchedule) => Promise<void>;
  onAddException: (exception: Omit<ScheduleException, 'id'>) => Promise<void>;
  onDeleteException: (exceptionId: string) => Promise<void>;
}

const DAYS: { key: keyof WeeklySchedule; label: string; short: string }[] = [
  { key: 'monday', label: 'Lundi', short: 'L' },
  { key: 'tuesday', label: 'Mardi', short: 'M' },
  { key: 'wednesday', label: 'Mercredi', short: 'M' },
  { key: 'thursday', label: 'Jeudi', short: 'J' },
  { key: 'friday', label: 'Vendredi', short: 'V' },
  { key: 'saturday', label: 'Samedi', short: 'S' },
  { key: 'sunday', label: 'Dimanche', short: 'D' },
];

const DEFAULT_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, open: '08:00', close: '18:00' },
  tuesday: { enabled: true, open: '08:00', close: '18:00' },
  wednesday: { enabled: true, open: '08:00', close: '18:00' },
  thursday: { enabled: true, open: '08:00', close: '18:00' },
  friday: { enabled: true, open: '08:00', close: '18:00' },
  saturday: { enabled: false, open: '08:00', close: '18:00' },
  sunday: { enabled: false, open: '08:00', close: '18:00' },
};

export default function AdvancedScheduleManager({
  staff,
  groups,
  baseSchedule,
  exceptions,
  onUpdateBaseSchedule,
  onAddException,
  onDeleteException,
}: AdvancedScheduleManagerProps) {
  const [activeTab, setActiveTab] = useState<'base' | 'groups' | 'exceptions'>('base');
  const [schedule, setSchedule] = useState<WeeklySchedule>(baseSchedule || DEFAULT_SCHEDULE);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({
    type: 'absence' as 'absence' | 'holiday' | 'custom_hours' | 'available',
    startDate: '',
    endDate: '',
    customOpen: '08:00',
    customClose: '18:00',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const updateDay = (day: keyof WeeklySchedule, field: keyof DaySchedule, value: boolean | string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSaveBaseSchedule = async () => {
    setSaving(true);
    try {
      await onUpdateBaseSchedule(schedule);
    } finally {
      setSaving(false);
    }
  };

  const handleAddException = async () => {
    if (!exceptionForm.startDate || !exceptionForm.endDate) return;
    setSaving(true);
    try {
      await onAddException({
        exception_type: exceptionForm.type,
        start_date: exceptionForm.startDate,
        end_date: exceptionForm.endDate,
        custom_hours:
          exceptionForm.type === 'custom_hours'
            ? { open: exceptionForm.customOpen, close: exceptionForm.customClose }
            : undefined,
        reason: exceptionForm.reason || undefined,
      });
      setShowExceptionForm(false);
      setExceptionForm({
        type: 'absence',
        startDate: '',
        endDate: '',
        customOpen: '08:00',
        customClose: '18:00',
        reason: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const getExceptionTypeLabel = (type: string) => {
    switch (type) {
      case 'absence':
        return 'Absence';
      case 'holiday':
        return 'Congé';
      case 'custom_hours':
        return 'Horaires spéciaux';
      case 'available':
        return 'Disponible';
      default:
        return type;
    }
  };

  const getExceptionColor = (type: string) => {
    switch (type) {
      case 'absence':
        return 'bg-[#D94052]/10 text-[#D94052] border-[#D94052]/20';
      case 'holiday':
        return 'bg-[#E6A817]/10 text-[#E6A817] border-[#E6A817]/20';
      case 'custom_hours':
        return 'bg-[#C7601D]/10 text-[#C7601D] border-[#C7601D]/20';
      case 'available':
        return 'bg-[#2D9D78]/10 text-[#2D9D78] border-[#2D9D78]/20';
      default:
        return 'bg-[#344453]/10 text-[#344453] border-[#344453]/20';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#141F28]" style={{ fontFamily: 'var(--font-title)' }}>
          Horaires de {staff.first_name} {staff.last_name}
        </h3>
      </div>

      <div className="flex gap-1 rounded-[16px] border border-[#344453]/10 bg-white p-1">
        {[
          { id: 'base', label: 'Horaires de base', icon: Clock },
          { id: 'groups', label: 'Par groupe', icon: Calendar },
          { id: 'exceptions', label: 'Exceptions', icon: AlertCircle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-medium transition ${
              activeTab === id ? 'bg-[#344453] text-white' : 'text-[#344453]/55 hover:bg-[#344453]/5'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'base' && (
        <div className="space-y-4 rounded-[20px] border border-[#344453]/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#344453]/60">
              Horaires par défaut pour ce membre. Peuvent être surchargés par groupe.
            </p>
            <button
              onClick={handleSaveBaseSchedule}
              disabled={saving}
              className="rounded-full bg-[#344453] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a3642] disabled:opacity-50"
            >
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>

          <div className="space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = schedule[key];
              return (
                <div
                  key={key}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                    day.enabled ? 'border-[#344453]/12 bg-[#F8F9FB]' : 'border-[#344453]/6 bg-transparent opacity-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => updateDay(key, 'enabled', !day.enabled)}
                    className={`flex h-8 w-20 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                      day.enabled
                        ? 'border-[#344453] bg-[#344453] text-white'
                        : 'border-[#344453]/20 text-[#344453]/40'
                    }`}
                  >
                    {label}
                  </button>
                  <input
                    type="time"
                    value={day.open}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, 'open', e.target.value)}
                    className="rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-sm text-[#141F28] outline-none disabled:opacity-40"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span className="text-xs text-[#344453]/40">→</span>
                  <input
                    type="time"
                    value={day.close}
                    disabled={!day.enabled}
                    onChange={(e) => updateDay(key, 'close', e.target.value)}
                    className="rounded-xl border border-[#344453]/12 bg-white px-3 py-1.5 text-sm text-[#141F28] outline-none disabled:opacity-40"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="space-y-3">
          {groups.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#141F28]">Aucun groupe</p>
              <p className="mt-1 text-xs text-[#344453]/50">Ce membre n'appartient à aucun groupe pour le moment.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                className="rounded-[20px] border border-[#344453]/10 bg-white p-4 shadow-sm"
              >
                <h4 className="mb-3 font-semibold text-[#141F28]">{group.name}</h4>
                <p className="text-xs text-[#344453]/50">
                  Les horaires par groupe seront implémentés dans la prochaine version.
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'exceptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#344453]/60">Absences, congés et horaires spéciaux</p>
            <button
              onClick={() => setShowExceptionForm(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#C7601D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b35519]"
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          </div>

          {showExceptionForm && (
            <div className="rounded-[20px] border border-[#344453]/10 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-semibold text-[#141F28]">Nouvelle exception</h4>
                <button
                  onClick={() => setShowExceptionForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#344453]/15 text-[#344453] hover:bg-[#344453]/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: 'absence', label: 'Absence' },
                    { val: 'holiday', label: 'Congé' },
                    { val: 'custom_hours', label: 'Horaires spéciaux' },
                    { val: 'available', label: 'Disponible' },
                  ].map(({ val, label }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setExceptionForm({ ...exceptionForm, type: val as any })}
                      className={`rounded-2xl border py-2.5 text-sm font-medium transition ${
                        exceptionForm.type === val
                          ? 'border-[#344453] bg-[#344453] text-white'
                          : 'border-[#344453]/15 text-[#344453]/55 hover:bg-[#344453]/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Date de début</label>
                    <input
                      type="date"
                      value={exceptionForm.startDate}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, startDate: e.target.value })}
                      className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#344453]">Date de fin</label>
                    <input
                      type="date"
                      value={exceptionForm.endDate}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, endDate: e.target.value })}
                      className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                {exceptionForm.type === 'custom_hours' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Heure d'ouverture</label>
                      <input
                        type="time"
                        value={exceptionForm.customOpen}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, customOpen: e.target.value })}
                        className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#344453]">Heure de fermeture</label>
                      <input
                        type="time"
                        value={exceptionForm.customClose}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, customClose: e.target.value })}
                        className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#344453]">Raison (optionnel)</label>
                  <input
                    type="text"
                    value={exceptionForm.reason}
                    onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                    placeholder="Ex: Congé annuel, Formation…"
                    className="mt-1.5 block w-full rounded-2xl border border-[#344453]/12 bg-[#F8F9FB] px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExceptionForm(false)}
                    className="flex-1 rounded-full border border-[#344453]/15 py-3 text-sm font-medium text-[#344453] transition hover:bg-[#344453]/5"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAddException}
                    disabled={saving || !exceptionForm.startDate || !exceptionForm.endDate}
                    className="flex-1 rounded-full bg-[#344453] py-3 text-sm font-semibold text-white transition hover:bg-[#2a3642] disabled:opacity-50"
                  >
                    {saving ? 'Ajout…' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {exceptions.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#344453]/15 bg-[#344453]/4 px-6 py-10 text-center">
                <p className="text-sm font-medium text-[#141F28]">Aucune exception</p>
                <p className="mt-1 text-xs text-[#344453]/50">Ajoutez des absences, congés ou horaires spéciaux.</p>
              </div>
            ) : (
              exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${getExceptionColor(
                    exception.exception_type
                  )}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{getExceptionTypeLabel(exception.exception_type)}</span>
                      <span className="text-xs opacity-60">
                        {exception.start_date} → {exception.end_date}
                      </span>
                    </div>
                    {exception.reason && <p className="mt-1 text-xs opacity-75">{exception.reason}</p>}
                    {exception.custom_hours && (
                      <p className="mt-1 text-xs opacity-75">
                        {exception.custom_hours.open} – {exception.custom_hours.close}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteException(exception.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-current/20 bg-white/50 transition hover:bg-white/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
