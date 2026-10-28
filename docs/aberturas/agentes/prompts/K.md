# Tarefa K · Núcleo: `buildOpeningModel` (modelo único da esquadria)

Implemente o modelo da seção 2 e 3 da spec E. É a peça mais importante: as outras vistas dependem dela. Leia também: `packages/render/src/model3d/openingParts.ts` e seu teste (comportamento atual do 3D, que o modelo vai substituir depois), `packages/engine/src/resolve.ts` (`openingGeometry`), `packages/engine/src/frame.ts`, `packages/model/src/defaults.ts` (`openingFrame`), `packages/model/src/openingExtras.ts`, `packages/model/src/opening.ts`.

## Arquivos que você cria/edita (e só estes)
- `packages/model/src/openingStyle.ts` + `openingStyle.test.ts`: leitores com padrão por leitura dos campos v2 do tipo (`openingLeafStyle(t)`, `openingHandle(t)`, `openingFrameStyle(t)`, `openingGrid(t)`, `openingTransom(t)`, `openingSidelights(t)`, `openingAngle2d(t)`, `openingAngle3d(t)`, `openingPlanDisplay(t)`, `openingDetail2d(t)`, `openingDetail3d(t)`, `openingShowSwing(t)`, `openingSwingStyle(t)`, `openingLeafSide(t)`) e `openingLineConvention(p)` (padrão `{ apex: 'latch', dashed: 'toward' }`). Padrões: porta `leafStyle 'flush'`, janela `'glass'`; maçaneta `'lever'` só em porta de giro e dupla, `'none'` nas demais; `frameStyle 'rebate'`; `grid 1×1`; `angle2d 90`; `angle3d 90` (porta), 30 (maxim-ar e basculante), 90 (janela de giro); `planDisplay 'symbolic'`; `detail2d 'scale'`; `detail3d 'view'`; `showSwing true`; `swingStyle 'arc'`; `leafSide 'swing'`. Valores inválidos (NaN, fora de faixa, texto desconhecido) caem no padrão; ângulos limitados a 0..120, grid a 1..8. Exporte do `packages/model/src/index.ts`.
- `packages/engine/src/openingModel.ts` + `openingModel.test.ts`: `buildOpeningModel`, `partTransformed`, `slicePartsAtZ`, `projectParts` (assinaturas na spec §2; você define `OrientedBox` e os tipos auxiliares, exportados). Exporte de `packages/engine/src/index.ts` (uma linha `export * from './openingModel.ts';`).

## Passos (commit a cada um)
1. `openingStyle.ts` e testes.
2. Porta de giro: batente `rebate`, `simple`, `aduela`, `block`; folha; dobradiça; `openings[]`; núcleo e `D` limitada (use `coreSpan` e `openingFrame` como o `openingParts.ts` faz). Vão livre.
3. Dupla, pivotante, correr (porta).
4. Janelas: fixa, maxim-ar (`plan 'casement'`), basculante (`'tilt'`), correr 2 e 3 folhas, vão livre.
5. Detalhes (spec §3.4): `leafStyle`, `handle`, `grid`, `transom`, `sidelights`, alizar, peitoril saliente, verga, contraverga.
6. `partTransformed`, `slicePartsAtZ`, `projectParts`.

## Critérios de aceitação (todos viram testes)
- Valores exatos para o tipo padrão `ot_p90` (W 0,90, J 0,05, D 0,09, L 0,04, parede `wt_alv14` de núcleo 0,14): meia-largura da folha 0,411; `z` da folha 0,008 a 2,061; dobradiça em `t = −0,411` com `flipHand = false` e `+0,411` com `true`; folha em `s` no lado de abertura do batedor (`flipFacing` troca o lado).
- A folha fechada **não tem volume em comum** com nenhuma ombreira, batedor ou travessa (interseção de volume 0, tolerância 1e-9), e fica **dentro do vão** em `t` e `z`.
- Todas as peças de batente ficam dentro do núcleo (`core.s0 ≤ s ≤ core.s1`) e dentro do vão (`|t| ≤ W/2`, `0 ≤ z ≤ H`).
- Para as 10 famílias existentes (porta de giro/dupla/correr/pivotante/vão; janela fixa/basculante/maxim-ar/correr 2 e 3/vão) × `flipHand` × `flipFacing`: ids únicos e estáveis, caixas válidas (`t0<t1`, `s0<s1`, `z0<z1`), nenhuma peça fora do vão exceto alizar, peitoril saliente, verga e contraverga.
- `partTransformed` com `angle = π/2` na folha de giro: o centro da folha vai para o lado `side` (sinal de `s`), a dobradiça não se move, o comprimento da folha se mantém. Na maxim-ar, o eixo é o topo da folha. No correr, a folha móvel desloca `travel` em `t` e continua dentro do vão.
- `slicePartsAtZ(modelo, 1.5, CLOSED)` da porta de giro devolve: duas ombreiras (corpo e batedor, 4 anéis), a folha com espessura `L` (retângulo `2·0,411 × 0,04`) e nenhum anel de verga. Em `z = 2,3` devolve só a verga se o tipo tiver.
- `projectParts` com eixo de elevação devolve os retângulos de batente, folha, vidro, maçaneta; com `leafStyle 'panel'`, as 4 almofadas; com `grid 2×2` na janela fixa, 1 montante vertical e 1 horizontal.
- `leaves = 0`: `void = true` e nenhuma peça de batente/folha/vidro.
- `openings[]`: porta de giro → 1 item `kind 'side'`, `hingeT` e `latchT` opostos, `radius = 2·lh`; maxim-ar → `kind 'top'`; fixa → `kind 'fixed'`; bandeira e vidro fixo não geram item.
- Determinismo: duas chamadas iguais devolvem resultados iguais (comparação profunda).

Não toque em planta, corte, 3D, diálogo nem ferramentas.
