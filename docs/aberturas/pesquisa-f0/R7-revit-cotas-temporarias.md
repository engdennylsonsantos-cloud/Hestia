# R7: Cotas temporárias (Revit) e equivalentes (ArchiCAD)

Pesquisa com 9 buscas/leituras. Marcações: CONFIRMADO (fonte oficial lida ou trecho de fonte oficial), PROVÁVEL (fonte secundária ou conhecimento geral não verificado na página), NÃO CONFIRMADO (sem fonte encontrada).

## Resumo para decisão

- Cotas temporárias aparecem ao colocar um elemento e ao selecioná-lo com Modify. Somem ao colocar o próximo. [CONFIRMADO]
- Medem até o elemento perpendicular mais próximo e variam em passos do incremento de snap. [CONFIRMADO]
- Para manter a cota visível, converter em cota permanente. [CONFIRMADO]
- Linhas de chamada (witness lines) podem ser movidas para trocar a referência medida. [CONFIRMADO]
- Clicar no controle da linha de chamada alterna a referência. [CONFIRMADO em fonte secundária; detalhe visual PROVÁVEL]
- Paredes: Centerlines, Faces, Core centerline, Core faces. [CONFIRMADO]
- Portas e janelas: Centerlines, Openings. [CONFIRMADO]
- Configuração em Manage > Settings > Additional Settings > Temporary Dimensions. [CONFIRMADO]
- Escopo da configuração (projeto ou usuário): NÃO CONFIRMADO.
- Digitar valor na cota para mover o elemento: NÃO CONFIRMADO.
- Porta que fica fora da parede (ao mudar a parede): erro "Can't cut instance of <família> out of wall". Ação sugerida: desfazer ou excluir a instância. [CONFIRMADO]
- ArchiCAD: o Tracker mostra distância e ângulo ou coordenadas XY a partir do nó inicial. Alterna com a barra (/). [CONFIRMADO]
- Modos "Two points" e "Three points" do Dimension do ArchiCAD: NÃO CONFIRMADO.

## Detalhes

**1. Aparência e anatomia**
- Revit mostra cotas em volta do elemento ao criá-lo ou selecioná-lo. Fonte: https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-74FFB00B-FB29-44B7-8FEA-613DBE010AD4.htm [CONFIRMADO]
- Medem ao elemento perpendicular mais próximo, em passos do incremento de snap. Mesma fonte. [CONFIRMADO]
- Converter em permanente: mesma fonte e https://help.autodesk.com/cloudhelp/2023/ENU/Revit-DocumentPresent/files/GUID-0CCBFE40-9F0C-4869-BC4E-76E0A8E7BF67.htm [CONFIRMADO]
- Linhas de chamada movíveis para mudar a referência: mesma fonte de 2018 (link para tarefa separada). [CONFIRMADO]
- Controle de alternância (clique na linha de chamada) e grips azuis: fonte secundária, https://novedge.com/blogs/design-news/revit-tip-master-revit-modeling-with-temporary-dimensions [PROVÁVEL]
- Ícones de converter, mover linha de chamada, cor, texto editável e EQ: NÃO CONFIRMADO em fonte oficial. Um post do fórum de ideias diz que o EQ aparece nas cotas temporárias só quando a abertura já está centralizada: https://forums.autodesk.com/t5/revit-ideas/eq-function-to-work-in-temporary-dimensions/idi-p/8148787 [PROVÁVEL, fonte de usuário]
- Comportamento por tipo de elemento (linha de modelo, eixo, pilar, piso, modo perímetro): NÃO CONFIRMADO.

**2. Configuração**
- Caminho: Manage > Settings > Additional Settings > Temporary Dimensions. Fonte: https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-0C635A25-161D-4756-A3D1-C564079A1965.htm [CONFIRMADO]
- A página de 2014 lista as opções só por descrição: paredes medem a "wall centerlines, wall faces, center of core, or core faces"; portas e janelas medem a "door and window centerlines or door and window openings". [CONFIRMADO]
- Exemplo de tutorial da Autodesk (trecho de busca, não lido na página): Walls = Faces e Doors and Windows = Openings; o padrão da porta é o centro. Página do tutorial lida, mas sem as opções: https://app.learn-one.autodesk.com/learn/ondemand/tutorial/temporary-dimensions [PROVÁVEL]
- Um blog de dez/2025 usa o rótulo "Core Faces" e para portas "Center" ou "Opening". Os rótulos variam entre versões. [PROVÁVEL]
- Opções de aparência (texto, tamanho, fundo): o Revit LT indica o painel Graphics em Options. Fonte: https://help.autodesk.com/cloudhelp/2023/ENU/RevitLT-DocumentPresent/files/GUID-74FFB00B-FB29-44B7-8FEA-613DBE010AD4.htm [PROVÁVEL, citado de busca]
- Alternar referência em tempo de uso: clicar no controle da linha de chamada. Fonte secundária citada acima. [PROVÁVEL]

**3. Edição e elementos hospedados**
- Mudança de parede que deixa porta fora dela: Revit não consegue regenerar a abertura e mostra o erro "Can't cut instance of <família> out of wall". Autodesk sugere cancelar a mudança ou excluir a instância. https://help.autodesk.com/cloudhelp/2019/ENU/Revit-Troubleshooting/files/GUID-3C9C035F-BFA8-44A5-923A-C4E75F5D5E1C.htm [CONFIRMADO]
- Paredes empilhadas ou compostas e paredes model-in-place geram erros parecidos: "Can't place inserts outside of hosts". Fonte de fórum: https://forums.autodesk.com/t5/revit-architecture-forum/copy-paste-hosted-elements-on-model-in-place-wall/m-p/6771570/highlight/true [PROVÁVEL]
- Digitar valor move o elemento: NÃO CONFIRMADO.
- Bloqueio durante a digitação e alerta antes de sair da parede: NÃO CONFIRMADO. Não há fonte que mostre a caixa de diálogo de aviso.

**4. Unidades e arredondamento na cota**
- NÃO CONFIRMADO. Não pesquisado dentro do orçamento.

**5. ArchiCAD (equivalente)**
- Tracker aparece durante a entrada do elemento e segue o mouse. Mostra distância e ângulo ou XYZ a partir do nó inicial. Liga-se ao segundo clique num elemento selecionado ou ao iniciar a entrada. Alterna com a barra. Mostra com N ou fica permanente nas configurações de Work Environment. Fonte: https://helpcenter.graphisoft.com/?p=85299 [CONFIRMADO]
- Digitar expressões como "x3+" soma valor ao X do Tracker. Fonte: mesma. [CONFIRMADO]
- Dimension: fórum da Graphisoft descreve pontos de cota com snap guide e uso da tecla Delete para concluir a sequência de pontos. Não é ajuda oficial. https://community.graphisoft.com/t5/Modeling/Dimensions-Two-walls-or-lines/m-p/387718 [PROVÁVEL]
- "Two points" e "Three points": NÃO CONFIRMADO.

## Não confirmado

- Lista oficial de ícones (converter em permanente, mover linha de chamada), cor, texto editável e aparência das cotas temporárias.
- Escopo (projeto ou usuário) da configuração de Temporary Dimensions.
- Se digitar valor move o elemento, e como o Revit trata o caso em que a porta fica fora da parede durante a edição.
- Diferenças de rótulo entre versões (Center/Openings; Core faces/Core).
- Comportamento por tipo de elemento (eixos, linhas de modelo, pilar, piso, modo perímetro).
- Arredondamento e unidades mostrados na cota.
- Modos "Two points" e "Three points" do ArchiCAD.
