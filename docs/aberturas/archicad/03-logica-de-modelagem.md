# R3 · ArchiCAD: a lógica de modelagem de portas e janelas (GDL × parede)

Pesquisa para o Hestia. Data: 2026-10-26. Escopo: entender **como o ArchiCAD realmente constrói** uma porta/janela e como ela se relaciona com a parede, para parametrizar o nosso editor. Não altera código.

**Marcações.** *[DOC]* = página oficial da Graphisoft (ajuda, GDL Center, API) lida nesta rodada. *[FÓRUM]* = comunidade/tutorial/suporte, usado como apoio. *[INFERIDO]* = dedução nossa, com o raciocínio explícito. *[NÃO CONFIRMADO]* = não achamos fonte que feche a questão.

---

## 1 · Resumo executivo

1. Porta/janela **não é um sólido solto**: é um objeto GDL “hóspede” de uma parede, com subtipo próprio (`Door (Wall)` / `Window (Wall)`). A parede é quem manda na espessura, nas camadas e no recorte; o objeto manda na geometria da esquadria e no símbolo 2D [DOC: GDL Basics 17; GDL Reference “Doors and Windows”].
2. O **furo padrão é retangular** e tem largura/altura iguais às dimensões **A** e **B** do objeto. Tolerância e “oversize” ampliam esse retângulo; formas não retangulares exigem `WALLHOLE`/`WALLNICHE` (3D) e `WALLHOLE2`/`WALLBLOCK2` (2D) [DOC: GDL Reference; Ajuda “Wall Opening”].
3. A cadeia de dimensionamento é hierárquica: **Wallhole → Unit → Reveal → Egress → Leaf**. Cada uma é derivada da anterior por tolerância, revelo, largura de batente e rebate. Só um par (A/B) é “nominal” por vez [DOC: GDL Tips “Nominal sizes”; Ajuda “Nominal Sizes and Tolerance”].
4. **Reveal (revelo)** é a profundidade com que a esquadria é recuada a partir da face ou do **core** da parede. O mesmo campo controla o recuo do batente e o “sill depth” (`WIDO_SILL`) [DOC: Ajuda “Preview and Positioning”; “Anchor Reveal”].
5. O **reveal side** é o lado “externo” da parede, marcado pelo sol na colocação; é dele que a profundidade do revelo é medida. Ele é independente do lado de abertura da folha [DOC: Ajuda “Placing Doors or Windows”; GDL `WIDO_REVEAL_SIDE`].
6. O batente **não é obrigatoriamente da espessura da parede**: há o checkbox **Frame Thickness = Wall Thickness**; quando desligado, a profundidade do batente é um parâmetro próprio (e o encontro com a parede precisa ser resolvido por revelo, extensão de batente ou acabamento) [DOC: Ajuda “Frame Style and Dimensions”].
7. **Wall Closure** não é geometria 3D: é a regra de **como as camadas (skins) da parede composta “dobram” para dentro do vão**. Na INT library ela afeta a **planta 2D**; o “Turn Plaster” aparece em corte/elevação como extensão do reboco até o batente e, opcionalmente, em 3D [DOC: Ajuda “Wall Closure”].
8. O **alizar/casing** é um acessório separado, com faces interna e externa, largura, espessura, offset e overhang; **não pode coexistir com Turn Plaster** [DOC: Ajuda “Casing”; biblioteca AC9 SE].
9. A folha encaixa no batente por **rebate** (`gs_rebate_width`): a largura da folha é a largura do unit menos duas vezes (largura do batente − rebate). É esse mesmo rebate que define o “batedor” e o recobrimento [DOC: GDL Tips “Nominal sizes”].
10. O ângulo de abertura é **dois parâmetros independentes**: ângulo 2D (símbolo) e ângulo 3D (modelo). A folha gira em torno da dobradiça; a biblioteca é quem precisa garantir que ela não atravesse o batente — não há “colisão automática” documentada [DOC: Ajuda “Opening Type and Angle”; *[NÃO CONFIRMADO]* o teste de colisão].
11. **Sidelight/transom** são componentes do mesmo objeto: a página **Shape** define o arranjo; larguras/alturas são editadas por **hotspots** (ou Tab → “Sidelight Width”); cada componente tem tipo de abertura, direção (igual/oposta à folha) e ângulo próprios [DOC/FÓRUM].
12. O **símbolo 2D** não é um corte comum do 3D: por padrão é o desenho simbólico do objeto (script 2D), gerado a partir de uma projeção interna especial; alternativamente, **Projected** mostra o 3D cortado pelo plano de planta [DOC: GDL Reference “Doors and Windows”; Ajuda “Symbolic vs. Projected”].
13. **Nível de detalhe** é duplo (2D e 3D), com padrão **By MVO** e possibilidade de fixar Full/Medium/Low ou Full/Simplified/Schematic/Off por esquadria [DOC: Ajuda “Detail Level”].
14. Para o nosso editor, o mais importante é copiar a **cadeia de dependências** (nominal → furo → revelo → batente → folha → acabamento) e tratar o **reveal anchor** (face/core) como conceito de primeira classe; o resto é aparência.

