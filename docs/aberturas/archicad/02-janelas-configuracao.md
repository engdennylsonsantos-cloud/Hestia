# Dossiê R2 · ArchiCAD — configuração de JANELAS (diálogo e abas)

**Escopo:** ferramenta Janela (Window) e biblioteca INT do ArchiCAD; janela de canto, claraboia/janela de telhado e porta-balcão quando o comportamento é próprio. Não cobre portas de giro em detalhe (dossiê R1).
**Versões lidas:** AC28 (principal), AC24 (abas de linhas de abertura e nível de detalhe), AC26 (Elementos), AC18 e AC17 (hierarquia antiga, ainda útil para nomes de abas), AC30/AC29 apenas onde a página equivalente foi localizada. Páginas em inglês (INT) e em português (BRA/POR) para fixar a tradução dos campos.
**Convenção:** [DOC] = ajuda oficial lida; [FÓRUM] = comunidade/loja/treinamento; [INFERIDO] = dedução declarada. “NÃO CONFIRMADO” = não achei fonte que feche a lista.

---

## 1. Resumo executivo

1. A janela do ArchiCAD **não é uma família com parâmetros livres**: é um objeto GDL da biblioteca (Basic Window, variantes de correr, guilhotina, arco, multi-sash etc.). O diálogo mostra apenas os parâmetros que aquele objeto expos. Por isso a lista de abas e de opções **varia com o objeto escolhido** — a ajuda oficial diz isso explicitamente.
2. O diálogo tem três camadas: **painéis** (Pré-visualização e Posicionamento, Definições Personalizadas, Planta e Corte, Marcador de Dimensão, Classificação e Propriedades), **páginas principais** (Definições e Abertura, Abertura na Parede, Equipamentos e Acessórios) e **subpáginas** acessadas pelo ícone à direita de cada campo.
3. A dimensão nominal pode ser medida de quatro formas: **Wallhole** (furo), **Unit** (conjunto), **Egress** (largura livre) e **Leaf** (folha). A escolha “Set as Nominal” define o que vai para o quadro e para os campos Width/Height. Tolerância e **Oversize** aumentam o furo de modos diferentes: a tolerância entra na nominal; o oversize não.
4. A **forma** (Shape) define a composição de folhas/painéis e a existência de bandeira (transom) e luz lateral (sidelight). O número de folhas não é um campo único: vem da variante de biblioteca e das caixas da página Shape.
5. As **divisões de caixilho** (muntins) ficam em Sash Type/Sash Options, por folha ou por bandeira: grade H-V, grade editável por hotspots, estilos Prairie, painel customizado; com número de panes horizontais/verticais e posição da grade (dentro, fora ou atravessando).
6. O **tipo de abertura** é por componente (folha, luz lateral, bandeira), com ângulo 2D e 3D separados; correr usa distância em vez de ângulo. A biblioteca nomeia pelo menos `Fixed Glass`, `Fixed Sash`, `Side Hung`, `Side Hung Mirrored`, `Tilt and Turn`; os demais tipos vêm das variantes (awning/top hung, double hung, sliding, pivot, hopper).
7. **Moldura**: junta mitrada ou de topo (`Mitered`/`Butt Joint`), largura uniforme ou por lado (`Uniform Frame Width` + `Frame Widths`), espessura do batente e, em portas, `Frame Thickness = Wall Thickness`. Nas janelas não achei um seletor de “Frame Style”; ele aparece nas portas (três estilos, o mais simples é `Block`).
8. **Vidro**: espessura e material/superfície são parâmetros do caixilho; a representação de vidro duplo é um nível de detalhe 2D (`Full – Double Glazing`), não um campo de “tipo de vidro”.
9. O **assentamento** é controlado por Reveal Type + Reveal Depth, com âncora na **face** ou no **núcleo** da parede composta. A âncora no núcleo mantém o afastamento quando o acabamento muda; se a parede perder o núcleo, a âncora volta para a face.
10. O **fechamento da parede** (Wall Closure) gira as camadas da parede para dentro do vão; `Turn Plaster` faz o reboco virar para fora do contorno definido pelo reveal. Wall Closure é 2D (com opção “Show in 3D” no Turn Plaster); **alizar e Turn Plaster são mutuamente exclusivos**.
11. **Peitoril externo** (`Sill`) e **peitoril interno/tábua** (`Board`) são peças distintas; `Threshold` é soleira de porta. O `Sill` tem tipo, espessura, largura, ângulo, nariz e `Slip in Depth`; o `Board` tem curvatura e paralelismo em parede poligonal.
12. **Wall Inset** é o recorte abaixo da janela (radiador): automático, simétrico ou assimétrico, com elevação de base, profundidade e linha de parapeito oculto em 2D. **Masonry Arch** acrescenta arco de alvenaria (stipla/abobadilha), com estilo, rise, keystone, nicho e transpasse.
13. **Brise/sunshade** é acessório com tipo, abertura 3D, símbolo 2D, quadro extra e altura; não existe se a janela tiver luz lateral elevada. **Ganging** alinha janelas vizinhas e apaga as linhas de encontro.
14. **Janela de canto** tem ferramenta própria (`Corner Window`), cria um par espelhado e solidário; a alternativa é usar duas janelas com `Custom Corner` (Frame / Corner Column / Glass). **Claraboia** usa a ferramenta Skylight, é inserida em Telhado ou Shell e, por padrão, é desenhada em planta por projeção 3D.
15. **Representação**: `Symbolic` (símbolo independente do 3D), `Projected` e `Projected with Overhead`; as linhas de abertura são globais por MVO no AC28 (no AC24 havia override por elemento). O nível de detalhe 3D é `Schematic`/`Simplified`/`Full`/`Off`; o 2D é sensível à escala, fixo por escala ou desligado.

