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

### F1b · Parede que atravessa o nível (novo, achado da F1)

Problema: `wallBandPieces(p, levelId)` só olha paredes **do próprio nível**. Uma parede de dois pavimentos (base no térreo,
topo no pavimento superior) atravessa a laje do pavimento de cima, e essa laje não a corta. Isso vale para o quantitativo
(`quantities.ts:65` usa `wallCutters(p, levelId)`), para a junção do nível e para o desenho. Os números de piso e laje
também ignoram a parede de outro nível (`floorQuantities.ts:110`, `slabQuantities.ts:119`).

- [ ] Ao montar a junção de um nível, incluir as paredes de **outros níveis** cuja faixa de cota cruza a cota de algum piso
      ou laje do nível em análise (faixa absoluta: `baseZ + band.z0..z1`).
- [ ] Mesma regra nos quantitativos de piso, laje e parede (um só ponto de entrada, para não divergir).
- [ ] Teste: parede de 6 m (térreo, base 0) com laje do pavimento 1 em 2,88–3,00 m corta a parede só nessa faixa; o volume
      da parede no térreo cai pelo volume da laje sobre ela; o quantitativo da laje não muda.
- [ ] Decidir com o dono se a parede de dois pavimentos é cortada pela laje ou pelo piso do pavimento de cima (é a mesma
      regra de `winsOver`; a dúvida é só a semântica de produto).

Aceite F1b: o quantitativo total do conjunto (parede + laje) não conta a sobreposição duas vezes, nem em um sentido nem no outro.

### F2 · Planta (verificação e não-regressão)

Arquivos: `packages/render/src/plan/build.ts` (linha 90), `packages/render/src/plan/junctionPlan.test.ts`.

Na altura de corte padrão, a planta não muda: a parede aparece inteira porque o plano de corte está acima do piso. Esta fase
existe para garantir que a planta usa a mesma fonte (`wallBandPartsOf`) e que o caso em que o plano de corte passa pela
zona de sobreposição fica certo.

- [ ] Usar `wallBandPartsOf` na região da camada da planta, onde hoje entra `rw.layers[].cut`/`fragment`. Quando o plano de corte
      não toca a zona de sobreposição, o resultado tem que ser idêntico ao atual (teste de não-regressão).
- [ ] Linhas de contorno de parede (`fragment`) seguem a região recortada, sem linha fantasma sobre o piso.
- [ ] Linha de fronteira só onde o empate de prioridade deixa as duas camadas (`winsOver` = `null`).

Testes:
- [ ] Planta na altura de corte acima do piso: parede inalterada (regressão).
- [ ] Plano de corte dentro da zona de sobreposição: área da parede na planta cai pela área comum.
- [ ] Teste de regressão visual `tests/e2e/visual-regression.mjs`: caso novo `junção-piso-parede` (canto de sala).
      **Baseline regravada só depois de olhar a imagem** (ver §4).

Aceite F2: planta sem mudança na altura padrão e área cortada certa quando o plano atravessa a zona de sobreposição.

### F3 · Corte: CONFLITO DE REGRA, decisão do dono antes de codar

Tentativa feita em 2026-10-23 e **revertida**. Ela aplicava a junção (piso tira a parede) ao corte, e isso quebrou
`sectionCota.test.ts` (P6). O motivo está registrado no próprio código e na 0023 §3: a parede embutida no piso (z de −0,10 a
−0,05, dentro da faixa do piso) **sumia** do corte, de 0,200 m³ para 0,000 m³. A P6 corrigiu isso: no corte, a cota decide o
que fica por cima, a parede embutida fica inteira e o piso perde só a faixa comum. Ou seja, a regra de corte **não** é a
mesma da quantidade.

Consequência: a F3 como estava escrita contradiz a P6. Não foi implementada.

Duas opções para o dono decidir:

- **A (recomendada):** corte segue a P6 (cota). Quantitativo e 3D seguem a hierarquia. A diferença de cor na zona comum
  (quem aparece como material) é aceita e documentada. Não há código a mudar no corte; falta só o teste de não-regressão.
- **B:** corte também segue a hierarquia. Exige rever a P6: a parede embutida passa a sumir na zona comum, e o piso mostra
  a estrutura. Precisa de uma regra que mantenha a parede visível fora da zona comum (a parte que sobra).

Enquanto não houver decisão, a F3 fica bloqueada e a F4 (3D) só pode seguir se for coerente com a escolha acima.

- [ ] Decisão A ou B registrada em `docs/decisoes/0023-juncao-piso-laje-parede.md` (§13).
- [ ] Se A: teste de não-regressão do corte com a junção ativa (já existe em `sectionCota.test.ts`; manter) e nota em §3.
- [ ] Se B: reescrever a P6 em §3 e atualizar `sectionCota.test.ts` com a nova regra, antes de mudar `section.ts`.

Testes desta fase (qualquer opção): `npx vitest run packages/engine/src/sectionCota.test.ts packages/engine/src/junctionSection.test.ts`.

### F4 · 3D

Arquivos: `packages/render/src/model3d/solids.ts` (`wallLayerSolid`, linhas 337-376), `packages/render/src/model3d/junctionSolids.test.ts`.

- [ ] Gerar o sólido da camada de parede a partir das partes resolvidas (uma por faixa, com `z0`/`z1` da parte).
- [ ] Manter o mesmo material e a mesma chave de lote (`wallLayerKey`) para não quebrar seleção por BVH (`triBvh.ts`).
- [ ] Ajustar `solids.ts` ao limite de 420 linhas por arquivo se preciso (ESLint `max-lines`): extrair `wallJunctionSolids.ts`.

Testes:
- [ ] Volume do sólido 3D da camada de parede = volume do quantitativo (tolerância 1e-6 relativa).
- [ ] Seleção por clique numa parede cortada continua acertando a parede (teste em `triBvh` ou e2e).

Aceite F4: os três volumes (quantitativo, sólido 3D e área do corte) batem para o mesmo nível de teste.

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

## 6. Commits e registro

| Fase | Commit | Data | Observação |
|---|---|---|---|
| Plano | — | — | este documento |
| F1 | — | — | |
| F2 | — | — | |
| F3 | — | — | |
| F4 | — | — | |
| F5 | — | — | |
| F6 | — | — | |
| F7 | — | — | |

Quando uma fase for concluída, preencher a linha com o hash, a data e o que mudou de valor em testes antigos.