---

## 2 · Fundamentos: o que é uma porta/janela no ArchiCAD

### 2.1 Dois objetos, um hóspede

- A porta/janela é um **Library Part** (GDL) do subtipo `Model Element/Opening/Wall Opening/Door (Wall)` ou `.../Window (Wall)`. O subtipo é o que permite ao ArchiCAD tratá-la como abertura e **só permitir colocação em parede** [DOC: GDL Basics 17].
- A parede fornece: espessura (`WALL_THICKNESS`, medida no eixo do vão), inclinação (`WALL_INCL`), camadas (`WALL_SKINS_*`), materiais (`WALL_MAT_A/B/EDGE`) e o recorte. O objeto fornece: batente, folha, vidro, ferragens e símbolo [DOC: GDL Reference “Wall, Door, Window and Wall-end Parameters”].
- O objeto **inclui o wallhole** no seu comportamento; não é um “furo” separado com lifecycle próprio [DOC: GDL Basics 17: “door and window objects include the wallhole as well”].

### 2.2 Origem e sistema de coordenadas

| Contexto | Origem | Eixos | Observação |
|---|---|---|---|
| **3D** | **centro da base do vão**, na **face externa** da parede | X/Y paralelos ao plano da parede; Z perpendicular, “para dentro” da parede | `A` é medido em X (largura), `B` em Y (altura). A origem é deslocada em Z por `WIDO_SILL` (reveal depth) [DOC: GDL Reference “Doors and Windows”; GDL Basics 17] |
| **2D** | centro do vão, alinhado à **borda externa** da parede | X/Y de planta | O símbolo e o modelo 3D são ajustados à origem pelo **centro inferior da bounding box**; **não há ajuste em Z**, para permitir que o objeto avance para fora da parede [DOC: LPM “Creating Doors and Windows”; GDL Reference “Doors and Windows”] |
| **Curva** | idem, com `WIDO_ORIG_DIST` = distância ao centro de curvatura | idem | 0 em parede reta; negativo no fim de parede curvo [DOC: GDL `WIDO_ORIG_DIST`] |

Consequência prática: **modela-se a esquadria “deitada” no plano da parede**, como se o observador estivesse dentro da parede. O que deve ficar “dentro da parede” (batente) tem Z positivo; o que abre para fora (folha) tem Z negativo [DOC: GDL Reference “Doors and Windows”].

### 2.3 A cadeia de dimensões (o “coração” da parametrização)

O ArchiCAD reconhece seis pares de dimensões nominais e permite escolher **um** deles como nominal (A/B):

