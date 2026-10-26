# Análise técnica — snap, alças e junção de paredes

- **Data:** 2026-10-26
- **Base analisada:** `ac430af` (`feat/revit-ui-theme`)
- **Escopo:** motor de captura (`packages/tools/src/infer.ts`), alças e seleção de extremos, junção de paredes (`packages/engine/src/joins.ts` e derivados) e a interface de snap.
- **Natureza:** análise + testes de comportamento atual. **Nenhuma correção foi implementada neste commit.**

## 1. Resumo executivo

O snap atual escolhe **um único candidato** por uma tabela de prioridade fixa, sem combinar restrições e sem estado. A junção de paredes é derivada **apenas da coincidência dos eixos** (tolerância de 2 cm), não da geometria dos corpos.

Isso produz quatro sintomas principais:

1. **Canto desenhado com snap de face não vira canto.** A ponta da primeira parede fica `free` (face externa) ou as duas viram `tee` (face interna); nunca `pair`.
2. **Alinhamento “às vezes funciona”.** Qualquer candidato “forte” (endpoint/face/intersecção/etc.) descarta o alinhamento; e só é possível usar **uma** linha-guia por vez.
3. **A grade continua quantizando com “Grade Modular” desligada.** Alinhamento e ortogonal usam `ctx.gridStep` mesmo com `snap.grid = false`.
4. **A alça do extremo não está no canto visível.** Com `wallCenter` + `wt_alv14`, a alça fica a 0,092 m do canto; em zoom normal o clique no canto erra a alça e arrasta a parede inteira.

Além disso, há inconsistências de tolerância (`joinTolerance` configurável × 0,02 fixo no arrasto), alças que permitem parede de comprimento zero, ausência de faces de arco no snap e snap em geometria invisível.

## 2. Método e evidências

Foram inspecionados os arquivos citados ao longo deste documento e executados:

- **12 testes temporários** (`tests/_analise-snap.test.ts`, removido antes do commit) que **documentam o comportamento atual** — todos passaram, confirmando os defeitos abaixo.
- **43 testes existentes** de snap, follow de pontas e junção:
  - `packages/tools/src/snapFaces.test.ts`
  - `packages/tools/src/followEnds.test.ts`
  - `packages/engine/src/junctionWall.test.ts`
  - `packages/engine/src/junctionLevel.test.ts`
  - Resultado: **4 arquivos, 43 testes, todos verdes**.

Observação: os testes existentes usam encontros **exatos pelo eixo** (`drawWall` com as duas pontas em (4,0)). O caso real de desenhar pelo **canto visível** não está coberto.

## 3. Defeitos encontrados

### J-01 — Canto por snap de face não forma canto (severidade: alta)

**Sintoma:** desenhar a segunda parede no canto visível da primeira gera degrau/entalhe ou encosto deslocado, em vez de esquadria/encosto de canto.

**Evidência medida** (`wt_alv14`: espessura total 0,184 m; meia espessura 0,092 m):

| Snap usado | Ponta da 1ª parede | Ponta da 2ª parede | Resultado |
|---|---|---|---|
| Face externa, em (4; 0,092) | `free` | `tee` | Degrau/entalhe de 0,092 × 0,184 m no canto externo |
| Face interna, em (3,908; 0) | `tee` | `tee` | Dois T recíprocos; não é canto |

Nenhum dos casos resulta em `pair`; a ferramenta **Junção** só atua em `pair` (`joinTool.ts:42-44`) e não consegue corrigir.

**Causa raiz:**

- `computeEnds` agrupa pontas por distância entre **eixos** ≤ `joinTolerance` (`joins.ts:16-37`). O eixo da parede nova está a 0,092 m do eixo da existente.
- O fallback `tryTee` (`joins.ts:80-101`) não verifica se a ponta está **perto da extremidade** da hospedeira; ele só verifica se está dentro do corpo.
- `buttAgainst` escolhe a face pelo lado do ramal (`joinSides.ts:157-203`), o que no caso da face externa deixa a primeira ponta livre e a segunda parando na face.

