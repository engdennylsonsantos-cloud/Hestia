# R3 — picking, seleção e realce na GPU (Fase 2.4)

- **Data:** 2026-10-26
- **Squad:** 2 — 3D GPU (Fase 2)
- **Worktree:** `...\.local\share\opencode\worktree\8fed4c\gpu-r3-picking`
- **Ramo:** `gpu/r3-picking` (commit local; sem push)
- **Base:** `1914fa0` (R1 integrado)
- **Plano:** `plano-subagentes-2026-10-26.md` (v3) §4/Fase 2.4 e brief R3
- **Fora do escopo (por brief):** culling/LOD/sombras/precisão (R2), clipping (R4), planta (R5),
  `packages/render/src/model3d/scene3d.ts`, `packages/render/src/gpu/*`, `apps/web/*`, `plan/*`.

## 1. Resultado

O realce deixou de **copiar triângulos** e o picking ganhou o caminho de **ID buffer** (MRT + leitura assíncrona) pronto
para ser ligado pelo integrador, com o BVH intacto como fallback. O que já está no caminho quente do app — o realce —
saiu de **~6,6 ms por hover** para **~0,74 ms**, e a seleção de um pavimento inteiro (144 elementos) de **~182 ms** para
**~2,9 ms**, sem mudar o resultado do picking (checksum idêntico) nem a caixa da seleção (erro 0 m).

| Medida (60 pav × 128 paredes) | Antes | Depois | Ganho |
|---|---:|---:|---:|
| Realce de 1 elemento (hover) | **6,588 ms** | **0,743 ms** | 8,9× |
| Realce de 8 elementos | 15,119 ms | **1,223 ms** | 12,4× |
| Realce do pavimento inteiro (144 elementos) | **181,981 ms** | **2,866 ms** | 63,5× |
| Realce do mesmo elemento de novo | 6,588 ms | **0,646 ms** | 10,2× |
| Caixa da seleção (144 elementos) | 5,579 ms | **2,203 ms** | 2,5× |
| `pickElement` (BVH) | 1,233 ms | **1,233 ms** | igual |
| `pickModelPoint` (BVH) | 0,802 ms | **0,802 ms** | igual |
| Triângulos copiados por hover/seleção | O(triângulos do elemento) | **0** | — |

| Medida (30 pav × 256 paredes) | Antes | Depois | Ganho |
|---|---:|---:|---:|
| Realce de 1 elemento (hover) | 6,375 ms | **0,391 ms** | 16,3× |
| Realce de 8 elementos | 10,289 ms | **0,543 ms** | 19,0× |
| Realce do pavimento inteiro (288 elementos) | **410,003 ms** | **2,700 ms** | 152× |
| Caixa da seleção (288 elementos) | 7,797 ms | **1,664 ms** | 4,7× |
| `pickElement` (BVH) | 0,938 ms | **0,938 ms** | igual |

Leituras:

- **Meta de hover/seleção (≤8 ms):** cumprida. Hover 0,39–0,74 ms; seleção de um elemento idem; seleção de um
  pavimento inteiro 2,7–2,9 ms. Nenhum caso de uso corrente passa de 8 ms.
- **Zero cópia de triângulos:** o preenchimento reusa a **mesma instância** de `position` e de `index` da geometria do
  modelo e recorta por `drawRange`; as arestas usam uma *view* do índice e ficam em cache por versão da geometria. Os
  testes provam a identidade dos atributos (`highlight3d.test.ts` e `instanciada3d.test.ts`).
- **Resultado idêntico:** o checksum do picking foi **12341,752786** (60×128) e **20690,552080** (30×256) nas três
  execuções, antes e depois; a caixa da seleção deu erro **0,00e+0 m**. Os testes de igualdade de picking
  (`elementPick.test.ts`, `instanciada3d.test.ts`, grade de 40×40 raios) continuam verdes.
- **Custo de desenho do realce:** 10 objetos para um elemento (5 intervalos × preenchimento/arestas) e **14 objetos para
  o pavimento inteiro** — as faixas contíguas de um lote global são fundidas em um intervalo por lote. Com 14 draw calls
  da cena, um hover fica em ~24 e uma seleção de pavimento em ~28 (teto de 500).
- **Primeiro hover de um elemento (cache frio):** mediana **2,2 ms**, p95 6,9 ms. Os picos de 40–340 ms no laço de
  8.761 elementos são **pausas de GC** (os ids “mais caros” mudam de execução para execução; a segunda passada, com o
  cache quente, cai para mediana 0,69 ms / p95 1,2 ms). Antes, esse mesmo custo era pago **em cada** hover.

## 2. O que mudou

### Alterados (`packages/render/src/model3d/`)

