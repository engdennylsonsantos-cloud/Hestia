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

1. ~~Telhado em L com duas águas e o resto empena~~ **Resolvido** na segunda rodada (decisão 0036).
2. **Cobertura de testes perdida nos modos antigos** (M1 e M2 listaram; o forro duplicado foi corrigido na segunda rodada):
   piso "face interna" (`walls-finish`); tipo inexistente cai no primeiro tipo; área zero recusada com mensagem; aviso
   "Duas águas: só N aresta(s) paralela(s) à cumeeira" e a forma "uma água" (shed) pela ferramenta antiga.
3. **Sobras dos modos antigos** (a opção "Forma" da criação já saiu): `FloorTool`, `SlabTool`, `CeilingTool` e `RoofTool` são
   cascas só para o registro (`createTool` é um switch exaustivo); `floorCore` não é mais gravado pela interface;
   `e2e/contorno.mjs` e `forro-ambiente.mjs` ainda montam o vínculo pela API.
4. **Grades**: Girar e Espelhar com grade selecionada (só Mover e Copiar); realce ao passar o mouse; extensão 2D/3D e caixa de
   escopo; cotovelo da bolha; numeração por letra ao editar o nome da primeira.
5. **DXF**: o desnível da mansarda já sai na camada `TELHADO_DESNIVEL`; os arcos do beiral saem em facetas de 7,5° (erro ~0,2% do raio).
6. **ViewCube**: o `aria-label`/`title` já seguem o rótulo visível (segunda rodada). Não confirmei os rótulos em português do Revit numa fonte; estão numa constante só (`FACE_LABEL`).
7. **Atalho**: no perfil simples não restavam teclas livres; a Etiqueta passou de `V` para `VT` e a Grade é `VG`.
8. ~~Seletor "Forma" → Águas livres~~ **Resolvido na segunda rodada.** 
9. **Mansarda** com arco côncavo/convexo agora tem teste (segunda rodada); `transformPlanar` não ajusta `run` (não há escala hoje).
10. O `sketch.test.ts.snap` aparece modificado só pelo fim de linha (LF para CRLF); não há diferença de conteúdo.


## 4. Segunda rodada (mesmo dia): projeção rica, planta de cobertura e telhado em qualquer formato

Quatro agentes Haiku em paralelo (R1 a R4), revisados e mesclados no mesmo ramo; correções minhas por cima.

| Frente | Resumo |
|---|---|
| R1 · Projeção rica | Telhado acima do corte, com "Projeção da cobertura": contorno + cumeeira/espigões/rincões tracejados + empena + desnível + preenchimento leve por água (`roofsProjecao.ts`) |
| R2 · Planta de cobertura | Vista nova no Navegador ("Plantas de cobertura", um item por nível), aba própria (`planKind: 'roof'`), título "Planta de cobertura: <nível>", `roofPlanMode` no quadro incremental, DXF recusado nessa vista com mensagem. e2e `planta-cobertura.mjs` |
| R3 · Qualquer formato | Decisão 0036: telhado plano aceito; L com os dois lados internos sem inclinação aceito; fallback "planos estendidos" (`roofEnvelope.ts`) |
| R4 · Limpezas | Opção "Forma" removida da criação; "Forma → Águas livres" de um telhado existente preserva as águas; forro "Por ambiente" volta a recusar um segundo forro (e usa pé-direito e número do ambiente); nomes de acessibilidade do ViewCube; teste de mansarda em arco |
| Minhas correções | Mansarda só recusa quando a faixa de baixo cobre o telhado inteiro (antes uma água-lasca de faceta de arco recusava arco forte); DXF com a camada `TELHADO_DESNIVEL`; telhado plano sem seta e sem "0,0 %", mensagem "Telhado plano criado"; mais contraste de tom na projeção; ouro do zoom regravado (66 chaves, 22 cenários com telhado projetado); espelhar reordena `edgeSag` |

### Pendências novas (nenhuma bloqueia)

1. **Planta de cobertura:** os telhados dos níveis abaixo só aparecem com a referência de baixo ligada (`build.ts` exige `below` para
   `belowRoofs`); o modo ainda desenha preenchimentos de piso, laje e ambiente (o comentário de `build.ts` diz que não);
   as Propriedades mostram o intervalo de vista, que esse modo ignora; seleção e edição dentro dela **não foram verificadas**;
   pranchas só aceitam planta de piso, e o PDF sem prancha usa a planta de piso do nível; o viewport `roof:<id>` não é liberado ao
   fechar a aba. O nível "Pavimento 2" da casa de exemplo não tem telhado próprio (ele está no nível "Cobertura").
2. **Projeção:** o preenchimento leve é desenhado depois das paredes e antes da grade (ordem de `build.ts`): tinge as paredes
   sob o telhado e a grade fica por cima; corrigir exige mexer na ordem de desenho do `build.ts`.
3. **Fallback de telhado:** não é o esqueleto reto (nos cantos reentrantes o resultado pode diferir do Revit, que não validei
   contra o programa); 64 lados levam ~2 s; `roof-surface-step` só aparece se a envoltória lançar exceção. A caixa de inclinação
   0 % das opções do perímetro continua sendo recusada como entrada (o telhado plano se cria desligando as arestas).
4. **Forro por ambiente:** com o forro seguindo o ambiente, o campo "Deslocamento do nível" da barra é ignorado (vale o
   pé-direito do ambiente).
5. **Atribuição dos commits:** os agentes divergem entre "Claude Sonnet 5.5" e "Claude Haiku 5.5" no `Co-Authored-By`; não normalizei.

## 5. Como retomar

```bash
git checkout integracao/telhados-grades
npm ci
npm run check
npm run build && node tests/e2e/grades.mjs   # CHROME_PATH no Windows
```

Para publicar: mesclar `integracao/telhados-grades` na `main` e enviar; nada disso foi feito.