**Correção mínima:** recusar T quando a ponta estiver na zona de extremidade da hospedeira (≈ meia espessura + tolerância) e classificar como canto, cortando pela interseção dos eixos/faces.

**Correção correta:** detectar junção pela **geometria dos corpos** (interseção das faixas + distância às pontas), não só pela coincidência de eixos.

**Critério de aceite:** desenhar uma parede começando em qualquer canto visível de outra (face externa, face interna, núcleo) resulta em `pair` e canto limpo, sem entalhe, com o mesmo resultado visual de um encontro pelo eixo.

---

### J-02 — Tolerância de junção divergente entre motor, arrasto e validação (alta)

O projeto tem `settings.joinTolerance` editável (`Properties.tsx:355`), usado pelo motor (`resolve.ts:405`, `joinStatus`). Mas:

- `followingEnds` e `connectedEnds` usam **0,02 fixo** (`pick.ts:60-81`);
- `validateJoins` usa **0,02 fixo** (`validateJoins.ts:7`).

**Teste executado:** com `joinTolerance = 0,05` e pontas a 0,03 m, `joinStatus(...).kind === 'pair'`, mas `followingEnds(...)` devolve **0** vizinhas. O motor une; o arrasto não acompanha; a validação discorda.

**Correção:** uma única fonte (`project.settings.joinTolerance`) em todos os caminhos; preferencialmente substituir a heurística de proximidade por consulta ao grafo de junções.

**Critério de aceite:** mudar a tolerância no painel altera simultaneamente geometria, arrasto de ponta, JoinTool e validação, sem casos discordantes.

---

### J-03 — Ferramenta Junção não cobre T nem nó de 3+ (média)

`JoinTool.find` só retorna `kind === 'pair'` (`joinTool.ts:33-55`). Em T, o painel mostra “Em T (encosto fixo)” somente leitura (`Properties.tsx:95`). A mensagem de erro para um T diz que “não tem outra parede para unir” (`joinTool.ts:74-90`), o que é enganoso.

**Correção:** JoinTool deve operar em nó (canto, T e 3+), com opções de tipo, dominância e “permitir/não unir”, e glifo visual no canto. Para T, oferecer “transformar em canto” quando a geometria permitir.

**Critério de aceite:** clicar em um T mostra o status correto e permite alternar/limpar a junção sem editar coordenadas manualmente.

---

### J-04 — Junção sem consciência vertical e sem aviso de quase-encosto (média)

- `computeEnds` não considera base/topo: paredes no mesmo ponto de planta mas sem sobreposição vertical são unidas.
- `unjoinedEndIssues` só avisa quando `noJoinStart/End` está ligado (`validateJoins.ts:34-55`). Uma ponta a 3 cm da outra não gera aviso.
- Esquadria em ângulo agudo retorna `null` e mantém corte reto, deixando vão sem aviso (`joinPair.ts:107-150`).

**Correção:** filtrar junção por sobreposição vertical, criar diagnóstico de “ponta quase encostada” e avisar quando a junção não puder ser resolvida.

**Critério de aceite:** pontas a até 2× a tolerância geram aviso com ação de corrigir; paredes sem contato vertical não são unidas.

---

### S-01 — Alinhamento é descartado por candidato “forte” e não combina restrições (alta)

`hasGeometrySnap` descarta o alinhamento se existir `endpoint`, `face`, `core`, `intersection`, `midpoint` ou `perpendicular` (`infer.ts:246-252`). E `pickBest` escolhe **um** candidato (`infer.ts:273-285`).

Consequências:

- perto de um canto de face, o alinhamento some;
- perto de uma aresta (`nearest`), o alinhamento ganha e puxa para fora da face;
- **duas linhas-guia não se combinam** (X + Y ou face + alinhamento).

