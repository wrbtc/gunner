// GUNNER's original v050 physical sound palette. No samples, model, downloads,
// timer or AudioNode creation here: every layer is baked into one cached buffer.
// Gameplay remains the sole owner of source start/stop, position and pitch.
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const decay = (t, start, rate) => t < start ? 0 : Math.exp(-(t - start) * rate);
export function audioRandom(seed = 1) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1; };
}

// One-pole bands are parameterized in Hz rather than baked-in sample steps.
export function noiseBands(sampleRate, seed) {
  const random = audioRandom(seed), rates = [85, 420, 1800].map(hz => 1 - Math.exp(-TAU * hz / sampleRate));
  const out = { white: 0, low: 0, body: 0, air: 0, edge: 0 }; let a = 0, b = 0, c = 0;
  return () => {
    const n = random(); a += rates[0] * (n - a); b += rates[1] * (n - b); c += rates[2] * (n - c);
    out.white = n; out.low = a; out.body = b - a; out.air = c - b; out.edge = n - c;
    return out;
  };
}

// A struck material rings at its own inharmonic modes. Each recurrence is
// stable by construction (pole radius < 1); no per-sample object allocations.
export function modalBody(sampleRate, modes) {
  const states = modes.map(([hz, seconds, level]) => {
    const angle = TAU * Math.min(hz, sampleRate * .44) / sampleRate, radius = Math.exp(-1 / (sampleRate * seconds));
    return { a: 2 * radius * Math.cos(angle), b: radius * radius, input: Math.sin(angle), level, p: 0, q: 0 };
  });
  return excitation => {
    let sum = 0;
    for (const s of states) { const y = s.a * s.p - s.b * s.q + excitation * s.input; s.q = s.p; s.p = y; sum += y * s.level; }
    return sum;
  };
}

function formant(sampleRate, hz, q) {
  const w = TAU * Math.min(hz, sampleRate * .42) / sampleRate, alpha = Math.sin(w) / (2 * q), inv = 1 / (1 + alpha);
  const b0 = alpha * inv, a1 = -2 * Math.cos(w) * inv, a2 = (1 - alpha) * inv;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = b0 * (x - x2) - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

export function finishAudioBuffer(buffer, { peak = .78, rmsCeiling = .25, loop = false, attack = .0015, release = .035 } = {}) {
  const a = buffer.getChannelData(0), sr = buffer.sampleRate, n = a.length;
  // Remove subsonic/DC energy before the existing limiter and small speakers.
  const pole = Math.exp(-TAU * 22 / sr); let previous = 0, dc = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i], y = x - previous + pole * dc; previous = x; dc = y;
    if (!Number.isFinite(y)) throw new Error('Nonfinite original sound synthesis');
    a[i] = y;
  }
  if (loop) {
    // The live loop starts at sample 1024; its tail traverses that same head.
    const count = Math.min(1024, n >> 2);
    for (let i = 0; i < count; i++) { const t = i / (count - 1); a[n - count + i] = a[n - count + i] * (1 - t) + a[i] * t; }
  } else {
    for (let i = 0; i < n; i++) a[i] *= Math.min(1, i / (sr * attack), (n - 1 - i) / (sr * release));
  }
  let highest = 0, energy = 0;
  for (const v of a) { highest = Math.max(highest, Math.abs(v)); energy += v * v; }
  const gain = Math.min(peak / Math.max(highest, 1e-8), rmsCeiling / Math.max(Math.sqrt(energy / n), 1e-8));
  for (let i = 0; i < n; i++) a[i] *= gain;
  return buffer;
}

