# Tarefa P · Planta das esquadrias a partir do modelo único

Leia: spec E §1 e §4.1; `packages/engine/src/openingModel.ts` e seu teste (o modelo já existe e está testado, use-o; NÃO o altere: se faltar algo nele, registre no RELATORIO.md e contorne na vista); `packages/render/src/plan/symbols.ts`, `packages/render/src/plan/view.ts` (`openingViewOps` e quem o chama; ache onde o zoom/escala está disponível), `packages/render/src/plan/symbols.test.ts`, `packages/geom/src/openingSymbol.ts` e seu teste (símbolo antigo), `apps/web/src/editor/dxfExport.ts` (`dxfGeometryOf`) e `packages/io/src/dxf.ts` (como o DXF usa o símbolo), `packages/render/src/plan/types.ts` (`StrokeOp`, `FillOp`).

## Arquivos permitidos
- Novo `packages/engine/src/openingPlan.ts` + `openingPlan.test.ts` (função pura `openingPlanPaths(model, opts)`; exporte no `index.ts` do engine com uma linha).
- `packages/render/src/plan/symbols.ts`, `symbols.test.ts`, `view.ts` (só o necessário para passar o modelo, o nível de detalhe e a convenção), e novos arquivos em `packages/render/src/plan/` se precisar.
- `apps/web/src/editor/dxfExport.ts` (+ teste) e `packages/io/src/dxf.ts` (+ teste) só para o DXF passar a usar o desenho novo (mesmas camadas `ABERTURAS`, `ABERTURA_*`).
- `packages/geom/src/openingSymbol.ts`: pode ficar como está se ainda houver chamador; não apague sem migrar todos.

## O que fazer
1. `openingPlanPaths(model: OpeningModel, opts: { detail: 'low' | 'mid' | 'high'; angle: number /* rad, 2D */; planDisplay: 'symbolic' | 'projected'; showSwing: boolean; swingStyle: 'arc' | 'dash' | 'line'; cutZ: number }): Array<{ pts: Array<{ t: number; s: number }>; closed: boolean; weight: number; tone: 'cut' | 'ink' | 'soft'; dash?: [number, number]; role: PartRole | 'swing' | 'arrow' | 'mark' }>` em coordenadas locais do vão, seguindo a spec §4.1 (low, mid, high/projected). Use `slicePartsAtZ` e `partTransformed`. A folha aparece **com espessura** (retângulo), a folha de giro **aberta em `angle`** mais o arco do fecho até a abertura, centrado na dobradiça com raio = comprimento da folha, os perfis de batente com **rebaixo/batedor** nas posições do modelo (não centrados no eixo). Janela: perfis do caixilho, vidro (duas linhas finas no alto), pistas e seta de correr, arco/V conforme a família, peitoril saliente, alizar.
2. `symbols.ts`: `openingSymbol` passa a montar `StrokeOp` a partir de `openingPlanPaths` (cores/espessuras como hoje: `cut` na tinta com espessura de corte, `ink`/`soft` como antes). O nível de detalhe vem de `openingDetail2d(type)` e, em `'scale'`, da escala/zoom da vista (spec §4.1); `'off'` não desenha. `projection-above` continua tracejado, `projection-below`/`beyond` leve.
3. DXF: usar o mesmo desenho (nível `mid`, como hoje na camada), sem regressão nos testes de DXF.
4. Atualize/crie testes. Atualize os testes antigos que verificavam o desenho antigo e **liste** cada um no RELATORIO.md.

## Critérios de aceitação (testes)
- Porta de giro `ot_p90` em parede de 14 cm (núcleo), nível `mid`: contém um polígono fechado da folha com largura (na direção do vão) 0,822 e espessura 0,04 na posição do modelo; ombreiras com batedor nas posições do modelo; arco com raio 0,822 centrado em `t = −0,411` (sem inversão) cujas extremidades estão na posição fechada e a 90° da folha aberta; com `flipHand` o espelho em `t`; com `flipFacing` o espelho em `s`.
- `high`: acrescenta a folha **fechada** (retângulo no plano médio da folha) e alizar/peitoril quando o tipo os tem; `low`: só a linha da folha fechada, **sem arco**.
- Em nenhum nível a folha é desenhada atravessando uma ombreira ou o batedor (interseção de área zero entre o polígono da folha fechada e os do batente).
- `angle2d = 45°` muda o arco e a folha aberta; `showSwing = false` remove o arco; `swingStyle 'dash'` o torna tracejado.
- Janela de correr 2 folhas: duas folhas em pistas distintas, seta; janela fixa: 3 linhas + vidro; maxim-ar: arco tracejado do lado de `flipFacing`.
- `detail2d = 'off'` não gera traços; `'scale'` escolhe `low/mid/high` pelo zoom (teste com dois zooms).
- DXF: testes existentes verdes e um novo conferindo que a folha tem espessura.
- Sem mudar nada em corte, elevação, 3D, ferramentas ou diálogo.
