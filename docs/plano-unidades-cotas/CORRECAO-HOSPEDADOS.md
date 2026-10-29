# Aberturas hospedadas: não mudam de posição ao esticar/encurtar a parede

## Problema e causa raiz
O `offset` da abertura é a distância do centro ao início (`a`) da parede, medida ao longo do eixo. Ao mudar as pontas,
`setWallEnds` e `updateElements` só limitavam o `offset` ao comprimento (`clampOffset`). Com a ponta `a` alterada (ou com
as duas), o `offset` constante fazia a abertura deslizar no mundo junto com o novo `a`; ao encurtar pela ponta `a`, ela
podia até sair da parede e ser presa no limite. Aparar, alças, cotas e junções todos passavam por esses dois comandos,
então todos herdavam o defeito.

## Regra implementada
A regra do dono — **esticar/encurtar não move a abertura no mundo; transladar/girar a parede inteira leva a abertura** —
é aplicada uma vez, na base dos comandos, em `packages/model/src/hostedOffset.ts`:

| O que mudou | Novo `offset` | Efeito |
|---|---|---|
| comprimento igual (translação/giro) | fica | a abertura acompanha o movimento rígido |
| só `b` mudou | fica | preserva a distância à ponta fixa `a` (estica/encurta no mundo) |
| só `a` mudou | `offset + (Lnovo − Lvelho)` | preserva a distância à ponta fixa `b` |
| as duas pontas, mesma direção, comprimento mudou | projeção da posição antiga no novo eixo | posição projetada preservada |
| as duas pontas, direção mudou | fica | a abertura acompanha o giro de `a` |
| só a flecha (`sag`) mudou | fica | distância de arco à ponta `a` preservada |

`openingOffsetAfterEnds` é puro e usa `arcFromSagitta`/`arcLocal`/`arcPointAt`; na parede curva o parâmetro é o próprio
comprimento de arco. `rehostOpenings` aplica a regra e depois `clampOffset` (rede de segurança). `clampOffset` passou a
morar no mesmo módulo, para o limite e a compensação ficarem juntos.

## Onde a regra entra
- `setWallEnds` (`packages/model/src/commands.ts`): calcula o novo `offset` antes de trocar `a`/`b`.
- `updateElements` com `a`/`b`/`sag`: mesma compensação, incluindo o lote atômico do Aparar.
- `packages/tools/src/trimPreview.ts`: o Aparar agora emite **um** `updateElements` com pontas e flecha juntas. Em arco,
  a compensação vê a circunferência final de uma vez (com `setWallEnds` + `sag` separados, a ordem mudava o resultado).
- `packages/tools/src/hostedLoss.ts`: o aviso calcula as aberturas fora com o **mesmo** `openingOffsetAfterEnds` e a
  extensão real (`openingExtents(...).frame`); o diálogo e o resultado final concordam. A exclusão confirmada continua
  num único passo de desfazer (`execWithHostedLoss`).
- Caminhos que herdam sem repetir lógica: Aparar nos três modos, alças de ponta, cota de comprimento, cotas axiais e
  laterais (`translateWallsJoined`), mover/copiar com vizinhas (`wallFollow`/`planWallFollowers`), alinhar e junção.
  Translação/rotação da parede inteira usam `transform`, que mantém o `offset` — correto porque o movimento é rígido.

## Testes
- `packages/model/src/hostedOffset.test.ts`: a tabela acima, parede degenerada e leitura do patch.
- `packages/tools/src/hostedEnds.test.ts`: casos (a)–(j) com duas aberturas por parede, comparando centro e bordas no
  mundo (tolerância 1e-6): estender/encurtar `a` e `b` por `setWallEnds` e `updateElements`; as duas pontas; Aparar nos
  três modos (parede aparada e referência); alça da ponta; cota axial/lateral; mover/copiar com vizinhas; translação e
  rotação da parede; parede curva pelo comprimento de arco.
- `packages/tools/src/hostedLoss.test.ts`: encurtar/estender pela ponta `a` também entra no aviso com a regra nova.
- `packages/tools/src/dims/roundtrip.test.ts` continua verde.

## Verificação no navegador (Playwright, app desta pasta)
Parede de 8 m com porta P-01 em 2 e janela J-01 em 6, alvenaria 14. App em `npm run dev -w @hestia/web` (porta 5193):
- **Aparar** (modo um elemento) estendeu `b` até 10 m e `a` até −2 m; as duas aberturas ficaram exatamente onde estavam.
- **Alça da ponta**: arrastar `b` até 10 m e `a` até −2 m; as aberturas não se moveram.
- **Cota de comprimento** digitada `10` (mantém `a`, move `b`): aberturas intactas.
- **Girar 90°** em torno de `a`: as aberturas acompanharam a rotação e o `offset` não mudou.
- Sem erro de console da aplicação (só o `favicon.ico` 404 do servidor de desenvolvimento).

Capturas: `capturas/fix-hospedados-{aparar-a,aparar-b,alca,cota,giro}-{antes,depois}.png`.

## O que falta
Nada pendente para a regra do dono. A cota de comprimento da interface mantém `a` e move `b` por definição; a ponta `a`
é coberta por Aparar e alça. A alça do meio do arco muda a flecha (não as pontas) e segue a distância de arco à ponta `a`.
