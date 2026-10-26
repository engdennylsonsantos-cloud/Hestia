# Menu de contexto (botão direito) e repetir comando

Paridade com o menu de botão direito do Revit (planta, corte e 3D) e com o "repetir último comando" (Espaço).
Código: `apps/web/src/editor/contextMenu.ts` (árvore pura), `editor/recentCommands.ts` (registros e Espaço),
`ui/PopupMenu.tsx` (menu genérico), `ui/CanvasContextMenu.tsx` e `ui/useCanvasContextMenu.ts` (execução e ligação).

Legenda: **Implementado** = funciona no Hestia. **Em breve** = aparece esmaecido com a dica "ainda não disponível".
`[a confirmar]` = nome ou comportamento que a pesquisa na web não confirmou; o nome PT-BR segue a convenção do Revit em português
e deve ser conferido no Revit em PT-BR.

## Pesquisa (o que foi confirmado)

- Repetir e Comandos recentes: o botão direito na área de desenho traz "Repeat [Last Command]" e "Recent Commands" (submenu).
  A Autodesk indica também Enter para repetir o último comando. Comandos de vista e de edição (Modificar, desfazer, copiar,
  concluir/cancelar) não entram na lista de recentes. Fonte: [Arkance, "Revit - Repeat Recent or Last Command"](https://ukcommunity.arkance.world/hc/en-us/articles/21574686694674-Revit-Repeat-Recent-or-Last-Command).
- Criar semelhante: escolhe a ferramenta do tipo do elemento com o tipo já selecionado no Seletor de tipo. Fonte: [Autodesk Help, "Copying Elements with the Create Similar Tool"](https://help.autodesk.com/cloudhelp/2014/ENU/Revit/files/GUID-4460B588-3FF6-4AA5-9E35-2E452E7070BA.htm).
- Substituir gráficos na vista: botão direito no elemento, "Override Graphics in View". Fonte: [Autodesk Help, Override Graphics in View](https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-87A17889-83BA-4C8F-A6B4-9A47B0869015.htm).
- Selecionar todas as instâncias: "Visível na vista" e "No projeto inteiro" (EN: "Visible in View", "In Entire Project"). Confirmado em
  resultado de busca de documentação; a fonte exata não foi guardada.
- Ocultar na vista (EN "Hide in View" > "Elements"): confirmado só em fórum de usuários
  ([Revit Ideas](https://forums.autodesk.com/t5/revit-ideas/hide-isolate-by-type/idc-p/12474268)). Não é documentação oficial.
- Nenhuma fonte confirmou os nomes PT-BR de Ampliar região, Reduzir (2x), Ajustar zoom, Pan/Zoom anterior e próximo, nem a ordem
  exata de Navegador e Propriedades no menu. Nomes EN de zoom e Pan/Zoom também ficaram como [a confirmar].

## Planta sem seleção (modo Modificar)

| Item (PT-BR) | Item (EN) | Hestia |
|---|---|---|
| Repetir [último comando] | Repeat [Last Command] | Implementado (atalho: Espaço) |
| Comandos recentes ▸ | Recent Commands | Implementado (últimos 8 comandos) |
| Selecionar anterior | Select Previous | Implementado |
| Localizar vistas de referência | Locate Reference Views [a confirmar] | Em breve |
| Ampliar região | Zoom In Region [a confirmar] | Em breve |
| Reduzir (2x) | Zoom Out (2x) [a confirmar] | Implementado (mesmo passo da barra de navegação) |
| Ajustar zoom | Zoom to Fit | Implementado (PT [a confirmar]) |
| Pan/Zoom anterior | Previous Pan/Zoom [a confirmar] | Em breve |
| Próximo Pan/Zoom | Next Pan/Zoom [a confirmar] | Em breve |
| Navegador | Browser [a confirmar] | Implementado (marca, liga/desliga) |
| Propriedades | Properties [a confirmar] | Implementado (marca, liga/desliga) |

## Planta com elemento selecionado

| Item (PT-BR) | Item (EN) | Hestia |
|---|---|---|
| Repetir [último comando] | Repeat [Last Command] | Implementado |
| Comandos recentes ▸ | Recent Commands | Implementado |
| Ocultar na vista ▸ | Hide in View [fonte: fórum] | Em breve (Elementos, Categoria, Por filtro: PT [a confirmar]) |
| Substituir gráficos na vista | Override Graphics in View | Em breve |
| Criar semelhante | Create Similar | Implementado para parede, porta, janela, piso, laje, forro e telhado. Escada e ambiente: em breve |
| Editar família | Edit Family | Em breve (só portas e janelas, que são as famílias carregáveis do Hestia) |
| Selecionar todas as instâncias ▸ | Select All Instances | "Visíveis na vista": implementado (só com um tipo). "No projeto inteiro": em breve |
| Excluir | Delete | Implementado |
| Localizar vistas de referência | Locate Reference Views [a confirmar] | Em breve |
| Ampliar região, Reduzir (2x), Ajustar zoom, Pan/Zoom anterior e próximo, Navegador, Propriedades | igual à tabela anterior | igual à tabela anterior |

## Durante ferramenta de criação (ex.: Parede)

| Item (PT-BR) | Item (EN) | Hestia |
|---|---|---|
| Cancelar | Cancel | Implementado (mesmo efeito do Esc) |
| Comandos recentes ▸ | Recent Commands | Implementado |
| Opções de captura ▸ | Snap Overrides [a confirmar] | Em breve |
| Ampliar região, Reduzir (2x), Ajustar zoom, Pan/Zoom anterior e próximo | igual à planta | igual à planta |
| Propriedades | Properties [a confirmar] | Implementado |

Não aparecem Repetir nem Selecionar anterior durante a ferramenta.

## Vista 3D

- Sem seleção: a mesma lista da planta sem seleção, **sem** Localizar vistas de referência, e com **Rodas de navegação ▸**
  (Steering Wheels [a confirmar]), em breve.
- Com seleção: a lista da planta com seleção, sem Localizar, com Rodas de navegação.
- Durante ferramenta de criação: a lista da planta, com Rodas de navegação.
- Zoom: Reduzir (2x) usa o passo da barra de navegação 3D; Ajustar zoom enquadra o modelo (`fit`).

## Vista de corte

Mesma lista da planta (inclui Localizar vistas de referência).

## Espaço: repetir o último comando

- Só repete quando a ferramenta ativa é Selecionar, não há campo de texto, diálogo, menu aberto nem foco em botão (o Espaço
  ativaria o botão), e existe um último comando.
- Repete no **soltar** o Espaço, e só se nenhum ponteiro ou roda foi usado com ele preso. Assim não briga com o pan
  (Espaço + arrastar) nem com a ferramenta de parede (Espaço inverte o lado), que continuam como antes.
- Repetição automática da tecla (segurar) não conta.

## Decisões de comportamento

- O botão direito **não cancela mais a ferramenta** ao ser apertado. O menu abre ao soltar, sem arrasto acima de 4 px.
  "Cancelar" fica no menu, como no Revit.
- Clique direito em elemento fora da seleção seleciona só esse elemento. Sobre um selecionado, a seleção fica.
- Clique direito no vazio abre o menu "sem seleção" e **mantém** a seleção atual (não limpa).
- Shift+F10 ou a tecla Menu abrem o menu no centro da vista, com a seleção atual.
- O menu não aparece na vista de prancha.
- Em planta, o alvo do menu é o realce da Selecionar (o que o cursor destaca). Em 3D e corte, é o pick da vista.

## Pendências

- Localizar vistas de referência, Ampliar região, Pan/Zoom, Ocultar, Substituir gráficos, Opções de captura, Rodas de navegação
  e Editar família seguem em breve.
- Criar semelhante para escada e ambiente seguem em breve.
- Os nomes [a confirmar] precisam de conferência no Revit em PT-BR.
- O passo de Reduzir (2x) é o da barra de navegação (240 px), não um fator exato de 2x.
- O menu de árvore do Navegador de projeto (`ui/browser/Tree.tsx`) não foi trocado para o PopupMenu.