export function weaponSoundBuffer(ctx, duration, kind, seed = 1) {
  const sr = ctx.sampleRate, buffer = ctx.createBuffer(1, Math.ceil(sr * duration), sr), a = buffer.getChannelData(0);
  const noise = noiseBands(sr, seed), variant = ((seed >>> 0) % 17 - 8) / 80;
  const steel = modalBody(sr, [[1031 * (1 + variant * .1), .022, .27], [2387, .017, .16], [4173, .012, .09]]);
  const plate = modalBody(sr, [[487, .085, .35], [1123, .053, .23], [2699, .033, .12], [4619, .021, .06]]);
  const stone = modalBody(sr, [[193, .038, .5], [743, .026, .25], [1573, .015, .14]]);
  const boltFrames = [.012 + variant * .006, .049, .096].map(t => Math.round(t * sr));
  const debrisFrames = [.089, .137, .221, .337, .498, .733, 1.09].map(t => Math.round(t * sr));
  const rackFrames = [.001, .079, .164].map(t => Math.round(t * sr));
  let phase = 0, rumblePhase = 0, ember = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr, n = noise(); let v = 0;
    if (kind === 'gun') {
      // Separate snap, muzzle pressure, cycling bolt and short canyon body.
      // The rotor motor remains a separate, visibly speed-driven runtime graph.
      phase += TAU * (82 + 108 * Math.exp(-t * 51)) / sr;
      const snap = n.edge * .92 * Math.exp(-t * 330) + n.air * .22 * Math.exp(-t * 110);
      const pressure = (Math.sin(phase) * .67 + n.low * 5.0 + n.body * .73) * Math.exp(-t * 34);
      const bolt = steel(boltFrames.includes(i) ? (i === boltFrames[0] ? .32 : .14) : 0);
      const reflected = (n.low * 1.95 + n.body * .46) * decay(t, .027, 18);
      v = snap + pressure + bolt + reflected;
    } else if (kind === 'cannon' || kind === 'cannonImpact' || kind === 'boom') {
      const firing = kind === 'cannon', impact = kind === 'cannonImpact';
      phase += TAU * (firing ? 43 + 119 * Math.exp(-t * 36) : 30 + 86 * Math.exp(-t * 13)) / sr;
      rumblePhase += TAU * (firing ? 79 : 51) / sr;
      const strike = n.edge * (firing ? 1.05 : .68) * Math.exp(-t * (firing ? 240 : 120));
      const body = (Math.sin(phase) * .86 + .14 * Math.sin(rumblePhase) + n.low * 6.7 + n.body * .62) * Math.exp(-t * (firing ? 9.5 : impact ? 3.9 : 2.7));
      const breech = steel(i === Math.round(sr * .071) && firing ? .54 : 0);
      const shards = stone(!firing && debrisFrames.includes(i) ? .11 * Math.exp(-t * 1.8) : 0);
      if (!firing && n.white > .9975) ember = .21 * Math.exp(-t * 1.5); ember *= .94;
      const dust = (n.low * 2.9 + n.air * .21 + ember * n.edge) * decay(t, firing ? .10 : .065, firing ? 7.5 : 1.9);
      v = strike + body + breech + shards + dust;
    } else if (kind === 'metal') {
      v = plate(i === Math.round(.001 * sr) ? .92 : i === Math.round(.023 * sr) ? .13 : 0);
      v += n.edge * .27 * Math.exp(-t * 280) + n.body * .19 * Math.exp(-t * 63);
    } else if (kind === 'flesh') {
      phase += TAU * (77 + 176 * Math.exp(-t * 34)) / sr;
      const squeeze = (.5 + .5 * Math.sin(t * 79 + Math.sin(t * 137))) ** 2;
      v = (n.low * 6.1 + Math.sin(phase) * .33 + n.body * 1.1 * squeeze) * Math.exp(-t * 29) + n.air * .11 * Math.exp(-t * 170);
    } else if (kind === 'rock') {
      const chips = i === Math.round(.001 * sr) ? .85 : debrisFrames.includes(i) ? .22 * Math.exp(-t * 5) : 0;
      v = stone(chips) + (n.low * 4.1 + n.body * .72) * Math.exp(-t * 24) + n.edge * .32 * Math.exp(-t * 230);
    } else if (kind === 'rack') {
      const strike = rackFrames.includes(i);
      v = steel(strike ? .88 : 0) + plate(strike ? .16 : 0);
      v += n.body * (.36 * decay(t, .001, 64) + .45 * decay(t, .079, 75) + .26 * decay(t, .164, 66));
    } else if (kind === 'flyby') {
      const u = t / duration, envelope = Math.sin(Math.PI * u) ** 2;
      phase += TAU * (390 + 1900 * (1 - u) ** 1.8) / sr;
      v = (n.air * .9 + n.edge * .14 + n.body * .55 + Math.sin(phase) * .18) * envelope;
    } else if (kind === 'engine') {
      // Two imperfect radial engines: firing harmonics, exhaust, and structural
      // transfer. Tones complete integer cycles in the three-second source.
      const left = TAU * 46 * t, right = TAU * (139 / 3) * t;
      const cylinders = Math.sin(left) * .34 + Math.sin(left * 2) * .16 + Math.sin(left * 3) * .11 + Math.sin(left * 5) * .055;
      const other = Math.sin(right + .31) * .28 + Math.sin(right * 2 + .11) * .12 + Math.sin(right * 4) * .048;
      const exhaust = n.low * 2.5 + n.body * .54 * (.66 + .34 * Math.sin(left * 2) ** 2);
      const airframe = n.air * .14 * (.80 + .20 * Math.sin(TAU * (2 / 3) * t));
      v = cylinders + other + exhaust + airframe;
    } else if (kind === 'rumble') {
      const gust = .7 + .15 * Math.sin(TAU * t / 3) + .10 * Math.sin(TAU * (4 / 3) * t);
      v = (n.low * 5.3 + n.body * .48 + n.air * .14) * gust + Math.sin(TAU * 29 * t) * .22 + Math.sin(TAU * 41 * t) * .09;
    } else throw new Error('Unknown original sound family: ' + kind);
    a[i] = Math.tanh(v * .92);
  }
  return finishAudioBuffer(buffer, { peak: .83, rmsCeiling: kind === 'engine' || kind === 'rumble' ? .25 : .22,
    loop: kind === 'engine' || kind === 'rumble', attack: kind === 'gun' ? .0008 : .0012, release: .028 });
}

