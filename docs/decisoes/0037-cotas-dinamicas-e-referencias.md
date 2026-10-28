# Decisão 0037 · Sistema de cotas dinâmicas e referências

Decidido em 2026-10-28 com o dono. Plano: `docs/plano-unidades-cotas/04-sistema-de-cotas.md`; pesquisa do Revit:
`docs/aberturas/pesquisa-f0/R7-revit-cotas-temporarias.md`. Código: `packages/model/src/dimensionSettings.ts`,
`packages/engine/src/wallPlanes.ts` e `openingExtents.ts`, `packages/tools/src/dims/**`, `apps/web/src/ui/dims/**`.

1. **Um sistema só.** Cotas temporárias (ao colocar e ao selecionar) saem de **provedores** registrados por tipo de
   elemento; um único componente (`TempDimsOverlay`) desenha e edita. Os três vocabulários antigos (`axis|face`,
   `externa|nucleo|eixo` + `centro|arestas`, e o silêncio das ferramentas de parede/linha) foram unificados.
2. **Vocabulário.** Parede: `axis` (centro da espessura total), `finish` (face acabada voltada para o elemento medido),
   `coreCenter`, `coreFace`. Esquadria: `center`, `clear` (vão livre), `frame` (vão externo do batente/conjunto), `casing`
   (borda externa do alizar do lado da cota). Padrões do projeto: `finish` e `frame`.
3. **Configuração.** Em `ProjectSettings.dimensions` (opcional, padrões resolvidos na leitura, sem mudar `SCHEMA_VERSION`):
   referências e "mostrar ao colocar / ao selecionar". Troca rápida só na sessão (`dimOverrides`): alça da ponta da cota ou
   seletor da barra de opções.
4. **Fonte das medidas.** Planos de parede de `wallPlanes(frame)`; extensões da esquadria do **modelo real**
   (`buildOpeningModel`: ombreiras e alizar), não de fórmulas paralelas.
5. **Edição.** Digitar o valor e Enter reposiciona; a função `edit` é pura e devolve comandos. Esquadria hospedada **não
   sai da parede** nem atravessa perpendicular ou outra esquadria: alerta e nada muda (`hostedConflicts` para paredes).
6. **Cota permanente.** O ícone "I" converte as cotas mostradas em cotas permanentes livres (`toPermanent`), num passo.
7. **Extensão.** Provedor novo = tipo do sujeito + `compute` + `edit` opcional + uma linha de registro
   (`docs/plano-unidades-cotas/COMO-ADICIONAR-COTA.md`). Escadas, ambientes e seções ficam como extensão futura.