| Arquivo | Mudança |
|---|---|
| `highlight3d.ts` | Reescrito: a sobreposição deixou de copiar posições. Preenchimento = `BufferGeometry` com o `position`/`index` do modelo e `drawRange` do intervalo; arestas = `EdgesGeometry` do intervalo (view do índice), em cache por versão; materiais em cache por estilo. `disposeHighlight` não libera mais buffer de outro dono. |
| `selecao3d.ts` | A caixa passa a vir do **intervalo do índice** (cache por versão), não da varredura de triângulos. Resultado igual (erro 0 m). |
| `realceDaCena3d.ts` | A comparação de “mudou?” deixou de montar a string de todos os ids a cada quadro: referência do array + comparação elemento a elemento. Seleção de 656 ids não gera mais 8 KB de texto por quadro. |
| `pick3d.ts` | `pickElement`/`pickModelPoint` aceitam um `LeitorDeIdsGpu` opcional (4º argumento). Com ele: resultado lido na GPU vale primeiro, pixel novo é pedido assíncrono e o BVH responde no intervalo. Sem ele, tudo como antes. `firstSurfaceDistance` (zoom) continua no BVH. |
| `elementPick.test.ts`, `instanciada3d.test.ts`, `highlight3d.test.ts` | Ajuste das contagens de objetos de sobreposição (agora 1 por intervalo, não 1 por seleção) e novas provas de cópia zero, cache e liberação. |

### Novos (`packages/render/src/model3d/`)

| Arquivo | Papel |
|---|---|
| `indiceDeElementos3d.ts` | Índice `id → faixas` por lista de faixas (WeakMap) e caixa por intervalo do índice, com invalidação por `geometry.userData.versao` (o contador do R1). Base comum do realce, da seleção e do ID buffer. |
| `pickIdBuffer3d.ts` | ID buffer: `TabelaDeIds` (código 0 = vazio, 24 bits), geometria de IDs (position/index compartilhados + `aId` por vértice), material GLSL3 com dois anexos (código + distância linear), alvo MRT 1×1, câmera de recorte por `setViewOffset`, leitura assíncrona (`readRenderTargetPixelsAsync`, `textureIndex` 0 e 1), ponto por `origem + dir·t`, cache por pixel/câmera e uma leitura em voo por vez. |
| `pickIdBuffer3d.test.ts` | 12 testes: tabela, empacotamento 24 bits, geometria compartilhada, invalidação por versão, orquestração do passe (dublê de renderizador), cache por câmera, restauração da cor de limpeza, uso pelo `pickElement` e igualdade com o BVH quando a leitura não chegou. |

## 3. Por que o ID buffer ainda não está ligado no app

O brief proíbe tocar em `scene3d.ts` e em `apps/web`. O `pickElement` é chamado em `ViewportCanvas.tsx` com
`(scene, camera, ndc)` e não há renderizador acessível a partir da cena; para o passe de IDs é preciso o
`WebGLRenderer`. O módulo já está pronto e testado, com assinatura compatível: **o encaixe é uma linha em cada arquivo**,
para o integrador:

```ts
// ViewportCanvas.tsx (uma vez, quando o renderizador existe)
const picker = new PickGpu3d({ renderer: g.gpu.renderer, raiz: model.current.scene });
picker.redimensionar(w * dpr, h * dpr);           // junto do g.gpu.setSize
picker.aoResolver = () => useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
// quando o projeto muda (montagem3dProgressiva / store.version):
picker.invalidar();

// e nas chamadas de picking (elementAt3d / pick3dAt):
return pickElement(model.current.scene, model.current.orbit.camera, ndc, picker);
return pickModelPoint(model.current.scene, model.current.orbit.camera, ndc, picker);
```

Índice de exportação (também fora do escopo do R3, em `packages/render/src/index.ts`):

```ts
export { PickGpu3d, TabelaDeIds, geometriaDeId, type OpcoesPickGpu } from './model3d/pickIdBuffer3d.ts';
```

Observações para o integrador:

- **Não** passar `model`, e sim a **cena**: no estilo arames as malhas de picking vivem fora do grupo do modelo
  (`pickLayer`), e o filtro do passe é `userData.ranges` — chão, grade, arestas, realce e `InstancedMesh` ficam de fora.
- O passe desenha o modelo inteiro num alvo de 1×1 (custo de vértice de um quadro; sem custo de fragmento). Ele entra
  nos contadores de draw calls/triângulos do `?perf=1`; se incomodar, ler `renderer.info` antes/depois do passe e
  subtrair (o módulo não mexe nos contadores).
- O ponto vem do buffer de distância e é o **centro do pixel** (até ½ pixel de diferença do `ndc` exato); o id é exato.
  O teste do ID buffer cobre essa tolerância.
- Enquanto a leitura não chega, `pickElement` devolve o BVH: o comportamento visível não muda, e a primeira visita a um
  pixel paga o BVH uma vez.
