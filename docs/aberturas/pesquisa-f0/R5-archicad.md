# R5 · ArchiCAD: esquadrias compostas (bandeiras), perfis, alizar e vão

Complementa R1-R4 (docs/aberturas/archicad/01-04). Marcas: CONFIRMADO (ajuda oficial lida agora) / PROVÁVEL / NÃO CONFIRMADO. Cerca de 12 buscas/leituras.

## Resumo para decisão

1. Batente em porta com bandeira/luz lateral (objeto de biblioteca): o ArchiCAD tem UM objeto Door (Wall) com UM conjunto de parâmetros de batente. Folha, luz lateral e bandeira são componentes da página "Shape" do mesmo objeto. CONFIRMADO que a Shape "arranja folha, luz(es) lateral(is) e bandeira"; PROVÁVEL (fórum, admin Graphisoft) que o batente em volta de folha+luz+bandeira é gerado como uma geometria só.
2. Entre a porta e a bandeira existe um travessão/divisor interno ao objeto (superfície "Grid/Mullion" própria), não um segundo batente. Largura única "Frame Width" para vertical e horizontal em alguns objetos (fórum): PROVÁVEL. Não há batente duplicado entre módulos.
3. Curtain Wall (CW) é outro modelo: um elemento único com Frames (classes Boundary/Mullion/Transom), Panels e Junctions. O frame pertence à grade (fica preso à gridline), não ao painel. Painel de porta/janela é um objeto GDL inserido no painel; frames entre painéis são separados (CONFIRMADO). Entre porta e bandeira, no CW, há 1 frame (o transom) e o batente da própria porta é o do objeto: PROVÁVEL (duplicação possível).
4. Perfil: não existe "biblioteca nomeada de perfis" para porta/janela. O perfil é parametrizado (Frame Style 1/2/3, larguras, espessura). Só objetos com parâmetro de seleção de perfil (CW, escada) aceitam Profile Manager; para CW também há Modular Frame com peça de biblioteca desenhada pelo usuário. Porta/janela com perfil complexo: NÃO CONFIRMADO.
5. Alizar (Casing): peça opcional por face (Outside/Inside, ligadas separadamente), exclusiva com Turn Plaster (CONFIRMADO). Na porta e na janela, o alizar é aplicado em volta do vão sobre a face da parede (PROVÁVEL; lados: porta 3, janela 4 é inferência já em R1/R2). Parâmetros exatos (largura, espessura, offset) vêm de imagens: NÃO CONFIRMADO texto oficial.
6. Alizar em esquadria composta: o fórum indica uma única largura/espessura para todo o alizar (não por lado) e problemas com offset; contorna o conjunto porque pertence ao mesmo objeto (PROVÁVEL).
7. Vão e bandeiras: "Wallhole/Unit/Egress/Leaf" não têm texto oficial sobre bandeiras. PROVÁVEL: Unit/Wallhole são o conjunto inteiro (A×B do objeto, que inclui luz lateral e bandeira); Egress/Leaf valem só para a folha (mas ver "não confirmado").
8. Recomendação ao Hestia: (a) um conjunto = um batente externo contínuo + travessões internos como membros do conjunto (não frames duplos); (b) vão = conjunto inteiro; folha e luzes são sub-módulos com cotas derivadas; (c) perfil como parâmetros (estilo bloco/batedor/rebaixo + larguras), com biblioteca de perfis nomeados opcional, sem Profile Manager; (d) alizar por face, ligado ao conjunto, exclusivo com retorno do acabamento (já alinhado ao Hestia); (e) para painel de fachada, tratar como sistema separado (grade+painéis), não misturar.

## Detalhes

### 1. Bandeiras: três abordagens

**A. Door/Window de biblioteca com Shape (sidelight/transom).**
- A página Shape "arranja folha, luz lateral e bandeira" do mesmo objeto. CONFIRMADO: https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-36.htm e https://help.graphisoft.com/AC/27/INT/_AC27_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-3.htm (a página AC27 só diz "configuração de folhas/vidros e suas divisões").
- Direção de abertura da luz lateral/bandeira: Same as Leaf / Opposite to Leaf (CONFIRMADO, AC21 Appendix_Tools-43 e R1).
- Dono do batente: o objeto único. Fórum Graphisoft (AC19): os parâmetros de superfície do frame parecem controlar o frame em volta de folha, bandeira e luz juntos, "provavelmente gerados como uma só geometria"; Grid Surface governa o travessão. PROVÁVEL: https://community.graphisoft.com/t5/Design-forum/Arch-19-Door-How-to-change-Transom-Mullion-material/td-p/235745
- Frames entre porta e bandeira: nenhum batente completo; um divisor/travessão (transom mullion). Fórum AC25: um parâmetro "Frame Width" controla vertical e horizontal; altura da bandeira só pelo hotspot que move a divisão. PROVÁVEL: https://community.graphisoft.com/t5/Libraries-objects/Double-Door-with-2-Sidelights-16-AmendingTransom-Thickness/td-p/113923
- O que separa os módulos: o travessão/mullion com material próprio (Grid Surface). PROVÁVEL.

