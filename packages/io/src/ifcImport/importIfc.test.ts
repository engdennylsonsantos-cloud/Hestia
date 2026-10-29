/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { validateProject, type Opening, type Project, type Wall } from '@hestia/model';
import { importIfc } from './index.ts';
import paredeJanela from '../../../../tests/ifc/fixtures/parede-janela.ifc?raw';
import predioSimples from '../../../../tests/ifc/fixtures/predio-simples.ifc?raw';
import casaPequena from '../../../../tests/ifc/fixtures/casa-pequena.ifc?raw';
import fzkHaus from '../../../../tests/ifc/fixtures/fzk-haus.ifc?raw';

const elementos = (p: Project) => Object.values(p.elements);
const paredes = (p: Project): Wall[] => elementos(p).filter((e): e is Wall => e.kind === 'wall');
const aberturas = (p: Project): Opening[] => elementos(p).filter((e): e is Opening => e.kind === 'door' || e.kind === 'window');
const comprimento = (w: Wall): number => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

/** GlobalId de um produto no texto IFC (o importador usa esse valor para formar o id do elemento). */
const globalId = (texto: string, tipo: string): string => new RegExp(`${tipo}\\('([^']+)'`).exec(texto)?.[1] ?? '';

/** Caminhos dos números não finitos, para apontar onde apareceu o NaN/Infinity. */
function naoFinitos(valor: unknown, caminho = 'projeto'): string[] {
  if (typeof valor === 'number') return Number.isFinite(valor) ? [] : [`${caminho}=${valor}`];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => naoFinitos(v, `${caminho}[${i}]`));
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => naoFinitos(v, `${caminho}.${k}`));
  return [];
}

describe('importIfc — parede-janela.ifc (IFC4, unidade em milímetro)', () => {
  const { project, report } = importIfc(paredeJanela);

  it('traz uma parede de 3 m de comprimento, 0,30 m de espessura e 2 m de altura', () => {
    const lista = paredes(project);
    expect(lista).toHaveLength(1);
    const parede = lista[0]!;
    expect(comprimento(parede)).toBeCloseTo(3, 6);
    expect(parede.height).toBeCloseTo(2, 6);
    const tipo = project.wallTypes[parede.typeId]!;
    expect(tipo.layers[0]!.thickness).toBeCloseTo(0.3, 6);
  });

  it('converte milímetro para metro: a parede tem 3 m, não 3000 m', () => {
    // O comprimento do arquivo é 3000 mm; só passa se a unidade LENGTHUNIT for aplicada.
    expect(comprimento(paredes(project)[0]!)).toBeCloseTo(3, 6);
    expect(comprimento(paredes(project)[0]!)).toBeLessThan(10);
  });

  it('hospeda a janela na parede, com offset 1,5 e tipo 1×1 m com peitoril 0,5', () => {
    const lista = aberturas(project);
    expect(lista).toHaveLength(1);
    const janela = lista[0]!;
    expect(janela.kind).toBe('window');
    expect(janela.hostId).toBe(paredes(project)[0]!.id);
    expect(janela.offset).toBeCloseTo(1.5, 6);
    const tipo = project.openingTypes[janela.typeId]!;
    expect(tipo.kind).toBe('window');
    expect(tipo.width).toBeCloseTo(1, 6);
    expect(tipo.height).toBeCloseTo(1, 6);
    expect(tipo.sill).toBeCloseTo(0.5, 6);
    expect(report.imported).toMatchObject({ paredes: 1, janelas: 1 });
  });

  it('forma os ids a partir do GlobalId e é determinístico', () => {
    expect(paredes(project)[0]!.id).toBe(`w_${globalId(paredeJanela, 'IFCWALL')}`);
    expect(aberturas(project)[0]!.id).toBe(`o_${globalId(paredeJanela, 'IFCWINDOW')}`);
    expect(JSON.stringify(importIfc(paredeJanela).project)).toBe(JSON.stringify(project));
  });
});

describe('importIfc — predio-simples.ifc (IFC4 com malha tessellated)', () => {
  const { project, report } = importIfc(predioSimples);

  it('traz ao menos 4 paredes, 3 pisos/lajes e 2 ambientes', () => {
    expect(paredes(project).length).toBeGreaterThanOrEqual(4);
    const pisosELajes = elementos(project).filter((e) => e.kind === 'floor' || e.kind === 'slab');
    expect(pisosELajes.length).toBeGreaterThanOrEqual(3);
    const ambientes = elementos(project).filter((e) => e.kind === 'room');
    expect(ambientes.length).toBeGreaterThanOrEqual(2);
    expect(report.imported['paredes']).toBeGreaterThanOrEqual(4);
  });

  it('não deixa coordenada NaN nem Infinity nos elementos', () => {
    expect(naoFinitos(elementos(project))).toEqual([]);
  });
});

describe('importIfc — casa-pequena.ifc (IFC4 com B-rep)', () => {
  const { project } = importIfc(casaPequena);

  it('lê a parede de 10 m do B-rep', () => {
    const lista = paredes(project);
    expect(lista).toHaveLength(1);
    expect(comprimento(lista[0]!)).toBeCloseTo(10, 4);
  });
});

describe('importIfc — fzk-haus.ifc (IFC2x3, 4 MB)', () => {
  const { project, report } = importIfc(fzkHaus);

  it('importa 13 paredes, 5 portas, 11 janelas, 7 ambientes e 2 níveis', () => {
    expect(report.schema).toBe('IFC2X3');
    expect(report.levels).toBe(2);
    expect(project.levels).toHaveLength(2);
    expect(report.imported).toMatchObject({ paredes: 13, portas: 5, janelas: 11, ambientes: 7 });
  });

  it('cada abertura tem hostId de uma parede existente', () => {
    const lista = aberturas(project);
    expect(lista).toHaveLength(16);
    for (const abertura of lista) {
      const anfitria = project.elements[abertura.hostId];
      expect(anfitria, `abertura ${abertura.id} sem anfitriã`).toBeDefined();
      expect(anfitria!.kind, `abertura ${abertura.id}`).toBe('wall');
    }
  });

  it('validateProject não aponta opening-out-of-wall', () => {
    const codigos = validateProject(project).map((issue) => issue.code);
    expect(codigos).not.toContain('opening-out-of-wall');
  });
});

describe('importIfc — robustez', () => {
  it('texto vazio não lança e devolve projeto vazio com relatório', () => {
    const { project, report } = importIfc('');
    expect(elementos(project)).toEqual([]);
    expect(report.schema).toBe('');
    expect(report.imported).toEqual({});
  });

  it('texto sem IFCPROJECT não lança e devolve projeto vazio com relatório', () => {
    const semProjeto = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1 = IFCWALL('guid-sem-projeto',#2,'Parede',$,$,$,$,$,.T.);
ENDSEC;
END-ISO-10303-21;`;
    const { project, report } = importIfc(semProjeto);
    expect(elementos(project)).toEqual([]);
    expect(report).toMatchObject({ schema: 'IFC4', imported: {}, skipped: {}, warnings: [] });
  });
});
