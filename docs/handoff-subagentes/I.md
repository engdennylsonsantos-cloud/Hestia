# Tarefa I: integração das branches dos agentes em perim/integracao
Você está no worktree de integração (branch perim/integracao). Já foram integradas as branches perim/E, perim/C, perim/D e perim/H. Há um merge de perim/A EM ANDAMENTO com conflitos em packages/tools/src/perimeterToolInput.ts e tests/e2e/helpers.mjs (veja git status). Depois falta integrar perim/G. Contexto das branches:
- A: realce azul sólido, hover, janela de seleção, Shift/Ctrl, Ctrl+A (esboço do perímetro).
- D: grips do telhado só nos cantos lógicos, snap nos comandos de Modificar, destino dx,dy (vírgula decimal preservada), activateView, exhaustive-deps.
- G: Selecionar ativo no modo, Ctrl+A e Shift na camada do app, e2e tests/e2e/perimetro-selecao.mjs. G e A implementaram partes parecidas (Ctrl+A e Shift) em apps/web/src/editor/controller.ts, perimeterMode.ts, ViewportCanvas.tsx.
- H: renomeia Girar para Rotacionar; Mover/Rotacionar/Espelhar não arrastam vizinhas.
Faça, nesta ordem:
1. Resolva os conflitos do merge de A: mantenha as duas mudanças (as de D e as de A) em perimeterToolInput.ts (leia os dois lados com cuidado: nenhuma funcionalidade pode sumir); em helpers.mjs deixe uma única versão que aceita process.env.CHROME_PATH como primeira opção. git add e git commit (mensagem de merge padrão + linha Co-Authored-By: opencode deepseek-v4.1-flash <noreply@opencode.ai>).
2. Rode npm run typecheck && npm run lint && npx vitest run e corrija o que falhar (max-lines 420!).
3. git merge perim/G (permitido). Resolva conflitos mantendo UMA implementação de Ctrl+A e Shift por gesto (prefira a que está mais perto da ferramenta do perímetro, a do A, e conserve do G o que for só dele: estado do botão Selecionar na faixa, Selecionar ativo no modo, Esc volta à seleção, o e2e perimetro-selecao.mjs). Não duplique handlers: confirme que Ctrl+A seleciona as linhas uma vez só.
4. Em packages/tools/src/perimeterToolModifyMove.ts linhas ~40-41 troque os textos "Girar" por "Rotacionar" (resto da renomeação do H).
5. Rode de novo typecheck, lint, vitest, depois npm run build e os e2e: node tests/e2e/perimetro-realce.mjs, node tests/e2e/perimetro-selecao.mjs (os passos de caixa de G devem agora passar com a lógica do A; corrija o que impedir), node tests/e2e/perimetro-modificar.mjs, node tests/e2e/dim-capturas.mjs. Olhe as capturas de test-results/selecao e test-results/realce e confirme que o realce e a caixa funcionam em piso E telhado.
6. Commit final das correções de integração (git add só do necessário; nunca test-results/dist/node_modules).
7. RELATÓRIO FINAL: como resolveu cada conflito, resultados reais (números) de typecheck, lint, vitest e de cada e2e, e qualquer problema que sobrou.
