# Hestia

BIM para arquitetura residencial, no navegador, construído do zero com GPU em primeiro lugar
(WebGPU, com queda para WebGL2/CPU) e núcleo geométrico separado da interface.

Este repositório começa pela documentação. O código nasce depois que as decisões abaixo estiverem fechadas.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| [docs/01-ARQUITETURA.md](docs/01-ARQUITETURA.md) | Camadas, GPU/CPU, núcleo em Rust/WASM, modelo de dados, comandos, regras de código |
| [docs/02-MODELO-BIM.md](docs/02-MODELO-BIM.md) | Como cada elemento funciona: tipos, camadas, parede, piso, laje, telhado, aberturas, escada |
| [docs/03-INTERFACE.md](docs/03-INTERFACE.md) | Layout, árvore de projeto, painel de propriedades, 2D x 3D, vistas, ferramentas |
| [docs/04-ROTEIRO.md](docs/04-ROTEIRO.md) | Fases de construção, critério de pronto de cada uma, o que fica fora da v1 |
| [docs/05-REFERENCIA-REVIT-ARCHICAD.md](docs/05-REFERENCIA-REVIT-ARCHICAD.md) | Como Revit e ArchiCAD funcionam de verdade, com fontes. **Manda sobre os demais** |
| [docs/07-STATUS-V1.md](docs/07-STATUS-V1.md) | O que a versão de teste já faz, o que falta e o roteiro de teste |
| [docs/06-PROPRIEDADES-E-DIALOGOS.md](docs/06-PROPRIEDADES-E-DIALOGOS.md) | Escopos de configuração, barra de opções, painel, diálogo do tipo, camadas, materiais |

## Princípios

1. O modelo guarda só o que o usuário decidiu. Tudo que é resolvido é derivado e cacheado.
2. Toda mudança é um comando, com desfazer e refazer.
3. 2D e 3D são vistas do mesmo modelo, nunca modelos separados.
4. Tipo e instância: mudar o tipo muda todas as instâncias.
5. Camadas, junções e quantitativos nascem da mesma estrutura de dados.
6. Núcleo sem interface: roda em Node e em teste, sem navegador.

## Como rodar

```bash
npm install
npm run dev
npm run check
```

Veja [docs/07-STATUS-V1.md](docs/07-STATUS-V1.md) para o estado atual e o roteiro de teste.
