import { describe, expect, it } from 'vitest';
import { frameOfWall, openingGeometry, toLocal } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall, openingsOfWall, wallsOnLevel, type Id, type Project } from '@hestia/model';
import type { Vec2 } from '@hestia/geom';
import { pickAt, type Hit } from './pick.ts';
import { candidatesAt, wallIndexOf } from './pickIndex.ts';

/**
 * Varredura de referência: a de `pickAt` antes do índice (todas as paredes do nível, na ordem de `wallsOnLevel`). O
 * índice tem de devolver exatamente o que ela devolve; este é o oráculo da comparação por força bruta.
 */
function pickAtVarredura(p: Project, levelId: Id, at: Vec2, mpp: number): Hit | null {
  const tol = 4 * mpp;
  let bestWall: { id: Id; d: number } | null = null;
  for (const w of wallsOnLevel(p, levelId)) {
    const f = frameOfWall(p, w.id);
    if (!f) continue;
    for (const o of openingsOfWall(p, w.id)) {
      const g = openingGeometry(p, o, f);
      const l = toLocal(f, at);
      if (Math.abs(l.t - g.offset) <= g.width / 2 + tol && l.s <= f.sHi + tol && l.s >= f.sLo - tol) return { id: o.id, kind: o.kind };
    }
    const l = toLocal(f, at);
    if (l.t < -tol || l.t > f.length + tol) continue;
    const over = l.s > f.sHi ? l.s - f.sHi : l.s < f.sLo ? f.sLo - l.s : 0;
    if (over > tol) continue;
    const d = over + Math.abs(l.s - f.sMid) * 1e-3;
    if (!bestWall || d < bestWall.d) bestWall = { id: w.id, d };
  }
  return bestWall ? { id: bestWall.id, kind: 'wall' } : null;
}

/** Gerador determinístico (mulberry32): o mesmo projeto e os mesmos pontos a cada execução. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Projeto com paredes retas (com aberturas, algumas quase sobrepostas), uma curva e uma parede de outro nível. */
function projetoDeTeste(seed: number): Project {
  const rnd = prng(seed);
  const s = new ProjectStore(createEmptyProject('Pick'));
  const tipos = ['ot_p80', 'ot_j120', 'ot_pc160'];
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const a = { x: rnd() * 20, y: rnd() * 20 };
    const len = 0.5 + rnd() * 5.5;
    const ang = rnd() * Math.PI * 2;
    const b = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    const id = `w${n++}`;
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_ext19', levelId: 'lv_0', a, b }) });
    if (rnd() < 0.5) {
      const tipo = tipos[Math.floor(rnd() * tipos.length)]!;
      // Abertura que pode passar da ponta da parede (o vão da porta sai do comprimento): o índice tem de cobrir isso.
      const offset = rnd() < 0.2 ? 0.05 : len * (0.1 + rnd() * 0.8);
      s.exec({ type: 'addOpening', opening: { id: `o${id}`, kind: tipo.startsWith('ot_j') ? 'window' : 'door', typeId: tipo, hostId: id, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    }
  }
  s.exec({ type: 'addWall', wall: makeWall({ id: 'curva', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 4, y: 4 }, b: { x: 10, y: 4 }, sag: 0.8 }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'outro', typeId: 'wt_ext19', levelId: 'lv_1', a: { x: 4, y: 4 }, b: { x: 10, y: 4 } }) });
  return s.project;
}

/** Pontos de teste: aleatórios na área e perto de cada parede (meio, pontas e as bordas das aberturas). */
function pontosDeTeste(p: Project, seed: number, qtd: number): Vec2[] {
  const rnd = prng(seed);
  const out: Vec2[] = [];
  for (let i = 0; i < qtd; i++) out.push({ x: -2 + rnd() * 24, y: -2 + rnd() * 24 });
  const paredes = wallsOnLevel(p, 'lv_0');
  for (let i = 0; i < qtd; i++) {
    const w = paredes[Math.floor(rnd() * paredes.length)]!;
    const t = rnd();
    const r = (rnd() - 0.5) * 0.6;
    out.push({ x: w.a.x + (w.b.x - w.a.x) * t + r, y: w.a.y + (w.b.y - w.a.y) * t - r });
  }
  for (const w of paredes) {
    out.push(w.a, w.b);
  }
  return out;
}

