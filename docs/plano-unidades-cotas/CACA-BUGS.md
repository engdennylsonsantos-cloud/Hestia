# Caça-bugs da interação — unidades, cotas e esquadrias

Varredura exploratória feita em 2026-10-29 na branch `plano/caca`, já com o merge de
`origin/claude/fervent-newton-rfgz3y` (correções dos itens 1–4 do dono, base `f11e4a75`).
Não é revisão de código de produção: todos os achados abaixo foram reproduzidos no navegador.

## Como foi feito

- App de desenvolvimento: `npm run dev -w @hestia/web -- --port 5193 --strictPort --host 127.0.0.1`.
- Playwright (`playwright-core`) com o Chromium 1243 do sistema, WebGL2 por SwiftShader, janela 1440×860.
- Console e `pageerror` escutados em todas as sessões. O único ruído constante foi
  `[error] Failed to load resource: 404 (favicon)`, sem relação com o app; nenhuma exceção JavaScript.
- Cada cenário começou de projeto novo (`blank`, `house2` ou `house-premium`) e foi conduzido por
  mouse/teclado reais. O estado foi conferido pelos ganchos `window.__hestia`.
- Capturas em `capturas/caca-*.png` (as referenciadas abaixo).

## Resumo

| id | gravidade | tipo | resumo |
|---|---|---|---|
| C01 | alta | simples | A caixa de digitação das ferramentas descarta sufixo de unidade e aspas: `5'6"` vira `56` e `120cm` vira `120` (metros) |
| C02 | alta | simples | Distância digitada da porta/janela é lida como metros, ignorando a unidade do projeto |
| C03 | alta | simples | Alças das cotas de contorno cobrem as alças de vértice do piso/laje/telhado/forro e impedem arrastar |
| C04 | alta | simples | Em trechos curtos o botão “I” cobre o valor da cota; clicar no valor cria cotas permanentes |
| C05 | média | complexo | Clique no valor/“I” de uma cota de prévia atravessa para a ferramenta: cria geometria ou apaga a prévia |
| C06 | média | complexo | Na cota de deslocamento (Mover/Copiar), o campo somente leitura não edita e o clique confirma o Mover |
| C07 | média | simples | Redimensionar a janela não reposiciona as cotas temporárias; elas ficam no lugar antigo |
| C08 | baixa | simples | O campo de 62 px corta valores `ft-in` longos (`24' 11 3/16"` aparece truncado) |
| C09 | baixa | simples | Mensagens de erro de comprimento continuam dizendo “em metros” com o projeto em cm/mm/ft-in |
| C10 | baixa | simples | A mensagem de medida inválida usa o exemplo fixo “1,20”, que em cm significa 1,2 cm |

**Simples:** C01, C02, C03, C04, C07, C08, C09, C10 (8). **Complexo:** C05, C06 (2).

---

## C01 — A caixa de digitação descarta unidades e aspas

**Gravidade:** alta · **Simples**

**Passos**
1. Projeto em branco; unidades de comprimento em `ft-in` (atalho `UN`).
2. `WA`, clique no início da parede, mova o cursor e digite `5'6"` na caixa “Comprimento”.
3. Observe o buffer (`5'6"` vira `56`), pressione Enter.
4. Repita em metros: projeto em `m`, digite `120cm` e Enter.

**Esperado:** parede de 1,68 m (5 pés e 6 polegadas) e de 1,20 m (120 cm).

**Observado:** a parede saiu com **56 ft (17,07 m)** no primeiro caso e **120 m** no segundo. O
typebox mostra `56` e `120` (`capturas/caca-typebox-ftin.png`); os caracteres de unidade/aspas são
descartados sem aviso e os dígitos são concatenados.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/editor/controller.ts:308` (filtro `[0-9.,+\-*/()]` da caixa numérica)
descarta letras, `'` e `"`; `packages/tools/src/openingTool.ts:326` ainda usa `parseNumber`.
**Correção:** aceitar os caracteres de unidade quando há prompt numérico ativo e entregar o texto
inteiro ao `parseQuantityText` (que já entende `120cm`, `5'6"`, `1,2+0,3`).

## C02 — Distância digitada da esquadria ignora a unidade do projeto

