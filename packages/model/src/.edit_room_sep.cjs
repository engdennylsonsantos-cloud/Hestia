const fs = require('fs');
function rep(file, from, to) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(from)) throw new Error('not found in ' + file + ': ' + from.slice(0, 60));
  fs.writeFileSync(file, s.replace(from, to));
}
rep('types.ts', `  /** Textos de anotação da planta (decisão 0019); ausente = nenhum. */
  texts?: TextNote[];
}`, `  /** Textos de anotação da planta (decisão 0019); ausente = nenhum. */
  texts?: TextNote[];
  /** Linhas de separação de ambiente (decisão 0031 §3; Revit: Room Separation Line); ausente = nenhuma. */
  roomSeparators?: RoomSeparator[];
}

/** Linha de separação de ambiente: divide a área livre entre paredes em dois ambientes (Revit: Room Separation Line). */
export interface RoomSeparator {
  id: Id;
  a: Vec2;
  b: Vec2;
}`);
rep('annotations.ts', "import { type Dimension, type Id, type Project, type TextNote } from './types.ts';",
  "import { type Dimension, type Id, type Project, type RoomSeparator, type TextNote } from './types.ts';");
rep('annotations.ts', `  | { type: 'removeText'; levelId: Id; id: Id };
`, `  | { type: 'removeText'; levelId: Id; id: Id }
  | { type: 'addRoomSeparator'; levelId: Id; separator: RoomSeparator }
  | { type: 'removeRoomSeparator'; levelId: Id; id: Id };
`);
rep('annotations.ts', `export const levelTexts =`, `/** Comprimento mínimo (m) de uma linha de separação de ambiente. */
export const ROOM_SEPARATOR_MIN_LENGTH = 0.05;

/** Motivo de recusa de uma linha de separação, ou null. Pontos distintos e não muito próximos. */
export function roomSeparatorIssue(r: RoomSeparator): string | null {
  if (!finite(r.a) || !finite(r.b)) return 'As coordenadas da linha de separação devem ser números finitos.';
  if (len(sub(r.b, r.a)) < ROOM_SEPARATOR_MIN_LENGTH) return 'A linha de separação precisa de dois pontos distintos.';
  return null;
}

export const levelRoomSeparators = (p: Pick<Project, 'levels'>, levelId: Id): RoomSeparator[] =>
  p.levels.find((l) => l.id === levelId)?.roomSeparators ?? [];

export const levelTexts =`);
rep('annotations.ts', `      level.texts = level.texts.filter((t) => t.id !== c.id);
      break;
  }`, `      level.texts = level.texts.filter((t) => t.id !== c.id);
      break;
    case 'addRoomSeparator': {
      const issue = roomSeparatorIssue(c.separator);
      if (issue) throw new Error(issue);
      level.roomSeparators = [...(level.roomSeparators ?? []), c.separator];
      break;
    }
    case 'removeRoomSeparator':
      if (!level.roomSeparators?.some((r) => r.id === c.id)) throw new Error('Linha de separação inexistente');
      level.roomSeparators = level.roomSeparators.filter((r) => r.id !== c.id);
      break;
  }`);
rep('annotations.ts', "Extract<AnnotationCommand, { type: 'removeDimension' | 'removeText' }>", "Extract<AnnotationCommand, { type: 'removeDimension' | 'removeText' | 'removeRoomSeparator' }>");
rep('history.ts', `    case 'removeDimension':
      return 'Excluir cota';`, `    case 'removeDimension':
      return 'Excluir cota';
    case 'addRoomSeparator':
      return 'Criar linha de separação';
    case 'removeRoomSeparator':
      return 'Excluir linha de separação';`);
console.log('ok');
