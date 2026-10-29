# F · Proposta completa: planta de área, linhas de referência e quadro geral

Corrige a versão anterior depois da investigação do desenho real do Revit. Fontes no fim.
Mockups: [mockup-etiqueta.svg](mockup-etiqueta.svg) · [mockup-planta-area.svg](mockup-planta-area.svg)

---

## 0. Correção de entendimento: o que é o quê no Revit

Eu tinha confundido duas coisas. No Revit:

| Elemento | O que é | Onde fica |
|---|---|---|
| **Reference lines** (o "X" que atravessa o ambiente) | duas linhas perpendiculares, alinhadas ao sistema do ambiente, que vão de **uma borda à outra** e se cruzam no **ponto de referência** | dentro do ambiente; são um auxiliar de vista da categoria Rooms, subcategoria **Reference** |
| **Room Tag** | elemento de anotação separado (nome, número, área) | dentro, no cruzamento, ou fora com **uma** linha de chamada |
| **Interior Fill** | preenchimento de tela do Room | desligado por padrão; **não imprime** |
| **Color Scheme** | esquema de cores por parâmetro, aplicado à vista | só existe depois de configurado; **imprime** e gera legenda |
| **Leader** | linha única da etiqueta até o ponto de referência, quando a etiqueta sai do ambiente | opcional; reta ou com cotovelo |

Portanto:

- as **duas linhas cruzadas que atravessam a área** são as **reference lines** do ambiente, não a
  chamada da etiqueta; `[DOC]`
- **não há cor por padrão**: o Room não aparece, e quando aparece o `Interior Fill` é opcional e não
  imprime; cor de verdade só com **Color Scheme**, que é configuração da planta de área; `[DOC]`
- a etiqueta **nasce no cruzamento** das reference lines (`Move to Room Reference` devolve ela para
  lá) e ganha **uma** linha de chamada quando é arrastada para fora; `[DOC]`
- as reference lines podem ser **arrastadas** pelo controle no cruzamento e **recentralizadas**
  (`Re-center Reference`). `[DOC]`

Isso muda o modelo: o ponto que ancora o desenho não é o mesmo ponto que localiza o circuito.

---

## 1. As três decisões de produto

### D1 · Planta de piso limpa

A planta de piso passa a mostrar **só o nome** do ambiente (sem número e sem área). A área vive na
planta de área. Configurável por vista (`rooms: 'full' | 'nameOnly' | 'hidden'`), padrão `nameOnly`
nas plantas novas e `full` em arquivo antigo (compatibilidade).

### D2 · Planta de área é vista própria, persistida

`AreaPlan` guarda nível, escala, esquema de cores, visibilidade, etiquetas, legenda e quadro. Não é
um `planKind`: precisa de estado próprio.

### D3 · A "geral" é uma prancha

Uma planta por pavimento, lado a lado, na mesma escala, mais quadro geral e legenda. Reutiliza
`Sheet`/`SheetViewport`. Vista sobreposta fica para depois.

---

## 2. Modelo de dados

### 2.1 Ambiente: separar os dois pontos

Hoje `Room.point` serve para duas coisas: achar o circuito e posicionar o rótulo. Isso impede mover
a referência sem mudar o ambiente. Proposta:

```ts
export interface Room {
  // ...
  /** Localiza o circuito. Nunca muda ao arrastar a referência. */
  point: Vec2;
  /** Cruzamento das linhas de referência. Ausente = centroide do polígono resolvido. */
  referencePoint?: Vec2;
  /** Categoria (Sala, Banho, Circulação…). Destrava cor, legenda e IFC. */
  categoryId?: Id;
}
```

Regra do `referencePoint` padrão:

1. **Centroide** do polígono (centro de gravidade), como você pediu.
2. Se o centroide cair fora do polígono ou dentro de um furo (ambiente em L/U, pilar central),
   usa o **polo de inacessibilidade** (ponto mais distante das bordas) e marca "referência fora do
   centro" no painel.
3. Arrastar o cruzamento grava `referencePoint`; **não** mexe em `point` e **não** muda a área.
4. `Recentralizar` apaga o override e volta ao centroide.

### 2.2 Planta de área

```ts
export interface AreaPlan {
  id: Id;
  name: string;
  levelId: Id;
  schemeId: Id;                  // 'net' (padrão)
  scale: number;
  graphics: AreaPlanGraphics;
  tags: RoomTag[];
  legend?: AreaLegend;           // só existe se houver esquema de cores
  table?: AreaTable;
}
```

### 2.3 Gráficos: sem cor por padrão