---

## 2. Mapa do diálogo

### 2.1 Painéis do diálogo (AC28)

| Painel | O que contém | Observações |
|---|---|---|
| **Preview and Positioning** | Width, Height, Sill/Header value + referência, Reveal depth + âncora, Flip, Anchor Point, Opening Plane, preview 2D/3D | Width/Height são a **Nominal Size**; o Reveal aqui é o mesmo da aba Reveal. [DOC AC28 150-16] |
| **Custom Settings** | Interface gráfica do objeto; nome varia (ex.: Basic Window Settings). Contém as páginas principais e subpáginas | Só existe se o objeto tiver UI; senão fica cinza. [DOC AC28 150-15/17] |
| **Floor Plan and Section** | Atributos 2D simplificados, Floor Plan Display, override de linhas/pens/fills | Pode sobrescrever os atributos GDL. [DOC AC28 151-29; AC28 150-18] |
| **Dimension Marker** | Marcador, Subfloor Thickness, unidades de cota | Não altera a posição da janela. [DOC AC28 150-19] |
| **Marker Custom Settings** | Opções do marcador escolhido | Cinza se não houver marcador compatível. |
| **Classification and Properties** | Classificação/IFC e propriedades | Painel de metadados. |
| **Model** (oculto por padrão) | Uma única superfície para o objeto | Habilitar em Options > Work Environment > Tool Settings Dialog Boxes. [DOC AC28 150-19] |

### 2.2 Hierarquia das páginas principais (janela INT)

O caminho curto é **Definições e Abertura → Abertura na Parede → Equipamentos e Acessórios**; o resto são subpáginas acessadas pelo ícone à direita do campo. [DOC AC28 150-17]

| Grupo | Páginas |
|---|---|
| Dimensão e forma | Nominal Sizes and Tolerance; Shape |
| Conjunto | Door/Window Settings and Opening (na janela: Window Settings and Opening) |
| Caixilho | Frame and Sash; Frame Widths; Sash Type/Sash Options; Opening Type and Angle |
| Parede | Wall Opening; Reveal Settings; Wall Closure; Wall Inset (janela); Masonry Arch; Tolerances |
| Acessórios | Fixtures and Fittings; Threshold; Sill; Board; Casing Outside/Inside; Sunshade; Custom Corner |
| Atributos | Model Attributes of Door/Window Opening; Model Attributes of Wall Opening; Model Attributes of Fixtures and Fittings; Floor Plan and Section; Minimal Space |

**AC18/AC17 (legado):** além dessas, apareciam `Parameters` (lista “All Parameters”), `Model`, `Reveal`, `Listing and Labeling` e `Tags and Categories`. A página “Graphical Interface Panel for a Window” listava Nominal Sizes, General Settings, Shape, Frame and Sash, Frame Widths, Sash Options, Opening, **Opening Lines**, Reveal, Wall Closure, Custom Closure, Custom Corner, Inside/Outside Casing, Sill, Board, Wall Inset, Sunshade e Masonry Arch. [DOC AC18 Appendix_Tools-56 a -74]

### 2.3 Nomes em português (biblioteca INT / BRA)

| Inglês | PT-BR (ajuda oficial) | Observação |
|---|---|---|
| Nominal Sizes and Tolerance | Tamanhos Nominais e Tolerância | |
| Shape | Forma | |
| Settings and Opening | Definições de Porta/Janela e Abertura | na janela, “Window Settings and Opening” |
| Frame and Sash | Batente e Caixilho | |
| Frame Widths | Larguras dos Batentes | |
| Sash Type/Sash Options | Tipo de Caixilho/Opções de Caixilho | |
| Opening Type and Angle | Tipo de Abertura e Ângulo | |
| Wall Opening | Abertura da Parede | |
| Reveal Settings | Definições do Requadro | “gola” em POR |
| Wall Closure | Fechamento da Parede | |
| Wall Inset | Recorte na Parede | |
| Masonry Arch | Arco de Alvenaria | |
| Threshold | Soleira | |
| Sill | Soleira/Peitoril | peitoril externo |
| Board | Peitoril Interno / Bordo | tábua interna |
| Casing | Guarnição / Alizar / Aro | |
| Sunshade | Toldo / Pára-Sol | brise |
| Custom Corner | Personalizar Canto / Canto Personalizado | |

Fonte dos nomes: [DOC AC28/BRA 151-1..31] e [DOC AC28/POR 151-1].

---

## 3. Dimensões nominais, tolerâncias e vão

**Página:** Nominal Sizes and Tolerance (Tamanhos Nominais e Tolerância). [DOC AC28 151-2; AC24 141-2; AC18 57]

