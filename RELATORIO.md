# RELATÓRIO · Tarefa BA — janela basculante e bandeira de janela

Data: 2026-10-26 · branch `feat/esq-BA`.

## O que foi feito

1. **Basculante (`tilt`) — modelo único**
   - `openingStyle.ts`: novo leitor `openingTiltAxis(t)` (padrão 0,5; limitado a 0,2..0,8) e `openingAngle3d` agora limita o `tilt` a 60°.
   - `openingModelWindows.ts`: a basculante usa eixo horizontal em `z = J + tiltAxis·(H − 2J)`,
     `rotate axis 't'` com `sign = −side` (a metade superior vai para `side`, a inferior para o oposto),
     `LeafOpening.kind = 'tilt'` e `axisZ`. A moldura de folha + vidro fica com folga (`gap`) nos quatro lados do vão interno.
   - Maxim-ar (`casement`) mantida como era (eixo no topo, `kind 'top'`).
2. **Linhas de abertura (`openingLines.ts`)**: `kind 'tilt'` gera dois V com vértice no centro do eixo — um com pontas nos
   cantos superiores e outro nos inferiores. O V superior usa o tracejado da convenção (`side === viewSide`) e o inferior o
   traço contrário. `apex` não se aplica ao eixo do tilt (o vértice é o próprio eixo).
3. **Planta da basculante (`openingPlan.ts`)**: substituído o V antigo por uma linha inclinada em torno do centro, com o
   `angle2d` (padrão 30°), sem arco, mantendo as três linhas do caixilho.
4. **Bandeira de janela (`transom`)**
   - Nova `windowLayout` (`openingModelWindowsNew.ts`) é a única fonte da faixa interna: reserva a bandeira (altura limitada a
     40% de `H`), a travessa do caixilho com largura `J` e entrega às famílias só a parte de baixo.
   - `buildWindowTransom` (`openingModelDetails.ts`) desenha a travessa e o vidro fixo da bandeira; `fixed === false` vira uma
     folha maxim-ar pequena (`kind 'top'`), com ids próprios.
   - Aplicável a fixa, de abrir, maxim-ar, correr, basculante e pivotante. Guilhotina, veneziana e vão livre ignoram a opção
     (modelo idêntico ao sem bandeira).
   - Bandeiras laterais (`sidelights`) em janela só valem na janela fixa; nas demais são ignoradas (o vão não é estreitado).
5. **Bug “metade da janela some”**
   - Causa: o topo da janela era calculado em dois lugares independentes — `windowInner` reservava `transom.height + 0,04` e
     `buildTransom` desenhava barra/faixa com a mesma conta. Quando a bandeira ocupava quase toda a altura útil, a região das
     folhas ficava sem altura positiva e cada peça era descartada por `validBox`; a folha/vidro inferior simplesmente
     desaparecia (e guilhotina/veneziana ainda recebiam bandeira sem suporte).
   - Correção: uma única `windowLayout` reserva a faixa (com limite de 40% e guarda de altura), e todas as famílias leem dela.
     Teste de regressão usa bandeira a 95% da altura e prova que a folha continua inteira e o vão continua coberto.
6. **Catálogo**: acrescentado `ot_jb80` (J-11, 80 × 50, peitoril 1,70, `plan 'tilt'`, alumínio). Catálogo passou de 23 para 24 tipos.

## Arquivos tocados

Produção:
- `packages/model/src/openingStyle.ts`
- `packages/model/src/defaults.ts`
- `packages/engine/src/openingModelWindowsNew.ts`
- `packages/engine/src/openingModelWindows.ts`
- `packages/engine/src/openingModelDetails.ts`
- `packages/engine/src/openingLines.ts`
- `packages/engine/src/openingPlan.ts`

Testes:
- `packages/model/src/openingStyle.test.ts`
- `packages/engine/src/openingModel.test.ts`
- `packages/engine/src/openingModelWindowsBA.test.ts` (novo)
- `packages/engine/src/openingLines.test.ts`
- `packages/engine/src/openingPlan.test.ts`
- `packages/engine/src/openingCatalogo.test.ts`
- `packages/model/src/templateEsquadrias.test.ts`
- `packages/render/src/section/build.test.ts`
- `packages/render/src/model3d/openingParts.test.ts`
- `apps/web/src/ui/dialogs/openingType/previewViews.test.ts`

## Testes

Comandos executados (Git Bash, raiz da worktree):

- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `node scripts/check-boundaries.mjs` — `fronteiras ok`.
- `npx vitest run packages/engine packages/model packages/render --exclude "**/property.test.ts" --exclude "**/*perf.test.ts" --exclude "**/property*.test.ts"`
  — **258 arquivos, 3315 testes, todos verdes** (sem os testes lentos de propriedade/perf).
- `npx vitest run apps/web/src/ui/dialogs/openingType/previewViews.test.ts` — 10 testes verdes.

Cobertura nova em `openingModelWindowsBA.test.ts` (28 testes):
- basculante `ot_jb80` × `tiltAxis` 0,3/0,5/0,7 × 4 flips: eixo em `z`, metades opostas a 30°, `kind 'tilt'`/`axisZ`;
- varredura de 0 a 60° a cada 5° (4 flips): nenhuma interseção de volume folha × caixilho (SAT em `s`×`z`, com o `t` invariante);
- cobertura da elevação (`projectParts` eixo `'s'`) para fixa, de abrir 1 e 2, maxim-ar, correr 2/3/4, basculante e pivotante,
  com bandeira de 0,3 m ligada e desligada × 4 flips: nenhum ponto do vão descoberto (amostragem de 1 cm, tolerância 0,01 m),
  nenhuma peça fora do vão e nenhum volume em comum entre caixilho × folha × vidro × bandeira;
- `transom.fixed = false` vira maxim-ar (`kind 'top'`), ids únicos e cobertura;
- guilhotina/veneziana com bandeira: modelo idêntico ao sem bandeira;
- bandeira lateral ignorada nas janelas não fixas;
- regressão da bandeira alta que sumia com a folha.

## Testes antigos atualizados (e motivo)

- `packages/engine/src/openingModel.test.ts`: basculante antiga era `kind 'bottom'`, eixo na base. A spec E3 §7 muda para eixo
  horizontal central/excêntrico (`kind 'tilt'`); o teste passou a exigir `axisZ` central e `sign = −side`.
- `packages/engine/src/openingLines.test.ts`: a basculante tinha um V; agora são dois (metades superior e inferior), com
  tracejados contrários.
- `packages/render/src/section/build.test.ts`: o V único da basculante virou dois V com vértice no eixo (mesma mudança de spec).
- `packages/model/src/openingStyle.test.ts`: a altura da bandeira agora é limitada a 40% de `H` (antes ia até `H`);
  acrescentados os testes de `openingTiltAxis` e do teto de 60° no `angle3d`.
- Testes que contam o catálogo (23 → 24): `packages/engine/src/openingCatalogo.test.ts`,
  `packages/render/src/model3d/openingParts.test.ts`, `apps/web/src/ui/dialogs/openingType/previewViews.test.ts` e o título de
  `packages/model/src/templateEsquadrias.test.ts`.

## Decisões tomadas

- A travessa da bandeira de janela usa a largura do caixilho (`J`), como pede a spec E3 §7; a porta continua com a travessa de
  0,04 m de antes (não foi reimplementada a profundidade do batente de porta).
- A bandeira ocupa toda a largura interna (inclusive por cima das bandeiras laterais, quando existirem na janela fixa).
- A bandeira `fixed === false` usa um novo índice de folha calculado pelos ids existentes, para não colidir com o vidro fixo.
- Para a basculante com bandeira, o eixo é calculado sobre a altura útil restante (`z0 + tiltAxis·(z1 − z0)`), que coincide com
  `J + tiltAxis·(H − 2J)` quando não há bandeira.

## Pendências honestas / divergências

- `packages/geom/src/openingSymbol.ts` (símbolo legado usado pelo DXF) ainda desenha o V antigo da basculante; não estava na
  lista de arquivos permitidos e não foi alterado. A planta do modelo único (`openingPlan`) já está correta.
- O adaptador 3D (`openingParts.ts`) não precisou de mudança: ele já traduz `rotate axis 't'` para o eixo `x` da cena e usa
  `motion.sign`, então a basculante abre corretamente sem código novo.
- `packages/render/src/plan/__snapshots__/sketch.test.ts.snap` chegou a aparecer como modificado apenas por estatística
  (o `git diff` era vazio); foi refrescado no índice sem mudança de conteúdo.
- Os baselines visuais (`tests/e2e/baseline*`) que incluam esquadrias precisam ser regravados no ambiente de referência; não
  foram rodados aqui.
