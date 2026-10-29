# D · Auditoria de código — Ambientes (rooms)

Escopo: a ferramenta de ambientes do Hestia (monorepo `packages/*` + `apps/web`), do clique ao desenho, do modelo ao
IFC/DXF. Auditoria de leitura: **nenhum arquivo do repositório foi alterado**. As confirmações marcadas com
"**confirmado (sonda)**" foram obtidas rodando um script descartável fora do repositório
(`%TEMP%\opencode\roomprobe*.mts`, via `npx vite-node`), importando os pacotes por caminho absoluto; nada foi gravado em
`packages/` ou `apps/`.

Legenda de confiança: **confirmado (código)** = lido no código; **confirmado (sonda)** = reproduzido em execução;
**suspeita** = não reproduzido, com receita de confirmação.

Arquivos lidos (mínimo pedido, todos lidos por inteiro ou nas regiões citadas): `packages/model/src/{room,roomCommands,
validateRooms,types,commands,migrate,annotations,wall,wallType}.ts`, `packages/engine/src/{rooms,roomSchedule,enclosed,
frame,faces,resolve}.ts`, `packages/tools/src/{roomTool,roomCreate,roomPick,roomSeparatorTool,roomSeparatorPick,
shortcutDefaults,enclosed,testEnv,selectTool,floorPick,slabPick}.ts`, `packages/render/src/plan/{rooms,build,view,
resolucao,planContext,notes,style}.ts`, `apps/web/src/ui/{RoomProperties,PlacementProperties,OptionsBar,fields}.tsx`,
`apps/web/src/editor/{roomActions,contextMenu,deleteIds,transfer,dxfExport,avisosProjeto,state}.ts`,
`packages/io/src/ifc/{ifcSpaces,ifcSpaces.test}.ts`, `packages/io/src/ifcImport/mapping.ts`, `packages/io/src/dxf.ts`,
testes citados e `docs/paridade/ambientes.md`, `docs/decisoes/0018`, `docs/05-REFERENCIA-REVIT-ARCHICAD.md §6`.

---

## 1. Mapa do fluxo atual — do clique ao desenho

### 1.1 Pré-visualização (cursor)

| # | Onde | O que acontece |
|---|---|---|
| 1 | `packages/tools/src/shortcutDefaults.ts:33` | atalho `Z` cria a ferramenta `room` (`'7'` é o separador, linha 34) |
| 2 | `packages/tools/src/index.ts` (fábrica `createTool`) → `roomTool.ts:23` | `RoomTool` inicia (`ToolBase.start`) |
| 3 | `roomTool.ts:39` `move()` → `roomTool.ts:80` `showAt()` | a cada movimento do mouse |
| 4 | `engine/src/rooms.ts:143` `roomRegionAt()` | `frameCount()===0` → `'fora'`; senão `classifyPoint(at, regionSetCached(...))` |
| 5 | `rooms.ts:156` `regionSetCached()` | assinatura `wallsSignature(p,levelId) + JSON.stringify(levelRoomSeparators)` → cache por nível |
| 6 | `rooms.ts:77` `regionSet()` | `wallFaces(p,levelId).map(w=>w.outline)` → `union` → `closeGapsSafe`; caixa + `MARGIN=1 m`; `difference(frame, walls)`; `roomSeparatorBands()` → `difference(open,bands)` → `dropBandHoles()` |
| 7 | `rooms.ts:130` `classifyPoint()` | acha o polígono livre que contém o ponto; se o anel externo dele toca a moldura → `'aberto'`/`'fora'` |
| 8 | `roomTool.ts:88-92` | empilha `polygon` (contorno), furos tracejados e `label` com `nextRoomNumber()` + `interiorPoint()` |

### 1.2 Clique que cria

```
roomTool.ts:44 click()
  → roomRegionAt()            (mesmo caminho acima; é a 3ª vez que o nível inteiro é conferido)
  → guarda de duplo clique    (Date.now() < 600 ms e ≤ 4 px)          roomTool.ts:56
  → repeated = roomsOnLevel(...).some(r => pointInPolygon(r.point, polygon))   :59
  → roomDraft()               roomCreate.ts:30  (nextRoomNumber + makeRoom)
  → env.exec({type:'addRoom'})                                        :73
```

`env.exec` chega ao `editor.store` (`apps/web/src/editor/controller.ts:72-80`) → `ProjectStore` (Immer) →
`applyCommand` (`model/src/commands.ts:197`) → `applyRoomCommand` (`roomCommands.ts:8`) → `p.elements[id] = {...room,
order: p.nextOrder++}`. Um passo de desfazer. Depois `setSelection` + `say` (mensagem com a área e, se for o caso, o
aviso de duplicado).

O botão **"Ambientes em todos os circuitos fechados"** (`ui/OptionsBar.tsx:137-141`) segue outro caminho:
`editor/roomActions.ts:9` → `roomsForEnclosedCircuits` (`roomCreate.ts:39`) → `enclosedRooms` do motor → uma transação
com N `addRoom`.

### 1.3 Desenho

```
projeto novo (Immer) → ViewportCanvas
  → planViewOf(p, levelId)                     render/src/plan/view.ts:155   (memo por projeto)
  → buildPlanDrawList → buildPlanGeometry      render/src/plan/build.ts:402/140
  → roomOps(p, levelId, ..., hidden, paint.room)   build.ts:235 → render/src/plan/rooms.ts:36
      ambientesDoNivel()  → memoDoProjeto(p, 'ambientes|lv', resolveRooms)   plan/resolucao.ts:29
      fills  ← r.polygon (externo + furos)
      labels ← roomLabelAt(r) = labelPoint([r.polygon])   rooms.ts:29 → plan/floors.ts:51
  → buildPlanOverlay → roomSelectionOps (realce)          rooms.ts:70
  → noteOps → roomSeparatorStrokes (tracejado, categoria "anotação")   plan/notes.ts:88/96
```

Categoria oculta: `view.ts:89` `categoryHiddenIds()` inclui os `roomId` resolvidos em `hidden` (linha 103), então
`roomOps` (linha 49, `hidden?.has`) esconde o ambiente — comportamento coerente com o DXF.

