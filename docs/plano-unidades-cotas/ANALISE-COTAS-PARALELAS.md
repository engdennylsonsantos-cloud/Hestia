# Análise geral das cotas "ao vizinho paralelo" (2026-10-29)

## Relatos do dono
- A. Duas grades lado a lado a 1,64 m: digitar 3 m na cota as APROXIMAVA (ficavam a ~0,29 m).
- B. Parede selecionada (vertical): a cota mostrada era a distância do FIM da parede até outra parede (ao longo do eixo); o esperado, como o Revit, é a distância LATERAL (perpendicular ao eixo) até a parede PARALELA mais próxima de cada lado.
- C. Suspeita de defeito geral.

## Causa-raiz comum
1. **Sinal invertido na edição (confirmado).** Grade e parede transladavam o elemento por `side * (valor − distância)` na normal, onde `side` é o lado do VIZINHO. Andar para o lado do vizinho APROXIMA; logo valor maior aproximava, e a medida remedida era `2d − v` (2·1,64 − 3 = 0,28). Os testes antigos (`grid.test.ts`, `wall.test.ts`) codificavam o erro (digitar 3 numa distância 2 levava a grade para y = 1; digitar 1,5 numa vão de 1,816 levava a parede para −0,316, isto é, para longe).
2. **Interpretação de "perpendicular".** A cota é a distância PERPENDICULAR ao elemento até o vizinho paralelo, não a distância axial até uma perpendicular. O provedor de parede preferia o vão axial e só usava a paralela se não houvesse perpendicular; mostrava só UMA paralela (a mais próxima dos dois lados) e sem exigir sobreposição.
3. **Sem mecanismo comum.** Cada provedor reimplementava "vizinho mais próximo + translação", cada um com seu sinal e critério.

## Correção na base
`packages/tools/src/dims/parallel.ts` (novo, com teste): `segFrame/segLocal/segPoint`, `areParallel` (qualquer ângulo, tolerância ~2,5 graus), `nearestParallelGaps` (mais próximo de cada lado, exigindo sobreposição ao longo do eixo; plano do elemento e do vizinho vindos do chamador), `segmentGaps` (vizinhos dados como segmentos) e `gapTranslation` (o ÚNICO ponto que decide o sinal: `n * side * (distância − valor)`). Invariante testado por provedor: digitar `v` e remedir devolve exatamente `v`, nos dois lados e em ângulo qualquer. A parede reutiliza `wallPlanes`/`wallPlaneAt` (referência eixo/face/núcleo configurada) em `providers/wallLateral.ts`.

## Tabela por provedor
| Provedor | Alvo (antes) | Direção (antes) | Sinal | Defeito | Correção |
|---|---|---|---|---|---|
| grade (`grid.ts`) | paralelas, uma por lado | perpendicular | invertido | editar aproximava em vez de afastar | `gapTranslation`; reta ilimitada (sem exigir sobreposição) |
| parede (`wall.ts`) | perpendicular além da ponta; paralela só sem perpendicular | axial; 1 paralela | invertido (paralela) | cota errada (fim da parede) e sinal | lateral por lado até a paralela mais próxima, face a face ou eixo a eixo conforme "Cotas…"; axial só se NÃO houver paralela |
| linha de detalhe (`line.ts`) | o próprio comprimento | ao longo da linha | n/a | media a própria linha | lateral até a linha paralela mais próxima (translada a linha); sem vizinha, cai no comprimento |
| contorno piso/laje/forro/telhado (`outline.ts`) | comprimento de cada lado | ao longo do lado | n/a (leitura) | media o próprio lado | distância entre lados paralelos (um par, uma vez); sem par (triângulo), comprimentos; segue só leitura (A03) |
| esquadria (`opening.ts`, `openingNeighbors.ts`, `refs.ts`) | parede perpendicular, ponta ou esquadria vizinha | ao longo da parede (a esquadria só se move ao longo dela) | correto | nenhum | auditado; testes de ida e volta existentes (34 casos) |
| deslocamento (`displacement.ts`) | cursor a partir do ponto-base | direto | n/a (leitura) | n/a | mantido: é o valor que se digita em Mover/Copiar; não há vizinho a cotar |
| trecho do Perímetro (`line.ts`) | comprimento do lado em desenho | ao longo | n/a (leitura) | n/a | mantido: é o traço em construção |

## Auditoria dos demais itens
- Unidades: `resolveDimEdit` lê o texto com `parseQuantityText` (m, cm, ft-in) e os provedores recebem SI; nenhuma conversão própria.
- Hospedados: translação lateral da parede move as esquadrias junto (hospedadas por `hostId`); edição de esquadria continua validada por `conflict`.
- Ângulo qualquer: `areParallel` e os quadros locais não supõem eixos alinhados (teste a 30 graus). Parede curva fica sem cota lateral.
- Infraestrutura (`registry.ts`, `types.ts`, `dimsActions.ts`): sem defeito de sinal ou unidade; só repassam o valor.

## Capturas
`capturas/fix-paralelas-grades-depois-1.png` (1,64), `-2.png` (após digitar 3: 3), `fix-paralelas-parede-depois.png` (parede vertical com cotas laterais 2,82 e 1,82).

## Dúvidas para o dono
1. Parede sem nenhuma paralela vizinha: manter o vão axial até a perpendicular como último recurso (hoje) ou não mostrar nada?
2. Linha de detalhe sem paralela: manter o comprimento (hoje) ou nada?
3. Mover/Copiar: manter a distância total do gesto (hoje)?
4. Contornos continuam só leitura; liberar edição por lado exige a decisão A03.