```ts
export interface AreaPlanGraphics {
  /** Linhas de referência (o “X” que atravessa o ambiente). */
  referenceLines: 'always' | 'selected' | 'never';   // padrão 'always'
  referenceLinesPrint: boolean;                       // padrão true
  /** Preenchimento só entra quando há esquema configurado. */
  fill: 'none' | 'scheme' | 'category' | 'hatch';     // padrão 'none'
  fillOpacity: number;                                // usado só com fill ≠ none
  /** Contorno do polígono do ambiente. */
  outline: 'none' | 'thin' | 'dashed';                // padrão 'none'
  showWalls: 'light' | 'normal' | 'hidden';           // padrão 'light'
  showOpenings: boolean;                              // padrão false
  showDimensions: boolean;                            // padrão false
  showAnnotations: boolean;                           // padrão false
  showFloors: boolean;                                // padrão false
  showBelowLevel: boolean;                            // padrão false
  tagDefault: Pick<RoomTag, 'leader' | 'fields' | 'orientation'>;
}
```

`fill: 'none'` é o padrão: a planta de área nasce **sem cor**, só com reference lines, etiquetas e
paredes claras. Quando o usuário cria um **esquema de cores** (por categoria, por nível, por faixa),
o `fill` vira `scheme`, a legenda aparece e aí sim há cor.

### 2.4 Etiqueta

```ts
export interface RoomTag {
  id: Id;
  planId: Id;
  roomId: Id;
  /** Centro do bloco de texto. Ausente = referencePoint do ambiente (dentro). */
  at: Vec2;
  orientation: 'horizontal' | 'vertical';
  leader: 'none' | 'straight' | 'kinked';   // uma linha; cotovelo opcional
  fields: TagField[];
  custom?: string;
  visible: boolean;
  locked?: boolean;
}
export type TagField = 'name' | 'number' | 'area' | 'category' | 'level' | 'perimeter' | 'volume' | 'custom';
```

Não existe `mark: 'cross'` nem `leader: 'crossed'`. O "X" é gráfico do ambiente (reference lines),
não da etiqueta.

### 2.5 Esquema de cores e tabela

```ts
export interface ColorScheme {
  id: Id;
  name: string;
  by: 'category' | 'level' | 'areaRange';
  colors: Array<{ value: string; color: string; hatch?: HatchId }>;
  /** Faixas para by: 'areaRange'. */
  ranges?: Array<{ min: number; max: number; color: string; label: string }>;
}
```

A planta aponta para um `schemeId`; sem esquema, não há fill nem legenda.

### 2.6 Migração

Tudo opcional (`areaPlans?`, `colorSchemes?`, `roomCategories?`, `Room.referencePoint?`,
`Room.categoryId?`). Arquivo antigo abre igual; nenhuma migração de dados.

---

## 3. Como o Revit desenha (e como vamos desenhar)

### 3.1 Reference lines

- Duas linhas **perpendiculares** entre si, alinhadas ao sistema local do ambiente (num ambiente
  ortogonal: uma horizontal e uma vertical), que vão de **uma borda à outra** passando pelo ponto de
  referência. `[DOC]`
- O cruzamento é o **ponto de referência**: é ali que a etiqueta nasce e é para ali que o líder
  aponta.
- O controle no cruzamento pode ser arrastado (move a referência, não o ambiente) e há
  `Re-center Reference` para voltar ao centro. `[DOC]`
- São um auxiliar de vista (subcategoria `Reference`). No Revit ficam visíveis só se ligados em V/G;
  há relato de que não imprimem. **Na nossa planta de área eles são o desenho** e imprimem por
  padrão, com `referenceLinesPrint` para desligar. É uma diferença deliberada. `[DOC]` + `[SEC]`

Desenho:

```
┌───────────────────────────────┐
│              │                │
│              │                │
│              │                │
│──────────────┼────────────────│   ← linha horizontal, borda a borda
│              │  Sala          │
│              │  101 · 21,34 m²│
│              │                │
│              │                │
└───────────────────────────────┘
               ↑
        linha vertical, borda a borda
```

Em ambiente em L, cada linha é desenhada em **todos os trechos internos** daquele eixo (pode virar
dois segmentos), nunca passando por fora do polígono.

### 3.2 Etiqueta

- **Dentro**, quando a caixa couber: centrada no cruzamento, sem líder. O texto recebe um **halo
  branco** para a linha não riscar as letras — como no Revit. `[DOC]`
- **Fora**, quando não couber: uma linha de chamada do bloco até o cruzamento. Estilo:
  - `straight` — reta;
  - `kinked` — reta com **ombro horizontal** (o cotovelo do Revit). `[DOC]`
- Arrastar para fora liga o líder sozinho; arrastar de volta desliga. `[DOC]`
- `Move to Room Reference` (nosso "Recentralizar etiqueta") devolve ao cruzamento. `[DOC]`
- Etiqueta é por vista: a mesma sala pode ter etiquetas em posições diferentes em plantas
  diferentes. `[DOC]`

