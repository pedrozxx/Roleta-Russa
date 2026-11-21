import './style.css';
import { current, MAX_PLAYERS, newGame, pull, remaining, type GameState, type Mode, type Player } from './game';
import { store } from './storage';
import * as sfx from './audio';
import { cylinderFront, finishFor, revolverSide } from './revolver';

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

// ---------- Tela inicial ----------

function renderSetup(focus = false) {
  const canStart = names.length >= 2;
  const full = names.length >= MAX_PLAYERS;
  app.innerHTML = `
  <main class="screen setup">
    <header class="brand">
      <div class="brand-gun">${revolverSide()}</div>
      <h1>Roleta<br/>Russa</h1>
    </header>

    <form id="add" class="add" autocomplete="off">
      <input id="name" name="name" maxlength="${MAX_NAME}" placeholder="${full ? 'Mesa cheia' : 'Nome do jogador'}" enterkeyhint="done" ${full ? 'disabled' : ''} />
      <button type="submit" class="btn small" ${full ? 'disabled' : ''}>Adicionar</button>
    </form>

    <ul class="players">
      ${names
        .map(
          (n, i) => `<li><i class="dot" style="background:${finishFor(i).mid}" title="${finishFor(i).name}"></i><span>${esc(n)}</span><button class="x" data-remove="${i}" aria-label="Remover ${esc(n)}">×</button></li>`,
        )
        .join('')}
    </ul>
    ${names.length === 0 ? '<p class="hint">Adicione pelo menos duas pessoas.</p>' : ''}
    ${names.length === 1 ? '<p class="hint">Falta mais uma pessoa.</p>' : ''}
    ${full ? `<p class="hint">Máximo de ${MAX_PLAYERS} jogadores, um revólver pra cada.</p>` : ''}

    <div class="modes" role="radiogroup" aria-label="Modo de jogo">
      <button role="radio" aria-checked="${mode === 'elimination'}" data-mode="elimination">
        <strong>Até sobrar um</strong><small>Quem leva o tiro sai. O último de pé vence.</small>
      </button>
      <button role="radio" aria-checked="${mode === 'single'}" data-mode="single">
        <strong>Um tiro decide</strong><small>Acaba no primeiro tiro. Quem levou, perdeu.</small>
      </button>
    </div>

    <button id="start" class="btn primary" ${canStart ? '' : 'disabled'}>Começar</button>
    <button id="board" class="btn ghost">Placar</button>
  </main>`;

  const input = app.querySelector<HTMLInputElement>('#name')!;
  if (focus && !full) input.focus();

  app.querySelector('#add')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = input.value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
    if (!n || names.length >= MAX_PLAYERS) return;
    if (names.some((x) => x.toLowerCase() === n.toLowerCase())) {
      input.select();
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      return;
    }
    names.push(n);
    store.setNames(names);
    renderSetup(true);
  });

  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      names.splice(Number(b.dataset.remove), 1);
      store.setNames(names);
      renderSetup();
    }),
  );

  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode as Mode;
      store.setMode(mode);
      renderSetup();
    }),
  );

  app.querySelector('#start')!.addEventListener('click', () => {
    sfx.unlock();
    startGame();
  });
  app.querySelector('#board')!.addEventListener('click', () => renderBoard());
}

// ---------- Jogo ----------

const finishOf = (p: Player) => finishFor(Number(p.id));