| Campo | O que faz | Valores/opções | Padrão | Onde |
|---|---|---|---|---|
| **Wallhole Dimensions** | Furo bruto na parede | largura = Unit + tolerâncias laterais; altura = Unit + tolerância superior | — | Nominal Sizes |
| **Unit Dimensions** | Tamanho do conjunto (moldura + folhas) | largura/altura totais | — | Nominal Sizes |
| **Egress Dimensions** | Dimensão de passagem/escape | largura do Unit menos a largura do batente | — | Nominal Sizes (AC24/AC28) |
| **Leaf Dimensions** | Dimensão da folha | medida da folha | — | Nominal Sizes (AC24/AC28) |
| **Set as Nominal** | Escolhe qual definição é a nominal | Wallhole / Unit / Egress / Leaf | Unit (implícito) | Nominal Sizes |
| **Transfer Current Nominal Size to Selection** | Ao trocar a definição, transfere o valor antigo para a nova e reajusta as demais | on/off | off | Nominal Sizes |
| **Show Dimensions in Marker** | Dimensão exibida no marcador | Wallhole / Unit / Leaf / Egress | — | Nominal Sizes + Marker Symbol and Text > Content-Dimensions |
| **Uniform Tolerances** | Uma tolerância para todos os lados + tolerância superior | on/off | on | Nominal Sizes |
| **Tolerances** (página) | Tolerâncias laterais e superior individuais | valores por lado | uniforme | Tolerances [DOC AC28 151-20] |
| **Oversize** (página Wall Opening) | Aumenta o furo à esquerda/direita/acima/abaixo | valores em mm/m | 0 | Wall Opening [DOC AC28 151-15] |

**Regra importante:** a tolerância entra no cálculo da **Nominal Size** (Wallhole = Unit + tolerância); o **Oversize** aumenta o furo **sem** alterar a nominal. A própria ajuda alerta para não confundir os dois. [DOC AC28 151-2 e 151-15]

**Dependência:** o furo (wallhole) é o recorte real na parede; a moldura é posicionada dentro do Unit; a folha dentro da moldura; o vidro dentro da folha. O Reveal Depth define quanto o conjunto entra na parede; a âncora (face/núcleo) define de onde essa profundidade é medida. [DOC AC28 150-16; 151-15/16; 040-312]

---

## 4. Forma, folhas, caixilhos e bandeira

### 4.1 Shape (Forma)

**Página:** Shape. [DOC AC28 151-3; AC18 59; AC17 56]

A ajuda atual é deliberadamente curta: “define the configuration of door leaves/window panes and their divisions” e, conforme a janela, permite **adicionar bandeiras (transoms) e opções**. Os controles concretos são desenhados no script de interface do objeto — não há uma lista universal. [DOC AC28 151-3]

O que se pode afirmar com segurança:

| Aspecto | Como o ArchiCAD trata | Fonte |
|---|---|---|
| Quantidade de folhas/painéis | Vem da **variante de biblioteca** e das caixas de composição da página Shape; não é um único campo “nº de folhas” na Basic Window | [DOC AC28 151-3] + [FÓRUM community “specific type of window”] |
| Bandeira (transom) | É uma divisão horizontal com **sash próprio**, editável em Sash Options e Opening Type. A página Shape liga/desliga e posiciona | [DOC AC28 151-3/13] + [FÓRUM] |
| Luz lateral (sidelight) | Componente separado, com tipo de abertura e sentido próprios (“Same as Leaf” / “Opposite to Leaf”) | [DOC AC28 151-13; 151-22] |
| Formas não retangulares (arco, segmento, trapézio, octógono) | Não são um campo da Basic Window; a biblioteca INT traz **objetos próprios** (ex.: “W Arched Cas”, segmentados) e parâmetros de altura de ombro/raio | [DOC AC18 59] + [FÓRUM community “Segmental Arched Transom”] + [INFERIDO] |
| Multi-sash | Variantes “Horizontal Multi-Sash Window” / “Vertical Multi-Sash Window” têm nº de panes e “Multiply Units” | [FÓRUM community “window parameters in AC19”] |

### 4.2 Sash Type / Sash Options (Tipo de Caixilho / Opções)

**Página:** Sash Type/Sash Options. [DOC AC28 151-10; AC18 62; AC17 59]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Seleção da folha/bandeira** | Escolhe qual sash está sendo editado | pop-up “Sash 1”, “Sash 2”, “Transom”… | topo da página |
| **Uniform Sashes** | Aplica o mesmo tipo a todas as folhas | on/off | topo |
| **Sash Type / pattern of mullions** | Padrão de divisão do vidro | No Mullions/Fixed; H-V Grid; **Editable Grid** (H-V Grid Custom); Prairie (Simple/Detailed); Custom Panel; Divided Sash (porta) | página |
| **Panes horizontally / vertically** | Nº de panes na horizontal e na vertical | inteiros | após escolher a grade |
| **Parâmetros da grade** | Largura/espessura dos montantes, proporção, divisão | valores | página |
| **Position** | Onde a grade fica | Inside / Outside / **Throughout** (atravessa os dois lados) | página |
| **Custom Panel** | Usa um painel GDL criado pelo usuário | nome do objeto | página |
| **Editable Grid** | Divisões editáveis por hotspots no projeto | — | nota da página |