Conteúdo padrão, duas linhas:

```
Sala
101 · 21,34 m²
```

Nome 3,5 mm; número · área 2,5 mm (NBR 6492). Entrelinha 1,25; padding 0,9 mm; halo 0,6 mm.

### 3.3 Cor

- **Padrão: nenhuma.** Sem fill, sem legenda, sem cor.
- `Interior Fill` do Revit é tela e não imprime. `[DOC]` Nós nem oferecemos esse meio-termo: ou sem
  cor, ou com **esquema de cores** que imprime e gera legenda.
- Esquema por **categoria** (padrão), **nível** ou **faixa de área**.
- Legenda agrupada, com swatch/hachura, quantidade, área e %.
- Modo **P&B**: `fill: 'hatch'` com hachura por categoria, para imprimir sem cor.

---

## 4. A planta de área

### 4.1 O que aparece

| Elemento | Planta de piso | Planta de área (padrão) |
|---|---|---|
| Paredes | corte cheio | contorno claro 0,25 mm |
| Portas/janelas | símbolo completo | ocultas |
| Cotas/textos/pisos | sim | ocultos |
| Reference lines | não | **sim**, borda a borda |
| Etiqueta | só nome | nome + número · área |
| Preenchimento | leve | **nenhum** até configurar esquema |
| Legenda | não | só com esquema |

### 4.2 Criação

Diálogo **Nova planta de área**:

- Níveis (todos por padrão).
- Escala (1:50).
- [x] Criar etiquetas.
- [x] Criar prancha geral.
- Esquema de cores: **(nenhum)** por padrão; lista os existentes.

Ao criar:

1. Um `AreaPlan` por nível.
2. Uma etiqueta por ambiente com circuito fechado.
3. Posiciona no centroide; se não couber, fora com líder.
4. Ambiente com problema (`fora`/`aberto`) não recebe etiqueta e entra em "pendências".

### 4.3 Etiquetas em lote

- **Etiquetar ambientes sem etiqueta** (Tag All Not Tagged): só as que faltam, um undo.
- **Recentralizar etiquetas**: devolve todas ao cruzamento (Move to Room Reference).
- **Reposicionar automáticas**: recalcula as que o usuário não arrastou.

---

## 5. A "geral"

Prancha A-03, uma viewport por pavimento + quadro geral + legenda (se houver esquema):

```
┌──────────────────────┬──────────────────────┐
│ Térreo 1:50          │ Pavimento 1 1:50     │
├──────────────────────┼──────────────────────┤
│ Cobertura 1:50       │ QUADRO GERAL         │
│                      │ Térreo  54,44 m²     │
│                      │ Pav. 1  30,15 m²     │
│                      │ Total   84,59 m²     │
└──────────────────────┴──────────────────────┘
```

`SheetViewSource` ganha `{ kind: 'areaPlan'; planId }` e `{ kind: 'areaTable'; planId }`.

Quadro: número, nome, nível, categoria, área, %, subtotal por nível, total. Sem dupla contagem: a
prancha não soma; só as plantas normais somam. CSV reutiliza `roomScheduleToCsv` estendido.

---

## 6. Fluxo do usuário

1. **Arquitetura → Sala e Área → Planta de área**.
2. Escolhe níveis, escala, etiquetas, prancha.
3. Abre a planta: **sem cor**, com as reference lines atravessando cada ambiente e as etiquetas no
   cruzamento.
4. Arrasta a etiqueta de um banheiro para fora: o líder liga sozinho.
5. Arrasta o cruzamento de uma sala em L: a referência muda, a área não.
6. Quando quiser cor: **Esquema de cores…** → escolhe por categoria/nível/faixa → fill + legenda.
7. **Criar prancha geral** → A-03 com todos os pavimentos e o quadro.

---

## 7. Comandos e undo

| Comando | Efeito |
|---|---|
| `addAreaPlan` / `updateAreaPlan` / `removeAreaPlan` | planta; apagar não apaga ambientes |
| `addRoomTag` / `updateRoomTag` / `moveRoomTag` / `removeRoomTag` | etiqueta |
| `setRoomReference` | grava `referencePoint` (arrastar o cruzamento) |
| `recenterRoomReference` | apaga o override |
| `recenterRoomTags` | devolve etiquetas ao cruzamento |
| `tagAllRooms` / `autoLayoutRoomTags` | lote |
| `upsertColorScheme` / `removeColorScheme` | esquema |
| `upsertRoomCategory` | categoria |

