# E3 · Especificação das correções v3 (batente, acabamento, alizar, folha, planta, basculante, opções)

Data: 2026-10-26. Complementa [E](E-spec-modelo-unico.md) (que continua valendo no que não for alterado aqui) e a decisão [0035](../decisoes/0035-esquadrias-v3.md). Origem: revisão do dono sobre o que foi entregue em v2.

## 0 · O que o dono apontou

1. O vão da parede é aberto e a porta entra alinhada ao **núcleo**, mas o **acabamento** da parede (reboco/tinta) "retorna" para dentro do vão e a estrutura da porta (batente) fica **sobreposta** a esse acabamento.
2. O batente são **dois retângulos** por ombreira em vez de **uma peça só** no formato de batente (seção em L, com rebaixo). A folha precisa estar bem encaixada no batente.
3. Revisar o **alizar** e como o batente fica **na medida certa, vinculado à espessura da parede ou não**.
4. A porta, **aberta ou fechada, não pode ficar sobreposta a si mesma** (folha atravessando batente ou outra folha).
5. Em **planta**, a porta é desenhada aberta **e** fechada: só a **aberta** deve aparecer.
6. A **janela basculante** está invertida verticalmente (parece abrir para baixo).
7. Ativar **bandeira** em algumas janelas "bugou": metade da janela some. Verificar **todas as funções e opções** de portas e janelas (se dá para configurar e se funcionam).
8. Permitir configurar os **principais tipos brasileiros** de portas e janelas (madeira, madeira e vidro, alumínio, vidro temperado etc.).

## 1 · Profundidade do batente ligada à parede (`frameDepthMode`)

Campo do tipo `frameDepthMode?: 'wall' | 'core' | 'fixed'` (`openingTypes.ts`), padrão **`'wall'`**.

| Modo | Profundidade `D` | Centro `Cd` (em `s`) |
|---|---|---|
| `wall` | espessura TOTAL da parede acabada (`thickness`) | plano médio da parede (`s = 0`): o batente fica **faceado com os acabamentos** das duas faces |
| `core` | espessura do núcleo estrutural (`coreSpan`) | centro do núcleo |
| `fixed` | `frameDepth` do tipo (padrão 0,09), no máximo a espessura total | centro do núcleo, ajustado para caber entre as faces |

`openingFrame(t, maxDepth)` e a leitura em `openingModelContext.ts` passam a resolver `D` e `Cd` por esse modo (função pura nova em `packages/model/src/openingStyle.ts`: `openingFrameDepth(t, wallThickness, coreThickness): { depth: number; centerOffset: number }`, com `centerOffset` relativo ao plano médio da parede; testes). Em todo o código, "o batente fica no núcleo" (DEC-1 da 0017) passa a ser só o modo `core`.

## 2 · Batente é UMA peça com seção (`PartProfile`)

Cada ombreira e a travessa do batente `rebate` deixa de ser "corpo + batedor" (duas caixas) e vira **uma** `OpeningPart` com `profile`:

- **Ombreira** (`role 'jamb'`, `profile.plane 'ts'`, extrudada em `z ∈ [0, H]`): polígono em L no plano (t, s). Com `j = ±1` (lado), `hw = W/2`, `J` largura do perfil, `ov = 0,015` (largura do batedor), `R = L + 0,004` (profundidade do rebaixo = espessura da folha + folga), `sN` = face do batente do lado **oposto** à abertura, `sS` = face do lado da abertura (`sS = Cd + side·D/2`, `sN = Cd − side·D/2`): vértices em ordem anti-horária, p.ex. para `j = +1`, `side = +1`: `(hw, sN) → (hw, sS) → (hw − J + ov, sS) → (hw − J + ov, sS − R) → (hw − J, sS − R) → (hw − J, sN)`; os demais casos são espelhamentos. `box` = envolvente exata.
- **Travessa** (`role 'head'`, `profile.plane 'sz'`, extrudada em `t ∈ [−hw, hw]`): o mesmo L no plano (s, z), com `z` do topo `H` e a face interna em `H − J`. As três peças (duas ombreiras e a travessa) são independentes mas **sem sobreposição** entre si nos cantos: a travessa vai de `−hw` a `hw` e as ombreiras de `0` a `H − J` (ou o contrário; escolha uma convenção, documente e teste que a união cobre o U sem volume duplo).
- `frameStyle 'simple'`: seção retangular `J × D`. `'aduela'`: como `rebate` com `J = 0,03`. `'block'`: nenhuma peça de batente.
- Janela: perímetro do caixilho (ombreiras, travessa, peitoril do caixilho) com seção retangular `J × D` (`profile` opcional; o rebaixo da folha é a moldura de folha, não do caixilho).
- `slicePartsAtZ`, `projectParts` e `partTransformed` passam a respeitar `profile`: o anel de corte de uma ombreira é o polígono em L (não a caixa); o corte transversal (`axis 't'`) da travessa é o L no plano (s, z); a elevação usa o retângulo envolvente.

