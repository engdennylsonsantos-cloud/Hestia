# Correção da sobreposição de cotas (C03 a C07 do CACA-BUGS)

Reproduzido no navegador (Playwright, `house-premium` e projeto em branco) antes e depois. Capturas em `capturas/fix-overlay-*.png`.

## Regra geral de prioridade de alvos de clique
alça de vértice do elemento > alça de referência da cota > valor da cota > botão "I" > canvas.
- A alça de vértice vence por construção: ponta de cota com uma só referência não ganha alça (`viewOfDim`).
- Na prévia de uma ferramenta, só o que cobre a ponta viva da cota (o cursor) é do canvas (`capturesPointer`, em `dimsHit.ts`). Valor e "I" que não cobrem o cursor capturam e engolem o clique: nunca criam geometria.
- Passar o mouse sobre a cota não move o cursor da ferramenta (`onPointerMove` com `buttons === 0` não propaga). Antes, o evento chegava ao canvas, a cota (que segue o cursor) fugia do ponteiro e o clique caía no canvas.

## Por achado
- **C03**: as cotas de contorno (piso, laje, telhado, forro), linha e grade têm uma única referência. Ponta com `options.length < 2` não ganha alça. Antes: 8 de 8 alças sobre os vértices do piso e nenhum arraste; depois: 0 alças e o vértice (5,5;5,5) arrasta para (7,3;4). Alças da parede selecionada não cobrem os vértices da parede (conferido).
- **C04**: `placeConvertButton` (`dimsLayout.ts`, puro) põe o "I" à direita do primeiro valor e, se houver campo ou alça no lugar, tenta esquerda, acima e abaixo. Em trecho curto o "I" não cobre mais o valor: o clique no valor entra em edição e nenhuma cota permanente é criada.
- **C05**: regra acima. Prévia da parede: clicar no valor ou no "I" não cria parede; o "I" cria a cota permanente. Prévia da porta: `holdsLastPreview` mantém a última prévia enquanto o cursor sai da parede rumo ao valor ou ao "I" (a ferramenta zera a prévia ao sair do hospedeiro, e `openingTool.ts` não foi tocado). O "I" criou 2 cotas permanentes.
- **C06**: o campo somente leitura não toma o foco (`mousedown` com `preventDefault`) e o clique é engolido: o Mover não confirma, e digitar `2` + Enter move a parede em 2 m (antes encurtava a parede para 2 m).
- **C07**: `ViewportCanvas` incrementa `previewTick` quando `ensureViewport` devolve uma vista nova (tamanho mudou). Redimensionar 1440 para 1100: os campos andaram de x=673/877 para 503/707 (acompanham a porta).

## Arquivos
`apps/web/src/ui/dims/dimsHit.ts`, `dimsLayout.ts` (novo), `dimsView.ts`, `TempDimsOverlay.tsx`, `apps/web/src/ui/ViewportCanvas.tsx`, com testes `dimsHit.test.ts`, `dimsLayout.test.ts`, `dimsView.test.ts`. O 2º clique da parede segue em canvas (10 de 10 repetições de `tests/e2e/fix-clique-medir.mjs`).

## Limite conhecido
Na prévia da parede a cota segue o cursor (valor no meio do traço): só é alcançável pelo mouse em trechos curtos; o fluxo normal é digitar a medida.