| Nível | Parâmetros | Definição | Relação com o anterior |
|---|---|---|---|
| **Wallhole** | `ac_wallhole_width` / `ac_wallhole_height` | vão cortado na parede, incluindo tolerância | = Unit + tolerâncias (lados e superior) |
| **Unit** | `ac_unit_width` / `ac_unit_height` | o “produto” que se compra: esquadria completa (batente incluso) | = Wallhole − tolerâncias |
| **Reveal** | `ac_reveal_width` / `ac_reveal_height` | vão livre entre as arestas mais internas do revelo | = Wallhole − 2·(profundidade do revelo), conforme geometria |
| **Egress** | `ac_egress_width` / `ac_egress_height` | distância entre os pontos mais internos do batente (só portas) | = Unit − 2·`gs_frame_width` (largura); = Unit − `gs_frame_width` (altura) |
| **Leaf** | `ac_leaf_width` / `ac_leaf_height` | extensão da folha (só portas) | = Unit − 2·(`gs_frame_width` − `gs_rebate_width`) |
| **A / B** | `A`, `B` | o par que o objeto expõe como nominal | recebe o par escolhido no Parameter Script |

Fórmulas textuais [DOC: GDL Tips “Nominal sizes – Automatic dimensioning”]:

```
ac_unit_width   = ac_wallhole_width  - 2 * tolerance
ac_unit_height  = ac_wallhole_height - 2 * tolerance      (nessa página)
ac_egress_width  = ac_unit_width  - 2 * gs_frame_width
ac_egress_height = ac_unit_height - gs_frame_width
ac_leaf_width    = ac_unit_width  - 2 * (gs_frame_width - gs_rebate_width)
ac_leaf_height   = ac_unit_height - (gs_frame_width - gs_rebate_width)
ac_leaf_width    = ac_egress_width  + 2 * gs_rebate_width
ac_leaf_height   = ac_egress_height + gs_rebate_width
```

**Atenção — divergência documentada:** a Ajuda INT diz que **Wallhole Height = Unit Height + Upper Tolerance** (só a superior), enquanto a página de GDL Tips usa `2 * tolerance` também na altura e a LPM fala em “tolerância vertical”. Isso indica que a tolerância inferior é tipicamente **0** na biblioteca INT, mas o conceito admite os quatro lados. Para o nosso editor, o correto é guardar **quatro tolerâncias independentes** (esquerda, direita, superior, inferior) e default 0 na inferior [DOC: Ajuda “Nominal Sizes and Tolerance”; “Tolerances”; LPM “Creating Doors and Windows”].

### 2.4 Ordem de geração (o que o ArchiCAD calcula primeiro)

1. **Colocação**: escolhe-se a parede, o **reveal side** (lado externo) e a direção de abertura; a âncora horizontal (centro ou lado) define o ponto fixo [DOC: Ajuda “Placing Doors or Windows”].
2. **Parameter Script** resolve a cadeia acima: escolhe o par nominal, recalcula wallhole/unit/reveal/egress/leaf e trava `A`/`B` [DOC: GDL Tips “Nominal sizes”].
3. **Corte da parede**: gera o retângulo A×B (ou o `WALLHOLE`/`WALLNICHE`, se o script existir); soma `oversize` [DOC: GDL Reference; Ajuda “Wall Opening”].
4. **Revelo**: recorta/desenha o reveal conforme `WIDO_HEAD_DEPTH`, `WIDO_THRES_DEPTH`, `WIDO_LEFT_JAMB`, `WIDO_RIGHT_JAMB` e `WIDO_SILL` [DOC: GDL Tips “Reveal options”].
5. **Objeto 3D**: batente na profundidade do revelo, folha/sash com rebate e ângulo, vidro, ferragens [DOC: GDL Basics 17].
6. **Parede composta**: aplica Wall Closure/Turn Plaster por skin (2D e corte; 3D opcional) [DOC: Ajuda “Wall Closure”].
7. **Acessórios**: peitoril, soleira, alizar, toldo, etc., com contra-transformações para não virarem “do avesso” no Flip [DOC: GDL Basics 17].
8. **Símbolo 2D / LOD**: escolhe simbólico × projetado e o nível de detalhe [DOC: Ajuda “Symbolic vs. Projected”; “Detail Level”].
9. **Listagem/IFC**: expõe dimensões nominais, orientação (`ac_openingside`), operação IFC, classificação [DOC: GDL `dw-params`; LPM].

---

## 3 · Pergunta 1 — geometria do furo, folga e camadas

### 3.1 O furo padrão

