# ARCHICAD (Graphisoft): criação e edição de escadas (Stair Tool)

Objetivo: referência para o Hestia reproduzir o comportamento do ARCHICAD. Nenhuma alteração foi feita em /home/user/Hestia.

## 0. Status da pesquisa e limitações (leia primeiro)

- **Os sites oficiais não puderam ser abertos nesta sessão.** O proxy de egresso responde 403 ao CONNECT para help.graphisoft.com, helpcenter.graphisoft.com, community.graphisoft.com, gdl.graphisoft.com e archicadapi.graphisoft.com (registrado em `http://127.0.0.1:45675/__agentproxy/status`, campo `recentRelayFailures`). O WebFetch também falhou (ENOTFOUND). Conforme `/root/.ccr/README.md`, 403 é negação de política: não foi feito contorno.
- Por isso, o conteúdo abaixo vem dos **trechos (snippets) retornados pelo WebSearch**, restritos a help.graphisoft.com e helpcenter.graphisoft.com quando possível. Nenhum trecho foi lido no texto completo.
- Os trechos vêm de páginas de versões diferentes (AC18 a AC29). Nomes de campos e menus variam entre versões. Trechos de AC18 (StairMaker) são de um sistema anterior ao Stair Tool atual.
- Legenda:
  - **[S]** trecho de página oficial Graphisoft obtido pela busca; não validado no texto completo.
  - **[C]** fórum ou artigo da comunidade (não é documentação oficial).
  - **[?]** não encontrado em fonte oficial.

### Fontes oficiais consultadas (somente por trecho)

- Stair Settings: Geometry and Positioning (AC25): https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-196.htm
- Stair Settings: Rules and Standards (AC25): https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-197.htm
- Stair Settings: Geometry and Positioning (AC24): https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-194.htm
- Helpcenter, Stair Settings (versão não informada): https://helpcenter.graphisoft.com/user-guide/137048
- Stair Tool Edit Mode (AC26): https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-183.htm
- Stair Input (AC26 e AC28): https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-178.htm ; https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-179.htm
- Stair Segment Type (AC26): https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-182.htm
- Stair Turning Type (AC24): https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-188.htm
- Winder Types for Equal-Going Winders (AC24): https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-189.htm
- Flight and Landing Structures (AC28; AC29): https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-191.htm ; https://help.graphisoft.com/AC/29/INT/_AC29_Help/040_ElementsVB/040_ElementsVB-191.htm
- Tread and Riser Finishes (AC28): https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-190.htm
- Toplinked Stairs and Changed Story Height (AC28): https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-189.htm
- Floor Plan/Reflected Ceiling Plan Display (Stair Settings) (AC28): https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-202.htm
- Stair Endings and Connections (AC26): https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-198.htm
- Custom Stair Based on Manually Drawn Elements (AC20): https://help.graphisoft.com/AC/20/INT/AC20Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-250.htm
- Stair Improvements (AC25, novidades): https://help.graphisoft.com/AC/25/INT/_AC25_Help/005_NewFeatures/005_NewFeatures-5.htm
- Placing Holes in Slabs (AC20): https://help.graphisoft.com/AC/20/INT/AC20Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-106.htm
- StairMaker Settings / Stair Tool Settings (AC18): https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-77.htm ; https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-76.htm
- Geometry and Flight Settings (StairMaker, AC18): https://help.graphisoft.com/AC/18/INT/AC18Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-246.htm
- Tread Settings (StairMaker, AC18): https://help.graphisoft.com/AC/18/INT/AC18Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-248.htm
- Built-in IFC Element Type Mapping (AC22): https://help.graphisoft.com/AC/22/INT/_AC22_Help/115_IFC/115_IFC-50.htm
- IFC Element Types (AC19): https://help.graphisoft.com/AC/19/INT/AC19Help/07_Interoperability/07_Interoperability-76.htm

### Fontes não oficiais usadas (comunidade)

- Artigo da equipe Graphisoft no fórum, "Stair Tool Basics": https://community.graphisoft.com/t5/Modeling/Stair-Tool-Basics-How-to-place-stairs-using-the-new-Stair-Tool/ta-p/303358 [C]
- Fórum sobre escadas curvas: https://community.graphisoft.com/t5/Modeling/Curving-stairs-to-a-curved-wall/td-p/12745 [C]
- Fórum sobre riser calculado: https://community.graphisoft.com/t5/Modeling/Stair-riser-and-going-distances/m-p/606093 [C]

---

## 1. Fluxo do usuário: métodos de geometria e traçado

