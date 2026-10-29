# Tarefa FR2 · 3D e corte para peças com seção (batente em peça única) e acabamento

Outro agente (FR1) está trocando, **no motor** (`packages/engine`), o batente de "duas caixas por ombreira" por **uma peça com seção** (`OpeningPart.profile`, tipo `PartProfile` em `packages/engine/src/openingModelTypes.ts`), e `group` para peças físicas unidas (alizar). Você cuida do lado **render**: 3D, corte e elevação, e da prévia do diálogo. Leia: spec E3 §2 e §4 (`docs/aberturas/E3-spec-correcoes-v3.md`), `packages/engine/src/openingModelTypes.ts`, `packages/render/src/model3d/openingParts.ts`, `aberturas3d.ts`, `malhasInstanciadas3d.ts`, `lotesMalha3d.ts`, `caixas3d.ts`, `scene3d.ts`, `packages/render/src/section/build.ts`, `apps/web/src/ui/dialogs/openingType/previewScene.ts`.

Como o motor de FR1 ainda não está integrado, **construa fixtures à mão** nos testes: um `OpeningModel` com ombreiras `profile 'ts'` em L e travessa `'sz'` em L (as mesmas dimensões da spec E3 §2 para `ot_p90`), e valide o seu código contra elas. Depois que FR1 for mesclada, os mesmos testes valem com o modelo real.

## Arquivos permitidos
`packages/render/src/model3d/*` (adaptador `openingPieces`, `montarAbertura`, `caixasDaAbertura`, caminho instanciado, testes), `packages/render/src/section/*` (+ testes), `apps/web/src/ui/dialogs/openingType/*` (só o que for preciso para a prévia 3D usar o mesmo caminho). Não toque em `packages/engine` nem em `packages/model`.

## O que fazer
1. **3D**: `OpeningPiece` ganha `profile?` e `group?` (copiados da peça do modelo). Peças com `profile` viram **geometria extrudada** (`THREE.ExtrudeGeometry` de uma `Shape` com os pontos do perfil, orientada e posicionada pela caixa envolvente: `'ts'` extrudada em z, `'sz'` extrudada em t), **uma malha por peça**, sem arestas internas. Os dois caminhos (`montarAbertura` e `caixasDaAbertura`/instanciado) têm de dar o mesmo resultado; se o caminho instanciado só aceita caixas unitárias, devolva os prismas por um canal à parte (por exemplo `prismas: Array<{ materialId; geometry }>` junto de `caixas`) e desenhe-os junto. Mantenha o agrupamento por material onde for possível.
2. **Alizar e peças com `group`**: no 3D basta desenhar cada caixa (são peças encostadas, do mesmo material); nas arestas do modo "linhas", **não desenhe a aresta compartilhada** entre caixas do mesmo `group` (mescle os vértices do grupo antes de calcular arestas, ou gere a silhueta do grupo). Teste: o número de arestas do grupo de 3 caixas do alizar é o da silhueta unida (sem as arestas internas).
3. **Corte e elevação** (`render/section/build.ts`): `projectParts` passa a devolver, para peças com `profile`, anéis que são o polígono do perfil (no corte transversal) ou o retângulo (elevação). Garanta que o desenho usa os anéis devolvidos tal qual (sem assumir retângulo) e que o hachurado do corte aplica o material à peça única, com **um** contorno por peça física (peças do mesmo `group` unidas).
4. **Prévia do diálogo**: confirme que o projeto de prévia 3D usa o mesmo caminho e mostra o batente em peça única.

## Critérios de aceitação (testes)
- `openingPieces` de um modelo-fixture com ombreira em L: uma `OpeningPiece` com `profile` (6 pontos) por ombreira; a travessa idem; nenhuma peça extra "batedor".
- A geometria extrudada de uma ombreira em L tem volume = área do L × altura (tolerância 1e-9), e seu `boundingBox` coincide com a `box` do modelo; a posição bate com `buildOpeningModel` quando o motor de FR1 estiver integrado (deixe o teste preparado com `it.todo` ou condicional se `profile` ausente).
- `montarAbertura` e `caixasDaAbertura` (mais prismas) produzem o mesmo conjunto de volumes e posições (teste de equivalência por centro de massa e volume total).
- Modo linhas: arestas internas entre caixas do mesmo `group` não aparecem (teste da contagem de arestas).
- Corte transversal da porta-fixture: o anel da travessa em L aparece com 6 vértices e a hachura do material do batente; a ombreira aparece como retângulo (projeção ao longo de t).
- Peças sem `profile` continuam idênticas ao comportamento atual (testes existentes de 3D e corte verdes sem alteração, ou alterados só quando comprovadamente por causa do batente em L; liste).
- `tsc`, `check-boundaries` limpos; `npx vitest run packages/render apps/web/src/ui` verde.
