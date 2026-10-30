# Correção A1 — sobreposição compartilhada na planta de área

Branch: `fix/planta-area-sobreposicao-compartilhada` (a partir de `origin/main` @ `97c9a838`)
Data: 2026-10-30
Escopo: A1 do diagnóstico `DIAGNOSTICO-planta-area.md` (commit `62478401` em `origin/diag/planta-area`).

## O que mudou

| Arquivo | Mudança |
|---|---|
| `packages/render/src/plan/planFrame.ts` | A planta de área deixou de ter ramo próprio: `overlay`, `hover` e `live` chamam **sempre** `buildPlanScreenOverlay`, `buildPlanHoverOverlay` e `buildPlanLiveOverlay`, como a planta de piso. Saíram `juntarOps`, `destaqueAnotacoes` e o import de `labelGhostOps`; o fantasma do rótulo continua porque `buildPlanLiveOverlay` já o desenha. |
| `packages/render/src/plan/areaPlan.ts` | Removida `areaPlanHighlightOps` (só percorria ambientes e era a causa do 0/0 na parede). O resto da planta de área (diagonais, etiqueta, legenda, quadro, fantasma do rótulo) ficou intacto. |
| `packages/render/src/index.ts` | Removida a exportação pública de `areaPlanHighlightOps`. |
| `packages/render/src/plan/areaPlan.test.ts` | O teste do destaque do ambiente passou a usar `buildPlanSelectionOverlay(entrada(..., plan(), ['r1']))`, o caminho novo. |
| `packages/render/src/plan/areaPlanOverlay.test.ts` | **Novo**: cobre parede selecionada, hover, caixa de seleção, ambiente sem duplicação, fantasma do rótulo, caminho `planFrame` e alças. |
| `packages/tools/src/areaPlanSelect.test.ts` | **Novo**: documenta/testa o que o `select` permite hoje na planta de área (move o elemento selecionado e a janela continua selecionando). |

Nenhuma mudança em `buildPlanGeometry`, `buildAreaPlanGeometry`, `ouroZoom.json`, DXF ou geometria. A1 é só sobreposição/camada viva.

## Regra de alças escolhida (e por quê)

**A planta de área bloqueia as FERRAMENTAS de modelo (`AREA_PLAN_TOOLS`), mas o `select` continua movendo o que está selecionado.** Foi verificado em teste (`packages/tools/src/areaPlanSelect.test.ts`): arrastar uma parede selecionada na planta de área move `a` e `b`; arrastar no vazio continua sendo janela de seleção.

Como o transform pelo `select` é permitido na vista, o feedback acompanha o que o select faz de fato: **destaque, alças e fantasmas de mover são os mesmos da planta de piso**. Se o produto decidir que a planta de área deve ser 100% somente leitura, a tarefa seguinte é bloquear o arrasto de modelo no `select` e, junto, suprimir as alças/fantasmas de modelo (hoje o comentário em `planFrame.ts` aponta esse ponto). Não fizemos essa mudança de comportamento no A1 para não misturar correção de desenho com mudança de ferramenta.

O comentário no código (`planFrame.ts`, bloco de `overlay`/`hover`/`live`) registra a regra e o caminho para revertê-la.

## Evidência antes/depois

Projeto de teste: 4 paredes em laço (4 × 5 m) + ambiente `r1`; `PlanInput` com `areaPlan` e `selection`, o mesmo formato de `areaPlan.test.ts`. Contagens de `PlanOps`:

| Cenário | Antes (diagnóstico) | Depois (A1) |
|---|---|---|
| Parede `w0` selecionada — plano de área | 0 fills / 0 strokes | **11 fills / 11 strokes** (igual à planta de piso) |
| Parede `w0` selecionada — planta de piso | 11 / 11 | 11 / 11 |
| Hover de parede — área | 0 fills | **1 fill** (α 0,16) |
| Caixa de seleção em arraste — área | 0 fills / 0 strokes | **1 fill + 1 stroke tracejado [7, 5]** |
| Ambiente `r1` selecionado — área | 1 fill / 1 stroke | **1 fill / 1 stroke** (sem duplicar; α 0,22) |
| Rótulo em arraste — área | funcionava | **continua** (`Sala` + chamada) |
| Caminho do app (`planFrameUpdateOf`) — parede selecionada | 0 / 0 | **igual à planta de piso** |