**Nomes oficiais.** Os nomes pedidos ("Straight Segment", "Polygonal Segment", "Spiral", "Curved") não aparecem como métodos de entrada no Stair Tool atual. Não encontrei esses rótulos em fonte oficial. [?]

**Modelo de entrada atual (Stair Tool).**
- A escada é desenhada como **Baseline** (linha de base), que é uma polilinha. A baseline também define a linha de caminhada. [C] (artigo da equipe, ver seção 0) e [S] (Stair Input, AC26/AC28).
- Cada clique cria um segmento. Cada segmento pode ser **Flight** (lance), **Landing** (patamar) ou um dos dois tipos de **Winder**. O tipo é escolhido durante a entrada ou depois, pela paleta de pet ("Select Segment Type"). [S] Stair Segment Type (AC26); [S] Stair Input.
- Uma escada nova começa com um segmento Flight por padrão. [S] Stair Segment Type.
- Se dois segmentos se encontram sem tangência, a junção vira patamar automaticamente. [S] Custom Stair Based on Manually Drawn Elements (AC20).
- Durante a entrada há **feedback gráfico em tempo real** do resultado. Se o caminho não gera escada válida pelas regras de construção, aparece uma janela "Solver" com variações possíveis. [S] Stair Input.

**Turning Type (tipo de virada, valor da escada inteira).**
- Configurado em Stair Settings com as opções Landing ou Winder. Pode ser ajustado em cada virada separadamente depois, pela paleta de pet ("Turning Type Options"). [S] Stair Turning Type (AC24); [S] Stair Input.
- Tipos de winder citados: **Automatic Landing**, **Winder with Equal Goings**, **Winder with Equal Angles**. [S] Stair Turning Type (AC24) e Winder Types for Equal-Going Winders (AC24).
- Divisões de winder (trecho de StairMaker, AC18, sistema anterior): "Optimum Going Width" (largura de piso o mais próxima possível do piso do lance reto), "Maximum Number of Goings" (preenche o máximo permitido) e "Fixed Number of Goings" (número fixo, sobrepõe outras regras). [S] AC18, a confirmar na versão atual.
- Winder radial: as bordas dos pisos do conjunto convergem em um ponto. [S] AC18 (trecho).
- AC25 adicionou opções de simetria de piso para todos os tipos de winder. [S] Stair Improvements (AC25), trecho.

**Escada em L, U e "com patamar".** Um artigo oficial da equipe trata de escada em U com lances iguais. [S] trecho mencionando "U-shape with equal flights" (artigo na Help Center; URL exata [?]).

**Escada em espiral.**
- StairMaker (AC18) tem tipos padrão de espiral e circular. Para espiral com newel, definem-se **ângulo inicial** e **ângulo de varredura**. [S] AC18, trecho da busca "Stair Winder Spiral".
- Equivalente no Stair Tool atual (AC26+): [?]. Não encontrei página oficial que descreva o fluxo de espiral atual.

**Escada curva.**
- Método oficial com este nome: [?].
- Opção ligada à curvatura: no AC25 a medida do comprimento tem dois métodos, **Along Arc** e **Along Chord**. Along Arc mede cada segmento sobre o arco (método de versões anteriores à AC25) e aparece como "Along Arc (Legacy)" na AC25. [S] Geometry and Positioning (AC25).
- Comportamento de escada curva, segundo fórum: só a baseline curva; os espelhos e pisos permanecem perpendiculares à baseline, e a parte frontal (espelho) não é curvada. [C] fórum "Curved Steps" / "Curving stairs to a curved wall".

**Escada com croqui livre (polígono).**
- Comando **Create Stair Using Selection** (Design > Design Extras). Desenha-se o contorno com a ferramenta Fill e a linha de percurso com linhas e arcos conectados. Seleciona-se os dois e executa-se o comando. O StairMaker propõe tipos de escada compatíveis. Se nenhum tipo servir, cria-se uma escada personalizada. Os elementos 2D originais não são apagados. [S] Custom Stair Based on Manually Drawn Elements (AC20); [S] trecho do Stair Tool (AC17 e AC20).
- Ressalva do fórum: a linha de percurso não deve terminar em borda adjacente do polígono de preenchimento. [C]
- Continua existindo na versão atual? [?]

**Linha de caminhada (Walking Line).**
- Posição padrão: centro da escada, deslocada meia largura. Em winders com pisos iguais, pode-se deslocar no trecho de giro. [S] trecho de Stair Tool Edit Mode e Stair Tool Settings (AC18/AC26).
- Símbolo da linha de caminhada editável na visão Symbol do modo Edit. [S] Stair Tool Edit Mode (AC26).