**Sobre a lista exata:** a documentação atual não enumera todos os padrões; nomeia explicitamente `Editable Grid` e `Custom Panel` e mostra a galeria de padrões. A lista de seis valores abaixo vem da documentação oficial antiga da biblioteca Special Edition (AC9), útil como referência histórica, mas **não é garantida para a INT atual**: No Mullions, H-V Grid, H-V Grid Custom, Simple Prairie, Detailed Prairie, Custom Panel. [DOC antigo AC9 SE Illustrated Windows §5.3] Em AC18 aparece ainda `Divided Sash` para portas; a comunidade registra que ele **não está disponível para janelas**. [DOC AC18 62] + [FÓRUM community “specific type of window”]

### 4.3 Contagem e composição de folhas — o que depende do quê

- A **geometria externa** (Unit) é fixa: largura × altura. As folhas são repartidas dentro dela.
- O **tipo de caixilho** (sash type) não muda o número de folhas; muda a divisão interna do vidro.
- A **quantidade de folhas** é decidida na Shape/variante. Em geral: Basic Window = 1 folha (com opção de luz lateral/bandeira); variantes “Double Sash”, “Triple”, “Multi-Sash”, “Sliding” etc. trazem 2, 3 ou n folhas.
- A **bandeira** é uma folha adicional acima, com sash e opening type próprios; a **luz lateral** é uma folha adicional ao lado, com sentido “Same as Leaf” ou “Opposite to Leaf”.
- O **ganging** não muda a geometria das folhas; só suprime linhas de encontro entre aberturas vizinhas. [DOC AC28 151-22]

**[INFERIDO]** Para o nosso editor, isso sugere modelar `leafCount` e `transom` como decisões de **família/tipo**, e `sashType`/`grid` como subdivisões da folha — não tentar reproduzir a árvore GDL inteira.

---

## 5. Tipo de abertura e ângulos

**Página:** Opening Type and Angle (Tipo de Abertura e Ângulo). [DOC AC28 151-13; AC18 63; AC17 60]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Opening Type** | Tipo de abertura **por componente** (folha, luz lateral, bandeira) | pop-up dependente do objeto | página |
| **2D Opening Angle** | Ângulo desenhado no símbolo 2D | graus | página |
| **3D Opening Angle** | Ângulo de abertura no 3D | graus | página |
| **Sidelight/Transom: Opening Direction** | Sentido da luz lateral/bandeira em relação à folha | Same as Leaf / Opposite to Leaf | página |
| **Sidelight/Transom: Opening Type** | Tipo próprio da luz lateral/bandeira | pop-up | página |
| **3D Opening Angle/Distance** | Ângulo (ou distância, se correr) | graus / distância | página |
| **Editable hotspots** | Ajuste gráfico do ângulo no projeto | — | nota |

**Tipos que a biblioteca expõe (nomes confirmados):** `Fixed Glass`, `Fixed Sash`, `Side Hung`, `Side Hung Mirrored`, `Tilt and Turn`. [FÓRUM community “Window Schedule”, parâmetro `stOpeningType`] A documentação de portas confirma `Double-Acting` e `Side Hung`; [DOC AC18 41] as variantes de janela acrescentam, pelos nomes dos objetos e pelos catálogos: casement (side hung), awning/top hung, double hung (guilhotina), sliding (correr), pivot (pivotante), hopper/bottom hung (basculante inferior) e combinações tilt-and-turn. [FÓRUM/LOJA: catálogos e discussões; DOC AC9 SE §5.3 para “double hung”]

**Mapeamento prudente para o nosso vocabulário:**

| Nosso termo | Nome provável no ArchiCAD | Ressalva |
|---|---|---|
| Fixa | Fixed Glass / Fixed Sash | “Glass” = só vidro; “Sash” = caixilho fixo |
| Giro / maxim-ar | Side Hung / Side Hung Mirrored | “Side Hung” é eixo vertical; não confundir com “maxim-ar” brasileiro, que costuma ser top-hung |
| Maxim-ar (top-hung) | Awning / Top Hung | o nome varia com a biblioteca |
| Basculante | Hopper / Bottom Hung / Tilt | “Tilt and Turn” é o sistema duplo |
| Giro-basculante | Tilt and Turn | um sash, dois modos |
| Correr | Sliding | usa distância, não ângulo |
| Guilhotina | Double Hung | duas folhas verticais |
| Pivotante | Pivot | eixo horizontal ou vertical |
| Fixa + bandeira | Fixed + Transom | bandeira é componente separado |

**Atenção:** a lista de opções do pop-up **não é global**; cada objeto da biblioteca oferece o subconjunto que seu script suporta. A própria ajuda diz “available settings depend on the library part”. [DOC AC28 151-13]

---

## 6. Moldura, caixilho e vidro

### 6.1 Frame and Sash (Batente e Caixilho) — janela

**Página:** Frame and Sash. [DOC AC28 151-11; AC18 60; AC17 57]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Frame Element Joinery** | Tipo de junta dos cantos | **Mitered** / **Butt Joint** | página |
| **Uniform Frame Width** | Uma largura de batente para todo o perímetro | on/off | página |
| **Frame width** | Largura visível do batente | medida | página |
| **Frame thickness** | Espessura/profundidade do batente | medida | página |
| **Sash width/thickness** | Dimensões do caixilho da folha | medidas | página |
| **Glass thickness** | Espessura do vidro | medida | página (Frame and Sash / Leaf and Sash Dimension) |
| **Set Frame Widths** | Vai para a página de larguras por lado | botão | página |

