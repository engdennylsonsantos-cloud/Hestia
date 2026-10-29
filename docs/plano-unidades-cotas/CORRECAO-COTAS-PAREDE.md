# Correção das cotas temporárias de parede e esquadria (2026-10-29)

## Defeito (teste manual do dono)
1. Parede selecionada: a cota temporária mostrava o comprimento da própria parede (rótulo "4,00 m" no meio dela) e uma cota de comprimento.
2. Esquadria: as cotas iam sempre até a parede/ponta, ignorando outra janela ou porta mais próxima na mesma parede.

## Causa raiz
- O comprimento aparecia por três caminhos: `lengthDim` em `wall.ts` (cota editável), e o rótulo "cota temporária" desenhado em `packages/render/src/plan/planOverlay.ts` (dois pontos) e em `selectTool.move`.
- `wall.ts` só procurava paralelas; nunca a perpendicular que o prolongamento do eixo encontra.
- `opening.ts` usava só `hostTargets` (paredes perpendiculares encostadas / ponta), sem olhar as esquadrias vizinhas.

## Regra implementada
- Parede: por ponta (a e b), cota da ponta até o plano (`ref` configurado) da parede perpendicular mais próxima que o eixo prolongado encontra além da ponta. Perpendicular que já encosta (T, L) não gera vão. Sem nenhuma perpendicular: só a paralela mais próxima (antes eram as duas faces). Editar a cota translada a parede ao longo do eixo (hospedados acompanham). O comprimento da parede nunca é cota temporária.
- Esquadria: em cada lado, vale o mais próximo entre (face da perpendicular / ponta da hospedeira) e (borda da esquadria vizinha na mesma parede, pela referência de abertura configurada; slot `neighLeft`/`neighRight`). Editar reposiciona a esquadria como antes (validações de sobreposição/saída inalteradas).
- Parede curva: sem cota de ponta (só reta), como antes sem paralelas em arco.

## Arquivos
`packages/tools/src/dims/providers/wallAxisGaps.ts` (novo), `openingNeighbors.ts` (novo), `wall.ts`, `opening.ts`, `refs.ts` (kind `opening`), `packages/tools/src/selectTool.ts`, `packages/render/src/plan/planOverlay.ts`.

## Testes
`wall.test.ts` (reescrito: perpendicular, dois lados, T, L, não alcançada, referência, parede curta, edição a/b, zero/negativo/NaN, paralela, preferência), `wallAxisGaps.test.ts`, `openingNeighbors.test.ts`, `lengthEdit.test.ts` (sem rótulo de comprimento), `planFrame.test.ts` (overlay sem rótulo).

## Capturas
`capturas/fix-parede-perpendicular.png`, `-paralela.png`, `-janela-paredes.png`, `-janela-vizinhas.png` (Playwright, dev server).

## Dúvidas de interpretação
- Digitar um número com a parede selecionada ainda redimensiona a parede ("Comprimento", `selectTool.type`), embora a cota não seja mais exibida; manter ou trocar o aviso?
- `segmentLengthDim` (rascunho da ferramenta Parede, `wallTool.ts`, do agente CLIQUE) ainda mostra o comprimento durante o desenho: é a cota do traço em construção, não de parede existente.
- Perpendicular em ângulo diferente de 90 graus (tolerância cos < 0,02) não conta como perpendicular.
