/**
 * Sistema de diálogos data-driven (Fase 3).
 *
 * Separación:
 *  - DIALOGUES: datos declarativos (nodos, opciones, condiciones, acciones)
 *  - DialogueSystem: estado de la conversación + renderer DOM (#dialogue-ui)
 *
 * Las opciones pueden llevar:
 *  - `next`: id del siguiente nodo · `end: true`: cierra la conversación
 *  - `when`: condiciones declarativas (todas deben cumplirse). Predicados
 *    soportados: questAvailable / questActive / questCompleted / flag.
 *  - `actions`: lista de acciones de un conjunto CERRADO registrado por el
 *    juego (startQuest, trade, heal, setFlag…). Nunca se ejecuta código
 *    arbitrario definido en los datos. Si un handler devuelve `false`
 *    (p. ej. un trade sin recursos), la navegación al siguiente nodo se
 *    cancela y la conversación permanece en el nodo actual.
 *
 * main.js conecta onOpen/onClose para gestionar modo de juego y pointer lock.
 */

export const DIALOGUES = {
  researcher_intro: {
    npcName: "Alba",
    nodes: {
      start: {
        text: "¡Un rostro nuevo por el asentamiento! Soy Alba, investigo a las criaturas de esta región desde este pequeño laboratorio.",
        options: [
          { text: "¿Qué es este lugar?", next: "about" },
          {
            text: "¿Algún desafío nuevo?",
            next: "trainer_intro",
            when: { questAvailable: "quest_first_challenge" },
          },
          {
            text: "¿Tienes trabajo para mí?",
            next: "quest_offer",
            when: { questAvailable: "quest_apricorns" },
          },
          {
            text: "Sigo buscando esos apricornos.",
            next: "encourage",
            when: { questActive: "quest_apricorns" },
          },
          {
            text: "¿Y ahora qué hago?",
            next: "next_steps",
            when: { questCompleted: "quest_apricorns" },
          },
          { text: "Hasta luego.", end: true },
        ],
      },
      about: {
        text: "Un refugio para viajeros e investigadores. Bruno cambia recursos en su puesto y Sena cuida de las criaturas heridas. Explora los alrededores: cada bioma esconde criaturas y recursos distintos.",
        options: [
          { text: "Entendido.", next: "start" },
        ],
      },
      quest_offer: {
        text: "Estudio los apricornos: con ellos se fabrican cubos de captura. Crecen como arbustos naranjas en bosques y llanuras. ¿Me traes 3?",
        options: [
          {
            text: "Cuenta conmigo.",
            actions: [{ type: "startQuest", questId: "quest_apricorns" }],
            next: "quest_accepted",
          },
          { text: "Ahora no puedo.", end: true },
        ],
      },
      quest_accepted: {
        text: "¡Gracias! Busca arbustos naranjas cerca de los árboles y mínalos. Cuando los tengas, ven a verme… aunque me enteraré igualmente.",
        options: [{ text: "Voy a por ellos.", end: true }],
      },
      encourage: {
        text: "Los apricornos crecen sobre la hierba, sobre todo en el bosque. Son arbustos naranjas fáciles de ver de día.",
        options: [{ text: "Sigo buscando.", end: true }],
      },
      next_steps: {
        text: "Lleva tus apricornos a Bruno, el comerciante: te los cambiará por cubos de captura. Después, ¡sal ahí fuera y hazte con un buen equipo!",
        options: [{ text: "Gracias, Alba.", end: true }],
      },
      trainer_intro: {
        text: "Milo, un joven entrenador, anda buscando rival junto al huerto. Si de verdad quieres crecer, empieza por vencerle a él… y a los que vengan después. Dicen que quien derrota a Ross, el guardabosques, está listo para el gimnasio.",
        options: [
          {
            text: "Lo desafiaré.",
            actions: [{ type: "startQuest", questId: "quest_first_challenge" }],
            next: "trainer_luck",
          },
          { text: "Quizá más tarde.", end: true },
        ],
      },
      trainer_luck: {
        text: "¡Esa es la actitud! Cura a tu equipo con Sena o en un santuario antes de cada combate. ¡Suerte!",
        options: [{ text: "¡A por ello!", end: true }],
      },
    },
  },

  merchant_intro: {
    npcName: "Bruno",
    nodes: {
      start: {
        text: "¡Bienvenido a mi puesto! Por aquí los apricornos valen su peso en cubos de captura. ¿Hacemos negocio?",
        options: [
          {
            text: "Cambiar 3 apricornos por 1 cubo.",
            actions: [{ type: "trade", tradeId: "apricorn_balls" }],
            next: "traded",
          },
          { text: "¿Quién eres?", next: "about" },
          { text: "Hasta luego.", end: true },
        ],
      },
      traded: {
        text: "¡Trato hecho! Un cubo recién pulido. ¿Algo más?",
        options: [
          {
            text: "Otro cambio (3 apricornos → 1 cubo).",
            actions: [{ type: "trade", tradeId: "apricorn_balls" }],
            next: "traded",
          },
          { text: "Eso es todo.", end: true },
        ],
      },
      about: {
        text: "Bruno, artesano y comerciante. Tallo cubos de captura con lo que me traen los viajeros. Algún día montaré una tienda de verdad…",
        options: [{ text: "Volvamos al negocio.", next: "start" }],
      },
    },
  },

  // ---------- Entrenadores (Fase 4) ----------

  trainer_milo: {
    npcName: "Milo",
    nodes: {
      start: {
        text: "¡Eh, tú! Yo también entreno criaturas. Aún soy novato, pero no pienso ponértelo fácil. ¿Combatimos?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "trainer_milo" }],
            end: true,
          },
          { text: "Ahora no.", end: true },
        ],
      },
    },
  },
  trainer_milo_done: {
    npcName: "Milo",
    nodes: {
      start: {
        text: "Buen combate… me diste una lección. Seguiré entrenando junto al huerto. ¡Vera te espera en el camino del este!",
        options: [{ text: "¡Sigue así, Milo!", end: true }],
      },
    },
  },

  trainer_vera: {
    npcName: "Vera",
    nodes: {
      start: {
        text: "Soy Vera, exploro estas tierras con mi equipo. Pocos viajeros aguantan mis dos criaturas. ¿Te atreves?",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "trainer_vera" }],
            end: true,
          },
          { text: "Mejor en otro momento.", end: true },
        ],
      },
    },
  },
  trainer_vera_done: {
    npcName: "Vera",
    nodes: {
      start: {
        text: "Vaya combate… ¡mereció la pena! Si buscas un reto de verdad, Ross vigila las colinas del noreste. Nadie le ha ganado todavía.",
        options: [{ text: "Iré a por él.", end: true }],
      },
    },
  },

  trainer_ross: {
    npcName: "Ross",
    nodes: {
      start: {
        text: "Soy Ross, guardabosques. Mi deber es comprobar quién está listo para el gimnasio… y hasta hoy nadie lo ha estado. Tres criaturas me acompañan. ¿Aceptas la prueba?",
        options: [
          {
            text: "Estoy listo. ¡Vamos!",
            actions: [{ type: "startTrainerBattle", trainerId: "trainer_ross" }],
            end: true,
          },
          { text: "Todavía no.", end: true },
        ],
      },
    },
  },
  trainer_ross_done: {
    npcName: "Ross",
    nodes: {
      start: {
        text: "Impresionante. Has demostrado que estás listo para buscar el primer gimnasio. Cuando exista un camino, tú serás quien lo recorra primero.",
        options: [{ text: "Gracias, Ross.", end: true }],
      },
    },
  },

  healer_intro: {
    npcName: "Sena",
    nodes: {
      start: {
        text: "Soy Sena. Cuido de las criaturas heridas de quienes pasan por aquí. Las tuyas parecen en buenas manos.",
        options: [
          {
            text: "¿Puedes curar a mi equipo?",
            actions: [{ type: "heal", source: "healer" }],
            next: "healed",
          },
          { text: "¿Qué son esos santuarios de cristal?", next: "shrines" },
          { text: "Adiós.", end: true },
        ],
      },
      healed: {
        text: "Listo: tu equipo está como nuevo. Vuelve cuando lo necesites, no cobro a los amigos de las criaturas.",
        options: [{ text: "Gracias, Sena.", end: true }],
      },
      shrines: {
        text: "Reliquias antiguas coronadas con un cristal luminoso. Acércate y actívalas: restauran por completo a tu equipo. Hay varios repartidos por el mundo.",
        options: [{ text: "Los buscaré.", next: "start" }],
      },
    },
  },
};

