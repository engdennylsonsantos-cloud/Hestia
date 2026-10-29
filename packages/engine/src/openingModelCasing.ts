import {
  casingRings,
  openingCompositionOf,
  openingProfilesOf,
  resolveLayout,
  resolveProfile,
  type CasingRing,
  type OpeningComposition,
  type ResolvedLayout,
} from '@hestia/model';
import { addPart, box, type Ctx } from './openingModelContext.ts';
import { partTransformed } from './openingModelTransforms.ts';

/*
 * Alizar (spec F1 §4), para TODO caminho de montagem. Contorna o CONJUNTO: anel interno = envoltória das luzes das células
 * (+ recuo `setback`, 0 = aresta alinhada à face interna do batente), anel externo = interno + largura. Porta: 3 lados;
 * janela: 4. Nenhum alizar em divisores internos. Assenta sobre a face acabada (`s` de T/2 a T/2 + espessura) e forma UMA
 * silhueta por face (`group 'casing-<exterior|interior>'`; ids `casing-<lado>-a|b`, `a` = lado de s negativo).
 */

/** Face da parede (`exterior`/`interior`) no sinal de `s`: o lado da face externa/interna em relação ao plano médio. */
const faceSign = (c: Ctx, face: 'exterior' | 'interior'): 1 | -1 => ((face === 'exterior' ? c.f.sExt : c.f.sInt) - c.f.sMid < 0 ? -1 : 1);

/**
 * Composição e layout do caminho de UMA célula: o vão e o batente vêm do `Ctx` (a mesma fonte das peças do batente: `hw`, `H`,
 * `J`), então o anel parte da face interna do batente real, também no estilo `aduela` (J = 0,03) e no vão sem folha.
 */
function singleCellLayout(c: Ctx): { comp: OpeningComposition; layout: ResolvedLayout } | null {
  const base = openingCompositionOf(c.t);
  if (!base.casing) return null;
  const presets = openingProfilesOf(c.p);
  const frame = resolveProfile(base.frame.profile, presets);
  const comp: OpeningComposition = {
    ...base,
    nominal: { ref: 'opening', width: c.hw * 2, height: c.H },
    frame: { ...base.frame, style: 'rebate', profile: { inline: { ...frame, visibleWidth: c.J } } },
  };
  return { comp, layout: resolveLayout(comp, presets, c.t.kind) };
}

/** Ângulos (graus) em que se mede o envelope da folha, e margem (m) entre a folha e a borda interna do alizar. */
const SWEEP_ANGLES = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90];
const SWEEP_MARGIN = 0.003;

/**
 * Alizar da face em que a folha abre: a folha fecha com a borda dentro do rebaixo do batente (no `ot_p90`, 11 mm além da
 * luz) e sai por essa face, então o alizar começando na face interna do batente cobriria a saída; a 90° ela ainda fica
 * na frente da ombreira da dobradiça. Cada vertical recua o necessário para sair do envelope da folha de 0° a 90° (nem o Revit nem
 * o ArchiCAD documentam um afastamento; ver docs/aberturas/pesquisa-f0/R6), mantendo a largura; a cabeceira acompanha. Sem
 * recuo na face em que a folha não abre nem onde ela não chega ao alizar (pivotante, correr).
 */
function clearOpenLeaf(c: Ctx, r: CasingRing, sign: 1 | -1): CasingRing {
  const a = sign * (c.thickness / 2);
  const b = sign * (c.thickness / 2 + r.thickness);
  const sa = Math.min(a, b);
  const sb = Math.max(a, b);
  let { t0, t1 } = r.inner;
  const wl = r.inner.t0 - r.outer.t0;
  const wr = r.outer.t1 - r.inner.t1;
  for (const p of c.parts) {
    if (p.role !== 'leaf' || p.motion?.kind !== 'rotate' || p.motion.axis !== 'z') continue;
    for (const g of SWEEP_ANGLES) {
      const v = partTransformed(p, { angle: (g * Math.PI) / 180, slide: 0 }).bounds;
      if (!(v.s1 > sa && v.s0 < sb)) continue; // não invade a faixa `s` do alizar desta face
      if (v.t1 > r.outer.t0 && v.t0 - SWEEP_MARGIN < t0) t0 = v.t0 - SWEEP_MARGIN;
      if (v.t0 < r.outer.t1 && v.t1 + SWEEP_MARGIN > t1) t1 = v.t1 + SWEEP_MARGIN;
    }
  }
  // Recuo simétrico (o maior dos dois lados, em múltiplos de 0,5 mm): o alizar da face fica regular em volta do vão.
  const recuo = Math.ceil(Math.max(r.inner.t0 - t0, t1 - r.inner.t1, 0) * 2000 - 1e-9) / 2000;
  if (recuo <= 0) return r;
  return { ...r, inner: { ...r.inner, t0: r.inner.t0 - recuo, t1: r.inner.t1 + recuo }, outer: { ...r.outer, t0: r.inner.t0 - recuo - wl, t1: r.inner.t1 + recuo + wr } };
}

function addRing(c: Ctx, ring: CasingRing): void {
  const sign = faceSign(c, ring.face);
  const r = clearOpenLeaf(c, ring, sign);
  const group = `casing-${r.face}`;
  const s0 = sign * (c.thickness / 2);
  const s1 = sign * (c.thickness / 2 + r.thickness);
  const { inner, outer } = r;
  const add = (id: string, t0: number, t1: number, z0: number, z1: number): void =>
    addPart(c, `casing-${id}-${sign < 0 ? 'a' : 'b'}`, 'casing', 'casing', box(t0, t1, s0, s1, z0, z1), { group });
  add('left', outer.t0, inner.t0, inner.z0, inner.z1);
  add('right', inner.t1, outer.t1, inner.z0, inner.z1);
  add('head', outer.t0, outer.t1, inner.z1, outer.z1);
  if (!r.openBottom) add('sill', outer.t0, outer.t1, outer.z0, inner.z0);
}

/**
 * Peças do alizar. `resolved` vem do orquestrador de composição (várias células); sem ele o tipo é de UMA célula e o anel é
 * montado a partir do `Ctx`. Sem `casing` (ou `faces 'none'`), nada.
 */
export function buildCasing(c: Ctx, resolved?: { comp: OpeningComposition; layout: ResolvedLayout }): void {
  const r = resolved ?? singleCellLayout(c);
  if (!r?.comp.casing) return;
  // 'swing'/'opposite' são relativos à folha principal: a que lado de `s` ela abre (`side`) e qual face da parede é esse lado.
  const swingFace = faceSign(c, 'exterior') === c.side ? 'exterior' : 'interior';
  for (const ring of casingRings(r.comp, r.layout, c.t.kind, swingFace)) {
    if (ring.thickness > 0) addRing(c, ring);
  }
}
