# RELATÓRIO · FR2 · 3D, corte/elevação e prévia para peças com seção e acabamento

Data: 2026-10-26. Branch: `feat/esq-FR2`.

## O que foi feito

### 1. 3D: peça com `profile`

- `OpeningPiece` agora carrega `profile?` e `group?`, copiados da peça do modelo único (`packages/render/src/model3d/openingParts.ts`).
- Novo módulo `geometriaPeca3d.ts`: peça com `profile` vira UM prisma `THREE.ExtrudeGeometry` de uma `Shape` com os pontos da seção:
  - `plane 'ts'` (ombreira): `(t, s)` extrudado em `z`, de `box.z0` a `box.z1`;
  - `plane 'sz'` (travessa): `(s, z)` extrudado em `t`, de `box.t0` a `box.t1`;
  - o contorno é normalizado para anti-horário (os espelhamentos do modelo podem chegar no sentido oposto);
  - sem `profile`, a peça continua sendo a `BoxGeometry` de antes.
- `montarAbertura` e o caminho instanciado compartilham o mesmo adaptador (`pecasDoModelo`) e as mesmas geometrias. Para os testes com o modelo-fixture, os caminhos podem ser chamados diretamente por `montarAberturaDoModelo` e `caixasEPrismasDoModelo`.
- O caminho instanciado ganhou o canal `prismas: Array<{ materialId; geometry }>` junto de `caixas` (`caixasEPrismasDaAbertura`); `caixasDaAbertura` continua devolvendo só as caixas (compatibilidade). A cena desenha os prismas como lotes de geometria, com o mesmo id/categoria para picking e realce.
- `loteDeGeometria` aceita geometria não indexada (a extrusão é não indexada), sem mudar o comportamento das caixas.

### 2. Alizar / peças com `group`

- As caixas de um mesmo `group` continuam desenhadas individualmente nas faces (peças encostadas, mesmo material), mas as arestas saem da **silhueta unida** do grupo.
- Novo módulo `silhuetaCaixas3d.ts`: união de caixas alinhadas por grade de coordenadas, cancelamento das arestas internas de cada face plana e junção dos trechos colineares. O caminho instanciado aceita o giro comum do vão; o caminho de montagem usa as caixas locais do vão.
- `SolidBatch.group` marca os lotes de um grupo para que `desenharLotes` não calcule arestas por peça; as arestas do grupo são desenhadas à parte (`AberturaMontada.arestasGrupos` / `CaixasDoNivel.adicionarArestas`).

### 3. Corte e elevação

- Novo `packages/render/src/section/perfis.ts` (`projetarComPerfis`): troca o anel da caixa pelo anel real da seção quando a peça tem `profile`:
  - corte transversal (`axis 't'`) de uma travessa `'sz'`: o próprio L de 6 vértices em `(s, z)`; a ombreira `'ts'` continua como o retângulo da projeção ao longo de `t`;
  - elevação (`axis 's'`): retângulo envolvente (projeção ao longo de `s`).
- `buildSectionDrawList` usa esse projetor e passou a agrupar as peças do mesmo `group` antes de pintar: preenchimento/hachura e contorno são a união dos polígonos de uma peça física (um contorno por peça; uma janela com furo tem o anel externo e o interno). A peça única com `profile` é preenchida/hachurada com o material do batente.
- A ordem de pintura por profundidade e corte foi mantida; peças sem `profile`/`group` desenham exatamente como antes.

### 4. Prévia do diálogo

- A prévia já monta `ModelScene({ instanciar: false })`, que é o caminho de `montarAbertura`. Foi acrescentado um teste que prova que a prévia não usa `InstancedMesh` e que o número de faixas de peça da porta é exatamente o número de peças do `buildOpeningModel`.

## Arquivos tocados

Render 3D:
- `packages/render/src/model3d/openingParts.ts`
- `packages/render/src/model3d/geometriaPeca3d.ts` (novo)
- `packages/render/src/model3d/silhuetaCaixas3d.ts` (novo)
- `packages/render/src/model3d/aberturas3d.ts`
- `packages/render/src/model3d/lotesMalha3d.ts`
- `packages/render/src/model3d/solids.ts`
- `packages/render/src/model3d/scene3d.ts`
- `packages/render/src/model3d/fixturePerfil.ts` (novo, fixture de teste)
- `packages/render/src/model3d/openingPiecesPerfil.test.ts` (novo)

Render seção:
- `packages/render/src/section/perfis.ts` (novo)
- `packages/render/src/section/build.ts`
- `packages/render/src/section/perfis.test.ts` (novo)

Prévia:
- `apps/web/src/ui/dialogs/openingType/previewScene.test.ts` (só teste; a implementação não precisou mudar)

Relatório:
- `RELATORIO.md` (raiz)