**Frame Widths (Larguras dos Batentes):** com `Uniform Frame Width` ligado, um único valor; desligado, valores independentes para cada lado (esquerda, direita, superior, inferior), necessário para janelas de forma complexa. [DOC AC28 151-12; AC18 61]

### 6.2 Estilos de moldura

- Nas **portas**, a página Frame Style and Dimensions oferece **três estilos**; o mais simples chama-se **Block** e é forçado quando o tipo de abertura é “double-egress”. [DOC AC28 151-5]
- Nas **janelas**, a documentação da Basic Window **não mostra** um pop-up “Frame Style”; mostra junta, largura e espessura. [DOC AC28 151-11]
- Os nomes dos outros dois estilos de porta **NÃO CONFIRMADOS** (a ajuda só nomeia Block).
- Para portas, `Frame Thickness = Wall Thickness` iguala batente e parede; `Uniform Frame Thickness` só fica disponível nesse caso e se todas as folhas abrirem no mesmo sentido. [DOC AC28 151-5]

### 6.3 Vidro

| Aspecto | Como aparece | Fonte |
|---|---|---|
| Espessura | `Glass Thickness` no caixilho/folha | [DOC AC28 151-11; 151-9] |
| Material/superfície | Atributos do vidro (surface material) e pente 3D | [DOC AC28 151-14; AC18 62] |
| Painéis | O nº de panes vem do Sash Type; o vidro é uma peça por pane | [DOC AC28 151-10] |
| Vidro duplo | Representação 2D “Full – Double Glazing” (linha dupla), não um campo de composição | [DOC AC28 140-40; AC29 LU2 release note] |
| Elevação | O vidro é representado como **forma sólida**; não é transparente em elevação | [DOC AC28 040-305] |
| Curvas | `Curve Resolution` divide componentes curvos em segmentos; aumenta o arquivo | [DOC AC28 151-14] |

**Não confundir:** “Glass Thickness” é geometria; “Glass Material/Surface” é atributo; “Double Glazing” é detalhe de desenho. O ArchiCAD não tem, na Basic Window, um campo “tipo de vidro” (laminado, temperado, low-e) — isso é material/classificação ou parâmetro de biblioteca específica. **NÃO CONFIRMADO** para todas as variantes.

---

## 7. Abertura na parede: reveal, assentamento e âncora

### 7.1 Wall Opening (Abertura da Parede)

**Página:** Wall Opening. [DOC AC28 151-15]

| Campo | O que faz | Valores/opções | Padrão | Onde |
|---|---|---|---|---|
| **Reveal Type** | Tipo de requadro/assentamento | lista de tipos + opções “No Reveal” | depende da biblioteca | Wall Opening |
| **Reveal Depth** | Profundidade do requadro (quanto a janela entra na parede) | medida | — | Wall Opening, Reveal, Preview and Positioning |
| **Wall Closure** | Fechamento das camadas da parede composta | predefined / custom / No Closure | No Closure | Wall Opening |
| **Masonry Arch** | Liga o arco de alvenaria | on/off + tipo | off | Wall Opening |
| **Opening Oversizes** | Aumenta o furo à esquerda, direita, acima e abaixo | medidas | 0 | Wall Opening |
| **Wall Opening Surface** | Superfície aplicada às paredes do vão | **Same as Wall Edge** / **Same as Wall Side** | — | Wall Opening |

**Wall Opening Surface — o que muda:**

- `Same as Wall Edge`: a superfície da **borda** da parede é aplicada às paredes do vão.
- `Same as Wall Side`: as superfícies **externa e interna** da parede são aplicadas às paredes do vão, com o **Reveal Depth como linha de divisão** entre elas.
- Em parede curva, a divisão entre as duas superfícies pode ser reta ou em arco (`Hole Surface’s Split is Curved`). [DOC AC28 151-15/21]

### 7.2 Reveal Settings (Definições do Requadro)

**Página:** Reveal Settings. [DOC AC28 151-16; AC18 65; AC17 62]

| Campo | O que faz | Onde |
|---|---|---|
| **Reveal Type** | Escolhe o tipo construtivo do requadro | Reveal |
| **Head dimension** | Dimensão do requadro no topo (verga) | Reveal |
| **Jamb dimension** | Dimensão do requadro nas laterais (ombreiras) | Reveal |
| **Reveal Depth** | Profundidade; é o mesmo valor do Preview and Positioning | Reveal |

A página só entrega tipo + dimensões de cabeça/ombreira + profundidade. **Não há**, na janela padrão, campos separados para “recuo superior”, “recuo inferior” e “recuo lateral” — o controle fino é feito pelo tipo de reveal e pelo `Reveal Depth`. [DOC AC28 151-16]

### 7.3 Anchor Reveal (âncora do requadro)

O Reveal pode ser ancorado em:

- **Wall Face** — face da parede (superfície acabada);
- **Wall Core** — núcleo (a camada estrutural mais próxima, se houver várias).

**Efeito prático:** ancorar no núcleo mantém a janela alinhada quando a espessura do acabamento muda (por exemplo, isolamento mais grosso) e alinha aberturas em paredes compostas que só diferem no revestimento. Se a parede deixar de ter núcleo, a âncora volta automaticamente para “Wall Face” e a profundidade é recalculada para manter a posição. [DOC AC28 040-312]

