# Tarefa T · 3D das esquadrias a partir do modelo único

## O que foi feito

- `openingPieces` virou um adaptador fino de `buildOpeningModel` para `OpeningPiece`: cada `OpeningPart` do modelo único
  vira uma caixa centrada no sistema local do vão `(t, s, z)`, com papel lógico (`role`), material lógico (`material`) e
  `materialId` já resolvido para o projeto.
- `OpeningPiece` foi estendido com:
  - `material` (`PartMaterial`) e `role` (`PartRole`);
  - `hinge` com `atS` — para o eixo vertical, o par `(t, s) = (at, atS)`; para o eixo horizontal, `(s, z) = (atS, at)`;
  - `slide` (`dx`, `dy`, `dz`) para o estado de correr.
- O estado aberto usa `openingAngle3d` do tipo (graus → rad) e `partTransformed` para o deslocamento de correr.
  `view.openOpenings` continua sendo o único liga/desliga.
- `montarAbertura` e `caixasDaAbertura` passaram a usar a mesma cadeia: grupo do vão · pivô da dobradiça (com `atS`) ·
  translação da peça (incluindo o `slide`) · escala da caixa. A equivalência entre os dois caminhos continua coberta pelo
  teste existente de `instanciada3d`.
- Todas as peças do modelo viram malha: batente com rebaixo/batedor, folha(s), almofadas, vidro, montantes de `grid`,
  maçaneta, bandeira, bandeiras laterais, alizar, peitoril saliente, verga, contraverga e trilhos.
- Mapeamento de material: `frame`/`leaf`/`casing` → `frameMaterialId`; `glass` → `glassMaterialId`; `concrete` →
  `mat_concreto` (senão `frameMaterialId`); `metal` → `mat_aco` (senão `mat_perfil`, senão `frameMaterialId`).
- `detail3d`: `'off'` não gera peça (só o vão); `'schematic'` remove maçaneta, almofadas e divisões; `'simple'` remove
  maçaneta e almofadas; `'full'` e `'view'` mostram tudo.
- O recorte da parede não foi alterado. Um teste novo confirma que a planta (`cut`) e o 3D (`bands`) usam o mesmo vão
  bruto por camada, que o maior furo (núcleo) vale `roughWidth` e que as peças continuam no vão nominal.

## Arquivos tocados

- `packages/render/src/model3d/openingParts.ts`
- `packages/render/src/model3d/openingParts.test.ts`
- `packages/render/src/model3d/aberturas3d.ts`
- `packages/render/src/model3d/scene3d.test.ts`

## Testes

- `npx vitest run packages/render/src/model3d` — 34 arquivos, 536 testes verdes.
- `npx vitest run packages/engine/src/openingModel.test.ts packages/model/src/openingStyle.test.ts` — 48 testes verdes.
- `npx tsc -p tsconfig.json --noEmit` — limpo.
- `node scripts/check-boundaries.mjs` — `fronteiras ok`.

Critérios de aceitação cobertos em `openingParts.test.ts`:
- assinatura da malha (nº de caixas + volume por material) muda para cada campo: `leafStyle`, `handle`, `grid`, `transom`,
  `sidelights`, `casing`, `sillBoard`, `lintel`, `sillBeam`, `frameStyle`, `frameDepth`, `frameWidth`, `leafThickness`,
  `glassThickness`;
- porta de giro `ot_p90` aberta: giro de 90° na dobradiça do modelo, dobradiça fixa e centro para o lado de
  `flipFacing`; `angle3d = 45°` gira 45°;
- maxim-ar: giro no eixo horizontal do topo da folha pelo `angle3d` (padrão 30°); correr desliza dentro do vão;
- nenhuma peça sai do vão (exceto alizar, peitoril saliente, verga e contraverga), fechada ou aberta;
- cena (`montarAbertura`/`caixasDaAbertura`) usa a dobradiça `(t, s)`/`(s, z)` e o deslocamento do modelo.

## Testes existentes atualizados (e motivo)

`packages/render/src/model3d/scene3d.test.ts`:
- “a fixture padrão tem 9 malhas…” → 11 malhas e 12 materiais (11 de superfície + 1 de linha): o modelo agora gera
  batente com rebaixo/batedor, maçaneta e as molduras/trilhos da janela.
- “sombreado” e “linhas ocultas”: 9 → 11 faces.
- “ocultar porta tira as 4 peças…” → 11 peças da porta e 16 da janela.
- “porta de 1 folha…” → 11 peças; folha de 0,722 m (vão interno + rebaixo − folga); ombreira 0,035 m + batedor 0,015 m.
- “porta dupla…” → 16 peças; folha `lh − 0,002` e centros em `±(lh − 0,002)/2`.
- “janela de correr de 2 folhas…” → 16 peças (caixilho, 8 molduras de folha, 2 vidros e 2 trilhos); o antigo montante
  central não existe no modelo único.
- “espessuras do tipo…” → ombreira 0,065 m + batedor 0,015 m; profundidade limitada ao núcleo (0,14 m).
- “porta de correr…” → 7 peças; painéis de 0,78 m e centros em `±travel/2`.
- “janela de correr com 3 folhas…” → 21 peças (4 do caixilho, 12 molduras, 3 vidros e 2 trilhos).
- “profundidade do batente limitada ao núcleo…” → ombreira de 0,035 m.
- “porta pivotante…” → 7 peças; folha de 0,722 m e centro em `D/2 − folga − L/2`.

`packages/render/src/model3d/openingParts.test.ts`:
- contagem da porta de giro 4 → 11 e conferência dos papéis;
- peitoril saliente de 1,20 m → 1,26 m (o modelo projeta 0,03 m além de cada lado);
- janela de correr aberta passa a conferir o `slide` (e a posição efetiva), não só `x`;
- o teste de vidro/montantes virou vidro/moldura de folha dentro de `jamb…h−jamb` (a janela fixa não tem moldura de folha);
- os testes de correr 2/3 folhas e da porta de correr foram reescritos para as pistas, molduras, vidros e trilhos do modelo;
- o teste da pivotante fechada usa a largura e a profundidade reais do modelo.

## Divergências e decisões

- `detail3d = 'schematic'` filtra papéis (maçaneta, almofadas e divisões), mas mantém alizar, peitoril, verga,
  contraverga, bandeiras e as peças de uma folha `leafStyle = 'glass'` (estilos + vidro). O adaptador só desenha peças do
  modelo; não sintetiza uma “folha lisa” substituta. É a leitura mais fiel a “todas as peças do modelo viram malha”.
- O material lógico `metal` usa `mat_aco` e, na falta dele, `mat_perfil`; depois cai em `frameMaterialId`.
- O modelo único continua usando a altura nominal do tipo; `openingPieces` limita a altura a `H − sill` como o 3D antigo
  fazia, passando uma cópia de `OpeningGeometry` ao modelo.
- Nas camadas de acabamento o recorte do vão é mais estreito que o vão bruto (o acabamento retorna para dentro do vão).
  Isso já existia; o teste novo compara `cut` × `bands` por camada e confirma que o maior furo (núcleo) é o vão bruto.

## Pendências honestas

- Nenhuma pendência bloqueante. A única simplificação é a de `detail3d = 'schematic'` descrita acima.