**Gravidade:** alta · **Simples**

**Passos**
1. Projeto em branco; `UN` → comprimento `cm`.
2. Desenhe uma parede de 6 m e acione `DR`; posicione o cursor sobre a parede.
3. Digite `100` (100 cm, que deveria ser 1,00 m) e Enter.

**Esperado:** porta a 1,00 m do início da parede (as cotas de prévia mostram 260 cm de cada lado).

**Observado:** a porta foi para `offset = 5,59 m` (colada no fim da parede); `parseNumber` leu
`100` como metros e o clamp a levou ao limite (`capturas/caca-units-cm-door.png`).

**Console:** só o 404 do favicon.
**Suspeita:** `packages/tools/src/openingTool.ts:324-334` (`type()` usa `parseNumber`, não
`parseQuantityText`). O plano (`03-migracao-dos-usos.md`, C4) pede `parseQuantityText` em todas as
entradas de comprimento.
**Correção:** trocar por `parseQuantityText(text, unitsOf(project), 'length')`.

## C03 — As alças das cotas cobrem as alças de vértice do contorno

**Gravidade:** alta · **Simples**

**Passos**
1. Abra `house-premium`, selecione um piso (clique nele).
2. Tente arrastar um vértice do contorno (por exemplo o vértice em `(5,5, 0)` do piso do térreo).

**Esperado:** o vértice acompanha o mouse e o contorno muda (como com as cotas desligadas).

**Observado:** nada se move. `document.elementFromPoint` no vértice devolve o botão
`Referência: Eixo (clique para alternar)` da cota temporária, e não o canvas
(`capturas/caca-floor-vertex-drag.png`). As cotas de contorno usam `options: ['axis']`, então a alça
nem tem outra referência para trocar: ela só bloqueia. O mesmo provedor serve laje, telhado e forro.
Depois do merge, a parede não sofre mais disso para o comprimento (a cota de comprimento próprio foi
removida), mas o contorno continua.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/dims/TempDimsOverlay.tsx` (renderiza alça para toda ponta) e
`apps/web/src/ui/dims/dimsView.ts` (`gripOf`), com `packages/tools/src/dims/providers/outline.ts:26`
e `.../line.ts`/`.../grid.ts` (referência única `axis`).
**Correção:** não desenhar/ligar alças quando `options.length < 2` (ou deslocá-las para fora do
vértice). Resolve piso/laje/telhado/forro e linha de detalhe/grades.

## C04 — “I” cobre o valor da cota em trechos curtos e cria cotas ao clicar no valor

**Gravidade:** alta · **Simples**

**Passos**
1. Projeto em branco: parede de 1,00 m e porta de 0,80 m centrada (`offset 0,5 m`).
2. Selecione a porta. As duas cotas laterais mostram `0,1`.
3. Clique no **valor da cota da direita**.

**Esperado:** o campo entra em edição para digitar a distância.

**Observado:** `elementFromPoint` no centro do valor da direita devolve o botão “Converter em cotas
permanentes”. O clique criou **duas cotas permanentes** (“Cotas criadas.”) em vez de editar a medida
(`capturas/caca-short-wall-dims.png`). O botão “I” fica em `first.textAt.x + 40`, sobre o campo
seguinte quando as cotas ficam próximas.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/dims/TempDimsOverlay.tsx` (posição fixa do botão “I”).
**Correção:** posicionar o “I” fora da faixa dos campos (ou escondê-lo quando houver sobreposição).

## C05 — Clique no valor/“I” de cota de prévia cria geometria ou apaga a prévia

**Gravidade:** média · **Complexo**

**Passos (parede)**
1. `WA`, clique no início em `(1, 2)`, mova até `(7, 2)` (prévia de 6 m com cota no meio).
2. Clique no **valor** da cota (campo azul “6”).

**Esperado:** nada (a cota de prévia é somente leitura) ou edição, mas nunca criar geometria.

**Observado:** foi criada uma parede de `(1, 2)` até `(4, 2,42)`, terminando no ponto do texto, não
no cursor. Clicar no botão “I” na mesma prévia também cria uma parede e deixa a caixa “Comprimento”
presa em `…` (`capturas/caca-wall-preview-I.png`). O clique atravessa a sobreposição porque
`dimsHit.capturesPointer` libera o ponteiro perto do cursor durante a prévia.

