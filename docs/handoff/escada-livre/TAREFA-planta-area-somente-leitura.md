# Tarefa — planta de área somente leitura

Branch sugerida: `fix/planta-area-somente-leitura` (depois da A1 integrada na main)
Depende de: A1 (`fix/planta-area-sobreposicao-compartilhada`)
Não implementar antes da autorização do dono.

## Decisão de produto

A planta de área é vista de análise/anotação. Elementos de modelo **não se movem** nela.

O que continua permitido:

- selecionar por clique e por janela;
- hover e destaque de parede, porta/janela, piso/laje, escada/rampa, telhado e ambiente;
- editar anotações (cota, texto, detalhe, etiqueta, linha de separação de ambiente);
- arrastar o rótulo do ambiente;
- alças de anotação (cota/texto) e de separador de ambiente.

O que deixa de existir:

- arrastar elemento de modelo para mover;
- alças (grips) de parede, piso, laje, forro, telhado, escada, rampa e grade;
- fantasmas de mover de elemento de modelo.

Hoje o `select` move paredes na planta de área, mesmo com `AREA_PLAN_TOOLS` bloqueando as ferramentas de modelo. Esta tarefa corrige a inconsistência.

## Mudanças

### 1. `packages/tools/src/selectTool.ts`

- Criar helper `private get somenteLeitura(): boolean { return this.planId() !== undefined; }`.
- Criar helper de categoria: parede, porta, janela, piso, laje, forro, telhado, escada, rampa, ambiente, genérico e grade são **modelo**; anotação, vista e separador de ambiente não são.
- Em `down()`:
  - com `somenteLeitura`, não chamar `gripHoldAt` para elemento de modelo (evita alça invisível); manter `gripHoldAt` para separador de ambiente;
  - se o hit for modelo e já estiver selecionado, **não** entrar em `dragwait`/`opening`; deixar `pending`, para o clique selecionar e o arrasto virar janela;
  - manter os grips de cota/texto (`dimTextGripAt`, `dimGripAt`, `textGripAt`) e o arrasto de rótulo do ambiente (feito no `controller`).
- Em `drag()`: garantir que `moving` não seja alcançado na área (defesa extra).
- Em `move()`: não empurrar `ringHandlePreview`, `stairHandlePreview`, `stairFreeHandlePreview`, `spiralHandlePreview`, `gridHandlePreview` nem `rampHandlePreview` quando `somenteLeitura`.
- Nada muda na planta de piso (testes atuais de `floorEdit`, `slabEdit`, `stairSelection`, etc. devem continuar verdes).

### 2. `packages/render/src/plan/floors.ts`

- `outlineSelectionOps(..., grips = true)`: quando `grips` for falso, desenhar preenchimento, contorno de 2 px e etiqueta de área, mas **não** os quadradinhos de vértice.
- `floorSelectionOps`, `slabSelectionOps`, `ceilingSelectionOps`, `stairSelectionOps`, `rampSelectionOps` e `roofSelectionOps` ganham parâmetro opcional `grips = true` e repassam.
- Em `roofSelectionOps`, quando `grips` for falso, não desenhar `defineSlopeOps` (símbolo de edição de caimento); manter `selectedRingOps` (contorno de seleção).

### 3. `packages/render/src/plan/planOverlay.ts`

- `const alçasDeModelo = input.areaPlan === undefined;` (ou um campo explícito `allowModelGrips` em `PlanInput`, se preferir deixar a regra fora do render).
- Passar `alçasDeModelo` para todas as chamadas de seleção (`floorSelectionOps`, `slabSelectionOps`, `roofSelectionOps`, `stairSelectionOps`, `rampSelectionOps`, `ceilingSelectionOps`) em `buildPlanSelectionOverlay`, `buildPlanHoverOverlay` e `buildPlanOverlay`.
- No laço manual de paredes (`buildPlanSelectionOverlay`/`buildPlanOverlay`), desenhar o contorno de 2 px sempre, mas só os quadradinhos quando `alçasDeModelo`.
- Hover não desenha alças hoje; nenhuma mudança.
- O fantasma de seleção fora do intervalo (`hiddenSelectionOps`) continua: é feedback, não alça.

### 4. Testes

Atualizar/criar:

- `packages/tools/src/areaPlanSelect.test.ts`:
  - arrastar uma parede selecionada na área **não move** `a`/`b`;
  - arrastar no vazio continua janela de seleção;
  - clicar numa parede continua selecionando;
  - arrastar uma cota/texto da vista continua movendo a anotação;
  - arrastar o rótulo do ambiente continua movendo o rótulo (pode ficar em `areaPlanActions.test.ts`).
- `packages/render/src/plan/areaPlanOverlay.test.ts`:
  - parede selecionada na área: **1 fill + 1 stroke** (destaque), sem os 10 fills/10 strokes de alça;
  - planta de piso continua **11/11** para o mesmo projeto;
  - hover continua > 0;
  - caixa de seleção continua com fill + tracejado `[7, 5]`;
  - ambiente continua 1/1.
- `packages/render/src/plan/areaPlan.test.ts`: seleção do ambiente segue 1/1.
- `apps/web/src/editor/areaPlanAnotacao.test.ts`: seleção/janela de anotação seguem; ferramenta de modelo continua bloqueada.
- `packages/render/src/plan/planFrame.test.ts`: chaves não mudam.

## Critérios de aceite

- Na planta de área, arrastar parede/piso/laje/escada/telhado selecionado não altera o modelo.
- Não aparece nenhum quadradinho de alça de elemento de modelo.
- Destaque, hover, janela de seleção, fantasmas de seleção oculta e anotações continuam funcionando.
- Na planta de piso, mover e alças continuam exatamente como hoje.
- Suíte completa verde; `ouroZoom.json` sem alteração.

## Estimativa

**0,5 a 1 dia**, incluindo testes. É pré-requisito recomendado da A2 porque muda o teste de contagem da sobreposição e elimina o caso de ferramenta de modelo ativa em uma vista de leitura.

## Observação sobre a A2

A A2 deve assumir esta regra: a sobreposição compartilhada da área **não** desenha alças de modelo. Se a A2 for feita antes desta tarefa, os testes da A2 precisam prever a flag de alças desde o início.
