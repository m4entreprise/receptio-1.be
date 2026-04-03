import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { Phone, Clock, Calendar, ArrowLeft, Trash2, Download, Sparkles, ShieldCheck, Play, Pause, Loader2, Volume2 } from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Layout from '../components/Layout';

interface CallAction {
  type: string;
  description: string;
}

interface CallDetailItem {
  id: string;
  caller_number?: string | null;
  created_at: string;
  duration?: number | null;
  status: string;
  summary?: string | null;
  intent?: string | null;
  transcription_text?: string | null;
  language?: string | null;
  confidence?: number | null;
  recording_url?: string | null;
  actions?: CallAction[];
}

export default function CallDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [call, setCall] = useState<CallDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState<string | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    fetchCallDetail();
  }, [id]);

  useEffect(() => {
    let objectUrl: string | null = null;

    const fetchRecording = async () => {
      if (!call?.recording_url || !id) {
        setRecordingBlobUrl(null);
        setRecordingLoading(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setAudioDuration(0);
        return;
      }

      setRecordingLoading(true);

      try {
        const response = await axios.get(`/api/calls/${id}/recording`, {
          responseType: 'blob',
        });

        objectUrl = URL.createObjectURL(response.data);
        setRecordingBlobUrl(objectUrl);
      } catch (error) {
        console.error('Error fetching call recording:', error);
        setRecordingBlobUrl(null);
      } finally {
        setRecordingLoading(false);
      }
    };

    fetchRecording();

    return () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setAudioDuration(0);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [call?.recording_url, id]);

  const handleTogglePlayback = async () => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value: number) => {
    const nextVolume = Math.max(0, Math.min(1, value));
    setVolume(nextVolume);

    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  };

  const fetchCallDetail = async () => {
    try {
      const response = await axios.get(`/api/calls/${id}`);
      setCall(response.data.call as CallDetailItem);
    } catch (error) {
      console.error('Error fetching call detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet appel ?')) return;
    
    setDeleting(true);
    try {
      await axios.delete(`/api/calls/${id}`);
      navigate('/calls');
    } catch (error) {
      console.error('Error deleting call:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-black/10 border-t-[#111118]" />
            <p className="text-sm font-medium text-[#6f685d]">Chargement de l’appel…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!call) {
    return (
      <Layout>
        <div className="rounded-[28px] border border-dashed border-black/10 bg-white/70 px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[#171821]">Appel non trouvé</p>
          <p className="mt-2 text-sm text-[#6f685d]">Ce détail n’est plus disponible ou n’existe pas.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-5 sm:space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[28px] border border-black/5 bg-[#111118] p-5 text-white shadow-[0_24px_60px_rgba(17,17,24,0.18)] sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <button
                  onClick={() => navigate('/calls')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-stone-200 transition hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux appels
                </button>

                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Détail d'appel
                </div>

                <div className="mt-5 space-y-3">
                  <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f2e8] sm:text-4xl">
                    {call.caller_number || 'Numéro inconnu'}
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-stone-300 sm:text-base">
                    Consultez le contexte complet de l’échange, sa synthèse, sa transcription et les éventuelles actions associées dans une vue claire et mobile first.
                  </p>
                </div>
              </div>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300/40 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Repères rapides</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Statut</p>
                <span className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  call.status === 'completed'
                    ? 'bg-blue-100 text-blue-700'
                    : call.status === 'answered'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {call.status === 'completed' ? 'Terminé' : call.status === 'answered' ? 'Répondu' : 'Reçu'}
                </span>
              </div>

              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4">
                <p className="text-sm text-[#8b8478]">Durée</p>
                <p className="mt-2 text-base font-semibold text-[#171821]">
                  {call.duration ? `${call.duration} secondes` : 'Indisponible'}
                </p>
              </div>

              <div className="rounded-2xl bg-[#f4f1ea] px-4 py-4 sm:col-span-2">
                <p className="text-sm text-[#8b8478]">Date</p>
                <p className="mt-2 text-base font-semibold text-[#171821]">
                  {format(new Date(call.created_at), 'PPpp', { locale: fr })}
                </p>
              </div>

              {(call.language || call.confidence) && (
                <div className="sm:col-span-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  {call.language ? `langue détectée: ${call.language.toUpperCase()}` : 'analyse disponible'}
                  {call.confidence ? ` • confiance: ${(call.confidence * 100).toFixed(0)}%` : ''}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#171821]">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Numéro</p>
                  <p className="mt-2 text-base font-semibold text-[#171821]">{call.caller_number || 'Inconnu'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#171821]">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Date complète</p>
                  <p className="mt-2 text-sm leading-7 text-[#171821]">{format(new Date(call.created_at), 'PPpp', { locale: fr })}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ea] text-[#171821]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#8b8478]">Durée</p>
                  <p className="mt-2 text-sm leading-7 text-[#171821]">{call.duration ? `${call.duration} secondes` : 'N/A'}</p>
                </div>
              </div>
            </div>

            {call.actions && call.actions.length > 0 && (
              <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Actions effectuées</h2>
                <ul className="mt-4 space-y-3">
                  {call.actions.map((action, index) => (
                    <li key={`${action.type}-${index}`} className="rounded-2xl bg-[#f7f4ee] px-4 py-3 text-sm leading-7 text-[#5f5a52]">
                      <span className="font-semibold text-[#171821]">{action.type}</span>
                      <span className="text-[#8b8478]"> — </span>
                      <span>{action.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {call.summary && (
              <div className="rounded-[28px] border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-blue-900">Résumé IA</h2>
                <p className="mt-4 text-sm leading-7 text-blue-800">{call.summary}</p>
                {call.intent && (
                  <div className="mt-4">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                      Intention: {call.intent}
                    </span>
                  </div>
                )}
              </div>
            )}

            {call.transcription_text && (
              <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Transcription</h2>
                <div className="mt-4 rounded-[24px] border border-black/5 bg-[#f7f4ee] p-4 sm:p-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#5f5a52]">
                    {call.transcription_text}
                  </p>
                </div>
              </div>
            )}

            {call.recording_url && (
              <div className="rounded-[28px] border border-black/5 bg-white/80 p-5 shadow-sm sm:p-6">
                <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#171821]">Enregistrement audio</h2>
                <div className="mt-4 rounded-[24px] border border-black/5 bg-[#f7f4ee] p-4 sm:p-5">
                  {recordingLoading && (
                    <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-4 text-sm text-[#5f5a52]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#171821]" />
                      Chargement de l’enregistrement...
                    </div>
                  )}

                  {!recordingLoading && recordingBlobUrl && (
                    <>
                      <audio
                        ref={audioRef}
                        src={recordingBlobUrl}
                        onLoadedData={() => {
                          if (audioRef.current) {
                            audioRef.current.volume = volume;
                          }
                        }}
                        onLoadedMetadata={(event) => {
                          const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
                          setAudioDuration(nextDuration);
                        }}
                        onTimeUpdate={(event) => {
                          setCurrentTime(event.currentTarget.currentTime);
                        }}
                        onPause={() => setIsPlaying(false)}
                        onPlay={() => setIsPlaying(true)}
                        onEnded={() => {
                          setIsPlaying(false);
                          setCurrentTime(0);
                          if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                          }
                        }}
                        className="hidden"
                      />

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={handleTogglePlayback}
                            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#171821] text-white transition hover:bg-[#262837]"
                          >
                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-4 text-sm text-[#6f685d]">
                              <span className="font-medium text-[#171821]">Message vocal</span>
                              <span>
                                {formatAudioTime(currentTime)} / {formatAudioTime(audioDuration)}
                              </span>
                            </div>

                            <input
                              type="range"
                              min={0}
                              max={audioDuration || 0}
                              step={0.1}
                              value={Math.min(currentTime, audioDuration || 0)}
                              onChange={(event) => handleSeek(Number(event.target.value))}
                              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-black/10 accent-[#171821]"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3 rounded-full border border-black/10 bg-white px-3 py-2">
                            <Volume2 className="h-4 w-4 shrink-0 text-[#171821]" />
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.01}
                              value={volume}
                              onChange={(event) => handleVolumeChange(Number(event.target.value))}
                              className="h-2 w-24 cursor-pointer appearance-none rounded-full bg-black/10 accent-[#171821] sm:w-28"
                            />
                          </div>

                          <a
                            href={recordingBlobUrl}
                            download={`appel-${call.id}.mp3`}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-[#171821] transition hover:bg-[#fcfbf8]"
                            title="Télécharger l'enregistrement"
                            aria-label="Télécharger l'enregistrement"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}

function formatAudioTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
