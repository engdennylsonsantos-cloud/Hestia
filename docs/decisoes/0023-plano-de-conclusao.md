# 0023 · Plano de conclusão da junção piso/laje × parede

Companheiro de [0023](0023-juncao-piso-laje-parede.md). A decisão diz **o que** a junção faz; este documento diz **o que falta**,
**em que ordem** e **como saber que terminou**. Foi escrito para ser retomado por outro agente ou em outra máquina, sem depender
da conversa que o gerou.

**Regra de handoff.** Cada fase tem um checklist abaixo. Ao terminar uma fase: rodar os testes da fase, marcar `[x]` com o hash
do commit, commitar e dar `git push origin claude/inspiring-brahmagupta-4eh7f2`. Nunca deixar uma fase concluída só na
máquina. Nada de PR sem pedido explícito.

Estado de partida (2026-10-23, commit `f7e1cef`): 15 arquivos e 130 testes de junção passando (`npx vitest run` nos
diretórios `junction`, `junctionPlan`, `junctionSolids`, `floor`, `slab`, `netQuantities`).

## 1. Diagnóstico

| Parte | Estado | Onde |
|---|---|---|
| Prioridade efetiva e núcleo | feito | `packages/model/src/priority.ts`, `packages/engine/src/junctionPlanar.ts` |
| Resolução piso/laje × parede (`resolveJunction`) | feito | `junctionPlanar.ts` |
| Resolução do nível (`junctionLevel`) | **parcial**: calcula as paredes como cortadoras, mas **descarta** as partes resolvidas das paredes (`junctionLevel.ts`, `tagged` com `layerIndex -1` e `res[i]` ignorado) | `packages/engine/src/junctionLevel.ts` |
| Quantitativos da parede | feito: já desconta o volume dos pisos e lajes | `packages/engine/src/quantities.ts:65` |
| Quantitativos de piso e laje | feito | `floorQuantities.ts`, `slabQuantities.ts` |
| Piso e laje na planta, corte e 3D | feito: desenham a região resolvida | `section.ts:200,235`, `plan/floors.ts`, `plan/slabs.ts`, `model3d/solids.ts:404,442` |
| **Parede na planta** | **falta**: `plan/build.ts:90` usa `rw.layers[].cut`/`fragment`, sem recorte | `packages/render/src/plan/build.ts` |
| **Parede no corte** | **falta**: `section.ts:288` usa a faixa inteira | `packages/engine/src/section.ts` |
| **Parede no 3D** | **falta**: `solids.ts:342,376` (`wallLayerSolid`) usa a faixa inteira | `packages/render/src/model3d/solids.ts` |
| Término por camada (P8) no interior | feito (piso e laje) | `packages/model/src/termino.ts`, `packages/engine/src/layerOutline.ts` |
| Término no perímetro externo | **falta** (0023 §2) | — |
| Cor, hachura e IFC/DXF por camada | **falta** (P8, parcial) | — |
| Inversão de corte por par (P10) | bloqueada pela decisão P-4 | 0023 §13 |

**Consequência prática.** Os números já estão certos (quantitativos), mas o desenho da parede não mostra o recorte. A parede
aparece inteira por cima do piso, e o usuário vê uma coisa que o quantitativo contradiz.

## 2. Definição de pronto

Para dar a junção por concluída, todos os itens abaixo precisam valer:

1. **Desenho = quantitativo.** Para qualquer nível de teste, o volume da parede no corte e no 3D bate com o quantitativo da
   parede (tolerância 1e-6 relativa). Na planta, o corte fica numa altura acima do piso, então a parede inteira continua
   aparecendo; a planta só muda quando o plano de corte passa pela zona de sobreposição (§3, F2).
   Medida: volume (área × altura), não área, porque a parede e o piso se cruzam em faixas de cota diferentes.
   **Regra de conferência:** o volume removido é a soma, par a par, das camadas do piso que vencem as da parede (`winsOver`,
   0023 §1) × área comum × altura comum. É o que `junctionWall.test.ts` verifica.
