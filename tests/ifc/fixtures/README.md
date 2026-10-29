# Modelos IFC de teste

Fixtures do importador de IFC (`packages/io/src/ifcImport/`). São arquivos grandes demais para o
repositório: baixe com o script e não versione o conteúdo. O `manifest.json` guarda o `sha256` de
cada arquivo para conferir a integridade sem depender da rede.

```powershell
node scripts/baixar-ifc.mjs                # conjunto normal (~4,3 MB)
node scripts/baixar-ifc.mjs --grandes      # inclui o sample do Revit (25 MB)
node scripts/baixar-ifc.mjs --so-verificar # confere o que já está no disco
```

Um arquivo existente com `sha256` diferente do remoto não é sobrescrito: o script avisa e só troca
com `--forcar`.

| Arquivo | Tamanho | Conteúdo | Licença | Fonte |
|---|---|---|---|---|
| `parede-janela.ifc` | 12.2 kB | uma parede com vão e janela (IFC4 ADD2 TC1) | buildingSMART — uso livre para teste | buildingSMART/Certification-datasets · ISO Spec ReferenceView V1.2 |
| `predio-simples.ifc` | 139.0 kB | prédio de dois pavimentos com paredes, lajes e vãos | buildingSMART — uso livre para teste | buildingSMART/Certification-datasets · Simple-Scene |
| `casa-pequena.ifc` | 55.6 kB | casinha pequena, útil para o caminho rápido do importador | IfcOpenShell — repositório sem licença declarada (uso local) | IfcOpenShell/files · tests/ISSUE_005_haus_60012.ifc |
| `fzk-haus.ifc` | 3.96 MB | FZK-Haus: casa completa exportada do Archicad | KIT — CC BY 4.0 (atribuição obrigatória) | opensourceBIM/TestFiles · AC11-FZK-Haus-IFC.ifc |

## Licenças

- **buildingSMART** (`parede-janela.ifc`, `predio-simples.ifc`): modelos de certificação, uso livre para teste.
- **IfcOpenShell** (`casa-pequena.ifc`): o repositório não declara licença; usar apenas localmente, sem redistribuir.
- **KIT / FZK-Haus** (`fzk-haus.ifc`): CC BY 4.0 — ao usar em material publicado, cite o KIT (Karlsruhe Institute of Technology).
- **Autodesk** (`revit-amostra.ifc`): projeto de amostra do Revit distribuído no `opensourceBIM/TestFiles`.

O `manifest.json` é gerado pelo próprio script; não edite à mão.
