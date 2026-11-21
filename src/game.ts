export type Mode = 'elimination' | 'single';

export const CHAMBERS = 6;

export interface Player {
  id: string;
  name: string;
}

export type Outcome =
  | { kind: 'empty'; next: Player }
  | { kind: 'shot'; victim: Player; next: Player | null; winner: Player | null };

export interface GameState {
  mode: Mode;
  players: Player[];
  alive: Player[];
  eliminated: Player[];
  bullet: number;
  chamber: number;
  turn: number;
  over: boolean;
  loser: Player | null;
  winner: Player | null;
}

export type Rng = () => number;

const pick = (rng: Rng, n: number) => Math.floor(rng() * n) % n;

export function newGame(players: Player[], mode: Mode, rng: Rng = Math.random): GameState {
  if (players.length < 2) throw new Error('Precisa de pelo menos 2 jogadores');
  return {
    mode,
    players: [...players],
    alive: [...players],
    eliminated: [],
    bullet: pick(rng, CHAMBERS),
    chamber: 0,
    turn: pick(rng, players.length),
    over: false,
    loser: null,
    winner: null,
  };
}

export function current(state: GameState): Player {
  return state.alive[state.turn];
}

/** Câmaras que ainda podem ter a bala nesta rodada. A chance do próximo tiro é 1 em N. */
export function remaining(state: GameState): number {
  return CHAMBERS - state.chamber;
}

export function pull(state: GameState, rng: Rng = Math.random): Outcome {
  if (state.over) throw new Error('Jogo já acabou');
  const shooter = current(state);

  if (state.chamber !== state.bullet) {
    state.chamber += 1;
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

  // Recarrega e gira de novo. A vez passa pra quem estava depois do eliminado.
  state.turn = state.turn % state.alive.length;
  state.bullet = pick(rng, CHAMBERS);
  state.chamber = 0;
  return { kind: 'shot', victim: shooter, next: current(state), winner: null };
}
