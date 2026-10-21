# Decisão 0013 · Intervalo de vista (view range) da planta

Fonte: docs/05 §5 (Revit View Range). Decidido pelo dono em 2026-10-21: topo padrão do Revit (2,30 m); janelas acima do corte como no
Revit (tracejadas); todos os elementos de uma vez; planta de forro (direção `up`) depois, só com o campo preparado.

## 1 · Modelo
- Cada nível é uma planta: `Level.viewRange: ViewRange` (tipo em `packages/model/src/viewRange.ts`; padrão `{top 2,30; cut 1,20; bottom 0; depth 0; direction 'down'}`,
  cotas relativas à elevação do nível). `SCHEMA_VERSION` 14 → 15 (migração acrescenta o padrão a todos os níveis). Regra: topo ≥ corte ≥ base ≥ profundidade
  (`viewRangeIssues`/`normalizeViewRange`). Comando `setLevelViewRange(levelId, patch)` (desfazer/refazer como os demais).
- `direction: 'up'` é aceita e guardada, mas a planta ainda desenha como 'down' (UI desabilitada, com a nota "em breve").
- A cota `cut` absoluta é `level.elevation + viewRange.cut`.

## 2 · Classificação (engine, função pura `classifyForView`)
Cada elemento do nível tem uma faixa de cotas absolutas `[z0, z1]` (tabela §3). Estados: `cut` | `projection` | `beyond` | `hidden`.
Regra padrão (Z = elevação do nível; top/cut/bottom/depth absolutos = Z + valor):
1. `z0 > top` ou `z1 < depth` → `hidden`.
2. `z0 ≤ cut ≤ z1` → `cut`.
3. `z0 > cut` (inteiro entre corte e topo) → `projection` ACIMA do corte (desenho tracejado).
4. `z1 < cut` e `z1 ≥ bottom` → `projection` ABAIXO do corte (desenho normal, mais leve, sem hachura).
5. `z1 < bottom` e `z1 ≥ depth` → `beyond` (estilo "além": cinza claro, tracejado fino).
Categorias com intervalo estendido para baixo (Revit): piso, laje e escada nunca viram `hidden` nem `beyond` por estarem abaixo da base (tratam `bottom = −∞`).
Exceção de produto: a projeção tracejada da cobertura (contorno do telhado acima do corte) continua sendo opção da planta ("Mostrar projeção da cobertura",
padrão ligada), independente do topo, porque é prática de projeto brasileira; a planta de cobertura (D6) não muda.

## 3 · Faixa de cotas por categoria
| Categoria | z0 | z1 |
|---|---|---|
| Parede | cota da base (nível + deslocamento) | topo mais alto do perfil/altura; com `attachTopToRoof`, o topo derivado do telhado |
| Porta/janela | base da parede + peitoril | + altura da abertura |
| Piso | face inferior | face superior |
| Laje | face inferior | face superior |
| Telhado | menor cota do beiral | cumeeira |
| Escada | `baseZ` | `topZ`; os degraus individuais usam o próprio topo (cheio abaixo do corte, tracejado acima, oculto acima do topo) |

## 4 · Efeitos na planta
- Parede `cut`: contorno e hachura de corte como hoje; `projection`/`beyond`: linha fina, sem hachura.
- Abertura: as aberturas que atravessam o plano de corte furam a parede (como hoje). Abertura cujo vão NÃO cruza o corte (peitoril acima do corte, ou verga abaixo do
  corte) NÃO fura a parede na planta: a parede é desenhada inteira e a abertura aparece como símbolo tracejado (acima do corte e ≤ topo) ou some (> topo). Só afeta
  o desenho da planta (a geometria do modelo, 3D, quantitativos e cortes não mudam).
- Escada: a cota de corte vem da vista (`level.elevation + cut`), substituindo `STAIR_CUT_HEIGHT`; o símbolo de corte aparece só se o plano cruza a escada.
- Piso/laje: preenchimento normal quando `projection` abaixo/`cut`; as de outros níveis seguem como "nível abaixo" apagadas (D4, sem mudança).
- Aviso de vista (`viewRangeWarnings`): "N elemento(s) fora do intervalo de vista" por categoria, listados nas propriedades da vista (Revit mostra isso aos
  poucos; aqui avisamos).
- DXF de planta e tabelas usam a mesma classificação onde desenham a planta; cortes, elevações e 3D não dependem do intervalo.

## 5 · Interface
Propriedades da vista (nível ativo): Topo, Plano de corte, Base, Profundidade (m, relativos ao nível), Direção (Baixo | Cima [em breve]), botão "Restaurar padrão",
lista de avisos. Campos inválidos mostram a mensagem de `viewRangeIssues` e não são gravados.