**Relação com o nosso DEC-1:** o ArchiCAD permite ancorar no núcleo ou na face; o Hestia limita o batente ao núcleo. Não são a mesma decisão: aqui a âncora é uma **referência de posicionamento**, não um limite de profundidade. [INFERIDO]

### 7.4 Assentamento externo (lado de fora)

- O ícone de **sol** e a linha grossa, durante a colocação, indicam o lado **externo** (reveal side); mover o cursor para o lado oposto da parede troca o lado. [DOC AC28 040-306]
- O `Flip` troca o sentido de abertura mantendo a moldura no lugar. [DOC AC28 150-16]
- Em parede inclinada, `Opening Plane` decide se a janela acompanha o plano da parede (`Associated to Wall`) ou fica vertical (`Vertical`). Em parede de perfil complexo, a inclinação vem da `Opening Reference Layer` do perfil. [DOC AC28 040-309]

### 7.5 Parede curva, poligonal e inclinada

| Situação | Comportamento | Fonte |
|---|---|---|
| Parede curva | A janela acompanha a curvatura; o vão é recortado na parede curva; superfícies do vão podem dividir-se em arco | [DOC AC28 040-315; 151-21] |
| Parede poligonal | O `Board` pode seguir o polígono da parede ou ficar paralelo à janela | [DOC AC28 151-25] |
| Parede inclinada | `Opening Plane` = Associated to Wall ou Vertical | [DOC AC28 040-309] |
| Parede de perfil complexo | A inclinação é definida no Profile Manager pela Opening Reference Layer | [DOC AC28 040-309] |

---

## 8. Fechamento da parede (Wall Closure) e alizar (Casing)

### 8.1 Wall Closure (Fechamento da Parede)

**Página:** Wall Closure. [DOC AC28 151-17; AC18 66; AC17 63]

Só é relevante em **parede composta**. A ajuda é explícita: “these settings only affect the display of openings in 2D views”; o Turn Plaster também aparece em corte/elevação e, se `Show in 3D` estiver ligado, no 3D. [DOC AC28 151-17]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Closure Type** | Tipo de fechamento | No Closure; tipos predefinidos; Custom Closure | Wall Closure |
| **Turn Skin on Side** | Em que lados as camadas viram para dentro | Left / Right / Both | Wall Closure |
| **Number of Skins to Turn** | Quantas camadas viram | inteiro | Wall Closure |
| **Number from** | De onde a contagem começa | Outside face / Inside face | Wall Closure |
| **Profile Width** | Largura do elemento de fechamento pré-fabricado (cavity closure) | medida | Wall Closure |
| **Insulation Strip** | Faixa de isolamento no fechamento | on/off + espessura | Wall Closure |
| **Turn Plaster** | Faz o reboco virar no vão | Automatically / número de camadas | Wall Closure |
| **Plaster Skin Definition** | Define o que é “reboco” | Use Wall Finish Component / Plaster Thickness Limit | Wall Closure |
| **Custom Closure** | Fechamento por camada | Select Skin to Edit: Left jamb / Right jamb / Both; escolha da skin; Turn-in Skin; thickness; hatch orientation; separating line pen; Consider Skin as Plaster | Wall Closure |

**Tipos de fechamento predefinidos (AC17 New Features, histórico):** Variable Cavity Closure, Plaster Reveal, Insulated Reveal, Insulation Closure for Renovation, Finish Closure, Air Space Closure. A lista atual pode variar; a ajuda do AC28 só diz “predefined or custom”. [DOC AC17 NewFeatures-43] + [DOC AC28 151-17]

### 8.2 Turn Plaster — posição em relação à espessura e ao acabamento

Regras que importam para o nosso mapeamento:

1. O `Turn Plaster` vira a camada de reboco **para fora do contorno da parede** definido no Reveal. [DOC AC28 151-17]
2. `Use Wall Finish Component` considera reboco a camada marcada como **Finish** na parede composta; `Plaster Thickness Limit` considera reboco toda camada até uma espessura limite (ex.: 40 mm). [DOC AC28 151-17]
3. Com reboco virado como “plaster skin”, a **profundidade do jamb é medida na camada resistente** e a largura nominal do reveal pode ficar **maior** que a medida entre as faces de reboco. Sem `Consider Skin as Plaster`, a camada é envolvida como fechamento comum e a largura nominal coincide com a medida entre as camadas envolvidas. [DOC AC28 151-17; AC18 66 — exemplo de 60 mm de jamb e 780 mm nominais]
4. `Turn Plaster` e `Casing` **não podem coexistir** no mesmo lado; se o Turn Plaster estiver cinza, desligue o Casing interno/externo. [DOC AC28 151-17/26]
5. O número de camadas pode ser contado a partir da **face externa** ou da **face interna**; a escolha muda o resultado em paredes com acabamentos diferentes. [DOC AC28 151-17]

### 8.3 Casing Outside/Inside (Alizar externo/interno)

**Páginas:** Casing Outside / Casing Inside. [DOC AC28 151-26; AC18 68/69]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Outside Casing / Inside Casing** | Liga o alizar no lado externo/interno | on/off | Casing Outside/Inside |
| **Casing parameters** | Largura, espessura, offset, overhang, material | medidas/atributos | Casing Outside/Inside |
| **Casing below Sill** | Acrescenta alizar abaixo do peitoril | on/off (só se houver sill) | Casing Inside (AC18) |
| **Attributes** | Fill, material e pen do alizar | atributos | subpágina Attributes |

