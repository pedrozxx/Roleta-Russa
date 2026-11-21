import './style.css';
import { current, MAX_PLAYERS, newGame, pull, remaining, type GameState, type Mode, type Player } from './game';
import { store } from './storage';
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
    <header class="brand">
      <div class="brand-gun">${revolverSide()}</div>
      <h1>${letters('Roleta', 0)}<br/>${letters('Russa', 6)}</h1>
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
  game = newGame(players, mode);
  rotation = {};
  lastVictim = null;
  for (const p of players) rotation[p.id] = 0;
  renderGame(true);
  spinAll();
}

function gunMarkup(p: Player) {
  const f = finishOf(p);
  return `
    <div class="gun enter" style="--glow:${f.mid}">
      ${revolverSide(f)}
      <div class="cyl-wrap">${cylinderFront(f)}</div>
      <p class="gun-name">Arma de ${esc(p.name)} · ${f.name}</p>
    </div>`;
}

function renderGame(enter = false) {
  const g = game!;
  app.innerHTML = `
  <main class="screen game">
    <div class="topbar">
      <button id="quit" class="btn ghost small">Sair</button>
      <span class="mode-tag">${g.mode === 'single' ? 'Um tiro decide' : 'Até sobrar um'}</span>
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
            <div class="mini">${cylinderFront(finishOf(p), 'front mini-cyl')}</div>
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
  app.querySelector('#quit')!.addEventListener('click', async () => {
    if (await ask('Sair da partida? Ela não vai contar no placar.', 'Sair')) {
      game = null;
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
    rotation[p.id] += 360 * 3 + 60 * Math.floor(Math.random() * 6);
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
      rotation[shooter.id] += 60;
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
      ${more ? `<p class="small">Sobraram ${g.alive.length}. As outras armas continuam como estavam.</p>` : ''}
      <button id="go" class="btn primary shine">${more ? `Próxima: ${esc(next!.name)}` : 'Ver resultado'}</button>
    </div>`;
  document.body.appendChild(overlay);
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

function finish() {
  const g = game!;
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
      ? `<ol class="order">${g.eliminated.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ol>`
      : '';
  app.innerHTML = `
  <main class="screen result">
    <section class="turn">${headline}</section>
    ${order ? `<p class="label">Ordem dos tiros</p>${order}` : ''}
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
