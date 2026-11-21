import './style.css';
import { CHAMBER_OPTIONS, current, MAX_PLAYERS, newGame, pull, remaining, secureRandom, type GameState, type Mode, type Player } from './game';
import { DEFAULT_DARES, store } from './storage';
import { capabilities, isAwake, keepAwake, measureFps } from './device';
import * as sfx from './audio';
import { cylinderFront, finishFor, revolverSide } from './revolver';
import { ask, countUp, dismiss, go, installEmbers, installRipple, popWord, rain, replay, stagger, swapText } from './fx';

const app = document.getElementById('app')!;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SPIN_MS = 1500;
const MAX_NAME = 20;

let names: string[] = [...store.names];
let mode: Mode = store.mode;
let game: GameState | null = null;
let rotation: Record<string, number> = {};
let busy = false;
let justAdded = -1;
let lastVictim: string | null = null;
let chambers = store.chambers;
/** prenda sorteada pra cada pessoa que levou tiro nesta partida */
let dareOf: Record<string, string> = {};

sfx.setMuted(!store.sound);

const speaker = (on: boolean) => `
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>
    ${
      on
        ? '<path class="wave w1" d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="wave w2" d="M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
        : '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    }
  </svg>`;

const soundBtn = () =>
  `<button type="button" class="btn ghost small icon sound-toggle" aria-pressed="${store.sound}" aria-label="${store.sound ? 'Desligar som' : 'Ligar som'}">${speaker(store.sound)}</button>`;

/** Liga os botões de som da tela atual. */
function wireSound() {
  app.querySelectorAll<HTMLButtonElement>('.sound-toggle').forEach((b) =>
    b.addEventListener('click', () => {
      const on = !store.sound;
      store.setSound(on);
      sfx.setMuted(!on);
      if (on) {
        sfx.unlock();
        sfx.click();
      }
      b.innerHTML = speaker(on);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Desligar som' : 'Ligar som');
      replay(b, 'picked');
    }),
  );
}

const pickDare = () => {
  const list = store.dares;
  return list.length ? list[Math.floor(secureRandom() * list.length)] : '';
};

/** Título com as letras caindo uma a uma. */
const letters = (word: string, offset: number) =>
  [...word].map((ch, i) => `<span class="ltr" style="--l:${i + offset}">${ch}</span>`).join('');

// ---------- Tela inicial ----------

