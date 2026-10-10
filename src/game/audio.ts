let ctx: AudioContext | null = null;
let enabled = true;
let introPlayed = false;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function unlockAudio() {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function destination(peak: number, duration: number, when: number) {
  if (!ctx) return null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  gain.connect(ctx.destination);
  return gain;
}

function tone(freq: number, duration: number, type: OscillatorType, peak: number, delay = 0) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  const when = ctx.currentTime + delay;
  const gain = destination(peak, duration, when);
  if (!gain) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  osc.connect(gain);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playTap() {
  tone(620, 0.07, "sine", 0.03);
}

export function playOk() {
  tone(523.25, 0.14, "sine", 0.06);
  tone(659.25, 0.2, "sine", 0.05, 0.08);
}

export function playDup() {
  tone(440, 0.1, "triangle", 0.035);
}

export function playBad() {
  if (!enabled || !ctx || ctx.state !== "running") return;
  const when = ctx.currentTime;
  const gain = destination(0.04, 0.22, when);
  if (!gain) return;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(196, when);
  osc.frequency.exponentialRampToValueAtTime(90, when + 0.18);
  osc.connect(gain);
  osc.start(when);
  osc.stop(when + 0.24);
}

export function playWin() {
  tone(523.25, 0.16, "sine", 0.06, 0);
  tone(659.25, 0.16, "sine", 0.06, 0.12);
  tone(783.99, 0.16, "sine", 0.06, 0.24);
  tone(1046.5, 0.36, "triangle", 0.05, 0.36);
}

export function playCinematic() {
  if (!enabled || introPlayed) return;
  const audio = unlockAudio();
  if (!audio || audio.state !== "running") return;
  introPlayed = true;
  const t = audio.currentTime;

  const pad = audio.createOscillator();
  const padGain = audio.createGain();
  pad.type = "sine";
  pad.frequency.setValueAtTime(98, t);
  pad.frequency.exponentialRampToValueAtTime(196, t + 1.8);
  padGain.gain.setValueAtTime(0.0001, t);
  padGain.gain.linearRampToValueAtTime(0.08, t + 0.45);
  padGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
  pad.connect(padGain).connect(audio.destination);
  pad.start(t);
  pad.stop(t + 3.5);

  const fifth = audio.createOscillator();
  const fifthGain = audio.createGain();
  fifth.type = "triangle";
  fifth.frequency.setValueAtTime(293.66, t + 0.35);
  fifthGain.gain.setValueAtTime(0.0001, t + 0.35);
  fifthGain.gain.linearRampToValueAtTime(0.045, t + 1.1);
  fifthGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  fifth.connect(fifthGain).connect(audio.destination);
  fifth.start(t + 0.35);
  fifth.stop(t + 3.3);

  const bell = audio.createOscillator();
  const bellGain = audio.createGain();
  bell.type = "sine";
  bell.frequency.setValueAtTime(880, t + 1.15);
  bellGain.gain.setValueAtTime(0.0001, t + 1.15);
  bellGain.gain.exponentialRampToValueAtTime(0.07, t + 1.2);
  bellGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
  bell.connect(bellGain).connect(audio.destination);
  bell.start(t + 1.15);
  bell.stop(t + 3);

  const low = audio.createOscillator();
  const lowGain = audio.createGain();
  low.type = "sine";
  low.frequency.setValueAtTime(65.4, t);
  lowGain.gain.setValueAtTime(0.0001, t);
  lowGain.gain.linearRampToValueAtTime(0.06, t + 0.3);
  lowGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  low.connect(lowGain).connect(audio.destination);
  low.start(t);
  low.stop(t + 2.7);
}

export function resetIntroCue() {
  introPlayed = false;
}
