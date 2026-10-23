# 0025 · Término por camada: regras nas paredes e piso único

Origem: pedido do dono, depois da correção do P8 (`0023` §2): "eu quero poder controlar onde cada camada acaba nas paredes, tipo, criando um piso único, caso eu queira, envolvendo a obra inteira, e poder controlar o limite de cada camada do piso". O P8 não atendia isso: o contorno era de um circuito de piso vinculado e não recortava paredes dentro de um piso único.

Status: implementada no motor, na planta, no corte, no 3D e nos quantitativos, com o seletor na interface e os tipos padrão `ft_unico` e `ls_unica`. Pendências na seção 9.

## 1. Modelo

`Layer.termino` (opcional, aditivo, sem migração, sem mudança de `SCHEMA_VERSION`). Sem o campo vale `auto`.

| Valor | Região da camada (planta) |
|---|---|
| `auto` | Como antes (P8 em piso vinculado; contorno do elemento nos demais). Não muda nada. |
| `face` | Contorno menos a pegada inteira da parede: a camada para na face de acabamento. |
| `nucleo` | Contorno menos a faixa do núcleo da parede: a camada avança sob o acabamento e para no núcleo. |
| `passa` | Contorno inteiro, sem recorte pela parede (estrutura que corre por baixo). |
| `{ ate: { prioridade: N } }` | Contorno menos a faixa entre a primeira e a última camada da parede de prioridade efetiva ≤ N (1 a 9). Sem nenhuma, a parede é `passa`. |
| `{ cm }` | Face de acabamento deslocada (positivo avança). Só em elemento vinculado; em estático e em perímetro segue ignorado, como antes. |

Prioridade efetiva: a de `layerPriority` (`priority` da camada, senão a da função, `0023` §1.1). Menor número, prioridade maior.

Desenho em texto. Parede de cima para baixo na seção, do lado A ao lado B: reboco (4), núcleo (1), reboco (4). Piso à esquerda e à direita.

```
regra face      piso ███████ | reboco |   núcleo   | reboco | ███████ piso
                             [ zona bloqueada: a parede inteira ]

regra nucleo    piso ███████████ | núcleo | ███████████ piso
                                 [ zona: só o núcleo ]

regra passa     piso ██████████████████████████████████ piso
                                 (a parede não recorta)

regra ate 1     piso ██████████████████ | núcleo | ██████████████████ piso
                                       [ zona: núcleo ]
```

No caso `ate 3` com a parede (reboco 4, térmica 3, núcleo 1, reboco 4), a zona vai da térmica até o núcleo: a camada para na face externa da térmica.

## 2. Paredes consideradas

- **Piso**: paredes do mesmo nível cuja faixa de cota (base até base mais altura) toca, com tolerância de 1 mm, a faixa de cota da camada. A parede é considerada camada por camada: parede que parte do topo do piso encosta só na camada de cima e conta para ela.
- **Laje**: o mesmo, mais as paredes do nível imediatamente acima e do imediatamente abaixo (teto entre pavimentos). `adjacentLevelIds` (`terminoBlock.ts`).
- **Faixa de cota usada na comparação**: a faixa real de CADA camada (Revisão 2026-10-22). Parede que só encosta no topo ou na base do piso/laje recorta só a camada tocada; as outras camadas ficam inteiras.
  - Motivo histórico: antes valia a faixa do elemento inteiro, porque a parede que parte do topo do piso encosta só na camada de cima; se o teste fosse por camada, o substrato e o contrapiso sob a parede não seriam recortados.
  - **Revisão 2026-10-22**: relato do dono de camadas inteiras recortadas abaixo do contato com a parede ("área vazia"). Em `floors.ts` e `slabs.ts`, a faixa passou a ser a de cada camada: a camada tocada é recortada e as demais continuam inteiras.
- A cota da parede é a resolvida (`baseZ` e `height` de `ResolvedWall`, com a base anexada ao piso ou à laje).

## 3. Vãos de porta

A zona bloqueada das regras `face`, `nucleo` e `ate` perde o trecho dos vãos de porta que chegam ao piso (cota da soleira ≤ topo do elemento + 1 mm). O acabamento continua sob a soleira: a área recupera a largura do vão vezes a espessura da parede. Janela não entra.

## 4. Elemento vinculado e elemento estático

- Vinculado a circuito: `face` e `nucleo` mantêm o P8 (os circuitos de acabamento e de núcleo). `ate` recorta o circuito de núcleo. `passa` soma a pegada das paredes que tocam o circuito.
- Estático e perímetro externo: as regras recortam o contorno do elemento pelas paredes que ele cruza.

## 5. Junção automática por prioridade (P7b)

Camada com regra de parede (`face`, `nucleo`, `passa`, `ate`) não é recortada pela junção automática contra as paredes (`winsOver`, campo `explicit` no motor): a própria regra já decide a região. E também não recorta a parede (Revisão 2026-10-22): fim do corte mútuo, a parede não é mais interrompida pela camada que se recorta para recebê-la. Vale para piso × parede e laje × parede; piso × laje e piso × piso não mudam. `cm` segue a junção como antes.

## 6. Multipolígono e consumidores

A região de cada camada é um multipolígono com furos (anel e ilhas). Consumidores:

- **Planta** (`plan/floors.ts`, `plan/slabs.ts`): o preenchimento é a camada de topo quando ela tem regra de parede (`fillRegionOf`); senão, o elemento, como antes.
- **Corte** (`section.ts`): cada camada usa o seu polígono; a estrutura que passa sai inteira e o acabamento sai recortado.
- **3D** (`model3d/solids.ts`): sólidos por camada com os cortes.
- **Quantitativos** (`floorQuantities.ts`, `slabQuantities.ts`): área e volume da camada, sem contar duas vezes.