function renderSetup(opts: { focus?: boolean; enter?: boolean } = {}) {
  const { focus = false, enter = true } = opts;
  const canStart = names.length >= 2;
  const full = names.length >= MAX_PLAYERS;
  app.innerHTML = `
  <main class="screen setup">
    <div class="topbar">
      <button type="button" id="test" class="btn ghost small">Testar aparelho</button>
      ${soundBtn()}
    </div>
    <header class="brand">
      <div class="brand-gun">${revolverSide()}</div>
      <h1 class="${enter ? 'intro' : ''}">${letters('Roleta', 0)}<br/>${letters('Russa', 6)}</h1>
    </header>

    <form id="add" class="add" autocomplete="off">
      <input id="name" name="name" maxlength="${MAX_NAME}" placeholder="${full ? 'Mesa cheia' : 'Nome do jogador'}" enterkeyhint="done" ${full ? 'disabled' : ''} />
      <button type="submit" class="btn small" ${full ? 'disabled' : ''}>Adicionar</button>
    </form>

    <ul class="players">
      ${names
        .map(
          (n, i) =>
            `<li class="${i === justAdded ? 'pop' : ''}"><i class="dot" style="background:${finishFor(i).mid}" title="${finishFor(i).name}"></i><span>${esc(n)}</span><button class="x" data-remove="${i}" aria-label="Remover ${esc(n)}">×</button></li>`,
        )
        .join('')}
    </ul>
    <p class="hint">${
      names.length === 0
        ? 'Adicione pelo menos duas pessoas.'
        : names.length === 1
          ? 'Falta mais uma pessoa.'
          : full
            ? `Máximo de ${MAX_PLAYERS} jogadores, um revólver pra cada.`
            : `${names.length} na mesa. Cabem mais ${MAX_PLAYERS - names.length}.`
    }</p>

    <div class="modes" role="radiogroup" aria-label="Modo de jogo">
      <button type="button" role="radio" aria-checked="${mode === 'elimination'}" data-mode="elimination">
        <strong>Até sobrar um</strong><small>Quem leva o tiro sai. O último de pé vence.</small>
      </button>
      <button type="button" role="radio" aria-checked="${mode === 'single'}" data-mode="single">
        <strong>Um tiro decide</strong><small>Acaba no primeiro tiro. Quem levou, perdeu.</small>
      </button>
    </div>

    <section class="settings">
      <div class="setting">
        <span><strong>Câmaras por arma</strong><small>Menos câmaras, partida mais rápida.</small></span>
        <div class="seg" role="radiogroup" aria-label="Câmaras por arma">
          ${CHAMBER_OPTIONS.map((n) => `<button type="button" role="radio" aria-checked="${n === chambers}" data-ch="${n}">${n}</button>`).join('')}
        </div>
      </div>
      <div class="setting">
        <span><strong>Prendas</strong><small>${store.dares.length} na lista. Quem leva tiro ganha uma.</small></span>
        <div class="setting-actions">
          <button type="button" id="dares" class="btn ghost small">Editar</button>
          <button type="button" class="switch" role="switch" aria-checked="${store.daresOn}" aria-label="Prendas"><i></i></button>
        </div>
      </div>
    </section>

    <button id="start" class="btn primary shine ${canStart && justAdded === 1 ? 'ready' : ''}" ${canStart ? '' : 'disabled'}>Começar</button>
    <button id="board" class="btn ghost">Placar</button>
  </main>`;
  justAdded = -1;

  const screen = app.querySelector('.screen')!;
  if (enter) {
    stagger(screen);
    screen.classList.add('entering');
  }

  const input = app.querySelector<HTMLInputElement>('#name')!;
  if (focus && !full) input.focus();

  app.querySelector('#add')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = input.value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
    if (!n || names.length >= MAX_PLAYERS) {
      replay(input, 'shake');
      return;
    }
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) {
      input.select();
      replay(input, 'shake');
      return;
    }
    names.push(n);
    justAdded = names.length - 1;
    store.setNames(names);
    renderSetup({ focus: true, enter: false });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      const li = b.closest('li')!;
      li.classList.add('gone');
      setTimeout(() => {
        names.splice(Number(b.dataset.remove), 1);
        store.setNames(names);
        renderSetup({ enter: false });
      }, 220);
    }),
  );

  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as Mode;
      store.setMode(mode);
      app.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      replay(b, 'picked');
    }),
  );

  app.querySelectorAll<HTMLButtonElement>('[data-ch]').forEach((b) =>
    b.addEventListener('click', () => {
      chambers = Number(b.dataset.ch);
      store.setChambers(chambers);
      app.querySelectorAll('[data-ch]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      replay(b, 'picked');
    }),
  );
  const sw = app.querySelector<HTMLButtonElement>('.switch')!;
  sw.addEventListener('click', () => {
    const on = !store.daresOn;
    store.setDaresOn(on);
    sw.setAttribute('aria-checked', String(on));
  });
  app.querySelector('#dares')!.addEventListener('click', () => go(() => renderDares()));
  app.querySelector('#test')!.addEventListener('click', () => go(renderTest));
  wireSound();

  app.querySelector('#start')!.addEventListener('click', () => {
    sfx.unlock();
    go(startGame);
  });
  app.querySelector('#board')!.addEventListener('click', () => go(renderBoard));
}

// ---------- Jogo ----------

const finishOf = (p: Player) => finishFor(Number(p.id));

function startGame() {
  const players: Player[] = names.map((name, i) => ({ id: String(i), name }));
  game = newGame(players, mode, undefined, chambers);
  rotation = {};
  lastVictim = null;
  dareOf = {};
  keepAwake(true);
  for (const p of players) rotation[p.id] = 0;
  renderGame(true);
  spinAll();
}

function gunMarkup(p: Player) {
  const f = finishOf(p);
  return `
    <div class="gun enter" style="--glow:${f.mid}">
      ${revolverSide(f)}
      <div class="cyl-wrap">${cylinderFront(f, 'front', game!.chambers)}</div>
      <p class="gun-name">Arma de ${esc(p.name)} · ${f.name}</p>
    </div>`;
}

