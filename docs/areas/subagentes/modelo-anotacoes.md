# Anotações por vista (planta de área)

Data: 2026-10-29 · Subagente de modelo/ferramentas

## O que mudou

- `packages/model/src/annotations.ts`
  - Os comandos `addDimension`, `updateDimension`, `removeDimension`, `addText`, `updateText`,
    `removeText`, `addDetailLine`, `updateDetailLine`, `removeDetailLine`, `addDetailRegion`,
    `updateDetailRegion`, `removeDetailRegion`, `addTag`, `updateTag` e `removeTag` aceitam
    `planId?: Id`.
  - `applyAnnotationCommand` resolve a vista: com `planId`, valida a planta (existe e é do mesmo
    nível do comando) e lê/escreve em `plan.annotations` reatribuindo o conjunto
    (`plan.annotations = { ...planAnnotationsOf(plan), <família>: novoArray }`), sem mutar o array
    atual. Sem `planId`, o comportamento no nível continua idêntico.
  - `annotationRemovals(p, levelId, ids, planId?)` inclui as anotações da planta quando `planId`
    é dado.
  - Nova `annotationIdsInView(p, levelId, planId?)`: ids de todas as anotações da vista (nível e,
    com `planId`, também `planAnnotationIds(plan)`). `annotationIdsIn` segue filtrando só o nível.
- `packages/model/src/areaPlan.ts`: novo helper `copyPlanAnnotations(a)` (cópia dos arrays e
  pontos), usado pelo `addAreaPlan`.
- `packages/model/src/areaPlanCommands.ts`: `addAreaPlan` copia as anotações recebidas; novo
  `prunePlanElementTags(p)` remove etiquetas de elemento cujo `hostId` não existe mais.
- `packages/model/src/commands.ts`: `deleteElements` e `splitWall` chamam
  `prunePlanElementTags`.
- `packages/model/src/validate.ts`: `areaPlanProblems` avisa (`warning`,
  `code: 'area-plan-tag-host-missing'`) quando uma etiqueta anotada numa planta aponta para um
  elemento inexistente. Não altera o projeto nem recusa arquivos antigos.
- `packages/tools/src/types.ts`: `ToolEnv.areaPlanId?(): Id | null`.
- `packages/tools/src/base.ts`: helper `viewPlanId(env)` → `env.areaPlanId?.() ?? undefined`.
- Ferramentas `dimensionTool`, `textTool`, `tagTool`, `detailLineTool` e `detailRegionTool` passam
  `planId: viewPlanId(env)` nos comandos de criação.
- `packages/tools/src/testEnv.ts`: `makeEnv` ganhou `areaPlanId` controlável
  (`ctx.setAreaPlanId(id | null)`, `ctx.areaPlanId()`).

## API exata

```ts
// Comandos (forma preservada; planId é opcional)
{ type: 'addDimension'; levelId: Id; planId?: Id; dimension: Dimension }
{ type: 'updateDimension'; levelId: Id; planId?: Id; id: Id; patch: Partial<Omit<Dimension, 'id'>> }
{ type: 'removeDimension'; levelId: Id; planId?: Id; id: Id }
// idem para add/update/remove de Text, DetailLine, DetailRegion e Tag

// ToolEnv
areaPlanId?(): Id | null;

// Modelo
annotationIdsInView(p: Pick<Project, 'levels' | 'areaPlans'>, levelId: Id, planId?: Id): Id[];
annotationRemovals(p: Pick<Project, 'levels' | 'areaPlans'>, levelId: Id, ids: Id[], planId?: Id): RemoveAnnotation[];
copyPlanAnnotations(a: AreaPlanAnnotations): AreaPlanAnnotations;
prunePlanElementTags(p: Project): void;
```

Regras: com `planId`, a planta precisa existir (`Planta de área inexistente`) e ser do nível do
comando (`A planta de área não pertence ao nível da anotação`). O conjunto é sempre reatribuído;
nenhum array de `plan.annotations` ou do nível é mutado no lugar.

## Testes

Arquivos novos:

- `packages/model/src/planAnnotations.test.ts` — grava com/sem `planId`, atualiza/remove na planta,
  independência entre duas plantas do mesmo nível, `planAnnotationIds`, `annotationIdsInView`,
  `annotationRemovals` com `planId`, limpeza ao apagar elemento e aviso de etiqueta órfã.
- `packages/tools/src/planAnnotations.test.ts` — cota, texto, linha/região de detalhe e etiqueta
  pelas ferramentas com `areaPlanId` (e sem, no nível).

Comando usado:

```bash
npx vitest run packages/model/src/planAnnotations.test.ts packages/model/src/annotations.test.ts packages/model/src/areaPlan.test.ts packages/tools/src/planAnnotations.test.ts packages/tools/src/dimensionTool.test.ts
```

Resultado: 5 arquivos, 47 testes, todos passando. `npx tsc -p tsconfig.json --noEmit` não acusa
erros em `packages/model` nem em `packages/tools` (restam apenas erros em andamento de outros
subagentes em `packages/render` e `apps/web`).

Observação: o ESLint acusa `max-lines` em `packages/model/src/commands.ts` (437 linhas; limite 420).
O excesso vem dos comandos de planta de área/etiqueta de ambiente que já estavam no arquivo quando
esta tarefa começou (o HEAD tinha 419 linhas); esta tarefa só acrescentou as duas chamadas de
`prunePlanElementTags`. O arquivo não foi reorganizado para não conflitar com o outro subagente.
