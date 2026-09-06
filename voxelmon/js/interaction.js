/**
 * Sistema general de interacción contextual (Fase 3).
 *
 * Cualquier entidad interactuable (santuarios, NPC, futuros cofres/puertas/
 * mesas) se registra con posición, alcance, prompt y acción. El sistema
 * selecciona el interactuable válido más cercano al jugador y ejecuta una
 * única acción por pulsación de E.
 *
 * El conjunto registrado se mantiene pequeño a propósito: solo entidades
 * cercanas al jugador (los santuarios se registran desde el sondeo periódico
 * de estructuras y los NPC al activarse por distancia), de modo que la
 * consulta por frame es un bucle sobre unas pocas entradas, sin raycasts
 * globales.
 *
 * Interactuable:
 *   {
 *     id,          // único, determinista
 *     type,        // "shrine" | "npc" | ...
 *     x, y, z,     // centro de interacción en coordenadas de mundo
 *     range,       // distancia máxima (3D) al jugador
 *     prompt,      // texto sin la tecla ("Hablar con Alba")
 *     enabled?,    // () => bool opcional
 *     onInteract,  // (item) => void
 *     data?,       // referencia libre (estructura, npc…)
 *   }
 */

class InteractionSystem {
  constructor() {
    this.items = new Map();
  }

  register(item) {
    this.items.set(item.id, item);
    return item;
  }

  unregister(id) {
    this.items.delete(id);
  }

  has(id) {
    return this.items.has(id);
  }

  clear() {
    this.items.clear();
  }

  /** Ids registrados, opcionalmente filtrados por tipo */
  ids(type = null) {
    const out = [];
    for (const it of this.items.values()) {
      if (!type || it.type === type) out.push(it.id);
    }
    return out;
  }

  /**
   * Interactuable válido más cercano al jugador (posición de los pies).
   * La distancia se mide en 3D contra el centro del interactuable, con el
   * jugador representado a la altura del pecho para tolerar desniveles.
   */
  current(playerPos) {
    let best = null;
    for (const it of this.items.values()) {
      if (it.enabled && !it.enabled(it)) continue;
      const d = Math.hypot(it.x - playerPos.x, it.y - (playerPos.y + 1), it.z - playerPos.z);
      if (d <= it.range && (!best || d < best.d)) best = { it, d };
    }
    return best ? best.it : null;
  }

  /** Ejecuta la interacción actual. Devuelve true si había algo que activar. */
  interact(playerPos) {
    const it = this.current(playerPos);
    if (!it) return false;
    it.onInteract(it);
    return true;
  }
}

export const interaction = new InteractionSystem();
