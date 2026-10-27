# Tarefa M (parte B) · Prévias reais do diálogo do tipo

## O que foi feito

- **Projeto mínimo de prévia** (`previewProject.ts`): um nível, parede reta `wt_alv14` de comprimento
  `max(3,6; largura + 2,4)`, o tipo do rascunho no catálogo e a abertura no centro. Preserva todos os campos v2 do tipo,
  aplica `flipHand`/`flipFacing` na instância e usa o peitoril do tipo nas janelas. A altura da parede é a do editor
  (2,8 m) ou o necessário para o vão + peitoril caberem com folga.
- **Conversão para SVG** (`drawListToSvg.ts`): desenha a lista do projeto (preenchimentos, traços, hachuras e tracejados)
  em SVG puro, sem rótulos de texto, com enquadramento em metros e `data-op="fill"`/`"stroke"` para contagem. Traços usam
  variáveis de tema (`var(--fg)`, `var(--fg-soft)`, `var(--select)`…); preenchimentos de material mantêm a cor do material.
- **Planta, elevação e corte** (`previewViews.ts`): usam os pipelines reais `render/plan` e
  `engine/section` + `render/section`. Na planta, `detail2d` do tipo é respeitado e `'scale'` vira `'mid'`; o `angle2d`
  vem do controle. A elevação usa linha paralela à parede com observador no lado `+n`; o corte usa linha perpendicular
  no centro do vão. A convenção do V vem de `ProjectSettings.openingLine` do projeto real (o diálogo passa
  `openingLineConvention(p)`). O enquadramento é o vão com 0,5 m de margem.
- **3D** (`previewScene.ts` + `Preview3D.tsx`): a cena é montada pelo mesmo `ModelScene` do projeto sobre o projeto de
  prévia, com a parede e o furo do pipeline real (um sólido por camada, sem fatias), esquadria aberta em `angle3d`.
  Um único `WebGLRenderer` é criado quando o diálogo abre e descartado ao fechar; as abas "3D linhas" e "3D sombreado"
  usam `hiddenLine` e `shaded`. Arrastar orbita e a roda aproxima. Sem WebGL aparece "3D indisponível neste navegador" e
  as demais abas seguem funcionando.
- **Abas e controles** (`OpeningTypePreview.tsx`): as cinco abas ficam habilitadas; os botões de inverter dobradiça e
  sentido refazem a prévia; o ângulo alimenta `angle2d` (planta) e `angle3d` (3D). O redesenho da prévia grande tem
  debounce de 60 ms e as miniaturas usam `useDeferredValue`, para não segurar a digitação.
- **Miniaturas** (`OpeningTypeThumb.tsx`): elevação gerada pelo mesmo caminho (projeto mínimo + seção), com cache por
  assinatura visual do tipo. A biblioteca (`.th` das variantes) e as escolhas de estilo de folha/maçaneta mostram essas
  miniaturas. O `TypePreview` antigo de abertura saiu do diálogo; o arquivo permanece porque o seletor/paleta ainda o usa.

## Arquivos tocados

Novos em `apps/web/src/ui/dialogs/openingType/`:
- `previewProject.ts` / `previewProject.test.ts`
- `drawListToSvg.ts` / `drawListToSvg.test.ts`
- `previewViews.ts` / `previewViews.test.ts`
- `previewScene.ts` / `previewScene.test.ts`
- `Preview3D.tsx`
- `OpeningTypeThumb.tsx`

Editados:
- `OpeningTypePreview.tsx`
- `OpeningTypeLibrary.tsx`
- `OpeningTypeSections.tsx`
- `OpeningTypeDialog.tsx` (ligação de uma linha para passar o tipo à biblioteca e a convenção do V à prévia)
- `OpeningTypeDialog.test.ts`

Nenhum arquivo em `packages/` foi alterado.

## Testes

Comandos executados e verdes:
- `npx vitest run apps/web/src/ui` — 26 arquivos, 214 testes.
- `npx vitest run apps/web/src/ui/dialogs/openingType` — 6 arquivos, 47 testes.
- `npx tsc -p tsconfig.json --noEmit`
- `node scripts/check-boundaries.mjs`

Cobertura principal:
- `previewProject`: comprimento da parede, abertura hospedada no centro, catálogo, todos os campos v2, flips e peitoril.
- `drawListToSvg`: contagem de preenchimentos/traços, cores por variável de tema, ausência de texto e presença da folha
  e do arco da `ot_p90` em detalhe médio.
- `previewViews`: planta por ângulo, elevação por flips, convenção do V (`apex`/`dashed`), elevação e corte para as 19
  famílias de `OPENING_FAMILIES`, almofadas do estilo `panel` e cache das miniaturas.
- `previewScene`: cena sem canvas, malhas > 0, uma malha de parede por lote/camada e só a parede da prévia, estilos linhas
  e sombreado, ângulo mudando a cena e assinatura de peças mudando com `grid`/`casing`.
- `OpeningTypeDialog`: as cinco abas habilitadas, mensagem de 3D indisponível no render em string, miniaturas na
  biblioteca/seções e controles existentes.

## Testes existentes atualizados

- `OpeningTypeDialog.test.ts`: o caso "a prévia mostra as abas (só a elevação habilitada)" passou a exigir as cinco abas
  habilitadas; a expectativa de `disabled` foi removida porque a parte B habilita todas. Foram acrescentados os casos de
  mensagem sem WebGL e de miniaturas. Motivo: o comportamento antigo contradiz a tarefa.

## Decisões e divergências

- "3D linhas" usa `hiddenLine` (faces claras + arestas) e "3D sombreado" usa `shaded`; não foi usada biblioteca nova.
- O projeto de prévia não tem piso, laje ou telhado: só a parede e o vão, para a prévia ficar focada na esquadria.
- Para garantir o sólido único com furo, a cena da prévia usa `ModelScene({ instanciar: false })`, o caminho de geometria
  do projeto.
- O enquadramento da planta/elevação/corte é sempre o vão com 0,5 m; o SVG é recortado pela caixa, mas a lista de desenho
  completa continua sendo a do pipeline real.
- A ligação em `OpeningTypeDialog.tsx` é uma edição pontual fora da lista nominal de três arquivos (`OpeningTypePreview`,
  `Library`, `Sections`), necessária para a biblioteca receber o rascunho em edição e para a prévia usar a convenção do V
  do projeto. Foi mantida em uma linha por prop, sem mudar comportamento do diálogo.

## Pendências honestas

- O seletor de tipo e a lista da paleta continuam com o `TypePreview` antigo de abertura. A troca ficaria fora dos
  arquivos permitidos e mexe em componentes usados por outros tipos; ficou registrada como pendência, conforme a tarefa
  autoriza ("senão deixe como está e liste").
- O tema escuro não foi ligado à cena 3D da prévia (o `ModelScene` aceita `dark`; o diálogo não fornece o tema). O SVG
  acompanha o tema pelas variáveis CSS.
- Não há recuperação de perda de contexto WebGL na prévia; se o contexto cair, a aba 3D pode ficar sem desenho até
  reabrir o diálogo.
