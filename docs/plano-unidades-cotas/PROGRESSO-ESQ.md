# Progresso do agente ESQ (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): 5 testes falham só por timeout do ambiente (openingCatalogo "low/mid/high", shortcutConfig ×2, worker projetoUmaVez, worker servidor); os demais passam.

- [x] S1 batente = espessura acabada (`05`)
- [x] S2 prévia com a esquadria real
- [x] S3 Espaço/Tab redesenham  → **S2 e S3 integrados = marco M4**
- **MARCO M4 LIBERADO cdcd096a** (S2 e S3 integrados)
- [x] S4 alças de inversão (não reproduzido no navegador; ver nota)
- [x] S5 planta do modal
- [x] C4 `packages/tools` (`03`; só depois do marco M2; respeite os arquivos reservados)
- [x] C6 `packages/render` e `packages/io`
- [x] D10.1 parede (`04`; só depois do marco M5)
- [x] D10.2 linha e perímetro
- [x] D10.3 eixos
- [x] D10.4 piso/laje/telhado/forro (cotas de leitura)
- [x] D10.5 mover/copiar
- [x] `npm run check`: lint/tsc/fronteiras/unidades ok; 558 arquivos, 6466/6467 testes. Única falha: snapshot `packages/render/src/plan/__snapshots__/sketch.test.ts.snap` (espera "30 %" e o formato canônico agora é "30%"); NÃO atualizei/commitei o snapshot por instrução do orquestrador — o COTAS regrava na F1.

## S1 — o que cada modo calcula (3 linhas)
- `wall` (padrão): `D` = espessura TOTAL do tipo de parede (`totalThickness`, todas as camadas com revestimentos) e `Cd` = 0, o plano médio da parede.
- `core`: `D` = faixa do núcleo (`coreSpan`, do primeiro ao último layer estrutural) e `Cd` = centro dessa faixa; parede de uma camada tem núcleo = total.
- `fixed`: `D` = `frameDepth` do tipo (padrão 0,09) limitado à espessura total e `Cd` parte do centro do núcleo, ajustado para caber entre as faces; `aduela` usa sempre o núcleo inteiro.


## S2 — desempenho e cache
- Prévia monta o modelo uma vez por (tipo, parede, espessura, inversões, detalhe) e guarda os traços LOCAIS; cada movimento só converte para o mundo com o quadro do vão (equivale à translação ao longo da parede e vale para parede curva).
- Medido numa porta composta (`ot_pbalcao_band120`, 103 peças): sem cache 1,15 ms; com cache 0,006 ms por movimento (limites do plano: < 8 ms e < 1 ms).

## Desvios
- S1: padrão de `frameDepthMode` passou de `'core'` para `'wall'` na leitura (`openingStyle`, contexto do modelo, composição e normalização) e no catálogo de composições e no "Novo tipo".
- S1: a porta de vidro blindex tem `frameStyle: 'block'` (sem batente por definição); o teste novo usa a porta-balcão `ot_pbalcao120` (madeira e vidro, com batente) como "porta de vidro".
- S1: `ouroZoom.json` foi regenerado (78 entradas) porque a planta agora desenha o batente cobrindo a espessura inteira (mudança intencional do S1); entradas sem aberturas ficaram idênticas.
- S1: testes antigos de "padrão core" foram atualizados para o novo padrão `wall`; os que testam o modo `core` passaram a declará-lo explicitamente.

- S3: `lastPointer` guardado em `move`; `tab()` e `space()`/`flipHandToggle()` reexecutam `move(lastPointer)` quando há ponteiro. Em `apps/web/src/editor/controller.ts` o Espaço da porta/janela passou a chamar `tool.space()` e `bump()` (o Tab já chamava `bump()`), então o repintar usa o mesmo gancho existente.
- S2: a conversão local→mundo virou `openingPlanPathsAt`/`openingPlanWorldPaths` no engine; a planta (`render/src/plan/symbols.ts`) passou a delegar para a MESMA função (nada de cópia).
- S2: `symbolPreviewItems` apagada; a prévia usa o modelo único. O parâmetro `openingLine` do plano não existe nas opções da planta (é convenção de elevação/corte), então `openingPreviewStrokes` recebe só o detalhe.

