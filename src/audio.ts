// Todos os sons são gerados na hora pelo navegador, sem arquivos de áudio.
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

/** Precisa ser chamado dentro de um toque do usuário, senão o iPhone não toca nada. */
export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function noise(seconds: number) {
  const c = ctx!;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function burst(at: number, dur: number, freq: number, type: BiquadFilterType, vol: number) {
  const c = ctx!;
  const src = noise(dur);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + dur);
}

function ready() {
  return !muted && ctx && ctx.state === 'running';
}

/** Catraca do tambor girando: cliques que vão ficando mais espaçados. */
export function spin(duration = 1.4) {
  if (!ready()) return;
  const now = ctx!.currentTime;
  let t = 0;
  let gap = 0.03;
  while (t < duration) {
    burst(now + t, 0.02, 3500, 'highpass', 0.25);
    t += gap;
    gap *= 1.09;
  }
}

/** Gatilho em câmara vazia: cão batendo no metal. */
export function click() {
  if (!ready()) return;
  const now = ctx!.currentTime;
  burst(now, 0.015, 2000, 'highpass', 0.5);
  burst(now + 0.07, 0.04, 1800, 'bandpass', 0.9);
}

/** Estampido. */
export function bang() {
  if (!ready()) return;
  const c = ctx!;
  const now = c.currentTime;
  burst(now, 0.9, 1200, 'lowpass', 1.2);
  burst(now, 0.12, 5000, 'highpass', 0.6);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, now);
  o.frequency.exponentialRampToValueAtTime(35, now + 0.4);
  g.gain.setValueAtTime(1, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.5);
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iPhone não suporta */
  }
}