## 3 · Acabamento da parede × batente (sem sobreposição)

Hoje o retorno do acabamento (`closure`, `wrap.ts`) entra no vão e sobrepõe o batente. Regras novas:

- `insertMode(wt, ot)` (`engine/src/wrap.ts`): com `ot.closure === 'inherit'` e o tipo com batente (`openingFrameStyle(ot) !== 'block'` e `leaves > 0`), o fechamento efetivo é **`'none'`** (o acabamento encosta no batente, como na obra: o reboco vai até o batente). `closure` explícito (`'both'`, `'exterior'`, `'interior'`) continua valendo.
- Com `closure` explícito e batente presente, os retornos são **recortados** pelo contorno do batente (diferença de polígonos), para nunca sobrepô-lo.
- O furo da parede (`roughWidth`) é o do tipo (`width + roughOversize`); com batente, o padrão de `roughOversize` continua 0 e a peça do batente ocupa `|t| ∈ [hw − J, hw]`, encostada nas bordas do furo.
- Teste de invariante: para as famílias com batente × `frameDepthMode` × `closure` (`inherit`, `both`): a área de interseção entre os polígonos das peças do batente (fatia em `z = 1,5`) e os fragmentos de camadas da parede **e** dos retornos é 0 (tolerância 1e-6).

## 4 · Alizar

`casing: { width, thickness, sides? }` (`sides: 'both' | 'swing' | 'opposite'`, padrão `'both'`; larguras comuns 0,05 e 0,07, espessura 0,015). O alizar **assenta sobre a face acabada** da parede (`s ∈ [T/2, T/2 + thickness]` e o espelho, sem entrar na parede) e cobre a junta batente/parede: borda interna alinhada à face interna do batente (`|t| = hw − J`), borda externa em `hw − J + width`. Porta: 3 lados (duas laterais e a travessa), sem o inferior. Janela: 4 lados. As peças de cada face e lado formam um `group` (`'casing-<face>'`), de modo que a planta e o corte desenham **uma** silhueta unida por face. Sem volume em comum com a parede nem com o batente (verificar).

## 5 · Folha: articulação sem auto-interseção

- A dobradiça (eixo vertical) passa pela **face da folha oposta ao lado de abertura**, na borda da dobradiça (`hingeS = sStop`, a face da folha encostada no batedor), não pelo plano médio. Assim a folha, ao girar para o lado de abertura, **se afasta** do batente em vez de atravessá-lo. `LeafOpening.pivot.s` e o centro do arco da planta passam a esse ponto; o raio do arco é o comprimento da folha.
- Porta dupla: as duas folhas giram para o mesmo lado, sem se cruzarem na abertura total (folga central de 0,002 mantida, e a 90° as pontas livres não se tocam).
- Vai-e-vem: eixo no plano médio (precisa girar para os dois lados): folga lateral `L/2 + 0,004`, batente `simple`.
- **Teste de varredura**: para cada família com folha que gira (`rotate`), amostrar o ângulo de 0 até o máximo (`angle3d`, a cada 5°) nos dois estados `flipHand`/`flipFacing`: nenhuma interseção de volume entre a folha (todas as peças com o mesmo `leaf`) e qualquer peça de batente, entre folhas diferentes, nem com a parede (fora do furo). Correr/guilhotina/dobrável/embutir: o mesmo ao longo do deslocamento/dobra.

## 6 · Planta: só a folha ABERTA

