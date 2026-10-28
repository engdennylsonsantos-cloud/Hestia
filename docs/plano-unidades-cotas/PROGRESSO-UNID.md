# Progresso do agente UNID (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): verde — 525 arquivos de teste, 6163 testes, lint/typecheck/test ok (executado em 2026-10-28 antes de qualquer alteração).

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
- [ ] C5 model e engine (`Dimension.unit 'project'`) — PARCIAL: `dimension.ts`, avisos de `model`/`engine` e áreas; faltam quadros/CSV (C6/ESQ) e `stairIssues`/`stairSketchValidate`
- [ ] C7 fecho (só depois que a ESQ integrar C4 e C6)
- [ ] `npm run check` verde, integrado

## Desvios
- C5 (parcial): `dimensionText`/`formatDimension` recebem `units` opcional (padrão `defaultUnits()`); `Dimension.unit` ganhou `'project'`; `formatDimensionValue` idem. Avisos de `validate*` e de `engine/*Issues` usam `unitsOf(p)`; helpers sem projeto recebem `units` opcional. Áreas minúsculas (`fmtArea`) continuam em cm² para não zerar.
- C5: CSV (`csv.ts`, `*ScheduleToCsv`, cabeçalhos `(m²)/(m³)`) e os quantitativos que só têm comentários com unidade ficam para o C6 (ESQ) / C7, conforme a divisão do 03.
- PEDIDO ESQ: `packages/tools/src/dimensionTool.ts` ainda grava `unit`/`precision` fixos ao criar cota (linhas ~161/207/223); remover em C4/C6 para a cota seguir o projeto.
- PEDIDO ESQ: `packages/engine/src/stairIssues.ts` e `stairSketchValidate.ts` ainda usam `toFixed` em mensagens de norma do croqui; migrar com `units` ao passar pelo C6.
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
- `npm run check` completo verde em 2026-10-28: 549 arquivos, 6415 testes, lint (inclui `check-units`) e typecheck ok.

## Bloqueios e pedidos a outros agentes
_(nenhum)_
