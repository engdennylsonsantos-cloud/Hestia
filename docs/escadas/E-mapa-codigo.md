# Mapa do código do elemento Escada

Repositório: `/home/user/Hestia`, branch `claude/zealous-hamilton-iayjlf`, HEAD `4ef3723` (chegada pela face inferior, `stairArrivalTopZ`). Atualizado em 2026-10-21. Esta versão substitui
a leitura de HEAD `5d8194e`, em que a escada ainda não existia. Convenção de evidência: `arquivo:função`; quando dou a linha, é a
linha atual.

Nota de estado: este mapa descreve o código no dia da revisão (HEAD acima, árvore limpa de código). Se algo aqui divergir do código,
o código vale e este arquivo deve ser corrigido.

---

## 0. Estado atual e pendências

**Pronto e testado:** modelo (`Stair`, `StairType`, `StairRun`, `StairLanding`, migrações até a 15); croqui com limites, espelhos,
caminhada e patamar, retas e arcos; geradores reto, L, U e com leque; motor (degraus, espelhos, patamar, corpo monolítico com face
lisa ou escalonada, chegada, furo derivado por elemento, quantitativos, tabela e CSV, corte); 3D; planta; DXF; ferramentas Escada
(croqui) e Escada por lance (`stairrun`); painel de propriedades; editor de tipo; avisos com "Ir para".

**Paridade:** `docs/paridade/escadas.md` está em 98% (um item pendente, C8, sem bloqueante). `node scripts/check-parity.mjs` passa.
Telhados está concluído (100%), então o bloqueio A5 citado na leitura anterior já não existe.

**Pendências registradas no código e nos docs:**
1. **Norma do piso do leque** (decisão 0011 §1 item 10) não implementada: o leque não tem aviso de piso (C8).
2. **Perfil de norma fixo:** `DEFAULT_STAIR_NORMS` (`engine/stairNorms.ts`) é constante do motor. `Project.settings` não tem campos de
   norma, então o perfil não é editável no projeto (decisão 0011 §1 item 10).
3. **Aviso `stair-tread-min`** (decisão 0011 §3) não é emitido por nenhum código. O gerador já aplica o piso mínimo (`treadFor`).
4. **DXF e preferência da cobertura:** o DXF põe a projeção dos telhados fora do intervalo sempre, sem ler `hestia.roofProjection`
   (decisão 0013 §4).
5. **Laje e piso, consumidores de `holes` cru:** o furo da escada é derivado e aparece na geometria resolvida (`resolveSlabs`,
   `resolveFloors`, DXF, pick pelo interior e quantitativos). Ainda leem só `holes` gravados: a contagem "Furos" de `SlabProperties`
   (`apps/web/src/ui/SlabProperties.tsx`), o pick pela borda do contorno (`packages/tools/src/slabPick.ts`, `onBoundary`) e a validação
   de sobreposição (`packages/model/src/validateSlabs.ts`, `slabPolygon`).
6. **Quantitativo sem chegada:** o volume monolítico não inclui a chegada, que fica sob a laje de cima (`stairQuantities.ts`). Ela entra
   na malha 3D e no corte.
7. **G6 (regressão visual):** `npm run test:visual` não foi rodado nesta revisão. Depende de `npm run build` e de Chromium em
   `/opt/pw-browsers`. As baselines em `tests/e2e/baseline/` podem estar defasadas pelas mudanças do monolítico (decisão 0012).

---

## 1. Modelo (`packages/model`)

### 1.1 Tipos e campos
- `Stair` (`types.ts`, criado por `makeStair` em `stair.ts`): `id`, `kind: 'stair'`, `levelId`, `typeId`, `topLevelId` (null = nível
  imediatamente acima), `baseOffset`, `topOffset`, `height` (usado sem nível acima), `components: Array<StairRun | StairLanding>`,
  `openingMode` (`headroom` | `full` | `none`), `openingHeadroom`, `openingMargin` (0,05 m), `openingRect`, `mark`, `comments`, `order`.
- `StairRun`: `boundaryLeft`, `boundaryRight` (cadeias de `StairCurve`), `risers`, `path` (caminhada opcional), `generatedBy?`
  (`straight` | `lshape` | `ushape` | `winder`). `StairLanding`: `boundary` (laço fechado).
