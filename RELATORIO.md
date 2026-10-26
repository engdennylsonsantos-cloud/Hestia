# Relatório — tarefa K (núcleo do modelo único da esquadria)

Data: 2026-10-26. Worktree: `feat/esq-K`.

## O que foi feito

- `packages/model/src/openingStyle.ts` (+ teste): leitores dos campos v2 com padrão por leitura, validação e limites
  (`leafStyle`, `handle`, `frameStyle`, `grid`, `transom`, `sidelights`, `angle2d`, `angle3d`, `planDisplay`,
  `detail2d`, `detail3d`, `showSwing`, `swingStyle`, `leafSide`, `openingLineConvention`). Exportado no
  `packages/model/src/index.ts`.
- `packages/engine/src/openingModel.ts` (+ teste): `buildOpeningModel`, `partTransformed`, `slicePartsAtZ`,
  `projectParts`, `openingCore` e os tipos auxiliares `ModelPoint`, `OrientedBox`, `SliceRing`, `ProjectedRing`.
  Exportado no `packages/engine/src/index.ts` com `export * from './openingModel.ts';`.
- `buildOpeningModel` cobre as 10 famílias existentes: porta de giro (batente `rebate`, `simple`, `aduela`, `block`),
  dupla, pivotante, correr, vão livre, janela fixa, basculante, maxim-ar, correr de 2 e 3 folhas e vão livre de janela.
  Inclui os detalhes da §3.4: `leafStyle` (`flush`, `panel`, `glass`, `louver`, `grille`), `handle`
  (`lever`, `knob`, `pull`), `grid`, `transom`, `sidelights`, alizar, peitoril saliente, verga e contraverga.
- Núcleo da parede (DEC-1) convertido para `s` local; profundidade do batente limitada ao núcleo. `openings[]` com
  `kind`, `side`, `hingeT`/`latchT`, `pivot`, `radius` e faixa `z`.

## Arquivos tocados

- `packages/model/src/openingStyle.ts` (novo)
- `packages/model/src/openingStyle.test.ts` (novo)
- `packages/model/src/index.ts` (export)
- `packages/engine/src/openingModel.ts` (novo)
- `packages/engine/src/openingModel.test.ts` (novo)
- `packages/engine/src/index.ts` (export)

Nenhum tipo do dono (`types.ts`, `openingModelTypes.ts`) foi alterado. Nenhum teste existente foi alterado ou apagado.

## Testes e verificação

- `npx vitest run packages/model/src/openingStyle.test.ts packages/engine/src/openingModel.test.ts` — 48 testes
  verdes (9 + 39).
- `npx vitest run packages/model/src/opening.test.ts packages/render/src/model3d/openingParts.test.ts` — 31 testes
  verdes (regressão dos módulos vizinhos).
- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `node scripts/check-boundaries.mjs` — `fronteiras ok`.
- Testes de propriedade/desempenho lentos não foram rodados, conforme as instruções comuns.

Cada critério de aceitação da tarefa virou ao menos um teste que falha sem a implementação: medidas exatas do
`ot_p90`; ausência de volume em comum entre folha e batente; batente no núcleo e no vão; as 10 famílias ×
`flipHand` × `flipFacing` (ids únicos/estáveis, caixas válidas, nada fora do vão exceto acabamentos); `partTransformed`
(giro, maxim-ar e correr); `slicePartsAtZ` em 1,5 m e 2,3 m; `projectParts` (batente/folha/vidro/maçaneta, painéis e
grade); vão livre; `openings[]`; determinismo por comparação profunda.

## Divergências da spec e decisões tomadas

1. **Travessa (`head`) com rebaixo.** A §3.1 diz que a travessa ocupa `z ∈ [H − J, H]` com o corpo. Como a folha
   fechada vai até `H − J + ov − gap` e o critério exige **volume de interseção zero** com a travessa, a travessa foi
   montada como as ombreiras: corpo em `z ∈ [H − J + ov, H]` e batedor em `z ∈ [H − J, H − J + ov]`, este só na
   profundidade do lado oposto à abertura. É a leitura que concilia a §3.1 com o critério de aceitação.
2. **`leafSide = 'opposite'`.** Além da folha, o batedor também é espelhado em torno de `C`; sem isso a folha ficaria
   sem apoio. A posição da folha (lado da abertura ou oposto) é a que o campo controla.
3. **Bandeiras laterais.** `openingSidelights` devolve `null` quando nenhum lado está ligado ou a largura é inválida;
   a largura é limitada a `W/2`. A folha encolhe `w + 0,04` por lado (vidro fixo + montante).
4. **Bandeira superior.** `openingTransom` devolve `null` quando ausente/inválida; a altura é limitada à do tipo.
   A travessa fixa ocupa 0,04 m e o vidro fixo acima tem a altura `transom.height`; a folha desce até abaixo da
   travessa, com a folga padrão. Nenhuma das duas peças gera item em `openings[]`.
5. **Grade.** Aplicada ao vidro da janela fixa (área interna inteira) e, por folha, ao vidro de maxim-ar/basculante e
   de correr. Na fixa o critério 2×2 rende exatamente 1 montante vertical e 1 horizontal.
6. **`projectParts`.** `axis = 's'` é a elevação (`u = t`, observação ao longo de `s`); `axis = 't'` é o corte
   transversal (`u = s`, observação ao longo de `t`). `depth` é a média da coordenada do eixo de visão (para a ordem de
   pintura). O espelhamento por `viewSide` fica para quem desenha, como na §1.
7. **`slicePartsAtZ` em plano coincidente com uma face.** O anel da própria face é devolvido (necessário para a verga
   em `z = 2,3`, que é o topo da peça).
8. **Pivotante.** `latchT = −hingeT` e `radius = 3·hw/2`, conforme a §3.2; o trinco não é detalhado pela spec.
9. **Correr de porta.** A folha móvel é a da direita com `flipHand = false` e a da esquerda com `flipHand = true`;
   `travel = largura da folha − 0,06`. Os trilhos (`track`, metal) ficam no topo e no piso.
10. **Vão livre de janela.** Mantém a soleira (`sillFrame`) e os acabamentos; não tem ombreira, travessa, folha nem
    vidro. `void = true` nos dois vãos.
11. **`block` em janela.** A spec define `block` no contexto da porta (§3.1). Em janela o caixilho continua sendo
    desenhado; `block` só altera `J`/`D` como nos demais estilos. `simple`/`aduela`/`block` de porta seguem a §3.1.

## Pendências honestas

- `openingLinePaths` (V de abertura) é do agente S; aqui só foram produzidos `openings[]` e as peças.
- `threshold` segue sem campo (nenhum tipo padrão pede).
- O grid de janela de correr/maxim-ar é por folha, não um grid único atravessando o vão.
- O trilho de piso da porta de correr encosta na folha em `z` (0,010 m contra `z0 = 0,008 m`); não há critério de
  não interseção contra trilho, mas é uma sobreposição visual a revisar quando o 3D consumir o modelo.
- O desenho de planta/corte/elevação/3D não foi alterado (fora do escopo desta tarefa).