**Teste executado:** cursor com duas referências próximas (x = 2,03 e y = 3,07) devolve **uma** guia e **um** eixo; o ponto (2,03; 3,07) não é alcançável.

**Correção:** modelo de candidatos por **restrições** (ponto na face, x = ref, y = ref, perpendicular etc.) e resolução da interseção das restrições ativas. Score por distância + intenção, com histerese.

**Critério de aceite:** face + alinhamento e dois alinhamentos produzem o ponto de interseção; a guia mostra todas as restrições ativas.

---

### S-02 — Prioridade por tipo, não por distância (alta)

`PRIORITY` (`infer.ts:50-62`) faz `endpoint` ganhar sempre, mesmo a 9,9 px, e `face` ganhar de `intersection`/`core`. Com zoom out, o **eixo invisível** rouba o canto visível; com zoom in, o canto visível ganha. O comportamento muda com o zoom.

**Correção:** custo combinado (`distância normalizada + peso do tipo`), com pesos por modo e possibilidade de alternar candidatos.

**Critério de aceite:** o candidato escolhido é estável e previsível em diferentes zooms; Tab alterna todos os candidatos dentro da abertura.

---

### S-03 — `snap.grid = false` não desliga a quantização do alinhamento/ortogonal (alta)

Em `infer.ts:211` e `:260`, o passo é `ctx.noGrid ? 0 : ctx.gridStep`; `snap.grid` não é consultado.

**Teste executado:** com `grid: false`, cursor y = 3,03 retorna alinhamento em y = **3,00**; com ortogonal, x = 3,03 retorna **3,00**. A grade continua ativa escondida.

**Correção:** respeitar `snap.grid` (ou separar “grade do alinhamento” como opção própria). Recomendação: grade desligada por padrão para modelagem.

**Critério de aceite:** “Grade Modular” desmarcada não altera coordenadas livres.

---

### S-04 — `axis` não aparece na UI e controla endpoint/midpoint/nearest (alta)

`infer.ts:103-118` coloca endpoint, midpoint e nearest do eixo dentro de `if (sn.axis)`. O popover de snap não tem a opção `axis` (`SnapButton.tsx:15-24`) e o contador não a considera.

**Teste executado:** `endpoint: true` + `axis: false` → nenhum snap de ponta de parede; o cursor fica cru.

Cenário real: “Nenhum” → religar “Extremidade” deixa `axis = false`; o botão mostra 8/8, mas pontas/médios de parede não capturam.

**Correção:** expor “Eixos de parede” e separar `endpoint`/`midpoint` de `axis`/`faces`; corrigir contador e estados.

**Critério de aceite:** cada checkbox liga/desliga exatamente o que promete; “Nenhum” + “Extremidade” volta a capturar pontas de parede.

---

### S-05 — Alça do extremo longe do canto visível (alta)

- A alça é desenhada em `e.a`/`e.b` (`planOverlay.ts:85-89`).
- `gripAt` procura só `w.a`, `w.b` e o meio do arco, com tolerância 9 px (`pick.ts:44-57`).

**Teste executado:** `wt_alv14` + `wallCenter`: o canto visível a 0,092 m não é alça em `mpp = 0,005` (18,4 px > 9 px); a alça só é encontrada no eixo.

**Consequência:** o clique no canto visível erra a alça e inicia o arrasto da parede inteira. Pior: o arrasto direto da seleção usa base **crua** (`selectTool.ts:221` e `:269-275`), enquanto a ferramenta **Mover** usa base capturada (`transformTools.ts:210-215`).

**Correção:** alça no canto visível e/ou alça de nó; base do arrasto capturada; aumentar a área de pega do extremo.

**Critério de aceite:** clicar no canto que se vê pega o extremo, não a parede inteira; Shift/Alt permitem mover o nó ou soltar uma parede.

---