- Colocar uma porta/janela **sempre corta um furo retangular** na parede. O tamanho é determinado pelos parâmetros **A** e **B** do objeto [DOC: GDL Reference “Doors and Windows”, seção “Non-Rectangular…”].
- Se o objeto tiver elevação não retangular, ele **não preenche** o retângulo; a solução é cortar a forma real com `WALLHOLE`/`WALLNICHE` ou desenhar os “remendos” de parede no 3D [DOC: ibid.].
- O furo é **transversal**: o comando `WALLHOLE` corta a parede com um “tubo infinito” de seção poligonal; o corte padrão atravessa a espessura no eixo do vão (`WALL_THICKNESS`) [DOC: GDL Reference `WALLHOLE`; GDL `WALL_THICKNESS`].

### 3.2 Tolerância × Oversize × Reveal

| Conceito | O que faz | Afeta o nominal? | Onde se define |
|---|---|---|---|
| **Tolerance** | folga entre o **unit** (produto) e o **wallhole** (furo). Wallhole = Unit + tolerâncias | **Sim** (se o nominal for Wallhole) | Custom Settings → **Nominal Sizes and Tolerance** → **Tolerances**; `Uniform Tolerances` liga/desliga por lado |
| **Oversize** | aumenta o furo para **esquerda, direita, cima e/ou baixo**, sem mexer no tamanho nominal | **Não** | Custom Settings → **Wall Opening** → **Opening Oversizes** |
| **Reveal depth** | recua a esquadria a partir da face/core; não muda o tamanho do furo em planta, muda a posição e o “sill depth” | Não (mas `ac_reveal_*` deriva dele) | **Preview and Positioning** / **Wall Opening** / **Reveal** |
| **Wall Inset** (janelas) | rebaixo **abaixo** da janela (ex.: radiador), simétrico ou assimétrico | Não | **Wall Inset** |

Fontes: [DOC: Ajuda “Nominal Sizes and Tolerance”; “Tolerances”; “Wall Opening”; “Wall Inset”].

### 3.3 O furo atravessa todas as camadas?

- **O corte padrão atravessa a parede inteira** (é um prisma de A×B ao longo de `WALL_THICKNESS`) [DOC: GDL Reference `WALLHOLE`; GDL `WALL_THICKNESS`].
- Em parede composta, as camadas não “sobrevivem” ao furo: o que existe é o **Wall Closure**, que **redesenha** as skins dobradas para dentro do vão (2D) e o **Turn Plaster** (corte/elevação). Ou seja: o furo é único e integral; o que muda é o **desenho das camadas nas bordas** [DOC: Ajuda “Wall Closure”; AC18 “Wall Closure” (exemplos de plaster wrapped × custom closure)].
- **Ressalva:** não encontramos uma frase literal “o furo corta todas as skins”. A conclusão acima é *[INFERIDO]* do comportamento do `WALLHOLE` (tubo infinito) + do Wall Closure (as skins são redesenhadas dentro do vão). O que é [DOC] é que o furo é único, retangular e do tamanho A×B, e que o closure é um desenho sobreposto.

### 3.4 Furo customizado (não retangular)

| Comando | Onde | Para que serve | Observações |
|---|---|---|---|
| `WALLHOLE n, status, x1,y1,mask1 …` | 3D script | corta um ou mais polígonos no 3D | Se existir **pelo menos um** `WALLHOLE`, **nenhum** furo retangular é gerado; pode haver vários, até intersectantes; não gera revelo automático; **não tem efeito em 2D** [DOC] |
| `WALLNICHE n, method, status, rx,ry,rz, d, …` | 3D script | corte prismático/piramidal/cunha, finito/semi-infinito/infinito | Mais estável que `WALLHOLE` sob espelhamento; usado para revelos e nichos [DOC] |
| `WALLHOLE2` / `WALLHOLE2{2}` | 2D script | define o polígono do vão **em planta**, com polígono de cobertura | Só afeta a parte cortada da parede; o polígono de cobertura não tem contorno [DOC] |
| `WALLBLOCK2` / `WALLARC2` / `WALLLINE2` | 2D script | estende/redesenha a parede em planta (reveals, guarnições) | `WALLHOLE2` de **outro** objeto corta; do mesmo objeto, não [DOC] |