- `StairType` (`stairTypes.ts`): `code`, `maxRiser`, `minTread`, `minRunWidth`, `runStyle` (`monolithic` | `assembled`),
  `undersideStyle` (`smooth` | `stepped`, só monolítico, decisão 0012), `structuralDepth`, `treadThickness`, `riserThickness`, `nosing`,
  `landingThickness`, `minHeadroom`, `materialId`, `cost`.
- `DEFAULT_STAIR_TYPES` (`stair.ts`): monolítico concreto (profundidade estrutural 0,20 m) e piso e espelho (piso 0,03 m, espelho 0,02 m).
  Valores comuns: espelho máximo 0,18 m, piso mínimo 0,28 m, largura mínima 0,80 m, nariz 0,015 m, patamar 0,15 m, folga 2,10 m.
- `DEFAULT_STAIR_OPENING_MARGIN` = 0,05 m (`stair.ts`).
- Transformações: `stairTransform.ts` (mover, girar, espelhar, copiar).

### 1.2 Validação do modelo
`validateStairs.ts`: `stair-level-missing`, `stair-top-level-missing`, `stair-top-not-above` (topo até 1 mm acima da base) e
`stair-type-missing`. Entra em `validateProject` (`validate.ts`). `STAIR_MIN_HEIGHT` = 0,001 m. Códigos de croqui e de norma estão no
motor (§3.1 e §3.4).

### 1.3 Comandos, histórico e níveis
- `commands.ts`: `addStair`, `upsertStairType`, `deleteStairType` (bloqueado se em uso, e o projeto precisa de um tipo),
  `setElementLevel` (via `applyElementLevel`), `deleteLevel`. A guarda de `deleteLevel` bloqueia nível usado por escada (como `levelId`
  ou como `topLevelId` explícito) com "Nível em uso".
- `history.ts` (`labelOf`): rótulos de `addStair`, `upsertStairType` e `deleteStairType`.
- `elementLevel.ts`: `hasLevel` inclui `Stair`. Ao trocar de nível com `keep: 'elevation'`, a escada compensa `baseOffset`.
- `queries.ts`: `levelAbove` (linha 74), `stairsOnLevel`, `stairBaseZ`, `stairTopZ`, `stairTopLevel`.

### 1.4 Migrações e `SCHEMA_VERSION`
`SCHEMA_VERSION` = 15 (`types.ts`). Migrações de escada em `migrate.ts`:

| Chave | Migração | Teste |
|---|---|---|
| 11 | 11 → 12: tipos padrão de escada (`stairTypes`) | `esquema.test.ts`, "migração 11 → 12 (escadas)" |
| 12 | 12 → 13: `undersideStyle: 'smooth'` nos tipos existentes | `esquema.test.ts`, "migração 12 → 13" |
| 13 | 13 → 14: `openSlab` vira `openingMode` (ligado = `headroom`, desligado = `none`) | `esquema.test.ts`, "migração 13 → 14" |
| 14 | 14 → 15: `viewRange` por nível (decisão 0013) | `viewRange.test.ts` |

---

## 2. Croqui e ferramentas (`packages/tools`, `apps/web`)

### 2.1 Registro e Ribbon
- `registry.ts`: `ToolId` tem `stair` (croqui) e `stairrun` (lance por cliques). `createTool` as instancia.
- Ribbon (`apps/web/src/ui/Ribbon.tsx`): grupo "Construir" com `stair` e `stairrun`. O botão "Editar croqui" (`stair`) fica
  ativo com uma escada selecionada. "Tabela de escadas" abre `stairSchedule`. A faixa Vista › Planta tem "Mostrar projeção da cobertura".
- Ícones (`Icon.tsx`): chaves `stair` e `stairrun`.

### 2.2 Croqui (`stairTool.ts`, `stairDraw.ts`, `stairSketchState.ts`)
- `STAIR_SUBMODES` (`stairSketchState.ts`): `limites`, `espelhos`, `caminhada`, `patamar`, `concluir`.
- `StairTool` (`stairTool.ts`): desenho, Enter, Delete e Ctrl+Z; a análise roda a cada mudança (`analyzeDraft`). Concluir grava uma
  escada nova ou atualiza a existente, e só se não houver erro de croqui. Ativar com uma escada selecionada entra em edição.
- `stairSketchState.ts`: `analyzeDraft` (valida com `validateRunSketch`), `counterText` ("Espelhos: N criados, M restantes", ou
  "M a mais"), `partsFromComponents`, `stairLimits`.
