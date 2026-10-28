# Progresso do plano (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)

Linha de base antes de mexer (resultado de `npm run check`): _preencher_

## Fase A: unidades (`01-unidades.md`)
- [ ] U0 inventário
- [ ] U1 tipos, padrões e formatação
- [ ] U2 leitura de texto digitado
- [ ] U3 `ProjectSettings.units`
- [ ] U4 `parseQuantityText` (tools)
- [ ] U5 hook `useUnits`
- [ ] U6 `NumField quantity`
- [ ] U7 exportações independentes
- [ ] `npm run check` verde, push

## Fase B: diálogo Unidades (`02-padroes-do-projeto-ui.md`)
- [ ] B1 registrar diálogo e botão
- [ ] B2 conteúdo
- [ ] B3 lógica do rascunho
- [ ] B4 testes
- [ ] `npm run check` verde, push

## Fase C: migração (`03-migracao-dos-usos.md`)
- [ ] C0 trava `check-units` + linha de base + script lint
- [ ] C1 painel de propriedades
- [ ] C2 diálogos
- [ ] C3 barras e chrome
- [ ] C4 tools
- [ ] C5 model e engine (inclui `Dimension.unit 'project'`)
- [ ] C6 render e io
- [ ] C7 fecho (remover props antigas, decisão em docs/decisoes)
- [ ] `npm run check` verde, push

## Fase D: correções (`05-correcoes-e-batente.md`)
- [ ] S1 batente = espessura acabada (opção núcleo)
- [ ] S2 prévia com a esquadria real
- [ ] S3 Espaço/Tab redesenham
- [ ] S4 alças de inversão
- [ ] S5 planta do modal
- [ ] `npm run check` verde, push

## Fase E: cotas (`04-sistema-de-cotas.md`)
- [ ] D0 mapa
- [ ] D1 configuração no modelo
- [ ] D2 wallPlanes e openingExtents
- [ ] D3 resolvedores
- [ ] D4 provedor de esquadrias + registro + colocação
- [ ] D5 sobreposição única
- [ ] D6 validação de hospedados
- [ ] D7 alças trocam referência
- [ ] D8 permanentes + autoCotas
- [ ] D9 diálogo Cotas… + troca rápida
- [ ] D10.1 parede
- [ ] D10.2 linha e perímetro
- [ ] D10.3 eixos
- [ ] D10.4 piso/laje/telhado/forro
- [ ] D10.5 mover/copiar
- [ ] D11 documentação de reaproveitamento e decisão
- [ ] `npm run check` verde, push

## Fase F: validação (`06-validacao-final.md`)
- [ ] F1 suíte e build
- [ ] F2 navegador
- [ ] F3 revisão cruzada
- [ ] F4 documentação
- [ ] F5 entrega

## Desvios do plano
_(nenhum ainda)_

## Bloqueios
_(nenhum ainda)_

## Ações pendentes do dono
- Regravar baselines de imagem (`tests/e2e/baseline*`) se a regressão visual indicar diferença esperada.