### 1.4 Saídas e validação

| Saída | Entrada | Observação |
|---|---|---|
| Avisos | `editor/avisosProjeto.ts:5` → `roomValidationIssues` (`rooms.ts:211`) + `validateProject` → `roomIssues` (`validateRooms.ts:17`) | `resolveAllRooms` roda 300 ms depois de cada edição |
| DXF | `editor/dxfExport.ts:204-210` → camadas `AMBIENTES` / `AMBIENTES_TEXTO` (`io/src/dxf.ts:156-158`) | separadores **não** saem |
| IFC | `io/src/ifc/ifcSpaces.ts:69` `addSpaces` + `Qto_SpaceBaseQuantities` | usa `resolveRooms` (importa `@hestia/engine`; a própria nota do arquivo, linhas 1-3, registra a violação de fronteira `io → engine`) |
| Tabela/CSV | `engine/src/roomSchedule.ts:55` / `:113` | **sem fiação na UI** (ver B11) |
| Import IFC | `io/src/ifcImport/mapping.ts:324` `addRoom` | ver B12 |

---

## 2. Modelo de dados: gravado × derivado

### 2.1 O que é gravado

`packages/model/src/types.ts:526-548` — `Room` mora em `p.elements` (como piso/laje), por nível:

```ts
export interface Room {
  id; kind:'room'; levelId; name; number; point: Vec2;
  heightOffset?: number;   // base em relação ao nível
  ceilingHeight?: number;  // pé-direito; ausente = defaults.wallHeight
  floorFinish?; wallFinish?; ceilingFinish?; color?;
  order; ifcProperties?;
}
```

`packages/model/src/types.ts:152-157` — separadores moram no **nível**, não em `elements`:

```ts
export interface RoomSeparator { id: Id; a: Vec2; b: Vec2 }   // level.roomSeparators
```

### 2.2 O que é derivado (nunca gravado)

| Derivado | Onde | Como |
|---|---|---|
| `polygon` (anel + furos) | `rooms.ts:133` | interseção do ponto com o espaço livre do nível |
| `problem` (`fora`/`aberto`) | `rooms.ts:130-137` | o polígono livre contém o ponto? toca a moldura? |
| `area` (líquida) | `rooms.ts:195` | `polygonArea` = \|externo\| − Σ\|furos\| (`geom/polygon.ts:20`) |
| `perimeter` | `rooms.ts:196` | `ringLength(polygon[0])` — **só o anel externo** (furos não contam) |
| `volume` | `rooms.ts:203` | `area * roomCeilingHeight(p,r)` |
| `duplicateOf` | `rooms.ts:197-202` | `Map<Polygon, Id>` por identidade de array |
| etiqueta (texto/posição) | `render/.../rooms.ts:21/29` | `nome (número) · área`; posição = centroide com fallback |
| corpo/quantitativos IFC | `ifcSpaces.ts:76-105` | do polígono resolvido |
| geometria DXF | `dxfExport.ts:206-210` | do polígono resolvido |

### 2.3 Prós e contras dessa escolha

**Prós**
- Contorno nunca fica defasado: mover/espessar parede recalcula área, perímetro, volume, planta, DXF e IFC de uma vez.
- Modelo minúsculo (≈ 10 campos), serialização estável, migração v16→v17 vazia por construção (`migrate.ts:191-193`).
- Desfazer qualquer edição de parede "conserta" o ambiente sem passos extras (o contorno é recomputado).
- Uma única fonte para planta, tabela e IFC — não há dois números de área.

**Contras (consequências reais, não teóricas)**
- **Não há contorno próprio**: não dá para editar a linha do ambiente, nem "fixar" a área medida; depende de circuito
  fechado, senão área 0 (ver B3/B4/B9).
- **Área não sobrevive a importação IFC**: o IFCSPACE tem polígono autoritativo, mas o importador guarda só um ponto
  (`mapping.ts:340`) — a área passa a depender das paredes importadas (B12).
- **Sem `roomBounding` por elemento**: toda parede do nível delimita, inclusive divisória baixa, guarda-corpo ou parede
  acima do corte. Não há como excluir um elemento do cálculo.
- **Custo**: um `union`/`difference` de todo o nível por mudança de assinatura; o cache é a única defesa (B1, B14).
- **Estados "fantasma"**: ambiente com área 0 continua no modelo, entra na validação, não é desenhado nem selecionável
  por clique (B9).
- **Duplicata permitida** dobra a área nos totais (B6).

### 2.4 Campos que faltam para paridade com Revit/ArchiCAD

`docs/05-REFERENCIA-REVIT-ARCHICAD.md:120-121` já **decidiu** `bordaDeCalculo` por projeto e `roomBounding` por
elemento; nenhum dos dois existe no código (grep por `roomBounding|bordaDeCalculo` não retorna nada em `packages/` nem
em `apps/`).

| Falta | Revit | ArchiCAD (Zone) | Impacto hoje |
|---|---|---|---|
| Limite de cálculo (`bordaDeCalculo`: acabamento / núcleo / eixo / eixo do núcleo) | Area and Volume Computations | Borda interna × linha de referência | só existe "face de acabamento"; `RoomExtend='core'` existe no motor (`enclosed.ts:36`) mas **não** é usado por `resolveRooms` |
| `roomBounding` por elemento | parâmetro em parede/pilar/laje | — | divisória baixa/guarda-corpo delimitam |
| Limite superior (nível + deslocamento) | Upper Limit + Limit Offset | altura da zona | só um número (`ceilingHeight`); não referencia nível |
| `unboundHeight` (altura livre) | Unbounded Height (quando não há limite) | — | não existe |
| `heightOffset` coerente com o volume | Base Offset | — | existe no IFC (`ifcSpaces.ts:81`) mas **não** entra no volume |
| Área bruta × líquida / área medida | Gross/Net + "Area" como parâmetro de instância | área medida ± polígono separados | só líquida derivada |
| Perímetro bruto / com furos | Perimeter (inclui aberturas conforme regras) | perímetro da zona | perímetro = só anel externo |
| Categoria / ocupação / departamento / fase | Occupancy, Department, Phase Created/Demolished, Design Option | Zone Category, Zone Number, Renovation Status | só 3 acabamentos texto livre + `ifcProperties` |
| Etiqueta (posição, rotação, tipo, mostrar/ocultar, diretriz) | Room Tag | Zone Stamp | etiqueta automática no centroide, sem posição própria |
| Identidade estável do número | Number + formato | Zone Number | texto livre, sem unicidade (B7) |
| Separação com estilo/prancheta | Room Separation Line (categoria) | — | `RoomSeparator` só `{id,a,b}`; sem fase, sem camada |

