# A2 — planta de área no motor único

Branch: `feat/planta-area-a2` (a partir da A1 `fix/planta-area-sobreposicao-compartilhada`, com a F0 `fix/planta-area-somente-leitura` integrada)
Data: 2026-10-30

## O que mudou

| Arquivo | Mudança |
|---|---|
| `packages/render/src/plan/build.ts` | Removido o desvio `if (input.areaPlan) return buildAreaPlanGeometry(...)`. `buildPlanGeometry` passou a usar `PlanProfile`; a planta de área entra no mesmo caminho, com paredes claras, ambientes/etiquetas/legenda/quadro e anotações da vista. `buildAreaPlanGeometry` foi apagada. |
| `packages/render/src/plan/types.ts` | `PlanProfile` ganhou `stairs`, `ramps`, `roofs` (`full`/`projection`/`hidden`), `elementTags`, `generic` e `ceilings`. `FLOOR_PLAN_PROFILE` e `areaPlanProfile` atualizados. |
| `packages/model/src/areaPlan.ts` | `AreaPlanGraphics` ganhou `showStairs?`, `showRoofs?` e `showGeneric?`, com padrões (escada/telhado ligados, importados desligados). |
| `packages/render/src/plan/roofs.ts` | `RoofOpsOptions.projectionOnly`: a área desenha só a projeção dos telhados, nunca a água cheia. |
| `packages/render/src/plan/style.ts`, `planContext.ts` | `planStyleOf` aceita a escala da vista de área; os pesos de papel da área usam `plan.scale`. |
| `packages/render/src/plan/planFrame.ts` | O subpavimento da área usa `graphics.showBelowLevel` (não a opção global). |
| `apps/web/src/editor/dxfExport.ts` | DXF da área refeito: modelo nas camadas da planta (`PAREDE`, `ABERTURA`, `ESCADA`, `PISO`, `LAJE`, `TELHADO_PROJECAO`…) + entidades da área em `AMBIENTES_*`, no mesmo R12. |
| `packages/io/src/dxf.ts` | `DxfLevelGeometry.extraLayers` declara camadas acrescentadas fora do exportador (as de área). |
| `apps/web/src/ui/AreaPlanProperties.tsx` | Opções “Mostrar escadas e rampas”, “Mostrar telhados (projeção)” e “Mostrar objetos importados”; removido o botão “Criar prancha geral”. |
| `apps/web/src/ui/browser/Views.tsx` | Removida a opção “Criar prancha geral” do menu das plantas de área. |
| `apps/web/src/editor/areaPlanActions.ts` | Removida `createGeneralAreaSheetAction`; a prancha geral segue o fluxo normal (criar prancha e arrastar a vista). |
| `apps/web/src/editor/controller.ts` | `AREA_PLAN_TOOLS` agora inclui `room` e `roomsep`: dá para criar ambiente/área e separador na planta de área. |
| `apps/web/src/editor/areaMerge.ts`, `areaMergePrompt.ts`, `ui/dialogs/AreaMergeDialog.tsx` | Regra de fusão de áreas com aviso de confirmação; mantém a maior e apaga as menores junto com a parede/separador. |
| `packages/tools/src/infer.ts`, `apps/web/src/editor/state.ts`, `ui/OrthoButton.tsx`, `ui/StatusBar.tsx` | Modo ortogonal global com F8, ícone na barra de status e projeção estrita em 0°/90°. |
| `apps/web/src/ui/ribbon/tabsMain.ts`, `packages/tools/src/registry.ts` | “Separador de ambiente/área” e remoção dos botões “Área”/“Limite de área” que estavam “em breve”. |
| Testes | `areaPlanGeometry.test.ts` (novo), `areaPlanDxf.test.ts` ampliado, `areaPlanOverlay.test.ts`/`areaPlanSelect.test.ts` com a regra somente leitura. |

A F0 foi integrada junto: na planta de área, `select` não move elemento de modelo, não há alças de modelo, e continuam clique, janela, hover, destaque, fantasmas, anotações e rótulo do ambiente. Na planta de piso, mover e alças seguem iguais.

## Comportamento da área agora

