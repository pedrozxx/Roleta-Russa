import { describe, expect, it } from 'vitest';
import { CHAMBERS, newGame, pull, remaining, current, type Player } from './game';

const players: Player[] = ['Ana', 'Bia', 'Caio', 'Duda'].map((name, i) => ({ id: String(i), name }));

/** rng que devolve os valores em sequência, pra controlar bala e quem começa */
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};
// valor que cai na posição k de n
const at = (k: number, n: number) => (k + 0.5) / n;

describe('regras', () => {
  it('exige pelo menos 2 jogadores', () => {
    expect(() => newGame(players.slice(0, 1), 'single')).toThrow();
  });

  it('sem girar de novo: o tiro sai em no máximo 6 puxadas e a chance aumenta', () => {
    const g = newGame(players, 'single', seq(at(5, CHAMBERS), at(0, 4)));
    const odds: number[] = [];
    let out;
    do {
      odds.push(remaining(g));
      out = pull(g);
    } while (out.kind === 'empty');
    expect(odds).toEqual([6, 5, 4, 3, 2, 1]);
    expect(g.over).toBe(true);
  });

  it('a vez passa em ordem', () => {
    const g = newGame(players, 'single', seq(at(3, CHAMBERS), at(2, 4)));
    expect(current(g).name).toBe('Caio');
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Duda' } });
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Ana' } });
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Bia' } });
    expect(pull(g)).toMatchObject({ kind: 'shot', victim: { name: 'Bia' } });
    expect(g.loser?.name).toBe('Bia');
  });

  it('um tiro decide: acaba no primeiro tiro', () => {
    const g = newGame(players, 'single', seq(at(0, CHAMBERS), at(1, 4)));
    const out = pull(g);
    expect(out).toMatchObject({ kind: 'shot', victim: { name: 'Bia' }, next: null });
    expect(g.over).toBe(true);
    expect(() => pull(g)).toThrow();
  });

  it('eliminação: segue até sobrar um, recarregando a cada tiro', () => {
    // começa com Ana, bala sempre na primeira câmara
    const rng = seq(at(0, CHAMBERS), at(0, 4), at(0, CHAMBERS), at(0, CHAMBERS));
    const g = newGame(players, 'elimination', rng);
    expect(pull(g, rng)).toMatchObject({ kind: 'shot', victim: { name: 'Ana' }, next: { name: 'Bia' } });
    expect(g.chamber).toBe(0);
    expect(pull(g, rng)).toMatchObject({ kind: 'shot', victim: { name: 'Bia' }, next: { name: 'Caio' } });
    const last = pull(g, rng);
    expect(last).toMatchObject({ kind: 'shot', victim: { name: 'Caio' }, winner: { name: 'Duda' } });
    expect(g.over).toBe(true);
    expect(g.loser?.name).toBe('Ana');
    expect(g.winner?.name).toBe('Duda');
  });

  it('eliminação: quando o último da lista cai, a vez volta pro primeiro', () => {
    const rng = seq(at(0, CHAMBERS), at(3, 4), at(0, CHAMBERS));
    const g = newGame(players, 'elimination', rng);
    expect(pull(g, rng)).toMatchObject({ kind: 'shot', victim: { name: 'Duda' }, next: { name: 'Ana' } });
  });

  it('a bala cai em todas as câmaras com frequência parecida', () => {
    const counts = Array(CHAMBERS).fill(0);
    for (let i = 0; i < 6000; i++) counts[newGame(players, 'single').bullet]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });
});