Etiqueta é anotação: não acompanha `transform` do ambiente. Reference point é modelo: acompanha
`transform` (mover/girar/espelhar) junto com o ambiente.

---

## 8. Render, prancha, DXF, IFC

- `buildPlanGeometry` ganha `kind: 'area'`; ordem: paredes claras → reference lines → etiqueta →
  legenda/quadro.
- `LabelOp` ganha `lines?: string[]` e `mask` (halo).
- DXF: `AMBIENTES_REFERENCIA`, `AMBIENTES_TEXTO`, `AMBIENTES_CHAMADA`, `AMBIENTES_HACHURA`,
  `AMBIENTES_LEGENDA`, `AMBIENTES_QUADRO`. Texto como `TEXT`/`MTEXT`.
- IFC: nada muda na geometria; `Room.categoryId` → `Pset_SpaceCommon.Category`/`ObjectType`.

---

## 9. Testes e pronto

**Modelo**
- arrastar o cruzamento não muda `point` nem a área;
- `recenter` volta ao centroide;
- centroide fora do polígono cai no polo de inacessibilidade;
- duas plantas do mesmo nível têm etiquetas independentes;
- apagar etiqueta não apaga ambiente; apagar ambiente remove etiquetas;
- migração e round-trip.

**Geometria**
- reference lines horizontais e verticais vão de borda a borda;
- em L, cada linha só nos trechos internos;
- etiqueta dentro ↔ fora com líder ao cruzar o limite;
- líder `kinked` com ombro horizontal;
- etiqueta cabe → centrada no cruzamento, sem líder;
- colisão de etiquetas não sobrepõe.

**Visual**
- baseline sem cor (só reference lines + etiqueta);
- baseline com esquema de cores + legenda;
- baseline P&B com hachura;
- prancha A-03 com quadro.

**Pronto**
- 2 pavimentos → 2 plantas + 1 prancha em < 1 s;
- nenhuma cor sem esquema configurado;
- nenhuma área muda (testes dourados de `resolveRooms` passam).

---

## 10. Fases para subagentes

| Fase | Entrega |
|---|---|
| **F1** | Modelo e comandos: `referencePoint`, `AreaPlan`, `RoomTag`, `RoomCategory`, `ColorScheme`, migração, validação |
| **F2** | Geometria pura: centroide/polo, reference lines borda a borda, caixa de texto, dentro/fora, líder reto e cotovelo, colisão |
| **F3** | Render da planta de área (sem cor por padrão) + camadas DXF + baselines |
| **F4** | Vistas e navegador: `OpenView`, grupo "Plantas de área", diálogo, ferramentas permitidas |
| **F5** | Etiqueta interativa: colocar, arrastar, alças, recentralizar, etiquetar sem etiqueta |
| **F6** | Esquema de cores, legenda, quadro e prancha geral A-03 |
| **F7** | P&B/hachura, desempenho, IFC, documentação e baselines finais |

---

## 11. Decisões confirmadas e o que ainda depende de você

Confirmado por você:

1. **Etiqueta dentro quando couber, centrada no centro de gravidade**; fora com chamada quando não
   couber.
2. **Planta de piso só com o nome.**
3. **Geral em prancha** com uma planta por pavimento.
4. **Entrega completa F1–F7.**

Ainda preciso de uma confirmação:

- **Reference lines impressas por padrão** (minha recomendação: sim, é o desenho da planta de área)
  ou só na tela, como auxiliar (comportamento mais próximo do Revit)? A opção fica em
  `referenceLinesPrint`; só preciso saber o padrão.

---

## 12. Fontes

- Autodesk — Control the Visibility of Rooms (Reference, Interior Fill, Re-center Reference):
  https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-35838C67-A54C-44BF-A4BA-1217326FFB12.htm
- Autodesk — Re-center Room Reference and Tags (Move to Room Reference):
  https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-WhatsNew/files/GUID-73A2A764-FB3B-4905-ADB5-76056C3DB089.htm
- Autodesk — Room Tags / Tagging a Room / Move a Tag / Room and Room Tag Relationship:
  https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-6DB755B9-1830-4CCA-A358-511AC9D48FC6.htm
- Autodesk — Create an Area Plan (PT-BR):
  https://help.autodesk.com/cloudhelp/2027/PTB/Revit-Model/files/GUID-D237E6DA-CC5B-4BBE-86E1-3C8AC28CF8AF.htm
- Autodesk — Room Area (net) e Computation Height:
  https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-22B6D041-F6D8-4DB0-8094-B325CC3CC6B4.htm
- Autodesk Community — “Room boundary center point cross hairs” (o cruzamento é o Reference handle):
  https://forums.autodesk.com/t5/revit-architecture-forum/room-boundary-center-point-cross-hairs/td-p/11723672
