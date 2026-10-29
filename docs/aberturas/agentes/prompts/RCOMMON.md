# Instruções comuns de pesquisa (leia inteiro)

Você é pesquisador técnico do Hestia (software BIM). O objetivo é entender **a lógica de modelagem e as opções de configuração de portas e janelas** para parametrizar o nosso editor. Entregue um dossiê em Markdown, em português do Brasil, no arquivo indicado na sua tarefa (dentro desta worktree, em `docs/aberturas/archicad/`). Não altere código.

## Como pesquisar
- Use a ferramenta `webfetch` para ler páginas. Leia **muitas** páginas: a meta é cobertura completa, não um resumo rápido. Percorra os índices numerados indicados na tarefa (tente os números em sequência; página inexistente: siga em frente).
- Prefira as páginas de ajuda oficiais. Registre a **URL de cada página lida** no dossiê. Sites de fórum/blog/loja valem como apoio, marcados como tal.
- **Nunca invente.** Se não achou ou não consegue confirmar, escreva "NÃO CONFIRMADO". Diferencie claramente: [DOC] oficial lido por você, [FÓRUM/LOJA] apoio, [INFERIDO] dedução sua (diga o raciocínio).
- Trechos longos de copiar não: resuma com suas palavras e cite o nome exato dos campos, abas, opções e valores (em inglês original entre parênteses quando for de software), porque vamos mapear nomes e opções.
- Se uma página falhar ou vier vazia, tente a versão de outro idioma/versão (`/INT/`, `/BRA/`, `/POR/`; `AC18` a `AC30`) ou outra numeração.

## Formato do dossiê
1. Resumo executivo (10 a 15 linhas, o que mais importa para parametrizar o nosso editor).
2. Seções detalhadas por tema (tabelas de campos: nome, o que faz, valores/opções, padrão se houver, em qual aba/painel).
3. **Lógica de modelagem**: como o software constrói a peça (geometria, referências, o que depende do quê, ordem de cálculo).
4. Lista de fontes (URL, versão, tipo, o que continha).
5. Lacunas: o que não foi possível confirmar e onde provavelmente está.

Ao terminar: `git add` do arquivo e `git commit -m "docs(esquadrias): <tema>"`. Só diga que terminou depois de salvar e commitar. Escreva o dossiê **por partes** (salve e comite a cada tema concluído) para não perder trabalho.
