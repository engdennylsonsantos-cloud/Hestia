# Decisão 0034 · Esquadrias v2 (modelo único, editor e representação)

Decidido em 2026-10-26 com o dono, a partir de [D](../aberturas/D-editor-esquadrias-revit-archicad.md) e do protótipo.
Especificação técnica: [E](../aberturas/E-spec-modelo-unico.md).

1. **Modelo único.** Planta, corte, elevação, 3D, DXF e a prévia do diálogo desenham as peças de `buildOpeningModel`.
2. **Linha de abertura (V).** O vértice fica no lado **oposto** ao da dobradiça (lado do trinco); a posição da dobradiça é
   configurável (instância `flipHand`, padrão no tipo). A convenção é configurável no projeto
   (`ProjectSettings.openingLine`): `apex: 'latch' | 'hinge'` e `dashed: 'toward' | 'away'`. Substitui a convenção de 0024 §2.
3. **Bandeiras e vidros fixos** não levam linha de abertura.
4. **Colocação (estilo Revit).** O lado do cursor define o sentido; Espaço inverte a dobradiça; Tab inverte o sentido.
5. **Diálogo do tipo (estilo ArchiCAD).** Seções recolhíveis, biblioteca, 5 prévias, nível de detalhe 2D/3D.
6. **Schema fechado** (0017 §9) mantido; todo campo novo é opcional com padrão por leitura (`SCHEMA_VERSION` não muda).
7. **Famílias novas** (embutir, vai-e-vem, dobrável, sanfonada, seccionada, janela de abrir, guilhotina, pivotante,
   veneziana) entram na onda 2.
