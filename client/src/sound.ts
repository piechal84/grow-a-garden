/**
 * Small synthesized sound-effect engine (Web Audio API, no external audio files).
 * Lazily creates its AudioContext on first use since browsers require a user gesture.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const MUTE_KEY = "grow-garden-muted";
let muted = localStorage.getItem(MUTE_KEY) === "1";

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  if (rainNodes) rainNodes.gain.gain.value = muted ? 0 : RAIN_VOLUME;
}

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const RAIN_VOLUME = 0.045;
let rainNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

export function startRainAmbience() {
  if (rainNodes) return;
  const context = getCtx();
  const source = context.createBufferSource();
  source.buffer = makeNoiseBuffer(context, 2);
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1600;
  const gain = context.createGain();
  gain.gain.value = muted ? 0 : RAIN_VOLUME;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
  rainNodes = { source, gain };
}

export function stopRainAmbience() {
  if (!rainNodes) return;
  const context = getCtx();
  const { source, gain } = rainNodes;
  gain.gain.setTargetAtTime(0, context.currentTime, 0.3);
  source.stop(context.currentTime + 1);
  rainNodes = null;
}

export function playThunderClap() {
  if (muted) return;
  const context = getCtx();

  const crackSource = context.createBufferSource();
  crackSource.buffer = makeNoiseBuffer(context, 0.4);
  const crackFilter = context.createBiquadFilter();
  crackFilter.type = "highpass";
  crackFilter.frequency.value = 900;
  const crackGain = context.createGain();
  crackGain.gain.setValueAtTime(0.28, context.currentTime);
  crackGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
  crackSource.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(context.destination);
  crackSource.start();

  const rumble = context.createOscillator();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(120, context.currentTime);
  rumble.frequency.exponentialRampToValueAtTime(38, context.currentTime + 1.4);
  const rumbleGain = context.createGain();
  rumbleGain.gain.setValueAtTime(0.001, context.currentTime);
  rumbleGain.gain.linearRampToValueAtTime(0.22, context.currentTime + 0.1);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.6);
  rumble.connect(rumbleGain);
  rumbleGain.connect(context.destination);
  rumble.start();
  rumble.stop(context.currentTime + 1.7);
}
