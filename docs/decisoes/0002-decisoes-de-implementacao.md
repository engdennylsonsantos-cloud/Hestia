# 0002 · Decisões de implementação (Fases 0 a 3)

Tomadas durante a construção da primeira versão de teste, sem consulta ao responsável, seguindo a regra
"a opção mais profissional". Cada uma pode ser revertida; o custo está indicado.

| # | Tema | Decisão | Motivo | Custo de reverter |
|---|---|---|---|---|
| 1 | Núcleo da parede | Algoritmo do pintor por prioridade: cada camada vira um polígono, e quem tem prioridade maior corta as demais. Mesma prioridade e material funde sem duplicar área | Cobre L, T, X e ângulos quaisquer com um só mecanismo e é testável por áreas | Médio |
| 2 | Junção em L | Esquadro por camada: a camada à profundidade *d* de uma parede encontra a de profundidade *d* da outra, de modo que acabamentos contornam o canto e a estrutura se encontra em diagonal | Resultado fiel ao Revit quando os tipos são iguais; evita que a estrutura "fure" o acabamento externo | Baixo |
| 3 | Junção em T | O ramal vai até a linha de centro da parede passante; as camadas do ramal de prioridade menor são cortadas pela estrutura passante e a estrutura do ramal funde com ela | Evita o ramal atravessar a parede e reproduz a continuidade dos acabamentos | Baixo |
| 4 | Nó com 3+ paredes | Se houver par colinear, ele vira a "passante" e os demais viram ramais; senão, extensão reta até cobrir o nó (aproximação) | Casos de Y verdadeiro são raros em residencial; documentado como pendência | Baixo |
| 5 | Núcleo | Derivado: do primeiro ao último layer de estrutura, em vez de marcador editável | Menos estado para o usuário errar; o Revit tem marcador explícito (diferença registrada) | Baixo |
| 6 | Prioridades por função | Estrutura 1, substrato 2, isolamento 3, membrana 3, acabamento 1 = 4, acabamento 2 = 5, centralizadas em `priority.ts` | A fonte consultada dá estrutura = 1 e acabamento 2 = 5; os valores intermediários seguem a ordem do menu | Trivial |
| 7 | Paredes | Apenas retas nesta versão (sem arco) | Arco multiplica os casos de junção; entra na fase seguinte | Médio |
| 8 | Aberturas | Recorte em todas as camadas da hospedeira, sem retorno de acabamento no vão (campo "envolve" guardado, ainda não aplicado) | Retorno depende da geometria do caixilho; registrado no 05 §2 | Médio |
| 9 | Comandos | Dados serializáveis aplicados por Immer, com patches como histórico | Desfazer e refazer sem código inverso por comando | Baixo |
| 10 | Seleção/picking | Geométrico em CPU (ponto na faixa da parede), não por buffer de IDs na GPU | Exato, sem leitura de pixel e sem depender do backend gráfico; com centenas de paredes é irrelevante | Baixo |
| 11 | Snap | Passo da grade segue a grade visível (≥ 14 px entre linhas); ao alinhar/ortogonal a coordenada livre também cai na grade | Medidas exatas ao desenhar; o usuário digita para valores finos | Trivial |
| 12 | Vizinhas ao mover | Paredes ligadas pelas extremidades acompanham o movimento (como no Revit), num só passo de desfazer | Evita abrir o circuito ao mover uma parede | Baixo |
| 13 | Modelos iniciais | Duas plantas prontas (casa de 2 quartos, quitinete) e projeto em branco; o app abre na casa | Primeiro quadro mostra o que a ferramenta faz | Trivial |
