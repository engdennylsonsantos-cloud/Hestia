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

**ArchiCAD** `[?]` — a busca não retornou a linha de referência da parede nem o lado de referência do composto.
**Pendente:** ler a ajuda do ArchiCAD sobre *Reference Line* e *Composite reference side* antes da Fase 1.

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
- Os materiais dentro do limite do núcleo se estendem até a camada de função Estrutura [1]. `[COM]`
- Estrutura vertical: *Modify Vertical Structure* permite **dividir regiões**, atribuir camadas e mesclar regiões; **sweeps** adicionam e **reveals** subtraem perfis. [Modify the Vertical Structure of Walls](https://help.autodesk.com/cloudhelp/2020/ENU/Revit-Model/files/GUID-E11C1335-5CC2-4001-8563-021E01CCF829.htm) `[DOC]`

**ArchiCAD** `[COM]`
- Linha de referência de parede composta: seis posições (fora, centro, dentro, núcleo fora, núcleo centro, núcleo dentro), com deslocamento exceto em centro. [API Graphisoft](https://archicadapi.graphisoft.com/?p=1354)

**Decisões do Hestia (docs/decisoes/0004):**
1. Padrão = **encosto**, como o Revit. A mais antiga domina; "inverter ordem" troca.
2. **Esquadria** pareia as camadas **a partir do núcleo** (a estrutura de uma parede encontra a da outra; acabamentos contornam o canto com a espessura própria de cada um). Se os acabamentos de uma parede são mais finos, eles terminam na face externa da outra.
3. **Esquadro** `[?]`: implementado como extensão reta das duas paredes até cobrir o canto externo. A fonte descreve "esquadrejar a 90°" para encontros não retos; o detalhe visual precisa de confirmação.
4. T (extremidade no meio da outra): sempre encosto, ordem fixa, como no Revit.
5. Nó de 3 ou mais paredes: cada parede ocupa o setor limitado pelas semirretas que saem do nó pelos cantos entre faces vizinhas. Com um par colinear, o par atravessa e as demais encostam (T).
6. **Desempate** de camadas de mesma prioridade e materiais diferentes: domina a parede de **núcleo mais espesso**, depois a mais antiga. Difere do Revit (só ordem de junção) para evitar que um drywall corte um bloco; a prioridade por camada continua prevalecendo.
7. **Alturas diferentes**: a prioridade é resolvida por faixa vertical, só entre as paredes que existem naquela altura.
