# Inventário de usos soltos de unidades (U0)

Varredura de `packages/*/src` e `apps/web/src` (arquivos `.ts`/`.tsx`, exclui `*.test.*` e `node_modules`).

## Totais por padrão

| Padrão | Ocorrências |
|---|---:|
| `toFixed(` | 173 |
| `unit="m\|cm\|mm"` | 132 |
| `scale={100}` | 60 |
| `m²` | 168 |
| `m³` | 69 |
| `Intl.NumberFormat` | 0 |
| `toLocaleString` | 11 |
| `replace('.', ',')` | 110 |
| **Arquivos com ocorrências** | 184 |

## Totais por pacote

| Pacote | toFixed( | unit="m\|cm\|mm" | scale={100} | m² | m³ | Intl.NumberFormat | toLocaleString | replace('.', ',') |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| apps/web | 74 | 132 | 60 | 51 | 15 | 0 | 11 | 38 |
| packages/engine | 19 | 0 | 0 | 78 | 54 | 0 | 0 | 14 |
| packages/geom | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| packages/io | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| packages/model | 14 | 0 | 0 | 27 | 0 | 0 | 0 | 10 |
| packages/render | 12 | 0 | 0 | 7 | 0 | 0 | 0 | 6 |
| packages/tools | 45 | 0 | 0 | 4 | 0 | 0 | 0 | 41 |

## 10 arquivos com mais ocorrências (por padrão)

### `toFixed(`

| Arquivo | Ocorrências |
|---|---:|
| `apps/web/src/ui/dialogs/RoofProfileDialog.tsx` | 25 |
| `packages/tools/src/trimAlign.ts` | 6 |
| `packages/model/src/validateJoins.ts` | 5 |
| `packages/render/src/plan/tags.ts` | 5 |
| `apps/web/src/ui/dialogs/StairSectionPreview.tsx` | 5 |
| `packages/io/src/dxfNotes.ts` | 4 |
| `apps/web/src/debug/perf/overlay.ts` | 4 |
| `packages/tools/src/selectGrips.ts` | 3 |
| `packages/tools/src/stairRunPlan.ts` | 3 |
| `packages/engine/src/ceilingIssues.ts` | 2 |

### `unit="m\|cm\|mm"`

| Arquivo | Ocorrências |
|---|---:|
| `apps/web/src/ui/PlacementProperties.tsx` | 19 |
| `apps/web/src/ui/Properties.tsx` | 12 |
| `apps/web/src/ui/SectionViewProps.tsx` | 9 |
| `apps/web/src/ui/dialogs/openingType/panels/WallPanel.tsx` | 6 |
| `apps/web/src/ui/OptionsBar.tsx` | 6 |
| `apps/web/src/ui/dialogs/GridTypeDialog.tsx` | 5 |
| `apps/web/src/ui/dialogs/openingType/composition/GlassPanel.tsx` | 5 |
| `apps/web/src/ui/dialogs/openingType/panels/OverviewPanel.tsx` | 5 |
| `apps/web/src/ui/StairProperties.tsx` | 5 |
| `apps/web/src/ui/AnnotationProps.tsx` | 4 |

### `scale={100}`

| Arquivo | Ocorrências |
|---|---:|
| `apps/web/src/ui/dialogs/StairTypeDialog.tsx` | 10 |
| `apps/web/src/ui/dialogs/openingType/panels/WallPanel.tsx` | 6 |
| `apps/web/src/ui/dialogs/openingType/panels/OverviewPanel.tsx` | 5 |
| `apps/web/src/ui/dialogs/openingType/panels/sharedRows.tsx` | 4 |
| `apps/web/src/ui/dialogs/openingType/composition/GlassPanel.tsx` | 3 |
| `apps/web/src/ui/dialogs/openingType/composition/ProfilePanel.tsx` | 3 |
| `apps/web/src/ui/dialogs/openingType/panels/FramePanel.tsx` | 3 |
| `apps/web/src/ui/dialogs/openingType/panels/hardwareRows.tsx` | 3 |
| `apps/web/src/ui/dialogs/openingType/panels/OuterPanel.tsx` | 3 |
| `apps/web/src/ui/dialogs/StripsTab.tsx` | 3 |

### `m²`

| Arquivo | Ocorrências |
|---|---:|
| `apps/web/src/editor/i18nTabelas.ts` | 16 |
| `packages/engine/src/roofQuantities.ts` | 8 |
| `packages/model/src/validateFloors.ts` | 8 |
| `packages/engine/src/slabQuantities.ts` | 7 |
| `packages/engine/src/openingSchedule.ts` | 6 |
| `packages/engine/src/stairQuantities.ts` | 6 |
| `packages/engine/src/floorQuantities.ts` | 5 |
| `packages/engine/src/floorSchedule.ts` | 5 |
| `packages/engine/src/roofSchedule.ts` | 5 |
| `packages/engine/src/slabSchedule.ts` | 5 |

### `m³`

| Arquivo | Ocorrências |
|---|---:|
| `packages/engine/src/stairQuantities.ts` | 8 |
| `packages/engine/src/floorQuantities.ts` | 6 |
| `packages/engine/src/floorSchedule.ts` | 5 |
| `packages/engine/src/schedule.ts` | 5 |
| `packages/engine/src/quantities.ts` | 4 |
| `packages/engine/src/roofQuantities.ts` | 4 |
| `packages/engine/src/slabQuantities.ts` | 4 |
| `packages/engine/src/roomSchedule.ts` | 3 |
| `packages/engine/src/ceilingQuantities.ts` | 2 |
| `packages/engine/src/ceilingSchedule.ts` | 2 |

### `Intl.NumberFormat`

| Arquivo | Ocorrências |
|---|---:|
| _(nenhum)_ | 0 |

### `toLocaleString`

| Arquivo | Ocorrências |
|---|---:|
| `apps/web/src/ui/dialogs/CeilingScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/FloorScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/OpeningScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/openingType/composition/compositionControls.ts` | 1 |
| `apps/web/src/ui/dialogs/openingType/composition/ProfilePanel.tsx` | 1 |
| `apps/web/src/ui/dialogs/openingType/openingTypeControls.ts` | 1 |
| `apps/web/src/ui/dialogs/RoofScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/RoomScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/SlabScheduleDialog.tsx` | 1 |
| `apps/web/src/ui/dialogs/StairScheduleDialog.tsx` | 1 |

### `replace('.', ',')`

| Arquivo | Ocorrências |
|---|---:|
| `packages/tools/src/trimAlign.ts` | 6 |
| `packages/model/src/validateJoins.ts` | 4 |
| `packages/tools/src/selectGrips.ts` | 3 |
| `packages/tools/src/stairRunTool.ts` | 3 |
| `packages/engine/src/ceilingIssues.ts` | 2 |
| `packages/model/src/dimension.ts` | 2 |
| `packages/render/src/plan/roofs.ts` | 2 |
| `packages/tools/src/arrayRadial.ts` | 2 |
| `packages/tools/src/arrayTool.ts` | 2 |
| `packages/tools/src/transformTools.ts` | 2 |