### S-06 — Nó compartilhado sem escolha e sem cota temporária (média)

- Com várias paredes selecionadas, `gripAt` devolve a primeira da ordem da seleção; não há alça de nó nem Tab para escolher.
- Durante o arrasto da ponta não há cota temporária (comprimento, ângulo, Δx/Δy).
- `setWallEnds` aceita `a == b`; **teste executado:** a parede deixa de existir no motor (`frameOfWall` → `null`).
- O snap do arrasto ignora só a parede atual, não as vizinhas que acompanham (`selectGrips.ts:113`), podendo colapsar uma vizinha curta.

**Correção:** alça de nó, seleção por clique, cota temporária editável, trava de comprimento/ângulo e recusa de comprimento zero (ou remoção explícita).

**Critério de aceite:** arrastar um nó move as paredes do nó por padrão; Alt solta só a escolhida; nunca resta parede de comprimento zero.

---

### S-07 — Snap em geometria invisível ou recortada (média)

`infer` e `pickAt` recebem projeto e nível, mas não a vista. Paredes ocultas, fora do intervalo de vista ou fora do recorte continuam como alvo. Se for intencional, deve ser documentado; no Revit o snap respeita a visibilidade.

**Correção:** passar o conjunto de elementos visíveis/halftone para o contexto de inferência e filtrar candidatos; manter uma opção “capturar geometria oculta” se necessário.

**Critério de aceite:** parede oculta/fora da vista não gera marcador nem altera o ponto.

---

### S-08 — Faces de parede usadas no snap não são o contorno visível (média)

`wallFaces` monta as tampas como uma **corda reta** entre `sHi` e `sLo` (`faces.ts:33-34`). Em junções com degraus/esquadria, a corda passa por dentro da parede. No encosto, a face do seguidor vai até a linha de centro da dominante (`joinSides.ts:157-203`), mas o trecho enterrado é removido apenas na pintura.

**Consequência:** o marcador pode aparecer num ponto que não existe visualmente; o snap não é recortado pelo resultado final.

**Correção:** gerar candidatos a partir do contorno resolvido/recortado (ou recortar as linhas pela silhueta), e expor os vértices reais da junção como snap “Canto de parede”.

**Critério de aceite:** todo marcador de face/canto cai sobre uma aresta visível da parede.

---

### S-09 — Paredes curvas têm snap incompleto e aproximado (média)

- `nearWalls` mede distância à **corda** (`infer.ts:102`).
- `intersections` usa `intersectSegments` das cordas (`infer.ts:171-179`).
- `perpendicular` usa a corda (`infer.ts:119-130`).
- `wallFaces` devolve `faces: []` para as laterais do arco (`faces.ts:36-37`); `faceTracks` acaba tratando tampas como faces (`infer.ts:195`).

**Testes executados:**

- perpendicular em arco com flecha 1 m devolve **(2; 0)**, que está 1 m fora do arco;
- `wallFaces` de uma parede curva devolve **2** segmentos (só as tampas) e `core` vazio.

**Correção:** distância e interseção analíticas de reta×arco e arco×arco, perpendicular pela tangente, faces de arco, tangência, centro e quadrante.

**Critério de aceite:** snap em face de arco e interseção arco×reta cai exatamente na curva.

---

### S-10 — `ignore` não cobre pontos extras e a base soma vértices de piso (média)

`ToolBase.ctx` sempre adiciona `floorVertices` (`base.ts:62-75`), mesmo quando o piso está sendo movido e está no `ignore`. O `infer` filtra `ignore` apenas para paredes.

**Teste executado:** com `ignore: {'f1'}` e um vértice extra em (5;5), o snap continua retornando `endpoint` nesse ponto. Na prática, o elemento arrastado pode grudar nos próprios vértices.

**Correção:** associar `hostId`/origem aos pontos extras e filtrar por `ignore`; o mesmo vale para faces e arestas de outros elementos.

