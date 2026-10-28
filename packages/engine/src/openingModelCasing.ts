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

function addRing(c: Ctx, r: CasingRing): void {
  const sign = faceSign(c, r.face);
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
