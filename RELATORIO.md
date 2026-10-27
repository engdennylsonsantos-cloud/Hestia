# Relatório FR1 · batente, acabamento, alizar, folha e planta

Data: 2026-10-26. Branch: `feat/esq-FR1`. Implementa as §1–§6 da spec E3 e a decisão 0035.
Trabalho dentro da worktree, com um commit por passo e os testes de cada passo verdes.

## O que foi feito

1. **Profundidade do batente (`frameDepthMode`)**
   - Nova `openingFrameDepth(t, wallThickness, coreThickness)` em `packages/model/src/openingStyle.ts`, com padrão `wall`.
   - `openingModelContext.ts` resolve `D` e `Cd` por modo; o `Ctx` ganhou `Cd` e o batente deixou de usar o centro do núcleo no modo `wall`.
   - Modelo e famílias novas (portas e janelas) usam `Cd` para batente, folha, vidro, puxadores e trilhos.

2. **Batente em peça única com `PartProfile`**
   - Ombreiras `rebate`/`aduela` são UMA peça com perfil em L (`plane 'ts'`, 6 vértices); a travessa é UMA peça com L (`plane 'sz'`).
   - `simple` continua caixa retangular de uma peça; `block` não gera batente. As peças `stop` antigas deixaram de existir.
   - `slicePartsAtZ` devolve o anel L da ombreira e o intervalo em `s` da travessa; `projectParts` usa retângulo envolvente na elevação e o L no corte transversal; `partTransformed` de perfil sem movimento devolve a caixa envolvente exata.

3. **Acabamento × batente**
   - `insertMode`: `closure 'inherit'` com batente (`frameStyle !== 'block'` e `leaves > 0`) vira `'none'`.
   - `insertReturns` aceita o batente e recorta cada retorno pelo contorno real (L nas portas `rebate`/`aduela`; caixa nas janelas/`simple`), sem sobrepor o batente.
   - A parede e a esquadria coincidem nas bordas do furo; o batente não cruza as camadas no corte.

4. **Alizar**
   - `casing.sides` (`both` padrão, `swing`, `opposite`), assentado sobre a face acabada (`|s| ≥ T/2`), borda interna em `|t| = hw − J` e externa em `hw − J + width`.
   - Porta: 3 peças por face (duas laterais e travessa). Janela: 4 (mais a soleira). Cada face tem `group 'casing-<face>'`.
   - A planta alta une os contornos do mesmo `group` antes de desenhar.

5. **Folha sem auto-interseção**
   - Eixo vertical e `LeafOpening.pivot` deixaram o plano médio da folha.
   - Vai-e-vem: eixo no plano médio, recuo lateral `L/2 + 0,004`, batente `simple`; folhas com largura reduzida para caber no recuo.
   - Porta dupla: mantém a folga central e não há colisão entre as duas folhas em nenhum ângulo.
   - Dobrável/sanfonada: a cadeia recua `L/2 + folga` da ombreira de ancoragem e recalcula a largura do painel para terminar na ombreira oposta (uma cadeia) ou no centro (duas).
   - Pivotante: eixo em `t = h·(hw/2)`, folha recuada `L/2 + 0,004` da face interna do batente e topo abaixo da face inferior da travessa, para o giro não varrer o batente.
   - Janela de abrir: eixo na face da folha voltada ao lado de abertura.

6. **Planta só com a folha aberta**
   - Porta de giro, dupla, pivotante e vai-e-vem: nenhuma folha fechada em `low`, `mid`, `high` ou `projected`; desenha a(s) folha(s) aberta(s) e o arco centrado no pivô novo.
   - `low` passou a mostrar a folha aberta como retângulo (além do arco e do corte do batente), para cumprir o critério de “polígono da folha aberta” em todos os níveis.
   - Correr/embutir/dobrável/sanfonada/seccionada mantêm o desenho próprio. Janela fixa e de correr não mudaram.

## Divergências da spec (decisões tomadas)

- **Face do pivô da folha de giro.** A spec E3 §5 manda usar `hingeS = sStop` (face encostada no batedor). Com o perfil L da §2, o canto de espessura da folha varre o lábio do batente já entre 5° e 10°, gerando interseção de volume. Para cumprir o teste de varredura, o giro lateral (giro, dupla e janela de abrir) articula na **face voltada para o lado de abertura**; a pivotante usa `sStop` com folha recuada. Isso está comentado no código e é a principal divergência.
- **Larguras recuadas.** Vai-e-vem, pivotante e cadeias dobráveis/sanfonadas têm largura/ancoragem reduzidas por `L/2 + 0,004` (ou `L + 0,004` no caso da pivotante) para o giro/dobra não invadir o batente. A pivotante também tem o topo em `H − J`.
- **`closure 'both'` no modo `wall`.** Com `D` igual à espessura total e o lábio do L na borda do furo, os retornos de `wt_alv14` ficam integralmente cobertos pelo batente (a subtração devolve vazio). O teste de “retornos continuam existindo fora do batente” é provado no modo `core`/`leafSide 'opposite'`, onde sobra retorno atrás do rebaixo. Os testes antigos de wrapping que esperavam retorno com `inherit` foram atualizados.
- **`openingFrameDepth`.** A assinatura recebe só espessura da parede e do núcleo; o `centerOffset` devolvido assume núcleo centrado (caso da `wt_alv14`). O modelo ajusta o centro à posição real do núcleo usando `openingCore`.
- **Alizar em planta a 1,5 m.** Cada face tem dois contornos verticais desconexos (ombreira esquerda e direita), ambos unidos pelo `group`; a expressão “um contorno unido por lado” foi interpretada como um contorno por lado da ombreira, não como um único anel ligando os dois lados através do vão.

