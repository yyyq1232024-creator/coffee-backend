import { useEffect, useRef, useState } from 'react';
import { Music2, Volume2, VolumeX } from 'lucide-react';

const STORAGE_KEY = 'yuran_ambient_sound_enabled';
const TARGET_VOLUME = 0.2;

export default function AmbientSound() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeFrameRef = useRef(0);
  const [entered, setEntered] = useState(false);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'false');

  const fadeTo = async (target: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    window.cancelAnimationFrame(fadeFrameRef.current);
    if (target > 0) {
      try { await audio.play(); } catch { return; }
    }
    const startVolume = audio.volume;
    const startedAt = performance.now();
    const duration = target > 0 ? 1100 : 420;
    const step = (time: number) => {
      const progress = Math.max(0, Math.min(1, (time - startedAt) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVolume = startVolume + (target - startVolume) * eased;
      audio.volume = Math.max(0, Math.min(1, nextVolume));
      if (progress < 1) fadeFrameRef.current = window.requestAnimationFrame(step);
      else if (target === 0) audio.pause();
    };
    fadeFrameRef.current = window.requestAnimationFrame(step);
  };

  const updateEnabled = (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    localStorage.setItem(STORAGE_KEY, String(nextEnabled));
    if (entered) void fadeTo(nextEnabled ? TARGET_VOLUME : 0);
  };

  const enterExperience = () => {
    setEntered(true);
    if (enabled) void fadeTo(TARGET_VOLUME);
  };

  useEffect(() => {
    const handleVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.hidden) audio.pause();
      else if (entered && enabled) void audio.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.cancelAnimationFrame(fadeFrameRef.current);
    };
  }, [enabled, entered]);

  return (
    <>
      <audio ref={audioRef} src="/media/yuran-ambient.mp3" loop preload="metadata" />

      {!entered && (
        <div className="sound-entry" role="dialog" aria-modal="true" aria-label="进入悠然咖啡体验">
          <div className="sound-entry__grain" aria-hidden="true" />
          <div className="sound-entry__halo" aria-hidden="true" />
          <div className="sound-entry__content">
            <span className="sound-entry__eyebrow">YURAN COFFEE HOUSE · DIGITAL EXPERIENCE</span>
            <h2>把时间，<br />还给这一杯。</h2>
            <p>图片、声音与滚动共同组成这段悠然旅程。</p>
            <button type="button" className="sound-entry__toggle" onClick={() => updateEnabled(!enabled)} aria-pressed={enabled}>
              <span>{enabled ? <Volume2 /> : <VolumeX />}</span>
              SOUND {enabled ? 'ON' : 'OFF'}
            </button>
            <button type="button" className="sound-entry__enter" onClick={enterExperience}>
              <span>进入悠然世界</span><i aria-hidden="true">ENTER</i>
            </button>
          </div>
        </div>
      )}

      {entered && (
        <button
          type="button"
          onClick={() => updateEnabled(!enabled)}
          aria-pressed={enabled}
          aria-label={enabled ? '关闭背景音乐' : '开启背景音乐'}
          className={`ambient-sound-control ${enabled ? 'is-on' : ''}`}
        >
          <span className="ambient-sound-control__icon" aria-hidden="true">{enabled ? <Volume2 /> : <VolumeX />}</span>
          <span className="ambient-sound-control__copy"><small>ORIGINAL BGM</small><strong>{enabled ? 'SOUND ON' : 'SOUND OFF'}</strong></span>
          <span className="ambient-sound-control__meter" aria-hidden="true"><i /><i /><i /></span>
        </button>
      )}

      <span className="sr-only"><Music2 />背景音乐</span>
    </>
  );
}
