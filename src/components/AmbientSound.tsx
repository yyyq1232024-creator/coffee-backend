import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const STORAGE_KEY = 'yuran_ambient_sound_enabled';
type SoundGraph = { context: AudioContext; master: GainNode; sources: AudioScheduledSourceNode[] };

export default function AmbientSound() {
  const [enabled, setEnabled] = useState(false);
  const graphRef = useRef<SoundGraph | null>(null);
  const enabledRef = useRef(false);

  const createGraph = () => {
    if (graphRef.current) return graphRef.current;
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextConstructor();
    const master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);

    const padBus = context.createGain();
    const padFilter = context.createBiquadFilter();
    padBus.gain.value = 0.13;
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.Q.value = 0.6;
    padBus.connect(padFilter).connect(master);

    const sources: AudioScheduledSourceNode[] = [];
    [110, 164.81, 220].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = [-7, 4, -2][index];
      gain.gain.value = [0.045, 0.025, 0.018][index];
      oscillator.connect(gain).connect(padBus);
      oscillator.start();
      sources.push(oscillator);
    });

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(padBus.gain);
    lfo.start();
    sources.push(lfo);

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < noiseData.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      noiseData[index] = brown * 2.8;
    }
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 720;
    noiseFilter.Q.value = 0.5;
    noiseGain.gain.value = 0.055;
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start();
    sources.push(noise);
    graphRef.current = { context, master, sources };
    return graphRef.current;
  };

  const fadeTo = async (active: boolean) => {
    const graph = createGraph();
    if (graph.context.state === 'suspended') await graph.context.resume();
    const now = graph.context.currentTime;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setValueAtTime(Math.max(0.0001, graph.master.gain.value), now);
    graph.master.gain.exponentialRampToValueAtTime(active ? 0.32 : 0.0001, now + (active ? 1.4 : 0.45));
    if (!active) {
      window.setTimeout(() => {
        if (!enabledRef.current && graph.context.state === 'running') void graph.context.suspend();
      }, 520);
    }
  };

  useEffect(() => {
    const storedPreference = localStorage.getItem(STORAGE_KEY) === 'true';
    enabledRef.current = storedPreference;
    setEnabled(storedPreference);
    const resumePreferredSound = () => { if (enabledRef.current) void fadeTo(true); };
    window.addEventListener('pointerdown', resumePreferredSound, { once: true });
    const handleVisibility = () => {
      const graph = graphRef.current;
      if (!graph) return;
      if (document.hidden) void graph.context.suspend();
      else if (enabledRef.current) void graph.context.resume();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pointerdown', resumePreferredSound);
      document.removeEventListener('visibilitychange', handleVisibility);
      const graph = graphRef.current;
      if (graph) {
        graph.sources.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
        void graph.context.close();
      }
      graphRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const nextEnabled = !enabledRef.current;
    enabledRef.current = nextEnabled;
    setEnabled(nextEnabled);
    localStorage.setItem(STORAGE_KEY, String(nextEnabled));
    void fadeTo(nextEnabled);
  };

  return (
    <button type="button" onClick={toggleSound} aria-pressed={enabled}
      aria-label={enabled ? '关闭环境声音' : '开启环境声音'}
      className={`ambient-sound-control ${enabled ? 'is-on' : ''}`}>
      <span className="ambient-sound-control__icon" aria-hidden="true">{enabled ? <Volume2 /> : <VolumeX />}</span>
      <span className="ambient-sound-control__copy"><small>AMBIENCE</small><strong>{enabled ? 'ON' : 'OFF'}</strong></span>
      <span className="ambient-sound-control__meter" aria-hidden="true"><i /><i /><i /></span>
    </button>
  );
}
