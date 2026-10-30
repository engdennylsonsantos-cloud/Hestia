# Rótulos: planta de área (posição automática) e planta de piso (só o nome)

Entrega das duas limitações aprovadas da [G](../G-implementacao.md): o layout automático da etiqueta da planta de
área e o rótulo da planta de piso só com o nome, conforme a
[decisão 0037](../../decisoes/0037-plantas-de-area.md). Sem commit.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `packages/render/src/plan/areaPlan.ts` | `autoTagAt`, `labelOffsets`, `boxInPolygon`, `rectAt`/`overlaps` e o uso em `areaPlanTagOps` |
| `packages/render/src/plan/rooms.ts` | `roomLabelText` (nome + número + área) → `roomNameText` (só o nome); `roomOps` usa o nome |
| `packages/render/src/index.ts` | barrel: `roomLabelText` → `roomNameText` (uma linha, necessária para o DXF do app) |
| `apps/web/src/editor/dxfExport.ts` | linha do rótulo do ambiente da planta de piso passa a usar `roomNameText` |
| `packages/render/src/plan/areaPlan.test.ts` | testes de posicionamento (normal, pequeno, colisão, posição do usuário) |
| `packages/render/src/plan/rooms.test.ts` | etiqueta da planta de piso só com o nome, em todos os detalhes |
| `apps/web/src/editor/dxfRooms.test.ts` | `AMBIENTES_TEXTO` só com o nome (sem número nem área) |

## A) Posicionamento automático da etiqueta (planta de área)

Antes: começava na referência e, se colidisse com um rótulo já colocado, subia em degraus de `h + 0,25 m` até 12
vezes — podia sair de ambientes pequenos.

Agora, só para etiqueta **automática** (sem `Room.labelPosition` e sem `RoomTag`):

1. **Candidatos em leque** ao redor da referência (centro, acima, abaixo, esquerda, direita e as quatro diagonais),
   com margem em papel (`LABEL_MARGIN_MM = 1,2 mm`), então o espaçamento acompanha a escala.
2. **Preferência**: o primeiro candidato (na ordem acima, determinística) cuja caixa fica **inteira dentro** do
   polígono do ambiente e **não colide** com um rótulo já colocado (`LABEL_GAP_MM = 1,0 mm` de folga).
   "Inteira dentro" testa cantos, centro e meio das bordas com `pointInPolygon` — o polígono pode ter furos e
   reentrâncias em L/U.
3. **Sem candidato que caiba** (ambiente pequeno): fica o candidato **mais próximo da referência** — não o mais
   alto —, de preferência um que não sobreponha outro rótulo. Empate resolvido pela ordem do leque.
4. **Chamada**: inalterada. É calculada pelo centro do texto (`pointInPolygon`), então continua aparecendo quando a
   caixa sai do polígono. `room.labelPosition` explícito e `RoomTag` mandam: não são reposicionados.
5. Diagonais de referência, líder e o desenho do texto seguem iguais.

## B) Planta de piso mostra só o nome

- `roomNameText(r)` devolve `r.name`; sem nome, `Ambiente N` (ou `Ambiente`). Some o `"Ambiente 7 (7)"` duplicado
  que a auditoria apontava.
- `roomOps` (tela/PDF) e `dxfGeometryOf` (DXF da planta de piso, camada `AMBIENTES_TEXTO`) usam `roomNameText`.
- A etiqueta da **planta de área** continua com `roomTagLines` e os campos configuráveis (`RoomTag.fields`):
  nome, número, área, categoria, nível, perímetro, volume, texto livre.
- `roomOps` mantém o parâmetro `detail` (assinatura usada por `build.ts`), agora sem efeito no texto (`void detail`).
- Cotas, escadas, IFC e `RoomTag` não foram tocados.

## Testes

`areaPlan.test.ts`
- ambiente normal (4 × 5 m): etiqueta exatamente na referência, sem chamada;
- ambiente pequeno (1,1 × 1,0 m, caixa não cabe): etiqueta na referência, dentro do ambiente, sem chamada;
- ambiente pequeno com colisão (rótulo do usuário arrastado para dentro do vizinho de 3 × 1 m): escolhe um candidato
  **inteiro dentro** do ambiente (y < 1 m) em vez de subir um degrau de 0,68 m para fora — conferido que o algoritmo
  antigo falha esse teste (`expected 1.18 to be less than 1`);
- posição explícita do modelo não é reposicionada.

`rooms.test.ts`
- só o nome (com e sem número), igual nos detalhes fino, médio e grosso;
- lista de desenho da planta sem número e sem área na etiqueta do ambiente.

`dxfRooms.test.ts`
- `AMBIENTES` e `AMBIENTES_TEXTO` presentes; texto `Sala`, sem `(101)` e sem `m²`.

## Resultados

```
npx tsc --noEmit            → OK
npx vitest run packages/render/src/plan/areaPlan.test.ts \
               packages/render/src/plan/rooms.test.ts \
               apps/web/src/editor/dxfRooms.test.ts
                            → 3 arquivos, 32 testes, todos passando
npx vitest run packages/render/src/plan/graficos.test.ts \
               packages/render/src/sheet/areaPlanSheet.test.ts
                            → 27 testes, todos passando (checagem de vizinhança)
```

## Observações

- `packages/render/src/index.ts` entrou só para exportar `roomNameText` no lugar de `roomLabelText` (o app importa
  do pacote, não do caminho interno).
- `packages/io/src/dxf.ts:129` ainda tem o comentário antigo "Textos dos ambientes (nome, número e área)"; é só
  documentação e ficou fora do escopo desta frente.
- A UI continua expondo `RoomTag` por planta (limitação separada, em andamento em outra frente).
