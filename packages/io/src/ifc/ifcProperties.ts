import type { IfcCtx } from './ifcCtx.ts';
import { gid } from './ifcCtx.ts';
import { int, list, num, OMIT, ref, StepWriter, stepString } from './ifcStep.ts';

/** Valor de uma propriedade no `IfcValue`: booleano, inteiro, real ou texto. */
export type PropValue = string | number | boolean;

/** `IFCPROPERTYSINGLEVALUE` com o valor no tipo IFC mais próximo (`IFCBOOLEAN`, `IFCINTEGER`, `IFCREAL` ou `IFCLABEL`). */
export function singleValue(w: StepWriter, name: string, value: PropValue): number {
  const nominal =
    typeof value === 'boolean'
      ? `IFCBOOLEAN(${value ? '.T.' : '.F.'})`
      : typeof value === 'number'
        ? Number.isInteger(value)
          ? `IFCINTEGER(${int(value)})`
          : `IFCREAL(${num(value)})`
        : `IFCLABEL(${stepString(value)})`;
  return w.add('IFCPROPERTYSINGLEVALUE', [stepString(name), OMIT, nominal, OMIT]);
}

/**
 * `IFCPROPERTYSET` com as propriedades na ordem dada e `IFCRELDEFINESBYPROPERTIES` ligando o conjunto ao objeto. O
 * GlobalId é determinístico pela `key` (`pset:wall:<id>`, `pset:door:<id>`...), então o mesmo projeto gera o mesmo texto.
 */
export function addPropertySet(
  c: IfcCtx,
  key: string,
  name: string,
  props: ReadonlyArray<readonly [string, PropValue]>,
  object: number,
): void {
  if (props.length === 0) return;
  const singles = props.map(([n, v]) => ref(singleValue(c.w, n, v)));
  const set = c.w.add('IFCPROPERTYSET', [gid(key), OMIT, stepString(name), OMIT, list(singles)]);
  c.w.add('IFCRELDEFINESBYPROPERTIES', [gid(`${key}:rel`), OMIT, OMIT, OMIT, list([ref(object)]), ref(set)]);
}
