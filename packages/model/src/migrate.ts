import { createEmptyProject } from './defaults.ts';
import { SCHEMA_VERSION, type Project } from './types.ts';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** migrations[n] leva a versão n para n+1. Cada mudança de esquema acrescenta uma entrada e um teste. */
const migrations: Record<number, Migration> = {
  // v1 → v2: configuração de junção por extremidade e flecha de arco.
  1: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) {
      if (e.kind === 'wall') {
        elements[id] = {
          ...e,
          joinStart: e.joinStart ?? { kind: 'butt', flip: false },
          joinEnd: e.joinEnd ?? { kind: 'butt', flip: false },
          sag: typeof e.sag === 'number' ? e.sag : 0,
        };
      }
    }
    return { ...raw, elements };
  },
  // v2 → v3: configurações do projeto (tolerância de junção).
  2: (raw) => ({ ...raw, settings: { joinTolerance: 0.02, ...((raw.settings as object) ?? {}) } }),
};

export class SchemaError extends Error {}

/** Valida e migra um JSON qualquer para o esquema atual. Lança SchemaError se inválido. */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new SchemaError('Arquivo inválido');
  let obj = raw as Record<string, unknown>;
  let v = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : NaN;
  if (!Number.isFinite(v)) throw new SchemaError('Arquivo sem versão de esquema');
  if (v > SCHEMA_VERSION) throw new SchemaError(`Arquivo de versão ${v} é mais novo que este programa (${SCHEMA_VERSION})`);
  while (v < SCHEMA_VERSION) {
    const m = migrations[v];
    if (!m) throw new SchemaError(`Sem migração da versão ${v}`);
    obj = m(obj);
    v += 1;
    obj.schemaVersion = v;
  }
  const base = createEmptyProject();
  const p = obj as Partial<Project>;
  if (!p.elements || !p.wallTypes || !p.levels || !p.materials || !p.openingTypes) throw new SchemaError('Arquivo incompleto');
  return { ...base, ...p, defaults: { ...base.defaults, ...(p.defaults ?? {}) }, settings: { ...base.settings, ...(p.settings ?? {}) } } as Project;
}
