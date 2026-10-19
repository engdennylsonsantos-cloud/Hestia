# Paridade · Paredes (inclui aberturas hospedadas)

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte do comportamento: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md). Item sem fonte lá vira `[?]` no 05 antes de ser codificado.

## A · Geometria
- [x] A1 Parede reta por dois pontos, encadeada, com medida digitada
- [x] A2 Altura livre ou até um nível, com deslocamentos de base e topo
- [x] A3 Linha de localização (6 opções) e lado externo/invertido
- [x] A4 Parede em arco (centro/raio/ângulos e por três pontos) **(bloqueante)**
- [x] A5 Criar por retângulo (dois cantos). Pegar linhas e faces existentes entra quando houver linhas de detalhe e massas
- [-] A6 Parede inclinada: rara em residencial; exige um modelo 3D de eixo inclinado; reavaliar com massas conceituais
- [x] A7 Editar perfil superior (topo inclinado, empena, degraus) em parede reta **(bloqueante)**
- [-] A10 Contorno vertical livre (furos e laterais arbitrárias, como o croqui do Revit): o perfil superior (A7) cobre empena, inclinado e degraus; furos internos ficam para o editor de croqui da fase de famílias
- [-] A8 Parede em degraus (empilhada): coberta por duas paredes empilhadas (C15) e pelas faixas verticais (B6)
- [-] A9 Espessura variável de camada (afunilada): rara em residencial; reavaliar na fase de interoperabilidade

## B · Camadas
- [x] B1 Camadas com função, material e espessura; núcleo derivado
- [x] B2 Prioridade de junção por função
- [x] B3 Prioridade por camada editável na interface (substituição) **(bloqueante)**
- [x] B4 "Envolve" aplicado nas extremidades e nos vãos **(bloqueante)**
- [x] B5 Membrana de espessura zero tratada em planta, 3D e quantitativos
- [x] B6 Faixas verticais no tipo (rodapé, barra de azulejo, friso): revestimento por altura, em planta, 3D, corte e quantitativos **(bloqueante)**
- [-] B9 Editor gráfico de regiões na elevação: as faixas são editadas por tabela com presets; o arraste gráfico entra com a edição em vista de elevação (fase de documentação)
- [-] B7 Estender ou encurtar uma camada no topo/base: coberta pelas faixas verticais (B6) e pelo perfil superior (A7)
- [-] B8 Dividir face e pintar região: pertence à ferramenta Pintar, comum a todos os elementos (checklist transversal de acabamentos)

## C · Junções
- [x] C1 Canto em L com esquadria por camada
- [x] C2 T com ramal até a linha de centro
- [x] C3 Cruzamento em X sem duplicar área
- [x] C4 Paredes alinhadas contínuas, inclusive com espessuras diferentes
- [x] C5 "Não unir" no início e no fim
- [x] C6 Escolha do tipo de junção no canto (encosto, esquadria, corte reto) **(bloqueante)**
- [x] C7 Trocar a ordem de junção (qual parede domina)
- [x] C8 Botões de "Permitir junção" e "Limpar junção" na interface (propriedades da parede e ferramenta Junção)
- [x] C9 Nó de 3 ou mais paredes sem par colinear resolvido de forma exata **(bloqueante)**
- [x] C10 Ângulos agudos e obtusos extremos sem artefato
- [x] C11 Tolerância de junção configurável e por distância real **(bloqueante)**
- [x] C12 Tipos de espessuras muito diferentes verificados em casos dourados
- [x] C13 Junção com parede em arco **(bloqueante)**
- [x] C14 Paredes sobrepostas detectadas, com aviso
- [x] C15 Parede empilhada sobre outra (níveis diferentes)
- [-] C16 Junção com pilar, viga e cortina de vidro: depende desses elementos, que têm checklists próprios
- [-] C17 Divisão automática ao cruzar: o Revit também não divide sozinho

