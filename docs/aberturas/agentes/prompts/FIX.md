# Tarefa FIX · Integração v3: reconciliar os testes que quebraram depois de juntar BA + FR1 + FR2

Três tarefas foram mescladas na `feat/esquadrias-v3`: BA (basculante e bandeira de janela), FR1 (batente em peça única com perfil, `frameDepthMode: 'wall'` por padrão, acabamento encostando no batente, alizar sobre a face acabada, pivô da folha, planta só com a folha aberta) e FR2 (3D e corte para peças com `profile`). Cada uma passou nos seus testes isolada; juntas, há testes antigos que descrevem o comportamento de ANTES e alguns defeitos reais de integração. Spec: `docs/aberturas/E3-spec-correcoes-v3.md` (E3) é a verdade; relatórios das três tarefas em `docs/aberturas/relatorios-v2/` não, mas leia os arquivos de teste e o código.

## Para cada teste que falha, decida (e registre no RELATORIO.md, uma linha por teste)
- (A) **expectativa antiga**: o comportamento mudou por causa da E3 (por exemplo, a porta de giro tem 8 peças em vez de 11 porque o batente virou 3 peças com perfil em L; o batente agora é 18,4 cm de profundidade no modo `wall`; o alizar fica sobre a face acabada; a folha tem `hingeS` novo; folha de 0,652/0,722 muda por causa do recuo do pivô). Atualize o teste **mantendo a intenção** (não afrouxe tolerâncias nem apague asserções: recalcule o valor esperado pela regra da E3 e escreva o cálculo no teste).
- (B) **defeito real**: o comportamento viola a E3 ou o bom senso (por exemplo, volume de interseção entre peças, peça fora do vão, arestas faltando ou sobrando no 3D instanciado, V no lado errado). Corrija o **código** e deixe o teste como está.
- (C) **tempo**: teste que estourou 5 s por carga (muitos testes de invariantes pesados): aumente o timeout do teste para 60000 ms ou otimize o teste; nunca reduza a cobertura.

## Arquivos que falham (de uma execução completa; rode você para ver as mensagens)
- packages/engine/src/openingCatalogo.test.ts > catálogo completo: modelo único > folha fechada não tem volume comum com batente/caixilho em nenhuma família
- packages/render/src/openingCatalogoVistas.test.ts > catálogo completo: 3D > openingPieces e caixasDaAbertura desenham o mostruário fechado e aberto, equivalentes à cena
- packages/render/src/model3d/instanciada3d.test.ts > silhueta: a cena com caixas é a mesma da geometria > arestas: toda aresta da geometria está na cena com caixas, e as extras são só as juntas de 2 mm da tinta do batente
- packages/render/src/model3d/openingParts.test.ts > peças 3D do vão: acabamento, peitoril e vergas > sem campos novos, a porta de giro fechada traz o modelo inteiro: batente com rebaixo, folha e maçaneta
- packages/render/src/model3d/openingParts.test.ts > porta pivotante aberta > fechada: folha no centro de t, apoiada no batente (sem dobradiça)
- packages/render/src/model3d/openingParts.test.ts > modelo único no 3D: todos os campos do tipo mudam a malha > frameDepth: a assinatura (caixas + volume por material) muda em relação ao tipo base
- packages/render/src/model3d/openingParts.test.ts > movimento do modelo único no 3D > porta de giro ot_p90: a folha gira 90° na dobradiça do modelo, que fica fixa; angle3d = 45° gira 45°
- packages/render/src/model3d/openingPiecesPerfil.test.ts > adaptador 3D do batente em peça única (fixture E3 §2) > quando o motor tiver profile, a posição da peça 3D bate com a box do buildOpeningModel
- packages/render/src/model3d/scene3d.test.ts > exibição por categoria (substituições) > ocultar porta tira as 11 peças da porta; janela tira 16; a linha não muda
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > porta de 1 folha: batente de 5 cm com rebaixo, folha de 4 cm de espessura apoiada no batedor
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > porta dupla: duas folhas de lh − 0,002, centros em ±lh/2, dobradiças nas ombreiras
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > espessuras do tipo: largura do perfil, folha e vidro vêm do tipo; a profundidade do batente é limitada à parede
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > sem os campos novos, as espessuras são as de antes (batente 5 cm, folha 4 cm, vidro 1,2 cm, profundidade 9 cm)
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > profundidade do batente limitada ao NÚCLEO estrutural (0,14 m na wt_alv14), não à espessura total (0,184 m)
- packages/render/src/model3d/scene3d.test.ts > esquadrias no 3D: folhas e espessuras do tipo > porta pivotante: uma folha no vão interno mais o rebaixo, apoiada no batedor
- packages/render/src/section/build.test.ts > esquadria no corte e na elevação (tipo e família) > C1: no corte transversal, a verga e a soleira têm a profundidade do batente (frameDepth), centradas na parede
- packages/render/src/section/build.test.ts > esquadria no corte e na elevação (tipo e família) > espessuras do tipo: frameWidth, frameDepth e glassThickness vêm do tipo
- packages/render/src/section/build.test.ts > acabamento e vergas da esquadria no corte e na elevação > alizar: contorno a mais em volta do vão (quatro linhas fechadas numa janela) na elevação
- packages/render/src/plan/symbols.test.ts > openingSymbol: modelo único na planta > low: só a linha da folha; mid: perfis cortados, folha aberta e arco; high: mais a folha fechada
- apps/web/src/ui/dialogs/openingTypeForm.test.ts > campos de acabamento: cada um muda a peça no 3D e o quadro > alizar: largura e espessura viram as peças em volta do vão (8 a mais na janela)
- apps/web/src/ui/dialogs/openingType/previewViews.test.ts > prévias de planta, elevação e corte > a planta usa o detalhe alto em scale e respeita o detalhe fixo
- `packages/render/src/plan/ouroZoom.test.ts` (84 casos): a referência de ouro (`ouroZoom.json`) precisa ser regravada **depois** que todo o resto passar; regrave com um teste temporário (`regenOuro.test.ts`: percorre `cenarios()` × zooms [12, 60, 220], grava `JSON.stringify(out, null, 2) + '\n'`), rode, apague o teste temporário e confirme que `ouroZoom.test.ts` passa.
- Ignore `apps/web/src/editor/shortcutConfig.test.ts` (estoura o tempo só sob carga e não tem relação).

## Verificação final
`npx vitest run packages/engine packages/model packages/render apps/web/src/ui --exclude "**/property.test.ts" --exclude "**/*perf.test.ts"` sem falhas (exceto `shortcutConfig`); `tsc` e `check-boundaries` limpos; `npx eslint packages/engine/src packages/render/src packages/model/src` sem **erros** (o limite de linhas é 420 por arquivo: se algum arquivo estourar por causa das mudanças, divida-o em módulos coesos sem mudar comportamento).
Liste no RELATORIO.md os defeitos reais (B) que encontrou e como corrigiu.
