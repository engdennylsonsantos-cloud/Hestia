import type { OpeningType } from '@hestia/model';

/**
 * Campos v2 opcionais com padrão por leitura (`packages/model/src/openingStyle.ts`) que o diálogo edita. O valor
 * mostrado é sempre o efetivo; ao gravar um valor igual ao padrão o campo sai do tipo e volta à leitura.
 */
export type ReadDefaultField =
  | 'leafStyle'
  | 'handle'
  | 'frameStyle'
  | 'angle2d'
  | 'angle3d'
  | 'grid'
  | 'detail2d'
  | 'detail3d'
  | 'planDisplay'
  | 'swingStyle'
  | 'leafPlan'
  | 'nominalRef'
  | 'tiltAxis'
  | 'glassKind'
  | 'leafMaterialId';

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Grava `value` no campo só quando ele difere do padrão (`fallback`). Igual ao padrão remove o campo, de modo que o
 * seletor continue mostrando o valor efetivo sem engordar o schema fechado com repetições do padrão.
 */
export function withOpeningField(
  type: OpeningType,
  field: ReadDefaultField,
  value: unknown,
  fallback: unknown,
): OpeningType {
  const next = { ...type } as Record<string, unknown>;
  if (sameValue(value, fallback)) delete next[field];
  else next[field] = value;
  return next as unknown as OpeningType;
}
