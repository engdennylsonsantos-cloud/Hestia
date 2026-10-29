# Tarefa T · 3D das esquadrias a partir do modelo único

Leia: spec E §1 e §4.3; `packages/engine/src/openingModel.ts` e teste (NÃO o altere; registre o que faltar); `packages/render/src/model3d/openingParts.ts` e `openingParts.test.ts`, `aberturas3d.ts`, `scene3d.ts` (onde `montarAbertura` e `caixasDaAbertura` entram), `scene3d.test.ts`, `instanciada3d.test.ts`, `packages/render/src/model3d/materiais3d.ts` (materiais), `packages/model/src/defaults.ts` (materiais padrão).

## Arquivos permitidos
`packages/render/src/model3d/openingParts.ts` (+ teste), `aberturas3d.ts`, os arquivos de 3D que dependam do formato de peça (só o necessário), e novos arquivos em `packages/render/src/model3d/`. Nada de planta, corte, ferramentas, diálogo.

## O que fazer
1. `openingPieces` passa a ser um adaptador: `buildOpeningModel` → `OpeningPiece` (caixa centrada + `hinge`). Estenda `OpeningPiece` com o que faltar (movimento `slide`, eixo horizontal em `t`, material lógico) mantendo `montarAbertura` e `caixasDaAbertura` consistentes entre si (mesma cadeia de transformações, como hoje). O estado aberto usa `angle3d` do tipo (graus → rad) e `partTransformed`; `view.openOpenings` continua ligando/desligando.
2. **Todas as peças do modelo viram malha**: batente com rebaixo/batedor, folha(s) com espessura, almofadas, vidro (material do vidro, translúcido), montantes de `grid`, maçaneta, bandeira e bandeiras laterais, alizar, peitoril saliente, verga e contraverga (concreto), trilhos. Mapeie `PartMaterial` → `materialId` do tipo (`frame`/`leaf`/`casing` → `frameMaterialId`; `glass` → `glassMaterialId`; `concrete` → `mat_concreto` como hoje; `metal` → o material de aço/metal padrão do projeto se existir, senão `frameMaterialId`).
3. Nível de detalhe 3D (`detail3d`): `'off'` só o vão; `'schematic'` batente e folha lisa sem maçaneta/almofadas/divisões; `'simple'` sem maçaneta e almofadas; `'full'` e `'view'` tudo.
4. O furo da parede no 3D e na planta coincidem (vão bruto); não mude o recorte da parede, só confirme com um teste.
5. Desempenho: mantenha o agrupamento por material (`lotesMalha3d`); o número de caixas por esquadria cresce, então confira que `caixasDaAbertura` e `montarAbertura` seguem com o teste de equivalência existente.

## Critérios de aceitação (testes)
- Para cada campo do tipo que altera o modelo (`leafStyle`, `handle`, `grid`, `transom`, `sidelights`, `casing`, `sillBoard`, `lintel`, `sillBeam`, `frameStyle`, `frameDepth`, `frameWidth`, `leafThickness`, `glassThickness`): a assinatura da malha (contagem de caixas + soma dos volumes por material) **muda** em relação ao tipo base (teste parametrizado).
- Porta de giro `ot_p90` com `openOpenings`: a folha gira 90° em torno da dobradiça do modelo (centro da folha fora do plano da parede, para o lado `flipFacing`), a dobradiça fica fixa; `angle3d = 45°` gira 45°.
- Maxim-ar aberta gira em torno do eixo horizontal do topo da folha por `angle3d` (padrão 30°); correr desliza dentro do vão.
- Nenhuma peça (exceto alizar, peitoril saliente, verga, contraverga) sai do vão.
- Os testes existentes de 3D continuam verdes; atualize só o que a spec mudou (batente com rebaixo no lugar do batente retangular centrado) e **liste**.