describe('índice espacial de paredes (pickIndex)', () => {
  const p = projetoDeTeste(20261024);
  const pontos = pontosDeTeste(p, 7, 1500);

  it('pickAt é igual à varredura de todas as paredes, em vários zooms (tolerâncias diferentes)', () => {
    let acertos = 0;
    for (const mpp of [1 / 300, 1 / 60, 1 / 25, 1 / 5]) {
      for (const at of pontos) {
        const esperado = pickAtVarredura(p, 'lv_0', at, mpp);
        if (esperado) acertos++;
        expect(pickAt(p, 'lv_0', at, mpp)).toEqual(esperado);
      }
    }
    // O teste só vale se a conta acerta coisas: pontos sobre as paredes têm de dar acerto em boa parte dos casos.
    expect(acertos).toBeGreaterThan(1000);
    // A varredura de referência é lenta (cada parede refaz moldura e aberturas): o tempo do teste vem dela.
  }, 120_000);

  it('o nível de baixo não entra: a parede de outro nível não é candidata nem acertada', () => {
    const ix = wallIndexOf(p, 'lv_0');
    expect(ix.walls.some((w) => w.id === 'outro')).toBe(false);
    expect(pickAt(p, 'lv_0', { x: 7, y: 4 }, 1 / 50)?.id).not.toBe('outro');
    expect(pickAt(p, 'lv_1', { x: 7, y: 4 }, 1 / 50)).toEqual(pickAtVarredura(p, 'lv_1', { x: 7, y: 4 }, 1 / 50));
  });

  it('a parede curva entra sempre na consulta (não tem caixa simples)', () => {
    const ix = wallIndexOf(p, 'lv_0');
    const curvas = ix.walls.filter((w) => w.box === null).map((w) => w.id);
    expect(curvas).toContain('curva');
    for (const at of pontos.slice(0, 50)) {
      const cand = candidatesAt(ix, at, 0.1).map((i) => ix.walls[i]!.id);
      expect(cand).toContain('curva');
    }
  });

  it('a consulta devolve candidatas em ordem, sem repetição, e poda a maior parte das paredes', () => {
    const ix = wallIndexOf(p, 'lv_0');
    let total = 0;
    for (const at of pontos.slice(0, 300)) {
      const cand = candidatesAt(ix, at, 4 * (1 / 60));
      expect(cand).toEqual([...cand].sort((a, b) => a - b));
      expect(new Set(cand).size).toBe(cand.length);
      total += cand.length;
    }
    expect(total / 300).toBeLessThan(ix.walls.length / 3);
  });

  it('cada parede que a varredura acerta está entre as candidatas (nenhum acerto se perde)', () => {
    const ix = wallIndexOf(p, 'lv_0');
    const mpp = 1 / 40;
    const tol = 4 * mpp;
    for (const at of pontos) {
      const cand = new Set(candidatesAt(ix, at, 2 * tol));
      const alvo = pickAtVarredura(p, 'lv_0', at, mpp);
      if (!alvo) continue;
      const idx = ix.walls.findIndex((w) => w.id === alvo.id || w.opens.some((o) => o.id === alvo.id));
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(cand.has(idx)).toBe(true);
    }
  });

  it('o índice é guardado por projeto e nível: uma edição (outro objeto de projeto) monta outro índice', () => {
    const ix = wallIndexOf(p, 'lv_0');
    expect(wallIndexOf(p, 'lv_0')).toBe(ix);
    const s = new ProjectStore(p);
    s.exec({ type: 'addWall', wall: makeWall({ id: 'nova', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 30, y: 30 }, b: { x: 31, y: 30 } }) });
    const ix2 = wallIndexOf(s.project, 'lv_0');
    expect(ix2).not.toBe(ix);
    expect(ix2.walls.some((w) => w.id === 'nova')).toBe(true);
    expect(pickAt(s.project, 'lv_0', { x: 30.5, y: 30 }, 1 / 50)).toEqual({ id: 'nova', kind: 'wall' });
  });
});