Fonte: [DOC: GDL Reference “Doors and Windows”, seções WALLHOLE/WALLNICHE/WALLHOLE2/WALLBLOCK2/WALLLINE2/WALLARC2].

### 3.5 Campos de furo na interface

| Campo (EN) | Aba/painel | O que faz | Valores/padrão |
|---|---|---|---|
| `Reveal Type` | Wall Opening / Reveal | tipo de revelo ou “No Reveal” | lista depende da biblioteca |
| `Reveal Depth` | Wall Opening / Reveal / Preview and Positioning | profundidade do recuo | comprimento; 0 = rente à face/core |
| `Opening Oversizes` (Left/Right/Upper/Lower) | Wall Opening | amplia o furo sem afetar nominal | comprimentos; padrão 0 |
| `Wall Closure` | Wall Opening | escolhe o closure (parede composta) | No Closure / tipos |
| `Wall Opening Surface` | Wall Opening | superfície das bordas do vão | `Same as Wall Edge` / `Same as Wall Side` |
| `Uniform Tolerances` | Nominal Sizes and Tolerance | uma tolerância para todos os lados | ligado por padrão |
| `Tolerances` (Side/Upper) | Tolerances | valores por lado | comprimentos |
| `Set as Nominal` | Nominal Sizes and Tolerance | escolhe Wallhole/Unit/Egress/Leaf como nominal | rádio |
| `Transfer Current Nominal Size to Selection` | Nominal Sizes and Tolerance | ao trocar a definição, transporta o valor antigo | checkbox |

Fonte: [DOC: Ajuda “Wall Opening”; “Nominal Sizes and Tolerance”; “Tolerances”].

---

## 4 · Pergunta 2 — revelo, lado do revelo e posição do batente

### 4.1 O que é “Reveal” e “reveal side”

- **Reveal** é o **recuo** da esquadria em relação à face da parede. O valor é a **profundidade do revelo** (também chamado de *sill depth*, `WIDO_SILL`) [DOC: Ajuda “Preview and Positioning”; GDL `WIDO_SILL`].
- **Reveal side** é o **lado de referência** do revelo — o lado “externo” da parede, marcado pelo **sol** e pela linha grossa durante a colocação. Mover o cursor para o lado oposto troca o reveal side; **Tab** também alterna [DOC: Ajuda “Placing Doors or Windows”].
- O reveal side **não é** o lado de abertura da folha. São dois conceitos independentes: um define de que face se mede o recuo; o outro, para onde a folha gira [DOC: GDL `WIDO_REVEAL_SIDE` × `WIDO_ORIENTATION`; Ajuda “Placing…”].
- Padrão: `WIDO_REVEAL_SIDE = 0` para janelas e `1` para portas [DOC: GDL `WIDO_REVEAL_SIDE`].

### 4.2 Ancoragem do revelo: face × core

| `ac_revealAnchorPos` | Nome na UI | Comportamento |
|---|---|---|
| `1` | **Face** | o reveal depth é medido da **face** da parede (lado do reveal side) |
| `2` | **Core** | medido do **core** (a skin core mais próxima, se houver várias) |

- Ancorar no **core** é o que mantém a janela alinhada quando se engorda o isolamento ou se troca o acabamento externo: o recuo se ajusta sozinho para manter a distância ao core [DOC: Ajuda “Anchor Reveal”; API `APIWDRevealDepth_Core`].
- Se a parede deixar de ter core, o anchor volta para **Face** e a profundidade é recalculada para manter a posição [DOC: Ajuda “Anchor Reveal”].
- O `Reveal` da aba **Preview and Positioning** é o **mesmo** valor do `Reveal Depth` da aba **Reveal** [DOC: Ajuda “Preview and Positioning”].

### 4.3 O batente acompanha a parede?

