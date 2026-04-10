export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'in-progress'
  | 'queued'
  | 'transferred'
  | 'completed'
  | 'missed'
  | 'failed'
  | 'busy'
  | 'canceled'
  | 'received'
  | string;

export interface StatusDisplay {
  label: string;
  color: string;
}

export function getStatusDisplay(status: CallStatus): StatusDisplay {
  switch (status) {
    case 'completed':
      return { label: 'Terminé', color: 'bg-[#344453]/10 text-[#344453]' };
    case 'transferred':
      return { label: 'Transféré', color: 'bg-[#2D9D78]/12 text-[#2D9D78]' };
    case 'missed':
      return { label: 'Manqué', color: 'bg-[#D94052]/10 text-[#D94052]' };
    case 'queued':
      return { label: 'En attente', color: 'bg-[#E6A817]/12 text-[#E6A817]' };
    case 'answered':
    case 'in-progress':
      return { label: 'En cours', color: 'bg-[#C7601D]/10 text-[#C7601D]' };
    case 'failed':
    case 'busy':
    case 'canceled':
      return { label: 'Échoué', color: 'bg-[#D94052]/10 text-[#D94052]' };
    case 'received':
    case 'initiated':
    case 'ringing':
    default:
      return { label: 'Reçu', color: 'bg-[#E6A817]/12 text-[#E6A817]' };
  }
}

export function isTerminalStatus(status: CallStatus): boolean {
  return ['completed', 'missed', 'transferred', 'failed', 'busy', 'canceled'].includes(status);
}
