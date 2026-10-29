import type { StairType } from '@hestia/model';

/** Ponto do perfil de corte: [x, y] com y para cima e o chão em y = 0. */
export type ProfilePoint = [number, number];

type ProfileInput = Pick<StairType, 'maxRiser' | 'minTread' | 'runStyle' | 'undersideStyle' | 'structuralDepth'>;
type PostInput = Pick<StairType, 'maxRiser' | 'minTread' | 'treadThickness' | 'treadOverlap'>;

/** Entrada da prévia: o tipo e o espelho/piso já calculados pela regra (sem recalcular no desenho). */
export interface StairSectionInput {
  type: StairType;
  riser: number;
  tread: number;
}

type SectionSource = ProfileInput | StairSectionInput;

const isSectionInput = (s: SectionSource): s is StairSectionInput => 'type' in s;
const isPostSectionInput = (s: PostInput | StairSectionInput): s is StairSectionInput => 'type' in s;

const sizes = (source: SectionSource): { type: ProfileInput; r: number; t: number } =>
  isSectionInput(source)
    ? { type: source.type, r: source.riser, t: source.tread }
    : { type: source, r: Math.max(source.maxRiser, 0.05), t: Math.max(source.minTread, 0.1) };

/**
 * Contorno do corte da prévia com `n` degraus (decisão 0012 §1 #2 e §2). O degrau i tem topo em (i+1)·r; o piso e o
 * espelho do tipo seguem a forma atual. No monolítico, `structuralDepth` é perpendicular à rampa: a espessura vertical
 * equivalente é `T = d / cosθ`, com `cosθ = p / √(p² + h²)`, `p` = piso e `h` = espelho.
 * - face lisa: fundo em linha reta, paralelo à rampa, a T abaixo da linha dos narizes;
 * - face escalonada: fundo em degraus (cada degrau tem fundo plano a `r + T` abaixo do seu topo), em dente de serra.
 * No estilo poste não há contorno único (degraus soltos, sem espelho): use `stairPostTreads`; aqui devolve [].
 */
export function stairSectionProfile(source: SectionSource, n = 3): ProfilePoint[] {
  const { type, r, t } = sizes(source);
  if (type.runStyle === 'post') return [];
  if (!(r > 0) || !(t > 0) || !Number.isFinite(r) || !Number.isFinite(t)) return [];
  const top: ProfilePoint[] = [[0, 0]];
  for (let i = 0; i < n; i++) top.push([i * t, (i + 1) * r], [(i + 1) * t, (i + 1) * r]);
  if (type.runStyle !== 'monolithic') return [...top, [n * t, 0]];
  const d = Math.max(type.structuralDepth, 0);
  const T = d / (t / Math.hypot(t, r));
  if (type.undersideStyle === 'stepped') {
    const bottom: ProfilePoint[] = [];
    for (let i = n - 1; i >= 0; i--) bottom.push([(i + 1) * t, i * r - T], [i * t, i * r - T]);
    return [...top, ...bottom];
  }
  return [...top, [n * t, n * r - T], [0, -T]];
}

/**
 * Degraus soltos do estilo poste (sem espelho), um polígono por degrau com a espessura `treadThickness`. O degrau i fica
 * a `(i+1)·r` do chão e a ponta avança `treadOverlap` sobre o degrau seguinte (em planta; na prévia, a ponta do degrau).
 * Ilustrativo, não é o corte do projeto.
 */
export function stairPostTreads(source: PostInput | StairSectionInput, n = 3): ProfilePoint[][] {
  const base = isPostSectionInput(source) ? source.type : source;
  const r = isPostSectionInput(source) ? source.riser : Math.max(base.maxRiser, 0.05);
  const t = isPostSectionInput(source) ? source.tread : Math.max(base.minTread, 0.1);
  const T = Math.max(base.treadThickness, 0.01);
  const ov = Math.max(base.treadOverlap, 0);
  const out: ProfilePoint[][] = [];
  for (let i = 0; i < n; i++) {
    const yTop = (i + 1) * r;
    const yBot = yTop - T;
    const x0 = i * t;
    const x1 = (i + 1) * t + ov;
    out.push([
      [x0, yBot],
      [x1, yBot],
      [x1, yTop],
      [x0, yTop],
    ]);
  }
  return out;
}

/** Âncora de cota: segmento (x0, y0)–(x1, y1) e o valor real em metros. */
export interface SectionAnchor {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  value: number;
}

/** Âncoras de cota do corte da prévia (o desenho só posiciona; os valores vêm do tipo/do cálculo). */
export interface StairSectionAnchors {
  riser: SectionAnchor;
  tread: SectionAnchor;
  nosing: SectionAnchor;
  thickness: SectionAnchor;
  headroom: SectionAnchor;
  thicknessKind: 'structural' | 'tread';
  floorY: number;
  topY: number;
}

const emptyAnchor = (): SectionAnchor => ({ x0: 0, y0: 0, x1: 0, y1: 0, value: 0 });

/** Calcula as cotas do corte (espelho, piso, nariz, espessura e pé-direito mínimo) para os valores já calculados. */
export function stairSectionAnchors(source: StairSectionInput, n = 3): StairSectionAnchors {
  const { type, riser: r, tread: t } = source;
  const mono = type.runStyle === 'monolithic';
  const thickness = mono ? Math.max(type.structuralDepth, 0) : Math.max(type.treadThickness, 0);
  const nosing = Math.max(type.nosing, 0);
  const headroom = Math.max(type.minHeadroom, 0);
  if (!(r > 0) || !(t > 0) || !Number.isFinite(r) || !Number.isFinite(t)) {
    return {
      riser: emptyAnchor(), tread: emptyAnchor(), nosing: emptyAnchor(), thickness: emptyAnchor(), headroom: emptyAnchor(),
      thicknessKind: mono ? 'structural' : 'tread', floorY: 0, topY: 0,
    };
  }
  return {
    riser: { x0: 0, y0: 0, x1: 0, y1: r, value: r },
    tread: { x0: 0, y0: r, x1: t, y1: r, value: t },
    nosing: { x0: t, y0: r, x1: t + nosing, y1: r, value: nosing },
    thickness: mono
      ? { x0: 0, y0: -thickness / (t / Math.hypot(t, r)), x1: 0, y1: 0, value: thickness }
      : { x0: t / 2, y0: r - thickness, x1: t / 2, y1: r, value: thickness },
    headroom: { x0: 0, y0: n * r, x1: n * t, y1: n * r, value: headroom },
    thicknessKind: mono ? 'structural' : 'tread',
    floorY: 0,
    topY: n * r,
  };
}