Os 11 preenchimentos da parede são 1 destaque + 10 alças (2 pontas + 8 cantos); os 11 traços são 1 contorno de 2 px + 10 alças. O teste novo confere a igualdade de contagens com a planta de piso e a presença do preenchimento α 0,26 e do contorno de 2 px.

## Desempenho

Teste temporário com 50 paredes + 50 ambientes, 200 iterações após aquecimento (apagado ao final):

| Camada | Antes | Depois |
|---|---|---|
| Hover | 90,3 ms / 200 | **27,2 ms / 200** |
| Overlay | 68,1 ms / 200 | **45,7 ms / 200** |
| Live (movimento do mouse) | ~0 ms (retornava `EMPTY` sem ghost) | **3,6 ms / 200 ≈ 0,018 ms/chamada** |

O caminho compartilhado ficou na mesma ordem de grandeza e, na medição, mais rápido no hover/overlay. A camada viva acrescenta ~0,02 ms por movimento, muito abaixo do orçamento de quadro.

## Verificação

- `npx vitest run packages apps/web tests --testTimeout=120000` — **690 arquivos, 7.850 testes, todos passando** (209,89 s), incluindo `areaPlan.test.ts` (19), `areaPlanOverlay.test.ts` (7), `planFrame.test.ts` (21), `areaPlanSelect.test.ts` (2) e `ouroZoom.test.ts` (88).
- `npx tsc --noEmit` — limpo.
- `npx eslint packages apps/web/src` — **0 erros**; 1 warning pré-existente em `apps/web/src/ui/OpeningFlipGrips.tsx:70` (`react-hooks/exhaustive-deps`), o mesmo que já aparece em `origin/main`.
- `packages/render/src/plan/ouroZoom.json` — **sem alteração** (`git diff` vazio).

## Limitações conhecidas (A1)

- **Escada, rampa e telhado** passam a ter destaque/hover na sobreposição, mas a geometria da área ainda não os desenha; o destaque aparece sem desenho embaixo. É o esperado até a A2.
- A geometria da planta de área continua no caminho próprio (`buildAreaPlanGeometry`): contornos fora do corte, aberturas por classe de vista, hachura/camadas de parede, sobrescritas de cor/arame/detalhe, etiquetas de elemento, telhados e nível de baixo completo seguem diferentes da planta de piso.
- A planta de área continua bloqueando as ferramentas de modelo; o `select` ainda move elementos (regra acima).
- `areaPlanHighlightOps` deixou de existir; referências históricas em `docs/areas/subagentes/*` continuam citando o nome antigo e não foram reescritas (documentos de pesquisa, não código).

## O que falta para a A2

1. Remover o desvio `if (input.areaPlan) return buildAreaPlanGeometry(...)` em `packages/render/src/plan/build.ts:205`.
2. Fazer `buildPlanGeometry` consumir o `PlanProfile` da área (paredes claras/normais/ocultas, aberturas, pisos, escadas/rampas, telhados, anotações, legendas/quadro) sem duplicar o motor.
3. Levar ao caminho normal o que hoje só a planta de piso tem: `wallOutlineOps`, `openingViewOps` com `view.cls`/`hidden`, `stairFills`/`rampFills` (e equivalentes de baixo), `roofFills`, `elementTagOps`, hachura/regiões de parede, sobrescritas gráficas e nível de detalhe.
4. Revisar o DXF da área e regravar `ouroZoom.json`/snapshots visuais após a unificação.
5. Decidir produto: manter o `select` movendo na área (e as alças) ou tornar a vista somente leitura (bloquear arrasto e suprimir alças/fantasmas de modelo).
