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
- [ ] B5 atalho `UN` abre o diálogo Unidades… (`02`, B5; pedido do dono)
- **MARCO M3 LIBERADO 6ad01c82** (`DialogKind` units, `UnitsDialog`/`unitsDialogModel` e botão em Padrões do projeto)
- [ ] C1 painel de propriedades
- [ ] C2 diálogos
- [ ] C3 barras e chrome
- [ ] C5 model e engine (`Dimension.unit 'project'`)
- [ ] C7 fecho (só depois que a ESQ integrar C4 e C6)
- [ ] `npm run check` verde, integrado

## Desvios
- U0: o inventário existente estava com células vazias (padrões e caminhos apagados); regenerado com script temporário (não commitado) e removido do repositório.
- U1/U3: `unitsOf` começou com tipo estrutural mínimo e passou a `Pick<Project,'settings'>` quando U3 acrescentou `settings.units`.
- B4: sem testing-library/jsdom no repositório, os fluxos de OK/Cancelar/Esc são cobertos pelos testes puros do rascunho + comando `setSettings`/undo e por render estático do diálogo; a conferência visual no navegador fica pendente.
- C0: a linha de base tem 543 linhas em 191 arquivos (contagem por linha, não por ocorrência). O teste de fixtures roda em `tests/check-units.test.ts` porque o vitest não inclui `scripts/`; o teste importa `scanText` do `.mjs` (declaração em `scripts/check-units.d.mts`).
- U6 (`npm run check` completo): a suíte inteira passou em lint/typecheck e 6369 testes; 6 testes de `shortcutConfig.test.ts` estouraram 5 s por contenção do paralelismo e passam isolados (11/11 em 15,5 s). Reexecutar o `check` no fim da fase.
- U1: valor de base (SI) da grandeza `angle` é o radiano (como no modelo); `slope` usa a razão (rise/run) — `slopePercent` do modelo é razão × 100, documentado no cabeçalho de `units.ts`.
## Bloqueios e pedidos a outros agentes
_(nenhum)_