---

## 3. Bugs e riscos concretos

Ordenados por gravidade. Linhas conferidas no estado atual do repositório.

### B1 · P0 · Cache de região ignora `sag` (parede em arco): área defasada **e** contaminação entre projetos

`packages/engine/src/enclosed.ts:43-51` monta a assinatura com id, tipo, extremidades, `sHi/sLo` e junções:

```ts
return `${w.id}:${w.typeId}:${r(f.a.x)},${r(f.a.y)}:${r(f.b.x)},${r(f.b.y)}:${r(f.sHi)},${r(f.sLo)}:...`;
```

`sag` (flecha do arco, `types.ts:266`) **não** entra. `regionCache` (`rooms.ts:149`) é global e guarda **uma** entrada por
`levelId`; um `hit` devolve o `RegionSet` calculado de outro projeto/imutável.

Cenário que quebra: arrastar a **alça do meio de uma parede em arco** — `selectGrips.ts:147` executa
`updateElements {sag}` sem tocar em `a`/`b`; o mesmo acontece ao **Aparar** um arco (`trimTool.ts:216`). A
área/perímetro/volume do ambiente não muda e o desenho continua com o contorno antigo. Pior: como ids e posições são os
mesmos, o próximo projeto que tiver `lv_0` + `w_0..w_3` naquelas posições herda a região do arco.

**Confirmado (sonda)**:

```
projeto A (arco, sag 0,4): área 21.3391
projeto B NOVO (paredes retas, mesmos ids): área 21.3391   ← cache de A
projeto B após resetRegionCache():          20.0000
```

Correção: incluir `w.sag` (e um `SIG_VERSION`) na assinatura **e** trocar a chave por `WeakMap<Project, Map<levelId,
...>>` — a justificativa do comentário ("o projeto é imutável, a identidade não serve de chave", `enclosed.ts:41`) vale
para *dentro* de um projeto, não para uma `Map` global. Riscos irmãos: `roomsCache`/`perimeterCache` (`enclosed.ts:78-79`)
usam a mesma assinatura — o contorno de piso/laje derivado também fica defasado após editar um arco.

### B2 · P1 · `dropBandHoles` descarta furo de pilar usando a **caixa alinhada** da faixa

`rooms.ts:99-106`:

```ts
const boxes = bands.map((b) => boxOf(b.flat()));
return m.map(([outer, ...holes]) => [outer!, ...holes.filter((h) => !inBand(h))]);
```

`inBand` testa se a **bbox** do furo cabe na **bbox** da faixa. Numa faixa diagonal a bbox é enorme (um separador de
45° numa sala 4×5 tem bbox 4×5).

Cenário que quebra: sala 4×5, pilar 0,3×0,3 em (2;1), separador diagonal de (0;5) a (4;0). O pilar está a 1,5 m da
linha, mas dentro da bbox → o furo é removido e a área é superestimada em 0,09 m², com o preenchimento do ambiente
passando por cima do pilar.

**Confirmado (sonda)**: sem separador, 19,9100 m² e 2 anéis (com furo); com o separador diagonal, **9,9968 m² e 1 anel**
(o esperado era ≈ 9,907 = 10 − 0,09 − perda da faixa).

Correção: testar o furo contra o retângulo **orientado** (projetar os vértices no eixo da faixa e comparar
`|s| ≤ W/2` e `t ∈ [−EXT, L+EXT]`), não contra a AABB.

### B3 · P1 · "Ambientes em todos os circuitos" usa uma geometria **sem separadores** e cria ambiente com área 0

`roomCreate.ts:43` percorre `enclosedRooms(p, levelId, 'finish')` — que **não** conhece `levelRoomSeparators`
(`enclosed.ts:97-116` só usa paredes). O ponto vem de `interiorPoint` (meio da maior faixa na linha média da **bbox**,
`roomCreate.ts:20-26`). Depois `resolveRooms` classifica o ponto **com** os separadores.

Cenário que quebra (o mais natural possível): sala 4×5, um separador horizontal no meio (`y=2,5`). O polígono de
`enclosedRooms` é a sala inteira; `interiorPoint` devolve exatamente `(2; 2,5)` — **em cima da faixa de 1 mm**. O
ambiente nasce com `problem='fora'`, área 0, invisível na planta. E o outro lado do separador não recebe ambiente
nenhum, porque `covered` (`:44`) considera o circuito inteiro coberto.

**Confirmado (sonda)**:

```
enclosedRooms com separador: 1 polígono, interiorPoint {x:2, y:2.5}
ambientes propostos: 1  → '1@2,2.5'
roomRegionAt(2;2.5) → problem 'fora'
```

Correção: enumerar regiões com a mesma fonte de `resolveRooms` (exportar `roomRegions(p, levelId)` de `rooms.ts`,
reaproveitando `regionSet` com separadores) e rejeitar pontos dentro de faixa (`pointInMulti` nas bands). Bônus: escolher
o ponto por "polo de inacessibilidade" (ver B15).

### B4 · P1 · `enclosedRooms` e `resolveRooms` divergem quando a face interna está no eixo

`enclosed.ts:19-21` usa `bandRing(f, f.sHi, f.sLo)` (faixa crua, sem junções); `rooms.ts:78` usa `wallFaces().outline`
(com esquadria/encosto/T). Com `locationLine:'finishInterior'`, `exteriorOffset` = espessura total (`frame.ts:44-45`):
a faixa fica de um lado do anel e, nos cantos, as faixas só se tocam no **ponto** — vazando o circuito.