function startGame() {
  const players: Player[] = names.map((name, i) => ({ id: String(i), name }));
  game = newGame(players, mode);
  rotation = {};
  for (const p of players) rotation[p.id] = 0;
  renderGame();
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

function renderGame() {
  const g = game!;
  app.innerHTML = `
  <main class="screen game">
    <div class="topbar">
      <button id="quit" class="btn ghost small">Sair</button>
      <span class="mode-tag">${g.mode === 'single' ? 'Um tiro decide' : 'Até sobrar um'}</span>
    </div>

    <section class="turn" aria-live="polite">
      <p class="label" id="label">Girando os tambores...</p>
      <h2 id="who">${esc(current(g).name)}</h2>
      <p class="odds" id="odds"></p>
    </section>

    <div id="stage">${gunMarkup(current(g))}</div>

    <button id="fire" class="btn trigger" disabled>Puxar o gatilho</button>

    <ul class="rack" style="--n:${g.players.length}">
      ${g.players
        .map(
          (p) => `<li data-id="${p.id}">
            <div class="mini">${cylinderFront(finishOf(p), 'front mini-cyl')}</div>
            <span class="rack-name">${esc(p.name)}</span>
            <span class="rack-odds"></span>
          </li>`,
        )
        .join('')}
    </ul>
  </main>
  <div id="flash" class="flash"></div>`;

  for (const p of g.players) setCylinder(p, false);
  updateTurnInfo('Vez de');
  app.querySelector('#fire')!.addEventListener('click', onFire);
  app.querySelector('#quit')!.addEventListener('click', () => {
    if (confirm('Sair da partida? Ela não vai contar no placar.')) {
      game = null;
      renderSetup();
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
  app.querySelector('#label')!.textContent = label;
  app.querySelector('#who')!.textContent = current(g).name;
  const r = remaining(g);
  app.querySelector('#odds')!.textContent =
    r === 1 ? 'Última câmara da sua arma. A bala está aqui.' : `Chance de tiro na sua arma: 1 em ${r}`;
  for (const p of g.players) {
    const li = app.querySelector(`.rack li[data-id="${p.id}"]`)!;
    const out = g.eliminated.includes(p);
    li.classList.toggle('out', out);
    li.classList.toggle('now', !out && current(g) === p);
    li.querySelector('.rack-odds')!.textContent = out ? 'fora' : `1 em ${remaining(g, p)}`;
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
    app.querySelector<HTMLButtonElement>('#fire')!.disabled = false;
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
  gun.classList.add('firing');
  setTimeout(() => gun.classList.remove('firing'), 220);

  const out = pull(g);

  if (out.kind === 'empty') {
    sfx.click();
    sfx.vibrate(30);
    rotation[shooter.id] += 60;
    setCylinder(shooter, true, 250, true);
    app.querySelector('#label')!.textContent = 'Click. Vazia.';
    setTimeout(() => {
      showGunOf(out.next);
      updateTurnInfo('Passa o celular pra');
      busy = false;
      fireBtn.disabled = false;
    }, 800);
    return;
  }

  sfx.bang();
  sfx.vibrate([250, 80, 400]);
  app.querySelector('#flash')!.classList.add('on');
  app.querySelector('.game')!.classList.add('recoil');
  setTimeout(() => showShot(out.victim, out.next), 650);
}

function showShot(victim: Player, next: Player | null) {
  const g = game!;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const more = !g.over;
  overlay.innerHTML = `
    <div class="card">
      <p class="bang">BANG!</p>
      <h2>${esc(victim.name)}</h2>
      <p>${g.mode === 'single' ? 'levou o tiro e perdeu.' : 'levou o tiro e está fora.'}</p>
      ${more ? `<p class="small">Sobraram ${g.alive.length}. As outras armas continuam como estavam.</p>` : ''}
      <button id="go" class="btn primary">${more ? `Próxima: ${esc(next!.name)}` : 'Ver resultado'}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#go')!.addEventListener('click', () => {
    overlay.remove();
    if (more) {
      renderGame();
      busy = false;
      app.querySelector<HTMLButtonElement>('#fire')!.disabled = false;
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
  renderResult(g);
  game = null;
}

// ---------- Resultado ----------

function renderResult(g: GameState) {
  const headline =
    g.mode === 'single'
      ? `<p class="label">Perdeu</p><h2 class="loser">${esc(g.loser!.name)}</h2>`
      : `<p class="label">Último de pé</p><h2 class="winner">${esc(g.winner!.name)}</h2>
         <p class="small">Primeiro a cair: <strong>${esc(g.loser!.name)}</strong></p>`;
  const order =
    g.mode === 'elimination'
      ? `<ol class="order">${g.eliminated.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ol>`
      : '';
  app.innerHTML = `
  <main class="screen result">
    <section class="turn">${headline}</section>
    ${order ? `<p class="label">Ordem dos tiros</p>${order}` : ''}
    <button id="again" class="btn primary">Jogar de novo</button>
    <button id="edit" class="btn ghost">Trocar jogadores</button>
    <button id="board" class="btn ghost">Placar</button>
  </main>`;
  app.querySelector('#again')!.addEventListener('click', () => {
    sfx.unlock();
    startGame();
  });
  app.querySelector('#edit')!.addEventListener('click', () => renderSetup());
  app.querySelector('#board')!.addEventListener('click', () => renderBoard());
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
              .map((r) => `<tr><td>${esc(r.name)}</td><td>${r.shots}</td><td>${r.wins}</td><td>${r.games}</td></tr>`)
              .join('')}</tbody>
          </table>
          <p class="small">Vitórias só contam no modo "Até sobrar um".</p>
          <button id="reset" class="btn ghost danger">Zerar placar</button>`
        : '<p class="hint">Nenhuma partida terminada ainda.</p>'
    }
  </main>`;
  app.querySelector('#back')!.addEventListener('click', () => renderSetup());
  app.querySelector('#reset')?.addEventListener('click', () => {
    if (confirm('Zerar o placar de todo mundo?')) {
      store.resetStats();
      renderBoard();
    }
  });
}

renderSetup();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
