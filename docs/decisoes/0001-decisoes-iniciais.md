# 0001 · Decisões iniciais

Data: 2026-10-19 · Origem: respostas do responsável pelo projeto.

| # | Decisão | Escolha | Consequência |
|---|---|---|---|
| 1 | Linguagem do núcleo geométrico | **TypeScript primeiro**, atrás de interface fixa | Migrar pontos lentos para Rust/WASM só depois de medir. A fronteira (entrada mínima, saída resolvida) não muda. |
| 2 | Referência principal | **Revit** | Prioridade de junção por função da camada; tipo/instância; paleta de propriedades. ArchiCAD entra só por ideias pontuais, registradas caso a caso. |
| 3 | Publicação para testes | **Só artefato/vitrine por enquanto** | Sem pipeline de deploy na Fase 0. Revisar quando houver um app que valha hospedar. |
| 4 | Acesso a Revit/ArchiCAD | **Não, só documentação** | Testes dourados nascem da documentação; o que não tem fonte fica `[?]` e é validado visualmente nas entregas. |