**Largura.** Campo "Stair width" em Geometry and Positioning. [S] AC25 040-196.

**Início e fim (Home Story / Top).**
- A base da escada (onde fica a linha de referência) é ligada fisicamente ao **Home Story**. Pode-se definir um offset da base em relação a esse andar. [S] Stair Settings: Geometry and Positioning (AC24, 040-194).
- O topo pode ser ligado a um andar (**Stair Toplink**), com offset positivo, negativo ou zero. A altura da escada se ajusta. [S] AC24 040-194; [S] Toplinked Stairs (AC28, 040-189).
- A posição da baseline em relação à linha de entrada (esquerda, direita ou centro) é configurável. [S] AC24 040-194 e AC26 Stair Input.
- Escada top-linked: a altura não é editada diretamente, e sim pelos offsets. [S] AC24 040-194.

---

## 2. Painel de configurações (Stair Settings)

Páginas oficiais: "Geometry and Positioning" e "Rules and Standards" (AC25 040-196 e 040-197, ver seção 0). Campos com nomes conforme trechos.

### Geometry and Positioning [S]

- **Stair width** (largura).
- **Number of Risers** (número de espelhos).
- **Riser Height** (altura do espelho): escolha em lista suspensa. Os valores oferecidos dependem das faixas definidas em Rules and Standards e do número de espelhos.
- **Going Depth** (profundidade do piso):
  - **Flexible**: o ARCHICAD define o piso automaticamente pela geometria de entrada, dentro da faixa de Rules and Standards.
  - **Fixed**: você digita o valor, dentro da faixa.
- **Calculate Length** (método de cálculo de comprimento): **Along Arc** ou **Along Chord** (AC25+; Along Arc aparece como "Legacy" na AC25).
- Com **Along Chord**, aparecem opções extras:
  - **Lock Baseline**: desligado, os lances podem esticar ou encolher durante a colocação ou edição, e os pontos clicados podem se mover. Com Along Arc (legado), Lock Baseline não está disponível.
  - **Distribute Extra Landing Length**: onde vai o comprimento extra de patamar automático (início, fim ou ambos igualmente). [S] Stair Improvements (AC25) e AC25 040-196.

### Rules and Standards [S]

- Define faixas (min/max) para **Going** (piso), **Riser** (espelho) e para a combinação **Going + Riser** (grupo de regras de tread e riser).
- As faixas são parte do template do ARCHICAD, então podem ser reutilizadas entre projetos. [S] AC25 040-197.
- Verificação de regra: o ARCHICAD verifica a relação **(2 × Riser) + Going** durante a edição; parâmetros bloqueados são pulados. [S] trecho de "Geometry and Flight Settings" (AC18, versão antiga).
- Fórmula de passo (Blondel) como campo nomeado: [?]. A regra 2R+G aparece como verificação, não como campo com nome oficial "Stair Formula" nas fontes lidas.
- Parâmetros de GDL (objeto da escada) incluem limites de espelho, piso, 2R+G, relação R/G, R+G e inclinação. [S] gdl.graphisoft.com "Stair Parameters" (trecho).

### Como o programa calcula a altura do espelho [C]

- A lista de espelhos é calculada dividindo a altura total pelo número possível de degraus. [C] Fórum "Stair riser".
- Para ter um espelho específico, o usuário ajusta offsets de base e topo, de modo que a altura total seja múltipla do espelho desejado, e restringe min/max. [C]
- Não há "Optimal Riser" oficial encontrado. [?]. "Optimum" aparece só nas divisões de winder (ver seção 1).

### Travar valores e recalcular [S/?]

- Ao mudar comprimento ou altura: a altura é definida pelos offsets de Home Story e Top. Escada top-linked não edita altura diretamente. [S] AC24 040-194.
- Com piso Flexible, o piso é recalculado pela geometria dentro da faixa. [S] AC25 040-196.
- Lock Baseline desligado: os lances esticam ou encolhem para acomodar a mudança. [S] AC25 040-196 e Stair Tool Edit Mode.
- Mudança de altura do andar superior:
  - Pequena: o número de espelhos se mantém; os espelhos crescem dentro das regras. [S] AC28 040-189.
  - Grande: a escada fica inválida até ajustar o offset original e, se necessário, o número de espelhos. [S] AC28 040-189.
