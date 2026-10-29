# Decisão 0038 · Unidades do projeto

Decidido em 2026-10-28 com o dono. Plano: `docs/plano-unidades-cotas/01-unidades.md`,
`02-padroes-do-projeto-ui.md` e `03-migracao-dos-usos.md`. Código: `packages/model/src/units*.ts`,
`apps/web/src/ui/useUnits.ts`, `apps/web/src/ui/fields.tsx` e `packages/geom/src/numberText.ts`.

1. **O modelo continua em metros (SI).** Unidades existem só na fronteira: o texto que o usuário lê e o que ele digita.
   Nenhum valor guardado muda e `SCHEMA_VERSION` não é incrementada.
2. **Configuração do projeto.** `ProjectSettings.units` (opcional, resolvido na leitura por `unitsOf`/`defaultUnits`)
   define unidade e casas de `length`, `smallLength`, `area`, `volume`, `angle`, `slope`, o separador decimal e a moeda.
   A interface fica em Propriedades → Padrões do projeto → botão **Unidades…** (`UnitsDialog`).
3. **Grandezas.** Comprimentos grandes usam `length`; espessuras, folgas e tolerâncias usam `smallLength`; áreas,
   volumes, ângulos e inclinações têm grandezas próprias; custos usam `currency`. Inclinação guarda a razão no SI:
   percentual = razão × 100 e graus = atan(razão).
4. **Leitura e escrita.** Texto de interface sai de `formatQuantity(units, grandeza, valorSI)`; campos usam
   `NumField quantity` (exibe e lê na unidade do projeto); texto digitado passa por `parseQuantityText`. Nada de
   `toFixed`, troca de ponto por vírgula ou unidade literal em código de interface.
5. **Fora de React** (engine, render, io) quem chama passa `unitsOf(project)`; não há estado global. Formatos de
   máquina (coordenadas SVG/DXF/IFC) usam `machineNumber` ou levam `// units-ok: <motivo>`.
6. **Trava.** `scripts/check-units.mjs` (no `npm run lint`) falha em qualquer ocorrência nova; a linha de base foi
   removida e só isenções justificadas com `// units-ok: <motivo>` são aceitas.