- `stairStroke.ts`: traçado em curso (linha ou arco; Tab alterna). `stairView.ts` e `stairPreview.ts`: prévia e destaques.
- `stairCommands.ts`: grava o croqui (`stairFromGenerator`, criação e atualização).

### 2.3 Lance por cliques (`stairRunTool.ts`, `stairRunPlan.ts`)
Formas `STAIR_RUN_SHAPES` = reta, L, U e `winder` (rótulo "Com leque"). `stairRunPlan.ts` monta os componentes (`fromSketches`
marca `generatedBy`). `StairRunOptionsBar.tsx` é a barra da ferramenta.

### 2.4 Pegar linhas (A8)
- `stairPickLines.ts`: `pickLinesOf` (paredes pelo eixo, faces ou núcleo; linhas de outras escadas, sem a que está em edição; arestas
  de laje e piso), `chainAt` (corrente de curvas do mesmo grupo), `offsetChain` e `offsetCurve` (Deslocamento), `nearestPickLine`,
  `leftSide`. Constantes `PICK_PX` e `JOIN_TOL`.
- `StairOptionsBar.tsx`: botão "Pegar linhas" na barra de método (com Linha e Arco), botão "Corrente" e campo "Deslocamento (m)".
- `controller.ts`: Ctrl+Z e Ctrl+Y chamam `undoPick` e `redoPick` do croqui quando a última ação foi uma pegada.
- Decisão e teste: `docs/decisoes/0011-escadas.md` §7; `stairPickLines.test.ts`, `stairPickTool.test.ts`.

### 2.5 Alças e seleção
- `stairGrips.ts`: `stairGripAt`, `applyStairGrip` (alças de limites, espelhos, caminhada e contorno do patamar; `StairChainKey`).
- `stairPick.ts`: `pickStairAt`, `stairIdsInBox`, `stairSnapPoints`, `stairEndpoints`, `selectedStairs`.
- `selectionFilters.ts` e `selectTool.ts` tratam escadas na seleção. `selectTool.ts` passa no ESLint (`max-lines` 420) hoje.

### 2.6 Barra de opções
`ToolOptions` tem campos opcionais da escada (`typeId`, `topLevelId`, `pickChain`, `pickOffset`, `distributeCount`), para não quebrar
`testEnv.ts`. `apps/web/src/ui/OptionsBar.tsx` delega a `StairOptionsBar.tsx` (croqui) e `StairRunOptionsBar.tsx` (lance).

---

## 3. Motor (`packages/engine`)

### 3.1 Croqui: geometria e validação
- `stairSketchGeom.ts`: tipos `StairCurve`, `StairRunSketch`, `StairLandingSketch`, `StairSketchIssue`; `STAIR_SKETCH_MESSAGES`
  (mensagens em pt-BR); `sampleChain`, `prepareRun`, `midlinePoly` (linha média entre os limites, sem orientação), `orderBy`,
  `ascentWalk` (linha média orientada para a subida).
- `stairSketchValidate.ts`: `validateRunSketch` e as regras de cruzamento, sobreposição e caminhada.
- `stairSketch.ts`: `stairRunSteps` (degraus e espelhos aparados, decisão 0011 §4), `distributeRisers` (acelerador A9), `autoPath`,
  `orderRisers`, `trimRisers`, `stairLandingPolygon`.

### 3.2 Resolução da escada
`stairs.ts`: `resolveStairs`, `resolveStairsOnLevel`, `ResolvedStair`. Regras:
- `riserCount` (N) = linhas de espelho distintas de todos os lances. Uma emenda entre lances consecutivos sem patamar conta uma vez
  (`sharesRiser`, tolerância 1 mm).
- `h = H ÷ N`, com `H` = topo − base; `h = 0` se `H` ≤ 1 mm (sem geometria).
- Degraus: `treadNumber` da planta usa `round((z − baseZ) ÷ h)` (§5).
- Patamar: cota = base + número do último espelho anterior × h.

### 3.3 Geradores
`stairGenerators.ts`: `riserCountFor`, `treadFor` (piso = clamp(0,63 − 2h; mínimo; 0,32)), `generateStraightRun`, `generateLShape`,
`generateUShape`, `generateFanRun` (recusa varredura ≥ 360°), `generateWinderL` (L com leque de 90°).