Cenário que quebra: o usuário escolhe "Linha de localização: face interna" na barra de opções (é uma opção normal, e o
teste dourado do motor usa exatamente essa configuração) e clica em **Ambientes em todos os circuitos**: nada é criado,
sem nenhuma mensagem de erro além do texto padrão.

**Confirmado (sonda)** (retângulo 4×5, quatro paredes):

| locationLine | `enclosedRooms` | `resolveRooms` (área) |
|---|---|---|
| wallCenter | 1 polígono | 18,378 |
| finishInterior | **0 polígonos** | 20,000 |
| finishExterior | 1 | 16,823 |
| coreCenter | 1 | 18,378 |
| coreInterior | 1 | 19,606 |

Correção: `computeRooms` deve usar `wallFaces().outline` (o mesmo `outlinePieces` de `enclosed.ts:133`), como
`rooms.ts` já faz. Isso elimina a classe inteira de divergência (e a dependência de orientação do anel).

### B5 · P2 · `'aberto'` × `'fora'` erra o diagnóstico dentro da bbox das paredes

`rooms.ts:135`:

```ts
if (holder[0]!.some(onFrame)) return { problem: insideBox(at, set.wallBox) ? 'aberto' : 'fora', polygon: null };
```

`wallBox` é a bbox **das paredes**, não da edificação. Num prédio em L/U, o pátio interno e o vão do L estão dentro da
bbox → o usuário recebe "Circuito aberto: há um vão entre as paredes, feche-o para criar o ambiente" ao clicar **fora**
da casa, onde não há vão nenhum.

**Confirmado (sonda)**: U aberto para cima, ponto no pátio (4;2) → `'aberto'`; ponto na sala (1;2) → `null`; longe
(20;20) → `'fora'`.

