# Tarefa (T7 · Fase 1, parte A-I) — contorno pelo núcleo: modelo, faces e perímetro

Repositório: `<raiz-do-repositorio>` (monorepo TypeScript, vitest). Código e comentários em
**português**. Arquivos ≤ 420 linhas. Sem dependências novas. Sem `console.log`. Imports internos com extensão `.ts`.

Nesta parte **não** se mexe em `layerOutline.ts`, `junctionPlanar.ts`, `junctionLevel.ts`, `junctionNet.ts`,
`wallJunction.ts`, `floors.ts`, `slabs.ts`, nem em `packages/tools` ou `apps/`. É só a base: campo novo do modelo,
contorno do núcleo por parede e perímetro no núcleo.

Leia antes: `packages/model/src/types.ts` (interface `OutlineSource`), `packages/engine/src/faces.ts`,
`packages/engine/src/enclosed.ts` (funções `coreSilhouette`, `outlinePieces`, `buildingOutlines`, `outerPerimeter`,
cache `perimeterCache`), `packages/engine/src/outlineBound.ts`, `packages/engine/src/frame.ts` (`sAtDepth`) e
`packages/engine/src/layerGeom.ts` (`layerQuad`).

## 1. `packages/model/src/types.ts` — campo aditivo em `OutlineSource`

Acrescentar, em `OutlineSource` (opcional, sem mexer em `SCHEMA_VERSION`, sem migração):

```ts
  /**
   * Para onde vai o contorno quando `mode === 'perimeter'`: `'finish'` (padrão, ausente) na face externa de
   * acabamento da edificação; `'core'` na face externa do NÚCLEO das paredes (o "Extend into wall (to core)" do
   * Revit), deixando o acabamento externo fora do contorno. Ignorado nos modos `walls-finish`/`walls-core`, que já
   * dizem o lado. Decisão 0026 (T7).
   */
  extend?: 'finish' | 'core';
```

## 2. `packages/engine/src/faces.ts` — `coreOutline` em `WallFaces`

- Em `WallFaces`, acrescentar o campo, documentado em português:
  `/** Contorno real só da faixa do NÚCLEO (primeira à última camada de estrutura), mesma construção do `outline`. */`
  `coreOutline: Vec2[];`
- Em `wallFaces`, construir com a mesma chamada do `outline`: hoje é
  `const outline = layerQuad(f, e, f.sLo, f.sHi);`. Para o núcleo, usar as profundidades do núcleo já calculadas
  (`const cs = coreSpan(f.type);` e `const sCore = [sAtDepth(f, cs.from), sAtDepth(f, cs.to)];` já existem no arquivo),
  ou seja `layerQuad(f, e, sCore[0]!, sCore[1]!)`. Não mude o `outline` nem o `core` (arestas de snap).
- Parede curva segue a mesma construção (é o próprio `layerQuad` que trata o arco) — não acrescente caso especial.

## 3. `packages/engine/src/enclosed.ts` — perímetro no núcleo

- `outlinePieces(p, levelId, frames, extend: RoomExtend)` passa a escolher a fonte do contorno de cada parede:
  para `extend === 'core'` o `coreOutline` de `wallFaces` e, quando faltar a parede no mapa, `coreSilhouette(f)`
  (a função já existe no arquivo); para `'finish'`, o `outline` e, faltando, `bandRing(f, f.sHi, f.sLo)` — exatamente o
  que o código faz hoje.
- `buildingOutlines(p, levelId, extend: RoomExtend = 'finish')`: chave do cache passa a ser `` `${levelId}|${extend}` ``
  (o `sig` continua o de `wallsSignature`). O comentário do cache deve dizer que a chave é nível + extensão, para o
  contorno de acabamento e o do núcleo não se reaproveitarem.
- `outerPerimeter(p, levelId, near?: Vec2, extend: RoomExtend = 'finish')`: repassa `extend` para `buildingOutlines`.
  Atualize o comentário da função: `'finish'` = face externa do acabamento; `'core'` = face externa do núcleo.
- `RoomExtend` já existe (`'finish' | 'core'`) — reutilize, não crie tipo novo.

## 4. `packages/engine/src/outlineBound.ts` — repassar o `extend` no modo perímetro

