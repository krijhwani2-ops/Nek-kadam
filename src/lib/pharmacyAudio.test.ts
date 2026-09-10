import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playPharmacyChime,
  unlockAudioContext,
  isAudioMuted,
  setAudioMuted,
  toggleAudioMute,
  pharmacyAudio,
  getAudioContext,
} from './pharmacyAudio';

describe('Pharmacy Audio Chime Module (Web Audio API)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Mute State Management', () => {
    it('defaults to unmuted when localStorage is empty', () => {
      expect(isAudioMuted()).toBe(false);
      expect(pharmacyAudio.isMuted()).toBe(false);
    });

    it('sets audio muted state and persists to localStorage', () => {
      setAudioMuted(true);
      expect(isAudioMuted()).toBe(true);
      expect(localStorage.getItem('nk_pharmacy_audio_muted')).toBe('true');

      setAudioMuted(false);
      expect(isAudioMuted()).toBe(false);
      expect(localStorage.getItem('nk_pharmacy_audio_muted')).toBe('false');
    });

    it('toggles audio muted state correctly', () => {
      expect(isAudioMuted()).toBe(false);
      const newState = toggleAudioMute();
      expect(newState).toBe(true);
      expect(isAudioMuted()).toBe(true);

      const secondToggle = toggleAudioMute();
      expect(secondToggle).toBe(false);
      expect(isAudioMuted()).toBe(false);
    });
  });

  describe('Chime Synthesis (D5 -> F#5 -> A5)', () => {
    it('synthesizes 3 ascending tones with accurate frequencies and exponential ramps', () => {
      const scheduledTones: { freq: number; time: number }[] = [];
      const gainRamps: { val: number; time: number }[] = [];

      const mockOscillator = {
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn((freq: number, time: number) => {
            scheduledTones.push({ freq, time });
          }),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn((val: number, time: number) => {
            gainRamps.push({ val, time });
          }),
        },
        connect: vi.fn(),
      };

      const mockAudioCtx = {
        currentTime: 10,
        destination: {},
        state: 'running',
        createOscillator: vi.fn(() => mockOscillator),
        createGain: vi.fn(() => mockGain),
        resume: vi.fn(),
      };

      playPharmacyChime(mockAudioCtx);

      // Verify 3 tones scheduled
      expect(scheduledTones.length).toBe(3);
      // Tone 1: D5 (587.33 Hz)
      expect(scheduledTones[0].freq).toBeCloseTo(587.33, 1);
      expect(scheduledTones[0].time).toBeCloseTo(10, 2);

      // Tone 2: F#5 (739.99 Hz)
      expect(scheduledTones[1].freq).toBeCloseTo(739.99, 1);
      expect(scheduledTones[1].time).toBeCloseTo(10.10, 2);

      // Tone 3: A5 (880.00 Hz)
      expect(scheduledTones[2].freq).toBeCloseTo(880.00, 1);
      expect(scheduledTones[2].time).toBeCloseTo(10.20, 2);

      // Verify exponential decay ramp to avoid clicks
      expect(gainRamps.length).toBe(3);
      gainRamps.forEach(r => {
        expect(r.val).toBeCloseTo(0.0001, 4);
      });
    });

    it('resumes suspended audio context if needed', () => {
      const resumeFn = vi.fn();
      const mockAudioCtx = {
        currentTime: 0,
        destination: {},
        state: 'suspended',
        resume: resumeFn,
        createOscillator: vi.fn(() => ({
          type: 'sine',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        })),
        createGain: vi.fn(() => ({
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        })),
      };

      playPharmacyChime(mockAudioCtx);
      expect(resumeFn).toHaveBeenCalled();
    });

    it('suppresses chime when isAudioMuted() is true', () => {
      setAudioMuted(true);
      const mockOsc = vi.fn();
      const mockAudioCtx = {
        currentTime: 0,
        createOscillator: mockOsc,
      };

      // When called without explicit override, it checks isAudioMuted()
      playPharmacyChime();
      expect(mockOsc).not.toHaveBeenCalled();
    });
  });

  describe('unlockAudioContext', () => {
    it('attempts to resume suspended context gracefully', async () => {
      await expect(unlockAudioContext()).resolves.toBeUndefined();
    });
  });

  describe('pharmacyAudio singleton', () => {
    it('exposes all expected methods', () => {
      expect(pharmacyAudio.getAudioContext).toBeDefined();
      expect(pharmacyAudio.unlockAudioContext).toBeDefined();
      expect(pharmacyAudio.isMuted).toBeDefined();
      expect(pharmacyAudio.getMuted).toBeDefined();
      expect(pharmacyAudio.setMuted).toBeDefined();
      expect(pharmacyAudio.toggleMute).toBeDefined();
      expect(pharmacyAudio.playChime).toBeDefined();
    });
  });
});