Correção: decidir `'aberto'` por proximidade real a paredes (ou por "o ponto está dentro do contorno externo da
edificação", via `outerPerimeter`/`buildingOutlines`) em vez de bbox. O texto de erro também deveria citar o separador
(como faz `ROOM_PROBLEM_TEXT.fora`, `roomTool.ts:10`).

### B6 · P1 · Ambiente duplicado: permitido por padrão e **somado** nos totais

`roomTool.ts:59,75` só **avisa** ("Este circuito já tinha ambiente (aviso de duplicado)") e grava; `rooms.ts:199-201`
marca `duplicateOf`; `roomSchedule.ts:83-88` soma todas as linhas e `ifcSpaces.ts:73-77` exporta um `IFCSPACE` por
ambiente.

**Confirmado (sonda)**: dois ambientes no mesmo circuito → `1:21.34 dup=-` e `2:21.34 dup=a`, soma **42,68** para uma
sala de 21,34. No IFC saem dois espaços sobrepostos; no CSV idem (se a tabela existir, B11).

Sobre `Map<Polygon, Id>` (`rooms.ts:192`): **funciona**, e por um motivo específico — `classifyPoint` devolve a mesma
referência de `set.free` para os dois ambientes dentro da mesma chamada, e `regionSetCached` é chamado **uma vez** por
`resolveRooms`. É correto, mas frágil: qualquer `structuredClone`/`deepFreeze` do polígono, ou um cache que devolva
cópias, desliga a detecção **em silêncio**. Vale trocar por índice do polígono em `set.free` (ou `polygon[0][0]` +
área como chave), com comentário.

Correção: (a) bloquear a criação quando o circuito já tem ambiente (comportamento Revit; reusa/seleciona o existente) e
(b) excluir `duplicateOf !== undefined` de totais, CSV e IFC — ou marcar a linha como "duplicado" e não somar.

### B7 · P1/P2 · Numeração: número manual repete, não incrementa, e convive com "07" × "7"

```ts
// roomCreate.ts:8-13
const n = rooms.length + 1;
while (used.has(String(n))) n += 1;
```

- É **contagem + 1**, não máximo + 1: apagar o ambiente 2 de {1,2,3} deixa a numeração {1,3} e o próximo vira **4**
  (buraco permanente no 2).
- Compara texto exato: {07, 1, 3} → próximo **4**; com 6 ambientes e um deles "07", o automático pode gerar **7** e
  exibir dois "sete" (`07` e `7`). **Confirmado (sonda)** para `nextRoomNumber`.
- `options.roomNumber` (`roomTool.ts:65`, `PlacementProperties.tsx:100`) é **sticky e fixo**: se o usuário digita "7",
  **todos** os ambientes seguintes saem "7" (o auto só vale quando o campo está vazio). Revit trata o campo como número
  inicial e incrementa.
- Nome: `Ambiente N` com N de `nextRoomNumber`; com nome manual sticky, todos os ambientes ficam com o mesmo nome
  (aceitável, é o padrão Revit), mas a combinação nome fixo + número fixo gera duplicatas invisíveis.

### B8 · P1 · Volume com `ceilingHeight` ≤ 0 e `heightOffset` ignorado

`rooms.ts:203` `volume = area * roomCeilingHeight(p,r)`; `room.ts:18` devolve `r.ceilingHeight ?? defaults.wallHeight`.

**Confirmado (sonda)**: `ceilingHeight: 0` → volume **0** (ambiente some do IFC: `ifcSpaces.ts:80` exige `> 0`, mas a
tabela/CSV continuam mostrando a linha com área); `ceilingHeight: -1` → volume **−20**. A UI só limita na digitação
(`fields.tsx:59` `Math.max(min, v)` com `min=0.1` em `RoomProperties.tsx:68`), o que não protege JSON editado, import
IFC (ver B12) nem `updateElements` em lote. `heightOffset` não entra em nenhuma conta (só no IFC), então "base 0,5 m +
pé-direito 2,8" dá o mesmo volume de "base 0".

Correção: validar no modelo (`validateRooms.ts`: `ceilingHeight > 0`, `heightOffset` finito) **e** no comando (recusar),
mais coerência entre tabela, IFC e propriedades.

### B9 · P2 · Ambiente órfão (parede apagada) fica invisível e não selecionável

`resolveRooms` devolve `polygon:null`; `roomPick.pickRoomAt` (`roomPick.ts:8`) e `roomIdsInBox` (`:24`) pulam
`!r.polygon`; `roomOps`/`roomRegion` também. Só o painel de avisos chega nele (`issuesView.ts:72-74` + `goToIssue`).

**Confirmado (sonda)**: apagar `w_0` → `problem 'aberto'`, `polygon null`, área 0. Note que o diagnóstico vira
"aberto" (B5), não "fora". Não há como apagar o ambiente pelo desenho.

### B10 · P2 · Selecionar um ambiente por clique é bloqueado pelo piso

Ordem de pick em `selectTool.ts:110-126`: escada → **piso** (`:113`) → laje → forro → telhado → genérico → **ambiente**
(`:125`). `pickFloorAt` aceita qualquer ponto **dentro** do polígono (`floorPick.ts:29` `pointInMulti`). Como o
template padrão tem piso sob os ambientes, clicar no meio da sala seleciona o piso. O comentário em `selectTool.ts:124`
diz que isso é intencional ("o piso e a parede sob o cursor ganham o clique"), mas o resultado é que o ambiente — que é
o que está desenhado em cima do piso (`build.ts:235`, comentário "Ambientes sobre os pisos ... e sob as paredes") — não
tem alvo de clique. Janela de seleção inclui ambos (`:346`), o que mascara o problema em "Selecionar".

Correção: preferir `room` quando o clique não estiver a poucos px da borda de um piso, ou oferecer filtro/ciclo de
seleção (Tab) como no Revit.

### B11 · P2 · Tabela de ambientes e CSV existem no motor e **não** estão ligados na UI

`buildRoomSchedule` (`roomSchedule.ts:55`), `filterRoomRows`, `roomScheduleToCsv` (`:113`) têm testes
(`roomSchedule.test.ts`) mas nenhum uso em `apps/web` (grep por `Schedule|csv|CSV` em `apps/web/src` → 0 resultados).
`docs/paridade/ambientes.md:31` marca **E2 … tabela … e CSV** como `[x]`. O usuário não tem como abrir a tabela nem
exportar o CSV.

### B12 · P2 · Import IFC de ambiente perde polígono, altura e o número correto

`io/src/ifcImport/mapping.ts:324-354`:

```ts
const point = interiorPoint(loop);            // :340
number: f.text(e, 7).trim(),                  // :347  ← atributo 7 = LongName
```

- O polígono autoritativo do IFCSPACE é reduzido a **um ponto**: a área exibida passa a depender de um circuito fechado
  nas paredes importadas — que pode não existir (vira `'fora'`, área 0) ou ser outro.
- `prism.z0`/`z1` (altura e base do espaço) são descartados: `ceilingHeight`/`heightOffset` não são gravados → ambiente
  de 3,2 m passa a 2,8 m e base 0,1 m passa a 0.
- `f.text(e, 7)` é o `LongName`. No exportador da casa (`ifcSpaces.ts:85-98`) o `LongName` é `"101 - Sala"` e o número
  não tem atributo próprio → **ida e volta** transforma `number='101'` em `number='101 - Sala'`.
- Não há `Pset_SpaceCommon` (OccupancyType, Category, IsExternal…), `IfcZone`, nem `IFCRELSPACEBOUNDARY` no export
  (`ifcSpaces.ts:86-98` só emite IFCSPACE + Qto).

Cobertura: `importIfc.test.ts:70-101` só **conta** ambientes; nenhum teste confere área/nome/número após importar, e
não existe teste de ida-e-volta export→import.

### B13 · P2 · Separador não é elemento: não copia, não exporta, não valida

`level.roomSeparators` (`types.ts:148-149`) está fora de `p.elements`:

- `transfer.ts` copia/cola ambientes (`pasteAlignedCommand` → `roomIds`) mas **não** copia separadores; colar dois
  ambientes separados em outro nível junta os dois no mesmo circuito → área cheia e `duplicateOf`.
- `annotationRemovals`/`annotationIdsIn` (`annotations.ts:189-204`) não listam separadores; a exclusão é remendada
  à parte (`deleteIds.ts:13,25`) — funciona, mas qualquer novo caminho de exclusão ("Selecionar anotações", script) os
  deixa para trás.
- DXF: não há camada de separador (`dxf.ts:309-310` só `AMBIENTES`/`AMBIENTES_TEXTO`) — o contorno dividido sai, a
  linha não.
- Validação: `roomSeparatorIssue` (`annotations.ts:61-65`) só checa comprimento ≥ 0,05 m. Um separador que **não toca
  parede nenhuma** (1–2 cm de folga) é aceito e não divide nada, sem aviso (ver B14).
- IFC: nenhum `IfcVirtualElement`/relação espacial.

### B14 · P2 · Faixa do separador: 1 mm + extensão de 1 cm, e `L=0` → NaN

`rooms.ts:108-124`:

```ts
const SEPARATOR_WIDTH = 0.001;  // espessura da faixa
const SEPARATOR_EXT = 0.01;     // prolongamento de cada ponta
const u = { x: d.x / L, y: d.y / L };   // L=0 → NaN
```

- **Área**: cada separador rouba `0,001 m × comprimento`. **Confirmado (sonda)**: sala 4×5 dividida ao meio →
  9,1870 + 9,1870 = **18,374** contra 18,378 sem separador (perda de 4 mm²; irrelevante, mas o total não fecha
  exatamente e não há nota disso na tabela).
- **Perímetro**: cada metade conta o lado do separador (12,447 m cada) — coerente com Revit, mas convém documentar.
- **Linhas curtas / que não tocam a parede**: a folga de 1 cm é mágica. Desenhar com snap "livre" a 2 cm da face e a
  sala **não** divide, sem mensagem; a 1 cm divide. O teste cobre 1 m de folga (`roomSeparator.test.ts:36-40`), não o
  caso de fronteira.
- **Degenerado**: `roomSeparatorIssue` protege o caminho de comando, mas um JSON editado à mão (ou um comando futuro)
  com `a===b` faz `u=NaN` → retângulo com `NaN` → `difference`/Clipper pode lançar ou devolver lixo.
  **Suspeita**; confirmar com um teste que grava `{a:{0,0}, b:{0,0}}` direto em `level.roomSeparators` e chama
  `resolveRooms` (esperado hoje: exceção ou polígono inválido).
- **Dois separadores sobrepostos/colineares**: cada um vira uma faixa própria; a união das diferenças deve equivaler,
  mas não há teste.

### B15 · P2 · `interiorPoint` e `lineIntervals`: linha de varredura única, sem invariante

`roomCreate.ts:17-27` usa **a linha horizontal do meio da bbox** e devolve o meio do maior intervalo. `lineIntervals`
(`engine/src/sectionGeom.ts:55-72`) depende de paridade de cruzamentos e ignora arestas horizontais.

- Casos que "passam" hoje (confirmado na sonda): L 3×3 com 4,5 m² de área útil → `(0,5;1,5)` (dentro); retângulo com
  furo central → `(0,5;2)` (dentro); faixa de 2 cm → `(2,5;0,01)` (dentro).
- Riscos reais: (a) o ponto pode cair numa **faixa de separador** (B3, confirmado); (b) em polígonos com pescoço fino o
  "meio do maior intervalo" fica a milímetros de uma parede (etiqueta colada / ponto frágil a arredondamento);
  (c) vértice exatamente na linha de varredura gera intervalo de comprimento zero — a paridade se mantém nos casos
  testados, mas não há teste de invariante.
- Não há **nenhum teste** de "o ponto devolvido está dentro do polígono" para polígonos côncavos/com furo. Um teste de
  propriedade barato: gerar polígonos retilíneos aleatórios e afirmar `pointInPolygon(interiorPoint(p), p)`.

`interiorPoint` (ponto de criação) e `labelPoint` (`floors.ts:51`, ponto da etiqueta) são algoritmos **diferentes**
(centroide com fallback × meio da bbox): o ambiente nasce num ponto e a etiqueta aparece em outro. Não é bug, mas
confunde ao comparar "Ponto interior (m)" do painel com o desenho.

### B16 · P2 · `heightOffset` e `ceilingHeight` no painel: números que não batem com o projeto

`PlacementProperties.tsx:102` mostra `o.roomCeilingHeight ?? 2.8` e `:106` a cor `#b8c4d4` fixos, em vez de
`p.defaults.wallHeight`. Se o projeto tem `defaults.wallHeight = 3,0`, o painel anuncia 2,8 (valor errado, ainda que só
gravar ao editar) e a primeira edição parte de 2,8 — o "automático" do projeto desaparece sem aviso. O campo deveria
abrir com `roomCeilingHeight(p, draft)` e ter `onClear` restaurando `undefined` (voltando a herdar).

### B17 · P2 · Migração/robustez: campos obrigatórios não são saneados na carga

`migrate.ts:191-193` (v16→v17) só avança a versão, e `migrateProject` (`:226-229`) faz merge com o projeto vazio sem
validar elementos. `validateRooms.ts:11` faz `r.name.trim()` e `rooms.ts:132` faz `v.x` sobre `point`: um JSON com
`kind:'room'` sem `name`/`point` (arquivo editado à mão, gerador externo, import futuro) derruba `validateProject` com
`TypeError` na primeira renderização.
**Suspeita** (não reproduzido); confirmar com `migrateProject({...schemaVersion:17, elements:{r:{kind:'room',id:'r'}}})`
e depois `validateProject`. Correção: saneador de `Room` na migração (defaults + descarte do inválido, padrão já usado
para outros campos em `migrate.ts`).

### B18 · P3 · Detalhes de coerência

- `roomLabelText` (`render/.../rooms.ts:21-26`): nome vazio + número → `"Ambiente 7 (7) · …"` (número duplicado; o teste
  `rooms.test.ts:47` fixa esse texto).
- `perimeter` ignora furos por construção (`rooms.ts:196`), enquanto o teste do pilar afirma 18 m — correto, mas sem
  documentação na tabela/CSV.
- `resolveRooms` chama `roomCeilingHeight(p,r)` duas vezes (`:182` e `:203`) e mantém `frames` só para o `length`
  (`:175/188`) — cosmético.
- `ROOM_TEXT_MM`/`roomOps` desenham **uma etiqueta por ambiente em qualquer zoom**, sem limiar nem desobstrução
  (`plan/limiares.ts` não é consultado): em "Ajustar zoom" com 200 ambientes as etiquetas se sobrepõem.
- `enclosed.ts` e `rooms.ts` duplicam `MARGIN = 1` e o `onFrame` (dois lugares, dois `EPS`).
- `ifcSpaces.ts:5` importa `@hestia/engine` (fronteira `io → engine` que `docs/01 §1` proíbe; a própria nota do arquivo
  registra o débito).
- `docs/paridade/ambientes.md:12` diz "A5 Linha de separação … fora desta etapa", mas a linha existe e funciona
  (decisão 0031 §3 e testes) — doc defasada.

---

## 4. Cobertura de testes

### 4.1 O que está coberto

| Tema | Arquivo | Casos |
|---|---|---|
| Área/perímetro/volume | `engine/src/rooms.test.ts:38-97` | retângulo 4×5 (20 m², 18 m), pilar como furo (−0,09), L (6 m²), circuito aberto, nível sem paredes, volume padrão e próprio |
| Duplicado | `rooms.test.ts:99-109`, `:125-132` | `duplicateOf` e aviso `room-duplicate` |
| Validação | `rooms.test.ts:111-123` | `room-point-outside`, `room-point-open` |
| Propriedade | `rooms.test.ts:147-175` | 30 retângulos aleatórios (semente fixa): área e perímetro |
| Comandos/undo | `model/src/room.test.ts:36-73` | add/update/remove com undo/redo, lote, `transform` move o ponto |
| Migração | `room.test.ts:75-95` | v16→v17 e ida-e-volta de JSON com `ceilingHeight/finish/color` |
| Numeração/ponto | `tools/src/roomCreate.test.ts:25-41` | `nextRoomNumber` (pula usados), `interiorPoint` quadrado + degenerado |
| Todos os circuitos | `roomCreate.test.ts:43-61` | dois circuitos (4×3 com divisória), nada quando já coberto, sem paredes |
| Ferramenta | `tools/src/roomTool.test.ts` | preview com área, criação, duplo clique, duplicado, fora/aberto |
| Separador | `engine/src/roomSeparator.test.ts` | divide ao meio (10+10), linha curta não divide, remover restaura, mínimo 0,05 m |
| Separador (edição) | `tools/src/roomSeparator{Tool,Grip,Move,Select}.test.ts`, `render/.../roomSeparatorDraw|Select.test.ts` | criar, alça, mover, selecionar, desenhar tracejado |
| Planta | `render/src/plan/rooms.test.ts` | etiqueta por detalhe (grosso/médio/fino), fill/cor, oculto, seleção/hover, subpavimento |
| Painel | `ui/RoomProperties.test.ts` | `roomWarning` (fora/aberto/duplicado) |
| DXF | `editor/dxfRooms.test.ts` | camadas, categoria oculta, sem ambiente |
| IFC (export) | `io/src/ifc/ifcSpaces.test.ts` | 1 espaço, sem circuito não sai, Qto, `heightOffset`, determinismo |
| IFC (import) | `io/src/ifcImport/importIfc.test.ts:70-101` | só **contagem** de ambientes |
| Ações | `editor/roomActions.test.ts` | cria N, idempotente |
| Visual | `tests/e2e/visual-regression.mjs:85-87` + `tests/e2e/baseline/ambiente-sala.png` | **um** caso: sala 8×6 retangular com etiqueta "Sala (101) · 45,46 m²" (só citado) |

### 4.2 O que **não** está testado (e que os bugs acima mostram)

1. **L e côncavos** — área do L está testada, mas **não** `interiorPoint` em L, nem etiqueta em L com pescoço, nem
   "todos os circuitos" num L (U, C, pátio).
2. **Furo** — pilar testado sozinho; **não** furo + separador (B2), nem furo + dois ambientes, nem perímetro de furo.
3. **Separador** — não há teste de: diagonal (B2), separador que cruza um pilar, separador no meio exato da bbox dos
   circuitos (B3), separador a 1 cm × 2 cm da parede (B14), dois separadores em cruz, separador movido por alça
   recalculando a área, undo/redo de mover separador, separador em nível diferente.
4. **Dois ambientes** — só o caso "duplicado no mesmo circuito"; não há teste de dois ambientes em duas metades
   separadas (nem de totais sem duplicata, B6).
5. **Undo** — coberto no modelo (`addRoom` etc.), **não** no efeito geométrico: desfazer um `sag`/Aparar deve devolver a
   área anterior (B1 expõe isso), desfazer `addRoomSeparator`, desfazer depois de "todos os circuitos".
6. **IFC** — nenhum teste de import com área/nome/número (B12), nenhum round-trip export→import, nenhum teste de
   `ceilingHeight` inválido no export (B8).
7. **DXF** — sem separador (B13), sem furo no contorno exportado, sem teste de escala/zoom de etiqueta.
8. **Zoom** — `rooms.test.ts` usa `resolverZoom` uma vez; nada sobre limiar de etiqueta, sobreposição em zoom baixo, ou
   `limiares` (hoje a etiqueta não tem limiar).
9. **Detalhe grosso** — só o texto da etiqueta (`rooms.test.ts:46`); nada sobre o que o grosso deixa de desenhar.
10. **Regressão visual** — uma baseline (`ambiente-sala.png`) para retângulo; faltam L, furo, separador, dois ambientes,
    detalhe grosso e zoom distante.
11. **Robustez de entrada** — arquivo com `Room` incompleto (B17), `RoomSeparator` degenerado (B14), `ceilingHeight`
    negativo (B8).
12. **Cache** — nenhum teste afirma "editar a flecha do arco muda a área" nem "dois projetos não compartilham região"
    (B1); `resetRegionCache` existe só para isolar testes (`rooms.ts:152`), o que esconde o problema.

---

## 5. Backlog priorizado

Estimativas grossas em dias de um dev que já conhece o código (inclui teste). Arquivos a tocar.

### P0 — correção de número errado (fazer antes de qualquer release)

| # | Item | Est. | Arquivos |
|---|---|---|---|
| P0-1 | **Cache de região**: incluir `sag` (+ versão) na assinatura **e** trocar as três caches (`regionCache`, `roomsCache`, `perimeterCache`) por `WeakMap<Project, …>`. Teste: Aparar um arco muda a área; projeto B não herda A. | 0,5 | `engine/src/enclosed.ts:43-51,78-95,148-161`, `engine/src/rooms.ts:149-165` |

### P1 — geometria e dados errados, com contorno claro

| # | Item | Est. | Arquivos |
|---|---|---|---|
| P1-1 | `dropBandHoles` por retângulo orientado (não AABB); teste pilar + separador diagonal (B2) | 0,5 | `engine/src/rooms.ts:99-106` |
| P1-2 | "Todos os circuitos" usar as regiões de `resolveRooms` (com separadores) e ponto fora de faixa; um ambiente por sub-região (B3) | 1,0 | `engine/src/rooms.ts` (exportar `roomRegions`), `tools/src/roomCreate.ts:39-52` |
| P1-3 | `computeRooms` usar `wallFaces().outline` (fim da divergência `enclosedRooms` × `resolveRooms`) + testes `finishInterior/finishExterior/core*` (B4) | 1,0 | `engine/src/enclosed.ts:19-27,97-116` |
| P1-4 | Duplicata: recusar por padrão (ou reusar/selecionar o existente) e **não somar** duplicados em tabela/CSV/IFC; documentar o `seen` (B6) | 0,5 | `tools/src/roomTool.ts:59-75`, `engine/src/{rooms,roomSchedule}.ts`, `io/src/ifc/ifcSpaces.ts` |
| P1-5 | Regras de `ceilingHeight`/`heightOffset`: validação de modelo + recusa no comando + coerência tabela/IFC (B8) | 0,5 | `model/src/validateRooms.ts`, `model/src/roomCommands.ts`, `engine/src/rooms.ts:203`, `io/src/ifc/ifcSpaces.ts:78-82` |
| P1-6 | Seleção de ambiente por clique (ordem de pick ou filtro) e ambiente órfão selecionável/excluível pelo desenho (B9/B10) | 1,0 | `tools/src/selectTool.ts:110-126`, `tools/src/roomPick.ts:6-35`, `engine/src/rooms.ts` |
| P1-7 | Ligar a **tabela de ambientes + CSV** na UI (painel/menu), usando o que já existe no motor (B11) | 1,5 | `apps/web/src/ui/*` (novo painel), `apps/web/src/editor/*`, `engine/src/roomSchedule.ts` |

### P2 — paridade e robustez

| # | Item | Est. | Arquivos |
|---|---|---|---|
| P2-1 | Diagnóstico `'aberto'` × `'fora'` por geometria (contorno externo/proximidade), não por bbox (B5) | 0,5 | `engine/src/rooms.ts:130-137` |
| P2-2 | Numeração: máximo+1, opção de zero à esquerda, campo "Número" incrementando, aviso de número repetido (B7) | 0,5 | `tools/src/roomCreate.ts:7-14`, `tools/src/roomTool.ts:62-72`, `ui/PlacementProperties.tsx:100` |
| P2-3 | Separador como elemento de verdade: desenhar no DXF (`AMBIENTES_SEPARADOR`), copiar/colar e copiar entre níveis, aviso "não divide nada", guarda contra `L=0` (B13/B14) | 1,0-1,5 | `model/src/{types,annotations}.ts`, `io/src/dxf.ts`, `apps/web/src/editor/{transfer,dxfExport}.ts`, `engine/src/rooms.ts:108-124` |
| P2-4 | Etiqueta de ambiente: posição/rotação por instância, mostrar/ocultar por vista, limiar de zoom e desobstrução (B18) | 1,5-2,0 | `model/src/types.ts` (+comando/migração), `render/src/plan/rooms.ts:36-55`, `ui/RoomProperties.tsx` |
| P2-5 | `interiorPoint` robusto (polo de inacessibilidade / centroide validado) + testes de invariante em côncavos e com furo; unificar com `labelPoint` (B15) | 0,5 | `tools/src/roomCreate.ts:17-27`, `render/src/plan/floors.ts:51` |
| P2-6 | Robustez de JSON: saneador de `Room`/`RoomSeparator` na migração (B17/B14) | 0,5 | `model/src/migrate.ts:191-229` |
| P2-7 | Desempenho: assinatura memoizada por projeto (hoje `wallsSignature` + `JSON.stringify(separadores)` a cada `mousemove`), medir com `scripts/bench-interacao.mts` | 0,5 | `engine/src/{enclosed,rooms}.ts`, `tools/src/roomTool.ts:80` |
| P2-8 | Cobertura que falta: L/pátio em `interiorPoint`, furo+separador, undo de separador e de `sag`, dois ambientes em sub-regiões, import IFC com área/nome/número, round-trip IFC, DXF com furo, zooms, e baselines visuais `ambiente-L`, `ambiente-separador`, `ambiente-furo-superior` | 1,5-2,0 | os testes citados na §4 |
| P2-9 | Documentação: `docs/paridade/ambientes.md` (A5 implementado, E2 sem UI até P1-7), nota sobre área derivada (não sobrevive a import), separador 1 mm + 1 cm, perímetro sem furos | 0,25 | `docs/paridade/ambientes.md`, `docs/decisoes/0018` |

### P3 — paridade de produto (épico, só depois do acima)

| # | Item | Est. | Observação |
|---|---|---|---|
| P3-1 | Limite de cálculo por projeto (`bordaDeCalculo`: acabamento/núcleo/eixo) — a decisão de `docs/05 §6` já existe e o motor já tem `RoomExtend='core'` (`enclosed.ts:36`) sem uso em `resolveRooms` | 1,0 | `model ProjectSettings`, `engine/src/rooms.ts:77-92` |
| P3-2 | `roomBounding` por elemento (parede/pilar/laje) — hoje toda parede do nível delimita | 1,5-2,0 | `model Wall`, `engine/src/rooms.ts` (filtrar `wallFaces`), `ui/Properties` |
| P3-3 | Limite superior: `upperLimitLevelId` + `limitOffset` + `unboundHeight` (substitui o número solto `ceilingHeight`) | 2,0-3,0 | `model` (comando + migração), `engine` (volume/z), `ifcSpaces` (extrusão), painel |
| P3-4 | Fase / design option / ocupação / categoria / departamento (e mapeamento para `Pset_SpaceCommon`, `IfcZone`, `IfcRelSpaceBoundary`) | 3,0-5,0 | `model` (psets/`ifcProperties` já existem como escape), `io/src/ifc` |

---

## 6. Resumo executivo (para quem só lê o topo)

1. **A arquitetura "só o ponto" é boa e está bem executada** (contorno derivado, um número de área para planta/DXF/IFC,
   migração vazia). O preço é que a área depende inteiramente de um circuito fechado e de um cache.
2. **Um bug P0** contamina área: a assinatura do cache de região não inclui a flecha do arco (`sag`); a área não muda ao
   editar um arco e pode ser herdada de outro projeto. Reproduzido: 21,3391 em vez de 20,0000.
3. **Três bugs P1 de geometria** com cenário comum: o furo do pilar é engolido por um separador diagonal; "Ambientes em
   todos os circuitos" cria ambiente de área 0 quando há um separador no meio do circuito (e nenhum no outro lado); e
   não cria nada quando as paredes usam "face interna".
4. **Dados**: duplicatas somam área; volume aceita pé-direito 0/negativo (e ignora a base); separador não é elemento (não
   copia, não exporta); import IFC de espaço perde polígono e altura e troca o número pelo LongName.
5. **UI**: o ambiente é desenhado sobre o piso mas perde o clique para ele; a tabela/CSV de ambientes existe só no motor.
6. **Paridade**: faltam limite de cálculo, `roomBounding`, limite superior/`unboundHeight`, fase, ocupação/categoria e
   posição da etiqueta — o `docs/05 §6` já decidiu os dois primeiros e o motor já tem `RoomExtend='core'` pronto.