Em `openingPlanPaths` (todas as famílias de giro: giro, dupla, pivotante, vai-e-vem): desenhar a folha **somente aberta** (em `angle2d`) com seu arco; **não** desenhar a folha fechada em nenhum nível de detalhe nem em `planDisplay 'projected'`. Níveis: `low` = linha da folha aberta + arco + ombreiras em traço simples; `mid` = folha aberta como retângulo com espessura + arco + perfis de batente (L) + peitoril/soleira; `high` = `mid` + alizar (silhueta unida), peitoril saliente, verga/contraverga (tracejadas) e vidro duplo nas janelas. Correr/embutir/dobrável/sanfonada/seccionada mantêm o desenho próprio (não há folha "aberta × fechada" separada). Janelas de abrir: folha aberta + arco tracejado.

## 7 · Janelas: basculante e bandeira

- **Basculante** (`window_tilt`, `plan 'tilt'`): eixo de rotação **horizontal, central ou excêntrico** (`tiltAxis`, fração da altura útil, padrão 0,5; SINAPI: "eixo de rotação horizontal, central ou excêntrico"). A folha gira em torno de `(s = Cd, z = J + tiltAxis·(H − 2J))`; ao abrir, a metade **superior** vai para o lado `side` e a **inferior** para o oposto (`sign` de modo que o ângulo positivo leve a borda superior para `side`). `angle3d` padrão 30°, no máximo 60°. `LeafOpening.kind 'tilt'` com `axisZ`. Linhas de abertura em elevação: um V com vértice no centro do eixo e pontas nos dois cantos superiores (metade que abre para o observador tracejada se `side === viewSide`) e outro V com pontas nos cantos inferiores (metade que abre para longe: traço contrário). Planta: a folha em corte inclinada (linha de 3 tracos) sobre o eixo com `angle2d`, sem arco.
- **Maxim-ar** (`window_casement`): eixo no topo, a borda inferior vai para `side` (padrão do projeto: para fora da edificação em fachada). Mantém o que existe.
- **Bandeira em janela** (`transom`): faixa fixa superior de altura `transom.height` (≤ 40% da altura do vão) separada da(s) folha(s) por uma travessa do caixilho (`J`); a(s) folha(s) ocupam só a parte de baixo. Aplicável a: fixa, de abrir, maxim-ar, correr (a bandeira corre junto do trilho superior do caixilho), basculante, pivotante. Não aplicável a: guilhotina, veneziana, vãos. `transom.fixed === false` faz a bandeira ser uma folha maxim-ar pequena. **Bug conhecido**: hoje a bandeira de janela deixa metade do vão sem peças; corrigir e cobrir por teste de cobertura (§8).
- Bandeiras laterais (`sidelights`) só se aplicam a portas e a janela fixa.

## 8 · Opções × famílias (matriz) e cobertura

Função pura nova `openingOptionSupport(familyId): { transom: boolean; sidelights: boolean; grid: boolean; leafStyle: boolean; handle: boolean; casing: boolean; sillBoard: boolean; ... }` em `packages/model/src/opening.ts` (tabela explícita por família); o diálogo esconde/desabilita o que não se aplica, e o modelo ignora o que não se aplica (sem erro, sem peça quebrada).

Invariantes de **cobertura** (teste parametrizado, todas as famílias × cada opção aplicável ligada/desligada × `flipHand` × `flipFacing`): na elevação (`projectParts` eixo `'s'`), a união dos retângulos de batente, folha, vidro, bandeira, travessas e montantes cobre **100% do retângulo do vão** (menos folgas ≤ 0,01 m), exceto vão livre; nenhuma peça fora do vão (exceto acabamentos); sem volume em comum entre peças de grupos físicos diferentes (batente × folha × vidro × bandeira), nem fechado nem aberto.

## 9 · Convenções gerais

Todas as regras da spec E (§1, §5) continuam. Campos novos do tipo (já em `openingTypes.ts`): `frameDepthMode`, `casing.sides`, `leafMaterialId`, `glassKind`, `tiltAxis`. Novos no modelo (`openingModelTypes.ts`): `PartProfile` e `OpeningPart.profile` / `group`. Todo campo novo é opcional com padrão por leitura.
