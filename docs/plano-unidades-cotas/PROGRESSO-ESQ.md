# Progresso do agente ESQ (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): 5 testes falham só por timeout do ambiente (openingCatalogo "low/mid/high", shortcutConfig ×2, worker projetoUmaVez, worker servidor); os demais passam.

- [x] S1 batente = espessura acabada (`05`)
- [ ] S2 prévia com a esquadria real
- [ ] S3 Espaço/Tab redesenham  → **S2 e S3 integrados = marco M4**
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

## Desvios
- S1: padrão de `frameDepthMode` passou de `'core'` para `'wall'` na leitura (`openingStyle`, contexto do modelo, composição e normalização) e no catálogo de composições e no "Novo tipo".
- S1: a porta de vidro blindex tem `frameStyle: 'block'` (sem batente por definição); o teste novo usa a porta-balcão `ot_pbalcao120` (madeira e vidro, com batente) como "porta de vidro".
- S1: `ouroZoom.json` foi regenerado (78 entradas) porque a planta agora desenha o batente cobrindo a espessura inteira (mudança intencional do S1); entradas sem aberturas ficaram idênticas.
- S1: testes antigos de "padrão core" foram atualizados para o novo padrão `wall`; os que testam o modo `core` passaram a declará-lo explicitamente.

## Bloqueios e pedidos a outros agentes
_(nenhum)_
