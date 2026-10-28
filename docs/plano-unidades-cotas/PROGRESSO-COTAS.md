# Progresso do agente COTAS (marque `[x]` no mesmo commit do passo; anote desvios e bloqueios)
Linha de base antes de mexer (`npm run check`): lint (eslint, fronteiras, paridade, densidade) verde com 2 avisos de hooks em OpeningTempDims/ViewportOverlays; typecheck e testes rodados por pasta a cada passo.

- [x] D0 mapa (`04`)
- [x] D1 configuração no modelo
- [x] D2 wallPlanes e openingExtents
- [ ] D3 resolvedores
- [ ] D4 provedor de esquadrias + registro (código novo; integrar em `openingTool.ts` só depois do marco M4)
- [ ] D5 sobreposição única (só depois do marco M1)
- [ ] D6 validação de hospedados
- [ ] D7 alças trocam referência
- [ ] D8 permanentes + autoCotas  → **D4–D8 integrados = marco M5**
- [ ] D9 diálogo Cotas… + troca rápida (só depois do marco M3)
- [x] D11 documentação de reaproveitamento e decisão
- [ ] F1 suíte e build (`06`; só quando UNID e ESQ terminarem)
- [ ] F2 navegador
- [ ] F3 revisão cruzada (revise os diffs de UNID e ESQ)
- [ ] F4 documentação
- [ ] F5 entrega

## Desvios
- D2: `axis` = centro da espessura total (`sMid`), como o 04 manda; o `autoCotas` antigo usava `[0,0]` (linha de localização) para 'eixo': coincidem só com `wallCenter` (padrão). Ao migrar o autoCotas (D8) o 'eixo' passa a `sMid`.
- D2: `openingExtents` usa o MODELO REAL (`buildOpeningModel`): `frame` = `model.width/2` (vão externo do conjunto), `clear` = borda interna das ombreiras externas, `casing` = maior |t| das peças `casing` da face pedida (a face de abertura da folha recua 14 mm). Recorte da parede = `roughWidth` = `t.width + roughOversize.w`; em tipos simples `frame` coincide com o recorte (testado); em tipos com composição `model.width` vem do vão nominal da composição e pode diferir de `t.width`. Padrão `openingRef` mantido em `frame`.

## Bloqueios e pedidos a outros agentes
_(nenhum)_

## Ações pendentes do dono
- Regravar baselines de imagem (`tests/e2e/baseline*`) se a regressão visual indicar diferença esperada.
