# Mapa do código para o elemento Escada

Repositório: `/home/user/Hestia` (HEAD `5d8194e`). Somente leitura: nenhum arquivo do repositório foi alterado.
Data da leitura: 2026-10-21.

Estado atual: **escada não existe no código.** Existem só o ícone `stairs` (`apps/web/src/ui/Icon.tsx`, linha 44), um
item desabilitado "Escada" na lista `SOON` de `apps/web/src/ui/Ribbon.tsx`, e as menções de `docs/02-MODELO-BIM.md` §2 e §6.
`docs/paridade/escadas.md` não existe. `docs/paridade/ORDEM.json` já reserva o elemento `escadas` com status `nao-iniciado`.

Convenção de evidência: `arquivo:função` ou `arquivo:linha`. Quando não há linha exata, cito só a função.

---

## 0. Achados principais (leia primeiro)

1. **Processo bloqueia o início.** `npm run parity` mostra telhados em 98 %, com 1 item bloqueante pendente
   (`docs/paridade/telhados.md`, A5 "Seta de inclinação e águas livres editadas na tela"). `scripts/check-parity.mjs` só
   deixa `escadas` sair de `nao-iniciado` enquanto telhados não tiver 95 % e zero bloqueantes pendentes. O item A5
   precisa ser fechado, ou marcado `[-]` com motivo escrito pelo dono do projeto.
2. **Não existe modo de croqui com várias camadas de linhas.** O telhado tem contorno do beiral (`boundary`), alças de
   vértice e de aresta, seleção de aresta (`roofEdgeAt`) e predefinições por aresta (`presetEdgeSlopes`). Não há linhas
   separadas para contorno, inclinação e furos. A "contorno qualquer" citada no checklist de telhados (item A10) é a forma
   `edges`, não um modo de desenho em camadas.
