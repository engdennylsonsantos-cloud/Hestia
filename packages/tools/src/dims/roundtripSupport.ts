import { expect } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import type { Project, ProjectStore } from '@hestia/model';
import type { TempDim } from './types.ts';

export const ANGLES = [0, 45, 90, 180, 270] as const;
const DEG = Math.PI / 180;

export const dirOf = (angle: number): Vec2 => ({ x: Math.cos(angle * DEG), y: Math.sin(angle * DEG) });
export const normalOf = (u: Vec2): Vec2 => ({ x: -u.y, y: u.x });
export const along = (a: Vec2, u: Vec2, t: number): Vec2 => ({ x: a.x + u.x * t, y: a.y + u.y * t });
export const ORIGIN: Vec2 = { x: 0, y: 0 };

/**
 * Cena mínima de um provedor de cotas. `dims` recalcula o mesmo sujeito sobre o projeto vivo; `rest` serializa tudo
 * que não é o elemento editado (para provar que a edição não mexeu no resto do projeto); `ownLength` é a medida
 * rígida do elemento (comprimento da parede, corda da grade, comprimento da linha) validada nas translações.
 */
export interface Fixture {
  readonly store: ProjectStore;
  readonly dims: () => TempDim[];
  readonly targetId: string;
  readonly translation: boolean;
  readonly ownLength: (p: Project) => number;
  readonly rest: (p: Project) => string;
}

export interface EditableCase {
  readonly provider: string;
  readonly variant: string;
  readonly angle: number;
  readonly ref: string;
  readonly build: () => Fixture;
  /** Chaves das cotas editáveis que este caso percorre. */
  readonly keys: readonly string[];
}

function valuesOf(m0: number): number[] {
  const out: number[] = [];
  for (const v of [m0 + 0.5, m0 - 0.3, 3, m0]) {
    if (!(v > 1e-9) || !Number.isFinite(v)) continue;
    if (!out.some((x) => Math.abs(x - v) < 1e-9)) out.push(v);
  }
  return out;
}

/**
 * Ida e volta de uma cota: lê `m0`, edita para cada valor válido, aplica os comandos e remede a MESMA cota. Confere
 * o valor digitado (tolerância 1e-6), que nenhum outro elemento mudou e, nas edições por translação, que o próprio
 * elemento não mudou de comprimento.
 */
export function roundtrip(c: EditableCase): void {
  for (const key of c.keys) {
    const base = c.build();
    const first = base.dims().find((d) => d.key === key);
    expect(first, `cota ${key} não encontrada`).toBeDefined();
    expect(first!.edit, `cota ${key} deveria ser editável`).toBeTypeOf('function');
    const m0 = first!.value;
    for (const v of valuesOf(m0)) {
      const f = c.build();
      const dim = f.dims().find((d) => d.key === key)!;
      const restBefore = f.rest(f.store.project);
      const lengthBefore = f.ownLength(f.store.project);
      const result = dim.edit!(v);
      expect('commands' in result, `${c.provider}: edit(${v}) devolveu erro`).toBe(true);
      if (!('commands' in result)) continue;
      for (const command of result.commands) f.store.exec(command);
      const after = f.dims().find((d) => d.key === key);
      expect(after, `cota ${key} sumiu depois de editar para ${v}`).toBeDefined();
      expect(f.rest(f.store.project), 'outro elemento mudou').toBe(restBefore);
      if (f.translation) {
        expect(Math.abs(f.ownLength(f.store.project) - lengthBefore), 'o comprimento mudou na translação').toBeLessThan(1e-9);
      }
      expect(Math.abs(after!.value - v), `esperado ${v}, obtido ${after!.value}`).toBeLessThanOrEqual(1e-6);
    }
  }
}

/** Prova que a cota é somente leitura (exclusão explícita dos casos que não têm ida e volta). */
export function readOnly(dims: TempDim[]): void {
  expect(dims.length).toBeGreaterThan(0);
  expect(dims.every((d) => d.edit === undefined)).toBe(true);
}