- O BVH continua montado por geometria (uma vez por versão) porque `firstSurfaceDistance` (zoom contra paredes) e o
  fallback dependem dele.

## 4. Validação (L1)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ❌ **8 erros pré-existentes**, nenhum nos arquivos do R3: `packages/engine/src/resolve.ts` (1), `packages/render/src/plan/overlay.ts` (3), `packages/render/src/section/build.ts` (1), `section/build.test.ts` (2), `section/pick.test.ts` (1). Esses arquivos estão **sem modificação** nesta árvore (`git diff` vazio); a falha vem da base. Nenhum erro em `packages/render/src/model3d`. |
| `npx vitest run packages/render/src/model3d` | ⚠️ **36 arquivos / 548 testes: 547 passam, 1 falha pré-existente** (`openingParts.test.ts` espera 14 tipos padrão de abertura e encontra 23 — é uma constante de `@hestia/model`, arquivo intocado). Todos os testes de picking, realce, seleção e cena passam. |
| `npx eslint` dos arquivos tocados | ✅ sem erro |
| Verificação visual A2, item `3d` | ✅ **6 PASS, 0 FAIL** — inclui “seleção 3D realça a parede: 44.686 px alterados, 42.134 azuis” |
| Medição antes/depois | ✅ 3 execuções (60×128 e 30×256), tabelas da seção 1 |

Método da medição (Node, CPU, sem GPU): `npx vite-node scripts/r3-bench.mts` (roteiro **temporário, não versionado**, como
no R1). Mesma cena (`syntheticProject(60,128)` / `(30,256)` + `ModelScene.update`), 40 amostras por caso depois de 5 de
aquecimento, mediana; o “antes” é uma cópia literal do realce/caixa de `HEAD` no mesmo processo e na mesma cena
(`scripts/r3-antes.mts`), para não comparar máquinas nem builds. Chrome 155 na A2 (SwiftShader para o item visual). O
checksum do picking é a soma dos pontos de 64 raios em rodízio.

## 5. Riscos e o que ficou fora

- **ID buffer não ligado:** o caminho existe, compila e está testado com dublê, mas **não roda no app** até o integrador
  passar o `picker`. Nenhum número de GPU (leitura de pixel, latência assíncrona) foi medido em hardware; o ganho medido
  aqui é o do realce e da caixa, que já estão no caminho quente.
- **Primeiro hover de um elemento grande:** a primeira vez que um piso/laje/telhado é realçado paga o `EdgesGeometry` do
  elemento (3–40 ms uma vez por versão da geometria). É o mesmo trabalho que antes era pago em cada hover; se o H1 exigir,
  o próximo passo é extrair as arestas duras com hash numérico (sem as strings do `EdgesGeometry` do three).
- **Arestas de uma seleção que cruza malhas:** as arestas são calculadas por intervalo da mesma malha; arestas
  coincidentes de elementos em malhas diferentes podem ser desenhadas duas vezes (a opacidade 0,6 muda o tom no
  cruzamento). No hover de um elemento não há diferença; o item visual da A2 passou.
- **Bordas de seleção entre elementos adjacentes:** como as arestas são por elemento, o contorno entre dois elementos
  vizinhos selecionados aparece (o caminho antigo podia fundi-lo). É o comportamento de Revit/Archicad e o que o teste
  visual aceitou; fica registrado como diferença deliberada.
- **`updateMatrixWorld(true)` por realce:** continua sendo chamado (comportamento antigo); custa ~0,2 ms em 60 andares.
  O R2 pode avisar a cena de que as matrizes estão em dia.
- **Testes de contagem de objetos** em `elementPick.test.ts`/`instanciada3d.test.ts` foram relaxados de “1 por seleção”
  para “≥1 por seleção, todos apontando para buffers do modelo”. A igualdade que importa (picking, categoria, ponto,
  caixa, aparecer) continua verificada.
- **Pré-existentes da base:** `npm run typecheck` e `openingParts.test.ts` já falhavam antes deste ramo (arquivos
  intocados). Não corrigi para não sair do escopo — o gate da fase precisa decidir de quem são (`packages/engine` e
  `plan/section`).

## 6. Próximo passo

1. Integrador: ligar o `picker` nas duas chamadas de `ViewportCanvas.tsx` e exportar `pickIdBuffer3d.ts` no
   `index.ts`; medir a latência de leitura na GPU real (RX 580) e comparar o id/ponto com o BVH num roteiro de 200
   cliques.
2. R2: culling/LOD pode usar `indiceDeElementos3d.ts` (caixas por intervalo) para não varrer triângulos.
3. H1: medir o primeiro hover dos elementos grandes e decidir se vale a extração de arestas com hash numérico; rodar a
   matriz de GPU e o soak.
