// Coisas do aparelho: manter a tela acesa e saber o que ele suporta.

type Sentinel = { release: () => Promise<void>; addEventListener?: (t: string, cb: () => void) => void };
let sentinel: Sentinel | null = null;
let wanted = false;

const api = () => (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock;

async function acquire() {
  const wl = api();
  if (!wl || sentinel || document.visibilityState !== 'visible') return;
  try {
    sentinel = await wl.request('screen');
    sentinel.addEventListener?.('release', () => (sentinel = null));
  } catch {
    sentinel = null; // bateria fraca ou o navegador negou: o jogo segue normal
  }
}

/** Mantém a tela acesa enquanto a partida rola. */
export function keepAwake(on: boolean) {
  wanted = on;
  if (on) void acquire();
  else if (sentinel) {
    void sentinel.release().catch(() => {});
    sentinel = null;
  }
}

// O navegador solta a trava quando o app vai pro fundo. Pega de volta ao voltar.
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') void acquire();
});

export const isAwake = () => sentinel !== null;

export function capabilities() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  return {
    vibration: typeof navigator.vibrate === 'function' && !ios,
    wakeLock: !!api(),
    audio: !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext),
    viewTransitions: 'startViewTransition' in document,
    installed: window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    ios,
  };
}

/** Mede quadros por segundo por um tempo, pra saber se as animações estão lisas. */
export function measureFps(ms = 2000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve(Math.round((frames * 1000) / (now - start)));
    };
    requestAnimationFrame(tick);
  });
}
