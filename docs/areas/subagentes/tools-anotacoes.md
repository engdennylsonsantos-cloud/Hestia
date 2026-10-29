# Anotações da planta de área: seleção, alças e mover texto

Data: 2026-10-29 · Subagente de ferramentas (`packages/tools`)

## Problema

A planta de área guarda as cotas/textos/detalhes/etiquetas em `plan.annotations` (`planAnnotationsOf`), mas a
seleção só lia as anotações do nível. Por isso os textos e as cotas criados na planta apareciam (o render desenha as
da planta) e não eram selecionáveis nem arrastáveis.

## O que mudou

### `packages/tools/src/annotationPick.ts`

Novo leitor da vista, usado por todos os picks:

```ts
interface ViewAnnotations {
  scale: number;            // escala da vista (planta.scale, ou a do nível)
  dimensions: Dimension[];
  texts: TextNote[];
  detailLines: DetailLine[];
  detailRegions: DetailRegion[];
  tags: ElementTag[];
}

viewAnnotationsOf(p: Project, levelId: Id, planId?: Id): ViewAnnotations
```

Sem `planId` devolve o nível (`levelDimensions`, `levelTexts`, `level.detail*`, `level.tags`) — comportamento antigo
intacto. Com `planId` devolve `planAnnotationsOf(areaPlanOf(p, planId))`; as anotações do nível não vazam para a
planta (planta sem `annotations` = listas vazias). A escala usada no tamanho de papel dos textos/cotas é a da planta.

Assinaturas novas (o `planId` é sempre o último parâmetro opcional):

```ts
annotationAt(p, levelId, at, mpp, planId?): { id: Id; kind: 'dimension' | 'text' } | null
detailItemAt(p, levelId, at, mpp, planId?): Id | null
dimGripAt(p, levelId, sel, at, mpp, planId?): Id | null
dimTextGripAt(p, levelId, sel, at, mpp, planId?): Id | null
textGripAt(p, levelId, sel, at, mpp, planId?): Id | null
```

`textGripAt` é a alça quadrada que o render desenha na âncora do texto: devolve o id quando o cursor está a até 6 px
(`6 * mpp`) de `text.at` do texto selecionado (só com uma anotação selecionada).

### `packages/tools/src/selectTool.ts`

- `planId()` → `this.env.areaPlanId?.() ?? undefined`, passado a `detailItemAt`, `annotationAt`, `dimGripAt`,
  `dimTextGripAt` e `textGripAt` (hover e clique).
- **Prioridade**: detalhe > (na planta de área) anotação > modelo na planta de área; na planta de piso a ordem
  continua a de sempre (elemento ganha da anotação). A anotação precisa vir antes do modelo na planta porque texto e
  cota ficam sobre o ambiente/piso desenhado; sem isso continuariam inalcançáveis. Hover e seleção usam o mesmo
  `hitAt`/`annotationAt`.
- **Novo modo `textmove`**: pressionar a âncora de um texto selecionado e arrastar mostra a prévia (linha tracejada da
  âncora original até o destino + ponto) e, ao soltar, emite **um** `updateText` com o novo `at` — com `planId` quando
  a vista é planta de área (um passo de desfazer).
- `dimgrip`/`dimtext` (alça do meio da linha de cota e alça do texto da cota) leem a cota pela vista
  (`viewAnnotationsOf`) e emitem `updateDimension` com `planId` quando houver.
- As cotas da planta agora também são lidas no arraste (`dragDimGrip`) e na prévia do texto da cota.

Os comandos `updateDetailLine`, `updateDetailRegion` e `updateTag` não são emitidos por `selectTool` (o arraste de
detalhes/etiquetas é do `transformTools.ts`, fora desta área); a regra de `planId` para eles já vale nos comandos do
modelo.

## Testes

Novo `packages/tools/src/annotationPlanPick.test.ts` (8 testes):

- cota e texto em `plan.annotations` achados por `annotationAt` com `planId` e **não** sem;
- `textGripAt` acha a âncora do texto selecionado da planta (e não sem `planId`, nem longe, nem sem seleção);
- arrastar a âncora emite `updateText` com `planId: 'ap1'` e altera só a planta;
- arrastar a alça da cota emite `updateDimension` com `planId: 'ap1'` (offset muda, nível intacto);
- `dimTextGripAt` da cota da planta responde com `planId` e não sem;
- texto sobre o ambiente é selecionável na planta (anotação antes do modelo);
- sem planta: `annotationAt`/`textGripAt` leem o nível e o arrasto emite `updateText` **sem** `planId`; alça da cota
  do nível continua arrastando.

Comandos usados:

```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/tools/src
```

Resultado: `packages/tools/src` com 108 arquivos / 1067 testes, todos passando. `tsc` não acusa nada em
`packages/tools` (resta só um erro em andamento de outro subagente, `apps/web/src/ui/PlacementProperties.tsx`).
`npx eslint packages/tools/src/selectTool.ts packages/tools/src/annotationPick.ts packages/tools/src/annotationPlanPick.test.ts`
passa.