2. **Consistência entre vistas.** Planta, corte e 3D usam a mesma região resolvida (uma única fonte: `junctionLevel`).
3. **Tabela de §9.1 da 0023 como teste.** Os casos G-B (piso F1, F2, F3 × parede W1, W2, W3, em L e T) passam como teste.
   A validação contra o Revit continua pendente e não bloqueia (ver §5).
4. **Vínculo e cache.** Editar a parede de um nível não recalcula os outros níveis (contador de recálculos, 0023 §9.2).
5. **Término por camada no perímetro externo** (P8b) funciona com o mesmo critério do interior.
6. **Gates verdes:** `npm run check`, `node tests/e2e/visual-regression.mjs` sem regressão não explicada e `npm run parity`
   sem item bloqueante aberto para junção.

## 3. Fases

Ordem obrigatória: F1 → F2 → F3 → F4 → F5. F6 e F7 podem começar depois de F1.

### F1 · Engine: partes resolvidas também das paredes

Arquivos: `packages/engine/src/junctionLevel.ts`, `packages/engine/src/junctionNet.ts` (`bandPiece` aceita índice de faixa).

- [x] Tag de cada peça de parede com `{ wallId, layerIndex, bandIndex }` (`wallBandPieces` em `junctionNet.ts`).
- [x] Partes resolvidas de cada faixa de parede: `WallJunction` em `junctionLevel.ts`, com `wallBandPartsOf(jl, wallId,
      layerIndex, bandIndex, fallback)`. Faixa com topo inclinado fica de fora do recorte (`flat` falso).
- [x] `cut` e `region` por elemento de piso e laje não mudaram de comportamento (130 testes antigos iguais).
- [x] Cache: a assinatura já inclui as peças de parede, sem mudança.

Testes (`packages/engine/src/junctionWall.test.ts`, 7 casos):
- [x] Parede que desce até a cota do piso é recortada; parede acima dela não é.
- [x] Volume removido = soma, par a par, das camadas que vencem (`winsOver`) × área comum × altura comum.
- [x] Volume que sobra + volume removido = volume cheio.
- [x] A parte que sobra não se sobrepõe à estrutura do piso na cota comum.
- [x] Parede × parede não corta.
- [x] Faixa sem parte resolvida cai na faixa inteira (fallback).

Aceite F1: `npx vitest run packages/engine` verde (2003 testes, 140 arquivos), `tsc` e `eslint` limpos nos arquivos novos.
Medição: sem mudança de valor em testes antigos.

### F1b · Parede que atravessa o nível (feito em 2026-10-23)

Problema: a junção e os quantitativos só olhavam peças do próprio nível. Uma parede do térreo que sobe até o pavimento de cima
não era cortada pela laje dele, nem no quantitativo nem no desenho.

Solução: `levelCutterSet(p, levelId)` (em `junctionNet.ts`) reúne os cortadores do próprio nível e os de outros níveis que tocam
a faixa de cota do nível. Peças de outro nível sem cota comum não entram. Junção (`junctionLevel`), quantitativos de piso, laje
e parede (`floorCutters`, `slabCutters`, `wallCutters`) usam esta mesma função, para não divergirem.

- [x] `PieceMeta` guarda `layerIndex` e `bandIndex`, para devolver a parte resolvida à camada e à faixa certas.
- [x] `junctionLevel` passa a usar `levelCutterSet`. Laje com caimento continua de fora.
- [x] Quantitativos: `quantities.ts`, `floorQuantities.ts` e `slabQuantities.ts` herdam o alcance entre níveis sem mudar a chamada.
- [x] Comentário de `quantities.ts` atualizado (a regra é par a par, inclusive com piso ou laje de outro nível).
- [x] Testes: `packages/engine/src/junctionCrossLevel.test.ts` (5 casos). Parede de 6 m perde o volume que a laje do pavimento de
      cima ocupa, e a perda bate com a soma par a par (`winsOver`). A laje não perde para a parede que ela vence. Parede de 2,80 m
      não muda. A junção do térreo marca a parede como recortada.
- [ ] Pendente: teste de desempenho com projeto de vários níveis (cada chamada percorre todos os níveis; hoje sem filtro
      por elevação). Entra em §6.2.

