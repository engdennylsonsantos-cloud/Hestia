# Subagente App/Ferramentas — planta de área como vista de anotação

## O que mudou

- **Clique na planta de área**: a seleção de ambiente só acontece com a ferramenta `select`. Com Cota, Texto,
  Etiqueta, Linha/Região de detalhe ou Medir ativos, o clique vai para a ferramenta. O arraste de rótulo também só
  existe com `select`.
- **Anotações com `planId`**: `ToolEnv.areaPlanId()` devolve a planta ativa (`view === 'plan' && planKind === 'area'`).
  As ferramentas do pacote `tools` já emitem `planId`; o controlador completa o `planId` quando algum comando antigo
  chega sem ele. Nada de anotação vaza para o nível.
- **Cotas automáticas**: `editor.cotasAutomaticasDaPlanta` grava as cotas em `plan.annotations` da planta de área
  ativa (um passo de desfazer). Na planta de piso continua gravando no nível. O botão da aba Anotar e o novo botão
  do painel/OptionsBar abrem o mesmo diálogo e funcionam na planta de área.
- **Semear anotações**: `createAreaPlanAction` copia cotas, textos, linhas/regiões de detalhe e etiquetas do nível
  para `plan.annotations`, com ids novos. `openAreaPlan` faz o mesmo para plantas antigas sem `annotations`
  (um comando `updateAreaPlan`, um passo de desfazer).
- **Ferramentas**: na planta de área só ficam Selecionar, Medir, Cota, Texto, Etiqueta, Linha/Região de detalhe.
  `Editor.setTool` recusa as demais (inclusive por atalho) e a faixa as mostra desabilitadas. "Etiquetar todos"
  passa a completar etiquetas de ambiente da planta.
- **Painel da planta de área**: toggles de aberturas, eixos, marcas de corte, cotas, anotações do nível, piso/laje e
  subpavimento; botões "Cotas automáticas…" e "Copiar anotações do nível". Os toggles de eixos e marcas de corte
  usam as chaves opcionais `showGrids`/`showSectionMarks` em `graphics` até o contrato do modelo/render adotá-las.
- **Exclusão**: na planta de área o Delete remove apenas anotações da vista; o modelo continua bloqueado.
- **DXF**: `areaPlanDxf` usa `buildPlanGeometry` com a planta e acrescenta um fallback para cotas/textos/detalhes de
  `plan.annotations` que ainda não vierem nas operações do render (sem duplicar o que já foi desenhado).
- **Seleção**: `pruneSelection` mantém ids de anotações da planta de área.

## Arquivos

- `apps/web/src/editor/controller.ts`
- `apps/web/src/editor/areaPlanActions.ts`
- `apps/web/src/editor/dxfExport.ts`
- `apps/web/src/editor/deleteIds.ts`
- `apps/web/src/ui/AreaPlanProperties.tsx`
- `apps/web/src/ui/OptionsBar.tsx`
- `apps/web/src/ui/PlacementProperties.tsx`
- `apps/web/src/ui/ribbon/actions.ts`, `parts.tsx`, `useCtx.ts`
- Testes: `apps/web/src/editor/areaPlanAnotacao.test.ts` (novo), `areaPlanActions.test.ts`, `areaPlanDxf.test.ts`

`fileActions.ts` já encaminhava a exportação DXF da planta de área e não precisou mudar.

## Testes

```powershell
npx tsc -p tsconfig.json --noEmit
npx vitest run apps/web/src/editor/areaPlanActions.test.ts apps/web/src/editor/areaPlanAnotacao.test.ts apps/web/src/editor/areaPlanDxf.test.ts
```

Também rodei `npx vitest run apps/web/src/editor apps/web/src/ui/ribbon/ribbon.test.ts apps/web/src/ui/ribbon/perimeterFace.test.ts`
(60 arquivos, 577 testes) sem falhas.