### 3.4 Avisos de norma e de tipo
- `stairNorms.ts`: `StairNorms` e `DEFAULT_STAIR_NORMS` (espelho 0,16–0,18; piso médio 0,28–0,32; 2e+p 0,63–0,64; patamar a cada 3,20 m;
  patamar com 1,20 m de menor dimensão).
- `stairIssues.ts`: `riserChecks` (`stair-risers-count`, `stair-riser-too-high` [erro], `stair-riser-range`), `runChecks`
  (`stair-width-min`, `stair-uneven`, `stair-tread-range`, `stair-blondel`, `stair-landing-rise`), `landingChecks`
  (`stair-landing-length`), `stairNormIssues`.
- `stairChecks.ts`: `stair-headroom` (folga de cabeça sob as lajes do nível de topo), `stairIssueList`, `stairValidationIssues`.

### 3.5 Corpo da escada (monolítico e chegada)
- `stairBody.ts`: `stairBody(stair, { slabThickness?, arrivalTopZ? })` devolve `StairBodyPiece` (`kind` `tread` | `landing` | `arrival`,
  `polygon`, `zTop`, `bottom: {a, b, c}`). Funções: `monolithicPieces`, `treadOf` (T = profundidade ÷ cosθ), `fit` (corte pelo piso
  base), `stairArrivalFrame` (frente da chegada), `pieceVolume`, `pieceBottomZ`. Piso e espelho usa `assembledPieces` (sem chegada).
  Constantes: `STAIR_ARRIVAL_MAX_LENGTH` = 0,30 m; `STAIR_ARRIVAL_SLAB_DEFAULT` = 0,15 m.
- `stairBodyGeom.ts`: `clipByLevel` (corta o anel por um semiplano de cota), `ringMoments` (área e centróide), `BottomPlane`.
- `stairArrival.ts`: `stairArrivalTopZ(p, s)` = menor face inferior das lajes e pisos do nível de topo que cobrem a faixa de 2 cm à
  frente do último espelho (laje inclinada: `coverUnderside`); null sem cobertura. Exportado pelo `index.ts`.
- Decisão e critérios: `docs/decisoes/0012-escada-monolitica.md` (§2 geometria, §5 estado final).

### 3.6 Furo derivado na laje e no piso
`stairOpenings.ts`: `stairOpeningsOnLevel`, `stairOpeningRegion`, `stairHoleRegion`, `stairHolesFor` (região por face inferior de
cada elemento), `cutStairOpenings`, `coverUnderside`. `slabs.ts` (`resolveSlabs`) e `floors.ts` (`resolveFloors`) aplicam o furo.
Regras e testes em `docs/decisoes/0011-escadas.md` §6 e `stairOpenings.test.ts`.

### 3.7 Quantitativos e tabela
- `stairQuantities.ts`: `stairQuantities(s)` (contagens, larguras, áreas, volumes). Monolítico: volume de degraus e de patamares a partir
  de `stairBody` (sem a chegada). Piso e espelho: área × espessuras do tipo.
- `stairSchedule.ts`: `buildStairSchedule`, `filterStairRows`, `sumStairRows` e `stairScheduleToCsv` (separador `;`, decimal com vírgula,
  BOM UTF-8, via `csv.ts`).
- Testes de referência: `stairQuantities.test.ts` (volume 1,5763 m³ da reta de referência), `stairSchedule.test.ts` (linha e CSV).

### 3.8 Corte, vista e avisos da vista
- `sectionStairs.ts`: `sectionOfStairs` (peças do monolítico com `arrivalTopZ`; piso e espelho por degrau). `section.ts` põe `stairId`
  em `SectionBeyond` e chama `sectionOfStairs` (linha 176).
- `viewClass.ts`: `elementZRange` (escada = base a topo), `classifyLevelEntries`; piso, laje e escada estendem para baixo (decisão 0013).
- `viewWarnings.ts`: `viewRangeWarnings` (avisos por categoria, incluindo "escada").
- `planWallCuts.ts`: `openingsCrossingCut` (aberturas que furam a parede na planta).

---

## 4. Geometria 3D (`packages/render/src/model3d`)

