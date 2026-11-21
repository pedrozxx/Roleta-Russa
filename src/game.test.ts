import { describe, expect, it } from 'vitest';
import { CHAMBERS, MAX_PLAYERS, newGame, pull, remaining, current, type Player } from './game';

const make = (...names: string[]): Player[] => names.map((name, i) => ({ id: String(i), name }));
const players = make('Ana', 'Bia', 'Caio', 'Duda');

/** rng que devolve os valores em sequência. newGame sorteia a bala de cada jogador, na ordem, e depois quem começa. */
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};
const at = (k: number, n: number) => (k + 0.5) / n;
const setup = (bullets: number[], start: number, n = bullets.length) =>
  seq(...bullets.map((b) => at(b, CHAMBERS)), at(start, n));

describe('regras', () => {
  it('aceita de 2 a 6 jogadores', () => {
    expect(() => newGame(make('Ana'), 'single')).toThrow();
    expect(() => newGame(make('a', 'b', 'c', 'd', 'e', 'f', 'g'), 'single')).toThrow();
    expect(() => newGame(make('a', 'b', 'c', 'd', 'e', 'f'), 'single')).not.toThrow();
    expect(MAX_PLAYERS).toBe(6);
  });

  it('cada jogador tem a própria arma com a própria bala', () => {
    const g = newGame(players, 'single', setup([0, 1, 2, 5], 0));
    expect(players.map((p) => g.guns[p.id].bullet)).toEqual([0, 1, 2, 5]);
  });

  it('a chance de cada um sobe só com os cliques dele', () => {
    const g = newGame(make('Ana', 'Bia'), 'single', setup([5, 5], 0));
    const [ana, bia] = g.players;
    pull(g); // Ana
    expect(remaining(g, ana)).toBe(5);
    expect(remaining(g, bia)).toBe(6);
    pull(g); // Bia
    pull(g); // Ana
    expect(remaining(g, ana)).toBe(4);
    expect(remaining(g, bia)).toBe(5);
  });

  it('sem girar de novo: a arma de cada um dispara em no máximo 6 puxadas dele', () => {
    const g = newGame(make('Ana', 'Bia'), 'single', setup([5, 5], 0));
    let pulls = 0;
    let out;
    do {
      out = pull(g);
      pulls++;
    } while (out.kind === 'empty');
    expect(out).toMatchObject({ kind: 'shot', victim: { name: 'Ana' } });
    expect(pulls).toBe(11); // Ana na 6ª puxada dela, Bia teve 5
  });

  it('a vez passa em ordem', () => {
    const g = newGame(players, 'single', setup([5, 0, 5, 5], 2));
    expect(current(g).name).toBe('Caio');
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Duda' } });
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Ana' } });
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Bia' } });
    expect(pull(g)).toMatchObject({ kind: 'shot', victim: { name: 'Bia' }, next: null });
    expect(g.loser?.name).toBe('Bia');
    expect(() => pull(g)).toThrow();
  });

  it('eliminação: segue até sobrar um e ninguém recarrega', () => {
    const g = newGame(players, 'elimination', setup([0, 1, 5, 2], 0));
    expect(pull(g)).toMatchObject({ kind: 'shot', victim: { name: 'Ana' }, next: { name: 'Bia' } });
    expect(pull(g)).toMatchObject({ kind: 'empty', next: { name: 'Caio' } }); // Bia: câmara 0 vazia
    pull(g); // Caio vazio
    pull(g); // Duda vazio
    expect(pull(g)).toMatchObject({ kind: 'shot', victim: { name: 'Bia' }, next: { name: 'Caio' } });
    expect(remaining(g, g.players[2])).toBe(5); // Caio manteve o clique que já tinha dado
    pull(g); // Caio vazio
    pull(g); // Duda vazio
    pull(g); // Caio vazio
    const last = pull(g); // Duda: câmara 2, bala
    expect(last).toMatchObject({ kind: 'shot', victim: { name: 'Duda' }, winner: { name: 'Caio' } });
    expect(g.loser?.name).toBe('Ana');
    expect(g.eliminated.map((p) => p.name)).toEqual(['Ana', 'Bia', 'Duda']);
  });

  it('eliminação: quando o último da lista cai, a vez volta pro primeiro', () => {
    const g = newGame(players, 'elimination', setup([5, 5, 5, 0], 3));
    expect(pull(g)).toMatchObject({ kind: 'shot', victim: { name: 'Duda' }, next: { name: 'Ana' } });
  });

  it('em cada arma o tiro pode sair em qualquer puxada, da 1ª à 6ª, com a mesma chance', () => {
    // 60 mil armas: cada uma é puxada pelo dono até disparar, e anotamos em qual puxada saiu
    const N = 60000;
    const counts = Array(CHAMBERS).fill(0);
    for (let i = 0; i < N; i++) {
      const g = newGame(make('Ana', 'Bia'), 'elimination');
      const ana = g.players[0];
      g.turn = 0;
      let puxadas = 0;
      for (;;) {
        g.turn = g.alive.indexOf(ana); // sempre a Ana puxando a arma dela
        puxadas++;
        if (pull(g).kind === 'shot') break;
      }
      counts[puxadas - 1]++;
    }
    for (const c of counts) {
      expect(c / N).toBeGreaterThan(1 / 6 - 0.01);
      expect(c / N).toBeLessThan(1 / 6 + 0.01);
    }
  });

  it('a bala cai em todas as câmaras com frequência parecida', () => {
    const counts = Array(CHAMBERS).fill(0);
    for (let i = 0; i < 3000; i++) {
      const g = newGame(players, 'single');
      for (const p of players) counts[g.guns[p.id].bullet]++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(1700);
  });
});
