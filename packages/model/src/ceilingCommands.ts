import type { Command } from './commands.ts';
import { isCeiling, type Ceiling, type Project } from './types.ts';

/** Comando de forro, sem o `switch` de `commands.ts` (aquele arquivo passa do limite de linhas). */
export type CeilingCommand = Extract<Command, { type: 'addCeiling' | 'addCeilings' | 'updateCeiling' | 'removeCeiling' | 'upsertCeilingType' | 'deleteCeilingType' | 'duplicateCeilingType' }>;

/** Validação de um forro novo: contorno com ao menos 3 pontos, tipo existente e nível existente. */
function validateCeilingInput(p: Project, c: Omit<Ceiling, 'order'>): void {
  if (c.boundary.length < 3) throw new Error('O contorno do forro precisa de ao menos 3 pontos');
  if (!p.ceilingTypes[c.typeId]) throw new Error('Tipo de forro inexistente');
  if (!p.levels.some((l) => l.id === c.levelId)) throw new Error('Nível inexistente');
}

/**
 * Aplica um comando de forro (decisão 0021). Devolve false quando o comando não é de forro: quem chama segue o `switch`
 * normal de `applyCommand`.
 */
export function applyCeilingCommand(p: Project, c: Command): boolean {
  switch (c.type) {
    case 'addCeiling':
      validateCeilingInput(p, c.ceiling);
      p.elements[c.ceiling.id] = { ...c.ceiling, order: p.nextOrder++ };
      return true;
    case 'addCeilings':
      // Tudo ou nada: valida o lote inteiro antes de criar qualquer forro ("Forro no ambiente" é um só desfazer).
      for (const x of c.ceilings) validateCeilingInput(p, x);
      for (const x of c.ceilings) p.elements[x.id] = { ...x, order: p.nextOrder++ };
      return true;
    case 'updateCeiling': {
      const e = p.elements[c.id];
      if (!isCeiling(e)) throw new Error('Forro inexistente');
      p.elements[c.id] = { ...e, ...c.patch };
      return true;
    }
    case 'removeCeiling':
      if (!isCeiling(p.elements[c.id])) throw new Error('Forro inexistente');
      delete p.elements[c.id];
      return true;
    case 'upsertCeilingType':
      p.ceilingTypes[c.ceilingType.id] = c.ceilingType;
      return true;
    case 'deleteCeilingType':
      if (Object.values(p.elements).some((e) => isCeiling(e) && e.typeId === c.id)) throw new Error('Tipo em uso');
      if (Object.keys(p.ceilingTypes).length <= 1) throw new Error('O projeto precisa de ao menos um tipo de forro');
      delete p.ceilingTypes[c.id];
      return true;
    case 'duplicateCeilingType': {
      const src = p.ceilingTypes[c.id];
      if (!src) throw new Error('Tipo de forro inexistente');
      if (p.ceilingTypes[c.newId]) throw new Error('Já existe um tipo de forro com esse id');
      p.ceilingTypes[c.newId] = { ...src, id: c.newId, name: c.name, layers: src.layers.map((l) => ({ ...l })) };
      return true;
    }
    default:
      return false;
  }
}
