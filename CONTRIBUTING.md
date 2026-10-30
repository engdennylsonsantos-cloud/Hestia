# Contribuindo com o Hestia

Obrigado pelo interesse. O Hestia é open source sob a **MIT** e aceita
contribuições de código, testes, documentação e relatos de bug.

## Regras da contribuição

Ao enviar um pull request, você concorda que:

1. A contribuição é sua autoria, ou você tem o direito de enviá-la.
2. A contribuição é licenciada sob a **MIT**, para todos, de forma não exclusiva.
3. Você **mantém o copyright** da sua contribuição.
4. **Não há pagamento, royalty ou participação em receita** pela contribuição.
5. O projeto pode usar a contribuição no Hestia, sem obrigação de remuneração.
6. O projeto **não pode relicenciar** a sua contribuição para outra licença sem a
   sua permissão.
7. A marca “Hestia”, o logo e o domínio `hestiabim.com` não são licenciados junto
   com o código.

**Não pedimos CLA nem cessão de direitos.** A contribuição entra sob MIT, como o
resto do projeto. Veja [LICENSING.md](LICENSING.md) e [NOTICE](NOTICE).

## Antes de abrir o PR

- Rode `npm run check` (lint, tipos e testes).
- Mantenha o padrão do projeto: TypeScript, testes para o modelo, arquivos com no
  máximo ~420 linhas e mudanças de esquema com migração.
- Para mudanças grandes, abra uma issue antes para alinhar o escopo.
- Não envie código de terceiros sem licença compatível com a MIT.
- Não inclua credenciais, dados de clientes ou arquivos de projeto reais.

## Como contribuir

1. Faça um fork e crie uma branch curta a partir de `main`.
2. Faça a mudança e os testes.
3. Rode `npm run check`.
4. Abra o PR explicando o problema, a solução e como testar.
5. Se o PR alterar comportamento visível, inclua uma captura ou um teste e2e.

## O que acontece depois

- O mantenedor revisa e pode pedir ajustes.
- Nem todo PR é aceito; o projeto prioriza o roteiro em [docs/04-ROTEIRO.md](docs/04-ROTEIRO.md).
- O merge não cria vínculo de emprego, sociedade ou direito a receita.

## Código de conduta

Seja direto e respeitoso. Discussão técnica é bem-vinda; ataques pessoais,
assédio e discriminação não são.