- Travar número de espelhos ou altura como campo separado: [?] (não encontrado como opção nomeada).
- Número de degraus (treads) em relação a espelhos com patamar: [?].

### Flights, Landings e Winders no painel

- Turning Type (Landing ou Winder) e tipo de winder: ver seção 1.
- Structure: tipo de estrutura para lances e patamares. Recomenda-se o mesmo tipo para ambos. [S] Flight and Landing Structures (AC28/AC29, 040-191).

---

## 3. Stair Structure

### Tipos de estrutura [S]

- Quatro tipos desde o ARCHICAD 21: **Monolithic**, **Beam**, **Cantilevered**, **Stringer**. Cada um pode ser personalizado em tamanho, material, perfil e aparência 2D. [S] Flight and Landing Structures (AC28/AC29); [S] "INTUITIVENESS" (AC21, trecho).
- Lances e patamares podem ter estruturas diferentes; a ajuda recomenda usar o mesmo tipo. [S] AC28/AC29 040-191.

### Stringers [S]

- Opcionalmente, **Stringers** à esquerda e/ou à direita de cada lance ou patamar.
- Stringers podem ser adicionados a todos os tipos de estrutura, exceto Monolithic. [S] Flight and Landing Structures.
- Stringers Flight and Landing Structure: página própria (AC24 040-203). [S] trecho de título.

### Monolithic x Stringer no 2D [S]

- Estrutura Monolithic não tem atributos 2D próprios.
- Atributos 2D separados para Cantilever, Beam e Stringer, com atributos diferentes para partes visíveis e ocultas. [S] trecho de display/estrutura.

### Tread e Riser (degrau e espelho) [S]

- Tread e Riser são componentes separados.
- Tread Settings: **front nosing** (quina frontal), **side nosing** (quina lateral direita e esquerda), espessura do piso (tread) e espessura do espelho (riser). [S] Tread Settings (AC18, trecho).
- Material por face: topo, frente e espelho. [S] Tread and Riser Finishes (AC28, 040-190).
- Tread customizado (polígono): o nosing pode não acompanhar a nova forma. Solução: definir o segmento como comportamento **Front** em Custom Tread Polygon Settings. [S] trecho da busca de estrutura (AC18).

### Laje da escada e espessuras [S/?]

- No StairMaker (AC18), o diálogo pede: espessura de laje (para escadas maciças e com stringers), espessura de carcaça (carriage) para escada com carcaças e offset do suporte lateral (side holder) para escada com stringers. As espessuras superior e inferior da estrutura e de subpiso+acabamento são definidas separadamente, e o StairMaker ajusta os parâmetros da escada. [S] AC18 StairMaker Settings (trecho).
- Equivalente nas configurações atuais do Stair Tool: [?].
- Escada como laje de patamar (landing slab) e sua modelagem: [?].

### Corrimão (Handrail / Railing on Stair)

- Railing Settings existe no AC21 (página "Railing Settings: Geometry and Symbol Display"). [S] título de página.
- Posts de corrimão no StairMaker (AC18): espaçamento e encaixe nos cantos dos segmentos. [S] AC18 StairMaker Settings (trecho).
- Como um corrimão é associado a uma escada no Stair Tool atual ("Railing on Stair"): [?].

### Cut Plane (linha de corte / Breakline)

- Cada símbolo de escada na planta tem uma **Breakline** que funciona como plano de corte. Sua altura é definida em **Breakline Position Height**. As partes abaixo e acima recebem tipos de linha e canetas diferentes. [S] AC18 e AC28 (Floor Plan/Reflected Ceiling Plan Display, 040-202).

---

## 4. Edição na planta

- **Modo Edit (Edit Mode)**: permite alterar treads, risers e estruturas da escada selecionada. Não permite adicionar novos elementos, exceto estendendo a escada com **Continue Stair**. [S] Stair Tool Edit Mode (AC26, 040-183).
- Acesso: botão Edit (painel da escada) ou menu Design. [S] trecho.
- **Baseline (linha de base)**: pode ser editada em qualquer janela, independentemente do modo Edit. Editar a baseline altera a geometria inteira, incluindo a linha de caminhada. [S] trecho (Stair Tool Edit Mode/Settings).
- **Boundary (contorno)**: editar o contorno altera só a forma externa; linha de caminhada e baseline não mudam. [S] trecho.
- Para selecionar a borda e não a baseline, use Tab e o realce de pré-seleção. [S] trecho.
- Desbloquear a baseline permite que os lances esticam ou encolham. [S] AC25 040-196.
- Patamar automático com comprimento mínimo: o comprimento extra vai para início, fim ou ambos os lados. [S] AC25 040-196.
- Trocar o tipo de segmento depois de colocado: pela paleta de pet, "Select Segment Type". [S] Stair Segment Type (AC26).
- Virada (turning) de cada segmento: pela paleta de pet, "Turning Type Options". [S] Stair Turning Type.
- Winders: o tipo de virada é aplicado em cada virada entre dois segmentos de lance. [S] trecho.