Medição: `npm run check` com 272 arquivos e 3.405 testes, todos passando. Nenhum teste antigo mudou de valor.

### F2 · Planta (fechada em 2026-10-23 por decisão de escopo)

Medida do código: a forma da parede na planta é `wallUnion` (`plan/build.ts`), que usa a camada inteira (`cut` ou
`fragment`) e não olha a cota do piso. O plano de corte da planta fica acima do piso, então a parede aparece inteira, e
isso é o comportamento correto para a regra B.

- [x] Decisão: a planta não recorta a parede pela cota de piso ou laje na altura de corte padrão. Só o piso e a laje
      (recortados pela junção, F1 e P7b) aparecem na planta com a região resolvida.
- [x] Não há mudança de código nesta fase. `junctionPlan.test.ts` e `junctionCrossLevel.test.ts` cobrem o que a planta lê.
- [ ] Caso não coberto: plano de corte dentro da zona de sobreposição (piso ou laje alcançando a altura de corte, por
      exemplo a planta de um nível com piso elevado). Fica em §6.2 como pendência de baixa prioridade. Se for preciso,
      exige `wallUnion` com a cota de corte da planta.

### F3 · Corte (regra B, decidida em 2026-10-23)

Decisão do dono: **B**. A zona comum de piso ou laje com parede é decidida pela junção, como no Revit (Join Geometry) e no
ArchiCAD (prioridade de material). Antes desta decisão a regra era a P6 (cota), e a parede embutida ficava inteira no corte.

- [x] `wallLayerBandsAfterJunction` em `junctionLevel.ts`, usado por `section.ts`, pelo 3D (`solids.ts`) e pela mesma fonte.
- [x] `sectionCota.test.ts` reescrito para a regra B: a parede embutida cede à zona comum; o total do corte é a união; a
      parede que sai do piso fica inteira fora dele (linha em x = −1) e cede dentro (linha em x = 3).
- [x] Decisão 0023 §3 atualizada (corte e 3D seguem a hierarquia).
- [ ] Teste de não-regressão com `junctionSection.test.ts` e a regressão visual (ver F5). A regressão visual do corte muda por
      decisão: a baseline só é regravada depois de olhar a imagem.

Aviso de consistência: após esta fase, corte, 3D e quantitativo dizem a mesma coisa para a zona comum. Antes, o 3D já seguia
a hierarquia (F4) e o corte seguia a P6, então havia divergência que esta fase fecha.

### F4 · 3D

Feito em 2026-10-23 (segue a opção A da F3: 3D segue a hierarquia, como os quantitativos).

- [x] `buildLevelSolids(r, jl)` recebe a junção (opcional, como `buildFloorSolids`); `scene3d.ts` passa `junctionLevel(p, lv.levelId)`.
- [x] Faixa recortada é extrudada só nas partes que sobram (`wallBandsOf` em `solids.ts`); a chave do cache inclui essas faixas, então a
      mudança invalida o sólido certo e nada mais.
- [x] Mesmo material e mesma chave de lote (`wallLayerKey`), então a seleção por BVH não muda de forma.
- [x] Teste: `packages/render/src/model3d/wallJunctionSolids.test.ts` (3 casos). Volume por divergência; parede acima do piso
      fica igual com e sem junção.
- [ ] Pendente: conferir o volume do 3D contra o quantitativo da mesma parede no mesmo nível (hoje o teste compara com a soma
      das partes, não com `quantities.ts`). Fica para o teste de F5 (desenho = quantitativo).

### F5 · Fechamento da junção

- [ ] **Teste de desenho = quantitativo** para todos os casos de §9.1 da 0023 (F1, F2, F3 × W1, W2, W3; L e T). Este é o
      teste de aceite da junção (§2, item 3). Arquivo sugerido: `packages/engine/src/junctionGolden.test.ts`.
- [ ] **Teste do contador de recálculos** (0023 §9.2): editar parede do nível 2 não recalcula o nível 1.
- [ ] **Lajes com caimento:** hoje ficam de fora da junção (`junctionLevel.ts`: `if (rs.slope) continue`). Decidir com o dono
      (ver §5, item 2). Até a decisão, a laje com caimento aparece com aviso `laje-caimento-sem-junção` (novo, informativo).
