# Retomada: telhados, grades e limpeza dos modos antigos (2026-10-27)

Continua [retomada-2026-10-27-telhados-e-edicao.md](retomada-2026-10-27-telhados-e-edicao.md). Ramo de trabalho:
`integracao/telhados-grades` (local, a partir da `main` de 825 commits; **não enviado ao GitHub**). Cada agente trabalhou num
ramo `h-*` (P, A, M1, M2, G1, G2a, G2b, V, D), todos mesclados nele.

## 1. O que foi entregue

| Frente | Resumo | Onde |
|---|---|---|
| Planta do telhado (BIM) | Sem rosa na planta pronta (o rosa `roofFootprint` ficou só no modo de edição). Cortado pelo plano: contorno de corte cheio; acima: só o contorno tracejado de sobreposição na cor da aresta; abaixo: projeção contínua. Água na cor do material, tom pelo sol do 3D, arestas finas, rincão tracejado | `packages/render/src/plan/roofs*.ts` |
| Arco real no telhado | `Roof.edgeSag` por aresta (sem migração). O motor divide a aresta em trechos de até 7,5° só por dentro, antes do esqueleto; o modelo guarda os cantos. Criação e "Editar perímetro" recuperam o arco; alças nos cantos e no meio do arco; espelhar reordena a flecha | `packages/engine/src/roofArcs.ts`, `perimeterRoofArcs.ts`, `roofSagGrip.ts`, `transformPlanar.ts` |
| Mansarda automática | `Roof.mansard { lowerPercent, upperPercent, run }`: duas faixas por água (íngreme junto ao beiral, suave em cima), linha de desnível como aresta fina, validação e painel de Propriedades | `packages/engine/src/roofMansard.ts`, `validateRoofMansard.ts`, `RoofMansardProps.tsx` |
| Seta de inclinação | Funciona com telhado de qualquer forma: converte para águas livres **preservando as águas atuais**, e o clique dentro de uma água a altera. Conversão + água num só passo de desfazer | `packages/tools/src/roofArrowTool.ts`, `roofFreeConvert.ts` |
| Grades de eixos | Elemento novo no modelo do Revit (ver decisão 0035): ferramenta (linha, arco, escolher linhas, multissegmento), bolhas e traço-ponto na planta, tipos, painel, atalho `GR` | `packages/model/src/grid.ts`, `tools/gridTool.ts`, `render/plan/grids.ts`, `ui/Grid*.tsx` |
| Snap | Captura nas grades (pontas, cruzamentos, sobre a linha). **Grade de pontos**: o botão Grade liga desenho e captura juntos; intervalo configurável (Propriedades da vista) | `tools/gridSnapPoints.ts`, `render/plan/grid.ts`, `editor/state.ts` |
| Modos antigos | Removidos `floorMode`, `slabMode`, `ceilingMode` e `roofMode` (opções, seletores, ramos e testes) | `tools/*Tool.ts`, `PlacementProperties.tsx` |
| ViewCube e Alinhar | Rótulos SUPERIOR, INFERIOR, FRONTAL, POSTERIOR, DIREITA, ESQUERDA. Alinhar parede com parede sem vínculo (corrigido: a parede de referência ligada pela ponta não se move mais) | `ui/viewcube.ts`, `tools/alignTool.ts` |
| Exemplo | A casa de alto padrão ganhou o nível **Cobertura** (5,80 m) e o telhado nele: a planta desse nível corta o telhado (planta de cobertura) | `model/templateCasaAltoPadrao.ts` |

## 2. Estado da validação

- `npm run check`: lint 0 erros e 2 avisos antigos, tipos ok, 481 arquivos de teste passando (saída 0).
- e2e verdes: `grades` (novo), `telhados`, `telhados-formas`, `editar-perimetro`, `perimetro-modificar`, `ribbon-compacto`,
  `vcb-compacto`, `viewcube-visual`, `visual-regression` (36 casos, 0,000%, duas execuções seguidas).
- **Referências regravadas neste computador (Windows)**: `tests/e2e/baseline/*.png` e `tests/e2e/out/*.png`. A causa foi
  intencional: a grade de pontos passou a abrir desligada e o telhado ficou sem rosa. As de GPU (`baseline-gpu`) **não** foram
  regravadas (a GPU não roda aqui): `visual-regression-gpu.mjs` vai divergir até alguém regravá-las numa máquina com GPU.
- Capturas conferidas a olho: telhado cortado, acima do corte (só tracejado), 3D, planta de cobertura da casa, grades.

## 3. Pendências (nenhuma bloqueia)

1. **Telhado em L com duas águas e o resto empena**: continua recusado (o esqueleto não fecha). Pedido do dono: tratar depois
   de tudo. O L com todas as águas inclinadas funciona.
2. **Cobertura de testes perdida nos modos antigos** (M1 e M2 listaram; nenhuma está coberta no perímetro): piso "face interna"
   (`walls-finish`); forro: segundo clique no mesmo ambiente não impede um forro duplicado (possível regressão real);
   pé-direito e número do ambiente no forro "No ambiente"; tipo inexistente cai no primeiro tipo; área zero recusada com
   mensagem; aviso "Duas águas: só N aresta(s) paralela(s) à cumeeira" e a forma "uma água" (shed) pela ferramenta antiga.
3. **Sobras dos modos antigos**: `FloorTool`, `SlabTool`, `CeilingTool` e `RoofTool` são cascas só para o registro (`createTool`
   é um switch exaustivo). A opção **Forma** do telhado (`roofShape`) e `floorCore` não são mais lidas por nenhuma criação:
   decidir se saem ou se ligam ao perímetro. `e2e/contorno.mjs` e `forro-ambiente.mjs` ainda montam o vínculo pela API.
4. **Grades**: Girar e Espelhar com grade selecionada (só Mover e Copiar); realce ao passar o mouse; extensão 2D/3D e caixa de
   escopo; cotovelo da bolha; numeração por letra ao editar o nome da primeira.
5. **DXF**: a linha de desnível da mansarda sai como cumeeira; arcos do beiral em facetas de 7,5° (erro ~0,2% do raio).
6. **ViewCube**: o `aria-label`/`title` das faces ainda usa o vocabulário antigo (`FACE_NAME`: "topo", "frente"); só o texto
   visível mudou. Não confirmei os rótulos em português do Revit numa fonte; estão numa constante só (`FACE_LABEL`).
7. **Atalho**: no perfil simples não restavam teclas livres; a Etiqueta passou de `V` para `VT` e a Grade é `VG`.
8. **Seletor "Forma" → Águas livres** ainda usa a conversão simples (uma água); só o botão da barra e a seta preservam as águas.
9. **Mansarda** não foi testada com arco côncavo; `transformPlanar` não ajusta `run` (não há escala hoje).
10. O `sketch.test.ts.snap` aparece modificado só pelo fim de linha (LF para CRLF); não há diferença de conteúdo.

## 4. Como retomar

```bash
git checkout integracao/telhados-grades
npm ci
npm run check
npm run build && node tests/e2e/grades.mjs   # CHROME_PATH no Windows
```

Para publicar: mesclar `integracao/telhados-grades` na `main` e enviar; nada disso foi feito.