const $ = (id) => document.getElementById(id);

class DialogueSystem {
  constructor() {
    this.current = null; // { def, nodeId, ctx }
    this.actions = new Map();
    this.conditions = {};
    this.onOpen = null;
    this.onClose = null;
  }

  /** Registra un handler para un tipo de acción declarativa */
  registerAction(type, fn) {
    this.actions.set(type, fn);
  }

  /** Predicados para las condiciones `when` (questAvailable, flag…) */
  setConditions(map) {
    this.conditions = map;
  }

  get isOpen() {
    return !!this.current;
  }

  start(dialogueId, ctx = {}) {
    const def = DIALOGUES[dialogueId];
    if (!def || this.current) return;
    this.current = { def, nodeId: "start", ctx };
    this.onOpen?.();
    this.render();
  }

  close() {
    if (!this.current) return;
    this.current = null;
    $("dialogue-ui").classList.add("hidden");
    this.onClose?.();
  }

  checkWhen(when) {
    if (!when) return true;
    for (const key in when) {
      const fn = this.conditions[key];
      if (!fn || !fn(when[key])) return false;
    }
    return true;
  }

  visibleOptions(node) {
    return node.options.filter((o) => this.checkWhen(o.when));
  }

  choose(option) {
    if (!this.current) return;
    let ok = true;
    for (const action of option.actions ?? []) {
      const handler = this.actions.get(action.type);
      if (!handler) continue;
      if (handler(action, this.current.ctx) === false) ok = false;
    }
    if (!ok) {
      this.render(); // la acción falló (p. ej. trade sin recursos): no navegar
      return;
    }
    if (option.end) {
      this.close();
    } else if (option.next) {
      this.current.nodeId = option.next;
      this.render();
    } else {
      this.render();
    }
  }

  render() {
    if (!this.current) return;
    const { def, nodeId } = this.current;
    const node = def.nodes[nodeId];
    if (!node) { this.close(); return; }

    $("dialogue-name").textContent = def.npcName;
    $("dialogue-text").textContent = node.text;
    const box = $("dialogue-options");
    box.innerHTML = "";
    for (const opt of this.visibleOptions(node)) {
      const btn = document.createElement("button");
      btn.className = "btn dialogue-option";
      btn.textContent = opt.text;
      btn.addEventListener("click", () => this.choose(opt));
      box.appendChild(btn);
    }
    $("dialogue-ui").classList.remove("hidden");
  }
}

export const dialogue = new DialogueSystem();
