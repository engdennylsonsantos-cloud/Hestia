/** Campos do renderer que a sombra sob demanda usa (`WebGLRenderer.shadowMap` tem estes dois). */
export interface MapaDeSombraRenderer {
  shadowMap: { autoUpdate: boolean; needsUpdate: boolean };
}

/**
 * Sombra sob demanda: por padrão o renderer refaz o mapa de sombra a cada quadro. Aqui ele não refaz: a cena marca o mapa
 * como sujo quando o modelo ou o sol mudam (`ModelScene.update`), e `aplicar`, antes de desenhar, pede a nova geração só
 * nesse quadro. Girar, dar zoom ou realçar não sujam o mapa: a luz e a geometria são as mesmas.
 */
export class SombraSobDemanda {
  private suja = true;

  /** Marca o mapa como sujo: o próximo `aplicar` pede a nova geração. */
  marcar(): void {
    this.suja = true;
  }

  /** Se o mapa está sujo, agora (sem alterar a marca). */
  get sujo(): boolean {
    return this.suja;
  }

  /**
   * Desliga a regeneração automática do renderer e, se o mapa estiver sujo, pede uma neste quadro. Devolve se pediu.
   */
  aplicar(renderer: MapaDeSombraRenderer): boolean {
    renderer.shadowMap.autoUpdate = false;
    if (!this.suja) return false;
    renderer.shadowMap.needsUpdate = true;
    this.suja = false;
    return true;
  }
}