**Passos (porta)**
1. `DR`, pare sobre a parede (aparecem 2 cotas e o “I”).
2. Mova o mouse até o valor ou até o “I”.

**Esperado:** poder converter a prévia em cotas permanentes com o “I” (decisão registrada na
`REVISAO-CRUZADA.md`).

**Observado:** ao sair da parede para alcançar o valor/“I”, a prévia é apagada (`dims` e `current`
ficam vazios, o “I” desaparece); nenhuma cota permanente é criada
(`capturas/caca-preview-I-approach.png` e `caca-preview-I-after.png`).

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/dims/TempDimsOverlay.tsx` + `apps/web/src/ui/dims/dimsHit.ts` (regra
de passagem do ponteiro) e `packages/tools/src/openingTool.ts:177-218` (a prévia é zerada quando o
cursor sai do hospedeiro).
**Correção:** separar “clique que fecha o traço” (nas pontas vivas) de “clique no texto/botão I”;
manter a última prévia da esquadria enquanto o cursor estiver sobre a própria cota.

## C06 — Cota de deslocamento é somente leitura mas confirma o Mover ao ser clicada

**Gravidade:** média · **Complexo**

**Passos**
1. Parede de 6 m; selecione; `MV`; clique no ponto-base em `(4, 2)`; mova até `(6, 2)`.
2. Clique no valor da cota de deslocamento (`2`).

**Esperado:** editar o deslocamento ou, no mínimo, nada.

**Observado:** o clique passou para a ferramenta, **confirmou o Mover naquele ponto** e voltou à
Selecionar. A digitação seguinte (`2` + Enter) foi interpretada pela Selecionar como novo
comprimento da parede: a parede terminou com 2,00 m (`Comprimento alterado para 2,00 m`), em vez de
ser movida. O campo tem `title="Cota de leitura"` e `readOnly` (`capturas/caca-move-dim-click.png`).

**Console:** só o 404 do favicon.
**Suspeita:** `packages/tools/src/dims/providers/displacement.ts` (sem `edit`),
`apps/web/src/ui/dims/TempDimsOverlay.tsx` (input de leitura) e a regra de passagem de ponteiro.
**Correção:** dar `edit` ao provedor de deslocamento (mover na direção base→cursor) ou absorver o
clique no campo de leitura sem deixá-lo chegar ao clique da ferramenta.

## C07 — Redimensionar a janela deixa as cotas no lugar antigo

**Gravidade:** média · **Simples**

**Passos**
1. Parede de 6 m com porta; selecione a porta (cotas laterais visíveis).
2. Anote a posição da cota e da porta.
3. Redimensione a janela de 1440×860 para 1100×720.

**Esperado:** as cotas acompanham a porta e o novo centro do canvas.

**Observado:** o canvas e a porta se reposicionam, mas as cotas ficam no `x` antigo (673 px antes e
depois; o centro do canvas andou 170 px). Ficam soltas à direita da porta
(`capturas/caca-dims-after-resize-door.png`). Um pan/zoom depois corrige.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/ViewportCanvas.tsx:111-114` (o `ResizeObserver` só faz `setSize`, sem
incrementar `previewTick`) + `apps/web/src/ui/dims/TempDimsOverlay.tsx` (`viewport` memoizado em
`[tick, tool, ctx.project]`).
**Correção:** invalidar o memo do overlay quando o canvas mudar de tamanho (bump de `previewTick` no
`ResizeObserver` ou dependência do tamanho).

## C08 — Campo de cota corta valores `ft-in` longos

**Gravidade:** baixa · **Simples**

**Passos**
1. Parede de 10 m com porta perto do fim; `UN` → comprimento `ft-in`; selecione a porta.

**Esperado:** ler a cota inteira.

