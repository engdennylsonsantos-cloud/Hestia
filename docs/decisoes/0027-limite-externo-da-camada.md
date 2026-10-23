# 0027 · Limite da camada no perímetro externo

Companheira de [0025](0025-termino-por-camada-piso-unico.md). A 0025 diz como a camada de piso ou laje se comporta **nas
paredes**; esta decisão diz até onde ela vai **na borda da edificação**, que é outra pergunta.

Origem: pedido do dono (2026-10-23), olhando a casa de alto padrão no 3D — "a laje está indo até o extremo das paredes;
existe alguma forma de fazer a laje só ir até o acabamento externo, para que o acabamento da parede de cima e de baixo se
toquem e não apareça a laje?".

## 1. Problema

O contorno da laje é desenhado até a face externa do acabamento (no arquivo real, 0,121 m do eixo da parede externa).
`termino` não resolvia o caso:

| valor de `termino` | efeito | por que não serve |
|---|---|---|
| `auto` (padrão) | a camada usa o contorno do elemento | a estrutura atravessa a parede até a face externa, e o corte da laje aparece na fachada |
| `face` | contorno menos a **pegada inteira** da parede | para a camada na face **interna**; não existe opção para a face externa |
| `nucleo` | contorno menos a faixa do **núcleo** | idem: para no núcleo pelo lado de dentro |
| `{ ate: { prioridade: N } }` | até a camada da parede de prioridade ≤ N | medido de dentro para fora, não na borda da edificação |

As faces externas já existiam no motor (`outerPerimeter(..., 'finish' | 'core')`, da 0023 F6 e do T7), mas só o **elemento**
podia escolher entre elas (`OutlineSource.extend`), nunca a **camada**.

## 2. Decisão

Campo novo, opcional e aditivo em `Layer` (sem migração, sem mudança de `SCHEMA_VERSION`):

```ts
limiteExterno?: 'parede' | 'nucleo';
```

| valor | até onde a camada vai na borda |
|---|---|
| ausente | o contorno do elemento, como antes |
| `parede` | até a **face externa da parede** (inclui o acabamento externo dela) |
| `nucleo` | passa sob o acabamento externo e para na **face externa do núcleo** |

As duas faces são as mesmas do perímetro por elemento (F6): a implementação corta a região da camada com
`outerPerimeter(p, levelId, seed, 'finish' | 'core')`.

**Por que um campo separado e não mais um valor de `termino`:** são dois eixos independentes. Nas paredes **internas** a
camada escolhe entre face, núcleo, passa, prioridade ou deslocamento; na **borda** ela escolhe entre o contorno, a face
externa do acabamento e a face externa do núcleo. Um único seletor com nove combinações esconderia isso e obrigaria a
repetir a escolha de dentro ao mudar a de fora.

Efeito medido na casa de alto padrão (laje `ls_mac15`, contorno a 0,121 m do eixo, parede externa `wt_ext19`):

| limite externo da estrutura | área do concreto |
|---|---|
| ausente | 166,686 m² |
| `parede` | 166,686 m² (o contorno já está na face externa) |
| `nucleo` | 165,116 m² (−1,57 m², o acabamento externo de 2,2 cm em todo o perímetro) |

Com `nucleo`, o acabamento externo da parede (cerâmica 1 cm + argamassa 2 cm) fica contínuo por fora da laje: é o que faz
o acabamento da parede de baixo e o da parede de cima se encontrarem, sem o corte da laje no meio.

## 3. Limites do escopo

1. **Só o perímetro externo.** Paredes internas continuam regidas por `termino` (testado: com `face` na camada, a parede
   interna recorta a camada mesmo com `limiteExterno` posto).
2. **Só pisos e lajes.** Parede, forro e telhado não têm o campo (o formulário só aparece nos diálogos de tipo de piso e de
   laje).
3. **Perímetro por área fechada ou por parede (`mode: 'perimeter'`)** também aceita o campo: o corte é aplicado depois da
   regra do perímetro, então `nucleo` aprofunda e `parede` não muda nada.
4. **A parede que precisa "passar na frente"** da laje continua sendo escolha do modelo: `attachTopToFloor` põe o topo da
   parede na face inferior da laje. Para ela subir até o topo da laje, desligar o anexo e usar `topLevelId` + `topOffset`
   (a altura do modelo é ignorada quando há nível de topo).

## 4. Interface

Segunda linha do painel avançado da camada, abaixo de "Término nas paredes": **"Limite no perímetro"**, com três opções
(`Contorno do elemento`, `Até face ext. parede`, `Até face ext. núcleo`) e uma dica por opção. Rótulos com até 22
caracteres, como os do término.

## 5. Testes

- `packages/engine/src/limiteExterno.test.ts` (6 casos): contorno > parede > núcleo; o limite é só da camada escolhida;
  parede interna continua recortando por `termino`.
- `packages/model/src/termino.test.ts`: validação do campo e independência em relação a `termino`.
- `apps/web/src/ui/dialogs/terminoForm.test.ts`: opções, rótulos e ida e volta com a camada.

## 6. Pendências

- `{ ate: { prioridade: N, lado: 'externo' } }` (parar na camada da parede de prioridade N pelo lado de fora) não foi
  implementado: as duas faces cobrem os casos reais. Se aparecer a necessidade, entra como extensão de `limiteExterno`.
- Cor, hachura e IFC por camada seguem como na 0023 §6.2 (itens 10 e 15); o DXF já usa a região resolvida (F7.1).
