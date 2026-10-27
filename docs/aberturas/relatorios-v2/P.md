# Relatório · Tarefa P — planta das esquadrias a partir do modelo único

## O que foi feito

- Criada `packages/engine/src/openingPlan.ts` com a função pura `openingPlanPaths(model, opts)`, em coordenadas
  locais do vão `(t, s)`, com os níveis `low`, `mid` e `high` da spec E §4.1.
  - `low`: linha da folha fechada (porta) e três linhas do caixilho (janela), sem arco.
  - `mid`: perfis de batente/caixilho cortados com `slicePartsAtZ` na cota de corte; folha de giro desenhada como
    retângulo com espessura (via `partTransformed`), aberta em `angle`; arco do fecho centrado na dobradiça, com raio
    igual ao comprimento da folha. Janela de correr com folhas fechadas nas pistas, trilhos e seta; maxim-ar com arco
    tracejado do lado de `flipFacing`; basculante com V.
  - `high` (e `planDisplay = 'projected'`): acrescenta a folha fechada, alizar, peitoril saliente, verga/contraverga
    (acima/abaixo do corte, tracejadas) e o vidro duplo (duas linhas finas).
  - Vão livre continua com as duas linhas tracejadas nas faces da parede, sem X.
- `packages/render/src/plan/symbols.ts` passou a montar `StrokeOp` a partir de `openingPlanPaths`; o desenho local é
  levado ao mundo pela geometria da abertura. `openingSymbol` recebe o modelo único, o detalhe e a convenção.
- `packages/render/src/plan/view.ts` passa modelo, detalhe e convenção para o símbolo; `projection-above` continua
  tracejado e `projection-below`/`beyond` continuam leves.
- `packages/render/src/plan/build.ts` monta o modelo único por abertura e escolhe o detalhe efetivo. A escolha por
  zoom entra em `limiares` (1 px = 0,012 m e 1 px = 0,004 m), então o quadro só refaz a geometria ao cruzar um
  limiar, preservando a arquitetura de zoom do `PlanFrame`.
- `apps/web/src/editor/dxfExport.ts` passou a usar `openingPlanWorldPaths` no nível `mid`, nas mesmas camadas
  `ABERTURAS`/`ABERTURA_*`; o desenho da planta e o do DXF são o mesmo.
- `packages/geom/src/openingSymbol.ts` foi mantido: ainda há chamadores em `packages/tools/src/openingPlacement.ts` e
  testes do 3D. Não foi removido nem migrado fora do escopo.

## Arquivos tocados

- `packages/engine/src/openingPlan.ts` (novo)
- `packages/engine/src/openingPlan.test.ts` (novo)
- `packages/engine/src/index.ts`
- `packages/render/src/plan/symbols.ts`
- `packages/render/src/plan/symbols.test.ts`
- `packages/render/src/plan/view.ts`
- `packages/render/src/plan/build.ts`
- `packages/render/src/index.ts`
- `packages/render/src/plan/ouroZoom.json` (referência regravada)
- `apps/web/src/editor/dxfExport.ts`
- `apps/web/src/editor/dxfExport.test.ts`
- `RELATORIO.md` (este arquivo)

## Testes

Novos/atualizados:

- `packages/engine/src/openingPlan.test.ts` (12 testes): folha 0,822 × 0,04, ombreiras/batedores nas posições do
  modelo, arco de raio 0,822 em `t = −0,411`, espelhos de `flipHand`/`flipFacing`, `low` sem arco, `high` com folha
  fechada/alizar/peitoril, ausência de interseção da folha fechada com batente, `angle2d = 45°`, `showSwing`,
  `swingStyle`, janela de correr (duas pistas + seta), fixa (três linhas + vidro) e maxim-ar (arco tracejado do lado
  de `flipFacing`).
- `packages/render/src/plan/symbols.test.ts`: reescrito para o novo desenho (contagens por nível, folha com espessura,
  `detail off`, `scale` por zoom, projeção tracejada/leve, vão livre e famílias diferentes).
- `apps/web/src/editor/dxfExport.test.ts`: os testes que comparavam o DXF ao `openingSymbolPaths` antigo passaram a
  comparar ao desenho do modelo único; novo teste confere que a folha sai como retângulo fechado de espessura 0,04.
- `packages/render/src/plan/ouroZoom.json`: referência regravada porque o desenho das aberturas mudou de propósito
  (o teste de ouro continua comparando a lista canônica em 12, 60 e 220 px/m).

Comandos executados (todos verdes):

- `npx vitest run packages/render/src/plan packages/engine/src/openingPlan.test.ts packages/engine/src/openingModel.test.ts apps/web/src/editor/dxfExport.test.ts packages/io/src/dxf.test.ts` — 47 arquivos, 651 testes.
- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `node scripts/check-boundaries.mjs` — “fronteiras ok”.

Não foram rodados `property.test.ts` nem `*perf.test.ts`, conforme o COMMON.

## Decisões e divergências da spec

- **`cutZ` de `openingPlanPaths` é local ao modelo** (0 = soleira), e não a cota absoluta da vista. Quem chama desconta
  a base da parede (`f.z.z0`) e a soleira; para projeções fora do corte, usa o meio do modelo. Isso não estava explícito
  na assinatura do prompt, mas evita misturar cotas absolutas com o `z` local do modelo.
- **Detalhe por zoom**: a spec pede `low/mid/high` pela escala/zoom. Implementei em `openingDetailByZoom`, com limiares
  em 1 px = 0,012 m e 1 px = 0,004 m. Na planta, os limiares são registrados em `Limiares`, então a geometria só é
  refeita ao cruzar um deles; entre limiares a lista é estável. Isso preserva os testes de zoom existentes.
- **`planDisplay = 'projected'` força `high`**, conforme a leitura de “high (e planDisplay = 'projected')”.
- **Janela de correr no `mid`**: as folhas aparecem como retângulos fechados nas pistas, com trilhos e seta; as três
  linhas do caixilho continuam sendo desenhadas. No `high`, o vidro duplo acrescenta duas linhas finas.
- **Maxim-ar/basculante** usam o símbolo da família (arco parabólico tracejado / V) em vez de projetar a folha girada
  no plano; é o que a spec chama de arco/V conforme a família.
- **Pivotante** desenha dois arcos (banda curta e banda longa), como o símbolo antigo; a dupla desenha um arco por
  folha.
- **`openingSymbolPaths` (geom)** não foi removido: ainda há chamadores fora do escopo (ferramenta de colocação e
  testes do 3D). A planta e o DXF deixaram de usá-lo.
- **Teste de ouro do zoom** (`ouroZoom.json`) foi regravado; é um teste que verificava o desenho antigo e por isso
  contradiz a spec nova. Nenhum teste foi apagado.

## Pendências honestas

- A projeção “real” de maxim-ar/basculante no plano (folha inclinada vista de cima) não foi modelada; o desenho é
  simbólico (arco/V), como na convenção da família.
- O `high` desenha alizar/peitoril/verga como pegadas retangulares no plano; não há hachura nem recorte fino dessas
  peças fora do vão.
- A folha de janela com `leafStyle`/divisões é representada pela caixa da folha no `high`; os montantes internos
  continuam vindo dos `muntin` do modelo quando cortados.
- Não houve mudança em corte, elevação, 3D, ferramentas ou diálogo.
