# Progresso do agente UNID (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): verde — 525 arquivos de teste, 6163 testes, lint/typecheck/test ok (executado em 2026-10-28 antes de qualquer alteração).

- [x] U0 inventário (`01`)
- [x] U1 tipos, padrões e formatação
- [x] U2 leitura de texto digitado
- [x] U3 `ProjectSettings.units`
- [x] U4 `parseQuantityText` (tools)
- [x] U5 hook `useUnits`
- [ ] U6 `NumField quantity`  → **INTEGRAR e avisar (marco M1)**
- [ ] U7 exportações independentes
- [ ] C0 trava `check-units` + base + script lint (`03`)  → **marco M2**
- [ ] B1–B4 diálogo Unidades (`02`)  → **marco M3**
- [ ] C1 painel de propriedades
- [ ] C2 diálogos
- [ ] C3 barras e chrome
- [ ] C5 model e engine (`Dimension.unit 'project'`)
- [ ] C7 fecho (só depois que a ESQ integrar C4 e C6)
- [ ] `npm run check` verde, integrado

## Desvios
- U0: o inventário existente estava com células vazias (padrões e caminhos apagados); regenerado com script temporário (não commitado) e removido do repositório.
- U1/U3: `unitsOf` começou com tipo estrutural mínimo e passou a `Pick<Project,'settings'>` quando U3 acrescentou `settings.units`.
- U1: valor de base (SI) da grandeza `angle` é o radiano (como no modelo); `slope` usa a razão (rise/run) — `slopePercent` do modelo é razão × 100, documentado no cabeçalho de `units.ts`.
## Bloqueios e pedidos a outros agentes
_(nenhum)_