- `stairSolids.ts`: `buildStairSolids(stairs, arrivalTopOf?)`. Por material do tipo:
  - monolítico: `monolithicBodies(stairBody(s, { arrivalTopZ }).pieces)` → `extrudeBodies`;
  - piso e espelho: `assembledBodies` (degrau de `z − treadThickness` a `z`; espelho de `riserThickness` atrás da linha, de `z0` a `z1`,
    via `riserSlab`; patamar com `landingThickness`).
  - `extrudeBodies`: a parede de cada aresta sai só onde a face está exposta (`exposedSpans`); arestas que dois corpos dividem em sentidos
    opostos não geram parede, então se cancelam no volume.
  - `splitTJunctions`: insere nos triângulos os vértices de outras faces que caem sobre uma aresta (T-junction), sem mudar a superfície.
  - Escada com erro, sem degraus ou sem altura não gera malha.
- `scene3d.ts` (`ModelScene.update`): passa `stairs` do nível e `stairArrivalTopZ` ao `buildStairSolids`.
- `solids.ts`: `extrudeCaps`, `pushWall`, `SolidBatch` (base do prisma; a escada não tem função própria de prisma).
- `stairRisers.ts` (render): `riserPoints`, `risersInClimbOrder` (espelhos na ordem de subida, para a planta e o 3D).
- Testes: `stairSolids.test.ts` (volume da malha = soma das peças; estanqueidade; arestas reais; piso e espelho).

---

## 5. Planta 2D (`packages/render/src/plan`)

- `stairs.ts`:
  - `treadNumber(s, st)`: rótulo do degrau (decisão 0011 §7).
  - `stairCut(s, risers, zoom, cutZ)` e `cutSymbol`: símbolo de corte no plano `cutZ` (`STAIR_CUT_HEIGHT` = 1,20 m sem vista).
  - `climbWalk` e `climbArrow`: seta "SOBE" pela caminhada explícita, ou pelos pontos médios dos espelhos.
  - `stairFills(p, stairs, theme, dark, detail, v, view?)`: preenchimento dos degraus e patamares pela cor do material; contornos
    tracejados acima da cota de corte; espelhos; no fino, número de cada degrau; no grosseiro, só o preenchimento da pegada.
  - `belowStairOps` (escada do nível de baixo, apagada) e `stairSelectionOps` (destaque).
- `view.ts`: `planViewOf(p, levelId)` (`PlanView`: intervalo, cota de corte, topo, classes, ocultos, contornos) e `hiddenSelectionOps`
  (contorno fantasma de oculto selecionado; decisão 0013 §5).
- `build.ts` (`buildPlanDrawList`): chama `belowStairOps`, `stairFills` e `stairSelectionOps` na ordem da planta.
- Testes: `stairs.test.ts`, `stairsArrow.test.ts` (seta de subida), `stairsBuild.test.ts` (numeração e volume da malha), `viewRange.test.ts`.

---

## 6. DXF (`packages/io/src/dxf.ts`, `apps/web/src/editor/dxfExport.ts`)

### 6.1 Camadas de escada
| Constante | Camada | Conteúdo |
|---|---|---|
| `DXF_LAYER_STAIR` | `ESCADA` | contorno dos degraus e patamares até a cota de corte (POLYLINE fechada) |
| `DXF_LAYER_STAIR_ABOVE` | `ESCADA_ACIMA` | contorno dos degraus acima da cota de corte e até o topo da vista (tracejada, cor 7) |
| `DXF_LAYER_STAIR_RISER` | `ESCADA_ESPELHO` | uma LINE por espelho |
| `DXF_LAYER_STAIR_ARROW` | `ESCADA_SETA` | LINE da seta de subida (um trecho por segmento, mais as duas pontas) |
| `DXF_LAYER_STAIR_CUT` | `ESCADA_CORTE` | POLYLINE aberta do símbolo de corte, quando o plano corta a escada |
| `DXF_LAYER_STAIR_POST` | `ESCADA_POSTE` | POLYLINE fechada de 48 lados do poste central do caracol (raio `rInner`), na cota de corte ou abaixo; acima dela, vai para `ESCADA_ACIMA` |

Estilo: `LAYER_STYLE` em `dxf.ts`; só `ESCADA_ACIMA` tem linetype tracejado. `DxfLevelGeometry.stairs` (`dxf.ts`) recebe a geometria.

### 6.2 Camadas de projeção (decisão 0013 §4)
Fora do corte: `PAREDE_PROJECAO_ACIMA` (tracejada), `PAREDE_PROJECAO_ABAIXO`, `PAREDE_ALEM`; vãos `ABERTURA_ACIMA` (tracejada),
`ABERTURA_ABAIXO`, `ABERTURA_ALEM` (`ABERTURAS` é o corte); `TELHADO_PROJECAO` (tracejada). O oculto não sai.

