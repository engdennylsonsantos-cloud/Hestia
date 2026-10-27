# Regras comuns (leia antes de tudo)
Você trabalha no repositório Hestia (monorepo TypeScript, npm workspaces), na pasta atual (um git worktree próprio, branch própria). Contexto: modo "Criar/Editar perímetro" (telhado, piso, laje, forro). Leia primeiro docs/pendencias-perimetro.md e docs/decisoes/0033-modo-criar-editar-perimetro.md.
- As dependências já estão instaladas (npm ci). Valide com: npm run typecheck && npm run lint && npx vitest run (esperado verde: 423 arquivos, 4939 testes, mais os seus novos).
- eslint max-lines = 420 (sem contar linhas em branco e comentários). controller.ts e perimeterTool.ts estão no limite: se precisar acrescentar código lá, extraia para arquivos novos.
- Siga o estilo do código vizinho (nomes em português quando o arquivo já usa, comentários no mesmo nível de densidade).
- Mexa SOMENTE no escopo abaixo. Não crie pull request. Não faça push. Não rode git checkout/reset em outras branches.
- Faça commits pequenos na branch atual (git add dos arquivos tocados + git commit com mensagem em português, ex.: "feat(perimetro): ..."). Termine a mensagem de commit com a linha: Co-Authored-By: opencode deepseek-v4.1-flash <noreply@opencode.ai>
- Escreva testes unitários (vitest) para o que implementar.
- Ao terminar, imprima um RELATÓRIO FINAL: arquivos alterados, resultado de typecheck/lint/vitest (cole o resumo), decisões que tomou e dúvidas. Se algo falhar e você não conseguir corrigir, diga claramente o que falhou. Não declare sucesso sem ter rodado os três comandos.