## Testes

- `npx vitest run packages/render/src/model3d/openingPiecesPerfil.test.ts packages/render/src/section/perfis.test.ts` → 18 testes verdes.
- `npx vitest run packages/render apps/web/src/ui --exclude "**/property.test.ts" --exclude "**/*perf.test.ts"` → 123 arquivos, 1477 testes verdes (2026-10-26). Os testes de propriedade lentos foram omitidos conforme `prompts/COMMON.md`.
- `npx tsc -p tsconfig.json --noEmit` → limpo.
- `node scripts/check-boundaries.mjs` → `fronteiras ok`.

Cobertura dos critérios de aceitação:
- fixture com ombreiras `'ts'` e travessa `'sz'`: 2 `OpeningPiece` com `profile` de 6 pontos por ombreira, 1 travessa com 6 pontos, nenhum `stop` — `openingPiecesPerfil.test.ts`.
- volume do prisma da ombreira = área do L × altura e caixa envolvente = `box` do modelo — idem (ver divergência de precisão abaixo).
- equivalência `montarAbertura` × `caixasDaAbertura` + prismas por volume total e centro de massa, fechado e aberto — idem.
- arestas do grupo de 3 caixas do alizar = silhueta unida (24 arestas; 36 se soltas), inclusive com o grupo girado — idem.
- corte transversal da porta-fixture: anel da travessa com 6 vértices e hachura `diagonal` do `mat_madeira`; ombreira como retângulo `D × H`; elevação sem o anel de 6 — `perfis.test.ts`.
- alizar no mesmo `group` na elevação: uma união em U (8 vértices), sem as duas barras soltas — `perfis.test.ts`.
- prévia no caminho de montagem e com as mesmas peças do modelo — `previewScene.test.ts`.
- peças sem `profile`/`group`: todos os testes existentes de 3D e corte continuam verdes sem alteração de expectativa.

## Decisões tomadas

- **Prismas por canal à parte** no caminho instanciado (`prismas` junto de `caixas`), como previsto na tarefa: `InstancedMesh` só aceita a caixa unitária.
- **Silhueta por união de caixas na grade de coordenadas**: as peças do alizar são caixas alinhadas no referencial do grupo; a solução não depende de CSG nem de biblioteca nova.
- **`projetarComPerfis` no render** em vez de alterar `projectParts` no motor: a tarefa proíbe tocar `packages/engine` e o motor de FR1 ainda não está integrado. Quando FR1 mesclar, a vista continua usando o wrapper; não há recálculo de posição de batente na vista.
- **Volume/tolerância**: a `ExtrudeGeometry` guarda as posições em `float32` (precisão da GPU). O teste de volume leva cada vértice ao canto exato do perfil em precisão dupla antes de medir (e verifica que o desvio do snap é < 1e-6 m), provando o volume analítico `área × altura` com tolerância 1e-9. A equivalência entre caminhos usa 1e-9 para volume e 1e-6 m para centro (as duas cadeias transformam a mesma geometria float32 por ordens diferentes).

## Divergências da spec e pendências honestas

1. **`projectParts` do motor não foi alterado** (`packages/engine` fora do escopo). Hoje quem aplica o perfil é `projetarComPerfis` no render. Se FR1 preferir que o engine devolva os anéis do perfil, o wrapper pode virar uma delegacia sem mudar `build.ts` nem os testes de aceitação.
2. **Precisão float32**: a caixa envolvente da geometria coincide com a `box` na precisão do `Float32BufferAttribute` (teste compara com `Math.fround` a 1e-9). Não é possível guardar posições em dupla precisão sem sair do `ExtrudeGeometry`/GPU.
3. **Testes existentes que vão precisar de revisão quando FR1 mesclar** (hoje verdes porque o motor ainda não emite `profile`/`group`):
   - `openingParts.test.ts` conta 11 peças e 3 `stop` no `ot_p80`; com o batente em peça única os `stop` desaparecem.
   - `build.test.ts` conta 8 contornos a mais no alizar de uma janela; com `group`, cada face vira uma peça física (2 anéis: externo e furo), então a expectativa muda.
   - O teste condicional de `openingPiecesPerfil.test.ts` passa a comparar `profile` e posição com o `buildOpeningModel` real.
4. **Silhueta de grupo com `profile`**: o caminho de montagem só calcula silhueta de grupo para caixas; um grupo formado por prismas com seção não é unido (não existe caso hoje: o alizar é de caixas). O caminho instanciado também não devolve `group` nos prismas.
5. **Alizar de duas faces**: a união é por `group` (uma face por grupo, como na spec). As duas faces continuam sendo duas unidades distintas, como devem.
6. O `RELATORIO.md` fica na raiz, fora dos pacotes.
