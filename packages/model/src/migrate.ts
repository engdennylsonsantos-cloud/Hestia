import { DEFAULT_MATERIALS, createEmptyProject } from './defaults.ts';
import { DEFAULT_FLOOR_TYPES } from './floor.ts';
import { DEFAULT_SLAB_TYPES } from './slab.ts';
import { DEFAULT_ROOF_TYPES } from './roof.ts';
import { SCHEMA_VERSION, type PlanSymbol, type Project } from './types.ts';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Símbolo de planta de um tipo de abertura anterior ao campo `plan`: porta de duas folhas é dupla; porta de uma folha
 * é arco; janela de duas folhas é de correr; janela de uma folha é maxim-ar; janela sem folha é fixa.
 */
function planFromLegacy(t: Record<string, unknown>): PlanSymbol {
  const leaves = t.leaves;
  if (t.kind === 'window') return leaves === 2 ? 'sliding' : leaves === 1 ? 'casement' : 'fixed';
  return leaves === 2 ? 'double' : 'swing';
}

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
  // v3 → v4: retorno de acabamentos (tipos de parede) e fechamento do vão (tipos de abertura).
  // Projetos antigos não tinham retorno: preservamos a geometria com 'none'/'inherit'.
  3: (raw) => {
    const wt = { ...((raw.wallTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(wt)) wt[id] = { wrapInserts: 'none', wrapEnds: 'none', ...t };
    const ot = { ...((raw.openingTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(ot)) ot[id] = { closure: 'inherit', ...t };
    return { ...raw, wallTypes: wt, openingTypes: ot };
  },
  // v4 → v5: faixas verticais nos tipos de parede.
  4: (raw) => {
    const wt = { ...((raw.wallTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(wt)) wt[id] = { strips: [], ...t };
    return { ...raw, wallTypes: wt };
  },
  // v5 → v6: cortes e elevações; perfil superior das paredes; custo e desempenho dos tipos de parede;
  // símbolo de planta das aberturas (derivado das folhas, pois o arquivo antigo não o tinha); configurações de
  // etiquetas, depuração de junção e nível de detalhe. Todos os defaults preservam a aparência anterior.
  5: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) if (e.kind === 'wall') elements[id] = { topProfile: null, ...e };
    const wallTypes = { ...((raw.wallTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(wallTypes)) {
      wallTypes[id] = { cost: 0, thermalU: null, acousticRw: null, fireRating: null, manufacturer: '', ...t };
    }
    const openingTypes = { ...((raw.openingTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(openingTypes)) openingTypes[id] = { plan: planFromLegacy(t), ...t };
    return {
      ...raw,
      elements,
      wallTypes,
      openingTypes,
      views: Array.isArray(raw.views) ? raw.views : [],
      settings: { showTags: false, debugJoins: false, detail: 'medium', ...((raw.settings as object) ?? {}) },
    };
  },
  // v6 → v7: pisos (tipos de piso padrão) e anexos de parede a piso (desligados nas paredes existentes).
  6: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) {
      if (e.kind === 'wall') elements[id] = { attachBottomToFloor: false, attachTopToFloor: false, ...e };
    }
    return { ...raw, elements, floorTypes: { ...Object.fromEntries(DEFAULT_FLOOR_TYPES.map((t) => [t.id, t])), ...((raw.floorTypes as object) ?? {}) } };
  },
  // v7 → v8: lajes (tipos de laje padrão).
  7: (raw) => ({ ...raw, slabTypes: { ...Object.fromEntries(DEFAULT_SLAB_TYPES.map((t) => [t.id, t])), ...((raw.slabTypes as object) ?? {}) } }),
  // v8 → v9: telhados (tipos padrão e materiais de cobertura).
  8: (raw) => ({
    ...raw,
    roofTypes: { ...Object.fromEntries(DEFAULT_ROOF_TYPES.map((t) => [t.id, t])), ...((raw.roofTypes as object) ?? {}) },
    materials: { ...Object.fromEntries(DEFAULT_MATERIALS.filter((m) => ['mat_telha_ceramica', 'mat_fibrocimento', 'mat_telha_metalica'].includes(m.id)).map((m) => [m.id, m])), ...((raw.materials as object) ?? {}) },
  }),
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
