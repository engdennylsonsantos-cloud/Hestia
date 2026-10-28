# Progresso do agente UNID (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): verde — 525 arquivos de teste, 6163 testes, lint/typecheck/test ok (executado em 2026-10-28 antes de qualquer alteração).

Fecho (C7): `npm run check` verde — 560 arquivos, 6458 testes, lint (com `check-units` em 0) e typecheck ok.

- [x] U0 inventário (`01`)
- [x] U1 tipos, padrões e formatação
- [x] U2 leitura de texto digitado
- [x] U3 `ProjectSettings.units`
- [x] U4 `parseQuantityText` (tools)
- [x] U5 hook `useUnits`
- [x] U6 `NumField quantity`  → **INTEGRAR e avisar (marco M1)**
- **MARCO M1 LIBERADO 5926d8af** (Fase A até U6 integrada: `formatQuantity`, `parseQuantity`, `useUnits`/`useFormat`, `NumField quantity`)
- [x] U7 exportações independentes
- [x] C0 trava `check-units` + base + script lint (`03`)  → **marco M2**
- **MARCO M2 LIBERADO 680bd5aa** (`scripts/check-units.mjs`, `scripts/units-baseline.json` e `machineNumber`)
- [x] B1–B4 diálogo Unidades (`02`)  → **marco M3**
- [x] B5 atalho `UN` abre o diálogo Unidades… (`02`, B5; pedido do dono)
- **MARCO M3 LIBERADO 6ad01c82** (`DialogKind` units, `UnitsDialog`/`unitsDialogModel` e botão em Padrões do projeto)
- [x] C1 painel de propriedades
- [x] C2 diálogos
- [x] C3 barras e chrome
- [x] C5 model e engine (`Dimension.unit 'project'`) — `dimension.ts`, avisos de `model`/`engine`, áreas, `stairIssues`/`stairSketchValidate` e CSV dos quadros; só comentários/`units-ok` restantes para o C7
- [x] C7 fecho (props deprecadas removidas, `check-units` em 0, decisão 0038)
- [x] `npm run check` verde, integrado

## Desvios
- C5: `dimensionText`/`formatDimension` recebem `units` opcional (padrão `defaultUnits()`); `Dimension.unit` ganhou `'project'`; `formatDimensionValue` idem. Avisos de `validate*` e de `engine/*Issues` usam `unitsOf(p)`; helpers sem projeto recebem `units` opcional. Áreas minúsculas (`fmtArea`) continuam em cm² para não zerar. `stairNormIssues`/`spiralNormIssues` e `validateRunSketch` recebem as unidades (mensagens seguem o projeto; teste em cm).
- C5: os `*ScheduleToCsv` (engine) passaram a receber `ResolvedUnits` e usam `scheduleCsvCell`/`scheduleCsvHeader` (novo `scheduleCsv.ts` + teste); os diálogos passam `units`. Comentários com `m²/m³` foram reescritos em palavras (sem mudar dados SI); espessuras nos CSV ficam em `smallLength` (cm por padrão) e a inclinação em `slope`.
- PEDIDO ESQ: `packages/tools/src/dimensionTool.ts` ainda grava `unit`/`precision` fixos ao criar cota (linhas ~161/207/223); remover em C4/C6 para a cota seguir o projeto.
- C3: inclui também `*Props`/`*Row` vizinhos (AnnotationProps, GraphicsProps, RoofPlanesProps, RoofMansardProps, ProfileRow, RoofProfileRow, GridProperties, LevelField); ângulos convertem graus↔radianos na borda, medidas em mm do modelo convertem para metros no campo. Coordenadas de `viewcube*` e a matriz CSS receberam `units-ok` (formato de máquina).
- C2: quadros usam o helper `scheduleUnits.ts` (cabeçalho com o símbolo do projeto e célula convertida); os rótulos de `i18nTabelas.ts` perderam o sufixo fixo `(m)/(m²)/(m³)/(%)`. Campos cuja unidade nativa não é SI (grade em mm, margem de folha em mm, inclinação em %) passaram a converter na borda. Unidades técnicas fixas (W/m²K) e transparência (%) ficaram com `units-ok`.
- U0: o inventário existente estava com células vazias (padrões e caminhos apagados); regenerado com script temporário (não commitado) e removido do repositório.
- U1/U3: `unitsOf` começou com tipo estrutural mínimo e passou a `Pick<Project,'settings'>` quando U3 acrescentou `settings.units`.
- B4: sem testing-library/jsdom no repositório, os fluxos de OK/Cancelar/Esc são cobertos pelos testes puros do rascunho + comando `setSettings`/undo e por render estático do diálogo; a conferência visual no navegador fica pendente.
- C0: a linha de base começou com 543 linhas em 191 arquivos; após o C1 está em 183 arquivos (PlacementProperties e openingType ficam com os donos). (contagem por linha, não por ocorrência). O teste de fixtures roda em `tests/check-units.test.ts` porque o vitest não inclui `scripts/`; o teste importa `scanText` do `.mjs` (declaração em `scripts/check-units.d.mts`).
- U6 (`npm run check` completo): a suíte inteira passou em lint/typecheck e 6369 testes; 6 testes de `shortcutConfig.test.ts` estouraram 5 s por contenção do paralelismo e passam isolados (11/11 em 15,5 s). Reexecutar o `check` no fim da fase.
- U1: valor de base (SI) da grandeza `angle` é o radiano (como no modelo); `slope` usa a razão (rise/run) — `slopePercent` do modelo é razão × 100, documentado no cabeçalho de `units.ts`.
## Estado ao encerrar este turno
- Concluídos e integrados: U0–U7, C0 (M2), B1–B4 (M3), C1, B5, C2 e C3. C5 está parcial (dimension + avisos); C7 só depois de ESQ C4/C6.
- `npm run check` completo verde em 2026-10-28: 555 arquivos, 6439 testes, lint (inclui `check-units`) e typecheck ok.

## C7 — fecho
- `NumField` perdeu `unit` e `scale`; `decimals` ficou para **número puro** (contagem, razão, escala) e entrou `suffix` para unidade técnica fixa (%, dB, min, W/m²K). Ângulos de esquadria/texto/serpentina convertem graus↔radianos na borda; `textHeight` (mm no modelo) converte para metros no campo.
- Para zerar a trava sem linha de base, os usos restantes em `dialogs/openingType/**` (propriedade ESQ) e `PlacementProperties` foram migrados no mesmo passo, preservando o comportamento; `openingTypeActions`, `cmTexto`/`metrosTexto` e o rótulo de inclinação do `render` passaram a usar as unidades do projeto.
- `scripts/units-baseline.json` apagado; `node scripts/check-units.mjs` em **0 ocorrências** (só isenções `units-ok` de máquina/depuração/unidade técnica).
- `docs/decisoes/0038-unidades-do-projeto.md` escrita.
- Testes atualizados por mudança intencional de formato: espessuras de CSV em `smallLength` (cm), ferragens em cm, inclinação/rótulos em `formatQuantity`, ângulos em radianos no `NumField`.

## Bloqueios e pedidos a outros agentes
_(nenhum)_
