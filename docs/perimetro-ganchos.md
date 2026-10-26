# Perímetro: ganchos pendentes (vínculo às paredes, forro no ambiente, arcos)

Estado: a lógica está pronta e testada nos arquivos do pacote `packages/tools` e da interface da galeria. Falta ligar
quatro pontos de arquivos que não são deste trabalho (`perimeterTool.ts`, `perimeterView.ts`, `perimeterMode.ts`). Sem eles,
o vínculo às paredes e o forro "Por ambiente" não chegam ao comando: a opção aparece na barra, mas Concluir grava sem a origem.
O `npm run typecheck` acusa só um erro, em `apps/web/src/editor/perimeterView.ts` (item 2 abaixo), até o gancho entrar.

## O que já está pronto

- `perimeterArcFit.ts`: `fitRing(ring, flags)` recupera arcos do anel (3 ou mais lados sobre um círculo, erro ≤ 3 mm,
  varredura ≤ 180° por arco, flags iguais). Usado por `editDraft` (`perimeterSession.ts`), então vale para telhado,
  piso, laje e forro na edição.
- `perimeterSession.ts`: tipo `SketchOrigin { walls?, roomId? }`.
- `perimeterCommit*.ts`: `linkToWalls` e `followRoom` nas opções; `origin` no `CommitPerimeterOptions`; vínculo às
  paredes (origem `perimeter`, semente no lado maior, contorno das paredes) e forro com `roomId` (`relinkCeilingRoom`
  ao editar). `perimeterOptionsOf` lê `linkToWalls` (piso/laje) e `followRoom` (forro) do elemento.
- `sketchPickRoom.ts`: `roomAt(ctx, pt)` devolve as linhas do contorno do ambiente, `roomId`, nome e ponto.
- `perimeterToolPick.ts`: `roomHover` (prévia) e `roomClick` (adiciona o contorno e devolve o `roomId`), `ROOM_HINT`.
- `PerimeterOptionsBar.tsx`: "Vincular às paredes" (piso e laje) e "Acompanhar o ambiente" (forro); `PerimeterOptions`
  ganhou `linkToWalls?` e `followRoom?` (opcionais, para as literais de `perimeterView.ts` continuarem compilando).
- `PerimeterRibbonPanels.tsx`: forma `'pick-room'` ("Por ambiente", só forro) e `perimeterShapesFor(target)`.

## Ganchos

### 1. `packages/tools/src/perimeterTool.ts` (dono: K1 / agente de Modificar)

Tudo por nome de função, porque o arquivo está em edição.

a. Import: acrescentar `ROOM_HINT`, `roomClick`, `roomHover` ao import de `./perimeterToolPick.ts`, e `type SketchOrigin`
   ao import de `./perimeterSession.ts`.

b. Tipo: `export type PerimeterShape = ShapeKindId | 'pickFace' | 'byPerimeter' | 'pickRoom';`

c. Campo e acessor (junto de `private shape`, e perto de `draft()`):
```ts
private originInfo: SketchOrigin = {};

/** De onde veio o esboço: caixa sobre as paredes (`walls`) e ambiente escolhido (`roomId`). Para o vínculo do contorno. */
origin(): SketchOrigin {
  return this.originInfo;
}
```

d. `move()`: no ramo da forma, depois de `if (this.shape === 'pickFace') this.movePick(p.raw);` acrescentar
   `else if (this.shape === 'pickRoom') { const h = roomHover(this.env, p.raw); this.items = h.items; this.env.say(h.say); }`
   (antes de `else if (id) this.moveShape(p, id);`).

e. `click()`: antes de `else if (this.shape === 'byPerimeter') return;` acrescentar
   `else if (this.shape === 'pickRoom') this.clickRoom(p);`

f. Método novo (junto de `clickPick`):
```ts
/** "Por ambiente": o contorno do ambiente sob o cursor entra no esboço, e o id do ambiente vai para a origem. */
private clickRoom(p: PointerInfo): void {
  const r = roomClick(this.env, p.raw, this.d);
  if (r.roomId) this.originInfo = { ...this.originInfo, roomId: r.roomId };
  if (r.draft !== this.d) this.commit(r.draft);
  this.env.say(r.say);
}
```

g. `up()` (caixa): depois de `if (r.segs.length > 0) this.commit(applySegs(this.d, r.segs));` acrescentar
   `if (r.segs.length > 0) this.originInfo = { ...this.originInfo, walls: true };`

h. `shapeId()`: incluir `|| this.shape === 'pickRoom'` na condição que devolve `null`.

i. `shapeHint(kind)`: acrescentar `if (kind === 'pickRoom') return ROOM_HINT;` antes de `const k = kindOf(kind);`.

j. Zerar a origem em `loadDraft(d)` e em `finish()` (depois de `draftHistory.reset`): `this.originInfo = {};`.

### 2. `apps/web/src/editor/perimeterView.ts`

Em `PARA_FERRAMENTA`, depois de `'by-perimeter': 'byPerimeter',`: `'pick-room': 'pickRoom',`.
Sem isto o typecheck falha ("Property 'pick-room' is missing").

### 3. `apps/web/src/editor/perimeterMode.ts`

Em `opcoesDe(s)`, levar as opções novas e a origem para `commitPerimeter`:
```ts
function opcoesDe(s: Sessao): CommitPerimeterOptions {
  const base = { typeId: s.typeId, levelId: s.levelId, origin: s.tool.origin() };
  const o = s.opts;
  if (s.target === 'roof') return { ...base, overhang: o.overhang, slopePct: o.slopePct };
  return { ...base, extendToCore: o.extendToCore, heightOffset: o.heightOffset, linkToWalls: o.linkToWalls, followRoom: o.followRoom };
}
```
`iniciais` e `PerimeterView.options` não mudam (os campos são opcionais; ausente = desmarcado). `edit(id)` já recebe
`linkToWalls` e `followRoom` de `perimeterOptionsOf`.

### 4. Nada a fazer

`perimeterApi.ts`, `PerimeterStatus.ts` e `PerimeterEdgePanel` não precisam de mudança.

## Regras para conferir na tela

- Vincular às paredes: só com o esboço de "Por perímetro" (caixa). Esboço à mão grava sem vínculo, com a nota na mensagem.
  O esboço tem de coincidir com a face externa das paredes (5 mm); senão recusa e não cria nada.
- Vincular não combina com "Estender até o núcleo" (a caixa usa a face externa): a opção de núcleo fica desabilitada
  enquanto o vínculo está marcado, e a recusa explica se o pedido chegar assim mesmo.
- Piso ou laje já vinculados não se editam pelo perímetro (contorno travado, decisão 0031): é preciso Desvincular.
- Acompanhar o ambiente: o esboço tem de ser o contorno do ambiente escolhido pela galeria "Por ambiente". Criar com
  contorno diferente recusa; editar um forro que acompanha, com a opção marcada e o contorno do ambiente, mantém o vínculo;
  com a opção desmarcada, solta (como antes).
- Arcos: um arco de semicírculo, ou de círculo inteiro, sai como um arco na edição (teste de ida e volta em
  `perimeterCommitArcs.test.ts`); polígono inscrito de lados retos não vira arco.

## Testes

- `packages/tools/src/perimeterArcFit.test.ts`, `perimeterCommitArcs.test.ts`, `perimeterCommitLink.test.ts`,
  `perimeterToolRoom.test.ts`, e `apps/web/src/ui/perimeter/perimeter.test.ts` (galeria por alvo).
- Ainda sem teste: a ligação dos ganchos 1 a 3 (depende dos arquivos acima).
