# Tarefa Rf · Dividir arquivos acima do limite de linhas (refatoração sem mudar comportamento)

`npm run lint` falha em 4 arquivos por `max-lines` (limite 420 linhas de código; o ESLint ignora linhas em branco e comentários, confira com `npx eslint <arquivo>`):

1. `packages/engine/src/openingModel.ts` (945): divida em módulos coesos, por exemplo `openingModelContext.ts` (contexto `makeCtx`, medidas e núcleo), `openingModelDoors.ts` (`buildDoor` e auxiliares de porta), `openingModelWindows.ts` (`buildWindow` e auxiliares de janela), `openingModelDetails.ts` (alizar, peitoril saliente, verga/contraverga, bandeiras), `openingModelTransforms.ts` (`partTransformed`, `foldPoint`, `slicePartsAtZ`, `projectParts`, tipos `OrientedBox`, `SliceRing`, `ProjectedRing`, `ModelPoint`). `openingModel.ts` fica com `buildOpeningModel`/`openingCore` e **reexporta** (`export * from`) tudo o que era público, de modo que nenhum import externo mude. Os arquivos `openingModelDoorsNew.ts` e `openingModelWindowsNew.ts` continuam como estão (se importavam de `openingModel.ts`, ajuste para os novos módulos para evitar ciclos).
2. `packages/engine/src/openingPlan.ts` (469): mova o desenho das famílias novas (`newDoorFamily`, `addNewDoorPlan` e auxiliares, e o das janelas novas se estiver aqui) para `openingPlanNew.ts`; `openingPlan.ts` importa de lá.
3. `packages/model/src/types.ts` (440): mova `OpeningType`, `Opening`, `OpeningLineConvention`, `OpeningLeafStyle`, `OpeningHandle`, `OpeningFrameStyle`, `PlanSymbol` e `OpeningLeaves` para um novo `packages/model/src/openingTypes.ts` (com `import type` de `Id`, `WrapMode` etc. de `./types.ts`) e **reexporte** de `types.ts` (`export type * from './openingTypes.ts'` ou `export * from`, o que o TypeScript do projeto aceitar) para que nenhum import externo mude. Cuidado com ciclos: só `import type`.
4. `apps/web/src/ui/ViewportCanvas.tsx` (424): tire a montagem das sobreposições de esquadria (alças e cotas temporárias, adicionadas pela tarefa O2) e outro bloco coeso qualquer para um componente novo `ViewportOverlays.tsx` (ou similar) até ficar em ≤ 420 com folga de pelo menos 10 linhas, sem mudar o que é renderizado nem a ordem na árvore.

## Regras
- **Zero mudança de comportamento**: só mover código e ajustar imports/exports. Nenhum teste existente pode ser alterado, exceto imports quebrados por causa da mudança de arquivo (liste cada um).
- Preserve os comentários dos blocos movidos.
- Não crie ciclos de importação (`madge` não existe; confira por inspeção e porque o vitest/tsc passam).
- Arquivos novos ≤ 420 linhas de código cada.

## Critérios de aceitação
- `npx eslint packages/engine/src packages/model/src apps/web/src/ui/ViewportCanvas.tsx` sem **erros** (avisos de hooks já existentes podem ficar).
- `npx tsc -p tsconfig.json --noEmit` limpo; `node scripts/check-boundaries.mjs` ok.
- Verdes, sem alteração de asserções: `npx vitest run packages/engine/src/opening packages/model/src packages/render/src/model3d packages/render/src/section packages/render/src/plan apps/web/src/ui`.
- Diff: nenhuma linha de lógica nova (o RELATORIO.md diz quais símbolos foram para onde).
