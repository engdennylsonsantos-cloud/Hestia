# Progresso do agente ESQ (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): 5 testes falham só por timeout do ambiente (openingCatalogo "low/mid/high", shortcutConfig ×2, worker projetoUmaVez, worker servidor); os demais passam.

- [x] S1 batente = espessura acabada (`05`)
- [x] S2 prévia com a esquadria real
- [x] S3 Espaço/Tab redesenham  → **S2 e S3 integrados = marco M4**
- **MARCO M4 LIBERADO cdcd096a** (S2 e S3 integrados)
- [ ] S4 alças de inversão
- [ ] S5 planta do modal
- [ ] C4 `packages/tools` (`03`; só depois do marco M2; respeite os arquivos reservados)
- [ ] C6 `packages/render` e `packages/io`
- [ ] D10.1 parede (`04`; só depois do marco M5)
- [ ] D10.2 linha e perímetro
- [ ] D10.3 eixos
- [ ] D10.4 piso/laje/telhado/forro
- [ ] D10.5 mover/copiar
- [ ] `npm run check` verde, integrado

## S1 — o que cada modo calcula (3 linhas)
- `wall` (padrão): `D` = espessura TOTAL do tipo de parede (`totalThickness`, todas as camadas com revestimentos) e `Cd` = 0, o plano médio da parede.
- `core`: `D` = faixa do núcleo (`coreSpan`, do primeiro ao último layer estrutural) e `Cd` = centro dessa faixa; parede de uma camada tem núcleo = total.
- `fixed`: `D` = `frameDepth` do tipo (padrão 0,09) limitado à espessura total e `Cd` parte do centro do núcleo, ajustado para caber entre as faces; `aduela` usa sempre o núcleo inteiro.


## S2 — desempenho e cache
- Prévia monta o modelo uma vez por (tipo, parede, espessura, inversões, detalhe) e guarda os traços LOCAIS; cada movimento só converte para o mundo com o quadro do vão (equivale à translação ao longo da parede e vale para parede curva).
- Medido numa porta composta (`ot_pbalcao_band120`, 103 peças): sem cache 1,15 ms; com cache 0,006 ms por movimento (limites do plano: < 8 ms e < 1 ms).

## Desvios
- S1: padrão de `frameDepthMode` passou de `'core'` para `'wall'` na leitura (`openingStyle`, contexto do modelo, composição e normalização) e no catálogo de composições e no "Novo tipo".
- S1: a porta de vidro blindex tem `frameStyle: 'block'` (sem batente por definição); o teste novo usa a porta-balcão `ot_pbalcao120` (madeira e vidro, com batente) como "porta de vidro".
- S1: `ouroZoom.json` foi regenerado (78 entradas) porque a planta agora desenha o batente cobrindo a espessura inteira (mudança intencional do S1); entradas sem aberturas ficaram idênticas.
- S1: testes antigos de "padrão core" foram atualizados para o novo padrão `wall`; os que testam o modo `core` passaram a declará-lo explicitamente.

- S3: `lastPointer` guardado em `move`; `tab()` e `space()`/`flipHandToggle()` reexecutam `move(lastPointer)` quando há ponteiro. Em `apps/web/src/editor/controller.ts` o Espaço da porta/janela passou a chamar `tool.space()` e `bump()` (o Tab já chamava `bump()`), então o repintar usa o mesmo gancho existente.
- S2: a conversão local→mundo virou `openingPlanPathsAt`/`openingPlanWorldPaths` no engine; a planta (`render/src/plan/symbols.ts`) passou a delegar para a MESMA função (nada de cópia).
- S2: `symbolPreviewItems` apagada; a prévia usa o modelo único. O parâmetro `openingLine` do plano não existe nas opções da planta (é convenção de elevação/corte), então `openingPreviewStrokes` recebe só o detalhe.

## Bloqueios e pedidos a outros agentes
_(nenhum)_
