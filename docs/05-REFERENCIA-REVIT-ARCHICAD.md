# 05 · Referência: como Revit e ArchiCAD realmente funcionam

Regra deste projeto: **nenhuma ferramenta é implementada sem uma ficha de comportamento** neste documento,
com fonte. O que não tem fonte fica marcado `[?]` e não vira código até ser verificado.

Legenda de confiança:
- `[DOC]` documentação oficial (Autodesk / Graphisoft)
- `[COM]` tutorial, blog ou fórum (útil, mas confirmar)
- `[?]` memória, ainda não verificado

> Origem desta versão: pesquisa na web em 19/10/2026. As páginas de ajuda citadas são de versões variadas
> (2014–2026). Antes de implementar cada ferramenta, reconfirmar na versão atual e, se possível, **testar no próprio
> programa** e guardar o resultado como teste dourado (ver §8).

---

## 1. Parede composta: camadas, função e prioridade

**Revit**
- Cada camada tem uma função. Os números entre colchetes na lista de funções do Edit Assembly são **prioridades de
  limpeza de junção**. Quando duas camadas coincidentes têm o mesmo número e o mesmo material, elas se fundem; quando
  uma camada de prioridade maior cruza uma de menor, ela corta e fica uma linha divisória.
  [Autodesk – wall functions](https://www.autodesk.com/learn/ondemand/tutorial/wall-functions) `[DOC]`
- Estrutura tem a prioridade mais alta (1) e acabamento 2 a mais baixa; ajusta-se o número por parede para o acabamento
  se fundir num T. [Arkance – Party Wall Clean Up](https://ukcommunity.arkance.world/hc/en-us/articles/21565277301138-Revit-Architecture-2015-Party-Wall-Clean-Up) `[COM]`
- A **ordem da junção** define qual elemento continua a face; existe "alternar ordem de junção" e "não permitir junção"
  na extremidade. [Novedge](https://novedge.com/blogs/design-news/revit-tip-control-revit-joins-and-cuts-for-clean-geometry) `[COM]`
- Camadas dentro e fora do **limite do núcleo** (Core Boundary); é possível ter camadas fora do núcleo.
  [Edit Layers in a Compound Structure](https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Model/files/GUID-B6EEDFEF-641E-409A-8C42-AB5A66BDC554.htm) `[DOC]`
- Limitação: paredes anexadas a outro elemento (ex.: telhado) não aceitam extensão de camada.
  [Fórum Autodesk](https://forums.autodesk.com/t5/revit-architecture-forum/wall-join-with-roof-problem/m-p/10029949) `[COM]`

**ArchiCAD**
- A prioridade **não está na função da camada**, está no **Material de Construção** (Building Material) de cada pele:
  interseções são resolvidas pela "prioridade de interseção" dos materiais, em todas as vistas.
  [Graphisoft – Model Element Connections](https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-268.htm) `[DOC]`
- A partir da v17 a conexão automática vale para as **peles** de paredes, telhados e lajes compostas. Elementos precisam
  **se interceptar**, não apenas se tocar. [Architosh](https://architosh.com/2013/06/product-in-depth-looking-at-graphisoft-archicad-17/2) `[COM]`
- Telhados, cascas e morphs **não** conectam automaticamente; exige o comando *Connect/Merge Elements*.
  [Comunidade Graphisoft](https://community.graphisoft.com/t5/Design-forum/In-AC17-can-walls-clean-up-to-roofs-as-well-as-to-slabs/td-p/165878) `[COM]`
- Crítica conhecida: prioridade por material obriga a criar dois materiais quando a mesma alvenaria deve cortar
  diferente por dentro e por fora. [Comunidade Graphisoft](https://community.graphisoft.com/t5/Modeling/Materials-composites-intersection-priorities/td-p/251355) `[COM]`

**Decisão para o Hestia (aberta, fechar na Fase 1):**
prioridade por **função da camada** (modelo Revit, mais simples de explicar), com **substituição opcional por camada**
para resolver o caso que o ArchiCAD obriga a duplicar material. Ficha precisa de teste dourado com T e L de 3 tipos.

## 2. Camada que "envolve" no vão (wrapping)

**Revit** `[DOC]` [About Layer Wrapping](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-69B6DC75-56A9-4F35-BE24-80048360E2BB.htm)
- Ligado **por camada** (opção *Wraps*) **e** nas propriedades de tipo da parede (*Wrapping at Ends* / *Wrapping at Inserts*).
- Porta e janela têm a propriedade de tipo **Wall Closure**, que **substitui** a configuração da parede.
- A posição do retorno vem de planos de referência nomeados "Wall Closure" dentro da família da abertura.
- Não existe para telhado e piso compostos.

→ Corrige o doc 02: o retorno no vão **não é só da camada**; é parede + tipo da abertura, e a família da abertura
carrega a geometria do fechamento. Piso/laje/telhado **não** têm essa função na v1.

## 3. Linha de localização da parede

**Revit** `[DOC]` [About the Wall Location Line](https://help.autodesk.com/cloudhelp/2019/ENU/Revit-Model/files/GUID-F26DB6DA-A0EC-424D-B656-3BDF47607F4F.htm)
- Seis opções: *Wall Centerline*, *Core Centerline*, *Finish Face: Exterior*, *Finish Face: Interior*,
  *Core Face: Exterior*, *Core Face: Interior*.
- **Mudar a linha de localização de uma parede existente não a move**; só muda a referência dali em diante.
- Em parede simples, eixo da parede e do núcleo coincidem; em composta, geralmente não.

**ArchiCAD** `[ok]` (pesquisa de 19/10/2026, ver §7.1, item 1)
- Parede composta tem **seis** posições de linha de referência: externa, centro, interna, núcleo externo, núcleo centro,
  núcleo interno. Sem núcleo, as posições de núcleo ficam indisponíveis.
  [API Graphisoft](https://archicadapi.graphisoft.com/?p=1354) `[DOC]` · [Graphisoft Help, Wall Reference Line (AC24)](https://help.graphisoft.com/AC/24/INT/_AC24_Help/040_ElementsVB/040_ElementsVB-7.htm) `[DOC]` (busca; página não lida)
- Deslocamento: vale para as posições externa e interna; no centro não há deslocamento. `[COM]`
  [Comunidade Graphisoft](https://community.graphisoft.com/t5/Modeling/Reference-Line-of-a-Composite-Wall/td-p/283348) `[COM]`
- **Lado de referência do composto**: a primeira pele da lista é o lado externo. Desde o ArchiCAD 17 a face externa é um
  conceito separado da linha de referência. `[COM]`
  [Comunidade Graphisoft](https://community.graphisoft.com/t5/Modeling/Composites-which-side-is-quot-exterior-quot-which-is-quot/td-p/257669) `[COM]`
- Ajustar a linha sem mover a parede: comando *Modify Wall Reference Line*. `[COM]`

## 4. Telhado

**Revit – por contorno (footprint)** `[COM]` [Novedge](https://novedge.com/blogs/design-news/revit-tip-modeling-complex-roofs-with-roof-by-footprint-in-revit) · [ajuda](https://help.autodesk.com/cloudhelp/2020/ENU/RevitLT-Model/files/GUID-4EE804D4-CF0B-46C9-AE61-339B78E4EA8D.htm) `[DOC]`
- Cada **linha** do contorno tem a opção *Defines Roof Slope*; só as marcadas geram água. Desmarcar nas empenas.
- **Beiral por linha** (valor padrão vem da barra de opções ao usar "pegar paredes"; ajustável depois).
- *Plate Offset From Base* define a altura em que o telhado encontra a parede quando o beiral muda a cota do beiral.
- *Slope arrows* permitem águas independentes do perímetro (cumeeira assimétrica, calhas internas).

**ArchiCAD** `[DOC]` [Roof Tool Settings](https://help.graphisoft.com/AC/29/INT/_AC29_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-4.htm)
- Dois métodos: **plano único** (linha de pivô + contorno) e **multiplano** (complexo, tesoura de duas águas "gable",
  quatro águas "hip", e versões rotacionadas).
- Beiral definido como **deslocamento do polígono de pivô**, global, com **personalização por plano**
  (aparece o ícone "custom"). Alterar o global pode ou não atualizar os personalizados (opção).

**Decisão para o Hestia:** modelo do Revit (contorno com *defines slope* por lado, beiral por lado, *plate offset*,
*slope arrows* na fase posterior) + a ideia do ArchiCAD de **valor global com exceções por plano** e atalhos
"duas águas" / "quatro águas". A altura do topo da parede preso ao telhado é **derivada**, nunca gravada.

## 5. Vista em planta: intervalo de vista (view range)

**Revit** `[DOC]` [About the View Range](https://help.autodesk.com/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-58711292-AB78-4C8F-BAA1-0855DDB518BF.htm)
- Três planos horizontais: **Topo**, **Plano de corte**, **Base**; mais a **Profundidade de vista** (padrão = base).
- Elementos entre topo e base, não cortados: linha de **projeção**. Cortáveis que atravessam o plano de corte: linha de **corte**.
  Dentro da profundidade de vista: estilo "além".
- **Piso, piso estrutural, escada e rampa** têm intervalo ajustado (estende abaixo da base).
- Parede é cortada conforme sua restrição de topo; sem conexão de topo, pode aparecer como projeção mesmo cruzando o corte.
- Planta de forro usa a mesma ideia com sentido invertido.

→ Confirma o doc 03 §4 e acrescenta: o corte **depende do tipo de elemento** e da restrição de topo.
O mesmo recurso explica por que a vista "some" elementos quando mal configurada — o app deve **avisar** isso.

## 6. Ambiente / zona

**Revit** `[DOC]` [To compute the area of a room](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-9348929C-18CA-40AC-BB64-71D01CC52F2B.htm)
- Área medida, por padrão, até a **face do acabamento** da parede; configurável para eixo, núcleo, eixo do núcleo.
- O contorno muda pelo parâmetro **Room Bounding** de cada elemento ou por **linhas de separação de ambiente**.

**ArchiCAD** `[DOC]` [Creating Zones](https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-147.htm)
- Reconhecimento automático por **Borda interna** ou por **Linha de referência** das paredes.
- Parede inclinada/complexa usa a borda interna mesmo no modo "linha de referência".
- Zona mostra polígono e **área medida** separados; exibição bruta ou líquida.

**Decisão:** ambiente com `limite = face do acabamento` por padrão (Revit), propriedade `bordaDeCálculo` por projeto,
`room bounding` por elemento e linha de separação. Gross/net como exibição.

## 7. O que ainda falta pesquisar (antes da fase correspondente)

| Tema | Fase | Perguntas |
|---|---|---|
| Linha de referência da parede no ArchiCAD | 1 | lado de referência do composto, perfis complexos |
| Junção de paredes de tipos diferentes e *Disallow Join* | 1 | ordem de junção, o que acontece em X |
| Pisos: esboço, inclinação, direção do vão, bordas de laje | 4–5 | *slab edge*, *shape editing*, *span direction* |
| Hospedagem e *Wall Closure* da família | 2 | geometria do retorno por abertura |
| Escadas por componente e por croqui | 7 | regras de patamar, corrimão contínuo |
| Fases e filtros de fase | 7 | estado novo/existente/demolir, gráficos por fase |
| Tabelas e quantitativos por camada | 6 | agrupamento, campos calculados |
| Perfis complexos do ArchiCAD | 1 | equivalente no Hestia |

### 7.1 Resultados da pesquisa (19/10/2026)

Graus: **confirmado em fonte oficial** (ajuda do fabricante ou documentação de API, lida pela busca), **consistente em fóruns** (vários relatos concordando, sem fonte oficial) e **não encontrado**. As páginas oficiais da Autodesk e da Graphisoft foram bloqueadas para leitura direta nesta sessão (403 do proxy de saída), então as conclusões de fonte oficial vêm dos trechos de busca dessas páginas, não da página inteira. Quando o item abaixo diz `[?]`, a pendência continua aberta.

1. **Linha de referência da parede no ArchiCAD** `[ok]`. Seis posições confirmadas em fonte oficial (API). Lado de referência do composto (primeira pele = externa) e deslocamento só nas posições externa e interna: consistente em fóruns. Fontes: §3 acima.
2. **Junção de paredes de tipos diferentes e *Disallow Join*** `[?]`. Confirmado em fonte oficial: o *Disallow Join* é por extremidade, e restaurar é selecionar a junção inteira e usar *Allow Join* ([Autodesk, Specify Wall Join Cleanup Options](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-130A65BC-8C57-4C31-8C07-F96041771539.htm)). *Previous/Next* percorre as ordens de junção no encosto e no esquadro: confirmado em fonte oficial ([Autodesk, Modify Wall Joins](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-7AFCACAC-9ED2-44A4-A30E-7D7ED16E01E5.htm)). **Ordem de junção em X (três ou mais paredes): não encontrado.** No *Join Geometry*, a primeira escolha define só o **material** aplicado aos dois objetos; quem corta quem segue a hierarquia por tipo de elemento (paredes cortam pilares; estruturais cortam elementos hospedeiros; pisos, forros e telhados cortam paredes; cornijas não cortam nada) `[DOC]` ([Autodesk, Join Geometry (2023)](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-F3D6884F-F1E3-471B-81FB-ECE93D9C2671.htm)). A regra "a primeira parede escolhida domina" é de fórum `[SEC]` e não se aplica a *Disallow Join*.
3. **Pisos: esboço, inclinação, direção do vão, bordas de laje** `[?]`. Confirmado em fonte oficial: direção do vão de piso estrutural (símbolo e linhas de direção, ajuda Revit 2023) e alça de forma nas bordas de laje ([Autodesk, Move a Floor Slab Edge](https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-DFE33521-5EC8-4672-BF7E-EC28A808B066.htm)). Mais de uma direção de vão dentro de um mesmo piso não é suportada: consistente em fóruns (pedido de melhoria, não é documentação). Inclinação de piso: **não encontrado**. Direção por API: fórum, com ressalva de que deve ser definida em transação separada.
4. **Hospedagem e *Wall Closure* da família** `[ok]`. Confirmado em fonte oficial: o retorno do acabamento no vão depende do *Wall Closure* da família da abertura; o modo (nenhum, interno, externo, ambos) é definido na parede (*Wrapping at Inserts*) e a família do vão pode substituí-lo ([Autodesk, About Layer Wrapping](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-69B6DC75-56A9-4F35-BE24-80048360E2BB.htm)). A posição do retorno vem de planos de referência marcados como *Wall Closure* na família: consistente em fóruns (relatos de 2004–2009).
5. **Escadas por componente e por croqui: patamar e corrimão contínuo** `[?]`. Confirmado em fonte oficial: patamar automático quando há dois lances para o próximo nível, e corrimão gerado com o lance, ambos desligáveis ([Autodesk, Run Component Tool](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-26053199-6B08-44B9-907C-F5D9AA7CEC81.htm)). Corrimão contínuo entre escadas separadas: consistente em fórum que a junção não é possível, e a solução é editar um corrimão só. Regras de dimensionamento do patamar: **não encontrado**.
6. **Fases e filtros de fase** `[ok]`. Confirmado em fonte oficial: gráficos de novo, temporário, demolido e existente, e status de filtro *Por categoria*, *Não exibir* ou *Sobrescrito* ([Autodesk, Define the Graphic Display for Phase Filters](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-92CF3963-780B-42FA-BAED-1265E3E57CA7.htm)). Filtros padrão *Mostrar demolição* e *Mostrar concluído* ([Autodesk, About Phase Filters](https://help.autodesk.com/cloudhelp/2023/ENU/RevitLT-DocumentPresent/files/GUID-DB104358-4D5A-494E-ACAE-BB8B4E72E572.htm)). O fluxo "demolir alterando a fase de demolição, sem excluir" é consistente em fóruns. Os nomes dos filtros mudam entre versões.
7. **Tabelas e quantitativos por camada** `[?]`. Confirmado em fonte oficial: a *Material Takeoff* lista materiais e subcomponentes de uma família ([Autodesk, Material Takeoff Schedules](https://knowledge.autodesk.com/support/revit/learn-explore/caas/CloudHelp/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-F8270A42-CA71-46C7-B145-85EC2CB8E4A1-htm.html)). Uma linha por camada, com área e volume próprios: consistente em fóruns e tutoriais. Volume por camada é aproximado por desempenho: relato da busca, não verificado na página. Armadilha conhecida: tabela de parede com campo de volume de material conta todas as camadas e infla a área: consistente em fórum. **Campos calculados em tabela de material: não encontrado** em fonte oficial.
8. **Perfis complexos do ArchiCAD** `[?]`. Conceito confirmado em fonte oficial (ajuda AC17, AC18 e AC20): perfil complexo é a seção transversal do elemento, salvo como atributo e colocado na planta; pode ter material por superfície de componente ([Graphisoft, About Complex Profile Elements (AC18)](https://help.graphisoft.com/AC/18/INT/AC18Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-35.htm)). **Equivalente no Hestia: decisão de projeto, não pesquisa.** O Hestia não tem seção transversal de parede: o `topProfile` é perfil do topo em altura, e as faixas (`strips`) são acabamentos laterais. Não há conclusão que contradiga o código; a lacuna fica registrada.
9. **Esquadro** `[?]` (§9, item 3). Definição confirmada em fonte oficial: *Square off* esquadreja a extremidade da parede a 90°, não vale para paredes inclinadas nem para o interior de outra parede, e é indicado para encontros não retos ([Autodesk, Change the Configuration of a Wall Join](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm)). Desenho do canto: **não encontrado**. **Hestia:** o tipo Esquadro foi removido (decisão 0010 #1), porque em quina de 90° tinha a mesma geometria do encosto. Ressalva: o Revit o oferece, e a definição acima (extremidade a 90°) não coincide com o encosto em ângulo que não seja reto; o Hestia não o implementa. Isto é decisão de projeto, não pesquisa.

**Contradições com o código atual:** a única diferença de produto nesta área é o esquadro. O Revit oferece o *Square off* (item 9); o Hestia removeu o tipo por ter a mesma geometria do encosto em 90° (decisão 0010 #1). Fora isso, nenhuma conclusão contradiz o código, que segue o modo de fechamento do vão (item 4, `insertMode`). Há lacunas, não contradições: linha de referência sem deslocamento (`locationLine` é só enumeração, sem offset), fechamento do vão sem geometria vinda da família, e fases, escadas e pisos ainda não existem no modelo.

## 8. Como transformar referência em teste (obrigatório por ferramenta)

1. **Ficha de comportamento** (esta página): o que acontece, em que condição, com fonte.
2. **Caso de teste dourado**: projeto mínimo (ex.: T de três tipos de parede) + resultado esperado
   (contornos por camada, áreas, volumes).
3. **Se houver acesso ao programa original**, gerar o resultado nele (exportar IFC/DXF/medidas) e guardar em
   `tests/golden/revit/` ou `tests/golden/archicad/`. Licença educacional ou de avaliação serve.
4. Diferenças **intencionais** em relação ao original viram **decisão registrada** em `docs/decisoes/`.
5. O CI roda os casos dourados; qualquer divergência não registrada quebra o build.

---

## 9. Tipos de junção entre paredes (pesquisa de 19/10/2026)

**Revit** `[DOC]` [About Wall Joins](https://help.autodesk.com/cloudhelp/2017/ENU/RevitLT-Model/files/GUID-6B18982C-1FBA-4E5C-AE30-6FAE4022CE35.htm) · [Change the Configuration of a Wall Join](https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm)
- Três configurações de canto: **Butt** (padrão: as camadas terminam retas onde as paredes se encontram), **Miter** (camadas terminam em ângulo, uma contra a outra) e **Square off** (a extremidade da parede é esquadrejada a 90°; indicada para encontros que não são retos).
- Miter e Square off **não** valem entre a extremidade de uma parede e o **meio** de outra (T): só o encosto, em ordem fixa. Também não valem para paredes inclinadas.
- Em Butt e Square off, **Previous/Next** percorre as ordens de junção possíveis (qual parede para na outra).
- A ferramenta cobre junções de até 4 paredes; mais que isso, ou junções entre níveis, exigem o procedimento de junções complexas.
- Desabilitar junção por extremidade (**Disallow Join**) existe; "Don't Clean Join" mostra as linhas entre as paredes.
- Camadas de paredes que se juntam só se fundem quando têm o **mesmo material**; senão aparece uma linha. [Layer Join Cleanup](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-798DE946-C683-4ACD-BA7C-040BF722F033.htm) `[DOC]`
- Camadas dentro do núcleo se estendem pelo núcleo do elemento unido e atravessam camadas de prioridade maior que estejam fora dele. `[DOC]` [Edit Layers in a Compound Structure (Revit 2026)](https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-B6EEDFEF-641E-409A-8C42-AB5A66BDC554.htm): "Layers inside a wall's core extend into the core of a joined wall and can pass through higher-priority layers outside that core".
- Estrutura vertical: *Modify Vertical Structure* permite **dividir regiões**, atribuir camadas e mesclar regiões; **sweeps** adicionam e **reveals** subtraem perfis. [Modify the Vertical Structure of Walls](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-E11C1335-5CC2-4001-8563-021E01CCF829.htm) `[DOC]`

**ArchiCAD** `[COM]`
- Linha de referência de parede composta: seis posições (fora, centro, dentro, núcleo fora, núcleo centro, núcleo dentro), com deslocamento exceto em centro. [API Graphisoft](https://archicadapi.graphisoft.com/?p=1354)

**Decisões do Hestia (docs/decisoes/0004):**
1. Padrão = **encosto**, como o Revit. Toda junção criada nasce em encosto (0010 #8). A mais antiga domina; "inverter ordem" troca.
2. **Esquadria** pareia as camadas **a partir do núcleo** (a estrutura de uma parede encontra a da outra; acabamentos contornam o canto com a espessura própria de cada um). Se os acabamentos de uma parede são mais finos, eles terminam na face externa da outra.
3. **Esquadro: removido** (decisão 0010 #1). O tipo tinha a mesma geometria do encosto em quina de 90°, pois pareava por face, em degraus, como o encosto (decisão 0009 #13). O Hestia não oferece mais a opção Esquadro. O Revit a oferece (§7.1, item 9); a remoção é decisão de projeto, com essa ressalva. O desenho do canto no Revit segue `[?]`.
4. T (extremidade no meio da outra): sempre encosto, ordem fixa, como no Revit.
5. Nó de 3 ou mais paredes: todas as paredes são cortadas retas no ponto do nó e o pintor por prioridade resolve as sobreposições; só o canto externo (lacuna angular maior que 180°) usa a junção de par configurada (`nodeOfWalls`, decisão 0010). Com um par colinear, o par atravessa e as demais encostam (T).
6. **Desempate** de camadas de mesma prioridade e materiais diferentes: domina a parede de **núcleo mais espesso**, depois a mais antiga. Difere do Revit (só ordem de junção) para evitar que um drywall corte um bloco; a prioridade por camada continua prevalecendo.
7. **Alturas diferentes**: a prioridade é resolvida por faixa vertical, só entre as paredes que existem naquela altura.