- [ ] Atualizar checklists: `docs/paridade/paredes.md` (E3), `docs/paridade/pisos.md` (C6), `docs/paridade/lajes.md` (C8).
- [ ] Atualizar `docs/07-STATUS-V1.md` (remover de "O que ainda não existe" e de "Pendências"), `docs/08-PENDENCIAS-E-CORRECOES.md`
      (corrigir a linha "P-5 sem código", que já está implementada) e o status de `docs/decisoes/0023-juncao-piso-laje-parede.md` (§10).
- [ ] `npm run parity` sem bloqueante aberto para junção.

### F6 · Término no perímetro externo (P8b)

Hoje o término por camada vale só para paredes internas (0023 §2). No perímetro, todas as camadas usam o mesmo contorno.

- [ ] Contorno externo por camada, usando a face externa como referência (`enclosedRooms` já gera `'finish' | 'core'`;
      o perímetro usa `outerPerimeter` em `packages/engine/src/enclosed.ts`).
- [ ] Mesmo critério de `termino.ts` (`auto`, `nucleo`, `face`, deslocamento em cm), com os testes espelhados.
- [ ] Teste: piso com acabamento que avança 5 cm sobre o perímetro externo; área do acabamento muda, a da estrutura não.

### F7 · Cor, hachura e exportação por camada (P8 restante)

- [ ] Planta: cor e hachura por camada no piso e na laje (já há hachura por material; cor por camada é a parte nova).
- [ ] DXF: uma camada de DXF por função de camada de piso e de laje (`ESTRUTURA_PISO`, `ACABAMENTO_PISO` etc., nomes a
      definir no próprio código de `packages/render/src/dxf`).
- [ ] IFC: `IfcSlab` e `IfcCovering` por camada, se a exportação já tiver a estrutura (ver `docs/07-STATUS-V1.md`: IFC não
      exporta `IfcCovering` hoje). Se não houver, registrar como item de fase futura, não como pendência desta junção.

## 4. Como verificar (comandos)

```bash
npm ci                                    # já feito em 2026-10-23
npx vitest run packages/engine/src/junction packages/render/src/plan/junctionPlan packages/render/src/model3d/junctionSolids
npm run check                             # lint + tipos + testes (portão do CI)
npm run build && node tests/e2e/visual-regression.mjs            # sem --update
node tests/e2e/visual-regression.mjs --update                    # só depois de olhar cada imagem alterada
npm run parity
```

**Regra para baseline visual.** Regravar só depois de abrir a imagem nova e a antiga e confirmar que a mudança é a
esperada (o recorte da parede), anotando no commit quais casos mudaram e por quê.

## 5. Decisões que dependem do dono

1. **P-4 (inversão de corte por par).** Sem decisão, P10 fica fora. A conclusão da junção não depende dela.
2. **Lajes com caimento.** Dentro da junção ou fora com aviso? Recomendação: fora, com aviso, até existir uma
   recorte plano por faixa inclinada, que hoje não existe.
3. **Validação no Revit da tabela §9.1.** Não é possível daqui. A tabela vira teste de especificação; a comparação com o
   Revit fica como item de conferência manual do dono.

## 6. Registro de andamento e pendências (atualizar a cada commit)

### 6.1 Commits

| Fase | Commit | Data | Observação |
|---|---|---|---|
| Plano | `9e5cc12` | 2026-10-23 | plano de conclusão |
| F1 | `e55034d` | 2026-10-23 | partes resolvidas das paredes (`WallJunction`, `wallBandCut`); 7 testes novos; sem mudança em testes antigos |
| F3 (decisão) | `e127190` | 2026-10-23 | tentativa de corte pela hierarquia revertida; conflito com a P6 registrado |
| F4 | `1a50f90` | 2026-10-23 | sólido 3D da parede recortado; 3 testes novos |
| F3 regra B | `a9181fa` | 2026-10-23 | corte pela hierarquia (regra B, como Revit e ArchiCAD); `sectionCota.test.ts` reescrito; sem mudança no 3D |
| F1b | `64a7b8e` | 2026-10-23 | cortadores entre níveis (`levelCutterSet`); 5 testes novos |