## 7. Ciclo resolvido

Antes, a parede se anexava ao piso (`resolveLevel` chama `resolveAllFloors`), e o piso precisava das paredes para as camadas: ciclo. A resolução de paredes passa `{ layers: false }` (`resolveAllFloors`, `resolveAllSlabs`): o piso entra só pelo contorno do elemento, que é o que a anexação usa. As camadas continuam calculadas em todos os outros usos.

## 8. Tipos padrão

- `ft_unico` (PS-05, "Piso único (obra inteira)"): acabamento, assentamento e contrapiso com término `face`; estrutura de concreto com `passa`.
- `ls_unica` (LJ-UN, "Laje única (obra inteira)"): regularização com `face`; estrutura com `passa`.

Nenhum tipo salvo e nenhum template foi alterado. Testes que contavam o catálogo ou apagavam todos os tipos foram ajustados (`slabActions.test.ts`, que apaga `ls_unica` antes de checar o último tipo).

## 9. Desempenho e o que não faz

Desempenho: as regras só calculam quando a camada tem regra explícita. A casa de 500 paredes do `test:perf` (K4) não tem regra: 52 ms na base e 1077 ms a frio, sem mudança relevante. A junção já tinha cache por nível com assinatura de conteúdo (`junctionLevel`); a zona de cada parede é calculada sob demanda, sem cache próprio por nível.

Não faz (pendências):

1. **Recorte da parede pela camada do piso.** Revisão 2026-10-22: superado em parte pela P7c parte 2 (0023), que passou a recortar a parede na planta, no corte, na elevação e no 3D pelas partes por camada da junção (C6 de pisos e C8 de lajes em `[x]`). Contra camada com regra explícita não há corte mútuo: a camada não recorta a parede, e a parede não recorta a camada (§5). Ficam: DXF e IFC por camada e cor/hachura por camada na planta (item 3).
2. **DXF e IFC** exportam o contorno do elemento, não o de cada camada.
3. **Cor e hachura por camada** na planta: o preenchimento é a camada de topo, mas a cor e a hachura são as do elemento.
4. **Passa em piso vinculado** pode sobrepor a pegada de um piso vizinho no mesmo circuito (sem fusão): a soma pode contar duas vezes a faixa da parede, dentro do limite da área bruta.
5. **Interface**: o seletor é testado pelas funções do formulário (`terminoForm.test.ts`). Não há teste de renderização do componente, porque o projeto não tem infraestrutura de render de React nos testes.
6. **Passa atravessado por parede** (Revisão 2026-10-22): se a base da parede desce abaixo do topo de uma camada `passa`, a camada e a parede ficam inteiras (sem corte mútuo) e a faixa comum pode ser contada nas duas — o desenho não deixa vazio, mas o volume dessa faixa entra duas vezes no total. Não há desconto automático; a decisão de o `passa` ceder à parede (ou de aceitar a sobreposição) é do dono.

## 10. Testes e verificação

- `packages/engine/src/terminoPiso.test.ts` (casos a a j do brief, com valores à mão), `terminoPisoSection.test.ts` (corte), `terminoLaje.test.ts` (laje única, teto com parede do pavimento de cima).
- `packages/render/src/model3d/pisoUnicoSolids.test.ts` (3D), `packages/render/src/plan/pisoUnicoFill.test.ts` (preenchimento da planta).
- `packages/model/src/termino.test.ts` e `apps/web/src/ui/dialogs/terminoForm.test.ts` (validação e formulário).
- `tests/e2e/piso-unico.mjs` (app real: piso único pelo perímetro, estrutura > acabamento, troca para núcleo).
- Regressão visual (medição original, ambiente canônico): os 30 casos atuais seguiam em 0,000% (CPU) e a regressão GPU passava. Dois casos novos, `piso-unico-parede-face` e `piso-unico-parede-nucleo`, com baselines criadas. Conferidas a olho: as duas imagens são praticamente iguais, porque a parede pinta por cima da diferença (ela fica dentro da pegada). A diferença está nas operações de preenchimento (testadas) e no corte, no 3D e nos quantitativos.
- Revisão 2026-10-22 (correções aplicadas e verificadas): os testes alvo passaram — `terminoPiso.test.ts`, `terminoLaje.test.ts`, `junctionPlanar.test.ts`, `junctionLevel.test.ts`, `wallJunction.test.ts`, `pick.test.ts`, `terminoPisoSection.test.ts` e `terminoVinculado.test.ts`. Verificação final: `typecheck` e `lint` verdes, `test:rapido` 277 arquivos / 3375 testes, `test:completo` 278 / 3677, e2e `parede-recorte`/`piso-unico`/`pisos`/`lajes`/`contorno`/`sections`/`flow` verdes.
- Regressão visual na rodada final (Windows, 2026-10-22): os dois casos novos (`junc-parede-recortada-laje` e `junc-fachada-continua-laje`) seguem em 0,000%; os antigos divergem 0,373–0,747%, quase tudo no banner "Sem GPU" (1315 px, caixa 21,17–291,28) e alguns pixels de texto/hachura. Os casos `piso-unico-*` têm 358 px na borda vertical da parede (x = 338), que é a continuidade parede/piso pretendida. Não atualizar as baselines antigas por causa do banner: a diferença é do ambiente, não da geometria (A/B no mesmo ambiente deu 0,000%).