function renderGame(enter = false) {
  const g = game!;
  app.innerHTML = `
  <main class="screen game">
    <div class="topbar">
      <button id="quit" class="btn ghost small">Sair</button>
      <span class="mode-tag">${g.mode === 'single' ? 'Um tiro decide' : 'Até sobrar um'} · ${g.chambers} câmaras</span>
      ${soundBtn()}
    </div>

    <section class="turn" aria-live="polite">
      <p class="label" id="label">${enter ? '<span class="dots">Girando os tambores</span>' : 'Vez de'}</p>
      <h2 id="who">${esc(current(g).name)}</h2>
      <p class="odds" id="odds"></p>
    </section>

    <div id="stage">${gunMarkup(current(g))}</div>

    <button id="fire" class="btn trigger" disabled>Puxar o gatilho</button>

    <ul class="rack" style="--n:${g.players.length}">
      ${g.players
        .map(
          (p) => `<li data-id="${p.id}" class="${p.id === lastVictim ? 'knocked' : ''}">
            <div class="mini">${cylinderFront(finishOf(p), 'front mini-cyl', g.chambers)}</div>
            <span class="rack-name">${esc(p.name)}</span>
            <span class="rack-odds">1 em ${remaining(g, p)}</span>
          </li>`,
        )
        .join('')}
    </ul>
  </main>
  <div id="vignette" class="vignette"></div>
  <div id="flash" class="flash"></div>`;
  lastVictim = null;

  const screen = app.querySelector('.screen')!;
  stagger(screen, enter ? 60 : 30);
  stagger(app.querySelector('.rack'), 45);

  for (const p of g.players) setCylinder(p, false);
  if (!enter) updateTurnInfo('Vez de');
  app.querySelector('#fire')!.addEventListener('click', onFire);
  wireSound();
  app.querySelector('#quit')!.addEventListener('click', async () => {
    if (await ask('Sair da partida? Ela não vai contar no placar.', 'Sair')) {
      game = null;
      keepAwake(false);
      go(() => renderSetup());
    }
  });
}

/** Gira o tambor grande (se for de quem está na vez) e o pequeno da fileira. */
function setCylinder(p: Player, animate: boolean, ms = 250, onStage = current(game!) === p) {
  const targets: SVGGElement[] = [];
  const mini = app.querySelector<SVGGElement>(`.rack li[data-id="${p.id}"] .cyl`);
  if (mini) targets.push(mini);
  if (onStage) {
    const big = app.querySelector<SVGGElement>('#stage .cyl');
    if (big) targets.push(big);
  }
  for (const el of targets) {
    el.style.transition = animate ? `transform ${ms}ms cubic-bezier(.15,.7,.2,1)` : 'none';
    el.style.transform = `rotate(${rotation[p.id]}deg)`;
  }
}

function updateTurnInfo(label: string) {
  const g = game!;
  swapText(app.querySelector('#label'), label, 'fade-swap');
  swapText(app.querySelector('#who'), current(g).name);
  const r = remaining(g);
  swapText(
    app.querySelector('#odds'),
    r === 1 ? 'Última câmara da sua arma. A bala está aqui.' : `Chance de tiro na sua arma: 1 em ${r}`,
    'bump',
  );
  // tensão: a tela pulsa em vermelho quando a chance fica alta
  const v = app.querySelector('#vignette')!;
  v.classList.toggle('hot', r <= 2);
  v.classList.toggle('hotter', r === 1);
  for (const p of g.players) {
    const li = app.querySelector(`.rack li[data-id="${p.id}"]`)!;
    const out = g.eliminated.includes(p);
    li.classList.toggle('out', out);
    li.classList.toggle('now', !out && current(g) === p);
    swapText(li.querySelector('.rack-odds'), out ? 'fora' : `1 em ${remaining(g, p)}`, 'bump');
  }
}

