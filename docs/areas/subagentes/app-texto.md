# Texto nas plantas: propriedades, exclusão e caixa de texto

Data: 2026-10-29 · Subagente da UI (anotações/texto)

## O que mudou

- `apps/web/src/ui/AnnotationProps.tsx`
  - `selectedNote(p, levelId, ids, planId?)`: com `planId` procura só em
    `planAnnotationsOf(areaPlanOf(p, planId))` (cotas, textos, linhas/regiões de detalhe e
    etiquetas); sem ele, no nível, como antes.
  - `comPlanoDaVista(comando, planId)` acrescenta `planId` ao comando quando a anotação é da
    planta de área. Todas as edições (`updateDimension`, `updateText`, `updateDetailLine`,
    `updateDetailRegion`, `updateTag`) passam por ele.
  - Grupo **Texto**: conteúdo em `textarea` (aceita `\n`), altura, largura da caixa (vazia =
    sem quebra), rotação, moldura (`frame`), alinhamento, negrito/itálico/sublinhado, posição
    X/Y e **Centralizar no ponto** (leva a caixa ao centro da vista ativa). Tudo em comandos
    (um passo de desfazer cada).
  - `updateTextIn(store, levelId, id, patch, planId?)` exportado para testar o destino da
    edição sem DOM.
- `apps/web/src/ui/Properties.tsx`: deriva `planId` de `planKind === 'area' ? areaPlanId : null`
  e passa a `selectedNote` e `AnnotationProps`. Na planta de área o painel acha cota/texto da
  vista; na de piso continua no nível.
- `apps/web/src/ui/dialogs/TextDialog.tsx` (novo): diálogo **Caixa de texto** com conteúdo
  multilinha, altura, largura, moldura, rotação, alinhamento e estilos. A ação pura
  `comandoCaixaDeTexto(escopo, centro, entrada)` cria o `TextNote` com `frame`/`width` e
  `planId` quando a vista é a planta de área; `centroDaVista` usa o centro do viewport (ou a
  caixa do nível, sem viewport). O aberto/fechado fica num store próprio do arquivo, para não
  alargar `DialogKind` em `editor/state.ts` (fora da área desta frente).
- `apps/web/src/ui/PlacementProperties.tsx`: com a ferramenta **Texto** ativa, o painel ganhou o
  botão **Caixa de texto…**.
- `apps/web/src/App.tsx`: monta `<TextDialog />` e segura as teclas globais enquanto ele está
  aberto.
- `apps/web/src/ui/PlanLabels.tsx`: textos de anotação usam `whiteSpace: pre-wrap` (o `\n` do
  modelo vira linha); a caixa do culling conta as linhas. Como o render ainda não emite
  `frame` no `LabelOp`, a camada DOM desenha a borda da moldura como fallback. O texto
  selecionado ganhou destaque (contorno) e uma **alça visual** no ponto de ancoragem; o
  arraste continua sendo o da ferramenta Selecionar (que já move o texto pela alça, com
  captura e prévia, inclusive na planta de área).
- `apps/web/src/editor/deleteIds.ts`: já removia `plan.annotations` na planta de área e mantinha
  o modelo bloqueado; **nenhum ajuste foi necessário** — o comportamento ficou coberto por
  teste (anotação some, parede permanece, Ctrl+Z volta).

## Como abrir a caixa de texto

1. Abra a planta (piso ou de área).
2. Aba **Anotar** → **Texto** (ou atalho da ferramenta Texto).
3. No painel de Propriedades, em **Colocação · Texto**, clique **Caixa de texto…**.
4. Preencha e clique **Criar texto**: a caixa nasce no centro da vista ativa e já fica
   selecionada. Na planta de área vai para `plan.annotations`; na de piso, para o nível.

Também é possível ajustar largura/quebra, moldura, posição e estilos depois, selecionando o
texto (painel **Texto**).

## Testes

Novos/estendidos:

- `apps/web/src/ui/AnnotationProps.test.ts` — `selectedNote` acha cota/texto da planta com
  `planId` e não vaza para o nível; editar texto da planta grava em `plan.annotations`;
  excluir na planta remove a anotação e mantém a parede (com desfazer).
- `apps/web/src/ui/TextDialog.test.ts` — ação pura cria `TextNote` com `frame`/`width`/`\n` e
  `planId` correto (planta de área) ou sem `planId` (nível); execução grava em
  `plan.annotations`; centro da vista com e sem viewport.

Comando usado:

```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run apps/web/src/ui/AnnotationProps.test.ts apps/web/src/ui/TextDialog.test.ts apps/web/src/ui/PlanLabels.test.ts apps/web/src/editor/areaPlanAnotacao.test.ts
npx vitest run apps/web/src/ui apps/web/src/editor
```

Resultado: `tsc` sem erros e ESLint sem avisos nos arquivos alterados. Na suíte ampla
(`ui` + `editor`, excluindo `editor/shortcutConfig.test.ts`) passam 94 arquivos/829 testes.
O `shortcutConfig.test.ts` estoura o timeout de 5 s sob carga paralela (11 testes), mas passa
sozinho (11/11). Os testes novos e os vizinhos de anotação passam isolados.

Fora da área: `packages/model`, `packages/tools` e `packages/render` não foram alterados.