**B. Curtain Wall com painel de porta/janela.**
- CW é um elemento só, com Frame, Panel, Accessory e Junction. CONFIRMADO: https://help.graphisoft.com/START/27/INT/_AC27_Help/040_ElementsVB/040_ElementsVB-148.htm
- Painéis só se conectam em frames; sem frame, os painéis "fundem" numa superfície contínua. Junction é opcional e pode substituir o frame (frame Invisible + junction no nó). CONFIRMADO: https://help.graphisoft.com/START/27/INT/_AC27_Help/040_ElementsVB/040_ElementsVB-172.htm
- Frames: classes Boundary, Mullion, Transom; mudar a classe muda todos; o frame "fica preso à gridline"; só se apaga frame se os painéis vizinhos são coplanares; prioridade de corte Boundary 15 > Mullion 10 > Transom 5. CONFIRMADO: https://help.graphisoft.com/AC/20/INT/AC20Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-148.htm
- Painel de porta/janela: objeto GDL inserido num painel retangular; fluxo: remover o frame entre dois painéis, mesclar, escolher "Door Type" em Member Type. Parâmetro "Top Direction" (passos de 90 graus). O painel não usa marcador de porta/janela (só rótulo de painel). CONFIRMADO: https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-154.htm
- Dono do frame: a grade (CW), mais o batente do próprio objeto-porta. Logo, entre a porta e a bandeira pode haver o frame do CW (transom) e o batente da porta: potencial frame duplo. PROVÁVEL (dedução).

**C. Objetos de biblioteca "porta com bandeira" prontos**: são o caso A com Shape fixa na variante (ex.: Arch Double Door com sidelight/transom, R1 §785). Não há lista completa de variantes: NÃO CONFIRMADO.

### 2. Perfis, Frame Style e vidro
- Frame Style da porta: 3 estilos (1 bloco; 2 e 3 com batedor/"door stop" e com folha rebaixada no batente); duplo sentido força bloco; largura uniforme ou por lado; "Frame Thickness = Wall Thickness". CONFIRMADO: https://help.graphisoft.com/AC/27/INT/_AC27_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-5.htm
- O usuário escolhe o perfil por parâmetros (estilo + larguras/espessuras), não por nome de catálogo. PROVÁVEL (nenhuma lista de perfis nomeados na ajuda).
- Profile Manager: edita/gerencia Complex Profiles (seção extrudada). Perfis para Library Parts só em objetos GDL com opção de seleção de perfil, "como CW e escada"; portas e janelas não são citadas. CONFIRMADO: https://help.graphisoft.com/AC/29/INT/_AC29_Help/040_ElementsVB/040_ElementsVB-55.htm e https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-58.htm. Conclusão PROVÁVEL: perfil custom de janela exige objeto próprio.
- Frame de CW: tipos Invisible, Generic (retangular, cap visível), Butt-Glazed, Modular (peça custom). Frames internos usam seção retangular simplificada ou frames GDL parametrizados industriais. CONFIRMADO (link AC20 acima).
- Perfil custom de CW: desenhar com elementos de modelagem, "Save Selection as > Curtain Wall Frame" (biblioteca embutida), depois Mullion/Transom = Modular Frame e escolher em Custom Frame/Custom Cap. CONFIRMADO: https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-297.htm
- Vidro: espessura/offset/Sash vs Frame: sem texto oficial novo (ver R2). Painéis de CW têm classes Main e Distinct com tipo, superfície e largura próprios (CONFIRMADO, ...-153.htm); espessura/offset do painel não estão nessa página.

### 3. Casing/Trim
- Casing Outside/Inside: duas caixas independentes; ligar abre os parâmetros; não coexiste com Turn Plaster. CONFIRMADO (AC28 151-26): https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-26.htm
- Largura/espessura/offset/overhang/posição relativa ao reboco/bandeiras: a página não lista (só imagens). NÃO CONFIRMADO. Fórum (AC12, ainda útil): offset do alizar externo move lateral e topo juntos; Graphisoft diz que o alizar inteiro deve ter uma espessura e uma largura (não por lado); só se posiciona onde há linhas pré-definidas. PROVÁVEL: https://community.graphisoft.com/t5/Libraries-objects/Window-Casing-Placement/m-p/259539 (acesso direto retornou 403; resumo via busca).
- Lados (porta 3, janela 4) e contorno de bandeiras: PROVÁVEL, mas sem fonte direta.

### 4. Nominal sizes com bandeiras
- Nenhuma página oficial lida diz se Wallhole/Unit incluem luz lateral e bandeira. A página AC27 de Shape/dimensões não detalha. A dedução (A×B = conjunto inteiro, pois o objeto contém tudo e o furo é A×B, R3 §3.1) é PROVÁVEL.

## O que NÃO foi possível confirmar
- Parâmetros numéricos do Casing (largura, espessura, offset, posição frente à face/reboco) e se contorna bandeiras.
- Número de frames entre porta e bandeira em objetos reais, e se o batente aparece duplicado ao embutir porta em painel de CW.
- Se Egress/Leaf se referem só à folha quando há luz lateral/bandeira.
- Seleção de Complex Profile em portas/janelas da biblioteca INT; lista de perfis/estilos de caixilho nomeados.
- Espessura/offset do vidro e Sash vs Frame (nenhuma página nova lida).
- Página "Casing" por lado de porta (3) vs janela (4).