function spinAll() {
  busy = true;
  const g = game!;
  for (const p of g.players) {
    rotation[p.id] += 360 * 3 + (360 / g.chambers) * Math.floor(Math.random() * g.chambers);
  }
  requestAnimationFrame(() => {
    for (const p of g.players) setCylinder(p, true, SPIN_MS);
  });
  sfx.spin(SPIN_MS / 1000);
  setTimeout(() => {
    busy = false;
    updateTurnInfo('Vez de');
    const fire = app.querySelector<HTMLButtonElement>('#fire')!;
    fire.disabled = false;
    replay(fire, 'armed');
  }, SPIN_MS);
}

function showGunOf(p: Player) {
  app.querySelector('#stage')!.innerHTML = gunMarkup(p);
  setCylinder(p, false, 0, true);
}

function onFire() {
  if (busy || !game) return;
  busy = true;
  const g = game;
  const shooter = current(g);
  const fireBtn = app.querySelector<HTMLButtonElement>('#fire')!;
  fireBtn.disabled = true;
  const gun = app.querySelector('#stage .gun')!;
  gun.classList.remove('enter');
  gun.classList.add('cocking');

  // o cão arma, depois cai
  setTimeout(() => {
    gun.classList.remove('cocking');
    gun.classList.add('firing');
    setTimeout(() => gun.classList.remove('firing'), 220);

    const out = pull(g);

    if (out.kind === 'empty') {
      sfx.click();
      sfx.vibrate(30);
      rotation[shooter.id] += 360 / g.chambers;
      setCylinder(shooter, true, 250, true);
      replay(gun.querySelector('.cyl-wrap'), 'jolt');
      popWord(gun, 'CLICK');
      swapText(app.querySelector('#label'), 'Vazia. Ufa.', 'fade-swap');
      swapText(app.querySelector(`.rack li[data-id="${shooter.id}"] .rack-odds`), `1 em ${remaining(g, shooter)}`, 'bump');
      setTimeout(() => gun.classList.add('leave'), 520);
      setTimeout(() => {
        showGunOf(out.next);
        updateTurnInfo('Passa o celular pra');
        busy = false;
        fireBtn.disabled = false;
        replay(fireBtn, 'armed');
      }, 760);
      return;
    }

    sfx.bang();
    sfx.vibrate([250, 80, 400]);
    gun.classList.add('shot');
    app.querySelector('#flash')!.classList.add('on');
    app.querySelector('.game')!.classList.add('recoil');
    lastVictim = out.victim.id;
    setTimeout(() => showShot(out.victim, out.next), 650);
  }, 140);
}

function showShot(victim: Player, next: Player | null) {
  const g = game!;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const more = !g.over;
  const dare = store.daresOn ? pickDare() : '';
  if (dare) dareOf[victim.id] = dare;
  overlay.innerHTML = `
    <div class="card slam">
      <svg class="hole" viewBox="0 0 100 100" aria-hidden="true">
        <g stroke="#5a1a12" stroke-width="2" stroke-linecap="round">
          <line x1="50" y1="50" x2="10" y2="30"/><line x1="50" y1="50" x2="92" y2="20"/>
          <line x1="50" y1="50" x2="85" y2="88"/><line x1="50" y1="50" x2="18" y2="80"/>
          <line x1="50" y1="50" x2="50" y2="4"/>
        </g>
        <circle cx="50" cy="50" r="11" fill="#0a0707" stroke="#3a2c27" stroke-width="3"/>
      </svg>
      <p class="bang">${[...'BANG!'].map((c, i) => `<span style="--l:${i}">${c}</span>`).join('')}</p>
      <h2>${esc(victim.name)}</h2>
      <p>${g.mode === 'single' ? 'levou o tiro e perdeu.' : 'levou o tiro e está fora.'}</p>
      ${dare ? `<div class="dare"><span class="dare-label">Prenda</span><strong class="dare-text">${esc(dare)}</strong></div>` : ''}
      ${more ? `<p class="small">Sobraram ${g.alive.length}. As outras armas continuam como estavam.</p>` : ''}
      <button id="go" class="btn primary shine">${more ? `Próxima: ${esc(next!.name)}` : 'Ver resultado'}</button>
    </div>`;
  document.body.appendChild(overlay);
  if (dare) shuffleDare(overlay.querySelector('.dare-text')!, dare);
  overlay.querySelector('#go')!.addEventListener('click', async () => {
    await dismiss(overlay);
    if (more) {
      renderGame();
      busy = false;
      const fire = app.querySelector<HTMLButtonElement>('#fire')!;
      fire.disabled = false;
      replay(fire, 'armed');
    } else {
      finish();
    }
  });
}