3. **Recorte automático de laje ou piso por escada não existe.** `resolveSlabs` e `resolveFloors` usam só o contorno e os
   furos gravados (`holes`). As promessas de `docs/02` (§2 "furos automáticos para abertura de escada", §6 "gera abertura na
   laje do nível acima") não estão implementadas.
4. **Degraus cabem no pipeline de prismas existente.** `extrudePolygon` (`render/src/model3d/solids.ts`) aceita topo e base
   lineares (`topAt`, `bottomAt`), e `computeSection` corta piso por camada como retângulo `(t, z)`. Um degrau é um prisma;
   um lance inclinado é um plano linear.
5. **Três consumidores leem `holes` cru, não a geometria resolvida:** `dxfGeometryOf` (`apps/web/src/editor/dxfExport.ts`),
   `pickSlabAt` (`packages/tools/src/slabPick.ts`) e `SlabProperties` (`slabArea`, contagem de furos). Se o recorte da
   escada for derivado, esses três precisam usar um helper comum.
6. **Dívida que afeta a escada:** `selectTool.ts` tem ~418 linhas efetivas e o ESLint limita a 420
   (`eslint.config.js`, `max-lines`). Adicionar alças de escada nele quebra o `npm run lint`. Antes, é preciso extrair.

---

## 1. MODELO

### 1.1 Como um elemento é definido

Padrão observado em `Floor`, `Slab`, `Roof` e `Wall` (`packages/model/src/types.ts`):

- **Interface do elemento** com `id`, `kind` (literal), `typeId`, `levelId`, `boundary: Vec2[]`, `holes: Vec2[][]`,
  `heightOffset`, campos próprios e `mark`, `comments`, `order`. `Slab` está em `types.ts:247` e `Roof` em `types.ts:310`.
- **União `Element`** (`types.ts:343`) = `Wall | Opening | Floor | Slab | Roof`. Um elemento novo entra aqui.
- **Mapa `Project`** (`types.ts:375`): `floorTypes`, `slabTypes`, `roofTypes` (`Record<Id, …>`), `elements: Record<Id, Element>`.
- **Construtor com padrão**: `makeSlab` (`packages/model/src/slab.ts:7`), `makeRoof` (`roof.ts:9`), `makeFloor` (`floor.ts:8`).
  Os campos de `makeX` são copiados por spread, então o construtor aceita parâmetros parciais.
- **Consulta por nível**: `slabsOnLevel`, `roofsOnLevel`, `floorsOnLevel` (ordenam por `order`).

### 1.2 Tipo "em camadas" (wallTypes / floorTypes / slabTypes / roofTypes)

- `Layer { function, materialId, thickness, wraps, priority? }` em `types.ts`. Camadas de cima para baixo (laje, telhado, piso).
- `SlabType` e `RoofType` (`types.ts:227` e `:262`): `{ id, name, code, description, layers, cost }`.
- Padrões: `DEFAULT_SLAB_TYPES` (`slab.ts:35`), `DEFAULT_ROOF_TYPES` (`roof.ts:49`), `DEFAULT_FLOOR_TYPES` (`floor.ts`).
- `slabTypeThickness` e `roofTypeThickness` somam as camadas.
- **Um tipo de escada não precisa ser de camadas.** Os campos da escada (`docs/02` §6): piso, espelho, largura mínima e
  corrimão. Se o acabamento do degrau for camada, a escada reaproveita `Layer`, `LayerAdvanced` e `TypeParams`.

Comparação dos campos (laje e telhado, base para a escada):

| Campo | Laje (`Slab`) | Telhado (`Roof`) | Escada (proposta) |
|---|---|---|---|
| contorno | `boundary` | `boundary` (beiral) | limites ou trajetória |
| furos | `holes` | `holes` | não (a escada é o furo) |
| nível | `levelId` + `heightOffset` | `levelId` + `heightOffset` | `levelId` (base) + `topLevelId` |
| forma | `slope` (um plano) | `shape`, `edgeSlopes`, `profile` | modo `run` ou `sketch` |
| tipo | `typeId` → `SlabType` | `typeId` → `RoofType` | `typeId` → `StairType` |

### 1.3 Checklist de arquivos que laje e telhado tocaram (histórico git)

Commits de laje: `d455202` (modelo), `e79f53a` (planta, corte, 3D), `1242b19` (validação, quantitativos, tabela, DXF),
`047bfda` (snap), `d4b179f` (ferramentas, interface). Total: **5 commits, 106 arquivos únicos** (`git log --no-merges
d455202^..d4b179f`).

Commits de telhado: `18bdf88` (modelo), `954d24d` (render), `6997a78` (ferramentas), `ff199e7` (motor), `9430103`
(esqueleto), `a54a488` (contrato v10), `962e8bd` (regressão visual). Total: **7 commits, 140 arquivos únicos**
(`git log --no-merges 18bdf88^..962e8bd`). Inclui 10 arquivos de `packages/geom` (esqueleto reto).

Arquivos por camada (contagem de arquivos únicos tocados):

| Camada | Laje | Telhado | Exemplos (laje ↔ telhado) |
|---|---|---|---|
| `packages/model` | 11 | 14 | `types.ts`, `slab.ts`/`roof.ts`, `commands.ts`, `defaults.ts`, `history.ts`, `migrate.ts`, `index.ts`, `validateSlabs.ts`/`validateRoofs.ts`, `validate.ts` |
| `packages/engine` | 14 | 34 | `slabs.ts`/`roofs.ts`, `*Quantities.ts`, `*Schedule.ts`, `section.ts`, `wallZ.ts`, `resolve.ts`, `index.ts` |
| `packages/geom` | 0 | 10 | só telhado (esqueleto) |
| `packages/tools` | 28 | 22 | `*Tool.ts`, `*Pick.ts`, `registry.ts`, `types.ts`, `selectTool.ts`, `edit.ts`, `clipboard.ts`, `selectionFilters.ts`, `enclosed.ts` |
| `packages/render` | 7 | 9 | `plan/build.ts`, `plan/slabs.ts`/`plan/roofs.ts`, `model3d/solids.ts`, `model3d/scene3d.ts` |
| `packages/io` | 2 | 3 | `dxf.ts`, `dxfSlabs.test.ts`/`dxfRoofs.test.ts` |
| `apps/web` | 25 | 35 | `typeActions.ts`, `controller.ts`, `state.ts`, `Ribbon.tsx`, `OptionsBar.tsx`, `*Properties.tsx`, `dialogs/*`, `TypeRow.tsx`, `Browser.tsx`, `Icon.tsx`, `dxfExport.ts`, `issuesView.ts` |
| `docs` | 3 | 3 | `paridade/<elemento>.md`, `decisoes/000N-*.md`, `paridade/ORDEM.json` |
| `tests` (e2e, baseline PNG) | 16 | 10 | `tests/e2e/lajes.mjs`, `tests/e2e/visual-regression.mjs`, `tests/e2e/baseline/*.png` |

Lista mínima que a escada precisa tocar, derivada desse histórico:

1. `model/types.ts` (interface, `Element`, `Project.stairTypes`); `model/stair.ts` (novo: `makeStair`, `DEFAULT_STAIR_TYPES`).
2. `model/commands.ts`: `addStair`, `upsertStairType`, `deleteStairType`; `applyTransformCmd` (mover, girar, espelhar, copiar);
   a guarda de `deleteLevel` (linha 311 lista só `wall/floor/slab/roof`, então precisa incluir a escada).
3. `model/defaults.ts` (`stairTypes` no `createEmptyProject`); `model/history.ts` (`labelOf`); `model/index.ts`.
4. `model/migrate.ts`: chave `11` (v11 → v12) e `SCHEMA_VERSION` em `types.ts:4`.
5. `model/validateStairs.ts` (novo) e `model/validate.ts` (`validateProject`, linhas 210 a 219).
6. `model/elementLevel.ts` (`hasLevel`, `applyElementLevel`) e `apps/web/src/editor/typeActions.ts` (`levelOfElement`).
7. `engine/stairs.ts`, `engine/stairQuantities.ts`, `engine/stairSchedule.ts`, `engine/index.ts`; `slabs.ts` e `floors.ts` (recorte).
8. `engine/section.ts` (ramo de escada em `computeSection`) ou arquivo próprio.
9. `tools/registry.ts` (`ToolId`, `TOOL_LABEL`, `TOOL_SHORTCUT`, `createTool`); `tools/types.ts` (`ToolOptions`); ferramenta própria.
10. `tools/selectTool.ts` (acerto de seleção e alças), `tools/edit.ts` (`selectedMovables`, `makeIdMap`, `ghostBands`),
    `tools/clipboard.ts`, `tools/selectionFilters.ts`, `tools/infer.ts` (se a escada tiver capturas).
11. `render/plan/stairs.ts` (novo), `render/plan/build.ts`, `render/model3d/solids.ts` ou `stairSolids.ts` (novo),
    `render/model3d/scene3d.ts` (`ModelScene.update`).
12. `io/dxf.ts` (`DxfLevelGeometry.stairs`, função de camada), `apps/web/src/editor/dxfExport.ts`.
13. `apps/web`: `Ribbon.tsx`, `Icon.tsx` (chave `stair`), `OptionsBar.tsx` + `StairOptionsBar.tsx`, `Properties.tsx` +
    `StairProperties.tsx`, `state.ts` (`DialogKind`, `DEFAULT_OPTIONS`), `App.tsx` (`Dialogs`), `Browser.tsx`,
    `TypeRow.tsx`, `issuesView.ts` (`issueTarget`), `transfer.ts`, `dialogs/StairTypeDialog.tsx`,
    `dialogs/StairScheduleDialog.tsx`.
14. `docs/paridade/escadas.md`, `docs/decisoes/0011-escadas.md`, `docs/paridade/ORDEM.json` (status).
15. Testes: `model/*.test.ts` (migração em `esquema.test.ts`), `engine/stairGolden.test.ts`, `tools/stair*.test.ts`,
    `render/model3d/stairSolids.test.ts`, `io/dxfStairs.test.ts`, `apps/web/src/editor/stairActions.test.ts`,
    `tests/e2e/escadas.mjs`, casos em `tests/e2e/visual-regression.mjs` com baseline PNG.

### 1.4 Migração e SCHEMA_VERSION

- `SCHEMA_VERSION = 11` (`packages/model/src/types.ts:4`).
- `migrations[n]` leva n para n + 1 (`packages/model/src/migrate.ts:20`). Entradas de laje e telhado:

| Chave | Migração | Trecho |
|---|---|---|
| 7 (v7 → v8) | `slabTypes` padrão | `migrate.ts:83` |
| 8 (v8 → v9) | `roofTypes` padrão e três materiais de cobertura | `migrate.ts:85` a `:89` |
| 9 (v9 → v10) | `edgeSlopes`, `edgeOverhangs`, `profile`, `joinOthers`, `rafterCut`, `eave` derivados da forma antiga | `migrate.ts:93` a `:128` |
| 10 (v10 → v11) | tipo de junção `square` vira `butt` | `migrate.ts:130` a `:142` |

- Escada: entrada `11` (v11 → v12) com `stairTypes` padrão, e `SCHEMA_VERSION = 12`.
- Testes existentes que servem de modelo: `packages/model/src/esquema.test.ts` (bloco "migração 10 → 11"),
  `packages/engine/src/slabGolden.test.ts` (projeto v7 sem `slabTypes`, linha 166), `packages/engine/src/roofGolden.test.ts`
  (migração de v8 sem `roofTypes`, linha 136).
- O carregamento de arquivo chama `migrateProject` (`apps/web/src/editor/controller.ts`, `openFromText`).

### 1.5 Validação

- `validateSlabs.ts`: `slabIssues(p)` (linha 138) = geometria (`slabIssuesOf`), sobreposição entre lajes (`slabOverlaps`),
  sobreposição laje e piso (`slabFloorOverlaps`). Códigos: `slab-few-points`, `slab-type-missing`, `slab-level-missing`,
  `slab-slope-invalid`, `slab-self-intersect`, `slab-zero-area`, `slab-hole-outside`, `slab-overlap`, `slab-floor-overlap`.
- `validateRoofs.ts`: `roofIssues(p)`, mesmo padrão.
- `validate.ts`: `validateProject` (linha 206) junta tudo. Cada família entra numa linha (`...slabIssues(p)`, `...roofIssues(p)`).
- Helpers reaproveitáveis: `OVERLAP_MIN`, `ZERO_AREA`, `fmtArea`, `holeOutside`, `selfIntersects` (`validateFloors.ts`).
- Avisos de geometria de telhado vêm de fora do modelo: `apps/web/src/editor/useIssues.ts` (`allIssues`) junta
  `roofWallIssues` e `roofSurfaceIssues` do engine. Escada entra na mesma lista se o aviso depender do engine.
- Severidade: `ValidationIssue.severity` = `'error' | 'warning'` (`validate.ts`). O aviso de Blondel deve ser `warning`
  (`docs/02` §6: "aviso, nunca bloqueio"). A constante de Blondel (2 × espelho + piso ≈ 0,63 m) é conhecimento de domínio,
  **não está no repositório**. Confirmar em `docs/05` antes de fixar.

### 1.6 Editor de tipo (padrão)

- `apps/web/src/ui/dialogs/SlabTypeDialog.tsx` (170 linhas): estado `draft` com `structuredClone`, lista de camadas,
  `LayerAdvanced`, `SlabSectionPreview` (seção ao vivo), `slabTypeError`, `duplicate`, `upsertSlabType` com rótulo
  "Editar tipo de laje".
- Ações de tipo: `apps/web/src/editor/slabTypeActions.ts` (`duplicateSlabType`, `renameSlabType`, `slabTypeDeleteBlock`,
  `tryDeleteSlabType`), com os mesmos nomes em `roofTypeActions.ts` e `typeActions.ts` (piso).
- Uso de tipo: `apps/web/src/editor/typeActions.ts`: `TypeKind` (linha 5), `usesType` (linha 23), `instancesOfType`,
  `selectAllPlan`, `replaceType`.
- Lista do navegador: `apps/web/src/ui/Browser.tsx` (`slabTypes.map` com `TypeRow kind="slab"`).
- `apps/web/src/ui/TypeRow.tsx`: `deleteBlockOf` (linha 38) e cadeias de ternário por `kind` (linhas 92, 113, 118, 185).
  Cada tipo novo acrescenta um ramo em cada cadeia.

### 1.7 Desfazer e comandos

- `ProjectStore` (`packages/model/src/history.ts`) usa patches do immer (`applyPatches`, `produceWithPatches`). Desfazer
  funciona para qualquer elemento novo sem código extra.
- `labelOf(c)` (`history.ts:136`) dá o rótulo do desfazer: `case 'addSlab': return 'Criar laje'`. Escada precisa de rótulos.
- `ProjectStore.exec(cmd, label)` e `transaction(label, fn)` são as únicas escritas (`docs/01` §5).

---

## 2. CROQUI (ferramentas, captura, alças)

### 2.1 Contrato e registro

- Interface `Tool` (`packages/tools/src/types.ts`): `start`, `move(p)`, `click(p)`, `type(text)`, `tab()`, `cancel()`,
  `confirm()`, `down/drag/up` (opcionais, só arrasto), `preview(): PreviewItem[]`, `inference()`, `deleteKey?()`,
  `inputPrompt()`, `pick3d?` (aceita clique 3D).
- Classe base `ToolBase` (`packages/tools/src/base.ts`): `start()` chama `reset()` e mostra `hint`. Abstratos: `reset()`
  e `busy()`. `cancel()`: se há passo em curso, reinicia; senão `env.done()` (volta à seleção). `ctx()` monta
  `InferContext` e acrescenta `floorVertices(project, levelId)` (base.ts). `snap(p, extra)` chama `infer`.
- Ambiente `ToolEnv` (`types.ts`): `project()`, `levelId()`, `selection()`, `setSelection`, `exec`, `transaction`,
  `metersPerPixel`, `gridStep`, `say` (barra de status), `done`, `options()`, `roofEdge?()`, `setRoofEdge?()`.
- `packages/tools/src/registry.ts`: `ToolId` (união de strings, linha ~22), `TOOL_GROUPS` (não é usado: `Ribbon.tsx`
  faz `void TOOL_GROUPS`), `createTool(id, env)` (switch), `TOOL_LABEL: Record<ToolId, string>` (exige todas as chaves),
  `TOOL_SHORTCUT` (parcial). Atalhos de teclado em `apps/web/src/editor/controller.ts` (`key`, mapa na linha ~260).
  Letras já usadas: V W F B U D J M C R S A O G T L N P E K H.

### 2.2 Máquinas de estado das ferramentas de contorno

- `SlabTool` (`packages/tools/src/slabTool.ts`, 207 linhas): modos `SlabMode` = `poly | rect | perimetro | hole`.
  Estado: `pts: Vec2[]`, `startPt`. Métodos: `movePoly`, `moveRect`, `movePerimeter`, `clickPoly` (fecha por duplo clique
  ou clique no primeiro ponto a 10 px, em `finishContour`), `clickRect`, `type` (medida digitada, `parseNumber`),
  `commit(boundary)` (emite `addSlab` com `makeSlab`), `commitHole(ring)` (emite `updateElements` com `holes`).
- `RoofTool` (`packages/tools/src/roofTool.ts`, 276 linhas): modos `RoofMode` = `poly | rect | paredes | hole | extrusao`.
  `extrusao` troca para `RoofExtrusionTool`. `Tab` alterna `axisAlt` (eixo da cumeeira ou da subida). O comando só sai se
  `roofProblem` aprovar (o motor gera águas); caso contrário, mostra o motivo.
- `SelectTool` (`packages/tools/src/selectTool.ts`): tipo `Mode` (linha 17) = `idle | pending | window | grip | floorgrip |
  slabgrip | roofgrip | roofedge | dragwait | moving | opening`. Um modo por tipo de alça, com `if (isFloor/isSlab/isRoof)`
  espalhado em `hitAt` (linha 70), `move` (linha 92), `down` (linhas 190 a 230), `drag` (linhas 246 a 330) e `up`
  (linhas 340 a 410). Esse é o ponto de acoplamento que a escada precisa mudar.
- `SlopeTool` (`slabSlopeTool.ts`) e `RoofArrowTool` (`roofArrowTool.ts`): dois cliques (origem e direção). A seta de
  telhado é a base de um modo de "direção de subida" para a escada.
- `ParallelTool`, `SplitTool`, `TrimTool`: não se aplicam à escada.

### 2.3 Captura, snap e inferência

- `infer(cursor, ctx)` (`packages/tools/src/infer.ts:82`): candidatos de endpoint, midpoint, face, core, intersection,
  perpendicular, alignment, ortho, grid. Devolve `Inference { point, kind, guides, hostId? }`.
- `InferContext` (`infer.ts:17`): `project`, `levelId`, `mpp`, `gridStep`, `from?`, `orthoLock?`, `ignore?`, `noGrid?`,
  `extraPoints?` (pontos extras, como o contorno em construção), `snap?` (`SnapOptions`).
- `SnapOptions` (`types.ts`): `grid, axis, faces, core, intersections, perpendicular, alignment`. Padrão em `DEFAULT_SNAP`.
- Vértices de pisos entram sempre (`floorVertices` em `ToolBase.ctx`). Vértices de lajes não entram (comentário em base.ts).
  A escada decide se seus vértices são captura.
- Guias temporárias: `Guide { from, to, kind: 'alignment'|'ortho'|'perpendicular' }`. **Não existe linha de modelo
  persistente nem camada de guia.**

### 2.4 Entrada numérica

- `type(text)` na ferramenta, confirmado com Enter. `inputPrompt()` devolve o rótulo do campo ("Comprimento").
- `parseNumber` (`packages/tools/src/numeric.ts`): aceita vírgula e expressão (`3,50+0,15`, `(2+1)*0,5`) sem `eval`.
- Exemplo de uso: `SlabTool.type` soma um segmento de comprimento `v` na direção do cursor.

### 2.5 Alças (grips)

- Vértice ou meio de aresta: `floorGripAt` (`floorPick.ts`), `slabGripAt` (`slabPick.ts`), `roofGripAt` (`roofPick.ts`).
  **As três funções são idênticas** salvo pelo tipo. Escada adicionaria uma quarta cópia.
- Edição do contorno: `ringMoveVertex`, `ringInsertAfter`, `ringRemoveVertex` (`floorPick.ts`). Para telhado, o contorno
  passa por `roofRingPatch` (`roofEdges.ts`) e `commitRoofPatch` (`roofCheck.ts`), que mantêm `edgeSlopes` e
  `edgeOverhangs` do mesmo tamanho de `boundary`. Escada com listas por aresta precisa do mesmo cuidado.
- Furos **não têm alça**: só o contorno. Furo nasce só pelo modo `hole` (`commitHole`).
- Tecla Delete com vértice em foco: `deleteKey?()` (contrato de `Tool`), implementado em `SelectTool` (`selectTool.ts`) e acionado pelo `controller.ts`.
- Arrasto: `down/drag/up` no contrato; `SelectTool` implementa o arrasto de alça.

### 2.6 Edição de aresta de telhado (painel "Aresta N")

- `roofEdgeAt` (`roofPick.ts`): aresta sob o cursor, tolerância 8 px, só com um telhado selecionado.
- `RoofEdgeSel { roofId, index }` (`types.ts`), guardado em `UiState.roofEdge`. `roofEdgePreview` destaca a aresta.
- Painel: `apps/web/src/ui/RoofEdgeProps.tsx` (inclinação por aresta, balanço, "define inclinação" com `I`).
- Predefinições por forma: `presetEdgeSlopes` (`roofEdges.ts`).

### 2.7 "Modo de edição de croqui com várias camadas de linhas"

**Não existe.** Resumo do que existe:

- um contorno por elemento, com alças de vértice e de aresta;
- um modo `hole` para furos novos, sem alça de furo;
- seleção de aresta do telhado (`roofEdgeAt`) e seta de inclinação (`RoofArrowTool`, item A5 parcial);
- nenhuma linha persistente além do contorno e das guias temporárias de captura.

Para a escada, o croqui precisa de algo novo: limites (contorno), direção de subida (seta) e, se for o caso, linhas de
espelho. O mais simples é contorno mais direção, no padrão de `RoofArrowTool`. Camadas de linhas exigem decisão de
produto antes de código.

### 2.8 Barra de opções

- `apps/web/src/ui/OptionsBar.tsx` (148 linhas): ramos inline por ferramenta (parede, piso, porta, janela, girar, matriz,
  deslocar, paralela, seleção). Laje e inclinação delegam para `SlabOptionsBar.tsx`; telhado, para `RoofOptionsBar.tsx`.
- Estado: `UiState.options: ToolOptions` (`apps/web/src/editor/state.ts`). `DEFAULT_OPTIONS` fica no mesmo arquivo
  (ex.: `slabTypeId: 'ls_mac12'`, `roofTypeId: 'rt_ceramica'`). Escrita por `useUi.setState({ options: {...} })`.
- Trocar o modo reinicia a ferramenta: `editor.setTool('slab')` depois de `setState`. Mesmo padrão serve para a escada.
- `ToolOptions` (`types.ts`): campos de telhado são **opcionais** (`roofTypeId?`, `roofMode?`). Isso é necessário:
  `packages/tools/src/testEnv.ts` (`makeEnv`) monta um `ToolOptions` literal sem os campos de telhado. Campos novos da
  escada devem ser opcionais, senão o typecheck quebra.

---

## 3. NÍVEIS E LAJES

### 3.1 Níveis

- `Level { id, name, elevation }` (`types.ts`). `levelElevation(p, id)` (`packages/model/src/queries.ts:37`).
- `upsertLevel` reordena por cota (`commands.ts`, linhas 302 a 308).
- **Não existe helper de "nível acima" ou "nível abaixo"** (busca por `above`, `below`, `nextLevel`, `levelAbove`: sem
  resultado). O subpavimento usa `p.levels[idx - 1]` em `apps/web/src/ui/ViewportCanvas.tsx` (linhas 154 a 167).
- Cota de elemento:
  - laje, piso, telhado: `levelElevation + heightOffset`, e camadas descem a partir do topo (`resolveSlabs`, `slabs.ts`);
  - parede: `wallBaseElevation = nível + baseOffset`; topo por `topLevelId + topOffset` ou por `height`
    (`wallTopElevation`, `queries.ts:42`).
- Escada com base `levelId` e topo `topLevelId` segue o modelo da parede (mesmo campo, mesma função de cota).
- Mover entre níveis: `applyElementLevel` (`packages/model/src/elementLevel.ts`) com `keep: 'elevation' | 'offset'`.
  `hasLevel` (mesmo arquivo) lista `Wall | Floor | Slab | Roof`. A escada precisa entrar, com o deslocamento correto.

### 3.2 Furos de laje

- Campo `holes: Vec2[][]` (`Slab`). Nasce por `SlabTool` (modo `hole`) ou por `updateElements`.
- Validação: `slab-few-points` (menos de 3 pontos) e `slab-hole-outside` (furo fora do contorno).
- Geometria resolvida: `resolveSlabs` (`packages/engine/src/slabs.ts`) faz `polygon: [slabPolygon(s)]`, e `slabPolygon`
  é `[boundary, ...holes]`. **Não há origem do furo**: nada diz qual furo veio de qual escada.

### 3.3 Recorte automático: o que existe e o que falta

- Existe: nada. `resolveFloors` (`packages/engine/src/floors.ts`) não recorta furos. Parede e piso não cortam laje.
- Falta, para a escada seguir o recorte:
  1. **Forma em planta da escada como função pura**, em `packages/model` (a validação está lá e não pode importar
     `engine`). Ela devolve a união dos prismas (degraus, lance, patamar) em planta.
  2. **Onde ligar**: o recorte vai na laje e no piso do nível `topLevelId` (o nível de cima), que é onde o lance atravessa.
     A abertura é a projeção da escada inteira em planta. Pode haver margem para pé-direito, mas isso é decisão de produto.
  3. **Derivado ou persistido.** Persistir (gravar em `holes` ao criar a escada) é simples, mas cria dessincronia ao mover
     a escada e viola "nada derivado é persistido" (`docs/01` §4). Derivado é o caminho coerente: `resolveSlabs` e
     `resolveFloors` subtraem a projeção das escadas com `topLevelId` igual ao nível. Recomendado.
  4. Com recorte derivado, **todos os consumidores de `holes` cru passam a errar**, então precisam de um helper comum
     (ex.: `slabOpenings(p, slab)`):

| Consumidor | Onde | Usa | Situação com recorte derivado |
|---|---|---|---|
| `resolveSlabs`, `resolveFloors` | `engine/slabs.ts`, `engine/floors.ts` | geometria | ponto de inserção do recorte |
| quantitativos de laje | `engine/slabQuantities.ts` | resolvido | corrigido de graça |
| corte, planta, 3D | `section.ts`, `plan/slabs.ts`, `model3d/solids.ts` | resolvido | corrigido de graça |
| altura do piso sobre a parede | `engine/wallZ.ts` (`facesAt`) | resolvido | corrigido de graça |
| validação de sobreposição | `model/validateSlabs.ts` (`slabPolygon`) | cru | **erra** |
| DXF | `apps/web/src/editor/dxfExport.ts` (`dxfGeometryOf`) | `s.holes` | **erra** |
| seleção por clique | `tools/slabPick.ts` (`pickSlabAt`) | `s.holes` | **erra** |
| propriedades | `apps/web/src/ui/SlabProperties.tsx` (`slabArea`, "Furos") | cru | **erra** |

- Ponto de atenção: tabela e propriedades usam fontes diferentes (`SlabProperties` usa `slabArea` de `model`; a tabela usa
  `quantifySlabs`, de `engine`). Com recorte derivado, as duas podem divergir.

---

## 4. GEOMETRIA 3D

### 4.1 Sólido por prisma

- `extrudePolygon(b, poly, z0, z1, topAt?, bottomAt?)` (`packages/render/src/model3d/solids.ts`): triangula o polígono com
  furos (`triangulate`), cria topo e base (com `topAt`/`bottomAt` lineares, a normal sai do gradiente), e as paredes laterais
  por aresta. Escreve em um `SolidBatch { materialId, positions, normals, indices }`.
- Planos lineares (`topAt`, `bottomAt`) já são suportados. Um lance inclinado é `topAt(x, y) = z1 + slope(x, y)`.
  Assim faz `buildSlabSolids` (laje com inclinação, `topAt` e `bottomAt` via `slabRiseAt`).
- Degrau como prisma: `extrudePolygon(b, retângulo_do_degrau, 0, altura_do_degrau)`. Não há código novo de malha.

### 4.2 Montagem por nível

- `buildLevelSolids(r: ResolvedLevel)`: paredes, por camada e faixa (`fuseBands`).
- `buildFloorSolids(floors)`, `buildSlabSolids(slabs)`, `buildRoofSolids(roofs)`: uma `SolidBatch` por material.
- `ModelScene.update(p, levels, opt)` (`packages/render/src/model3d/scene3d.ts`): para cada nível, concatena os lotes
  (`[...solids.batches, ...buildFloorSolids(...), ...buildSlabSolids(...), ...buildRoofSolids(roofs), ...eave.batches]`),
  cria `THREE.Mesh` por lote com `this.material(p.materials[...])`, adiciona arestas se `opt.edges` e as aberturas
  (`openingObject`). Escada entra como mais um lote na mesma lista.
- Telhado especial: `eaveSolids.ts` (`buildEaveSolids`), beiral à parte.

### 4.3 Picking 3D

- `pickModelPoint(root, camera, ndc)` (`packages/render/src/model3d/pick3d.ts`): raio contra as malhas, ignora linhas e o
  chão (`PlaneGeometry`). Devolve só o (x, y) da superfície. A ferramenta acha o elemento pela planta.
- A propriedade `pick3d?` do contrato `Tool` faz a ferramenta receber o clique 3D (hoje só as ferramentas Anexar e Desanexar topo, em `attachRoofTool.ts`).
- As malhas são agrupadas por material. **Não há id por malha** (`docs/08`, decisão 0008 #18). Escada não deve depender de
  id de malha para seleção.

### 4.4 Degraus: o que falta

- Nada de sólido novo: prismas e planos lineares bastam.
- Atenção: `extrudePolygon` calcula a normal do plano a partir do gradiente medido no primeiro vértice. Serve para planos,
  não para superfícies curvas. Escada curva (arco) precisaria de malha própria.
- Escada maciça (todos os degraus empilhados) gera faces internas coincidentes. Não são visíveis de fora, mas ocupam
  vértices.

---

## 5. PLANTA (2D)

### 5.1 Pipeline

- `buildPlanDrawList(input: PlanInput)` (`packages/render/src/plan/build.ts:80`) é a única montagem. Ordem:
  1. subpavimento apagado (`input.below`, `belowFloors`, `belowSlabs`, `belowRoofs`);
  2. lajes (`slabFills`), pisos (`floorFills`), paredes (`resolved.clusters`);
  3. símbolos de abertura (`openingSymbol`);
  4. telhados (`roofFills`), marcas de corte (`sectionMarksOf`), etiquetas (`wallTagLabels`, `joinDebugLabels`);
  5. seleção e destaque (`floorSelectionOps`, `slabSelectionOps`, `roofSelectionOps`, `elementHighlight`);
  6. pré-visualização, guias e marcador de captura (`previewOverlay`, `guideStrokes`, `snapMarker`).
- Saída neutra: `PlanDrawList { background, fills: FillOp[], strokes: StrokeOp[], labels: LabelOp[] }` (`plan/types.ts`).
  `gpuPlan.ts` (`PlanScene`) e `cpuPlan.ts` (`drawPlanCpu`) consomem a mesma lista. Um símbolo novo não exige mudança nos
  renderizadores.
- Tipos: `FillOp { polygons, color, alpha, hatch? }`, `StrokeOp { pts, closed, widthPx, color, alpha, dash? }`
  (espessura em pixels de tela), `LabelOp { at, text, dx?, dy?, tone? }`. Temas `LIGHT` e `DARK` (`PlanTheme`).

### 5.2 Modelo a seguir para a escada

- `plan/slabs.ts`: `slabFills` (cor da camada estrutural misturada com o papel, hachura em zoom alto, faixa de contorno de
  1,5 px), `slopeArrow(dir, at, v, theme)` (seta de 80 px com cabeça de 7 px) e rótulo de percentual. A seta de subida da
  escada reaproveita `slopeArrow`.
- `plan/floors.ts`: `labelPoint(m)` (ponto da etiqueta), `outlineSelectionOps(parts, selection, hover, areaLabel, theme,
  v)`, genérico em `OutlinedPart { id, polygon }`. Escada usa a mesma função.
- `plan/symbols.ts`: `openingSymbol(g, theme, widthPx)` é o padrão para um símbolo de planta com arcos e linhas.
- Níveis de detalhe: `DetailLevel = 'coarse' | 'medium' | 'fine'` (`types.ts`). `build.ts` aplica o nível em cada camada.
- Linha de corte: `plan/sectionMarks.ts` (`sectionMarksOf`), desenhada em toda planta.
- Cores: `mix(a, b, t)` (`plan/color.ts`). Pesos: `widthPx`. Temas: `PlanTheme` (tokens em `types.ts`).

### 5.3 DXF

- `packages/io/src/dxf.ts`: `DxfLevelGeometry` (linha 30) com `floors?`, `slabs?`, `roofs?`. Funções de camada:
  `dxfLayerOfFloor` (`PISO_<código>`), `dxfLayerOfSlab` (`LAJE_<código>`), `dxfLayerOfRoof` (`TELHADO_<código>`); constantes
  `DXF_LAYER_CONTOUR`, `DXF_LAYER_OPENINGS`, `DXF_LAYER_ROOF_RIDGE`, `DXF_LAYER_ROOF_GABLE`. `exportDxf(project, levelId, geo)`
  (linha 154).
- Vista da planta (decisão 0013 §4): fora do corte, as camadas de projeção são `PAREDE_PROJECAO_ACIMA` (tracejada),
  `PAREDE_PROJECAO_ABAIXO`, `PAREDE_ALEM`; vãos `ABERTURA_ACIMA` (tracejada), `ABERTURA_ABAIXO`, `ABERTURA_ALEM` (`ABERTURAS` é o
  corte); `TELHADO_PROJECAO` (tracejada); escada `ESCADA_ACIMA` (degraus acima da cota de corte, tracejados) e `ESCADA_CORTE`
  (símbolo de corte, polilinha aberta). Constantes `DXF_LAYER_*`; estado `DxfViewState` (sem `hidden`, que não sai). O tipo de
  linha `DASHED` entra na tabela LTYPE só quando uma camada o usa.
- `apps/web/src/editor/dxfExport.ts`: `dxfGeometryOf(p, levelId)` monta `DxfLevelGeometry` a partir de `planViewOf` (render), a
  mesma vista da tela. Lê `holes` cru, o que já é um ponto de atenção (seção 3.3).
- Escada: campo `stairs?` em `DxfLevelGeometry` e camada `ESCADA_<código>` (proposta). Teste de modelo:
  `packages/io/src/dxfSlabs.test.ts`.

---

## 6. CORTE E ELEVAÇÃO

### 6.1 Como laje e telhado entram

- `computeSection(p, line, levelIds)` (`packages/engine/src/section.ts:124`). Para cada nível:
  - **pisos** (linhas 143 a 176): `resolveFloors`, `lineIntervals(poly, a, d, n)` com `rect(lo, hi, z0, z1)` por camada;
    e a parte "além do corte" como `SectionBeyond` com `floorId`;
  - **lajes** (177 a 212): mesmo padrão, mas com `slabQuad(...)` porque o topo sobe por `slabRiseAt`; `SectionBeyond` com `slabId`;
  - **telhados** (215): `sectionOfRoofs(resolveRoofs(p, levelId), line)` (função na linha 332), faixas por água e camada;
  - **paredes** (`bandFuse`, `lineIntervals`) e **vãos** (`SectionOpening`).
- Resultado `SectionResult { length, zMin, zMax, cut: SectionRegion[], silhouette, beyond: SectionBeyond[], openings, levels }`.
- `SectionBeyond` (`section.ts:31`) tem `wallId?`, `floorId?`, `slabId?`, `roofId?`. Escada entra como `stairId?`.
- Renderização: `packages/render/src/section/build.ts` (`buildSectionDrawList`), que consome `SectionResult` e devolve
  `PlanDrawList`. Controller: `editor.sectionOf(id)` (`apps/web/src/editor/controller.ts:117`).

### 6.2 O que falta para degraus

- **Degrau como prisma** entra pelo caminho de piso: cada prisma é um "retângulo por camada" com `z0` e `z1`. A união dos
  cortes forma o dente de serra do corte. Não precisa de código novo para a parte maciça.
- **Lance inclinado** (rampa) entra pelo caminho de laje (`slabQuad` com `rl`/`rh`), se a escada for uma laje inclinada.
- Falta: `stairId?` em `SectionBeyond` e um ramo novo em `computeSection`. Como `section.ts` tem 342 linhas efetivas,
  colocar o ramo em `sectionStairs.ts` (padrão de `sectionOfRoofs`).
- Hachura de corte: a escada usa o material do tipo, como as outras famílias.
- Elevação: mesma função com a linha de elevação (`SectionView.kind === 'elevation'`).

---

## 7. QUANTITATIVOS E TABELAS

### 7.1 Laje

- `quantifySlabs(p, levelId)` (`packages/engine/src/slabQuantities.ts`): usa `resolveSlabs`, então área e volume são os
  mesmos do 3D e da planta. Campos por laje (`SlabQuantity`): `planArea`, `faceArea` (área / cos(atan(%/100))),
  `perimeter`, `holesPerimeter`, `thickness`, `slopePercent`, `volume`, `layers[]` (`SlabLayerQuantity`: `thickness`,
  `volume`, `materialId`).
- `buildSlabSchedule(p)` (`packages/engine/src/slabSchedule.ts`): uma linha por laje (`SlabScheduleRow`: marca, tipo, código,
  nível, áreas, volume, inclinação, deslocamento). `filterSlabRows(rows, { typeId?, levelId? })`, `sumSlabRows`,
  `slabScheduleToCsv(rows, totals)`.
- `csvDocument` (`packages/engine/src/csv.ts:14`): separador `;`, CRLF, BOM UTF-8, decimal com vírgula (`formatDecimal`).
- Interface: `apps/web/src/ui/dialogs/SlabScheduleDialog.tsx` (152 linhas): filtros, totais, exportação. Abre por
  `useUi.setState({ dialog: 'slabSchedule' })`. Entradas: Ribbon, grupo "Documentar" da aba Vista (`Ribbon.tsx`), e
  "Tabela de lajes" no `Browser.tsx`.

### 7.2 Telhado e piso

- `roofSchedule.ts` (`ROOF_SHAPE_LABEL`, `RoofScheduleRow`, `buildRoofSchedule`) e `roofQuantities.ts` (`quantifyRoofs`).
- `floorSchedule.ts` (`quantifyFloors` de `floorQuantities.ts`).
- Diálogos: `RoofScheduleDialog.tsx`, `FloorScheduleDialog.tsx`.

### 7.3 Escada (proposta de padrão)

- `stairQuantities.ts` e `stairSchedule.ts` no mesmo formato. Campos sugeridos: marca, tipo, nível base, nível topo,
  altura, número de espelhos, espelho real, piso, largura, comprimento do corrimão, área dos degraus, volume, status de
  Blondel. CSV no padrão de `csvDocument`.
- Identidade: `mark` (Marca) e `id`. Filtros: tipo e nível.

---

## 8. PROPRIEDADES E UI

### 8.1 Painel de propriedades

- `apps/web/src/ui/Properties.tsx` (`Properties`): escolhe o componente pelo tipo da seleção (`walls`, `ops`, `floors`,
  `slabs`, `roofs`). Seleção mista mostra aviso. Escada entra como `stairs` com `StairProperties.tsx`.
- Modelo de painel: `SlabProperties.tsx` (`SlabProperties`). Seções: "Restrições" (`LevelField` e deslocamento do topo),
  "Inclinação" (`NumField` com `setPercent` em `transaction`), "Construção" (camadas de `type.layers`), "Dimensões"
  (somente leitura), "Identidade" (marca e comentários). Escrita: `editor.store.exec({ type: 'updateElements', ids, patch })`.
- Campos: `fields.tsx` (`NumField` com unidade, `decimals`, `mixed`, expressão; `Row`, `Group` com `open`, `TextField`, `Check`).
- Nível: `LevelField.tsx`, `MoveLevel.tsx` ("Mover para o nível…", aba Modificar).
- Escopo das propriedades: `docs/06` §7 classifica parede, piso, laje, telhado e porta. **Escada não está classificada.**
  A regra 10 de `docs/06` diz que parâmetro novo sem escopo não entra.

### 8.2 Faixa e ícones

- `apps/web/src/ui/Ribbon.tsx`: `GROUP_BY_TAB.arquitetura` (grupo "Construir", linha 9). A lista `SOON` (linha 18) tem
  `{ icon: 'stairs', label: 'Escada' }` como botão desabilitado. Escada substitui essa entrada por `ToolButton id="stair"`.
- `apps/web/src/ui/Icon.tsx`: mapa `P` de caminhos SVG. `ToolButton` usa `Icon name={id}`, então a ferramenta precisa de
  chave `stair`. A chave existente é `stairs` (linha 44), que é a usada pela lista `SOON`.
- Barra de status: `env.say` escreve em `UiState.status` (`StatusBar.tsx`).

### 8.3 Avisos e "Ir para"

- `apps/web/src/ui/IssuesButton.tsx` e `apps/web/src/editor/issuesView.ts`: `groupIssues`, `summarize`, `worstSeverity`.
- `issueTarget(p, issue)` (`issuesView.ts`): para piso, laje e telhado, devolve a caixa do contorno (`box`) para enquadrar.
  Escada precisa de um ramo, senão "Ir para" cai no ponto médio (que não existe para escada).

### 8.4 Diálogos e navegador

- `apps/web/src/editor/state.ts`: `DialogKind` (linha 8) inclui `floorType`, `slabType`, `roofType`, `*Schedule`. Escada
  acrescenta `stairType` e `stairSchedule`.
- `apps/web/src/App.tsx`: `Dialogs` (linha 58) tem um `switch (d)` (linhas 61 a 88). Cada diálogo novo é um `case`.
- `apps/web/src/ui/Browser.tsx`: seção de tipos (`floorTypes`, `slabTypes`, `roofTypes`, linhas 16 a 18 e 109 a 150) e
  "Tabelas" (linhas 156 a 181). Escada entra nos dois.

---

## 9. TESTES

### 9.1 Padrões por camada

| Camada | Padrão | Exemplo | Como rodar |
|---|---|---|---|
| model | unidade: validação por código, migração, comandos | `packages/model/src/validateSlabs.test.ts`, `esquema.test.ts`, `model.test.ts` | `vitest` |
| engine, dourados | números fixos calculados à mão, com comentário da conta | `packages/engine/src/slabGolden.test.ts` (área 12, volume 2,04) | `vitest` |
| engine, propriedade | sementes determinísticas (mulberry32), COUNT = 30 casos por semente | `packages/engine/src/slabProperty.test.ts`, `property.test.ts` (60 sementes com `VITE_FULL=1`) | `vitest`, `npm run test:completo` |
| engine, arquivo real | projeto de usuário (`fixtures/casa-2-quartos.hestia.json`) | `packages/engine/src/fixtures.test.ts` | `vitest` |
| tools | ferramenta com `makeEnv`, `clickAt`, `P`, `tool` (de `testEnv.ts`) | `packages/tools/src/slabTool.test.ts`, `slabEdit.test.ts`, `slabSlope.test.ts` | `vitest` |
| render 3D | volume da malha = volume dos quantitativos | `packages/render/src/model3d/solids.test.ts` (laje inclinada com furo), `roofSolids.test.ts` | `vitest` |
| render 2D | `PlanDrawList` esperado | `packages/render/src/plan/slabs.test.ts`, `roofs.test.ts`, `floors.test.ts` | `vitest` |
| io | DXF por camada | `packages/io/src/dxfSlabs.test.ts`, `dxfRoofs.test.ts` | `vitest` |
| web | ações de editor | `apps/web/src/editor/slabActions.test.ts`, `typeActions.test.ts`, `dxfExport.test.ts`, `transfer.test.ts` | `vitest` |
| ponta a ponta | Playwright no app compilado, `window.__hestia` (`apps/web/src/main.tsx:10`) | `tests/e2e/lajes.mjs`, `telhados.mjs`, `telhados-formas.mjs` | `npm run build` antes; Chromium em `/opt/pw-browsers` |
| regressão visual | captura PNG de casos, comparação pixel a pixel | `tests/e2e/visual-regression.mjs`: `CASES`, `FLOOR_CASES`, `SLAB_CASES`, `ROOF_CASES`; baseline em `tests/e2e/baseline/*.png` | `node tests/e2e/visual-regression.mjs [--update]` |
| desempenho | limites relativos, fora do `npm test` | `*perf.test.ts`, `vitest.perf.config.ts` | `npm run test:perf` |

- `vitest.config.ts`: inclui `packages/*/src/**/*.test.ts`, `apps/*/src/**/*.test.ts`, `tests/**/*.test.ts`.
  Exclui `*perf.test.ts`. Setup em `tests/vitestSetup.ts`.
- Teste de laje e de telhado por caso (`slabGolden`, `roofGolden`) cobre migração ida e volta
  (`migrateProject(JSON.parse(JSON.stringify(p)))`).

### 9.2 Scripts de verificação

- `scripts/check-parity.mjs` (roda em `npm run lint`, então no CI): lê `docs/paridade/ORDEM.json`; para cada elemento,
  mede o arquivo `docs/paridade/<arquivo>.md` pelas linhas que casam `/^- \[[ x-]\] /`. Percentual = (feitos + fora de
  escopo) / total. Falha se um elemento aberto tem o anterior abaixo de 95 % ou com bloqueante pendente, ou se um
  elemento marcado `concluido` não cumpre a regra.
  Estado atual (`node scripts/check-parity.mjs --report`): paredes 100 %, pisos 100 %, lajes 100 %, telhados 98 % (1
  pendente bloqueante, A5), escadas e ambientes sem checklist.
- `scripts/check-boundaries.mjs` (também no `lint`): dependências só descem. `geom` não importa ninguém; `model` só `geom`;
  `engine` `geom` e `model`; `tools` `geom`, `model`, `engine`; `render` mais `tools`; `io` só `model`; `web` tudo. Núcleo
  (`geom`, `model`, `engine`) não pode importar `react`, `three`, nem usar `document.` ou `window.`.
- `eslint.config.js`: `max-lines: 420` (sem linhas vazias e comentários) em `packages/*/src` e `apps/*/src`. Testes ficam fora.
- `scripts/completo.mjs`: suíte com 60 sementes (~8 min). `scripts/test-esquadria.mjs`: diagnóstico rápido.

### 9.3 O que `docs/paridade/escadas.md` precisa conter

Mesmo formato de `docs/paridade/lajes.md` e `telhados.md`:

1. Cabeçalho com a legenda (`[x]`, `[ ]`, `[-]` com motivo na própria linha) e a regra de bloqueante.
2. Fonte: `docs/05` (Revit: Stair by Component e Stair by Sketch; ArchiCAD: Stair) e a decisão `docs/decisoes/0011-escadas.md`.
3. Seções com letra, por exemplo: A Geometria (trajetória, croqui, patamar, degraus iguais), B Tipos e camadas,
   C Relação com níveis e lajes (recorte derivado, topo no nível), D Vistas (planta, 3D, corte), E Quantitativos (tabela,
   CSV, DXF), F Edição (selecionar, mover, copiar, colar alinhado, mesmo tipo, Ribbon, atalho), G Qualidade (validação,
   Blondel como aviso, "Ir para", dourados, propriedade, migração v11→v12 e ida e volta, regressão visual).
4. Itens `(bloqueante)` mínimos: criar por trajetória, criar por croqui, recorte na laje do nível acima, 3D, planta, corte,
   tabela com CSV, migração e ida e volta, casos dourados de volume e área, aviso de Blondel.
5. Pendência de produto: o item `docs/05` §7.1 (5) diz que patamar automático e corrimão contínuo não foram confirmados
   nas regras de dimensionamento. Marcar como `[ ]` com "decisão pendente" e não como `[-]` sem decisão.
6. Status em `ORDEM.json` só sai de `nao-iniciado` depois que telhados estiver `concluido`.

---

## 10. PONTOS DE ATENÇÃO E DÍVIDAS QUE AFETAM ESCADAS

**Limite de tamanho (ESLint 420, não 400).** Medido sem linhas vazias e comentários:
`selectTool.ts` 418, `controller.ts` 408, `resolve.ts` 382, `ViewportCanvas.tsx` 372, `transformTools.ts` 364,
`section.ts` 342, `commands.ts` 330, `Properties.tsx` 313. Adicionar alças de escada em `selectTool.ts` quebra o lint.
`docs/01` §9 fala em "~400"; o código aplica 420.

**Dívida de duplicação por tipo de elemento.** Cada família nova copia um bloco:
- alças: `floorGripAt`, `slabGripAt`, `roofGripAt` (idênticas);
- painel: `FloorProperties`, `SlabProperties`, `RoofProperties`;
- diálogo de tipo: `FloorTypeDialog`, `SlabTypeDialog`, `RoofTypeDialog` (~170 linhas cada);
- diálogo de tabela: `FloorScheduleDialog`, `SlabScheduleDialog`, `RoofScheduleDialog`;
- ações de tipo: `typeActions.ts`, `slabTypeActions.ts`, `roofTypeActions.ts`;
- `TypeRow.tsx` com cadeias de ternário por `kind`; `levelOfElement`; `transfer.describe`; `Properties` com ramos por tipo.

Recomendação: extrair um helper de "elemento com contorno" antes da escada, ou ao menos um diálogo de tipo genérico.
Escada seria a quarta cópia.

**Documentação prometida e não implementada.** `docs/02` §2 (furo automático para escada e poço, no piso) e §6 (abertura
na laje do nível acima). `docs/06` não classifica escada (regra 10). `docs/03` lista "escada" no grupo Construir sem
ferramenta.

**Booleanas e desempenho.** O histórico registra que `polygon-clipping` entrou em laço com coordenadas transladadas (P-1 em
`docs/08` §4): ~10 s por tentativa, 339 s na semente 24. Correção: `clipReturn` usa `differenceClipper` direto
(`packages/geom/src/boolean.ts`) e memoização. Recorte de escada com muitos degraus usa operações desse tipo. Usar o caminho
Clipper e testar com coordenadas transladadas.

**`resolveLevel` recalcula tudo.** `resolveLevel` (`engine/resolve.ts:347`) chama `resolveAllFloors`, `resolveAllSlabs` e
`resolveAllRoofs` (linhas 352 a 354) a cada chamada, para todos os níveis. A cache do controller
(`controller.resolved`, por nível e por objeto de projeto) amortiza. Escada precisa entrar no mesmo ponto e não criar
custo novo por nível.

**Níveis.** `deleteLevel` (`commands.ts:311`) só checa parede, piso, laje e telhado. Sem a escada na lista, excluir o nível
deixa a escada órfã. `hasLevel` e `levelOfElement` também precisam da escada.

**Tipos de ferramenta.** `TOOL_GROUPS` não é usado (`Ribbon.tsx` faz `void TOOL_GROUPS`). `ToolOptions` novos devem ser
opcionais (`testEnv.ts`).

**Ícone.** Chave `stairs` existe, mas `ToolButton` usa o id da ferramenta. Usar `stair` ou ajustar o mapa.

**Inclinação máxima.** `validateSlabs.ts` aceita até 100 % (45°); `tools/slabSlope.ts` `SLOPE_LIMIT = 100`; telhado
`ROOF_SLOPE_LIMIT = 200` (`roofGeom.ts`). Lance de 30° a 40° (≈ 58 % a 84 %) cabe na laje, mas o limite de 100 % precisa
ser conferido para escada.

**Ordem de trabalho.** `docs/paridade/ORDEM.json` (regra de `docs/04` §"Regra de passagem") diz que escadas abre depois
de telhados. A pendência A5 é o bloqueio real.

---

## Proposta de arquitetura mínima para escadas

Princípios: a escada guarda decisões (trajetória ou limites, direção, largura, tipo, níveis); degraus, recorte e quantidades
são derivados (`docs/01` §4). Módulos novos ficam pequenos (menos de 400 linhas efetivas).

**Pacotes e módulos novos**
- `model`: `stair.ts` (`makeStair`, `DEFAULT_STAIR_TYPES`); `stairGeometry.ts` (função pura: degraus como prismas e
  projeção em planta, usada pela validação e pelo engine); `validateStairs.ts` (erros de geometria, aviso de Blondel,
  aviso de nível de topo sem laje ou piso); `levelAbove` em `queries.ts` (nível de cima por cota).
- `engine`: `stairs.ts` (`resolveStairs`, `resolveAllStairs`); `stairOpenings.ts` (projeção das escadas do nível de cima,
  usada por `resolveSlabs` e `resolveFloors`); `stairQuantities.ts`; `stairSchedule.ts`; `sectionStairs.ts` (ramo de corte).
- `tools`: `stairTool.ts` (modos `run` e `sketch`); `stairPick.ts` (`pickStairAt`, `stairIdsInBox`, `stairGripAt`).
- `render`: `plan/stairs.ts` (preenchimento, linhas de degrau, seta de subida); `model3d/stairSolids.ts` (`buildStairSolids`
  com `extrudePolygon`).
- `io`: campo `stairs?` em `DxfLevelGeometry` e função de camada.
- `apps/web`: `StairOptionsBar.tsx`, `StairProperties.tsx`, `StairTypeDialog.tsx`, `StairScheduleDialog.tsx`; fiação em
  `Ribbon`, `Icon` (`stair`), `state` (`DialogKind`, `DEFAULT_OPTIONS`), `OptionsBar`, `Properties`, `App`, `Browser`,
  `TypeRow`, `typeActions`, `issuesView`, `transfer`, `dxfExport`.
- `docs`: `paridade/escadas.md`, `decisoes/0011-escadas.md`; `ORDEM.json` só depois de telhados `concluido`.

**Ordem de implementação (etapas pequenas e testáveis)**
0. Pré-requisitos: fechar telhados A5 (ou `[-]` com motivo pelo dono) e extrair as alças de `selectTool.ts` para ficar
   abaixo de 420 linhas. Decidir: recorte derivado; modos `run` e `sketch`; Blondel como aviso; `topLevelId` por cota.
1. Modelo puro: `Stair`, `StairType`, `makeStair`, `stairGeometry` (degraus, projeção), migração 11 → 12. Testes unitários.
2. Comandos e modelo: `addStair`, `upsertStairType`, `deleteStairType`, transformação, guarda de `deleteLevel`,
   `hasLevel`, rótulos de histórico. Testes de comando e de migração ida e volta.
3. Validação: `validateStairs.ts` e ligação em `validateProject`. Testes por código.
4. Engine: `resolveStairs` com casos dourados (volume = área × espessura, número de espelhos, cotas de topo e base).
   Quantitativos e tabela. Testes de propriedade.
5. Recorte: `stairOpenings` em `resolveSlabs` e `resolveFloors`; trocar `holes` cru por helper comum em DXF, pick e
   propriedades. Testes com e sem escada.
6. 3D: `buildStairSolids` e ligação em `ModelScene.update`. Teste de volume da malha contra quantitativos.
7. Planta: `plan/stairs.ts` e ligação em `buildPlanDrawList`; subpavimento (`belowStairs`). Teste de `PlanDrawList`.
8. Corte: `sectionStairs.ts` e `stairId` em `SectionBeyond`. Teste com linha de corte.
9. Ferramenta `run`: `stairTool.ts`, `StairOptionsBar`, botão na Ribbon, atalho livre. Testes de máquina de estados
   (clique, Enter com medida digitada, Esc em dois passos).
10. Ferramenta `sketch`: contorno e seta de direção no padrão de `RoofArrowTool`; alças via `stairPick`. Testes.
11. UI e fiação: `StairProperties`, `StairTypeDialog`, `StairScheduleDialog`, navegador, "Ir para", DXF.
12. Ponta a ponta `tests/e2e/escadas.mjs`, casos em `visual-regression.mjs` com baseline, `docs/paridade/escadas.md` com
    95 % e bloqueantes feitos, `docs/decisoes/0011-escadas.md`.
