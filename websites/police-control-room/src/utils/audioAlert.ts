/**
 * GuardianBand Emergency Audio Alert Engine
 * 
 * Features:
 * 1. Automatic AudioContext unlocking on user interaction (bypasses browser autoplay restrictions)
 * 2. High-intensity tactical dual-tone emergency siren (sawtooth + square harmonics, 750Hz - 1250Hz)
 * 3. Tactical notification chime (multi-tone ascending chime)
 * 4. Test sound method with volume boost for laptop/monitor speakers
 * 5. Persistent mute state in localStorage
 */

class EmergencyAudioAlert {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private isUnlocked: boolean = false;

  constructor() {
    this.muted = localStorage.getItem('gb_audio_muted') === 'true';
    this.setupGlobalUnlock();
  }

  /**
   * Set up global event listeners so the first click anywhere on the page unlocks the AudioContext.
   */
  private setupGlobalUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener('click', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
    };

    window.addEventListener('click', unlockHandler, { once: true });
    window.addEventListener('touchstart', unlockHandler, { once: true });
    window.addEventListener('keydown', unlockHandler, { once: true });
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    localStorage.setItem('gb_audio_muted', String(mute));
  }

  public toggleMute(): boolean {
    const nextState = !this.muted;
    this.setMuted(nextState);
    if (!nextState) {
      // If unmuting, play a quick audible confirmation chime
      this.playConfirmationChime();
    }
    return nextState;
  }

  /**
   * Unlocks and initializes the Web Audio API context.
   * Guaranteed safe to call anytime, especially in user gesture handlers.
   */
  public unlock(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }

      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch((err) => console.warn('[AudioAlert] Context resume failed:', err));
      }

      // Play a 1-sample silent buffer to unlock on iOS / Chrome
      if (this.ctx && !this.isUnlocked) {
        const buffer = this.ctx.createBuffer(1, 1, 22050);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        source.start(0);
        this.isUnlocked = true;
      }
    } catch (e) {
      console.warn('[AudioAlert] Unlock failed:', e);
    }
    return this.ctx;
  }

  /**
   * Plays a loud, tactical dual-tone police emergency siren.
   * Duration in seconds (default 2.0s).
   */
  public playEmergencySiren(durationSeconds: number = 2.0, volume: number = 0.85) {
    if (this.muted) return;

    try {
      const ctx = this.unlock();
      if (!ctx) return;

      const now = ctx.currentTime;
      const endTime = now + durationSeconds;

      // Master gain node
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(Math.min(1.0, volume), now);
      masterGain.gain.setValueAtTime(Math.min(1.0, volume), endTime - 0.2);
      masterGain.gain.exponentialRampToValueAtTime(0.001, endTime);
      masterGain.connect(ctx.destination);

      // Primary Oscillator: Modulated police wail (Sawtooth for high cut-through harmonics)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';

      // Pitch sweep: 750Hz to 1250Hz back and forth
      const cycleDuration = 0.45; // 450ms per siren cycle
      const cycles = Math.ceil(durationSeconds / cycleDuration);
      for (let i = 0; i < cycles; i++) {
        const cycleStart = now + i * cycleDuration;
        const cycleMid = cycleStart + cycleDuration * 0.5;
        const cycleEnd = cycleStart + cycleDuration;
        osc1.frequency.setValueAtTime(750, cycleStart);
        osc1.frequency.linearRampToValueAtTime(1250, cycleMid);
        osc1.frequency.linearRampToValueAtTime(750, cycleEnd);
      }

      // Secondary Oscillator: Sub-harmonic carrier (Square) for punch and body
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(375, now);
      for (let i = 0; i < cycles; i++) {
        const cycleStart = now + i * cycleDuration;
        const cycleMid = cycleStart + cycleDuration * 0.5;
        const cycleEnd = cycleStart + cycleDuration;
        osc2.frequency.setValueAtTime(375, cycleStart);
        osc2.frequency.linearRampToValueAtTime(625, cycleMid);
        osc2.frequency.linearRampToValueAtTime(375, cycleEnd);
      }

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.35, now);
      osc2.connect(gain2);
      gain2.connect(masterGain);

      osc1.connect(masterGain);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(endTime);
      osc2.stop(endTime);

    } catch (e) {
      console.warn('[AudioAlert] Siren play error:', e);
    }
  }

  /**
   * Plays a crisp, ascending tactical alert chime (used on incoming SOS verification).
   */
  public playEmergencyChime(volume: number = 0.8) {
    if (this.muted) return;

    try {
      const ctx = this.unlock();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 3-Tone Ascending Alarm Arpeggio: A5 (880Hz) -> D6 (1175Hz) -> G6 (1568Hz)
      const tones = [
        { freq: 880, start: now, dur: 0.18, type: 'sawtooth' as OscillatorType },
        { freq: 1175, start: now + 0.16, dur: 0.20, type: 'triangle' as OscillatorType },
        { freq: 1568, start: now + 0.34, dur: 0.35, type: 'sawtooth' as OscillatorType }
      ];

      tones.forEach((t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = t.type;
        osc.frequency.setValueAtTime(t.freq, t.start);

        gain.gain.setValueAtTime(0, t.start);
        gain.gain.linearRampToValueAtTime(volume, t.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t.start + t.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t.start);
        osc.stop(t.start + t.dur);
      });

    } catch (e) {
      console.warn('[AudioAlert] Chime play error:', e);
    }
  }

  /**
   * Plays a short pleasant confirmation beep when unmuting.
   */
  public playConfirmationChime() {
    try {
      const ctx = this.unlock();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('[AudioAlert] Confirmation beep error:', e);
    }
  }

  /**
   * Explicitly triggers an audio test to verify speaker output.
   * Always plays even if currently muted.
   */
  public testSpeakerSound(): boolean {
    this.unlock();
    this.playEmergencySiren(2.0, 0.9);
    return true;
  }
}

export const audioAlert = new EmergencyAudioAlert();
