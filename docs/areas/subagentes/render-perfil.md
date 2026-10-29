# Render — perfil de planta e anotações da planta de área

## Perfil criado

`packages/render/src/plan/types.ts`:

```ts
export interface PlanProfile {
  walls: 'light' | 'normal' | 'hidden';
  openings: boolean;
  floors: boolean;
  dimensions: boolean;
  texts: boolean;
  detail: boolean;
  tags: boolean;
  grids: boolean;
  sectionMarks: boolean;
  rooms: boolean;
  referenceLines: boolean;
  underlay: boolean;
  roofProjection: boolean;
}

export const FLOOR_PLAN_PROFILE: PlanProfile;   // piso: paredes normais e tudo ligado
export const AREA_PLAN_PROFILE: PlanProfile;    // área: paredes claras, diagonais e etiquetas
export function areaPlanProfile(plan: Pick<AreaPlan, 'graphics' | 'annotations'>): PlanProfile;
```

`areaPlanProfile` traduz `AreaPlanGraphics` (paredes, aberturas, pisos, cotas, anotações, nível de baixo,
diagonais). As anotações próprias da vista (`plan.annotations`) aparecem mesmo com `showDimensions` /
`showAnnotations` desligados; sem anotações próprias valem os gráficos, que filtram o fallback para as do nível.

## Assinatura de `noteOps`

```ts
export function noteOps(
  p: Project,
  levelId: Id,
  pt: PlanPaint,
  look: NoteLook,
  scale: number,
  v?: Viewport,
  annotations?: AreaPlanAnnotations,
): NoteOps;
```

- Com `annotations`: usa cotas, textos, linhas/regiões de detalhe e etiquetas de elemento DA VISTA (não soma as do
  nível) e desenha as etiquetas de elemento pelo mesmo `elementTagOps`.
- Sem `annotations`: comportamento anterior (arrays do nível, sem etiquetas de elemento — o `build.ts` as desenha à
  parte).
- As linhas de separação de ambiente continuam vindo do nível nos dois casos.
- `annotationsOfLevel(p, levelId)` monta o fallback no mesmo formato.

## Planta de área

`buildAreaPlanGeometry` usa `areaPlanProfile(plan)` e o mesmo motor da planta de piso: `floorAndSlabOps`,
`areaPlanRoomOps`, paredes claras/normais, `openingSymbolStrokes` (extraído do caminho de piso), `gridOps`,
`sectionMarksOf`, `noteOps` com as anotações da vista, `wallTagLabels`, `openingTagLabels`, `areaPlanTagOps`,
legenda e quadro. A ordem de desenho e o visual padrão (diagonais, separador, rótulos sem fundo, legenda/quadro,
tema claro/escuro) foram mantidos. `planGeometrySelection` aceita a planta de área e inclui `planAnnotationIds`, então
a seleção de cota/texto chega ao desenho; a sobreposição (`areaPlanHighlightOps`) e o fantasma de rótulo
(`labelGhostOps`) seguem no `PlanFrame`.

## Testes

```sh
npx vitest run packages/render/src/plan packages/render/src/sheet
```

Cobertura nova: anotações da vista na área (cota/texto/detalhe/etiqueta), isolamento entre duas plantas do mesmo
nível, fallback para o nível, piso continuando com `level.dimensions/texts`, seleção de cota/texto, legenda +
diagonais, e texto em mm de papel na prancha (`areaPlanPartsOf`).

Observação: `packages/render/src/plan/ouroZoom.test.ts` falha de forma pré-existente (72 casos) porque o golden
`ouroZoom.json` foi gerado antes das alterações não commitadas de `rooms.ts` (16:01) e `stairs.ts` (00:32); nenhuma
dessas alterações é desta tarefa. Excluindo esse arquivo, `plan` + `sheet` passam: **55 arquivos / 576 testes**.