**Critério de aceite:** mover um piso não captura os vértices do próprio piso.

---

### S-11 — Aberturas e desempenho (baixa/média)

- `hostUnder` aceita qualquer eixo a até 0,3 m + 10 px (`infer.ts:288-297`); entre duas paralelas pode hospedar na errada.
- `occupiedRanges` só compara largura, ignorando peitoril/altura (`infer.ts:300-308`): janela sobre porta é recusada.
- Não há snap para batente, outra abertura, ponta de parede ou cota temporária na inserção.
- `F3` desliga o `infer`, mas o `hostUnder` continua ativo.
- `infer` varre todas as paredes e faces por movimento, sem índice espacial (o `pickIndex` existe para seleção). Com 200 paredes o custo é ~1 ms/chamada; em projetos grandes vira teto.

## 4. O que precisa ser alterado

### P0 — corrigir a confiança

1. **Junção por geometria + classificação de canto/T**
   - `packages/engine/src/joins.ts`: `groupEnds`, `findTee`, `joinStatus`.
   - Criar nó de junção derivado (canto, T, X), com distância às pontas e interseção de corpos.
   - Ao criar/arrastar com snap de face perto de uma ponta, normalizar para o nó (ou criar canto), nunca T.
   - Critérios J-01/J-04.

2. **Tolerância única e grafo**
   - `packages/tools/src/pick.ts`: `followingEnds`/`connectedEnds` deixam de usar 0,02 fixo.
   - `packages/model/src/validateJoins.ts`: usar `settings.joinTolerance`.
   - `packages/tools/src/selectGrips.ts` e `packages/tools/src/edit.ts`: follow pelo grafo, não por proximidade.
   - Critério J-02.

3. **Motor de snap por restrições**
   - `packages/tools/src/infer.ts`: novo modelo de candidato (`constraint[]`), resolução de interseções, score distância + tipo, histerese, ciclo de todos os candidatos.
   - `packages/tools/src/types.ts`: `SnapKind`/`Inference` com origem (`refs`, `hostId`, `nodeWalls`).
   - Critérios S-01/S-02.

4. **Respeitar `snap.grid` e expor `axis`**
   - `infer.ts:211` e `:260`: consultar `sn.grid`; `ctx.noGrid` continua para ferramentas específicas.
   - `apps/web/src/ui/SnapButton.tsx`: item “Eixos de parede”, contador correto, “Nenhum”/religar consistente.
   - Critérios S-03/S-04.

5. **Alças e edição de extremos**
   - `packages/tools/src/pick.ts`: alça no canto visível/nó, prioridade por clique.
   - `packages/render/src/plan/planOverlay.ts`: desenhar alças de canto/nó.
   - `packages/tools/src/selectGrips.ts`: base capturada, ignorar vizinhas que acompanham, cota temporária, recusa de comprimento zero.
   - `packages/tools/src/selectTool.ts`: usar a base capturada no arrasto direto.
   - Critérios S-05/S-06.

### P1 — consistência e geometria

6. **Contorno visível no snap**: `packages/engine/src/faces.ts` e `infer.ts` — candidatos recortados pela silhueta, vértice real de junção, snap “Canto de parede”.
7. **Paredes curvas**: `infer.ts` e `faces.ts` — arco analítico, faces de arco, interseção reta×arco/arco×arco, tangente, centro.
8. **Visibilidade**: `ToolBase.ctx`/`infer` — receber a vista e filtrar ocultos/fora do recorte.
9. **JoinTool**: `joinTool.ts` — T e nó, “permitir/não unir”, dominância, glifo.
10. **Validação**: `validateJoins.ts` — quase-encosto, ângulo agudo sem vão silencioso, sobreposição vertical.

### P2 — polimento

