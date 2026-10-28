# Tarefa Q · Catálogo completo: todos os tipos pré-cadastrados funcionando em todas as vistas

Hoje há 23 tipos pré-cadastrados (`DEFAULT_OPENING_TYPES` em `packages/model/src/defaults.ts`) cobrindo as 19 famílias (10 antigas, 9 novas). Seu trabalho: provar, com testes automáticos, que **cada um** funciona em planta, corte, elevação, 3D e exportações, corrigir o que falhar, e entregar um projeto-mostruário para conferência visual.

Leia: spec E inteira, `packages/engine/src/openingModel.ts` (+ `openingModelDoorsNew.ts`, `openingModelWindowsNew.ts`), `openingPlan.ts`, `openingLines.ts`, `openingChecks.ts`, `packages/model/src/openingStyle.ts`, `packages/model/src/opening.ts`, `packages/render/src/model3d/openingParts.ts`, `packages/render/src/section/build.ts`, `packages/render/src/plan/symbols.ts`, `packages/io/src/ifc/ifcExport.ts`, `packages/model/src/templates.ts`, `packages/engine/src/openingSchedule.ts`.

## Arquivos permitidos
Novos: `packages/engine/src/openingCatalogo.test.ts`, `packages/render/src/openingCatalogoVistas.test.ts` (ou em `plan`/`section`/`model3d` conforme o que testa), `packages/model/src/templateEsquadrias.ts` (+ teste). Edições, **só para corrigir defeitos que os testes revelarem** e para os itens da lista abaixo: `packages/model/src/openingStyle.ts`, `packages/engine/src/openingChecks.ts`, `openingModel*.ts`, `openingPlan.ts`, `openingLines.ts`, `packages/render/src/model3d/openingParts.ts`, `packages/render/src/section/build.ts`, `packages/render/src/plan/symbols.ts`, `packages/io/src/ifc/ifcExport.ts`, `packages/model/src/templates.ts` (registrar o template novo) e os testes desses. Toda correção vem com teste que falha sem ela e entra no RELATORIO.md com a causa.

## 1 · Itens conhecidos
1. `openingStyle.ts`: padrão de `angle3d` por família: `louver` 45 (máximo 70), `bifold` 70, `accordion` 75, `hinged` e `pivotwin` 90, `pocket`/`garage`/`hung`/`sliding`: o ângulo não se aplica (devolva 90 sem efeito); `casement`/`tilt` 30 (já existe); `dblact` 90. `angle2d`: `bifold` 55, `hinged` 60, demais 90.
2. `openingChecks.ts`: ventilação útil das famílias novas: `hinged` 100%, `hung` 50%, `pivotwin` 90%, `louver` 70%; portas sem ventilação.
3. Template **"Mostruário de esquadrias"** (`id 'esquadrias'`): um nível, uma parede longa de 40 m com **todas** as 23 tipos lado a lado, as portas na parte de baixo da planta e as janelas em parede paralela acima, cada uma com 1,5 m de folga; metade com `flipHand`/`flipFacing` variados (documente o padrão no comentário). Registre em `TEMPLATES` (nome "Mostruário de esquadrias", descrição, área "—") e `buildTemplate`. Atualize os testes que contam templates e liste.

## 2 · Suíte de invariantes (loop sobre todos os tipos × os 4 `flipHand`/`flipFacing` × estados fechado/aberto)
- **Modelo**: ids únicos e estáveis, caixas válidas, tudo dentro do vão exceto `casing`/`sillBoard`/`lintel`/`sillBeam`/`pocket`/`track`; folhas fechadas sem volume comum com o batente; movimento aberto preserva o tamanho de cada peça e mantém a folha no lado `side` (giro), dentro do vão (correr/guilhotina/sanfonada) ou dentro da cavidade (embutir).
- **Planta** (`openingPlanPaths` em low/mid/high, e via `openingSymbol`): pontos finitos; nenhum traço com menos de 2 pontos; no `mid`/`high` da porta de giro/dupla/vai-e-vem/pivotante: o arco termina na posição fechada da folha e a extremidade aberta fica a `radius` da dobradiça; a folha fechada não cruza o batente; janelas têm as linhas das faces.
- **Corte e elevação**: monte um projeto com os 23 tipos (use o template novo) e construa a elevação paralela à parede e o corte transversal por cada vão (`engine/section` + `render/section/build`): sem exceção, lista de desenho não vazia por vão, e as linhas de abertura conforme a convenção do projeto (`openingLine` padrão: vértice no lado do trinco, tracejado quando abre para o observador); fixas e bandeiras sem linha.
- **3D**: `openingPieces` e `caixasDaAbertura` para o projeto-mostruário, com `openOpenings` ligado e desligado: sem exceção, peças dentro do vão (exceto acabamentos), `caixasDaAbertura` equivalente a `montarAbertura` (use o padrão do teste existente).
- **Exportações**: `ifcExport` do mostruário sem exceção e com uma `Operation`/painel por esquadria; quadro (`openingSchedule`) com uma linha por tipo usado e áreas coerentes.
- **Padrões**: cada tipo passa por `openingTypeIssue` e `openingFamilyOf` devolve a família esperada para o `id` do tipo (tabela explícita `id → família`).

## Critérios finais
- Todos os testes novos verdes; `npx vitest run packages/engine packages/model packages/render packages/io` (exceto `property`/`perf`) verde; `tsc` e `check-boundaries` limpos.
- RELATORIO.md lista cada defeito encontrado (tipo, vista, causa, correção) e o que ficou sem correção com a razão.
