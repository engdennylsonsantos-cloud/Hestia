# Tarefa O · Colocação de portas e janelas (estilo Revit)

Melhore a ferramenta de colocação (`packages/tools/src/openingTool.ts`) como descrito abaixo. Leia também: `packages/tools/src/infer.ts` (`hostUnder`, `occupiedRanges`), `packages/tools/src/types.ts` (`PreviewItem`, `ToolOptions`, `StairTone`), `packages/tools/src/openingSnap.test.ts` e `testEnv.ts` (padrão de teste com `makeEnv`, `drawWall`, `tool`), `packages/render/src/plan/overlay.ts` (como as pré-visualizações são desenhadas), `packages/geom/src/openingSymbol.ts` (`openingSymbolPaths`, o símbolo atual), `packages/engine/src/frame.ts` e `resolve.ts` (`frameOfWall`, `openingGeometry`), `apps/web/src/ui/PlacementProperties.tsx`, `apps/web/src/ui/OptionsBar.tsx`, `apps/web/src/editor/state.ts` (valores padrão de `options`).

## Arquivos permitidos
`packages/tools/src/openingTool.ts` (e novos `openingPlacement.ts` e testes `*.test.ts` ao lado), `packages/tools/src/types.ts` (só campos novos de `ToolOptions` e, se faltar, um `tone` de pré-visualização inválida), `packages/render/src/plan/overlay.ts` (só se precisar desenhar o novo tom), `apps/web/src/ui/PlacementProperties.tsx`, `apps/web/src/ui/OptionsBar.tsx`, `apps/web/src/editor/state.ts` (só os padrões das opções novas). NÃO edite `apps/web/src/editor/controller.ts` (tem alterações de outra pessoa).

## Comportamento
1. **Pré-visualização com o símbolo real**: ao passar o cursor sobre a parede, mostrar o símbolo da esquadria (use `openingSymbolPaths` com um `OpeningGeometry` montado por `openingGeometry` sobre uma abertura temporária) como itens `line` (tracejados para o que for tracejado), mais o retângulo do vão. Inválido (sem espaço) em tom de erro (vermelho). A pré-visualização antiga (retângulo azul) deixa de ser a única coisa.
2. **O lado do cursor define o sentido** (`flipFacing`): o sinal da distância assinada do cursor ao eixo da parede escolhe o lado. Com **histerese de 3 px** (`3 × metersPerPixel`) perto do eixo: dentro dessa faixa mantém o último lado. Opções novas em `ToolOptions` (todas opcionais, padrões abaixo, ausente = padrão): `openingFacingMode: 'cursor' | 'fixed'` (padrão `'cursor'`), `openingToward: 'cursor' | 'away'` (padrão `'cursor'`: a folha abre para o lado do cursor; `'away'` abre para o oposto). Com `'fixed'` o sentido é o de `openingFlipFacing`. **Tab** continua invertendo o sentido por cima do resultado; **Espaço** inverte a dobradiça (já existe, preserve).
3. **Zona de captura da parede maior que a espessura**: o cursor a até 16 px da face (não só dentro da espessura) já conta como sobre a parede (hoje `TOL_PX` em `hostUnder`; não mude `hostUnder` para os outros usos, aplique a tolerância maior só na abertura, ou parametrize).
4. **Âncora** `openingAnchor: 'center' | 'hinge' | 'latch'` (padrão `'center'`): o ponto do cursor é o centro, a ombreira da dobradiça ou a ombreira do trinco da abertura.
5. **Captura nova** (respeita `snap.enabled`): além das atuais, **centro do trecho** entre as paredes perpendiculares vizinhas (nota "centro do trecho"), **folga da quina** `openingClear` (padrão 0,10 m): a borda da abertura a essa distância da face da parede perpendicular (nota "a 10 cm da parede"), **eixo alinhado** com outra abertura. O trecho livre da abertura nunca atravessa parede perpendicular (a abertura fica entre as paredes que encostam na hospedeira; use as faces das perpendiculares).
6. **Cotas temporárias na pré-visualização** (itens `line` + `label`): do eixo da abertura ao eixo da parede perpendicular vizinha de cada lado (padrão), ou da borda da abertura à face (`openingDimMode: 'face'`; padrão `'axis'`), desenhadas ao longo da parede no lado do cursor, com valor em metros com vírgula (ex.: `2,26`).
7. A posição digitada (`type`) continua exata e passa pelas mesmas validações; mensagens da barra de status coerentes (diga o lado e a dobradiça: "dobradiça à esquerda · abre para este lado").
8. **Interface**: em `PlacementProperties` (grupo Colocação · Porta/Janela) adicione: Sentido (Pelo cursor | Manual), Abrir (para o lado do cursor | para o lado oposto), Âncora, Folga da quina (cm), Cotas (Do eixo | Da face do batente). Siga os componentes `Row`, `Check`, `NumField` já usados no arquivo. Atualize a dica de teclado da ferramenta (`hint`).

## Critérios de aceitação (testes em `openingTool.test.ts`, usando `testEnv.ts`)
- Cursor 0,10 m acima do eixo de uma parede horizontal → a porta inserida tem `flipFacing = false`; 0,10 m abaixo → `true` (e invertido com `openingToward: 'away'`); `fixed` ignora o cursor.
- Histerese: cursor a 1 px do eixo mantém o lado da posição anterior; a 4 px muda.
- Tab inverte o sentido calculado; Espaço inverte `flipHand`; ambos refletidos na abertura criada.
- Âncora `hinge` com dobradiça à esquerda coloca o centro a `+W/2` do cursor; `latch` o oposto.
- Captura "centro do trecho": parede de 5 m com perpendicular a 2 m, cursor perto do meio do trecho de 3 m → offset 3,5 (centro do trecho livre, descontadas as meias espessuras).
- "folga da quina": a borda da abertura fica a 0,10 m da face da parede perpendicular.
- A pré-visualização contém itens `line` do símbolo e 2 `label` de cota com os valores esperados (ex.: `2,26` e `2,24`).
- Posição inválida (abertura sobre outra) gera pré-visualização inválida e não insere ao clicar.
- Os testes existentes de abertura continuam verdes (atualize só o que a spec mudou e liste).

Não toque em planta, corte, 3D, modelo de dados nem no diálogo do tipo.
