import type { Mode } from './game';

export interface Stats {
  shots: number; // quantas vezes levou o tiro
  wins: number; // quantas vezes foi o último de pé
  games: number;
}

export const DEFAULT_DARES = [
  'Paga a próxima rodada',
  'Lava a louça',
  'Escolhe a próxima música',
  'Imita alguém da mesa até a próxima rodada',
  'Conta um mico',
  'Faz 10 flexões',
  'Busca a próxima bebida pra todo mundo',
  'Fica sem celular por 10 minutos',
];

interface Saved {
  names: string[];
  mode: Mode;
  sound: boolean;
  chambers: number;
  dares: string[];
  daresOn: boolean;
  stats: Record<string, Stats & { name: string }>;
}

const KEY = 'roleta-russa:v1';
const empty = (): Saved => ({
  names: [],
  mode: 'elimination',
  sound: true,
  chambers: 6,
  dares: [...DEFAULT_DARES],
  daresOn: true,
  stats: {},
});

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save(data: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* modo privado ou armazenamento cheio: o jogo segue sem salvar */
  }
}

let data = load();

export const store = {
  get names() {
    return data.names;
  },
  get mode() {
    return data.mode;
  },
  get sound() {
    return data.sound;
  },
  get chambers() {
    return data.chambers;
  },
  get dares() {
    return data.dares;
  },
  get daresOn() {
    return data.daresOn;
  },
  setSound(on: boolean) {
    data.sound = on;
    save(data);
  },
  setChambers(n: number) {
    data.chambers = n;
    save(data);
  },
  setDares(list: string[]) {
    data.dares = list;
    save(data);
  },
  setDaresOn(on: boolean) {
    data.daresOn = on;
    save(data);
  },
  setNames(names: string[]) {
    data.names = names;
    save(data);
  },
  setMode(mode: Mode) {
    data.mode = mode;
    save(data);
  },
  record(result: { players: string[]; shot: string[]; winner: string | null }) {
    for (const name of result.players) {
      const k = name.toLowerCase();
      const s = (data.stats[k] ??= { name, shots: 0, wins: 0, games: 0 });
      s.name = name;
      s.games += 1;
      if (result.shot.includes(name)) s.shots += 1;
      if (result.winner === name) s.wins += 1;
    }
    save(data);
  },
  ranking() {
    return Object.values(data.stats).sort((a, b) => b.shots - a.shots || a.wins - b.wins || a.name.localeCompare(b.name));
  },
  resetStats() {
    data.stats = {};
    save(data);
  },
};
