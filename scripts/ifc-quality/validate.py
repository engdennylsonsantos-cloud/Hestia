"""
Valida um IFC com o IfcOpenShell e devolve JSON: erros do schema, contagem por classe e volume/área por produto.
Uso: `python scripts/ifc-quality/validate.py arquivo.ifc [--geometry]`.
"""
import json
import sys

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.shape
import ifcopenshell.validate

CLASSES = [
    "IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY",
    "IFCWALL", "IFCDOOR", "IFCWINDOW", "IFCSLAB", "IFCROOF", "IFCSTAIR",
    "IFCSPACE", "IFCGRID", "IFCCOLUMN", "IFCBEAM", "IFCBUILDINGELEMENTPROXY",
    "IFCCOVERING", "IFCPROPERTYSET", "IFCMATERIALLAYERSET", "IFCOPENINGELEMENT",
]


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: python scripts/ifc-quality/validate.py arquivo.ifc [--geometry]", file=sys.stderr)
        return 2
    caminho = sys.argv[1]
    com_geometria = "--geometry" in sys.argv[2:]
    model = ifcopenshell.open(caminho)
    logger = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(model, logger)

    contagem = {}
    for classe in CLASSES:
        try:
            contagem[classe] = len(model.by_type(classe))
        except Exception:
            contagem[classe] = 0

    resultado = {
        "arquivo": caminho,
        "schema": model.schema,
        "erros": [
            {k: (v if isinstance(v, (str, int, float, bool)) or v is None else str(v)) for k, v in st.items()}
            if isinstance(st, dict)
            else str(st)
            for st in logger.statements
        ],
        "contagem": contagem,
    }

    if com_geometria:
        settings = ifcopenshell.geom.settings()
        settings.set("use-world-coords", True)
        volumes = {}
        for produto in model.by_type("IfcProduct"):
            if not getattr(produto, "Representation", None):
                continue
            try:
                forma = ifcopenshell.geom.create_shape(settings, produto)
                volumes[produto.GlobalId] = {
                    "classe": produto.is_a(),
                    "volume": ifcopenshell.util.shape.get_volume(forma.geometry),
                    "area": ifcopenshell.util.shape.get_area(forma.geometry),
                }
            except Exception as erro:  # geometria opcional: um produto ruim não derruba o relatório
                volumes[produto.GlobalId] = {"classe": produto.is_a(), "erro": str(erro)}
        resultado["geometria"] = volumes

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    return 0 if not resultado["erros"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
