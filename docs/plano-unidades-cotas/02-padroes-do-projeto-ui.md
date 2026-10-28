# Fase B: "Padrões do projeto" — diálogos "Unidades…" e "Cotas…"

Pré-requisito: Fase A concluída (U1 a U6). O diálogo "Cotas…" só faz sentido depois da Fase E e será criado lá (passo D9). Nesta fase: **somente Unidades**.

## Referência existente (leia antes)
- `apps/web/src/ui/Properties.tsx`: grupo recolhido `<Group title="Padrões do projeto" open={false}>` (tolerância de junção, altura de parede) e o chip "Editar níveis…" que faz `useUi.setState({ dialog: 'levels' })`.
- `apps/web/src/editor/state.ts`: tipo `DialogKind`.
- `apps/web/src/ui/dialogs/OtherDialogs.tsx` (e vizinhos): como os diálogos são registrados e renderizados; copie o padrão de um diálogo simples já existente (cabeçalho, corpo, rodapé OK/Cancelar, atalho Esc).

## Passos

### B1: registrar o diálogo
1. `state.ts`: acrescente `'units'` ao `DialogKind`.
2. Crie `apps/web/src/ui/dialogs/UnitsDialog.tsx` (e `unitsDialogModel.ts` com a lógica pura, para teste). Registre onde os outros diálogos são montados.
3. `Properties.tsx`: dentro de "Padrões do projeto", acrescente o botão **"Unidades…"** com o **mesmo componente/estilo** do "Editar níveis…" (`useUi.setState({ dialog: 'units' })`).

### B2: conteúdo do diálogo
Título "Unidades do projeto". Tabela com uma linha por grandeza (colunas: Grandeza · Unidade · Casas decimais · Suprimir zeros), nesta ordem e com estes rótulos:
Comprimento · Comprimento pequeno (espessuras e folgas) · Área · Volume · Ângulo · Inclinação.
Abaixo: **Símbolo decimal** (vírgula/ponto) e **Símbolo de moeda** (texto curto). Quando a unidade for `ft-in`, mostrar "Fração" (denominador) no lugar de "Casas decimais".
Rodapé: **Exemplo ao vivo** (uma linha por grandeza: `1234,5678 m → 1234,57 m` calculada com `formatQuantity` e as escolhas do rascunho), botão **Restaurar padrões**, **OK**, **Cancelar**.
Opções de unidade por grandeza = as da Fase A (nomes por extenso em português: "Metros", "Centímetros", "Milímetros", "Pés", "Polegadas", "Pés e polegadas", "m²", "cm²", "ft²", "m³", "Litros", "ft³", "Graus", "Radianos", "Porcentagem").

### B3: lógica do rascunho
`unitsDialogModel.ts` (puro, testado):
- `draftFrom(units: ResolvedUnits)`, `applyDraft(draft): UnitsSettings` (grava só o que difere do padrão; se tudo igual ao padrão devolve `undefined`, e o diálogo grava `units: undefined`), `validateDraft(draft): string | null` (decimais inteiros 0..5, moeda 1–4 caracteres).
- Confirmar emite **um único** comando `setSettings` (um passo de desfazer): `editor.store.exec({ type: 'setSettings', patch: { units } })`. Ao desfazer, a interface inteira volta à unidade anterior.
- Todo o aplicativo reage sozinho porque `useUnits()` assina o projeto (não force re-render manual).

### B4: testes
- Modelo do diálogo: `draftFrom`/`applyDraft` ida e volta; padrão → `undefined`; validação.
- Componente: abre pelo botão; mudar Comprimento para `cm` e OK faz um `NumField quantity="length"` na tela mostrar cm; Cancelar não grava; Esc fecha sem gravar; Restaurar padrões; desfazer reverte (um passo).
- Acessibilidade: cada select/campo com `aria-label`; foco inicial no primeiro campo; Tab percorre na ordem.

Commit: `feat(unidades): B1-B4 diálogo Unidades… em Padrões do projeto`. Verificação: `npm run check`; abra o app (`npm run dev -w @hestia/web` ou o comando documentado no README), mude as unidades e confirme visualmente que um campo já migrado (ex.: espessura de parede no painel de propriedades — migrado na Fase C) atualiza. Se ainda não migrado, o teste de componente acima basta.
