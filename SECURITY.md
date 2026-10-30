# Segurança

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.**

Use a aba **Security → Report a vulnerability** deste repositório
(GitHub Security Advisories). O relato fica privado entre você e o mantenedor.

Inclua, se possível:

- commit ou versão afetada;
- navegador, sistema e backend gráfico (WebGL2/WebGPU);
- passos para reproduzir;
- impacto esperado;
- prova de conceito ou arquivo mínimo.

Não envie credenciais, dados de clientes ou projetos reais. Se precisar anexar um
`.hestia.json`, remova informações sensíveis antes.

## Escopo

- aplicação web em `apps/web`;
- motor geométrico em `packages/engine`;
- importação/exportação em `packages/io`;
- renderização em `packages/render`;
- dependências e CI.

## Fora de escopo

- falhas que dependem de extensão maliciosa instalada pelo próprio usuário;
- engenharia social;
- negação de serviço trivial no navegador do próprio usuário;
- problemas de terceiros sem impacto no Hestia.

## Prazo

O projeto é mantido por uma pessoa. Vamos confirmar o recebimento e dar um retorno
inicial assim que possível; não há SLA corporativo.