## S4 — reprodução no navegador (não reproduzido)
- Passos: dev server (`npm run dev -w @hestia/web -- --port 5199`), Chromium do `playwright-core` (não há o pacote `playwright`; usei `CHROME_PATH`), projeto inicial, Selecionar, clique na porta `to_1` e clique nas alças do canvas (`.canvas-wrap button[aria-label="Inverter dobradiça"]` e `"Inverter sentido"`).
- Resultado: `flipHand` false→true e `flipFacing` false→true no store; o canvas mudou em ambos os cliques (screenshot do canvas diferente); as duas alças mudaram de posição. Nada a corrigir.
- Testes de unidade de `nextOpeningFlip` e `openingGripPlacements` já cobrem os patches e a posição; o ambiente de teste é `node` (sem DOM), então não há teste de componente de clique — a fiação é um único `store.exec({type:'updateElements'})` e foi verificada no navegador.

## S5 — planta do modal (não reproduzido; atributo de teste)
- `previewPlanDrawList(ot_p90)` já continha batente (papel `jamb`), folha (`leaf`) e arco (`swing`), e o SVG os desenhava (12 traços + 3 preenchimentos); abri o diálogo real (dev server + Chromium, aba Planta) e a captura mostra parede hachurada, batente, folha aberta e arco. O defeito relatado não se repete no código atual (o S1 também deixou o batente faceado visível).
- Para o teste exigido pelo plano, `StrokeOp` ganhou `role` opcional e `drawListToSvg` emite `data-role` nos traços do símbolo (a parede continua sem papel). Testes novos em `previewViews.test.ts`: `ot_p90` (jamb/leaf/swing), `ot_pbalcao_band120` (jamb/leaf/glass) e `ot_jcomb_fa150x120` (jamb/mullion/glass).
- Nada de estilo/espessura/cor precisou mudar: `strokeColor` já resolve as cores de tema e o pipeline da planta usa a caixa do vão com 0,6 m de margem.

## C4 — tools migrados
- Todos os textos de `packages/tools` passam por `formatQuantity`/`unitsOf(project)` (comprimento, comprimento pequeno em cm, área, ângulo, inclinação) e as entradas de comprimento/ângulo por `parseQuantityText`. Helpers puros recebem `ResolvedUnits` (com `defaultUnits()` só como fallback de testes/chamadas antigas).
- `formatMeters` saiu; `fmtXY`, `fmtM`, `fmt`, `cm`/`mText`/`degText`, `areaText`, `fmtPercent`, `fmtM` das escadas etc. agora recebem as unidades do projeto.
- Ficam na linha de base (reservados ao COTAS, Fase E): `openingPlacement.ts` (1 ocorrência de `formatMeters`). Nada mais em `packages/tools` tem ocorrência.
- Teste com unidades não padrão: cota de 3 m vira `300,0 cm` em `medirFrenteG.test.ts`. `node scripts/units-baseline.json` reduzido com `--update`.

## C6 — render e io migrados
- Textos desenhados (áreas de piso/laje/forro/telhado/ambiente, elevações de telhado/seção, percentual de caimento, cotas de seleção e etiquetas de tipo) usam `formatQuantity` com `unitsOf(project)`; a assinatura de `fmtArea`/`fmtElevation`/`roomLabelText`/`outlineSelectionOps` recebeu as unidades e os chamadores passam o projeto.
- Formatos de máquina continuam em `toFixed`: DXF (coordenadas/notas), IFC e PDF levam `// units-ok: ... (formato de máquina)`. Nenhuma ocorrência sobra em render/io.
- `ouroZoom.json` regenerado (69 entradas) porque etiquetas/cotas desenhadas mudaram de texto por causa das unidades; a geometria não mudou. Goldens de imagem/e2e (`tests/e2e/baseline*`) não foram regravados — seriam afetados nas etiquetas.
- Teste com unidades não padrão: etiqueta de ambiente em ft² (`rooms.test.ts`).


