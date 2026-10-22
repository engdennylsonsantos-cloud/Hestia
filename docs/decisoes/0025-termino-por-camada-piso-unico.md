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

- **Piso**: paredes do mesmo nível cuja faixa de cota (base até base mais altura) toca a faixa do piso inteiro, com tolerância de 1 mm. Parede que parte do topo do piso encosta e conta.
- **Laje**: o mesmo, mais as paredes do nível imediatamente acima e do imediatamente abaixo (teto entre pavimentos). `adjacentLevelIds` (`terminoBlock.ts`).
- **Faixa de cota usada na comparação**: a do elemento inteiro, não a de cada camada. Motivo: a parede que parte do topo do piso encosta só na camada de cima; se o teste fosse por camada, o substrato e o contrapiso sob a parede não seriam recortados.
- A cota da parede é a resolvida (`baseZ` e `height` de `ResolvedWall`, com a base anexada ao piso ou à laje).

## 3. Vãos de porta

A zona bloqueada das regras `face`, `nucleo` e `ate` perde o trecho dos vãos de porta que chegam ao piso (cota da soleira ≤ topo do elemento + 1 mm). O acabamento continua sob a soleira: a área recupera a largura do vão vezes a espessura da parede. Janela não entra.

## 4. Elemento vinculado e elemento estático

- Vinculado a circuito: `face` e `nucleo` mantêm o P8 (os circuitos de acabamento e de núcleo). `ate` recorta o circuito de núcleo. `passa` soma a pegada das paredes que tocam o circuito.
- Estático e perímetro externo: as regras recortam o contorno do elemento pelas paredes que ele cruza.

## 5. Junção automática por prioridade (P7b)

Camada com regra de parede (`face`, `nucleo`, `passa`, `ate`) não é recortada pela junção automática contra as paredes (`winsOver`, campo `explicit` no motor): a própria regra já decide a região. Piso × piso, laje × piso e o resto da junção seguem como antes. `cm` segue a junção como antes.

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

1. **Recorte da parede pela camada do piso nos desenhos.** A parede continua inteira em planta, corte e 3D: o pintor de paredes (`resolve.ts`) não recebe piso nem laje. Os itens C6 de pisos e C8 de lajes seguem `[ ]`.
2. **DXF e IFC** exportam o contorno do elemento, não o de cada camada.
3. **Cor e hachura por camada** na planta: o preenchimento é a camada de topo, mas a cor e a hachura são as do elemento.
4. **Passa em piso vinculado** pode sobrepor a pegada de um piso vizinho no mesmo circuito (sem fusão): a soma pode contar duas vezes a faixa da parede, dentro do limite da área bruta.
5. **Interface**: o seletor é testado pelas funções do formulário (`terminoForm.test.ts`). Não há teste de renderização do componente, porque o projeto não tem infraestrutura de render de React nos testes.

## 10. Testes e verificação

- `packages/engine/src/terminoPiso.test.ts` (casos a a j do brief, com valores à mão), `terminoPisoSection.test.ts` (corte), `terminoLaje.test.ts` (laje única, teto com parede do pavimento de cima).
- `packages/render/src/model3d/pisoUnicoSolids.test.ts` (3D), `packages/render/src/plan/pisoUnicoFill.test.ts` (preenchimento da planta).
- `packages/model/src/termino.test.ts` e `apps/web/src/ui/dialogs/terminoForm.test.ts` (validação e formulário).
- `tests/e2e/piso-unico.mjs` (app real: piso único pelo perímetro, estrutura > acabamento, troca para núcleo).
- Regressão visual: os 30 casos atuais seguem em 0,000% (CPU) e a regressão GPU passa. Dois casos novos, `piso-unico-parede-face` e `piso-unico-parede-nucleo`, com baselines criadas. Conferidas a olho: as duas imagens são praticamente iguais, porque a parede pinta por cima da diferença (ela fica dentro da pegada). A diferença está nas operações de preenchimento (testadas) e no corte, no 3D e nos quantitativos.
