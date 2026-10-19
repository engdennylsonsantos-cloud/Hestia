# Paridade · Paredes (inclui aberturas hospedadas)

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte do comportamento: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md). Item sem fonte lá vira `[?]` no 05 antes de ser codificado.

## A · Geometria
- [x] A1 Parede reta por dois pontos, encadeada, com medida digitada
- [x] A2 Altura livre ou até um nível, com deslocamentos de base e topo
- [x] A3 Linha de localização (6 opções) e lado externo/invertido
- [x] A4 Parede em arco (centro/raio/ângulos e por três pontos) **(bloqueante)**
- [ ] A5 Criar por retângulo, por linha existente e por face (pegar)
- [ ] A6 Parede inclinada
- [ ] A7 Editar perfil (contorno vertical livre) **(bloqueante)**
- [ ] A8 Parede em degraus (empilhada: tipos diferentes por altura)
- [-] A9 Espessura variável de camada (afunilada): rara em residencial; reavaliar na fase de interoperabilidade

## B · Camadas
- [x] B1 Camadas com função, material e espessura; núcleo derivado
- [x] B2 Prioridade de junção por função
- [ ] B3 Prioridade por camada editável na interface (substituição) **(bloqueante)**
- [ ] B4 "Envolve" aplicado nas extremidades e nos vãos **(bloqueante)**
- [ ] B5 Membrana de espessura zero tratada em planta, 3D e quantitativos
- [ ] B6 Modificar a estrutura vertical (dividir regiões: barra de azulejo, rodapé) **(bloqueante)**
- [ ] B7 Estender ou encurtar uma camada no topo/base
- [ ] B8 Dividir face e pintar região (material numa parte da face)

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
- [ ] C10 Ângulos agudos e obtusos extremos sem artefato
- [x] C11 Tolerância de junção configurável e por distância real **(bloqueante)**
- [x] C12 Tipos de espessuras muito diferentes verificados em casos dourados
- [x] C13 Junção com parede em arco **(bloqueante)**
- [ ] C14 Paredes sobrepostas detectadas, com aviso
- [ ] C15 Parede empilhada sobre outra (níveis diferentes)
- [ ] C16 Junção com pilar, viga e cortina de vidro
- [-] C17 Divisão automática ao cruzar: o Revit também não divide sozinho

## D · Aberturas hospedadas
- [x] D1 Porta e janela hospedadas, recorte em todas as camadas
- [x] D2 Peças acima e abaixo do vão no 3D
- [ ] D3 Retorno do acabamento no vão pelo tipo da parede e pela família da abertura **(bloqueante)**
- [ ] D4 Abertura pura (vão sem elemento) e vão por croqui
- [ ] D5 Vão em arco e outras formas não retangulares
- [x] D6 Abertura em parede curva **(bloqueante)**
- [ ] D7 Trocar a parede anfitriã de uma abertura
- [ ] D8 Aviso quando o encurtamento da parede deixa a abertura sem espaço
- [ ] D9 Símbolo de planta por família (basculante, correr, pivotante, dupla com bandeira)

## E · Conexões verticais
- [x] E1 Topo até nível mais deslocamento
- [ ] E2 Anexar topo e base a laje, piso e telhado (depende desses elementos)
- [ ] E3 Parede cortada por piso e laje conforme as regras de junção

## F · Edição
- [x] F1 Selecionar (clique, janela, alças), mover, copiar, girar, espelhar, matriz, deslocar, aparar ao canto, alinhar, medir
- [x] F2 Vizinhas acompanham ao mover e ao arrastar alças
- [x] F3 Dividir parede (ponto e com intervalo)
- [ ] F4 Aparar e estender várias paredes de uma vez
- [ ] F5 Editar o comprimento pela cota temporária
- [ ] F6 Travar alinhamento e cotas que comandam
- [ ] F7 Copiar e colar entre níveis alinhado
- [ ] F8 Espelhar usando uma parede como eixo
- [ ] F9 Selecionar todas as instâncias do tipo e filtro por categoria

## G · Interface e propriedades
- [x] G1 Seletor de tipo, instância, editor de tipo com seção ao vivo, navegador de materiais
- [ ] G2 Campos avançados de camada (prioridade, envolve, espessura variável) em "mais"
- [ ] G3 Parâmetros de tipo adicionais (código, custo, desempenho térmico e acústico)
- [ ] G4 Etiquetas (tags) de parede na planta
- [ ] G5 Substituir um tipo em todas as instâncias e mostrar onde é usado
- [ ] G6 Sobreposição visual de depuração de junção (mostrar prioridade e ordem)

## H · Vistas e documentação
- [x] H1 Planta em corte com hachura e detalhe por zoom
- [ ] H2 Corte e elevação mostrando as camadas **(bloqueante)**
- [ ] H3 Nível de detalhe grosseiro, médio e fino por vista
- [ ] H4 Pesos de linha e estilos por categoria configuráveis
- [ ] H5 Cotas associativas de parede (faces, eixo e núcleo)

## I · Quantitativos
- [x] I1 Volume e área por camada e por material, sem dupla contagem nos cantos
- [x] I2 Tabela de paredes com colunas, filtros e totais **(bloqueante)**
- [x] I3 Exportação CSV

## J · Interoperabilidade
- [ ] J1 IFC (IfcWall com camadas de material)
- [ ] J2 DXF da planta
- [ ] J3 Importação do formato do Hestia 1

## K · Qualidade
- [x] K1 Casos dourados de área para L, T, X, alinhadas e aberturas
- [ ] K2 Casos dourados de geometria (contornos) para cada junção, derivados da documentação **(bloqueante)**
- [ ] K3 Testes de propriedade com paredes aleatórias: sem sobreposição, sem erro, resultado estável **(bloqueante)**
- [ ] K4 Desempenho: 500 paredes recalculadas em tempo interativo
- [ ] K5 Validação do modelo (comprimento zero, tipo ausente, referência quebrada)
- [ ] K6 Pesquisa das pendências do docs/05 §7 concluída e registrada
- [ ] K7 Regressão visual por captura de tela dos casos de junção