No ramo `src.mode === 'perimeter'` de `resolveBoundary`, a chamada vira
`outerPerimeter(p, levelId, src.seed, src.extend === 'core' ? 'core' : 'finish')`.
Nada mais muda nesse arquivo (os modos `walls-finish`/`walls-core` continuam como estão).

## 5. Teste novo `packages/engine/src/perimeterCore.test.ts`

Teste do perímetro e do cache, com valores calculados à mão. Base do cenário (parede de 0,20 m simétrica):
`PAREDE = [finish1 0,02 | structure 0,16 | finish1 0,02]`, núcleo de 0,02 a 0,18 m da face externa.
Quatro paredes fechando um retângulo de **4 × 3 m** no nível `lv_0`, juntas `miter` nas duas pontas de cada parede
(`joinStart: { kind: 'miter', flip: false }`, idem `joinEnd`), **todas com `locationLine: 'coreExterior'`** — assim a
face externa do núcleo cai exatamente no eixo e o retângulo do núcleo é 4 × 3 m, independente do acabamento.

Com `locationLine: 'coreExterior'` e essa parede:
- eixo (retângulo do núcleo): **área 12,0 m²** (4 × 3);
- face externa de acabamento: a 0,02 m FORA do eixo → retângulo 4,04 × 3,04 → **área 12,2816 m²**;
- face interna: a 0,18 m (0,16 do núcleo + 0,02 do acabamento interno) PARA DENTRO do eixo → retângulo
  3,64 × 2,64 → **área 9,6096 m²**.

Casos (mongem o projeto com `ProjectStore`, `makeWall`, como em `packages/engine/src/layerOutline.test.ts`):

1. **Perímetro de acabamento (padrão)**: `outerPerimeter(p, 'lv_0')` → área ≈ 12,2816; e
   `outerPerimeter(p, 'lv_0', undefined, 'finish')` dá o mesmo anel.
2. **Perímetro do núcleo**: `outerPerimeter(p, 'lv_0', undefined, 'core')` → área ≈ 12,0. Os dois anéis têm de ser
   diferentes (o do núcleo fica 0,02 m para dentro em cada lado): compare as áreas, não a identidade.
3. **Cache por nível + extensão**: chamar `'finish'` e depois `'core'` (e de novo na ordem inversa, em outro projeto)
   devolve sempre 12,2816 e 12,0 — um não reaproveita o resultado do outro.
4. **Semente fora da edificação**: `outerPerimeter(p, 'lv_0', { x: 100, y: 100 }, 'core')` → `null`; com a semente
   dentro, devolve o anel do núcleo.
5. **`resolveBoundary` repassa o `extend`**: cria uma **laje** (`makeSlab`, tipo `ls_mac12` do projeto padrão, camada
   única de estrutura) no nível `lv_0` com
   `outlineSource: { mode: 'perimeter', seed: { x: 2, y: 1.5 }, linked: true, extend: 'core' }` → o polígono devolvido
   por `resolveBoundary(p, 'lv_0', laje)` tem área ≈ 12,0, `problem` nulo. No mesmo projeto, uma segunda laje com
   `extend: 'finish'` → área ≈ 12,2816. E uma laje `mode: 'perimeter'` **sem** `extend` → 12,2816 (ausente vale
   `'finish'`).

Use `multiArea`/`ringArea` de `@hestia/geom` (confira qual já é usado nos testes do pacote) e `toBeCloseTo(esperado, 6)`.
Títulos em português descrevendo o comportamento, com um comentário curto em cada caso dizendo a conta feita a mão.

## Proibições

- Mexer **somente** em `packages/model/src/types.ts`, `packages/engine/src/faces.ts`, `packages/engine/src/enclosed.ts`,
  `packages/engine/src/outlineBound.ts` e no novo `packages/engine/src/perimeterCore.test.ts`.
- Não editar `package.json`, `docs/`, `packages/tools`, `apps/`, `packages/render`.
- Não rodar `npm install`, `git checkout`, `git reset`, `git push`; não criar commit.

## Verificação antes de responder

Na raiz do repositório (baseline: tudo verde antes da tarefa):

```
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/engine packages/model
```

Se algum teste antigo quebrar, é sinal de que o padrão `'finish'` deixou de ser o comportamento atual: conserte.

## Resposta final

Em português, curto: (a) o que mudou em cada arquivo (com os trechos principais), (b) saída resumida de `tsc` e do
`vitest run packages/engine packages/model`, (c) qualquer desvio do que foi pedido.