/** Embaralha as prendas na tela antes de parar na sorteada, tipo caça-níquel. */
function shuffleDare(el: HTMLElement, final: string) {
  const list = store.dares;
  if (list.length < 2) return;
  el.classList.add('rolling');
  let i = 0;
  const steps = 14;
  const tick = () => {
    if (i >= steps) {
      el.textContent = final;
      el.classList.remove('rolling');
      replay(el, 'landed');
      sfx.click();
      return;
    }
    el.textContent = list[(i + Math.floor(secureRandom() * list.length)) % list.length];
    i++;
    setTimeout(tick, 45 + i * i * 2.2);
  };
  setTimeout(tick, 500);
}

function finish() {
  const g = game!;
  keepAwake(false);
  store.record({
    players: g.players.map((p) => p.name),
    shot: g.eliminated.map((p) => p.name),
    winner: g.winner?.name ?? null,
  });
  game = null;
  go(() => renderResult(g));
}

// ---------- Resultado ----------

function renderResult(g: GameState) {
  const headline =
    g.mode === 'single'
      ? `<p class="label">Perdeu</p><h2 class="loser big-name">${esc(g.loser!.name)}</h2>`
      : `<p class="label">Último de pé</p><h2 class="winner big-name">${esc(g.winner!.name)}</h2>
         <p class="small">Primeiro a cair: <strong>${esc(g.loser!.name)}</strong></p>`;
  const order =
    g.mode === 'elimination'
      ? `<ol class="order">${g.eliminated
          .map((p) => `<li>${esc(p.name)}${dareOf[p.id] ? ` <small class="dare-tag">${esc(dareOf[p.id])}</small>` : ''}</li>`)
          .join('')}</ol>`
      : dareOf[g.loser!.id]
        ? `<div class="dare big"><span class="dare-label">Prenda</span><strong>${esc(dareOf[g.loser!.id])}</strong></div>`
        : '';
  app.innerHTML = `
  <main class="screen result">
    <section class="turn">${headline}</section>
    ${order ? (g.mode === 'elimination' ? `<p class="label">Ordem dos tiros</p>${order}` : order) : ''}
    <button id="again" class="btn primary shine">Jogar de novo</button>
    <button id="edit" class="btn ghost">Trocar jogadores</button>
    <button id="board" class="btn ghost">Placar</button>
  </main>`;
  stagger(app.querySelector('.screen'), 80);
  stagger(app.querySelector('.order'), 90);
  setTimeout(() => rain(g.mode === 'single' ? 'shells' : 'confetti'), 250);

  app.querySelector('#again')!.addEventListener('click', () => {
    sfx.unlock();
    go(startGame);
  });
  app.querySelector('#edit')!.addEventListener('click', () => go(() => renderSetup()));
  app.querySelector('#board')!.addEventListener('click', () => go(renderBoard));
}

// ---------- Prendas ----------

