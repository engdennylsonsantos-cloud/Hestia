# 03 · Interface

Meta: parecer um programa BIM de verdade. Para isso a interface segue **convenções estáveis**, não improvisos por ferramenta.

## 1. Layout

```
┌───────────────────────────────────────────────────────────────┐
│ Barra de título · acesso rápido (salvar, desfazer, refazer)   │
├───────────────────────────────────────────────────────────────┤
│ Abas: Arquitetura | Estrutura | Anotar | Vista | Gerenciar    │
│ Faixa de ferramentas (grupos: Construir, Modificar, ...)      │
├───────────────────────────────────────────────────────────────┤
│ Barra de opções (contextual à ferramenta ativa)               │
├──────────────┬────────────────────────────────┬───────────────┤
│ Propriedades │                                │ Navegador de  │
│ (instância + │      Área de trabalho          │ projeto       │
│  tipo)       │      (abas de vistas)          │ (árvore)      │
├──────────────┴────────────────────────────────┴───────────────┤
│ Barra de controle da vista (escala, estilo, corte) · status   │
└───────────────────────────────────────────────────────────────┘
```

- Painéis acopláveis, redimensionáveis, com layout salvo por usuário.
- **Barra de opções** acima do canvas mostra as opções da ferramenta ativa (tipo, linha de localização, altura).
  É aqui, e não em modais, que se escolhe o que a ferramenta cria.
- **Barra de status** diz o que fazer agora ("Clique no ponto inicial"), com os atalhos de inferência.

## 2. Árvore de projeto (navegador)

```
Projeto
├─ Vistas
│  ├─ Plantas (por nível)
│  ├─ Plantas de forro
│  ├─ Cortes
│  ├─ Elevações
│  └─ 3D
├─ Legendas
├─ Tabelas / Quantitativos
├─ Pranchas
├─ Famílias (por categoria → tipo)
└─ Grupos
```

- Duplo clique abre a vista em uma nova aba; botão direito: duplicar, renomear, excluir, propriedades.
- Famílias listam **tipos**; arrastar um tipo para a vista cria instância.
- Pranchas contêm **vistas posicionadas** (referências, não cópias).

## 3. Painel de propriedades

Sempre dois blocos, como no Revit:
1. **Seletor de tipo** no topo (lista de tipos da família, botão "editar tipo").
2. **Parâmetros de instância**, agrupados e recolhíveis (Restrições, Construção, Dimensões, Identidade, Fases, Gráficos).

Nada selecionado → propriedades da **vista** ativa (escala, nível de detalhe, estilo visual, intervalo de vista, fase).

Várias seleções: mostra só parâmetros comuns; valores diferentes aparecem como "variados".

Editar tipo abre **diálogo de tipo** (estrutura em camadas com pré-visualização da seção, material, gráficos, identidade).
Editar **tipo** afeta todas as instâncias; editar **instância** afeta uma. O painel deixa isso explícito.

## 4. Separação 2D e 3D

- Um único modelo; **vistas** são consultas sobre ele.
- 2D (planta, corte, elevação) e 3D vivem em abas independentes, cada uma com seu próprio estado de câmera/zoom.
- 2D renderiza **vetor** com pesos de linha por categoria e escala; 3D renderiza malha.
- Cada vista tem **propriedades de visibilidade/gráficos** (por categoria, por filtro), **intervalo de vista**
  (plano de corte, topo, base, profundidade), escala e nível de detalhe.
- **Modelos de vista** (templates) aplicáveis a várias vistas.
- Criar em 3D é permitido para o que faz sentido (mover, ajustar altura); desenhar paredes/pisos é em planta.

## 5. Ferramentas e como se usam

Grupos da faixa **Arquitetura**: Construir (parede, porta, janela, piso, teto, telhado, escada, guarda-corpo, componente),
Ambiente, Referência (nível, grade), Abertura.
Grupos **Modificar**: alinhar, deslocar, espelhar, mover, copiar, girar, aparar/estender, dividir, matriz, escala, excluir.

Todas seguem o contrato de ferramenta (doc 01 §7):
- **Cursor inteligente:** snaps e guias aparecem sem tecla.
- **Digitar a medida** a qualquer momento (campo temporário ao lado do cursor).
- **Tab** alterna opções (lado, linha de localização).
- **Esc** cancela o passo; segundo Esc sai da ferramenta.
- **Pré-visualização** sempre visível antes do clique.
- **Clique-direito** abre menu contextual do elemento ou da ferramenta.

## 6. Seleção e edição

- Janela da esquerda para a direita = contido; da direita para a esquerda = cruzando.
- **Filtro de seleção** (categorias) e **selecionar todas as instâncias** de um tipo.
- Alças (grips) por elemento: extremidades, arco, lado do piso, aba de inversão.
- **Cotas temporárias** aparecem ao selecionar e são editáveis na hora.

## 7. Design visual

- Linguagem sóbria: pouca cor, ícones lineares consistentes, tipografia única, espaçamento em grade.
- Tema claro e escuro; tamanho de fonte ajustável.
- Sem CSS inline espalhado: sistema de componentes (botão, campo numérico, seletor, grupo recolhível) e tokens de design.
- Campos numéricos com unidade, aceitam expressão (`3,50+0,15`).

## 8. Primeira experiência

- Modelos iniciais (casa térrea, sobrado, apartamento).
- Passos interativos dentro do canvas: parede, porta, 3D, compartilhar.
- Link de compartilhamento do modelo 3D desde a v1.