### 6.2 Pendências consolidadas da junção piso/laje × parede

Estado em 2026-10-23, depois de `a9181fa`. Cada item aponta a fase do §3 que o resolve.

| # | Item | Estado | Fase | Notas |
|---|---|---|---|---|
| 1 | Parede que atravessa o nível (laje do andar de cima corta parede do térreo, e o inverso) | feito | F1b | `64a7b8e` |
| 1b | Desempenho da junção com muitos níveis (sem filtro por elevação; cada chamada percorre todos os níveis) | pendente | F1b/perf | medir com projeto de 5+ níveis antes de otimizar |
| 2 | Planta: caso com plano de corte dentro da zona comum (baixa prioridade) | decidido, pendente só o caso raro | F2 | a planta não muda na altura padrão; ver §3 F2 |
| 3 | Regressão visual do corte (regra B) | feito | F3/F5 | caso novo `junc-corte-parede-embutida-piso`, baseline criada e conferida na imagem; cortes da casa (`01-corte`, `02-corte`) não mudaram com a regra B (0,467% antes e depois, mesmo nº de pixels) |
| 4 | Teste "desenho = quantitativo": volume 3D e corte batem com o quantitativo da mesma parede | pendente | F5 | hoje o teste de F4 compara com a soma das partes, não com `quantities.ts` |
| 5 | Tabela §9.1 da 0023 (G-B, piso F1/F2/F3 × parede W1/W2/W3, L e T) como teste | pendente | F5 | a validação no Revit é conferência manual do dono |
| 6 | Teste do contador de recálculos (nível não editado = zero recálculos) | pendente | F5 | 0023 §9.2 |
| 7 | Atualizar paridade: E3 de paredes, C6 de pisos, C8 de lajes; `npm run parity` | pendente | F5 | |
| 8 | Atualizar `07-STATUS-V1.md` e `08-PENDENCIAS-E-CORRECOES.md` | pendente | F5 | a 08 ainda diz que P-5 está sem código, o que está desatualizado |
| 9 | Término por camada no perímetro externo (P8b) | pendente | F6 | hoje só vale para parede interna |
| 10 | Cor, hachura, DXF e IFC por camada (P8 restante) | pendente | F7 | IFC pode não ter `IfcCovering`; se não tiver, vira item de fase futura |
| 11 | Lajes com caimento fora da junção | decisão pendente | F5 | sugestão: aviso `laje-caimento-sem-junção` |
| 12 | Inversão de corte por par (P-4, P10) | decisão pendente do dono | — | não bloqueia a conclusão |
| 13 | Revisão de P-4 e da tabela §9.1 no Revit | manual, dono | — | não há acesso ao Revit daqui |

### 6.3 Pendências fora da junção (de `07-STATUS-V1.md` e `08-PENDENCIAS-E-CORRECOES.md`)

Não fazem parte deste plano, mas ficam registradas para não se perderem.

- Paredes: CV-2 (curva fora do domínio: R < 3 m ou quina de 30° ou 150°), CV-3 (remover código de arco sem uso), canto reentrante do L (quadrado d × d sem parede).
- Aberturas: P13 (verga e peitoril na planta), X4 e X5 (X no DXF), P14 (janela de giro como família), basculante fora do catálogo por decisão do dono.
- Interface do nó com 3 ou mais paredes (decisão do dono, `08` §8.1).
- Mesclar `claude/wizardly-goldberg-qtjveg` em `main` (decisão do dono; `08` §8.4 e o cabeçalho divergem sobre o estado de `main`).
- CI: tirar `continue-on-error` do job `completo` quando a suíte completa estiver estável.
- Limite do sweep line em produção (`08` §4.4-d), depende de telemetria.
- Verificação visual manual das junções (`08` §10).

## 7. Regras deste plano

- Antes de cada commit: `npm run check` verde.
- Cada fase concluída: commit, push para `claude/inspiring-brahmagupta-4eh7f2`, e linha nova em §6.1.
- Pendência nova descoberta durante a implementação entra em §6.2 no mesmo commit em que é descoberta.
- Nenhum PR sem pedido explícito.