- Paredes claras, mas sujeitas às sobrescritas da categoria (cor, transparência, meio-tom, arame, pesos).
- Portas/janelas com o estado do intervalo de vista e a categoria oculta.
- Escadas e rampas do nível (e do subpavimento quando ligado).
- Telhados só em projeção; `showRoofs` desliga.
- Pisos/lajes sob `showFloors`; subpavimento sob `showBelowLevel`, incluindo escada/rampa/telhado do nível de baixo.
- Grades, marcas de corte e anotações da vista (`plan.annotations`) com fallback para as do nível.
- Ambientes com diagonais, etiqueta configurável, esquema de cor, legenda e quadro, por cima do modelo.
- Ferramentas de área habilitadas: **Ambiente** (`room`) cria novas áreas e **Separador de ambiente/área** (`roomsep`) fecha/divide circuitos, inclusive na planta de área.
- **Delete** na planta de área apaga ambiente (área), separador de ambiente/área e anotações da vista; paredes e demais elementos de modelo continuam bloqueados.
- **Regra de fusão de áreas:** ao apagar uma parede ou separador no fluxo normal, o app simula a remoção. Se dois ou mais ambientes caírem no mesmo circuito, abre um aviso; confirmar apaga a parede/separador e os ambientes menores na mesma transação, mantendo o de maior área; cancelar não altera nada.
- **Modo ortogonal global (F8):** o botão da barra de status alterna o modo; enquanto ligado, todo ponto de desenho que passa pelo `infer` fica restrito à projeção em 0°/90°. Shift continua como override momentâneo quando o modo está desligado.
- Seleção/hover/caixa/fantasmas iguais aos da planta de piso; sem alças de modelo.

## DXF

Antes, `opsToDxf` mandava **todo** traço para `AMBIENTES` por heurística de cor; com o modelo na geometria isso colocaria paredes/escadas na camada errada. Agora:

1. o modelo sai de `dxfGeometryOf`/`exportDxf`, nas camadas da planta, filtrado por `showWalls/showOpenings/showFloors/showStairs/showRoofs`;
2. as entidades próprias da área (ambientes, referência, chamada, textos, legenda e quadro) são geradas por um segundo `buildPlanGeometry` com perfil que desliga o modelo e acrescentadas às camadas `AMBIENTES_*`;
3. `extraLayers` declara essas camadas na tabela LAYER;
4. continua R12/AC1009, sem 370 e sem BLOCKS ausente.

## Verificação

- `areaPlanGeometry.test.ts`: 7 testes.
- `areaPlanDxf.test.ts`: 4 testes; `dxfCad.test.ts`: 9 testes (R12 nos templates).
- `areaPlanOverlay.test.ts`: 9; `areaPlanSelect.test.ts`: 9; `areaPlan.test.ts`: 19; `planFrame.test.ts`: 21; `areaPlanSheet.test.ts`: 3; `areaPlanAnotacao.test.ts`: 8 (ambiente/separador na área); `areaPlanDelete.test.ts`: 4; `areaMerge.test.ts`: 3; `areaMergeDelete.test.ts`: 2; `orthoLock.test.ts`: 4; `ortho.test.ts`: 1.
- `ouroZoom.test.ts`: 88 testes, **sem diff de hash** — a planta de piso não mudou.
- `npx tsc --noEmit`: limpo.
- `npx eslint packages apps/web/src`: 0 erros; 1 warning pré-existente em `OpeningFlipGrips.tsx:70`.
- Suíte completa: **696 arquivos, 7.881 testes, todos passando** (341,37 s), incluindo `ouroZoom.test.ts` (88).

## Limitações conhecidas

- O DXF da área usa a escala dos gráficos do **nível** para os pesos de linha do modelo (`dxfGeometryOf`); a tela da área usa `plan.scale`. Os pesos do DXF ainda não seguem a escala da vista de área.
- `showSectionMarks` e anotações da área no DXF caem nas camadas `AMBIENTES*` (não há camada de anotação por vista no DXF da área); a tela está correta.
- Objetos importados (`showGeneric`) aparecem na tela, mas não no DXF da área.
- A projeção de telhado no DXF usa a pegada (`roofProjections`), sem as linhas internas de cumeeira/espigão da tela.
- A regra de fusão usa a área **antes** da remoção; empate de áreas mantém o ambiente criado primeiro (ordem do nível). Se a remoção abrir o circuito em vez de fundir, não há esse aviso.
- Com F8 ligado, o `infer` ignora endpoint/alinhamento/grade concorrentes; Shift continua forçando ortogonal quando o modo está desligado.
- O `roofProjection` antigo do `PlanProfile` continua existindo por compatibilidade, mas a área usa `roofs: 'projection'`.

## O que falta

Nada bloqueante da A2. Ficam como follow-ups: pesos do DXF na escala da área, camada de anotação por vista no DXF e projeção de telhado com as linhas internas. A inspeção visual final (área x piso) e a integração na main são do dono.
