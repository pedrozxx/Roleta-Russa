export type Mode = 'elimination' | 'single';

export const CHAMBERS = 6;
export const MAX_PLAYERS = 6;

export interface Player {
  id: string;
  name: string;
}

/** Cada jogador tem o próprio revólver: 1 bala, gira uma vez no começo e nunca mais. */
export interface Gun {
  bullet: number;
  chamber: number;
}

export type Outcome =
  | { kind: 'empty'; next: Player }
  | { kind: 'shot'; victim: Player; next: Player | null; winner: Player | null };

export interface GameState {
  mode: Mode;
  players: Player[];
  alive: Player[];
  eliminated: Player[];
  guns: Record<string, Gun>;
  turn: number;
  over: boolean;
  loser: Player | null;
  winner: Player | null;
}

export type Rng = () => number;

/** Sorteio do sistema operacional (crypto), mais forte que Math.random. Número entre 0 e 1. */
export const secureRandom: Rng = () => {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return Math.random();
  return c.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
};

const pick = (rng: Rng, n: number) => Math.floor(rng() * n) % n;

export function newGame(players: Player[], mode: Mode, rng: Rng = secureRandom): GameState {
  if (players.length < 2) throw new Error('Precisa de pelo menos 2 jogadores');
  if (players.length > MAX_PLAYERS) throw new Error(`No máximo ${MAX_PLAYERS} jogadores`);
  const guns: Record<string, Gun> = {};
  for (const p of players) guns[p.id] = { bullet: pick(rng, CHAMBERS), chamber: 0 };
  return {
    mode,
    players: [...players],
    alive: [...players],
    eliminated: [],
    guns,
    turn: pick(rng, players.length),
    over: false,
    loser: null,
    winner: null,
  };
}

export function current(state: GameState): Player {
  return state.alive[state.turn];
}

/** Câmaras que ainda podem ter a bala na arma desse jogador. A chance do próximo tiro dele é 1 em N. */
export function remaining(state: GameState, player: Player = current(state)): number {
  return CHAMBERS - state.guns[player.id].chamber;
}

export function pull(state: GameState): Outcome {
  if (state.over) throw new Error('Jogo já acabou');
  const shooter = current(state);
  const gun = state.guns[shooter.id];

  if (gun.chamber !== gun.bullet) {
    gun.chamber += 1;
    state.turn = (state.turn + 1) % state.alive.length;
    return { kind: 'empty', next: current(state) };
  }

  state.eliminated.push(shooter);
  state.alive.splice(state.turn, 1);

  if (state.mode === 'single') {
    state.over = true;
    state.loser = shooter;
    return { kind: 'shot', victim: shooter, next: null, winner: null };
  }

  if (state.alive.length === 1) {
    state.over = true;
    state.loser = state.eliminated[0];
    state.winner = state.alive[0];
    return { kind: 'shot', victim: shooter, next: null, winner: state.winner };
  }

  // As armas dos outros continuam como estavam. A vez passa pra quem estava depois do eliminado.
  state.turn = state.turn % state.alive.length;
  return { kind: 'shot', victim: shooter, next: current(state), winner: null };
}
