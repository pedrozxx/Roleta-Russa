import { CHAMBERS } from './game';

/** Revolver de perfil. O cão (#hammer) e o gatilho (#trigger) são animados pelo CSS. */
export const revolverSide = `
<svg class="side" viewBox="0 0 420 230" aria-hidden="true">
  <defs>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--steel-hi)"/>
      <stop offset=".55" stop-color="var(--steel)"/>
      <stop offset="1" stop-color="var(--steel-lo)"/>
    </linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--wood-hi)"/>
      <stop offset="1" stop-color="var(--wood-lo)"/>
    </linearGradient>
  </defs>
  <!-- cano -->
  <rect x="14" y="62" width="200" height="26" rx="3" fill="url(#steel)"/>
  <rect x="14" y="55" width="200" height="9" rx="2" fill="var(--steel-hi)"/>
  <rect x="22" y="47" width="8" height="10" rx="1" fill="var(--steel)"/>
  <rect x="40" y="88" width="160" height="12" rx="4" fill="var(--steel-lo)"/>
  <!-- armação -->
  <path d="M206 50 H312 L322 64 V112 H286 C278 112 270 116 266 124 H206 Z" fill="url(#steel)"/>
  <!-- tambor -->
  <rect x="214" y="52" width="86" height="62" rx="12" fill="url(#steel)" stroke="var(--steel-lo)" stroke-width="2"/>
  <line x1="224" y1="66" x2="290" y2="66" stroke="var(--steel-lo)" stroke-width="5" stroke-linecap="round"/>
  <line x1="224" y1="100" x2="290" y2="100" stroke="var(--steel-lo)" stroke-width="5" stroke-linecap="round"/>
  <!-- cão -->
  <g id="hammer"><path d="M312 52 L336 30 L346 36 L326 62 Z" fill="var(--steel)"/></g>
  <!-- guarda-mato e gatilho -->
  <path d="M238 122 C238 160 300 164 302 122" fill="none" stroke="var(--steel)" stroke-width="7"/>
  <g id="trigger"><path d="M266 122 C262 136 266 146 276 150 C272 140 274 130 278 122 Z" fill="var(--steel-lo)"/></g>
  <!-- cabo -->
  <path d="M300 106 L328 100 C344 130 370 176 380 214 C362 224 334 224 318 216 C314 180 304 140 286 116 Z" fill="url(#wood)"/>
  <circle cx="338" cy="168" r="5" fill="var(--steel-hi)"/>
</svg>`;

/** Tambor visto de frente. A câmara no topo é a que está alinhada com o cano. */
export function cylinderFront() {
  const holes = Array.from({ length: CHAMBERS }, (_, i) => {
    const a = (i * 2 * Math.PI) / CHAMBERS - Math.PI / 2;
    const x = 100 + 54 * Math.cos(a);
    const y = 100 + 54 * Math.sin(a);
    const fa = a + Math.PI / CHAMBERS;
    const fx = 100 + 84 * Math.cos(fa);
    const fy = 100 + 84 * Math.sin(fa);
    return `
      <circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="13" fill="var(--bg)"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" fill="var(--steel-lo)"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="var(--hole)"/>`;
  }).join('');
  return `
<svg class="front" viewBox="0 0 200 200" aria-hidden="true">
  <g id="cyl">
    <circle cx="100" cy="100" r="92" fill="url(#steelR)"/>
    ${holes}
    <circle cx="100" cy="100" r="14" fill="var(--steel-hi)"/>
    <circle cx="100" cy="100" r="6" fill="var(--steel-lo)"/>
  </g>
  <path d="M90 2 L110 2 L100 16 Z" fill="var(--accent)"/>
  <defs>
    <radialGradient id="steelR" cx=".4" cy=".35" r=".8">
      <stop offset="0" stop-color="var(--steel-hi)"/>
      <stop offset="1" stop-color="var(--steel-lo)"/>
    </radialGradient>
  </defs>
</svg>`;
}
