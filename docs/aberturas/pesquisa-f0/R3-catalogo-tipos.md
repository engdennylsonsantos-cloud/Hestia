# R3 - Catálogo de tipos de portas e janelas (Hestia)

## Resumo para decisão

- O catálogo atual tem **106 tipos** (55 portas, 51 janelas) em **19 famílias** (10 de porta, 9 de janela). Tipos de uma célula estão bem cobertos.
- **Composição não existe no catálogo.** Nenhum tipo combina folhas, bandeira e fixos. Os campos `transom` (bandeira), `sidelights` (laterais) e `grid` já existem no schema com validação, mas nenhum tipo do catálogo os usa. A bandeira J-48/J-49 é janela separada.
- **Precisam do modelo de composição:** porta com bandeira e/ou laterais, porta com painel fixo, janela combinada (fixa central + abrir/correr laterais), stacked, bay/bow (3 ou 4+ células), janela de canto, porta de correr de canto (duas faces).
- **Podem seguir no modelo atual (uma célula ou família nova):** porta elevadora (lift-and-slide), porta de correr com 3+ folhas, correr embutido de 2 folhas, claraboia (se entrar como abertura).
- Duas famílias estão sub-especificadas: `door_sliding` aceita 1 ou 2 folhas, mas o catálogo só usa 2. Basculante e enrolar de garagem reaproveitam o símbolo do seccionado.
- Definição de "projetante", "vitrô" e eixo da basculante × maxim-ar não está confirmada pelas fontes (ver abaixo).

## Cobertura atual

Fonte: `packages/model/src/opening.ts` (família), `catalogoPortas.ts`, `catalogoJanelas.ts`, `catalogoAberturasBase.ts`. Os códigos P-01 a P-11, V-01, J-01 a J-11 e V-02 vêm de `defaults.ts` (lido só pelos códigos, não pelo conteúdo).

| Família (id) | Símbolo | Folhas aceitas | Tipos | Códigos |
|---|---|---|---|---|
| door_swing | swing | 1 | 22 | P-01 a P-03, P-12 a P-16, P-39 a P-44 (vidro temperado), 8 corta-fogo PF-30 a PF-120 (80 e 90) |
| door_double | double | 2 | 8 | P-04, P-17 a P-20, P-21 a P-23 (porta-balcão: veneziana + vidro) |
| door_sliding | sliding | 2 ou 1 | 3 | P-05, P-24, P-25 (só 2 folhas no catálogo) |
| door_pivot | pivot | 1 | 3 | P-06, P-28, P-29 |
| door_dblact | dblact | 1 ou 2 | 4 | P-07, P-32 a P-34 (vai-e-vem) |
| door_pocket | pocket | 1 | 3 | P-08, P-26, P-27 (embutir 1 folha) |
| door_bifold | bifold | 2 ou 4 | 3 | P-09, P-30 (camarão 2), P-31 (camarão 4) |
| door_accordion | accordion | 1 | 5 | P-10, P-35 a P-38 (sanfonada PVC) |
| door_garage | garage | 1 | 3 | P-11 (seccionado), P-45 (basculante), P-46 (enrolar) |
| door_void | swing (arco) | 0 | 1 | V-01 |
| window_fixed | fixed | 1 | 5 | J-05, J-44, J-45, J-48, J-49 (bandeira 90 cm) |
| window_void | fixed (tracejado) | 0 | 1 | V-02 |
| window_sliding | sliding | 2, 3 ou 4 | 12 | J-01, J-02, J-04, J-06, J-12 a J-19 |
| window_hinged | hinged | 1 ou 2 | 5 | J-07, J-40 a J-43 (de abrir / giro lateral) |
| window_hung | hung | 2 | 4 | J-08, J-37 a J-39 (guilhotina) |
| window_casement | casement | 1 | 7 | J-03, J-20 a J-24 (maxim-ar), J-50 (banheiro, peitoril 1,80) |
| window_tilt | tilt | 1 | 9 | J-11, J-25 a J-32 (basculante) |
| window_pivot | pivotwin | 1 | 5 | J-09, J-33 a J-36 (pivotante) |
| window_louver | louver | 1 | 3 | J-10, J-46, J-47 (veneziana) |

Observações do código: a porta-balcão é `door_double` com `leafStyle: 'louver'` e `glassRatio: 0.5`, não uma família própria. O vidro temperado é `door_swing` com material de vidro, e a corta-fogo usa `fireRating`.

## Tipos e classificação

Status: **CONFIRMADO** (no código ou em fonte citada), **PROVÁVEL** (conceito usual, fonte fraca ou ausente), **NÃO CONFIRMADO** (sem fonte encontrada).

