/**
 * Pharmacy Web Audio API Synthesizer
 * 
 * Generates an ascending 3-tone chime for clinical dispensary alerts:
 * D5 (587.33 Hz) -> F#5 (739.99 Hz) -> A5 (880.00 Hz)
 * 100% offline, zero external MP3/WAV dependencies, instant playback.
 */

let globalAudioContext: AudioContext | null = null;
const STORAGE_KEY = 'nk_pharmacy_audio_muted';

/**
 * Returns the singleton AudioContext instance, initializing if needed.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!globalAudioContext) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        globalAudioContext = new AudioCtx();
      }
    } catch (e) {
      console.warn('[PHARMACY AUDIO] AudioContext initialization failed:', e);
    }
  }

  return globalAudioContext;
}

/**
 * Unlocks or resumes the AudioContext after user gesture.
 */
export async function unlockAudioContext(): Promise<void> {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch (e) {
    console.warn('[PHARMACY AUDIO] Could not resume audio context:', e);
  }
}

/**
 * Check if the pharmacy chime audio is currently muted.
 */
export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set the pharmacy chime audio mute state.
 */
export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {}
}

/**
 * Toggle the mute state and return the new state.
 */
export function toggleAudioMute(): boolean {
  const current = isAudioMuted();
  const next = !current;
  setAudioMuted(next);
  if (!next) {
    playPharmacyChime();
  }
  return next;
}

/**
 * Synthesizes and plays the 3-tone ascending alert chime.
 * Supports passing a custom or mocked AudioContext.
 */
export function playPharmacyChime(ctxOverride?: any): void {
  // If no override provided, respect mute setting
  if (!ctxOverride && isAudioMuted()) {
    return;
  }

  try {
    const ctx = ctxOverride || getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume?.();
    }

    const now = ctx.currentTime || 0;

    // Ascending medical chime: D5 (587.33 Hz) -> F#5 (739.99 Hz) -> A5 (880.00 Hz)
    const notes = [
      { freq: 587.33, start: 0.00, dur: 0.16 }, // D5
      { freq: 739.99, start: 0.10, dur: 0.16 }, // F#5
      { freq: 880.00, start: 0.20, dur: 0.35 }, // A5
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur);
    });
  } catch (e) {
    console.warn('[PHARMACY AUDIO] Chime synthesis failed:', e);
  }
}

// Auto-unlock listener on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudioContext();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}

/**
 * Singleton manager object for object-oriented callers.
 */
export const pharmacyAudio = {
  getAudioContext,
  unlockAudioContext,
  isMuted: isAudioMuted,
  getMuted: isAudioMuted,
  setMuted: setAudioMuted,
  toggleMute: toggleAudioMute,
  playChime: playPharmacyChime,
};