### 6.3 Montagem
`dxfGeometryOf(p, levelId)` (`dxfExport.ts`) usa `planViewOf` (a mesma vista da tela). Escadas não ocultas: `stairDxf(p, s, { cutZ, topZ })`.
Pisos e lajes usam `resolveFloors` e `resolveSlabs` (com o furo derivado). A projeção do telhado sai sempre (divergência da §0, item 4).
Testes: `packages/io/src/dxf.test.ts` e `apps/web/src/editor/dxfExport.test.ts`.

---

## 7. Corte e elevação

`sectionStairs.ts` gera as peças de escada no corte: trapézio `[t0, t1] × [zFundo, zTop]` por intervalo da linha de corte, com
`bottomAt` linear. Piso e espelho usa as espessuras do tipo. A chegada do monolítico entra com `stairArrivalTopZ`. O intervalo de vista
não entra no corte (decisão 0013 §4).

---

## 8. Tabelas e quantitativos (UI)

- `StairScheduleDialog.tsx`: filtros, totais e exportação CSV (`stairScheduleToCsv`, gravado com `saveText`). Aberto por `dialog: 'stairSchedule'`.
- As tabelas não usam o intervalo de vista (contam todas as escadas do nível; decisão 0013 §4).

---

## 9. Propriedades, tipos e navegador (`apps/web`)

- `Properties.tsx`: grupo `stairs` (com `StairProperties.tsx`), contando escadas no total da seleção.
- `StairProperties.tsx`: seletor de tipo; grupo "Restrições" (nível base, nível de topo, deslocamentos da base e do topo, altura quando
  não há nível acima, modo de abertura, pé-direito livre, folga lateral e furo retangular); grupo "Dimensões" (nº de espelhos e
  demais quantitativos da escada).
- `dialogs/StairTypeDialog.tsx`: tipo da escada; "Face inferior: Lisa | Escalonada" (`stt-underside`); prévia com
  `StairSectionPreview.tsx` e `stairSectionProfile.ts`.
- `editor/stairActions.ts`: `stairPoints`, `stairBox` (para "Ir para" em `issuesView.ts`), `patchStairs` (edição em lote), `keptStairType`,
  `commonOf`.
- `editor/stairTypeActions.ts`: duplicar, renomear e excluir tipo (bloqueado se em uso). Substituir por outro tipo fica em `TypeRow.tsx`.
- `Browser.tsx`: lista de tipos de escada (`TypeRow kind="stair"`) e a entrada de tabela.
- `state.ts`: `DialogKind` inclui `stairType` e `stairSchedule`; `ROOF_PROJECTION_KEY` (`hestia.roofProjection`, decisão 0013 §5).
- `App.tsx`: `Dialogs`, `switch` com os diálogos de escada.
- `dxfExport.ts` e `controller.ts`: DXF e undo/redo de pegadas (§2.4).

---

## 10. Testes e verificação

| Camada | Arquivos principais |
|---|---|
| model | `stair.test.ts`, `viewRange.test.ts`, `esquema.test.ts` (migrações 11 → 12, 12 → 13, 13 → 14, com ida e volta) |
| engine, croqui | `stairSketch.test.ts` (leque acima de 180°; 200 casos determinísticos), `stairSketchState` (tools) |
| engine, geradores e propriedades | `stairGenerators.test.ts` (mulberry32, 200 casos), `stairs.test.ts` |
| engine, corpo e chegada | `stairBody.test.ts` (reta de referência, patamar L/U, winder, estanqueidade), `stairArrival.test.ts` |
| engine, furo, quantitativos, avisos | `stairOpenings.test.ts`, `stairQuantities.test.ts`, `stairSchedule.test.ts`, `stairIssues.test.ts`, `stairChecks.test.ts`, `stairUneven.test.ts`, `stairTopAbove.test.ts` |
| engine, corte e vista | `sectionStairs.test.ts`, `viewClass.test.ts`, `viewWarnings.test.ts`, `planWallCuts.test.ts` |
| tools | `stairTool.test.ts`, `stairRunTool.test.ts`, `stairPickLines.test.ts`, `stairPickTool.test.ts`, `stairSelection.test.ts` |
| render | `model3d/stairSolids.test.ts`, `plan/stairs.test.ts`, `plan/stairsArrow.test.ts`, `plan/stairsBuild.test.ts`, `plan/viewRange.test.ts` |
| io e web | `io/src/dxf.test.ts`, `apps/web/src/editor/stairActions.test.ts`, `stairTypeActions.test.ts`, `dxfExport.test.ts` |
| ponta a ponta | `tests/e2e/escadas.mjs`, `escadas-closeup.mjs`, `vista-planta.mjs` (roteiros de `npm run test:visual`), `visual.mjs` (helper), `README.md` |

