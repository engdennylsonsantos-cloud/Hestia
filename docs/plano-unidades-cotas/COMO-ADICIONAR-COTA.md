# Como adicionar cotas dinâmicas a uma ferramenta ou elemento

O sistema é único: o overlay (`apps/web/src/ui/dims/TempDimsOverlay.tsx`) só desenha e chama `edit`. Para cotar algo novo
basta **um provedor pequeno e uma linha de registro**. Nada no overlay muda (o teste
`packages/tools/src/dims/providers/example.test.ts` prova isso e é a versão executável deste exemplo).

## Passo a passo
1. **Sujeito.** Escreva a interface do que será cotado (ex.: `{ wallId: string }`).
2. **Provedor.** Crie `packages/tools/src/dims/providers/<nome>.ts` com `DimProvider<Sujeito>`:
   - `id`: texto único (compõe as chaves `${id}:${slot}` das trocas de referência);
   - `compute(ctx, sujeito)`: devolve `TempDim[]` (`a`, `b`, `offset`, `value` em METROS, `ends` na ordem de `a` e `b`);
   - `edit?(valorSI)` em cada cota: **função pura** que devolve `{ commands }` ou `{ error }`; ausente = só leitura;
   - `selectionSubject?(projeto, id)`: só se quiser cotar o elemento ao selecioná-lo.
3. **Referências.** Leia a referência em `ctx.overrides[...]` e, se faltar, em `ctx.settings` (`wallRef`/`openingRef`).
   Os planos vêm de `wallPlanes`/`wallPlaneAt` (engine) e `hostTargets` (`dims/refs.ts`); as esquadrias, de `openingExtents`.
4. **Registro.** Uma linha em `registerBuiltinDimProviders()` (`dims/registry.ts`): `registerDimProvider('wall', meuProvedor)`.
5. **Prévia na ferramenta.** Para cotar durante o desenho, a ferramenta implementa `tempDims(): TempDim[]` chamando
   `meuProvedor.compute(...)` com o sujeito da prévia (cotas sem `edit` aparecem só como leitura).
6. **Validação.** Se a edição mexe em paredes, chame `hostedConflicts` (`dims/validate.ts`): esquadria hospedada não sai da parede.
7. **Teste.** Valor do `compute`, `edit` válido e inválido, e a seleção pelo registro (veja o exemplo).

## Exemplo mínimo (comprimento de uma parede)
```ts
const comprimento: DimProvider<{ wallId: string }> = {
  id: 'comprimento',
  selectionSubject: (p, id) => (isWall(p.elements[id]) ? { wallId: id } : null),
  compute(ctx, { wallId }) {
    const w = ctx.project.elements[wallId];
    if (!isWall(w)) return [];
    const end = (at: Vec2, slot: string): DimEnd => ({ at, slot, kind: 'wall', current: ctx.settings.wallRef, options: ['axis'] });
    return [{
      key: `comprimento:${wallId}:len`, a: w.a, b: w.b, offset: 0.3, value: Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y),
      ends: [end(w.a, 'a'), end(w.b, 'b')],
      edit: (v) => (v > 0 ? { commands: [{ type: 'setWallEnds', id: wallId, b: { x: w.a.x + v, y: w.a.y } }] } : { error: 'Comprimento inválido.' }),
    }];
  },
};
registerDimProvider('wall', comprimento); // a única linha de registro
```

## O que o sistema já faz por você
- Texto azul editável (Enter grava num único passo de desfazer; valor inválido ou erro de `edit` mostra alerta e não muda nada).
- Alças nas pontas trocam a referência (`ends[i].options`), ícone "I" converte em cotas permanentes (`toPermanent`).
- Unidades do projeto (formatação e leitura do que se digita) e "Mostrar ao colocar/selecionar" do diálogo Cotas….