## Arquivos tocados

- `packages/model/src/openingStyle.ts`, `packages/model/src/openingStyle.test.ts`
- `packages/engine/src/openingModelContext.ts`
- `packages/engine/src/openingModelDoors.ts`
- `packages/engine/src/openingModelDoorsNew.ts`
- `packages/engine/src/openingModelWindows.ts`
- `packages/engine/src/openingModelWindowsNew.ts`
- `packages/engine/src/openingModelDetails.ts`
- `packages/engine/src/openingModelTransforms.ts`
- `packages/engine/src/openingPlan.ts`, `packages/engine/src/openingPlanNew.ts`
- `packages/engine/src/wrap.ts`, `packages/engine/src/resolve.ts`
- Testes: `openingModel.test.ts`, `openingModelDoorsNew.test.ts`, `openingModelWindowsNew.test.ts`, `openingPlan.test.ts`, `openingPlanWindowsNew.test.ts`, `openingCatalogo.test.ts`, `wrap.test.ts` (novo), `engine.test.ts`, `vaoLivre.test.ts`.

Não foram tocados `packages/render`, `apps/web`, `openingTypes.ts` nem `openingModelTypes.ts`.

## Testes

Comandos executados e verdes:

- `npx vitest run packages/engine packages/model --exclude "**/property.test.ts" --exclude "**/*perf.test.ts"` → **165 arquivos, 2066 testes**.
- `npx tsc -p tsconfig.json --noEmit` → limpo.
- `node scripts/check-boundaries.mjs` → `fronteiras ok`.

Novos testes de aceitação principais:

- `openingStyle.test.ts`: `openingFrameDepth` nos modos `wall`, `core` e `fixed` (incluindo valor acima da parede).
- `openingModel.test.ts`: perfil L de 6 vértices, sem `stop`, caixa envolvente exata, área `J·D − ov·R`, corte em 1,5 m com dois anéis L, elevação/corte transversal com perfil, varredura de 0° a `angle3d` a cada 5° nos 4 flips para giro/dupla/pivotante/vai-e-vem, colisão entre as duas folhas da dupla, correr/embutir/dobrável/sanfonada ao longo do deslocamento/dobra, alizar com/sem `sides` e sem volume com parede/batente.
- `wrap.test.ts`: `insertMode` (`inherit` com batente → `none`), recorte dos retornos sem interseção e presença de retorno fora do batente no modo `core`/`opposite`, e anel do batente sem cruzar as camadas da parede.
- `openingPlan.test.ts`: nenhuma folha fechada em low/mid/high/projected para `ot_p90`, `ot_p160`, `ot_pp80`, `ot_pvv90`; folha aberta e arco centrado no pivô novo; arco termina na posição fechada e a folha aberta fica a `radius`; alizar unido por grupo.

Testes existentes atualizados (motivo):

- `openingModel.test.ts`: deixou de esperar corpo+batedor e passou a exigir o perfil L; profundidade padrão passou de 0,09 (núcleo) para 0,184 (parede); largura/altura da pivotante e a checagem da dobradiça foram ajustadas ao novo pivô.
- `openingPlan.test.ts`: low/high deixaram de esperar folha fechada; o centro do arco passou a ser `opening.pivot`; vai-e-vem não desenha mais a folha fechada no alto.
- `openingCatalogo.test.ts`: a checagem de volume da folha contra o batente passou a considerar o perfil L (a AABB do perfil contém o rebaixo e dava falso positivo).
- `openingModelWindowsNew.test.ts`: a rotação da janela de abrir não mantém mais o centro da caixa em `t = motion.t` (o eixo está na face); passou a validar o giro para o lado e a permanência no vão.
- `engine.test.ts` e `vaoLivre.test.ts`: com `inherit`, o tipo com batente não gera mais retorno de acabamento; os testes de wrapping passaram a usar vão livre para provar o retorno da parede.

## Pendências honestas

- As seções §7 (basculante com `tiltAxis`, bandeira de janela) e §8 (matriz `openingOptionSupport`) não fazem parte da FR1 e não foram implementadas aqui.
- `packages/render` e `apps/web` não foram verificados neste escopo; a planta/corte/elevação passam a consumir os novos perfis e o novo pivô sem mudança de contrato, mas baselines visuais precisam ser regravados no ambiente de referência.
- O teste `worker/projetoUmaVez.test.ts` falhou uma vez por concorrência na execução completa e passou isolado e na repetição completa; não tem relação com esquadrias.
- A decisão de face do pivô difere do texto da §5 por impossibilidade geométrica com o perfil L prescrito; se o dono preferir `hingeS = sStop`, será necessário reduzir a largura da folha em pelo menos `L + folga` por lado (ou alterar o perfil do batente), o que muda a aparência da folha e os raios dos arcos.
