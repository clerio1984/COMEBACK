// Web Audio API Synthesizer for Mozambique's "ComeBack" applet
// Generates unique, highly-polished audio tones directly using the browser's hardware oscillators

export type SoundType = 'radar' | 'chime' | 'retro' | 'zen';

export interface SoundOption {
  id: SoundType;
  name: string;
  description: string;
  icon: string;
}

export const SOUND_OPTIONS: SoundOption[] = [
  {
    id: 'radar',
    name: 'Radar de Busca (Clássico)',
    description: 'Som clássico de sonar de radar. Duas notas agudas e cristalinas reminiscentes de deteção.',
    icon: 'fa-solid fa-satellite-dish'
  },
  {
    id: 'chime',
    name: 'Sino Digital (Acolhedor)',
    description: 'Arpejo melódico e reconfortante em tons maiores. Transmite sucesso e tranquilidade.',
    icon: 'fa-solid fa-wand-magic-sparkles'
  },
  {
    id: 'retro',
    name: 'Sweep Laser (Fácil Deteção)',
    description: 'Frequência descendente moderna estilo arcade. Extremamente fácil de reconhecer e audível.',
    icon: 'fa-solid fa-bolt'
  },
  {
    id: 'zen',
    name: 'Sino Zen (Discreto)',
    description: 'Um som calmo e profundo com ressonância de taça tibetana. Subtil e não intrusivo.',
    icon: 'fa-solid fa-spa'
  }
];

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. RADAR (Sonar dual pitch ping)
function playRadar(ctx: AudioContext) {
  const now = ctx.currentTime;
  
  // First pulse
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(1200, now);
  osc1.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
  
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  
  // Second pulse (staggered)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1300, now + 0.15);
  osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.3);
  
  gain2.gain.setValueAtTime(0.0, now);
  gain2.gain.setValueAtTime(0.3, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  
  osc1.start(now);
  osc1.stop(now + 0.4);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.55);
}

// 2. CHIME (C5 -> E5 -> G5 -> C6 Arpeggio)
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  const delay = 0.08;
  const noteDuration = 0.4;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'triangle'; // softer than sine/sawtooth for chime
    osc.frequency.setValueAtTime(freq, now + (idx * delay));
    
    // Smooth attack and decay
    gainNode.gain.setValueAtTime(0, now + (idx * delay));
    gainNode.gain.linearRampToValueAtTime(0.2, now + (idx * delay) + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + (idx * delay) + noteDuration);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now + (idx * delay));
    osc.stop(now + (idx * delay) + noteDuration + 0.1);
  });
}

// 3. RETRO (Descending laser synth pitch sweep)
function playRetro(ctx: AudioContext) {
  const now = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'sawtooth';
  // Rapid pitch fall
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.25);
  
  // Bright sharp envelope
  gainNode.gain.setValueAtTime(0.15, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
  // Sub-oscillator for fat retro sound
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(400, now);
  subOsc.frequency.linearRampToValueAtTime(800, now + 0.2);
  
  subGain.gain.setValueAtTime(0.15, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  subOsc.connect(subGain);
  subGain.connect(ctx.destination);
  
  osc.start(now);
  osc.stop(now + 0.35);
  subOsc.start(now);
  subOsc.stop(now + 0.35);
}

// 4. ZEN (Incredibly rich and soft brassy chime/bowl sound)
function playZen(ctx: AudioContext) {
  const now = ctx.currentTime;
  
  // Principal frequency
  const freq = 440; // A4
  
  // Zen bowl tone requires multiple harmonics
  const harmonics = [1.0, 1.5, 2.0, 2.6, 3.2];
  const gains = [0.2, 0.1, 0.08, 0.05, 0.03];
  
  harmonics.forEach((mult, idx) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, now);
    
    // Slow entry and very long decay
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gains[idx], now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 1.3);
  });
}

// Play by sound config name helper
export function playNotificationSound(soundName: string | undefined | null) {
  try {
    const ctx = getAudioContext();
    const normalizedName = (soundName || 'radar') as SoundType;
    
    switch (normalizedName) {
      case 'chime':
        playChime(ctx);
        break;
      case 'retro':
        playRetro(ctx);
        break;
      case 'zen':
        playZen(ctx);
        break;
      case 'radar':
      default:
        playRadar(ctx);
        break;
    }
  } catch (err) {
    console.warn('[Web Audio Playback Error] Não foi possível reproduzir som:', err);
  }
}
