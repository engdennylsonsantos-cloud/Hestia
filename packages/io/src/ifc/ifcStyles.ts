/**
 * Estilo de superfície dos materiais. O `IFCMATERIAL` do IFC4 não guarda cor: a aparência viaja no caminho canônico
 * `IFCMATERIALDEFINITIONREPRESENTATION` → `IFCSTYLEDREPRESENTATION` → `IFCSTYLEDITEM` → `IFCSURFACESTYLE` →
 * `IFCSURFACESTYLERENDERING` → `IFCCOLOURRGB`. Sem ele os visualizadores mostram o cinza padrão enquanto o Hestia
 * mostra as cores do projeto.
 *
 * O IFC4 não dá GlobalId a essas entidades (`IfcMaterialDefinitionRepresentation` e `IfcRepresentation` não são
 * `IfcRoot`), então o determinismo vem da ordem fixa — materiais ordenados pelo id — e dos ids sequenciais do
 * `StepWriter`. O `Item` do `IFCSTYLEDITEM` fica `$`: `IfcMaterial` não é `IfcRepresentationItem`; o vínculo com o
 * material é o `RepresentedMaterial` do `IFCMATERIALDEFINITIONREPRESENTATION`, a forma canônica para material.
 */
import type { Material } from '@hestia/model';
import type { IfcCtx } from './ifcCtx.ts';
import { en, list, num, OMIT, ref, stepString } from './ifcStep.ts';

/** Cor de fallback (cinza claro) para `color` ausente ou fora do formato `#rrggbb`. */
const FALLBACK_RGB = [0.8, 0.8, 0.8] as const;

/** Canais RGB normalizados (0..1) de uma cor `#rrggbb`. */
function rgbOf(color: string | undefined): readonly [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((color ?? '').trim());
  if (!m) return FALLBACK_RGB;
  const v = Number.parseInt(m[1]!, 16);
  return [((v >>> 16) & 0xff) / 255, ((v >>> 8) & 0xff) / 255, (v & 0xff) / 255];
}

/** Razão normalizada (0..1) com fallback para valor ausente ou não finito. */
const ratio = (v: number, fallback: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);

/**
 * `IFCMATERIALDEFINITIONREPRESENTATION` do material com o estilo de superfície:
 *
 * - `IFCCOLOURRGB` da `color` como `SurfaceColour` e `DiffuseColour` (mesma entidade, cor difusa = cor do material);
 * - `Transparency = 1 − opacity` (0 opaco, 1 invisível);
 * - brilho: `SpecularColour` cinza em `0.5 × gloss` e `SpecularHighlight` em `IFCSPECULAREXPONENT(8 + 120 × gloss)`
 *   (fosco tem expoente baixo e reflexo largo; espelhado tem expoente alto e reflexo estreito). `ReflectanceMethod`
 *   fica `.NOTDEFINED.`: o Hestia não modela o método de reflectância.
 */
function addMaterialStyle(c: IfcCtx, m: Material, material: number): number {
  const [r, g, b] = rgbOf(m.color);
  const opacity = ratio(m.opacity, 1);
  const gloss = ratio(m.gloss, 0);
  const colour = c.w.add('IFCCOLOURRGB', [OMIT, num(r), num(g), num(b)]);
  const specular = 0.5 * gloss;
  const specularColour = c.w.add('IFCCOLOURRGB', [OMIT, num(specular), num(specular), num(specular)]);
  const rendering = c.w.add('IFCSURFACESTYLERENDERING', [
    ref(colour),
    num(1 - opacity),
    ref(colour),
    OMIT,
    OMIT,
    OMIT,
    ref(specularColour),
    `IFCSPECULAREXPONENT(${num(8 + 120 * gloss)})`,
    en('NOTDEFINED'),
  ]);
  const style = c.w.add('IFCSURFACESTYLE', [stepString(m.name), en('BOTH'), list([ref(rendering)])]);
  const item = c.w.add('IFCSTYLEDITEM', [OMIT, list([ref(style)]), OMIT]);
  const representation = c.w.add('IFCSTYLEDREPRESENTATION', [ref(c.ctx), stepString('Style'), stepString('Style'), list([ref(item)])]);
  c.w.add('IFCMATERIALDEFINITIONREPRESENTATION', [stepString(m.name), OMIT, list([ref(representation)]), ref(material)]);
  return style;
}

/**
 * Um estilo por material já escrito em `c.materials` (nunca duplica: o mapa tem uma entrada por material). Material do
 * projeto ausente (id órfão, que `materialOf` escreveu como "Material não definido") fica sem estilo, como antes.
 */
export function addStyles(c: IfcCtx): void {
  c.styles ??= new Map();
  for (const id of [...c.materials.keys()].sort()) {
    const material = c.materials.get(id);
    const m = c.p.materials[id];
    if (material === undefined || m === undefined) continue;
    c.styles.set(id, addMaterialStyle(c, m, material));
  }
}

/**
 * `IFCSTYLEDITEM` das peças de esquadria: cada `IfcExtrudedAreaSolid` (batente, folha, vidro, montante...) recebe o
 * estilo do seu material. É o caminho que o web-ifc lê primeiro (`GetStyleItemFromExpressId` consulta o `Item` antes da
 * associação de material do produto), então uma janela com vários materiais não vira uma caixa branca de material único.
 * Emitido depois de `addStyles`, quando o `IFCSURFACESTYLE` de cada material já existe.
 */
export function addItemStyles(c: IfcCtx): void {
  if (!c.itemStyles || !c.styles) return;
  for (const { item, materialId } of c.itemStyles) {
    const style = c.styles.get(materialId);
    if (style === undefined) continue;
    // IFC4: IfcStyledItem(Item, Styles, Name) — o Item vem primeiro, seguido da lista de estilos.
    c.w.add('IFCSTYLEDITEM', [ref(item), list([ref(style)]), OMIT]);
  }
}
