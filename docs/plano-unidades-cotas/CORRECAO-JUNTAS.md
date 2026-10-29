# Correção das junções ao editar cotas que transladam paredes

## Problema
Editar a cota lateral de uma parede (ex.: afastá-la da paralela) transladava só a parede (`transform`/`translate`). As paredes ligadas pelas pontas ficavam onde estavam e a junção abria (reproduzido no navegador: retângulo 6x4, cota 3,82 para 5 deixou 1,184 m de folga nos dois cantos; `capturas/fix-juntas-antes-*.png`).

## Correção
- `packages/tools/src/wallFollow.ts` (novo): `planWallFollowers` é o mecanismo do Mover (extraído de `transformWalls`, que agora o usa: comportamento idêntico); `translateWallsJoined` gera os comandos da cota (translação + `setWallEnds` das vizinhas, um único passo de desfazer porque `dimsActions` já executa tudo numa transação).
- `providers/wall.ts`: tanto a cota lateral quanto a axial usam `translateWallsJoined`.
- Casos: L, retângulo, qualquer ângulo, ponta ligada a várias paredes, parede movida com as duas pontas ligadas, junção em T (haste que termina no corpo da parede movida estica até a nova linha; haste cuja ponta toca a parede movida acompanha). Vizinha colinear/paralela com deslocamento fora do eixo NÃO estica e a mensagem avisa ("Uma parede alinhada com a movida não foi esticada: a junção com ela se abriu."). Vizinha que ficaria com comprimento zero é solta, com aviso.
- Linhas de detalhe e grades não têm junção: sem mudança.
- Mover/Copiar/alça de extremidade já mantinham a junção (mesmo mecanismo); `wallFollow.test.ts` garante.

## Testes
`dims/providers/wallJoins.test.ts` (valor remedido = digitado E folga das junções < 1e-6, desfazer em um passo), `wallFollow.test.ts`; `roundtrip.test.ts` continua verde.

## Capturas
`capturas/fix-juntas-antes-{1,2}-*.png` e `fix-juntas-depois-{1,2}-*.png` (parede de baixo de 3,82 para 5: antes os cantos abrem 1,184 m; depois os lados esticam).