**Observado:** a cota esquerda vale `24' 11 3/16"` mas o campo tem 60 px úteis e `scrollWidth` de
81 px; o texto aparece truncado (`24' 11 3/`) em `capturas/caca-ftin-clipped.png`. O tamanho fixo do
campo é 62 px.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/dims/TempDimsOverlay.tsx` (`BOX.width = 62` em `TempDimsOverlay.tsx:16`, sem auto-ajuste).
**Correção:** dimensionar o campo pelo texto (ou aumentar a largura e usar `ch`).

## C09 — Mensagens de comprimento ainda dizem “em metros”

**Gravidade:** baixa · **Simples**

**Passos**
1. `UN` → comprimento `cm`.
2. `WA`, clique no início, digite `0` e Enter → mensagem da ferramenta.
3. `DI`, dois pontos, digite `0` e Enter → mensagem da cota.

**Esperado:** falar em centímetros (ou citar a unidade do projeto).

**Observado:** `Valor inválido. Digite o comprimento em metros.` e
`Digite o deslocamento em metros, diferente de zero. ...` mesmo com o projeto em cm.
Os mesmos textos fixos aparecem em `selectTool`, `gridTool` e `parallelTool`, mas esses três não
foram exercitados nesta varredura.

**Console:** só o 404 do favicon.
**Suspeita:** `packages/tools/src/wallTool.ts:251`, `.../dimensionTool.ts:121`
(e, no mesmo padrão, `.../selectTool.ts:183`, `.../gridTool.ts:174`, `.../parallelTool.ts:180`).
**Correção:** montar o exemplo com `formatQuantity`/`unitSymbol` (como já foi feito em R10).

## C10 — Exemplo da medida inválida não segue a unidade

**Gravidade:** baixa · **Simples**

**Passos**
1. Projeto em `cm`; selecione uma parede; clique na cota de vão (ou use uma cota editável).
2. Digite `abc` e Enter.

**Esperado:** exemplo com a unidade do projeto (por exemplo “como 120”).

**Observado:** `Medida inválida: digite uma distância, como 1,20.` — em cm, `1,20` significa 1,2 cm.

**Console:** só o 404 do favicon.
**Suspeita:** `apps/web/src/ui/dims/dimsActions.ts:16` (texto fixo).
**Correção:** gerar o exemplo com `formatQuantity(units, 'length', 1.2)`.

---

## Cenários que passaram sem problema

1. Desenhar parede com clique inicial + comprimento digitado; encadear dois trechos e sair com dois `Esc`.
2. Segundo clique da parede e da linha de detalhe depois do merge (as correções de origem liberaram o ponteiro sobre a cota).
3. Linha de detalhe: início/fim e cota de comprimento ao selecionar.
4. Porta e janela: prévia real, `Tab` inverte o sentido, `Espaço` a dobradiça, clique insere.
5. Selecionar parede, porta, janela, piso, laje, telhado e grade: as cotas temporárias aparecem (escada não tem provedor, como previsto).
6. Editar cota pelo valor + Enter em m, cm e `ft-in`; `120cm` e `5'6"` funcionam **no campo da cota**.
7. Expressão `1,2+0,3` na cota (interpretada na unidade de exibição).
8. Valor inválido/fora da parede: mensagem, destaque vermelho, nada muda; `Esc` cancela a edição.
9. Desfazer/refazer depois de mudar cota, de converter com “I” e de mover.
10. Mover e Copiar com deslocamento digitado; `Esc` encerra a sessão de cópia.
11. Alças de inversão (sentido/dobradiça) e `Tab`/`Espaço` com o foco no canvas.
12. Troca de referência pela alça e pelo diálogo “Cotas…” (parede/eixo, esquadria/vão livre); desfazer das configurações.
13. “I” em seleção normal: cria as cotas permanentes e o desfazer remove o lote.
14. Diálogo Unidades em m, cm, mm e `ft-in`; conversão das cotas exibidas e edição em cada unidade (inclusive `120cm`, `5'6"` e `1,2+0,3`).
15. Atalhos `WA`, `DR`, `WN`, `MV`, `CO`, `DI`, `UN`, `Esc`; menu Arquivo pelo botão `H` abre e fecha (Esc também).
16. Troca de nível pelo navegador; vista 3D (WebGL2) e criação/abertura de corte, sem exceções no console.
17. Zoom pela roda e pan com o botão do meio; o viewport e o canvas acompanham (as cotas só falham no resize — C07).
18. Mostrar ao selecionar desligado no diálogo “Cotas…” esconde cotas, alças e “I”; desfazer restaura.
