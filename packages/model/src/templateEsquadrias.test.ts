import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, TEMPLATES, buildTemplate, isOpening, isWall, openingType, validateProject, type Opening, type Project, type Wall } from './index.ts';

const projeto = (): Project => buildTemplate('esquadrias');
const aberturas = (p: Project): Opening[] => Object.values(p.elements).filter(isOpening);
const paredes = (p: Project): Wall[] => Object.values(p.elements).filter(isWall);

describe('modelo inicial "Mostruário de esquadrias"', () => {
  it('está registrado em TEMPLATES com nome, descrição e área "—"', () => {
    const t = TEMPLATES.find((x) => x.id === 'esquadrias');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Mostruário de esquadrias');
    expect(t!.description.length).toBeGreaterThan(0);
    expect(t!.area).toBe('—');
  });

  it('tem um nível e duas paredes de 40 m: portas embaixo e janelas na paralela acima', () => {
    const p = projeto();
    expect(p.levels).toHaveLength(1);
    const ws = paredes(p);
    expect(ws).toHaveLength(2);
    for (const w of ws) expect(Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)).toBeCloseTo(40, 9);
    const portas = ws.find((w) => w.id === 'eq_w_portas')!;
    const janelas = ws.find((w) => w.id === 'eq_w_janelas')!;
    expect(portas.a.y).toBeCloseTo(0, 9);
    expect(portas.b.y).toBeCloseTo(0, 9);
    expect(janelas.a.y).toBeCloseTo(8, 9);
    expect(janelas.b.y).toBeCloseTo(8, 9);
  });

  it('usa todos os 23 tipos do catálogo uma vez, na categoria certa', () => {
    const p = projeto();
    const os = aberturas(p);
    expect(os).toHaveLength(DEFAULT_OPENING_TYPES.length);
    expect(new Set(os.map((o) => o.typeId)).size).toBe(DEFAULT_OPENING_TYPES.length);
    for (const o of os) expect(o.kind, o.id).toBe(openingType(p, o).kind);
    const idsPortas = new Set(os.filter((o) => o.kind === 'door').map((o) => o.hostId));
    const idsJanelas = new Set(os.filter((o) => o.kind === 'window').map((o) => o.hostId));
    expect(idsPortas).toEqual(new Set(['eq_w_portas']));
    expect(idsJanelas).toEqual(new Set(['eq_w_janelas']));
  });

  it('deixa 1,5 m de folga entre vizinhos e nas pontas de cada parede', () => {
    const p = projeto();
    for (const hostId of ['eq_w_portas', 'eq_w_janelas']) {
      const faixas = aberturas(p)
        .filter((o) => o.hostId === hostId)
        .map((o) => ({ e: o.offset - openingType(p, o).width / 2, d: o.offset + openingType(p, o).width / 2 }))
        .sort((a, b) => a.e - b.e);
      expect(faixas.length).toBeGreaterThan(5);
      expect(faixas[0]!.e).toBeGreaterThanOrEqual(1.5 - 1e-9);
      expect(faixas.at(-1)!.d).toBeLessThanOrEqual(40 - 1.5 + 1e-9);
      for (let i = 1; i < faixas.length; i++) expect(faixas[i]!.e - faixas[i - 1]!.d, hostId).toBeCloseTo(1.5, 9);
    }
  });

  it('metade variada: as quatro combinações de flipHand/flipFacing aparecem', () => {
    const os = aberturas(projeto());
    const combos = new Set(os.map((o) => `${o.flipHand}/${o.flipFacing}`));
    expect(combos).toEqual(new Set(['false/false', 'true/false', 'false/true', 'true/true']));
    expect(os.filter((o) => o.flipHand)).toHaveLength(Math.floor(os.length / 2));
    expect(os.filter((o) => o.flipFacing).length).toBeGreaterThanOrEqual(Math.floor(os.length / 4));
  });

  it('não gera problema de validação', () => {
    expect(validateProject(projeto())).toEqual([]);
  });
});
