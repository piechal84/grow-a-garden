/**
 * Sound-effect engine — mostly synthesized via the Web Audio API, plus a couple of recorded
 * ambience loops (rain, rain+thunderstorm) played as plain <audio> elements from /public/sounds.
 * The AudioContext is created lazily on first use since browsers require a user gesture.
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
  if (cicadaNodes) cicadaNodes.gain.gain.value = muted ? 0 : CICADA_VOLUME;
  if (rainAudio) rainAudio.volume = muted ? 0 : RAIN_FILE_VOLUME;
  if (stormAudio) stormAudio.volume = muted ? 0 : STORM_FILE_VOLUME;
}

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const RAIN_FILE_VOLUME = 0.35;
let rainAudio: HTMLAudioElement | null = null;

/** Plain rain (no thunder) — a real recorded loop rather than synthesized noise. */
export function startRainAmbience() {
  if (rainAudio) return;
  rainAudio = new Audio("/sounds/rain-loop.wav");
  rainAudio.loop = true;
  rainAudio.volume = muted ? 0 : RAIN_FILE_VOLUME;
  void rainAudio.play().catch(() => {});
}

export function stopRainAmbience() {
  if (!rainAudio) return;
  rainAudio.pause();
  rainAudio = null;
}

const STORM_FILE_VOLUME = 0.4;
let stormAudio: HTMLAudioElement | null = null;

/** Thunderstorm sky — a full recorded rain+thunder loop, replacing the plain rain track and the
 *  old synthesized periodic thunder claps (this file already carries its own thunder). */
export function startThunderstormAmbience() {
  if (stormAudio) return;
  stormAudio = new Audio("/sounds/rain-and-thunder-storm.wav");
  stormAudio.loop = true;
  stormAudio.volume = muted ? 0 : STORM_FILE_VOLUME;
  void stormAudio.play().catch(() => {});
}

export function stopThunderstormAmbience() {
  if (!stormAudio) return;
  stormAudio.pause();
  stormAudio = null;
}

const THUNDERCLAP_VOLUME = 0.55;

/** A discrete, one-shot thunderclap layered on top of the storm ambience loop at random
 *  intervals — a fresh <audio> instance per call so overlapping claps can't cut each other off. */
export function playThunderClap() {
  if (muted) return;
  const clap = new Audio("/sounds/thunderclap.mp3");
  clap.volume = THUNDERCLAP_VOLUME;
  clap.playbackRate = 0.92 + Math.random() * 0.16;
  void clap.play().catch(() => {});
}

const CICADA_VOLUME = 0.032;
let cicadaNodes: { source: AudioBufferSourceNode; gain: GainNode; tremolo: OscillatorNode } | null = null;

/** A nighttime chorus: bandpassed noise pulsed by a fast LFO to read as a cicada trill
 *  rather than plain static, distinct from the rain ambience's low rumble. */
export function startCicadaAmbience() {
  if (cicadaNodes) return;
  const context = getCtx();
  const source = context.createBufferSource();
  source.buffer = makeNoiseBuffer(context, 2);
  source.loop = true;

  const bandpass = context.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 3600;
  bandpass.Q.value = 3.5;

  const tremoloGain = context.createGain();
  tremoloGain.gain.value = 0.5;
  const tremolo = context.createOscillator();
  tremolo.frequency.value = 26;
  const tremoloDepth = context.createGain();
  tremoloDepth.gain.value = 0.45;
  tremolo.connect(tremoloDepth);
  tremoloDepth.connect(tremoloGain.gain);
  tremolo.start();

  const gain = context.createGain();
  gain.gain.value = muted ? 0 : CICADA_VOLUME;

  source.connect(bandpass);
  bandpass.connect(tremoloGain);
  tremoloGain.connect(gain);
  gain.connect(context.destination);
  source.start();

  cicadaNodes = { source, gain, tremolo };
}

export function stopCicadaAmbience() {
  if (!cicadaNodes) return;
  const context = getCtx();
  const { source, gain, tremolo } = cicadaNodes;
  gain.gain.setTargetAtTime(0, context.currentTime, 0.3);
  source.stop(context.currentTime + 1);
  tremolo.stop(context.currentTime + 1);
  cicadaNodes = null;
}

const CHIME_VOLUME = 0.11;

/** A shimmering wind-chime cue that periodically signals a Moon Blossom is nearby. */
export function playMoonBlossomChime() {
  if (muted) return;
  const context = getCtx();
  const t0 = context.currentTime;
  const notes = [1046.5, 1318.5, 1568, 2093]; // C6, E6, G6, C7 — bright and airy
  notes.forEach((freq, i) => {
    const start = t0 + i * 0.11;
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(CHIME_VOLUME, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.1);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + 1.2);
  });
}

/** A brief low growl + ember crackle that periodically signals a Dragon Fruit is nearby. */
export function playDragonFruitEmber() {
  if (muted) return;
  const context = getCtx();
  const t0 = context.currentTime;

  const growl = context.createOscillator();
  growl.type = "sawtooth";
  growl.frequency.setValueAtTime(70, t0);
  growl.frequency.exponentialRampToValueAtTime(42, t0 + 0.5);
  const growlFilter = context.createBiquadFilter();
  growlFilter.type = "lowpass";
  growlFilter.frequency.value = 320;
  const growlGain = context.createGain();
  growlGain.gain.setValueAtTime(0.001, t0);
  growlGain.gain.linearRampToValueAtTime(0.16, t0 + 0.08);
  growlGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  growl.connect(growlFilter);
  growlFilter.connect(growlGain);
  growlGain.connect(context.destination);
  growl.start(t0);
  growl.stop(t0 + 0.65);

  const crackle = context.createBufferSource();
  crackle.buffer = makeNoiseBuffer(context, 0.3);
  const crackleFilter = context.createBiquadFilter();
  crackleFilter.type = "bandpass";
  crackleFilter.frequency.value = 3200;
  crackleFilter.Q.value = 0.6;
  const crackleGain = context.createGain();
  crackleGain.gain.setValueAtTime(0.001, t0 + 0.1);
  crackleGain.gain.linearRampToValueAtTime(0.09, t0 + 0.15);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
  crackle.connect(crackleFilter);
  crackleFilter.connect(crackleGain);
  crackleGain.connect(context.destination);
  crackle.start(t0 + 0.1);
}
