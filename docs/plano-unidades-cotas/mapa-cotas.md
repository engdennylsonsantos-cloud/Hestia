# Mapa do sistema de cotas atual (D0)

Onde cada coisa é calculada, desenhada e editada ANTES do sistema único. Serve de guia para D4-D10.

## Cotas temporárias da esquadria (alvo da substituição)
| Peça | Arquivo | O que faz hoje | Destino |
|---|---|---|---|
| `perpendicularNeighbors`, `freeSpans`, `overlapsPerpendicular` | `packages/tools/src/openingPlacement.ts` | vizinhas perpendiculares com `axisT/faceLo/faceHi` em `t` da hospedeira | D3 generaliza em `dims/refs.ts` (`hostTargets`); as funções de vão livre seguem usadas por `openingTool.ts` |
| `dimensionRefs`, `temporaryDimensions`, `TemporaryDimension`, `formatMeters` | idem | vocabulário `axis`/`face`; cotas da prévia como itens `line`+`label` | removidos em D4 (provedor `opening`) |
| `openingDimLines`, `editOpeningDim` | `packages/tools/src/openingDims.ts` (+ teste) | cotas da esquadria selecionada e validação da edição (pontas, perpendiculares, outras aberturas) | regra migra para `providers/opening.ts`; arquivo apagado em D4 |
| prévia de colocação | `packages/tools/src/openingTool.ts` (`drawPreview`) | usa `temporaryDimensions` + `options.openingDimMode` | passa a expor `tempDims()` (D4/D5) |
| overlay editável | `apps/web/src/ui/OpeningTempDims.tsx` | campos HTML sobre a seleção; `parseNumber`; `editOpeningDim` | substituído por `ui/dims/TempDimsOverlay.tsx` (D5) |
| montagem | `apps/web/src/ui/ViewportOverlays.tsx` | monta `OpeningTempDims` | ajustado em D5 |
| seletor "Cotas" | `apps/web/src/ui/PlacementProperties.tsx` | select `openingDimMode` | dois selects de sessão (D9) |
| opção | `packages/tools/src/types.ts` (`openingDimMode`) e `apps/web/src/editor/state.ts` (padrão `'axis'`) | | removida em D9 |

## Outros pontos
- `packages/engine/src/autoCotas.ts`: vocabulário próprio `ReferenciaParede 'externa'|'nucleo'|'eixo'` (`facesS` devolve as DUAS faces: externa = `sExt/sInt`, núcleo = faces do núcleo, eixo = `[0,0]`) e `modoAberturas 'centro'|'arestas'` (arestas = `offset ± tipo.width/2`, ou seja, a largura do tipo = "vão externo"). Mapeamento: externa->`finish`, nucleo->`coreFace`, eixo->`axis`; centro->`center`, arestas->`frame`.
- `packages/model/src/dimension.ts`: `dimensionGeometry(a, b, offset, mPerMm)` já devolve linha, chamadas, tracinhos, `textAt` e rotação: reaproveitar no overlay.
- Cota permanente: comando `addDimension` (ver `dimensionTool.ts`); `DimensionRef` guarda `wallId/end/axis`.
- Edição de comprimento: `lengthEdit.ts`; alças: `selectGrips.ts`, `openingGrips.ts`; contornos: `outlineEdit.ts`; ferramentas desenhadoras: `wallTool`, `detailLineTool`, `gridTool`, `perimeterTool`, `transformTools`, `floorTool/slabTool/roofTool/ceilingTool` (D10, ESQ).
- `packages/tools/src/base.ts`: classe `ToolBase`; método opcional `tempDims` entra em D5.
- Função pura que aplica comando a cópia do projeto: `applyCommand(p, c)` em `packages/model/src/commands.ts`; `setSettings` faz mesclagem RASA de `settings` (um `dimensions` novo substitui o antigo inteiro).
- Não há `dimOverrides` nem registro de provedores: tudo é novo.
