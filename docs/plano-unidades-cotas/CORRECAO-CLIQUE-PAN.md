# Correção: 2º clique da parede e pan com cotas dinâmicas

## Sintomas
- Ao desenhar parede, o 2º clique (que fecha o trecho) falhava ou "demorava".
- O pan ficava difícil, com momentos de "bugs estranhos".

## Causa raiz (medida, não palpite)
A sobreposição `TempDimsOverlay` desenha, na prévia da parede, uma cota com **alças nas duas pontas**; a ponta viva fica
exatamente no ponto do cursor. As alças são `<button>` com `pointerEvents: 'auto'` e `onPointerDown/Up` com
`stopPropagation`. O 2º clique caía na alça (`elementFromPoint` no cursor = "Referência: Eixo (clique para alternar)"):
o canvas não recebia o clique, a parede não era criada e a referência da cota alternava. O texto e o botão "I" têm o mesmo
risco. O `stopPropagation` valia para **qualquer botão**: pan com o botão do meio iniciado sobre alça/texto/"I" era engolido
(nenhum pan) e o menu de contexto também.
Descartado: re-renderização por movimento (o `previewTick` já existia antes e o tempo de quadro não mudou), provedor
atrasando o frame, controller tratando clique como edição de cota e snap afetado pela cota.

## Medições (Playwright, 20 repetições; `tests/e2e/fix-clique-medir.mjs`, dados em `capturas/fix-clique-*.json`)
| Versão | 2º clique registrou | alvo do pointerdown | latência evento→commit |
|---|---|---|---|
| antes do plano (:5181) | 20/20 | canvas 20 | 3,8 ms |
| atual, sem correção | 9/20 | canvas 9, alça 11 | 2,6 ms (quando registra) |
| atual, com correção | 20/20 | canvas 20 | 2,0 ms |

Pan com botão do meio iniciado sobre a cota (`fix-clique-pan-sobre-cota.mjs`): antes do plano desloca o centro; atual sem
correção: deslocamento 0 (bloqueado); com correção: desloca.
Tempo de quadro no pan (p50 33 ms, p95 50-83 ms, em Chromium headless com SwiftShader) é equivalente nas três versões:
não há regressão de desempenho; a variação de tarefas longas entre execuções é ruído do ambiente.

## Correção
- `apps/web/src/ui/dims/dimsHit.ts` (novo, com `dimsHit.test.ts`): `capturesPointer` (na prévia da ferramenta, alça, texto
  somente leitura e "I" sob o cursor, com folga de 12 px para o imã, deixam o clique passar ao canvas; na seleção sempre
  capturam), `rectAround`, `swallowsPointerButton` (só o botão principal é engolido).
- `apps/web/src/ui/dims/TempDimsOverlay.tsx`: usa os dois; assina `cursor` do estado.
- Capturas: `capturas/fix-clique-antes-parede.png`, `fix-clique-depois-parede.png`.
