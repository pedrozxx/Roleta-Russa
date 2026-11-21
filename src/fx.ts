// Efeitos visuais reaproveitados pelas telas.

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Troca de tela com transição. Usa a View Transitions API quando o navegador tem. */
export function go(render: () => void) {
  type VT = { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
  const d = document as Document & { startViewTransition?: (cb: () => void) => VT };
  if (!d.startViewTransition || reducedMotion()) return render();
  // Se a transição for abortada (ex: teclado abrindo ou tela girando), a tela troca do mesmo jeito.
  const t = d.startViewTransition(render);
  const ignore = () => {};
  t.ready?.catch(ignore);
  t.finished?.catch(ignore);
  t.updateCallbackDone?.catch(ignore);
}

/** Faz os filhos diretos entrarem um depois do outro. */
export function stagger(root: Element | null, step = 55) {
  if (!root) return;
  Array.from(root.children).forEach((el, i) => {
    (el as HTMLElement).style.setProperty('--i', String(i));
    (el as HTMLElement).style.setProperty('--step', `${step}ms`);
    el.classList.add('stg');
  });
}

/** Reinicia uma animação CSS no elemento. */
export function replay(el: Element | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

/** Troca o texto e anima, só se mudou. */
export function swapText(el: Element | null, text: string, cls = 'swap') {
  if (!el || el.textContent === text) return;
  el.textContent = text;
  replay(el, cls);
}

/** Onda de toque em botões. */
export function installRipple() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const target = (e.target as Element).closest('.btn, .modes button, .x, .rack li, .seg button');
      if (!target || (target as HTMLButtonElement).disabled) return;
      const r = target.getBoundingClientRect();
      const s = document.createElement('span');
      s.className = 'ripple';
      const size = Math.max(r.width, r.height) * 2;
      s.style.width = s.style.height = `${size}px`;
      s.style.left = `${e.clientX - r.left - size / 2}px`;
      s.style.top = `${e.clientY - r.top - size / 2}px`;
      target.appendChild(s);
      setTimeout(() => s.remove(), 600);
    },
    { passive: true },
  );
}

/** Brasas subindo no fundo de todas as telas. */
export function installEmbers(count = 16) {
  const box = document.createElement('div');
  box.id = 'embers';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const e = document.createElement('i');
    e.style.setProperty('--x', `${Math.random() * 100}vw`);
    e.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    e.style.setProperty('--d', `${7 + Math.random() * 9}s`);
    e.style.setProperty('--delay', `${-Math.random() * 16}s`);
    e.style.setProperty('--s', `${2 + Math.random() * 3}px`);
    box.appendChild(e);
  }
  document.body.prepend(box);
}

/** Chuva de peças: confete dourado pra quem venceu, cápsulas de bala pra quem perdeu. */
export function rain(kind: 'confetti' | 'shells', count = 48) {
  const box = document.createElement('div');
  box.className = `rain ${kind}`;
  box.setAttribute('aria-hidden', 'true');
  const colors = kind === 'confetti' ? ['#e0b062', '#f7dc8f', '#ff5a3d', '#f3e9e2', '#c99a3a'] : ['#c99a3a', '#e0b062', '#8a6a2a'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--x', `${Math.random() * 100}vw`);
    p.style.setProperty('--sway', `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty('--r', `${(Math.random() - 0.5) * 1080}deg`);
    p.style.setProperty('--d', `${1.8 + Math.random() * 1.8}s`);
    p.style.setProperty('--delay', `${Math.random() * 0.8}s`);
    p.style.setProperty('--c', colors[i % colors.length]);
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4500);
}

/** Números contando de 0 até o valor. */
export function countUp(root: ParentNode, ms = 700) {
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el, i) => {
    const target = Number(el.dataset.count);
    if (!target || reducedMotion()) {
      el.textContent = String(target);
      return;
    }
    const start = performance.now() + i * 40;
    el.textContent = '0';
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      el.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(tick);
      else replay(el, 'bump');
    };
    requestAnimationFrame(tick);
  });
}

/** Palavra que salta e some (ex: CLICK). */
export function popWord(host: Element | null, word: string, cls = 'popword') {
  if (!host) return;
  const s = document.createElement('span');
  s.className = cls;
  s.textContent = word;
  host.appendChild(s);
  setTimeout(() => s.remove(), 900);
}

/** Confirmação animada no lugar do confirm() do navegador. */
export function ask(question: string, yes: string, no = 'Cancelar'): Promise<boolean> {
  return new Promise((resolve) => {
    const o = document.createElement('div');
    o.className = 'overlay ask';
    o.innerHTML = `
      <div class="card modal" role="alertdialog" aria-modal="true">
        <p class="q"></p>
        <div class="row">
          <button class="btn ghost" data-a="0"></button>
          <button class="btn primary" data-a="1"></button>
        </div>
      </div>`;
    o.querySelector('.q')!.textContent = question;
    o.querySelector('[data-a="0"]')!.textContent = no;
    o.querySelector('[data-a="1"]')!.textContent = yes;
    const close = (v: boolean) => {
      o.classList.add('leaving');
      setTimeout(() => o.remove(), 200);
      resolve(v);
    };
    o.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-a]');
      if (b) close(b.dataset.a === '1');
      else if (e.target === o) close(false);
    });
    document.body.appendChild(o);
    o.querySelector<HTMLButtonElement>('[data-a="1"]')!.focus();
  });
}

/** Remove um overlay com animação de saída. */
export function dismiss(el: Element, ms = 220) {
  el.classList.add('leaving');
  return new Promise<void>((r) =>
    setTimeout(() => {
      el.remove();
      r();
    }, ms),
  );
}