- **Não por padrão conceitual.** O checkbox **Frame Thickness = Wall Thickness** força o batente a ter a espessura da parede; quando desligado, a espessura do batente é um parâmetro independente (`gs_frame_thk` / “Frame Thickness”) [DOC: Ajuda “Frame Style and Dimensions”; GDL Basics 17].
- Em várias portas da biblioteca, esse checkbox vem **ligado e cinza** (não editável); ele só se torna editável em certas combinações (ex.: `Frame Thickness = Wall Thickness` ligado e todas as folhas abrindo no mesmo sentido) [DOC: Ajuda “Frame Style and Dimensions”]. Em versões antigas, dependia também do “Wall Type” (Stud/Solid) [FÓRUM].
- Quando o batente é mais raso que a parede, a biblioteca histórica resolve com **Jamb Extension** (extensão de batente) e/ou com o próprio **Reveal** [DOC: AC9 SE “Casing”; Ajuda “Wall Closure” (reveal to wall core)].

### 4.4 Modelo numérico da posição

Com a origem 3D na **face externa** e Z positivo “para dentro”:

```
z_face_externa = 0
z_inicio_batente = WIDO_SILL            (reveal depth)
z_fim_batente    = WIDO_SILL + gs_frame_thk
z_face_interna   = WALL_THICKNESS
```

- Se `WIDO_SILL = 0`, o batente começa na face externa → **rente à face**.
- Se `WIDO_SILL > 0`, o batente é **recuado**; o espaço entre 0 e `WIDO_SILL` é o revelo (a parede aparece).
- Se `gs_frame_thk = WALL_THICKNESS`, o batente atravessa a parede; se for menor, sobra um vão do lado interno que o acabamento/closure/jamb extension precisa cobrir.
- Em **Flip**, o objeto é espelhado e **arrastado de volta** por `WIDO_FRAME_THICKNESS` [DOC: GDL Reference “Doors and Windows”; `WIDO_FRAME_THICKNESS`].

*[INFERIDO]* O desenho acima é a leitura direta de “origem deslocada em Z por `WIDO_SILL`” + “frame thickness = wall thickness” + “flip desloca por frame thickness”. Não há uma página que escreva a equação completa.

### 4.5 Onde ficam os controles

| Campo (EN) | Aba/painel | O que faz | Valores/padrão |
|---|---|---|---|
| `Width` / `Height` | Preview and Positioning | dimensões nominais do vão (A/B) | comprimento |
| `Sill/Header Value` + pop-up | Preview and Positioning | altura do peitoril/verga a partir da referência escolhida | `Sill to Wall Base`, `Sill to Wall Top`, `Sill to Story`, `Header to …`, `Relink Anchor Story` |
| `Reveal` | Preview and Positioning | profundidade do revelo | comprimento; = Reveal Depth |
| `Anchor` (Face/Core) | Preview and Positioning | referência do revelo | Face / Core |
| `Flip` | Preview and Positioning / Info Box | troca o lado de abertura mantendo o batente | botão |
| `Anchor Point` | Preview and Positioning / Info Box | coloca pelo centro ou pelo lado | Center / Side |
| `Opening Plane` | Preview and Positioning | acompanha a parede inclinada ou fica vertical | `Associated to Wall` / `Vertical` |
| `Reveal Type` / `Reveal Depth` | Reveal | idem | lista + comprimento |
| `Head Depth`, `Sill/Threshold Depth`, `Left/Right Jamb Depth` | Reveal (legado) | dimensões do revelo por lado | só para objetos não padrão/legado |
| `ac_revealAnchorPos` | GDL (fix named) | 1=Face, 2=Core | inteiro |
| `ac_revealToWallCore` | GDL (fix named) | profundidade medida do core | comprimento |

Fontes: [DOC: Ajuda “Preview and Positioning”; “Other Panels in Door/Window Settings”; “Reveal Settings”; GDL `dw-params`; API `API_WindowType`].

### 4.6 Wall Inset (janelas) — um recuo diferente do revelo

- O **Wall Inset** cria um **rebaixo abaixo da janela**, para radiador/bancada. Não é o revelo.
- Modos: **Automatic** (largura = largura da janela), **Symmetric** (largura e altura fixas, centrado), **Asymmetric** (overhangs esquerdo/direito diferentes, altura única). Tem elevação de fundo (0 = até o piso), profundidade e “Show Hidden Parapet on 2D” [DOC: Ajuda “Wall Inset”].

---
