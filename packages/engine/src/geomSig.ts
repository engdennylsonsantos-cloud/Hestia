import type { MultiPolygon } from '@hestia/geom';

/** Arredonda para 1e-6 m: assinaturas de geometria comparam formas sem ruído de ponto flutuante. */
export const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Assinatura textual de uma forma (anéis arredondados): chave de cache de cotas e cortes. */
export const ringsOfShape = (m: MultiPolygon): string => m.map((p) => p.map((r) => r.map((v) => `${round(v.x)},${round(v.y)}`).join(';')).join('|')).join('/');

export const sigOf = (m: MultiPolygon): string => ringsOfShape(m);