Não confirmado:
- "Arrastar para mudar curvatura" (drag para curvar): [?]. Só há evidência de edição de baseline por pontos e de contorno.
- "Add/Delete Flight", "Add/Delete Landing", "Insert/Delete Winder" como comandos nomeados: [?]. Só há Continue Stair como forma de estender.
- Conversão entre lance reto e lance curvo sem recriar a escada: [?].
- Contorno de patamar (landing boundary) como objeto separado: [?]. O trecho oficial trata do contorno da escada como um todo.

---

## 5. Representação 2D e 3D

### 2D (planta) [S]

- Display por pavimento. Pavimentos que a escada cruza são "relevant stories". Para pavimentos acima do Home Story, pode-se alternar o breakline e mostrar ou ocultar os pisos. [S] AC28 040-202; AC18 Stair Tool Settings.
- Breakline com altura configurável; partes acima e abaixo com tipos de linha e canetas próprias. [S] AC28 040-202.
- Atributos 2D diferentes para estrutura Cantilever, Beam e Stringer, visível e oculto. [S] trecho.
- Seta de caminhada (walking line arrow), "Up/Down" (texto) e numeração de degraus: [?]. Não encontrei descrição oficial desses símbolos.

### 3D [S]

- A geometria 3D segue treads, risers e estruturas. Nosing e espessuras definem o volume. [S] Tread Settings.

### Níveis de detalhe [?]

- Não encontrei fonte oficial para níveis de detalhe de escada.

---

## 6. Relação com lajes e paredes

### Ligação a andares [S]

- Home Story (base) e Stair Toplink (topo): a escada em dois andares é uma escada de altura única, com topo ligado ao andar superior e offset. [S] AC24 040-194 e AC28 040-189.
- Mudança de altura do andar: ver seção 2 (pequena mantém espelhos; grande invalida).

### Furo na laje [S, ARCHICAD 20]

- Método oficial para furo em laje: selecione a laje, ative a ferramenta Slab e desenhe um novo contorno dentro dos limites da laje. Esse contorno é interpretado como furo. Usado para escadas ou átrios. [S] Placing Holes in Slabs (AC20).
- Comando de "Create Stair Hole" ou furo automático gerado pela escada: [?]. Não encontrado em fonte oficial.
- Como o ARCHICAD recorta a laje automaticamente: [?].
- Relação com paredes e recorte de paredes pela escada: [?].

---

## 7. IFC

Fontes: IFC Element Types (AC19) e Built-in IFC Element Type Mapping (AC22). [S]

- **Stair** → **IfcStair** (mapeamento padrão por tipo de elemento).
- **Riser** → **IfcMember**; a estrutura e os degraus também são exportados como IfcMember (trecho da tabela). [S]
- **Stair Flight** → **IfcStairFlight**, com **IfcStairFlightType** como tipo (AC19; tabela alemã cita IfcStairFlightType). [S]
- Versões antigas citam o Stair Maker como ramp mapeado para IfcStair. [S]
- Aviso: uma página antiga indica que IfcStair não está disponível no esquema IFC 2x3. Confirme o esquema usado na exportação. [S]
- Escada como IfcStairFlight com IfcStair pai: relação de agregação entre os dois não encontrada. [?]
- **Patamar (landing) como IfcSlab: não confirmado** [?]. O trecho oficial menciona IfcSlab apenas quando um objeto não padrão (por exemplo um teto feito com a ferramenta Slab) é exportado sem classificação.
- Correção oficial: usar classificação (Element Classification) no mapeamento de tipo. [S]

---

## Resumo para implementação

