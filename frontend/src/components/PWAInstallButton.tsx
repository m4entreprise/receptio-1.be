import { Download, Check, WifiOff } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isOffline, install } = usePWA();

  if (isInstalled) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium cursor-default"
      >
        <Check className="w-4 h-4" />
        <span>Installée</span>
      </button>
    );
  }

  if (isOffline) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm font-medium cursor-default"
      >
        <WifiOff className="w-4 h-4" />
        <span>Hors ligne</span>
      </button>
    );
  }

  if (!isInstallable) {
    return null;
  }

  return (
    <button
      onClick={install}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
    >
      <Download className="w-4 h-4" />
      <span>Installer l'app</span>
    </button>
  );
}