**Posição:** o alizar é aplicado na **face** da parede (interna ou externa), em volta do vão; a espessura do alizar acrescenta ao volume, mas não altera o furo. Nas pré-visualizações, a espessura da parede é usada para mostrar o alizar no contexto. [DOC AC28 040-307]

**Relação com o acabamento:** como o Casing é aplicado na face, ele cobre a junta entre moldura e parede; é a alternativa ao `Turn Plaster`, que faz o acabamento entrar no vão. O ArchiCAD trata os dois como **exclusivos**. [DOC AC28 151-17/26]

**Não confundir:** `Casing` (alizar/guarnição) não é `Wall Closure` (fechamento das camadas). O primeiro é uma peça de acabamento; o segundo é a continuação das camadas da parede dentro do vão. [INFERIDO a partir das definições]

---

## 9. Peitoril, tábua interna, soleira e pingadeira

### 9.1 Sill (peitoril externo)

**Página:** Sill Settings. [DOC AC28 151-24; AC18 70]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Sill** | Liga o peitoril | on/off | Sill |
| **Sill Type** | Tipo de peitoril | pop-up dependente da biblioteca | Sill |
| **3D Detail** | Nível de detalhe do peitoril no 3D | **Simple** / **Detailed** | Sill |
| **Thickness** | Espessura | medida | Sill |
| **Width** | Largura | medida | Sill |
| **Angle** | Inclinação/queda | graus | Sill |
| **Nosing** | Nariz/saliência frontal | medida | Sill |
| **Slip in Depth** | Quanto o peitoril entra sob a moldura; **máximo = espessura da moldura**; soma-se à Sill Width | medida | Sill |
| **Sill Oversize** (AC18) | Faz a altura do peitoril incluir a espessura; se desligado, vai só até a base | on/off | Sill (AC18) |
| **Is Curved in Curved Walls** | Curva o peitoril em parede curva | on/off | Sill |
| **Attributes** | Fill, material, pen | atributos | subpágina |

**Pingadeira:** não há campo “drip” separado; o efeito de pingadeira é obtido pelo **nosing** + **angle** do tipo de sill. **NÃO CONFIRMADO** como peça independente — na Basic Window não achei um controle com esse nome. [INFERIDO]

### 9.2 Board (tábua/peitoril interno)

**Página:** Board Settings. [DOC AC28 151-25; AC18 71]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Board** | Liga a tábua interna | on/off | Board |
| **Is Curved in Curved Walls** | Acompanha a parede curva | on/off | Board |
| **Board edge** | Em parede poligonal: segue o polígono ou fica paralelo à janela | **Parallel to Wall Polygon** / paralelo à janela | Board |
| **Attributes** | Fill, material, pen (visível em janelas de corte) | atributos | subpágina |

**Semântica:** no ArchiCAD, `Sill` é o peitoril **externo** (a pedra/soleira que joga água para fora) e `Board` é a **tábua interna** (o “peitoril” de dentro). A tradução PT-BR chama Board de “Peitoril Interno” ou “Bordo”. [DOC AC28/BRA 151-24/25] Isso é o inverso de alguns usos brasileiros; no nosso modelo, convém separar `sillExterno` e `boardInterno` para não herdar a ambiguidade.

### 9.3 Threshold (soleira de porta)

**Página:** Threshold. [DOC AC28 151-23]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Threshold Type** | Tipo de soleira | pop-up | Threshold |
| **Threshold Thickness** | Espessura | medida | Threshold |
| **Nosing / side overhangs** | Transpasse frontal e lateral (tipos “Extended”) | medidas | Threshold |

Só aparece em portas (e porta-balcão quando o objeto oferece). A `Sill` é de janela; `Threshold` é de porta. [DOC AC28 151-23/24]

### 9.4 Resumo semântico

| Termo nosso | Peça no ArchiCAD | Onde |
|---|---|---|
| Peitoril externo | `Sill` | Sill Settings |
| Peitoril interno / tábua | `Board` | Board Settings |
| Soleira de porta | `Threshold` | Threshold Settings |
| Pingadeira | `Nosing` + `Angle` do Sill | Sill Settings (sem peça separada) |
| Soleira saliente | `Sill` com nosing/width; ou `Threshold` estendido, em porta | Sill/Threshold |

---

## 10. Wall Inset (recorte abaixo da janela)

**Página:** Wall Inset (só janela). [DOC AC28 151-18; AC24 141-20]

Serve para criar um nicho/recorte abaixo da janela, por exemplo para radiador.

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Wall Inset Size** | Modo de dimensionamento | **Automatic** / **Symmetric** / **Asymmetric** | Wall Inset |
| **Automatic** | Largura do recorte = largura da janela | — | Wall Inset |
| **Symmetric** | Largura e altura fixas, centralizadas na janela | medidas | Wall Inset |
| **Asymmetric** | Transpasses diferentes à direita e à esquerda; altura única | medidas L/R + altura | Wall Inset |
| **Bottom elevation** | Base do recorte; 0 = até o piso | medida | Wall Inset |
| **Depth** | Profundidade do recorte | medida | Wall Inset |
| **Show Hidden Parapet on 2D** | Mostra a linha de parapeito em 2D mesmo quando escondida pela parede/janela | on/off | Wall Inset |