## D · Aberturas hospedadas
- [x] D1 Porta e janela hospedadas, recorte em todas as camadas
- [x] D2 Peças acima e abaixo do vão no 3D
- [x] D3 Retorno do acabamento no vão pelo tipo da parede e pela família da abertura **(bloqueante)**
- [x] D4 Abertura pura (vão sem elemento) e vão por croqui
- [-] D5 Vão em arco e outras formas não retangulares: dependem do editor de famílias/croqui (fase de famílias)
- [x] D6 Abertura em parede curva **(bloqueante)**
- [x] D7 Trocar a parede anfitriã de uma abertura
- [x] D8 Aviso quando o encurtamento da parede deixa a abertura sem espaço
- [x] D9 Símbolo de planta por família (basculante, correr, pivotante, dupla com bandeira)

## E · Conexões verticais
- [x] E1 Topo até nível mais deslocamento
- [-] E2 Anexar topo e base a laje, piso e telhado: entra no checklist de pisos, lajes e telhados, que é quem hospeda o comando
- [-] E3 Parede cortada por piso e laje conforme as regras de junção: idem E2, nos checklists desses elementos

## F · Edição
- [x] F1 Selecionar (clique, janela, alças), mover, copiar, girar, espelhar, matriz, deslocar, aparar ao canto, alinhar, medir
- [x] F2 Vizinhas acompanham ao mover e ao arrastar alças
- [x] F3 Dividir parede (ponto e com intervalo)
- [x] F4 Aparar e estender várias paredes de uma vez
- [x] F5 Editar o comprimento pela cota temporária
- [-] F6 Travar alinhamento e cotas que comandam: exige um solver de restrições; fora do escopo da v1, reavaliar na fase de documentação
- [x] F7 Copiar e colar entre níveis alinhado
- [x] F8 Espelhar usando uma parede como eixo
- [x] F9 Selecionar todas as instâncias do tipo e filtro por categoria

## G · Interface e propriedades
- [x] G1 Seletor de tipo, instância, editor de tipo com seção ao vivo, navegador de materiais
- [x] G2 Campos avançados de camada (prioridade e envolve) em "mais"; espessura variável fica fora (A9)
- [x] G3 Parâmetros de tipo adicionais (código, custo, desempenho térmico e acústico)
- [x] G4 Etiquetas (tags) de parede na planta
- [x] G5 Substituir um tipo em todas as instâncias e mostrar onde é usado
- [x] G6 Sobreposição visual de depuração de junção (mostrar prioridade e ordem)

## H · Vistas e documentação
- [x] H1 Planta em corte com hachura e detalhe por zoom
- [x] H2 Corte e elevação mostrando as camadas **(bloqueante)**
- [x] H3 Nível de detalhe grosseiro, médio e fino por vista
- [-] H4 Pesos de linha e estilos por categoria configuráveis: configuração global de estilos de objeto (fase de documentação)
- [-] H5 Cotas associativas de parede: pertencem à ferramenta de anotação (fase de documentação)

## I · Quantitativos
- [x] I1 Volume e área por camada e por material, sem dupla contagem nos cantos
- [x] I2 Tabela de paredes com colunas, filtros e totais **(bloqueante)**
- [x] I3 Exportação CSV

## J · Interoperabilidade
- [-] J1 IFC (IfcWall com camadas de material): fase de interoperabilidade (docs/03), depois de pisos, lajes e telhados para exportar o modelo inteiro de uma vez
- [x] J2 DXF da planta
- [-] J3 Importação do formato do Hestia 1: fase de interoperabilidade; exige exemplos de arquivos reais do Hestia 1

## K · Qualidade
- [x] K1 Casos dourados de área para L, T, X, alinhadas e aberturas
- [x] K2 Casos dourados de geometria (contornos) para cada junção, derivados da documentação **(bloqueante)**
- [x] K3 Testes de propriedade com paredes aleatórias: sem sobreposição, sem erro, resultado estável **(bloqueante)**
- [x] K4 Desempenho: 500 paredes em um único aglomerado (pior caso) resolvem em ~1,1 s a frio e ~0,7 s ao mover uma parede; casas reais têm aglomerados pequenos e usam o cache por aglomerado
- [x] K5 Validação do modelo (comprimento zero, tipo ausente, referência quebrada)
- [x] K6 Pesquisa das pendências do docs/05 §7 concluída e registrada
- [x] K7 Regressão visual por captura de tela dos casos de junção