- Regressão visual: `npm run build` e depois `npm run test:visual`. O helper `tests/e2e/visual.mjs` compara cada captura com
  `tests/e2e/baseline/` (PNG como `3d-escada.png`, `corte-escada.png`, `escada-croqui-concluida.png`, `planta-L.png`, `planta-U.png`,
  `planta-reta.png`). Detalhes em `tests/e2e/README.md`.
- Desempenho da vista: `scripts/bench-vista.mts` (`npx vite-node`). Números em `docs/decisoes/0013-intervalo-de-vista.md` §6.
- Paridade: `node scripts/check-parity.mjs` (roda em `npm run lint`).
- Limites: `eslint.config.js` (`max-lines` 420) em `packages/*/src` e `apps/*/src`.

---

## 11. Mapa de arquivos da escada

| Pacote | Arquivos |
|---|---|
| `model` | `stair.ts` (`makeStair`, `DEFAULT_STAIR_TYPES`), `stairTypes.ts` (`StairType`), `stairTransform.ts`, `validateStairs.ts`, `queries.ts` (`levelAbove`, `stairsOnLevel`), `commands.ts`, `history.ts`, `elementLevel.ts`, `migrate.ts`, `viewRange.ts` |
| `engine` | `stairSketchGeom.ts`, `stairSketchValidate.ts`, `stairSketch.ts`, `stairs.ts`, `stairGenerators.ts`, `stairNorms.ts`, `stairIssues.ts`, `stairChecks.ts`, `stairBody.ts`, `stairBodyGeom.ts`, `stairArrival.ts`, `stairOpenings.ts`, `stairQuantities.ts`, `stairSchedule.ts`, `sectionStairs.ts`, `section.ts` (`stairId`), `viewClass.ts`, `viewWarnings.ts`, `planWallCuts.ts`, `slabs.ts` e `floors.ts` (furo) |
| `tools` | `stairTool.ts`, `stairRunTool.ts`, `stairRunPlan.ts`, `stairDraw.ts`, `stairSketchState.ts`, `stairStroke.ts`, `stairView.ts`, `stairPreview.ts`, `stairCommands.ts`, `stairPick.ts`, `stairPickLines.ts`, `stairGrips.ts`, `registry.ts` (`stair`, `stairrun`), `types.ts` (`ToolOptions`) |
| `geom` | `openingSymbol.ts` (símbolos de vão, também no DXF das aberturas) |
| `render` | `plan/stairs.ts`, `plan/view.ts`, `plan/build.ts`, `stairRisers.ts`, `model3d/stairSolids.ts`, `model3d/scene3d.ts`, `model3d/solids.ts` |
| `io` | `dxf.ts` (`DXF_LAYER_STAIR*`, `DxfLevelGeometry.stairs`) |
| `apps/web` | `ui/StairOptionsBar.tsx`, `ui/StairRunOptionsBar.tsx`, `ui/StairProperties.tsx`, `ui/dialogs/StairTypeDialog.tsx`, `ui/dialogs/StairScheduleDialog.tsx`, `ui/dialogs/StairSectionPreview.tsx`, `ui/dialogs/stairSectionProfile.ts`, `editor/stairActions.ts`, `editor/stairTypeActions.ts`, `editor/dxfExport.ts`, `editor/controller.ts`, `editor/state.ts`, `editor/issuesView.ts`, `ui/Ribbon.tsx`, `ui/Icon.tsx`, `ui/Properties.tsx`, `ui/Browser.tsx`, `ui/TypeRow.tsx`, `App.tsx` |
| `tests` | `tests/e2e/escadas.mjs`, `escadas-closeup.mjs`, `vista-planta.mjs`, `visual.mjs`, `README.md`, `baseline/*.png` |
| `scripts` | `bench-vista.mts`, `check-parity.mjs` |
| `docs` | `decisoes/0011-escadas.md`, `decisoes/0012-escada-monolitica.md`, `decisoes/0013-intervalo-de-vista.md`, `paridade/escadas.md`, `paridade/ORDEM.json` |