**Lógica:** o Wall Inset é um **segundo recorte** na parede, abaixo do vão principal. Ele não muda a Nominal Size da janela; é geometria de parede. O `Hidden Parapet` é só representação 2D. [DOC AC28 151-18]

---

## 11. Masonry Arch (arco de alvenaria)

**Página:** Masonry Arch. [DOC AC28 151-19; AC18 74]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Masonry Arch** | Liga o arco | on/off | Masonry Arch |
| **Style** | Estilo do arco | lista (ex.: Jack, arco pleno etc.) | Masonry Arch |
| **Rise** | Flecha do arco | medida | Masonry Arch |
| **Skewback angle** | Ângulo de arranque (estilos “Jack”) | graus | Masonry Arch |
| **Type** | Material do arco | **Stucco** / **Brick** | Masonry Arch |
| **Brick / Mortar thickness** | Dimensões dos tijolos e juntas (se Brick) | medidas | Masonry Arch |
| **Keystone** | Chave do arco | width / oversize / projection | Masonry Arch |
| **Arch height/depth** | Altura e profundidade do arco | medidas | Masonry Arch |
| **Rear Hold Depth** | Profundidade do vão atrás do arco | medida | Masonry Arch |
| **Arch projection** | Saliência horizontal do arco | medida | Masonry Arch |
| **Arch on Header** | Coloca o arco diretamente sobre a verga | on/off | Masonry Arch |
| **Distance arch–header** | Distância se não estiver sobre a verga | medida | Masonry Arch |
| **Niche below Arch** | Cria nicho sob o arco | on/off | Masonry Arch |
| **Horizontal Overhang L/R** | Transpasse horizontal do arco | medidas | Masonry Arch |

**Atributos:** a subpágina `Model Attributes of Wall Opening` permite superfícies/pens do arco; em parede curva, `Hole Surface’s Split is Curved` divide as superfícies do vão em arco. [DOC AC28 151-21]

**Custo:** a própria ajuda alerta que muitos arcos de tijolo aumentam significativamente o tamanho do modelo. [DOC AC28 151-19]

---

## 12. Sunshade (brise/toldo)

**Página:** Sunshade. [DOC AC28 151-27; AC18 73]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Sunshade** | Liga o brise | on/off | Sunshade |
| **Type** | Tipo de brise | pop-up | Sunshade |
| **Open in 3D** | Mostra as folhas móveis abertas no 3D | on/off | Sunshade |
| **3D Opening (Angle)** | Ângulo de abertura no 3D | graus | Sunshade |
| **2D Symbol** | Mostra o símbolo do brise em 2D | on/off; no AC18 não aparece em escalas < 1:100 | Sunshade |
| **Extra Frame** | Mostra o quadro do brise ao lado da janela no 3D | on/off | Sunshade |
| **Shutter Height** | Altura da folha | medida / **Automatic Shutter Height** | Sunshade |
| **Attributes** | Fill, material, pen | atributos | subpágina |

**Restrição:** não está disponível se a janela tiver **luz lateral elevada** (“raised sidelight”). [DOC AC28 151-27]

**Não confundir:** o Sunshade é acessório da janela (persiana/brise). O sombreamento solar do edifício (Solar Study, Sun) é outro assunto. [INFERIDO]

---

## 13. Equipamentos, ganging, espaço mínimo e puxadores

### 13.1 Fixtures and Fittings

**Página:** Fixtures and Fittings. [DOC AC28 151-22]

| Campo | O que faz | Valores/opções | Onde |
|---|---|---|---|
| **Casing Outside / Inside** | Liga alizares | on/off | Fixtures |
| **Ganging** | Alinha aberturas vizinhas na horizontal/vertical | on/off por lado | Fixtures |
| **Threshold / Sill / Board / Sunshade** | Liga e escolhe o acessório | on/off + pop-up | Fixtures |
| **Custom Corner** | Adiciona canto personalizado à janela | Right / Left | Fixtures |
| **Handles** | Puxadores (porta; em janela, conforme objeto) | on/off no MVO | Fixtures / MVO |

**Ganging:** é preciso marcar nos **dois** elementos vizinhos; as linhas de encontro (casing, sill, threshold) desaparecem e o conjunto parece uma peça única. Algumas opções ficam cinzas quando o ganging está ativo. [DOC AC28 151-22]

### 13.2 Minimal Space

**Página:** Minimal Space. [DOC AC28 151-30]

Define folgas mínimas de circulação/abertura ao lado da porta (e, conforme o objeto, da janela). A exibição em planta é controlada por Model View Options > Detail Level of Door and Window Symbols > **Minimal Space of Doors**, com pen, tipo de linha e fill. [DOC AC28 151-30; 140-40]

### 13.3 Puxadores e acessórios

- `Accessories in 3D` no MVO liga/desliga puxadores de porta e janela. [DOC AC28 140-40]
- Em portas, a página Handle and Kick Board define puxador por folha, `Uniform Handles`, altura, distância da borda e chapa de proteção (kick board). Em janelas, o puxador depende do objeto. [DOC AC28 151-8]
- O `Minimal Space` de objetos é um parâmetro separado; não confundir com a folga da janela. [DOC AC28 150-11]