| Tipo | Classificação | Movimento | Cobertura no Hestia | Status / fonte |
|---|---|---|---|---|
| Porta de giro 1 folha | simples | giro, eixo vertical | sim (door_swing) | CONFIRMADO (código) |
| Porta de giro 2 folhas (dupla) | simples (conjunto) | giro | sim (door_double) | CONFIRMADO (código) |
| Vai-e-vem | simples | giro nos dois sentidos | sim (door_dblact) | CONFIRMADO (código) |
| Pivotante | simples | eixo vertical deslocado | sim (door_pivot, mantida por decisão do dono) | CONFIRMADO (código) |
| Correr aparente (sobreposto), 2 folhas | simples | correr em trilho sobreposto | sim (door_sliding) | PROVÁVEL: trilho sobreposto é o mais usado no Brasil, segundo [Portal QuintoAndar](https://www.quintoandar.com.br/guias/?p=462896) e guia de instalação do [Larpontual](https://larpontual.com.br/portal/como-instalar-porta-de-correr) |
| Correr embutido, 1 folha | simples | correr dentro da parede | sim (door_pocket, 1 folha) | CONFIRMADO (código) |
| Correr embutido, 2 folhas | simples | correr dentro da parede | não | PROVÁVEL (embutir só tem 1 folha) |
| Correr com 3+ folhas | simples | correr | não (limite 2 folhas) | PROVÁVEL |
| Correr de canto (duas faces) | composta (canto) | correr em L | não | PROVÁVEL: [SlideMASTER](https://awsaustralia.com.au/?p=5862) cita "corner doors" no lift-slide |
| Porta elevadora (lift-and-slide) | simples | eleva a folha e corre | não | CONFIRMADO existe: [Arktipo](https://www.aecweb.com.br/produto/portas-elevaveis/118721), [Gretsch-Unitas](https://www.g-u.com/en/AT/products/window-technology/sliding-door-hardware/liftslide-hardware/manually-actuated.html). Uso em norma BR: NÃO CONFIRMADO |
| Camarão (2 e 4 folhas) | simples (conjunto) | dobra para um lado | sim (door_bifold) | CONFIRMADO (código). Diferença para sanfonada: PROVÁVEL |
| Sanfonada | simples | lâminas articuladas que se dobram | sim (door_accordion) | CONFIRMADO (código); PROVÁVEL que seja tipo usual (resultado de busca genérico, sem fonte de fabricante) |
| Porta-balcão | simples (conjunto de 2 folhas) | giro | sim, como variante de door_double | CONFIRMADO (código) |
| Vidro temperado (blindex) | simples | giro | sim (door_swing + material de vidro). Correr de vidro: não | CONFIRMADO (código) |
| Corta-fogo PF-30 a PF-120 | simples | giro | sim (fireRating) | CONFIRMADO (código) |
| Dobrável | simples (conjunto) | dobra | sim (door_bifold) | CONFIRMADO (código) |
| Portão seccionado | simples | seccionado vertical | sim (door_garage) | CONFIRMADO (código); Revit tem família "Garage Door" ([Revit Family Pack](https://balkan-architect.teachable.com/p/door-families)) |
| Portão basculante | simples | basculante | parcial (símbolo garage igual ao seccionado) | CONFIRMADO (código) |
| Portão de enrolar | simples | enrola em eixo | parcial (símbolo igual) | CONFIRMADO (código) |
| Porta com bandeira superior | composta (porta + fixo acima) | giro | não (campo `transom` existe, nenhum tipo usa) | CONFIRMADO (código); uso comum: PROVÁVEL |
| Porta com laterais (sidelights) | composta | giro | não (campo `sidelights` existe) | CONFIRMADO (código) |
| Porta com painel fixo | composta | giro ou correr | não | PROVÁVEL |
| Janela fixa | simples | nenhum | sim (window_fixed) | CONFIRMADO (código) |
| Janela de correr 2, 3 e 4 folhas | simples | correr horizontal | sim (window_sliding) | CONFIRMADO (código); [CEHOP-SE](https://orse-portal.cehop.se.gov.br/wp-content/uploads/2025/08/ES00114.pdf) lista como tipo de uso comum |
| Maxim-ar (projetante) | simples | abre para fora, eixo horizontal no topo | sim (window_casement) | CONFIRMADO (código, [Telhanorte](https://www.telhanorte.com.br/janela-maximar-de-aluminio-ouro-p20-100x60cm-branca-ebel-764116/p)). Eixo: fontes divergem |
| Projetante | sinônimo de maxim-ar em lojas | idem | sim (como maxim-ar) | PROVÁVEL: [CEHOP-SE](https://orse-portal.cehop.se.gov.br/wp-content/uploads/2025/08/ES00114.pdf) e lojas usam "projetante" para a folha que se projeta |
| Basculante | simples | eixo horizontal que inclina a folha | sim (window_tilt) | CONFIRMADO (código); fontes divergem sobre eixo ([Sienge](https://sienge.com.br/blog/janela-basculante-o-que-e/)) |
| Guilhotina | simples (2 folhas verticais) | desliza na vertical | sim (window_hung) | CONFIRMADO (código) |
| Pivotante | simples | eixo vertical deslocado | sim (window_pivot) | CONFIRMADO (código) |
| Janela de abrir (giro lateral) 1 e 2 folhas | simples | giro | sim (window_hinged) | CONFIRMADO (código) |
| Veneziana | simples | lâminas de vidro/alumínio | sim (window_louver) | CONFIRMADO (código); [Esquadrisul](https://www.telhanorte.com.br/Esquadrisul) |
| Bandeira (fixa acima da porta) | simples (peça fixa sobre a porta) | nenhum | sim como janela solta (J-48, J-49), não composta | CONFIRMADO (código) |
| Vitrô | indefinido | indefinido | não | NÃO CONFIRMADO: nenhuma fonte encontrada. No uso comum parece ser conjunto de lâminas, próximo da basculante |
| Janela de canto | composta (2 janelas em ângulo) | varia | não | PROVÁVEL |
| Combinada / stacked (fixa + abrir, uma acima da outra) | composta | varia | não | CONFIRMADO conceito: [Infinity Windows](https://www.infinitywindows.com/blog/window-style-combinations) ("picture windows above awning windows") |
| Bay window (3 painéis, central fixo + laterais angulados) | composta (3 células) | laterais abrem | não | CONFIRMADO: [Pella](https://pella.com/ideas/windows/bay-windows), [Energy Code Ace](https://energycodeace.com/site/custom/public/reference-ace-2019/Documents/gloss_baywindow.htm) |
| Bow window (curva, 4+ painéis) | composta (4+ células) | varia | não | CONFIRMADO: [Infinity Windows](https://www.infinitywindows.com/blog/window-style-combinations) ("four or more windows") |
| Janela com arco acima (arch) | composta | arco fixo sobre a folha | não | CONFIRMADO conceito: arch sobre casement ([Infinity Windows](https://www.infinitywindows.com/blog/window-style-combinations)) |
| Claraboia (skylight) | simples, em telhado | abre ou fixa | não | NÃO CONFIRMADO pela busca. Não é abertura de parede; decidir se entra no escopo |
| Hopper (abre para dentro, eixo inferior) | simples | abre para dentro | parcial (basculante) | NÃO CONFIRMADO pela busca; aproximação de uso comum |

## Lacunas que pedem pesquisa mais profunda

- **Prioridade alta:**
  - Composição em portas (bandeira, laterais, painel fixo) e janelas (combinada, stacked, arco sobre folha). Os campos já existem em `openingTypes.ts`; falta o catálogo e o desenho.
  - Bay e bow (3 e 4+ células). Comuns em residencial de médio e alto padrão.
  - Janela de canto e porta de correr de canto (duas faces).
- **Prioridade média:**
  - Porta elevadora (lift-and-slide), para padrão alto. Pesquisar fabricante brasileiro.
  - Porta de correr com 3+ folhas e correr embutido de 2 folhas (`door_sliding` e `door_pocket` hoje limitam a folha).
  - Família própria para portão basculante e enrolar (hoje compartilham o símbolo do seccionado).
  - Claraboia: decidir se é abertura de parede ou elemento de cobertura.
- **Prioridade baixa:**
  - Vitrô (definição nacional) e projetante (alias de maxim-ar?). Só vale pesquisar se o cliente pedir pelo nome.
  - Eixo da basculante e da maxim-ar, com catálogo de fabricante (Esquadrisul, Alumix, Ebel, Topsul). Hoje as fontes se contradizem.
- **Normas e fontes para a próxima rodada:**
  - ABNT NBR 10821-1 (terminologia) e 10821-2 (classificação das esquadrias externas): texto pago. A busca não trouxe a lista oficial de tipos de abertura.
  - NBR 15930 (portas de madeira): a busca não trouxe a classificação de tipos. A fonte encontrada trata apenas de terminologia e requisitos.
  - Bibliotecas ArchiCAD e Revit: a busca não trouxe a lista de tipos de janela do Revit. As fontes encontradas são packs de terceiros.