11. Aberturas: `hostUnder` mais restrito, snap de batente/aberturas, `occupiedRanges` com peitoril/altura, cota temporária.
12. `ignore` nos pontos extras (`base.ts`, `infer.ts`).
13. Índice espacial no `infer` (reutilizar a ideia do `pickIndex`).
14. Snap de arestas de piso/laje/telhado/ambiente e tangência/centro de arco.
15. Tooltips com nome do elemento e destaque da aresta de origem.

## 5. Testes a criar (permanentes)

1. Canto com snap na face **externa**: deve resultar em `pair` e canto limpo (hoje: `free` + `tee`).
2. Canto com snap na face **interna**: deve resultar em `pair` (hoje: `tee` + `tee`).
3. Canto pelo eixo (caso atual) continua funcionando.
4. `snap.grid = false` não quantiza alinhamento/ortogonal.
5. “Nenhum” → “Extremidade” → ponta de parede captura (hoje depende de `axis`).
6. Duas referências de alinhamento produzem o ponto de interseção.
7. Face + alinhamento produzem o ponto de interseção.
8. Clicar no canto visível pega a alça do extremo.
9. Arrastar nó de 3 paredes: move o nó por padrão; Alt solta uma.
10. Arrastar ponta até a outra ponta: recusa/remove, nunca comprimento zero.
11. `joinTolerance` alterado: motor, follow, JoinTool e validação concordam.
12. Parede oculta/fora do intervalo não é alvo.
13. Face de arco e interseção arco×reta.
14. Mover piso não captura os próprios vértices.
15. Junção em T e nó editável pela ferramenta Junção.

## 6. Riscos e decisões

- **Compatibilidade:** mudar a classificação de canto/T altera a geometria de projetos existentes que foram desenhados com snap de face. Recomendação: aplicar na leitura (derivada) e manter os dados intactos; validar com o `visual:juntas` e com os testes de propriedade de junção.
- **Grade padrão:** desligar a grade por padrão muda o comportamento de desenho; é a recomendação, mas precisa de aval do dono do projeto.
- **Alça no canto visível:** define se o arrasto move o eixo ou a face; a semântica precisa ficar explícita (o modelo continua com linha de localização).
- **Arcos:** exigem decisões de domínio (raio mínimo, ângulo de canto) já documentadas em `docs/08`; manter os avisos existentes.

## 7. Checklist de aceite final

- [ ] Canto desenhado por qualquer snap (eixo, face externa, face interna, núcleo) vira canto, sem degrau.
- [ ] Nenhuma ponta “quase encostada” fica sem aviso.
- [ ] Alinhamento combina duas restrições e não depende do tipo do candidato.
- [ ] Grade desligada não quantiza nada.
- [ ] Cada checkbox do Snap controla exatamente o que promete.
- [ ] Clicar no canto visível pega o extremo.
- [ ] Arrastar nó/extremo tem cota temporária e não cria parede de comprimento zero.
- [ ] Snap só na geometria visível.
- [ ] Paredes curvas têm face/interseção/perpendicular reais.
- [ ] JoinTool resolve canto, T e nó.

## 8. Arquivos-chave

| Área | Arquivos |
|---|---|
| Snap | `packages/tools/src/infer.ts`, `packages/tools/src/types.ts`, `packages/tools/src/base.ts` |
| Alças/seleção | `packages/tools/src/pick.ts`, `packages/tools/src/selectGrips.ts`, `packages/tools/src/selectTool.ts`, `packages/render/src/plan/planOverlay.ts` |
| Junção | `packages/engine/src/joins.ts`, `joinSides.ts`, `joinPair.ts`, `joinNode.ts`, `faces.ts`, `packages/model/src/validateJoins.ts`, `packages/tools/src/joinTool.ts` |
| UI | `apps/web/src/ui/SnapButton.tsx`, `apps/web/src/ui/Properties.tsx`, `apps/web/src/editor/controller.ts` |
| Testes | `packages/tools/src/snapFaces.test.ts`, `followEnds.test.ts`, `packages/engine/src/junction*.test.ts` |