function renderDares(focus = false, enter = true) {
  const list = store.dares;
  app.innerHTML = `
  <main class="screen dares-screen">
    <div class="topbar">
      <button id="back" class="btn ghost small">Voltar</button>
      <span class="mode-tag">Prendas</span>
    </div>
    <p class="small">Quem leva o tiro ganha uma destas, sorteada na hora.</p>
    <form id="add-dare" class="add" autocomplete="off">
      <input id="dare" maxlength="60" placeholder="Nova prenda" enterkeyhint="done" />
      <button type="submit" class="btn small">Adicionar</button>
    </form>
    <ul class="dare-list">
      ${list.map((d, i) => `<li><span>${esc(d)}</span><button class="x" data-i="${i}" aria-label="Remover prenda">×</button></li>`).join('')}
    </ul>
    ${list.length ? '' : '<p class="hint empty">Lista vazia. Sem prenda, só o tiro.</p>'}
    <button id="restore" class="btn ghost">Voltar pra lista inicial</button>
  </main>`;
  if (enter) {
    stagger(app.querySelector('.screen'));
    stagger(app.querySelector('.dare-list'), 35);
  }
  const input = app.querySelector<HTMLInputElement>('#dare')!;
  if (focus) input.focus();
  app.querySelector('#add-dare')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = input.value.trim().replace(/\s+/g, ' ');
    if (!d || list.some((x) => x.toLowerCase() === d.toLowerCase())) {
      replay(input, 'shake');
      return;
    }
    store.setDares([d, ...list]);
    renderDares(true, false);
    app.querySelector('.dare-list li')?.classList.add('pop');
  });
  app.querySelectorAll<HTMLButtonElement>('.dare-list .x').forEach((b) =>
    b.addEventListener('click', () => {
      b.closest('li')!.classList.add('gone');
      setTimeout(() => {
        store.setDares(list.filter((_, i) => i !== Number(b.dataset.i)));
        renderDares(false, false);
      }, 220);
    }),
  );
  app.querySelector('#restore')!.addEventListener('click', async () => {
    if (await ask('Trocar a sua lista pela lista inicial?', 'Trocar')) {
      store.setDares([...DEFAULT_DARES]);
      renderDares();
    }
  });
  app.querySelector('#back')!.addEventListener('click', () => go(() => renderSetup()));
}

// ---------- Testar aparelho ----------

function renderTest() {
  const c = capabilities();
  const row = (ok: boolean, label: string, note: string) =>
    `<li><span class="badge ${ok ? 'yes' : 'no'}">${ok ? 'Sim' : 'Não'}</span><span><strong>${label}</strong><small>${note}</small></span></li>`;
  app.innerHTML = `
  <main class="screen test">
    <div class="topbar">
      <button id="back" class="btn ghost small">Voltar</button>
      <span class="mode-tag">Testar aparelho</span>
    </div>
    <p class="small">Aperta cada botão e confere se aconteceu de verdade. O que o celular diz suportar está logo abaixo.</p>

    <div class="test-grid">
      <button class="btn" data-t="spin">Som do tambor</button>
      <button class="btn" data-t="click">Som do clique</button>
      <button class="btn" data-t="bang">Som do tiro</button>
      <button class="btn" data-t="vibe">Vibrar</button>
      <button class="btn" data-t="fps">Medir animação</button>
      <button class="btn" data-t="awake">Tela acesa</button>
    </div>
    <p class="result-line" id="out" aria-live="polite">Nenhum teste rodado ainda.</p>
    <div class="test-cyl">${cylinderFront(finishFor(1), 'front', chambers)}</div>

    <ul class="caps">
      ${row(c.audio, 'Som', store.sound ? 'Ligado no app. Se não tocar, confere o volume e o modo silencioso.' : 'Está desligado no app, no botão do alto-falante.')}
      ${row(c.vibration, 'Vibração', c.ios ? 'iPhone não deixa site vibrar. Não tem como contornar.' : 'Se não vibrar, confere se a vibração do sistema está ligada.')}
      ${row(c.wakeLock, 'Manter tela acesa', c.wakeLock ? 'O navegador tem o recurso. Aperta "Tela acesa" ali em cima pra confirmar que ele deixa.' : 'Este navegador não deixa. A tela pode apagar no meio do jogo.')}
      ${row(c.viewTransitions, 'Transição entre telas', c.viewTransitions ? 'Ativa.' : 'Sem transição suave entre telas. O resto das animações funciona.')}
      ${row(c.installed, 'Instalado na tela inicial', c.installed ? 'Abrindo como app.' : 'Abrindo pelo navegador. Instalar deixa em tela cheia.')}
      ${row(!c.reducedMotion, 'Animações completas', c.reducedMotion ? '"Reduzir movimento" está ligado no celular. Os efeitos em loop ficam desligados.' : 'Todas ligadas.')}
    </ul>
  </main>`;
  stagger(app.querySelector('.screen'));
  stagger(app.querySelector('.caps'), 50);
  const out = app.querySelector<HTMLElement>('#out')!;
  const say = (t: string) => swapText(out, t);
  app.querySelectorAll<HTMLButtonElement>('[data-t]').forEach((b) =>
    b.addEventListener('click', async () => {
      sfx.unlock();
      const t = b.dataset.t;
      if (t === 'spin' || t === 'click' || t === 'bang') {
        if (!store.sound) return say('O som está desligado no app. Liga no alto-falante da tela inicial.');
        // o iPhone às vezes demora um instante pra liberar o áudio
        setTimeout(() => (t === 'spin' ? sfx.spin(1.2) : t === 'click' ? sfx.click() : sfx.bang()), 60);
        if (t === 'spin') {
          const cyl = app.querySelector<SVGGElement>('.test-cyl .cyl')!;
          cyl.style.transition = 'transform 1.2s cubic-bezier(.15,.7,.2,1)';
          cyl.style.transform = `rotate(${(Number(cyl.dataset.r) || 0) + 1080}deg)`;
          cyl.dataset.r = String((Number(cyl.dataset.r) || 0) + 1080);
        }
        return say('Tocou? Se não ouviu nada, confere volume e modo silencioso.');
      }
      if (t === 'vibe') {
        sfx.vibrate([200, 100, 200]);
        return say(c.vibration ? 'Vibrou? Duas vibrações curtas.' : 'Este aparelho não vibra pelo navegador.');
      }
      if (t === 'fps') {
        say('Medindo...');
        const cyl = app.querySelector<SVGGElement>('.test-cyl .cyl')!;
        cyl.style.transition = 'transform 2s linear';
        cyl.style.transform = `rotate(${(Number(cyl.dataset.r) || 0) + 720}deg)`;
        cyl.dataset.r = String((Number(cyl.dataset.r) || 0) + 720);
        const fps = await measureFps(2000);
        return say(
          fps >= 50
            ? `${fps} quadros por segundo. Animações lisas.`
            : fps >= 30
              ? `${fps} quadros por segundo. Dá pra jogar, mas pode engasgar.`
              : `${fps} quadros por segundo. Este aparelho sofre com as animações.`,
        );
      }
      if (t === 'awake') {
        keepAwake(true);
        setTimeout(() => {
          say(isAwake() ? 'Tela acesa ligada. Ela desliga quando você sair desta tela.' : 'O navegador não deixou manter a tela acesa.');
        }, 300);
      }
    }),
  );
  app.querySelector('#back')!.addEventListener('click', () => {
    keepAwake(false);
    go(() => renderSetup());
  });
}