// A repeatable biological signature shared by the Queen's reveal, warning,
// reload and death: irregular subharmonic vocal folds through three resonances.
// Pitch is integrated, so glides contain no phase discontinuities.
export function queenSoundBuffer(ctx, duration, kind = 'queen-reveal') {
  const sr = ctx.sampleRate, buffer = ctx.createBuffer(1, Math.ceil(sr * duration), sr), a = buffer.getChannelData(0);
  const noise = noiseBands(sr, 0x51a01 + kind.length * 311), throat = formant(sr, 153, 3.1), mouth = formant(sr, 437, 4.0), rasp = formant(sr, 1031, 2.7);
  const armor = modalBody(sr, [[91, .18, .42], [271, .11, .2], [683, .047, .1]]);
  const death = kind === 'queen-defeated' || kind === 'queen', warning = kind === 'queen-attack', reload = kind === 'queen-reload';
  const collapseFrames = [.045, .44, .89, 1.55].map(t => Math.round(t * sr));
  let phase = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / sr, u = t / duration, n = noise();
    const pitch = death ? 43 + 26 * Math.exp(-t * 1.3) : warning ? 49 + 37 * u : reload ? 42 + 16 * Math.exp(-t * 3) : 35 + 15 * Math.sin(Math.PI * u) + 4 * Math.sin(t * 3.2);
    phase += TAU * pitch * (1 + .018 * Math.sin(TAU * 3.7 * t) + .008 * Math.sin(TAU * 17.3 * t)) / sr;
    const folds = Math.tanh(Math.sin(phase) * 3.2) * .40 + Math.sin(phase * .5 + .21) * .19 + n.body * 1.6;
    const vocal = throat(folds) * 2.8 + mouth(folds + n.air * .26) * 1.3 + rasp(n.air + folds * .18) * .48;
    let envelope;
    if (death) envelope = Math.exp(-t * .81) * (.62 + .38 * Math.sin(Math.PI * clamp(u * 2.2)) ** 2);
    else if (warning) envelope = Math.sin(Math.PI * u) ** .85;
    else if (reload) envelope = Math.sin(Math.PI * u) ** 1.05 * (1 - .28 * u);
    else envelope = Math.sin(Math.PI * u) ** .9 * (.68 + .32 * Math.sin(Math.PI * clamp((u - .13) / .42)) ** 2);
    const breath = n.low * (death ? 3.8 : 2.1) + n.body * .30 + n.air * .07;
    const collapse = armor(death && collapseFrames.includes(i) ? .33 * Math.exp(-t) : 0);
    a[i] = Math.tanh((vocal + breath) * envelope + collapse + (death ? n.low * 1.7 * decay(t, .25, 1.6) : 0));
  }
  return finishAudioBuffer(buffer, { peak: kind === 'queen' ? .78 : .75, rmsCeiling: .23, attack: death ? .007 : .025, release: .065 });
}

export function scoreSoundBuffer(ctx, kind) {
  const sr = ctx.sampleRate, duration = 8, buffer = ctx.createBuffer(1, sr * duration, sr), a = buffer.getChannelData(0);
  const noise = noiseBands(sr, kind === 'tension' ? 0x902 : 0x391), tension = kind === 'tension';
  const bell = modalBody(sr, [[147, .7, .042], [220.5, .55, .031], [441, .28, .012]]);
  for (let i = 0; i < a.length; i++) {
    const t = i / sr, n = noise(), beat = t % .5, bar = Math.floor(t / 2);
    const pulse = Math.exp(-beat * 20), breathing = .78 + .22 * Math.sin(TAU * t / 8);
    // Original restrained D/A pedal: bowed low brass plus structural percussion.
    // Sparse overtones leave the pilot's intelligibility band relatively clear.
    const root = tension ? 49 : 73.5, p = TAU * root * t;
    const bowed = Math.sin(p) * .094 + Math.sin(p * 2) * .031 + Math.sin(p * 3) * .014 + Math.sin(p * 4) * .006;
    const fifth = Math.sin(TAU * (tension ? 73.625 : 110.25) * t) * .037;
    const rust = (n.low * .43 + n.body * .055) * breathing;
    const drum = tension ? (Math.sin(TAU * 49 * beat) * .048 + n.low * .28) * pulse * (bar % 2 ? .7 : 1) : 0;
    const metal = bell(!tension && (i === Math.round(sr * .08) || i === Math.round(sr * 4.08)) ? 1 : 0);
    a[i] = bowed * breathing + fifth + rust + drum + metal;
  }
  // Keep the score a bed: the existing scene mix and pilot ducking are retained.
  return finishAudioBuffer(buffer, { peak: .26, rmsCeiling: .078, loop: true });
}
