# 07 · Status da versão de teste (Fases 0 a 3)

## O que está pronto
- Monorepo com CI (lint, tipos, testes, build), fronteiras entre camadas verificadas por script e limite de 420 linhas por arquivo.
- **Modelo**: níveis, materiais, tipos de parede em camadas, tipos de abertura, instâncias, comandos serializáveis com desfazer/refazer, migração de esquema.
- **Parede composta**: camadas com função, linha de localização (6 opções), lado externo, junções L/T/X por prioridade, quantitativos por camada.
- **Aberturas**: porta e janela hospedadas, recorte em todas as camadas, peças acima/abaixo do vão no 3D.
- **Ferramentas**: selecionar (clique, janela, alças, arrastar), parede (encadeada, medida digitada), porta, janela, mover, copiar, girar, espelhar, matriz, deslocar, aparar ao canto, alinhar, medir.
- **Interface**: faixa de ferramentas, barra de opções, propriedades (tipo + instância), navegador de projeto, abas de vistas, diálogos de tipo (camadas e seção ao vivo), materiais, níveis e tipos de abertura.
- **Vistas**: planta por nível com subpavimento, 3D com luz, sombras e câmera orbital.
- **GPU/CPU**: WebGL2 (WebGPU opt-in) com queda para planta em CPU.

## O que ainda não existe
Piso, laje, telhado, escada, ambiente, forro, pilar/viga, corte e elevação, pranchas, cotas permanentes, IFC/DXF/PDF, nuvem, arcos de parede, retorno de acabamento no vão, junção de 3+ paredes sem par colinear (aproximada).

## Roteiro de teste (10 minutos)
1. Abra a casa de 2 quartos. Passe o mouse sobre paredes (realce) e clique em uma (propriedades e cota temporária).
2. Em **Propriedades**, troque o tipo de uma parede. Clique em **Editar tipo…**, adicione uma camada, mude um material, veja a seção. OK. Desfaça com Ctrl+Z.
3. Pressione **W**, desenhe um circuito; digite `3,5` e Enter para uma parede de 3,5 m; Tab inverte o lado externo.
4. **D** e **J** inserem porta e janela; **Espaço** inverte a dobradiça.
5. Selecione paredes e use **M, C, R, S, A, O, T, L**. Em Mover, as paredes vizinhas acompanham.
6. Abra **Pavimento 2** (subpavimento aparece apagado) e o **Modelo 3D** (arraste para girar, roda para aproximar).
7. Alterne o tema (sol/lua). Redimensione a janela: em telas estreitas os painéis viram gavetas.
8. **Salvar** exporta o projeto; **Abrir** carrega um `.hestia.json`.

## Como rodar
```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run check          # lint + tipos + testes
npm run build:artifact # gera apps/web/dist/artifact.html
npm run e2e            # fluxo no navegador (requer Chromium do Playwright)
```
