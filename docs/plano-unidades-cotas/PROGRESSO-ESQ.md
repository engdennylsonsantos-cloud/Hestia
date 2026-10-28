# Progresso do agente ESQ (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): 5 testes falham só por timeout do ambiente (openingCatalogo "low/mid/high", shortcutConfig ×2, worker projetoUmaVez, worker servidor); os demais passam.

- [x] S1 batente = espessura acabada (`05`)
- [x] S2 prévia com a esquadria real
- [x] S3 Espaço/Tab redesenham  → **S2 e S3 integrados = marco M4**
- **MARCO M4 LIBERADO cdcd096a** (S2 e S3 integrados)
- [x] S4 alças de inversão (não reproduzido no navegador; ver nota)
- [x] S5 planta do modal
- [x] C4 `packages/tools` (`03`; só depois do marco M2; respeite os arquivos reservados)
- [ ] C6 `packages/render` e `packages/io`
- [ ] D10.1 parede (`04`; só depois do marco M5)
- [ ] D10.2 linha e perímetro
- [ ] D10.3 eixos
- [ ] D10.4 piso/laje/telhado/forro
- [ ] D10.5 mover/copiar
- [ ] `npm run check` verde, integrado

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

## Bloqueios e pedidos a outros agentes
_(nenhum)_