## D10 — provedores implementados e pendências
- D10.1 parede: `dims/providers/wall.ts` mede o comprimento (edita a extremidade b via `resizeWallCommands` + `hostedConflicts`) e a distância perpendicular às paralelas vizinhas entre os planos de `wallRef` (edita transladando a parede; hospedados acompanham). Registrado para a seleção; `wallTool.tempDims()` mostra o comprimento do segmento em desenho. Falta só a distância à paralela na PRÉVIA da ferramenta (a seleção já a mostra).
- D10.4 contorno: `dims/providers/outline.ts` cota cada lado de piso/laje/forro/telhado (somente leitura, porque `outlineEdit.ts` não tem operação pura de comprimento); registrado para os quatro tipos.
- D10.5 deslocamento: `dims/providers/displacement.ts` mede ponto-base→cursor; `MoveTool.tempDims()` usa o provedor (Copiar herda).
- D10.2 linha/perímetro: `dims/providers/line.ts` traz a linha de detalhe (cota do nível, editável por `updateDetailLine`) e o trecho do rascunho do Perímetro (só leitura; a digitação segue no fluxo de `PerimeterTool.type`). `DetailLineTool.tempDims()` cota o traço em desenho; `PerimeterTool.tempDims()` cota as linhas selecionadas ou o lado em desenho (via `subjectDims` em `perimeterToolDims.ts`). Registrado para `'detailLine'` e `'perimeterLine'` (M6 do COTAS).
- D10.3 eixos: `dims/providers/grid.ts` mede a distância às grades paralelas retas mais próximas de cada lado (eixos) e translada a grade editando os pontos por `updateGrid`. Grades em arco ficam sem cota (a corda não é o eixo); o registro usa `selectionSubject` do sujeito `'grid'` do M6.
- Verificação no navegador (dev server 5199 + Chromium via `playwright-core`, `?debug=1`): linha de detalhe criada/selecionada mostrou "3" e, ao digitar 5, o fim foi para x=5; grade g1 entre g2/g3 mostrou "2" e "1,5"; rascunho de perímetro com 2 linhas selecionadas mostrou "4" e "3". Sem erros de página (só o 404 do favicon).
- PENDENTES: escadas, ambientes e seções (decisão do dono, como o plano pede). O PEDIDO do `dimensionTool.ts` foi atendido pelo COTAS no M6; restou só o registro dos três tipos acima no `dims/registry.ts` (linhas de registro acrescentadas).

## Ajustes de integração (fora do D10, causados pelo merge das unidades)
- `fmtPercent` da planta (C6, feito) passou a usar `formatQuantity`: o formato canônico é "30%" (sem espaço), como em `unitsFormat.test`. Atualizei as expectativas inline de `roofs.test.ts`, `roofSymbols.test.ts` e `sketch.test.ts` e regravei `ouroZoom.json` (87 entradas, CRLF preservado).
- `OpeningScheduleDialog.test.ts` (arquivo da UNID, ajuste mínimo de expectativa): a folga inferior agora sai na unidade pequena do projeto ("0,7 cm", não "7 mm"). Registro como desvio para a UNID revisar.
- Snapshot `sketch.test.ts.snap`: não atualizado/commitado por instrução; a divergência é só o espaço de "30 %" → "30%".
- PEDIDO COTAS: `dims/registry.ts` recebeu só as linhas de registro dos provedores ESQ (wall/floor/slab/ceiling/roof); se o COTAS preferir registrar em outro lugar, é só mover essas linhas.
- Escadas, ambientes e seções: não implementados (pendente de decisão do dono, como o plano pede).

## Bloqueios e pedidos a outros agentes
_(nenhum)_