// ---------- Placar ----------

function renderBoard() {
  const rows = store.ranking();
  app.innerHTML = `
  <main class="screen board">
    <div class="topbar">
      <button id="back" class="btn ghost small">Voltar</button>
      <span class="mode-tag">Placar</span>
    </div>
    ${
      rows.length
        ? `<table>
            <thead><tr><th>Nome</th><th title="Vezes que levou o tiro">Tiros</th><th title="Vezes que foi o último de pé">Vitórias</th><th>Jogos</th></tr></thead>
            <tbody>${rows
              .map(
                (r) =>
                  `<tr><td>${esc(r.name)}</td><td><span data-count="${r.shots}">${r.shots}</span></td><td><span data-count="${r.wins}">${r.wins}</span></td><td><span data-count="${r.games}">${r.games}</span></td></tr>`,
              )
              .join('')}</tbody>
          </table>
          <p class="small">Vitórias só contam no modo "Até sobrar um".</p>
          <button id="reset" class="btn ghost danger">Zerar placar</button>`
        : '<p class="hint empty">Nenhuma partida terminada ainda.</p>'
    }
  </main>`;
  stagger(app.querySelector('.screen'));
  stagger(app.querySelector('tbody'), 70);
  countUp(app);
  app.querySelector('#back')!.addEventListener('click', () => go(() => renderSetup()));
  app.querySelector('#reset')?.addEventListener('click', async () => {
    if (await ask('Zerar o placar de todo mundo?', 'Zerar')) {
      app.querySelectorAll('tbody tr').forEach((tr, i) => {
        (tr as HTMLElement).style.setProperty('--i', String(i));
        tr.classList.add('wipe');
      });
      setTimeout(() => {
        store.resetStats();
        renderBoard();
      }, 450);
    }
  });
}

installEmbers();
installRipple();
renderSetup();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
