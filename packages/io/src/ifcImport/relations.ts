import type { IfcFile } from './ifc.ts';
import type { StepEntity } from './step.ts';

/** Índices de relação do arquivo: tipo, vão→parede e vão→preenchimento (porta/janela). */
export interface Relations {
  typeOf: Map<number, StepEntity>;
  hostOf: Map<number, number>;
  fillerOf: Map<number, number>;
}

/** Lê `IfcRelDefinesByType`, `IfcRelVoidsElement` e `IfcRelFillsElement` uma vez. */
export function readRelations(f: IfcFile): Relations {
  const typeOf = new Map<number, StepEntity>();
  const hostOf = new Map<number, number>();
  const fillerOf = new Map<number, number>();
  for (const rel of f.byType('IFCRELDEFINESBYTYPE')) {
    const type = f.ent(rel, 5);
    if (!type) continue;
    for (const obj of f.list(rel, 4)) typeOf.set(obj.id, type);
  }
  for (const rel of f.byType('IFCRELVOIDSELEMENT')) {
    const host = f.ref(rel, 4);
    const opening = f.ref(rel, 5);
    if (host != null && opening != null) hostOf.set(opening, host);
  }
  for (const rel of f.byType('IFCRELFILLSELEMENT')) {
    const opening = f.ref(rel, 4);
    const fill = f.ref(rel, 5);
    if (opening != null && fill != null) fillerOf.set(opening, fill);
  }
  return { typeOf, hostOf, fillerOf };
}
