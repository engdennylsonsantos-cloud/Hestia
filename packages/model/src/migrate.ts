import { DEFAULT_MATERIALS, createEmptyProject } from './defaults.ts';
import { DEFAULT_FLOOR_TYPES } from './floor.ts';
import { DEFAULT_SLAB_TYPES } from './slab.ts';
import { DEFAULT_ROOF_TYPES } from './roof.ts';
import { DEFAULT_STAIR_OPENING_MARGIN, DEFAULT_STAIR_POST_MATERIAL_ID, DEFAULT_STAIR_TREAD_OVERLAP, DEFAULT_STAIR_TYPES } from './stair.ts';
import { SCHEMA_VERSION, type PlanSymbol, type Project } from './types.ts';
import { DEFAULT_VIEW_RANGE } from './viewRange.ts';

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
  // v9 → v10: telhados com inclinação por aresta, extrusão, junção e acabamentos de beiral.
  // Deriva `edgeSlopes` da forma antiga: hip = todas as arestas; gable = só as perpendiculares à cumeeira... as paralelas a
  // `dir` definem inclinação e as outras (empenas) não; shed = só a aresta mais baixa em relação a `dir`.
  9: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) {
      if (e.kind !== 'roof') continue;
      const b = (e.boundary as Array<{ x: number; y: number }>) ?? [];
      const dir = (e.dir as { x: number; y: number }) ?? { x: 1, y: 0 };
      const pct = typeof e.slopePercent === 'number' ? e.slopePercent : 30;
      const n = b.length;
      const mid = (i: number): { x: number; y: number } => ({ x: (b[i]!.x + b[(i + 1) % n]!.x) / 2, y: (b[i]!.y + b[(i + 1) % n]!.y) / 2 });
      const proj = (q: { x: number; y: number }): number => q.x * dir.x + q.y * dir.y;
      let edgeSlopes: Array<number | null> = b.map(() => pct);
      if (e.shape === 'gable') {
        edgeSlopes = b.map((_, i) => {
          const a = b[i]!;
          const c = b[(i + 1) % n]!;
          const l = Math.hypot(c.x - a.x, c.y - a.y) || 1;
          const along = Math.abs(((c.x - a.x) * dir.x + (c.y - a.y) * dir.y) / l);
          return along > 0.7 ? pct : null;
        });
      } else if (e.shape === 'shed' && n > 0) {
        let low = 0;
        for (let i = 1; i < n; i++) if (proj(mid(i)) < proj(mid(low))) low = i;
        edgeSlopes = b.map((_, i) => (i === low ? pct : null));
      }
      elements[id] = {
        edgeSlopes,
        edgeOverhangs: b.map(() => 0),
        profile: [],
        joinOthers: true,
        rafterCut: 'plumb',
        eave: { fascia: false, fasciaHeight: 0.2, gutter: false, soffit: false },
        ...e,
      };
    }
    return { ...raw, elements };
  },
  // v10 → v11: o tipo 'square' (Esquadro) saiu; tinha a mesma geometria do encosto. Vira 'butt', com a mesma ordem (flip).
  10: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) {
      if (e.kind !== 'wall') continue;
      const w = { ...e };
      for (const end of ['joinStart', 'joinEnd'] as const) {
        const cfg = w[end] as { kind?: unknown } | undefined;
        if (cfg?.kind === 'square') w[end] = { ...cfg, kind: 'butt' };
      }
      elements[id] = w;
    }
    return { ...raw, elements };
  },
  // v11 → v12: escadas (tipos padrão; projetos antigos não têm escadas nem tipos de escada).
  11: (raw) => ({ ...raw, stairTypes: { ...Object.fromEntries(DEFAULT_STAIR_TYPES.map((t) => [t.id, t])), ...((raw.stairTypes as object) ?? {}) } }),
  // v12 → v13: face inferior dos tipos de escada. Tipos existentes ganham 'smooth' (a face lisa é a que já era desenhada).
  12: (raw) => {
    const stairTypes = { ...((raw.stairTypes as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, t] of Object.entries(stairTypes)) stairTypes[id] = { undersideStyle: 'smooth', ...t };
    return { ...raw, stairTypes };
  },
  // v13 → v14: "Abrir laje" (booleano) vira o modo da abertura: ligada = pé-direito livre (furo de antes, com o mínimo do
  // tipo), desligada = sem furo. Os campos novos entram com o padrão (decisão 0011 §6).
  13: (raw) => {
    const elements = { ...((raw.elements as Record<string, Record<string, unknown>>) ?? {}) };
    for (const [id, e] of Object.entries(elements)) {
      if (e.kind !== 'stair') continue;
      const { openSlab, ...rest } = e;
      elements[id] = {
        openingMode: openSlab === false ? 'none' : 'headroom',
        openingHeadroom: null,
        openingMargin: DEFAULT_STAIR_OPENING_MARGIN,
        openingRect: false,
        ...rest,
      };
    }
    return { ...raw, elements };
  },
  // v14 → v15: intervalo de vista por nível (decisão 0013). Níveis antigos ganham o padrão (topo 2,30 m, corte 1,20 m, base 0).
  14: (raw) => ({
    ...raw,
    levels: Array.isArray(raw.levels)
      ? (raw.levels as Array<Record<string, unknown>>).map((l) => ({ ...l, viewRange: l.viewRange ?? { ...DEFAULT_VIEW_RANGE } }))
      : raw.levels,
  }),
  // v15 → v16: escada caracol (decisão 0014 §8). Tipos existentes ganham a sobreposição e o material do poste padrão; os
  // dois tipos caracol entram e o material aço entra se faltar. Nada do arquivo com o mesmo id é sobrescrito.
  15: (raw) => {
    const own = (raw.stairTypes as Record<string, Record<string, unknown>>) ?? {};
    const stairTypes = {
      ...Object.fromEntries(DEFAULT_STAIR_TYPES.filter((t) => ['stt_caracol_monolitica', 'stt_caracol_poste'].includes(t.id)).map((t) => [t.id, t])),
      ...Object.fromEntries(
        Object.entries(own).map(([id, t]) => [id, { treadOverlap: DEFAULT_STAIR_TREAD_OVERLAP, postMaterialId: DEFAULT_STAIR_POST_MATERIAL_ID, ...t }]),
      ),
    };
    const materials = { ...Object.fromEntries(DEFAULT_MATERIALS.filter((m) => m.id === 'mat_aco').map((m) => [m.id, m])), ...((raw.materials as object) ?? {}) };
    return { ...raw, stairTypes, materials };
  },
  // v16 → v17: ambientes (Room). Guardados em `elements` (como pisos e lajes), então um arquivo v16 simplesmente não
  // os tem e nada precisa ser acrescentado: a migração só avança a versão e preserva o restante do arquivo.
  16: (raw) => ({ ...raw }),
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
