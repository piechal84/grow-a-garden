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
  if (cicadaNodes) cicadaNodes.gain.gain.value = muted ? 0 : CICADA_VOLUME;
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

export function playThunderClap() {
  if (muted) return;
  const context = getCtx();
  const t0 = context.currentTime;

  // Sharp bright transient — the initial "snap" of the strike, tightly bandpassed so it reads
  // as a crack rather than raw static.
  const crackSource = context.createBufferSource();
  crackSource.buffer = makeNoiseBuffer(context, 0.15);
  const crackFilter = context.createBiquadFilter();
  crackFilter.type = "bandpass";
  crackFilter.frequency.value = 2800;
  crackFilter.Q.value = 0.7;
  const crackGain = context.createGain();
  crackGain.gain.setValueAtTime(0.32, t0);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  crackSource.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(context.destination);
  crackSource.start(t0);

  // Mid-body boom — fills the gap between the crack and the low rumble tail.
  const boomSource = context.createBufferSource();
  boomSource.buffer = makeNoiseBuffer(context, 0.6);
  const boomFilter = context.createBiquadFilter();
  boomFilter.type = "lowpass";
  boomFilter.frequency.setValueAtTime(1400, t0);
  boomFilter.frequency.exponentialRampToValueAtTime(220, t0 + 0.7);
  const boomGain = context.createGain();
  boomGain.gain.setValueAtTime(0.001, t0);
  boomGain.gain.linearRampToValueAtTime(0.3, t0 + 0.06);
  boomGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
  boomSource.connect(boomFilter);
  boomFilter.connect(boomGain);
  boomGain.connect(context.destination);
  boomSource.start(t0);

  // Low rolling rumble tail — two slightly detuned sines through a lowpass for a fuller,
  // less synthetic low end than a single bare sine sweep.
  const rumbleFilter = context.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.value = 220;
  const rumbleGain = context.createGain();
  rumbleGain.gain.setValueAtTime(0.001, t0);
  rumbleGain.gain.linearRampToValueAtTime(0.24, t0 + 0.15);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.2);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(context.destination);
  for (const detune of [0, 6]) {
    const rumble = context.createOscillator();
    rumble.type = "sine";
    rumble.detune.value = detune;
    rumble.frequency.setValueAtTime(115, t0);
    rumble.frequency.exponentialRampToValueAtTime(34, t0 + 1.8);
    rumble.connect(rumbleFilter);
    rumble.start(t0);
    rumble.stop(t0 + 2.3);
  }

  // Randomized secondary crackle bursts — the rolling, uneven character of real thunder
  // instead of one clean hit.
  for (let i = 0; i < 3; i++) {
    const delay = 0.15 + Math.random() * 0.5 + i * 0.25;
    const start = t0 + delay;
    const crackle = context.createBufferSource();
    crackle.buffer = makeNoiseBuffer(context, 0.12);
    const crackleFilter = context.createBiquadFilter();
    crackleFilter.type = "bandpass";
    crackleFilter.frequency.value = 1400 + Math.random() * 900;
    crackleFilter.Q.value = 0.9;
    const crackleGain = context.createGain();
    crackleGain.gain.setValueAtTime(0.001, start);
    crackleGain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.06, start + 0.02);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(context.destination);
    crackle.start(start);
  }
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
