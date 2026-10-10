/**
 * Web Audio API Synthesizer for Gate Feedback & Biosecurity Sirens
 * 100% client-side, zero external audio asset dependencies.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Access Granted: High-pitch pleasant harmonic chime
 */
export function playAccessGrantedSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
    osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.5, now + 0.3); // C6

    gainNode.gain.setValueAtTime(0.01, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    osc1.stop(now + 0.7);
    osc2.stop(now + 0.7);
  } catch (e) {
    console.warn('Audio playback not permitted or supported yet', e);
  }
}

/**
 * Access Denied: Biosecurity quarantine alert alarm tone
 */
export function playAccessDeniedAlarm(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two rapid warning pulses
    for (let i = 0; i < 2; i++) {
      const startTime = now + i * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, startTime);
      osc.frequency.linearRampToValueAtTime(220, startTime + 0.22);

      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.04);
      gain.gain.linearRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }
  } catch (e) {
    console.warn('Audio playback not permitted or supported yet', e);
  }
}
