# Fase F: validação final e entrega

Faça somente depois das Fases A a E concluídas (ou marcadas com BLOQUEIO justificado em `PROGRESSO.md`).

## F1: suíte e construção
```bash
npm run check
npm run build
```
- Tudo verde. Se falhar algo que **não** é seu (linha de base anotada no passo 1 do LEIA-ME), liste em `PROGRESSO.md` e siga.
- `node scripts/check-units.mjs --report` deve mostrar 0 ocorrências sem justificativa.
- `grep -rn "openingDimMode\|temporaryDimensions\|OpeningTempDims\|formatMeters" packages apps` deve retornar vazio.
- Nenhum arquivo não-teste acima de 420 linhas (eslint garante).

## F2: verificação no navegador (Playwright, já instalado)
Suba o app (`npm run dev -w @hestia/web`, veja o README). Roteiro, anotando o resultado de cada item em `PROGRESSO.md` (OK ou defeito + o que fez):
1. Projeto novo → Propriedades → Padrões do projeto → **Unidades…**: mudar Comprimento para cm, Área para ft², Ângulo para rad; conferir painel de propriedades, barra de status, quadro de ambientes e cotas; desfazer volta tudo.
2. **Cotas…**: mudar referência de parede para "Face do núcleo" e de esquadria para "Vão livre"; colocar uma porta em parede de 3 camadas; conferir que as 2 cotas aparecem na prévia, mudam ao clicar nas alças, e o valor bate com a medição manual.
3. Selecionar a porta: cotas reaparecem; digitar um valor novo move a porta; digitar valor que a tira da parede mostra alerta e não muda; desfazer volta.
4. Parede selecionada: comprimento e distância às paralelas; editar; parede com porta na ponta não encurta além da porta (alerta).
5. Linha, perímetro, eixo, piso: cotas na criação e na seleção.
6. Mover/copiar: cota do deslocamento.
7. "I" converte em cotas permanentes; desfazer remove.
8. Fase D: batente na espessura acabada (padrão) e opção de núcleo; prévia de colocação idêntica à planta final; Espaço/Tab na hora; alças de inversão; aba Planta do modal com batente e folha.
Capturas de tela vão em `docs/plano-unidades-cotas/capturas/` (PNG pequenos, no máximo 10).

## F3: revisão cruzada
Releia seu próprio diff completo (`git diff origin/main...HEAD -- packages apps scripts` limitado aos arquivos desta tarefa) procurando: (1) texto de interface com número ainda fora de `formatQuantity`; (2) `any`, `@ts-ignore`, `console.log`; (3) funções novas sem teste; (4) `SCHEMA_VERSION` ou `package.json` alterados indevidamente (só o script `lint`); (5) código duplicado entre provedores (extraia). Corrija o que achar em commits `refactor(...)`.

## F4: documentação
- `docs/07-STATUS-V1.md` **não** editar. Em vez disso atualize `docs/PENDENCIAS-2026-10-28-cotas-padroes-esquadrias.md`: marque como **feito** os itens das seções A, B e C com o hash do commit; mantenha D, E e F.
- `docs/aberturas/F-PROGRESSO.md`: nota curta sobre S1 a S5.
- `docs/plano-unidades-cotas/PROGRESSO.md`: resumo final.

## F5: entrega
```bash
git status
git push -u origin claude/fervent-newton-rfgz3y
```
Responda ao dono em português com: fases concluídas, bloqueios, desvios do plano, resultado de `npm run check` e `npm run build`, pontos que ele deve validar visualmente (batente, alizar, cotas, unidades `ft-in`), e a lista de ações dele (ex.: regravar baselines de imagem). **Não** faça merge em `main` nem em `integracao/telhados-grades`.
