import { CHAMBERS } from './game';

export interface Finish {
  name: string;
  hi: string;
  mid: string;
  lo: string;
  gripHi: string;
  gripLo: string;
}

/** Um acabamento por jogador, na ordem em que foram cadastrados. */
export const FINISHES: Finish[] = [
  { name: 'Aço', hi: '#c9ccd1', mid: '#7d8189', lo: '#3c3f45', gripHi: '#8a4b2a', gripLo: '#4a2414' },
  { name: 'Dourado', hi: '#f7dc8f', mid: '#c99a3a', lo: '#6b4c14', gripHi: '#3b2a22', gripLo: '#140d0a' },
  { name: 'Preto', hi: '#6a6d73', mid: '#2e3034', lo: '#111214', gripHi: '#9c6b43', gripLo: '#5a3418' },
  { name: 'Cobre', hi: '#f0a77c', mid: '#b8643a', lo: '#5c2a14', gripHi: '#e9dcc8', gripLo: '#a8977d' },
  { name: 'Cromo', hi: '#ffffff', mid: '#b6c2cf', lo: '#5d6876', gripHi: '#2b2b2b', gripLo: '#0c0c0c' },
  { name: 'Azulado', hi: '#9fb8e6', mid: '#3f5f9a', lo: '#1a2846', gripHi: '#c08d5d', gripLo: '#6b4222' },
];

export const finishFor = (index: number) => FINISHES[index % FINISHES.length];

let uid = 0;

/** Revólver de perfil. O cão (.hammer) e o gatilho (.trigger) são animados pelo CSS. */
export function revolverSide(f: Finish = FINISHES[0]) {
  const id = `g${uid++}`;
  return `
<svg class="side" viewBox="-50 0 470 230" overflow="visible" aria-hidden="true">
  <defs>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${f.hi}"/><stop offset=".55" stop-color="${f.mid}"/><stop offset="1" stop-color="${f.lo}"/>
    </linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${f.gripHi}"/><stop offset="1" stop-color="${f.gripLo}"/>
    </linearGradient>
  </defs>
  <rect x="14" y="62" width="200" height="26" rx="3" fill="url(#${id}s)"/>
  <rect x="14" y="55" width="200" height="9" rx="2" fill="${f.hi}"/>
  <rect x="22" y="47" width="8" height="10" rx="1" fill="${f.mid}"/>
  <rect x="40" y="88" width="160" height="12" rx="4" fill="${f.lo}"/>
  <path d="M206 50 H312 L322 64 V112 H286 C278 112 270 116 266 124 H206 Z" fill="url(#${id}s)"/>
  <rect x="214" y="52" width="86" height="62" rx="12" fill="url(#${id}s)" stroke="${f.lo}" stroke-width="2"/>
  <line x1="224" y1="66" x2="290" y2="66" stroke="${f.lo}" stroke-width="5" stroke-linecap="round"/>
  <line x1="224" y1="100" x2="290" y2="100" stroke="${f.lo}" stroke-width="5" stroke-linecap="round"/>
  <g class="hammer"><path d="M312 52 L336 30 L346 36 L326 62 Z" fill="${f.mid}"/></g>
  <path d="M238 122 C238 160 300 164 302 122" fill="none" stroke="${f.mid}" stroke-width="7"/>
  <g class="trigger"><path d="M266 122 C262 136 266 146 276 150 C272 140 274 130 278 122 Z" fill="${f.lo}"/></g>
  <path d="M300 106 L328 100 C344 130 370 176 380 214 C362 224 334 224 318 216 C314 180 304 140 286 116 Z" fill="url(#${id}w)"/>
  <circle cx="338" cy="168" r="5" fill="${f.hi}"/>
  <g class="muzzle">
    <polygon points="14,75 -30,52 -6,70 -46,76 -6,82 -30,100" fill="#ffd36b"/>
    <polygon points="14,75 -14,64 -2,73 -22,76 -2,79 -14,88" fill="#fff6d8"/>
  </g>
  <g class="smoke">
    <circle cx="6" cy="72" r="9"/><circle cx="-2" cy="66" r="12"/><circle cx="8" cy="60" r="10"/>
  </g>
</svg>`;
}

/** Tambor visto de frente. A câmara no topo é a que está alinhada com o cano. */
export function cylinderFront(f: Finish = FINISHES[0], cls = 'front') {
  const id = `c${uid++}`;
  const holes = Array.from({ length: CHAMBERS }, (_, i) => {
    const a = (i * 2 * Math.PI) / CHAMBERS - Math.PI / 2;
    const x = 100 + 54 * Math.cos(a);
    const y = 100 + 54 * Math.sin(a);
    const fa = a + Math.PI / CHAMBERS;
    const fx = 100 + 84 * Math.cos(fa);
    const fy = 100 + 84 * Math.sin(fa);
    return `
      <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="13" fill="var(--bg)"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" fill="${f.lo}"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="var(--hole)"/>`;
  }).join('');
  return `
<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="${id}" cx=".4" cy=".35" r=".8">
      <stop offset="0" stop-color="${f.hi}"/><stop offset="1" stop-color="${f.lo}"/>
    </radialGradient>
  </defs>
  <g class="cyl">
    <circle cx="100" cy="100" r="92" fill="url(#${id})"/>
    ${holes}
    <circle cx="100" cy="100" r="14" fill="${f.hi}"/>
    <circle cx="100" cy="100" r="6" fill="${f.lo}"/>
  </g>
  <path d="M90 2 L110 2 L100 16 Z" fill="var(--accent)"/>
</svg>`;
}