1. Entrada: a escada é uma polilinha (baseline). Cada clique cria um segmento; o tipo do segmento (Flight, Landing, Winder) é definido na entrada ou depois. [S]
2. Junção não tangencial entre dois segmentos cria patamar automaticamente. [S]
3. Virada global da escada: Landing ou Winder, com tipos Automatic Landing, Winder with Equal Goings e Winder with Equal Angles. [S]
4. Feedback gráfico em tempo real; caminho inválido mostra variantes válidas (janela Solver). [S]
5. Geometria: largura, número de espelhos, altura do espelho (lista restrita por faixa e número de espelhos) e profundidade do piso. [S]
6. Piso em modo Flexible é calculado pela geometria; em modo Fixed é digitado dentro da faixa. [S]
7. Faixas min/max (espelho, piso, combinação piso+espelho) ficam em Rules and Standards e são salvas no template. [S]
8. Verificação 2R+G = (2 × espelho) + piso durante a edição; parâmetros travados são ignorados. [S, versão antiga]
9. Método de comprimento: Along Arc (legado) ou Along Chord (AC25+). Along Chord habilita Lock Baseline e distribuição do patamar extra (início, fim ou ambos). [S]
10. Lock Baseline desligado: os lances esticam ou encolhem, e os pontos clicados podem se mover. [S]
11. Altura: base ligada ao Home Story com offset; topo opcionalmente ligado a um andar (Stair Toplink) com offset; altura resultante do conjunto. [S]
12. Mudança pequena de altura do andar mantém o número de espelhos e aumenta os espelhos dentro da regra; mudança grande torna a escada inválida. [S]
13. Modo Edit altera treads, risers e estruturas; não cria elementos novos, exceto Continue Stair. [S]
14. Editar a baseline recalcula toda a geometria, incluindo a linha de caminhada; editar o contorno (boundary) altera só a forma externa. [S]
15. Quatro tipos de estrutura: Monolithic, Beam, Cantilevered e Stringer. Stringers laterais são possíveis em todos, exceto Monolithic. [S]
16. Tread e riser têm nosing frontal e lateral e espessuras separadas; materiais por face (topo, frente, espelho). [S]
17. Corte na planta: Breakline com altura configurável; partes acima e abaixo com tipos de linha e canetas diferentes; decisão por pavimento. [S]
18. Winders: divisão por largura ótima, número máximo de pisos ou número fixo; winder radial com arestas convergindo em um ponto. [S]
19. Espiral: no StairMaker (AC18), ângulo inicial e ângulo de varredura. Fluxo do Stair Tool atual: [?].
20. Curva: a baseline pode ser curva, com espelhos e pisos perpendiculares à baseline; a parte frontal não é curvada. Esta regra é de fórum [C]; o método oficial não foi encontrado. [?]
21. Forma livre: Create Stair Using Selection, com preenchimento (Fill) e linha de percurso conectada; se nenhum tipo servir, cria escada personalizada. [S]
22. Furo na laje: manual (contorno interno vira furo). Furo automático pela escada: [?].
23. IFC: Stair → IfcStair; Riser e estrutura → IfcMember; Stair Flight → IfcStairFlight com IfcStairFlightType. Patamar como IfcSlab: [?]. [S]

---

## Pendências [?]

1. Confirmar, no texto completo das páginas oficiais, todos os trechos [S]. Requer acesso a help.graphisoft.com, que está bloqueado nesta sessão (403 do proxy).
2. Nomes oficiais dos métodos "Straight", "Polygonal", "Spiral" e "Curved" no Stair Tool atual.
3. Fluxo de espiral no Stair Tool atual (AC26 em diante). Só há StairMaker (AC18).
4. Método oficial para escada curva; "Along Arc" e "Along Chord" tratam só do comprimento.
5. Campo "Stair Formula" ou fórmula de Blondel nomeada no painel.
6. "Optimal riser", travar número de espelhos ou altura como opções nomeadas.
7. Número de degraus (treads) com patamares.
8. Espessura de laje e carcaça no Stair Tool atual (equivalente ao StairMaker).
9. Corrimão associado à escada ("Railing on Stair"): fluxo e propriedades.
10. Arrastar para mudar curvatura; Add/Delete Flight, Add/Delete Landing, Insert/Delete Winder como comandos; conversão reto/curvo.
11. Contorno de patamar (landing boundary) como objeto separado.
12. Seta de caminhada, "Up/Down" e numeração de degraus na planta.
13. Níveis de detalhe da escada.
14. Furo automático na laje pela escada ("Create Stair Hole") e recorte de paredes.
15. Patamar exportado como IfcSlab no IFC.
16. Relação entre IfcStair e IfcStairFlight na exportação.
17. Se "Create Stair Using Selection" ainda existe na versão atual.
18. Trechos de AC18 (StairMaker) podem não valer para o Stair Tool atual. Verificar cada um na versão alvo.
