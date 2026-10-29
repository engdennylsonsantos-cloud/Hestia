import { isGeneric, type Generic, type Id, type Project } from '@hestia/model';
import type { DxfPoint } from './dxf.ts';

/**
 * Camada dos objetos importados de outro programa e sem equivalente nativo (`Generic`, `kind: 'generic'`): vigas, pilares,
 * mobiliário, MEP... O que sai é só o contorno em planta (`outline`, o hull da malha); a malha em si não entra no DXF.
 */
export const DXF_LAYER_GENERIC = 'IMPORTADO';

/** Cor ACI da camada dos importados: 8, o cinza (mesmo tom das camadas de projeção leves). */
const GENERIC_COLOR = 8;

const EPS = 1e-9;

/** Coordenadas com 6 casas (1 µm); zero negativo vira zero, como em `dxf.ts`. */
const fmt = (v: number): string => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6);

/** Anel sem o vértice de fechamento repetido. Com menos de 3 vértices não há área: devolve null. */
function openRing(ring: DxfPoint[]): DxfPoint[] | null {
  const first = ring[0];
  const last = ring[ring.length - 1];
  const repeated = ring.length > 1 && first !== undefined && last !== undefined && Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS;
  const pts = repeated ? ring.slice(0, -1) : ring;
  return pts.length >= 3 ? pts : null;
}

/**
 * Polilinha fechada de um contorno, no mesmo estilo de `exportDxf` (R12, `AC1009`): `POLYLINE` com a flag 1 no código 70,
 * um `VERTEX` por ponto e `SEQEND` no fim. A cor vai no próprio registro (código 62), então a camada aparece cinza mesmo
 * sem entrada na tabela LAYER; sem 40/41/370, a polilinha é de largura zero.
 */
function polylineRecords(pts: DxfPoint[], layer: string): string[] {
  const out: string[] = [];
  const rec = (code: number, value: string | number): void => {
    out.push(String(code), String(value));
  };
  rec(0, 'POLYLINE');
  rec(8, layer);
  rec(62, GENERIC_COLOR);
  rec(66, 1);
  rec(10, '0.000000');
  rec(20, '0.000000');
  rec(70, 1);
  for (const p of pts) {
    rec(0, 'VERTEX');
    rec(8, layer);
    rec(10, fmt(p.x));
    rec(20, fmt(p.y));
  }
  rec(0, 'SEQEND');
  rec(8, layer);
  return out;
}

/**
 * Registros DXF (pares código/valor em sequência, prontos para a seção ENTITIES) de cada `Generic` do nível que tem
 * `outline` em planta: um `POLYLINE` fechado por objeto, na camada `IMPORTADO` (`layer`), em ordem determinística de `id`.
 * Outline com menos de 3 pontos (ou repetido no fechamento) não desenha nada. Sem genéricos no nível: lista vazia.
 */
export function dxfGenericRecords(p: Project, levelId: Id, layer = DXF_LAYER_GENERIC): string[] {
  const generics = Object.values(p.elements)
    .filter((e): e is Generic => isGeneric(e) && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: string[] = [];
  for (const g of generics) {
    const pts = g.outline ? openRing(g.outline) : null;
    if (pts) out.push(...polylineRecords(pts, layer));
  }
  return out;
}
