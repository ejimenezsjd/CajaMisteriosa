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

  // ---------- Gimnasio Verde (Fase 5) ----------

  gym_guide_intro: {
    npcName: "Orla",
    nodes: {
      start: {
        text: "Bienvenida al Gimnasio Verde. Soy Orla, la guía. Aquí se demuestra dominio, no prisa: dos entrenadores, un puzzle de pedestales y, al final, Iris.",
        options: [
          { text: "¿Cuáles son las reglas?", next: "rules" },
          { text: "¿El puzzle?", next: "puzzle" },
          { text: "¿Quién queda?", next: "progress" },
          { text: "Gracias.", end: true },
        ],
      },
      rules: {
        text: "Derrota a Nilo y a Lira, y activa los tres pedestales en el orden correcto. Solo entonces se abrirá la sala de Iris. Si te equivocas en el puzzle, los pedestales se reinician: no hay castigo.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      puzzle: {
        text: "Tres pedestales: hoja, luz y agua. El orden es el de la naturaleza al amanecer: primero la hoja, luego la luz, después el agua. Un error lo borra todo.",
        options: [{ text: "Hoja, luz, agua.", next: "start" }],
      },
      progress: {
        text: "Nilo espera en la sala oeste y Lira en la este. El puzzle está al fondo, antes de la puerta de Iris. Vuelve si te pierdes.",
        options: [{ text: "Voy.", end: true }],
      },
    },
  },
  gym_guide_done: {
    npcName: "Orla",
    nodes: {
      start: {
        text: "La Insignia Verde te sienta bien. Has demostrado que este bosque te reconoce. Más allá se abre un camino nuevo… cuando el mundo esté listo.",
        options: [{ text: "Gracias, Orla.", end: true }],
      },
    },
  },

  gym_trainer_nilo: {
    npcName: "Nilo",
    nodes: {
      start: {
        text: "Las raíces no perdonan a quien las pisa a ciegas. ¿Quieres cruzar mi sala?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_leaf_1" }],
            end: true,
          },
          { text: "Todavía no.", end: true },
        ],
      },
    },
  },
  gym_trainer_nilo_done: {
    npcName: "Nilo",
    nodes: {
      start: {
        text: "Buen combate. Las raíces recuerdan tu paso. Lira te espera al otro lado.",
        options: [{ text: "Gracias, Nilo.", end: true }],
      },
    },
  },

  gym_trainer_lira: {
    npcName: "Lira",
    nodes: {
      start: {
        text: "Tres criaturas me acompañan. Si pretendes ver a Iris, empieza por mí.",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_leaf_2" }],
            end: true,
          },
          { text: "Mejor más tarde.", end: true },
        ],
      },
    },
  },
  gym_trainer_lira_done: {
    npcName: "Lira",
    nodes: {
      start: {
        text: "Vaya… pocos llegan tan lejos. El puzzle está más al norte. Iris no abre a cualquiera.",
        options: [{ text: "Allá voy.", end: true }],
      },
    },
  },

  gym_leader_iris: {
    npcName: "Iris",
    nodes: {
      start: {
        text: "Has llegado hasta aquí. Veamos si mereces la insignia.",
        options: [
          {
            text: "Combatir",
            actions: [{ type: "startTrainerBattle", trainerId: "leader_iris" }],
            end: true,
          },
          { text: "Todavía no", end: true },
        ],
      },
    },
  },
  gym_leader_iris_done: {
    npcName: "Iris",
    nodes: {
      start: {
        text: "Has demostrado tu dominio. Esta insignia es tuya. El bosque te reconoce… y un camino nuevo espera más allá.",
        options: [{ text: "Honor, Iris.", end: true }],
      },
    },
  },

  // ---------- Gimnasio de las Brumas (Fase 8) ----------

  mist_gym_guide_intro: {
    npcName: "Syl",
    nodes: {
      start: {
        text: "Bienvenida al Gimnasio de las Brumas. Soy Syl. El núcleo antiguo te abrió el arco; ahora la niebla decide quién pasa.",
        options: [
          { text: "¿Cómo se supera?", next: "rules" },
          { text: "¿Los faros?", next: "puzzle" },
          { text: "¿Quién queda?", next: "remain" },
          { text: "¿El núcleo antiguo?", next: "core" },
          { text: "¿El kit de exploración?", next: "kit" },
          { text: "Gracias.", end: true },
        ],
      },
      rules: {
        text: "Derrota a Nox y a Lumen, y enciende los tres faros de bruma. No hay orden: cada faro despeja un tramo. Solo entonces se abre la cámara de Nyra.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      puzzle: {
        text: "Norte, este y oeste. Actívalos en el orden que quieras. La niebla se aclara con cada uno. Un kit de exploración ayuda a verlos, pero no es la llave.",
        options: [{ text: "Cualquier orden.", next: "start" }],
      },
      remain: {
        text: "Nox guarda el ala oeste; Lumen, el este. Si ya cayeron, enciende los tres faros. Nyra no abre la cámara hasta que las tres pruebas estén hechas.",
        options: [{ text: "Los buscaré.", next: "start" }],
      },
      core: {
        text: "El núcleo que fabricaste con Talo despertó el arco del refugio. Sin él este edificio seguiría ciego. Ahora la niebla es el juez, no el cristal.",
        options: [{ text: "Encaja.", next: "start" }],
      },
      kit: {
        text: "El kit de Talo aclara la bruma y señala los faros que faltan. Puedes terminar el gimnasio a ciegas si hace falta. El tónico de Mira sirve entre combates.",
        options: [{ text: "Útil, no obligatorio.", next: "start" }],
      },
    },
  },
  mist_gym_guide_done: {
    npcName: "Syl",
    nodes: {
      start: {
        text: "La Insignia Bruma te sienta bien. La barrera al sur del gimnasio responde a ella. Más allá… todavía no hay tierra, pero el camino ya no está ciego.",
        options: [{ text: "Gracias, Syl.", end: true }],
      },
    },
  },

  gym_trainer_nox: {
    npcName: "Nox",
    nodes: {
      start: {
        text: "La sombra no espera a que se despeje la niebla. ¿Sigues?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_mist_1" }],
            end: true,
          },
          { text: "Todavía no.", end: true },
        ],
      },
    },
  },
  gym_trainer_nox_done: {
    npcName: "Nox",
    nodes: {
      start: {
        text: "Bien. Enciende los faros. Lumen te espera al otro lado de la cámara.",
        options: [{ text: "Gracias, Nox.", end: true }],
      },
    },
  },

  gym_trainer_lumen: {
    npcName: "Lumen",
    nodes: {
      start: {
        text: "Tres criaturas me acompañan. Si pretendes ver a Nyra, empieza por la luz.",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_mist_2" }],
            end: true,
          },
          { text: "Mejor más tarde.", end: true },
        ],
      },
    },
  },
  gym_trainer_lumen_done: {
    npcName: "Lumen",
    nodes: {
      start: {
        text: "La niebla te reconoce. Nyra no abre a cualquiera.",
        options: [{ text: "Allá voy.", end: true }],
      },
    },
  },

  gym_leader_nyra: {
    npcName: "Nyra",
    nodes: {
      start: {
        text: "Has cruzado la bruma. Veamos si el equilibrio te reconoce.",
        options: [
          {
            text: "Combatir",
            actions: [{ type: "startTrainerBattle", trainerId: "leader_nyra" }],
            end: true,
          },
          { text: "Todavía no", end: true },
        ],
      },
    },
  },
  gym_leader_nyra_done: {
    npcName: "Nyra",
    nodes: {
      start: {
        text: "Esta insignia es tuya. La barrera del sur responde ahora. Un camino nuevo espera… cuando el mundo esté listo.",
        options: [{ text: "Honor, Nyra.", end: true }],
      },
    },
  },

  gatekeeper_closed: {
    npcName: "Kael",
    nodes: {
      start: {
        text: "Alto. Este paso solo se abre a quien porta la Insignia Verde. Vuelve cuando hayas superado el Gimnasio Verde.",
        options: [
          { text: "¿Qué hay al otro lado?", next: "beyond" },
          { text: "Me voy.", end: true },
        ],
      },
      beyond: {
        text: "Las Tierras Brumosas. Un bosque más denso, más antiguo… y más peligroso. No puedes pasar todavía.",
        options: [{ text: "Entendido.", end: true }],
      },
    },
  },
  gatekeeper_unlock: {
    npcName: "Kael",
    nodes: {
      start: {
        text: "Veo que llevas la Insignia Verde. El bosque te reconoce. Puedes continuar.",
        options: [
          {
            text: "Abrir el paso",
            actions: [{ type: "openRegionGate", regionId: "region_2" }],
            next: "opened",
          },
          { text: "Más tarde.", end: true },
        ],
      },
      opened: {
        text: "Las Tierras Brumosas esperan al otro lado. Tened cuidado: las criaturas de la bruma no perdonan.",
        options: [{ text: "Gracias, Kael.", end: true }],
      },
    },
  },
  gatekeeper_opened: {
    npcName: "Kael",
    nodes: {
      start: {
        text: "El paso sigue abierto. Las Tierras Brumosas no se recorren a la ligera.",
        options: [{ text: "Seguiré con cuidado.", end: true }],
      },
    },
  },

  craftsman_intro: {
    npcName: "Talo",
    nodes: {
      start: {
        text: "¡Un viajero con las manos sucias de musgo! Bienvenido al Refugio Brumoso. Aquí no se vive de comerciar dados: se vive de fabricar.",
        options: [
          { text: "¿Cómo funciona el banco?", next: "bench" },
          {
            text: "Enséñame a fabricar.",
            next: "quest_offer",
            when: { questAvailable: "quest_hands_on" },
          },
          {
            text: "Sigo juntando materiales para el cubo.",
            next: "encourage",
            when: { questActive: "quest_hands_on" },
          },
          {
            text: "¿Y el núcleo antiguo?",
            next: "ancient",
            when: { unlocked: "ancient_core_recipe_unlocked" },
          },
          { text: "Hasta luego.", end: true },
        ],
      },
      bench: {
        text: "El banco de trabajo está junto a mi taller, a la derecha de la plaza. Tres apricornos y un cobre hacen un cubo de captura. Flor de bruma y hierba, un tónico. Carbón y hierro, un kit para ver entre la niebla.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      quest_offer: {
        text: "Empieza por lo básico: fabrica un cubo de captura en el banco. Cuando sepas usar la mesa, te enseñaré a ensamblar fragmentos antiguos.",
        options: [
          {
            text: "Manos a la obra.",
            actions: [{ type: "startQuest", questId: "quest_hands_on" }],
            next: "quest_accepted",
          },
          { text: "Ahora no.", end: true },
        ],
      },
      quest_accepted: {
        text: "Tres apricornos y un cobre. El cobre asoma en el musgo y en las vetas del bosque. ¡Al banco!",
        options: [{ text: "Voy.", end: true }],
      },
      encourage: {
        text: "Si te faltan apricornos, el bosque del valle sigue siendo el mejor sitio. El cobre lo encuentras también entre la niebla.",
        options: [{ text: "Sigo buscando.", end: true }],
      },
      ancient: {
        text: "Un fragmento antiguo y un cristal. El núcleo no es adorno: despierta el arco del sur. Eira te dirá el resto.",
        options: [{ text: "Lo fabricaré.", end: true }],
      },
    },
  },

  herbalist_intro: {
    npcName: "Mira",
    nodes: {
      start: {
        text: "El musgo guarda la niebla. Las flores, el calor. Soy Mira. Si te internas en el bosque, lleva medicina encima.",
        options: [
          { text: "¿Qué es la flor de bruma?", next: "bloom" },
          {
            text: "¿Puedo preparar un remedio?",
            next: "quest_offer",
            when: { questAvailable: "quest_mist_remedy" },
          },
          {
            text: "Sigo buscando flores.",
            next: "encourage",
            when: { questActive: "quest_mist_remedy" },
          },
          { text: "Gracias, Mira.", end: true },
        ],
      },
      bloom: {
        text: "Crece sobre el musgo del bosque denso. Con una hierba medicinal se vuelve tónico de bruma: cura a todo el equipo, pero no del todo. No es el altar de Sena. Es portable.",
        options: [{ text: "Lo tendré en cuenta.", next: "start" }],
      },
      quest_offer: {
        text: "Recoge una flor de bruma y fabrica un tónico en el banco de Talo. Cuando lo tengas, estarás listo para internarte más al sur.",
        options: [
          {
            text: "Lo prepararé.",
            actions: [{ type: "startQuest", questId: "quest_mist_remedy" }],
            next: "quest_accepted",
          },
          { text: "Más tarde.", end: true },
        ],
      },
      quest_accepted: {
        text: "El jardín detrás de mi puesto tiene algunas, pero el bosque guarda más. El tónico se usa con C, o desde el propio banco.",
        options: [{ text: "Voy a por la flor.", end: true }],
      },
      encourage: {
        text: "Flor de bruma más hierba medicinal. El banco hace el resto. Úsalo cuando el equipo flaquee lejos de un santuario.",
        options: [{ text: "Sigo.", end: true }],
      },
    },
  },

  regional_guide_intro: {
    npcName: "Eira",
    nodes: {
      start: {
        text: "Este refugio es el último techo antes de las ruinas. Soy Eira. Guío a quien aún no ha visto el puesto ancestral.",
        options: [
          { text: "¿Qué hay más al sur?", next: "south" },
          { text: "¿Un segundo gimnasio?", next: "gym" },
          {
            text: "Quiero seguir el eco del pasado.",
            next: "quest_offer",
            when: { questAvailable: "quest_echo_past" },
          },
          {
            text: "Sigo buscando el fragmento.",
            next: "encourage",
            when: { questActive: "quest_echo_past" },
          },
          { text: "Hasta luego.", end: true },
        ],
      },
      south: {
        text: "Al sur del bosque hay un puesto antiguo. Allí aparecen fragmentos que no son de este tiempo. El arco de cristal al sur del pueblo no se abre con fuerza: necesita un núcleo antiguo.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      gym: {
        text: "Dicen que un sendero sellado conduce a otro gimnasio, más duro que el Verde. Todavía no está construido… pero el arco recuerda el camino. Las criaturas de la niebla tampoco perdonan a los entrenadores despistados.",
        options: [{ text: "Lo tendré presente.", next: "start" }],
      },
      quest_offer: {
        text: "Encuentra el puesto ancestral, recoge un fragmento y fabrica el núcleo en el banco. Si el arco reacciona, el próximo gimnasio tendrá por dónde nacer.",
        options: [
          {
            text: "Seguiré el eco.",
            actions: [{ type: "startQuest", questId: "quest_echo_past" }],
            next: "quest_accepted",
          },
          { text: "Más tarde.", end: true },
        ],
      },
      quest_accepted: {
        text: "El puesto está más al sur, entre la niebla. Un fragmento y un cristal. Talo ya conoce la receta si fabricaste el cubo.",
        options: [{ text: "Allá voy.", end: true }],
      },
      encourage: {
        text: "Puesto ancestral, fragmento antiguo, núcleo en el banco. El arco del sur te dirá si funcionó.",
        options: [{ text: "Sigo.", end: true }],
      },
    },
  },

  regional_guide_clue: {
    npcName: "Eira",
    nodes: {
      start: {
        text: "El núcleo reaccionó. El arco al sur late. Sigue el sendero: el Gimnasio de las Brumas espera entre la niebla.",
        options: [
          { text: "¿Qué hay al otro lado?", next: "after" },
          { text: "Gracias, Eira.", end: true },
        ],
      },
      after: {
        text: "Syl os recibirá en la entrada. Lleva tónico. El kit de Talo ayuda a ver los faros, pero no es la llave. Nyra no abre a cualquiera.",
        options: [{ text: "Allá voy.", end: true }],
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

  regional_merchant_intro: {
    npcName: "Kora",
    nodes: {
      start: {
        text: "Carbón, cobre, hierbas… y cubos, si pagas. El valle comercia con trueque; aquí, con monedas.",
        options: [
          { text: "A comerciar.", actions: [{ type: "openShop" }], end: true },
          { text: "Hasta luego.", end: true },
        ],
      },
    },
  },

  prospector_intro: {
    npcName: "Bren",
    nodes: {
      start: {
        text: "¡Otro que cruza la bruma! Soy Bren. Estas cumbres esconden mena de ascuas en la roca y cristales rojos donde la piedra se abre.",
        options: [
          { text: "¿Qué se saca de aquí?", next: "ores" },
          { text: "¿Hay algo más al sur?", next: "ruin" },
          {
            text: "El sello está resonando. ¿Qué hago?",
            next: "recipe",
            when: { unlocked: "gym_3_clue_unlocked" },
          },
          { text: "Gracias, Bren.", end: true },
        ],
      },
      ores: {
        text: "La mena de ascuas es el pan de este campamento: Kora la compra. El cristal rojo es otra historia. No lo malgastes: las ruinas lo reclaman.",
        options: [{ text: "Lo tendré en cuenta.", next: "start" }],
      },
      ruin: {
        text: "Hay una ruina más adentro, un sello mineral dormido. Cuando la montaña te acepte —mena vendida, ruina hallada— el sello empezará a cantar. No es un gimnasio. Todavía.",
        options: [{ text: "Iré a verlo.", end: true }],
      },
      recipe: {
        text: "El sello ya canta, ¿verdad? No le basta el cristal suelto. En el banco de Talo: dos menas de ascuas, dos cristales rojos y un fragmento de cristal. Eso despierta un resonador. No lo vendas: la ruina lo reclama.",
        options: [{ text: "Fabricaré el resonador.", end: true }],
      },
    },
  },

  field_medic_intro: {
    npcName: "Ysol",
    nodes: {
      start: {
        text: "No soy Sena ni un altar. Curo aquí y ahora, pero cobro: 60 monedas. El santuario sigue siendo gratis, si llegas. El tónico, portable.",
        options: [
          {
            text: "Curar equipo (60 ⌾)",
            actions: [{ type: "paidHeal" }],
            next: "healed",
          },
          { text: "¿Por qué cobras?", next: "why" },
          { text: "Otro día.", end: true },
        ],
      },
      healed: {
        text: "Listo. Vuelve cuando el altiplano os muerda.",
        options: [{ text: "Gracias, Ysol.", end: true }],
      },
      why: {
        text: "Traer vendas hasta aquí no es barato. El altar recarga solo; yo no. El tónico de Mira os cubre en ruta. Tres caminos, tres precios.",
        options: [{ text: "Entendido.", next: "start" }],
      },
    },
  },

  // ---------- Gimnasio de la Forja (Fase 10) ----------

  crimson_gym_guide_intro: {
    npcName: "Rhed",
    nodes: {
      start: {
        text: "Bienvenida al Gimnasio de la Forja. Soy Rhed. El guardián de la ruina os ha dejado pasar: ahora la montaña prueba si sabéis repartir el fuego.",
        options: [
          { text: "¿Cómo se supera?", next: "rules" },
          { text: "¿La energía?", next: "puzzle" },
          { text: "¿Quién queda?", next: "remain" },
          {
            text: "El guardián de la ruina…",
            next: "boss",
            when: { unlocked: "gym_3_path_unlocked" },
          },
          { text: "Gracias.", end: true },
        ],
      },
      rules: {
        text: "Derrota a Pyra y a Flint, y carga el núcleo de forja con dos unidades de energía. El reservorio solo tiene tres. Quien lo gaste todo en las puertas no podrá abrir la cámara de Brann.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      puzzle: {
        text: "Tres conductos, tres cargas. Oeste y este piden una cada uno para abrir las salas. El núcleo pide dos. No hay orden ni reloj: recuperáis y reasignáis cuando queráis. No hace falta gastar mena aquí dentro.",
        options: [{ text: "Reservorio de tres.", next: "start" }],
      },
      remain: {
        text: "Pyra guarda el ala oeste; Flint, la este. Si ya cayeron, cargad el núcleo. Brann no abre hasta que las tres pruebas estén hechas.",
        options: [{ text: "Los buscaré.", next: "start" }],
      },
      boss: {
        text: "Ese gólem mineral no era un líder. Era el cerrojo. Vosotros lo forjasteis con mena y cristal, y luego lo derribasteis. Aquí dentro solo queda demostrar que el calor no os quiebra.",
        options: [{ text: "Encaja.", next: "start" }],
      },
    },
  },
  crimson_gym_guide_done: {
    npcName: "Rhed",
    nodes: {
      start: {
        text: "La Insignia Forja os sienta como un sello caliente. El paso al sur del gimnasio responde a ella. Más allá… todavía no hay tierra, pero el mecanismo ya no está ciego.",
        options: [{ text: "Gracias, Rhed.", end: true }],
      },
    },
  },

  gym_trainer_pyra: {
    npcName: "Pyra",
    nodes: {
      start: {
        text: "El calor no espera a que el conducto se llene. ¿Sigues?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_forge_1" }],
            end: true,
          },
          { text: "Todavía no.", end: true },
        ],
      },
    },
  },
  gym_trainer_pyra_done: {
    npcName: "Pyra",
    nodes: {
      start: {
        text: "Bien. Recupera la energía si la necesitas. Flint espera al otro lado.",
        options: [{ text: "Gracias, Pyra.", end: true }],
      },
    },
  },

  gym_trainer_flint: {
    npcName: "Flint",
    nodes: {
      start: {
        text: "Tres criaturas me acompañan. Si pretendes ver a Brann, empieza por la resistencia.",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_forge_2" }],
            end: true,
          },
          { text: "Mejor más tarde.", end: true },
        ],
      },
    },
  },
  gym_trainer_flint_done: {
    npcName: "Flint",
    nodes: {
      start: {
        text: "La forja te reconoce. Carga el núcleo. Brann no abre a cualquiera.",
        options: [{ text: "Allá voy.", end: true }],
      },
    },
  },

  gym_leader_brann: {
    npcName: "Brann",
    nodes: {
      start: {
        text: "Has forjado el camino hasta aquí. Veamos si el mineral te reconoce.",
        options: [
          {
            text: "Combatir",
            actions: [{ type: "startTrainerBattle", trainerId: "leader_brann" }],
            end: true,
          },
          { text: "Todavía no", end: true },
        ],
      },
    },
  },
  gym_leader_brann_done: {
    npcName: "Brann",
    nodes: {
      start: {
        text: "Esta insignia es tuya. El paso del sur responde ahora. Un camino nuevo espera… cuando el mundo esté listo.",
        options: [{ text: "Honor, Brann.", end: true }],
      },
    },
  },

  wind_scout_intro: {
    npcName: "Nera",
    nodes: {
      start: {
        text: "El vendaval te ha dejado en pie. Soy Nera, exploradora de estos altos. El mapa se abre al caminar; las atalayas y el observatorio lo despejan de golpe. Las corrientes blancas te suben — no vuelas, te empujan.",
        options: [
          { text: "¿Dónde estoy?", next: "where" },
          { text: "¿El mapa?", next: "map" },
          { text: "¿Esas corrientes?", next: "lifts" },
          { text: "Hasta luego.", end: true },
        ],
      },
      where: {
        text: "Altos del Vendaval. Piedra clara, precipicios y un cielo que corta. El Paso Carmesí queda al norte. Al sur, más alto, el Observatorio de la Tormenta. El puesto es el único techo fiable.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      map: {
        text: "Pulsa M. Lo que no has pisado es niebla. Una atalaya revela un anillo; el observatorio, casi un valle. No esperes ver el siguiente gimnasio hasta encontrarlo.",
        options: [{ text: "Abriré el mapa.", next: "start" }],
      },
      lifts: {
        text: "Entra en la columna de viento y deja que te eleve. Conservas un poco de rumbo. No es un montura ni un vuelo libre: te deja en una cornisa, no al otro lado del mundo.",
        options: [{ text: "Lo probaré.", end: true }],
      },
    },
  },

  highland_merchant_intro: {
    npcName: "Siro",
    nodes: {
      start: {
        text: "Cubos, tónicos, hierbas y un kit de exploración. Te compro cristal de viento y hierba de altura. Precios fijos: el vendaval ya es bastante variable.",
        options: [
          { text: "A comerciar.", actions: [{ type: "openShop", title: "Puesto de Siro" }], end: true },
          { text: "¿Qué vale la pena?", next: "tips" },
          { text: "Otro día.", end: true },
        ],
      },
      tips: {
        text: "El cristal de viento se esconde en cornisas y junto a las corrientes. La hierba de altura brota en los parches secos. No inflaré precios aunque el observatorio se ponga dramático.",
        options: [{ text: "A comerciar.", actions: [{ type: "openShop", title: "Puesto de Siro" }], end: true }],
      },
    },
  },

  storm_researcher_intro: {
    npcName: "Vela",
    nodes: {
      start: {
        text: "Mido el viento, no lo adoro. Hay una familia de planeadores de membrana —no aves— y un cristal eléctrico raro cerca del observatorio. El sello de allí todavía duerme.",
        options: [
          { text: "¿Planeadores?", next: "gliders" },
          { text: "¿El observatorio?", next: "obs" },
          {
            text: "Los cristales ya responden.",
            next: "clue",
            when: { unlocked: "gym_4_clue_unlocked" },
          },
          { text: "Gracias, Vela.", end: true },
        ],
      },
      gliders: {
        text: "Brisín es un ovillo con orejas-vela. Vendal ya planea de verdad; Céfiron es el vendaval con garras. Si uno de los grandes te acepta, te ayuda a construir en altura. No te llevará al otro lado de un paso cerrado.",
        options: [{ text: "Capturar para construir.", next: "start" }],
      },
      obs: {
        text: "El Observatorio de la Tormenta mira un hueco en las nubes. Hay un mecanismo dormido. Cuando reúnas cristal de viento y lo despiertes, apuntará al pináculo del este.",
        options: [{ text: "Iré a verlo.", end: true }],
      },
      clue: {
        text: "Los cristales cantan con el vendaval. El sello ya no está ciego: señala una plataforma alta al este. Allí espera un guardián. Más allá, si lo superas, el Gimnasio del Vendaval.",
        options: [{ text: "Lo he visto.", end: true }],
      },
    },
  },

  gale_gym_guide_intro: {
    npcName: "Aira",
    nodes: {
      start: {
        text: "Bienvenida al Gimnasio del Vendaval. Soy Aira. Las corrientes cambian las rutas: no puedes obligar al viento, tienes que leerlo.",
        options: [
          { text: "¿Cómo se supera?", next: "rules" },
          { text: "¿Los canales?", next: "puzzle" },
          { text: "¿Quién queda?", next: "remain" },
          { text: "Gracias.", end: true },
        ],
      },
      rules: {
        text: "Derrota a Kaia y a Orin, y alinea los tres canales. Cada uno despierta una corriente hacia la siguiente terraza. Zephra no abre hasta que el flujo llega arriba.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      puzzle: {
        text: "Tres controladores: norte en el suelo, este a media altura, oeste más arriba. Enciende el de abajo para alcanzar el de en medio, y así sucesivamente. Si caes, la corriente de recuperación te devuelve. No hace falta volar ni construir.",
        options: [{ text: "Leer el viento.", next: "start" }],
      },
      remain: {
        text: "Kaia espera en la plaza. Orin, en la terraza este. Si ya cayeron, sube con los canales. Zephra observa desde lo alto: serena, no apresurada.",
        options: [{ text: "Los buscaré.", next: "start" }],
      },
    },
  },
  gale_gym_guide_done: {
    npcName: "Aira",
    nodes: {
      start: {
        text: "La Insignia Vendaval te sienta como una vela tensa. Al sur del gimnasio el arco de las alturas se ha abierto. Baja: el mar ya se ve.",
        options: [{ text: "Gracias, Aira.", end: true }],
      },
    },
  },

  gym_trainer_kaia: {
    npcName: "Kaia",
    nodes: {
      start: {
        text: "Exploro estas cornisas desde que el observatorio era solo piedra. El viento no pide permiso. ¿Sigues?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_gale_1" }],
            end: true,
          },
          { text: "Todavía no.", end: true },
        ],
      },
    },
  },
  gym_trainer_kaia_done: {
    npcName: "Kaia",
    nodes: {
      start: {
        text: "Bien. El canal norte ya te sirve. Orin espera más arriba, donde el aire se afila.",
        options: [{ text: "Gracias, Kaia.", end: true }],
      },
    },
  },

  gym_trainer_orin: {
    npcName: "Orin",
    nodes: {
      start: {
        text: "Domo alturas, no las forzo. Tres criaturas me acompañan. Si pretendes ver a Zephra, empieza por no pelear contra la corriente.",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "gym_trainer_gale_2" }],
            end: true,
          },
          { text: "Mejor más tarde.", end: true },
        ],
      },
    },
  },
  gym_trainer_orin_done: {
    npcName: "Orin",
    nodes: {
      start: {
        text: "El viento te reconoce. Alinea el último canal. Zephra no abre a quien sube a empujones.",
        options: [{ text: "Allá voy.", end: true }],
      },
    },
  },

  gym_leader_zephra: {
    npcName: "Zephra",
    nodes: {
      start: {
        text: "Has leído las corrientes hasta aquí. No puedes obligar al viento; tienes que aprender a leerlo. Veamos si también sabes escucharlo en combate.",
        options: [
          {
            text: "Combatir",
            actions: [{ type: "startTrainerBattle", trainerId: "leader_zephra" }],
            end: true,
          },
          { text: "Todavía no", end: true },
        ],
      },
    },
  },
  gym_leader_zephra_done: {
    npcName: "Zephra",
    nodes: {
      start: {
        text: "Esta insignia es tuya. El arco del sur responde ahora. Más allá el cielo se abre sobre el mar: el Archipiélago Azur espera.",
        options: [{ text: "Honor, Zephra.", end: true }],
      },
    },
  },

  azure_guide_intro: {
    npcName: "Maris",
    nodes: {
      start: {
        text: "Bienvenido a Puerto Azur. Plaza, clínica, mercado y muelle: si te pierdes, mira la fuente. El faro al este y las ruinas al oeste marcan el resto de la costa.",
        options: [
          { text: "¿Dónde me curo?", next: "clinic" },
          { text: "¿Y el PC?", next: "pc" },
          { text: "¿Qué hay más allá?", next: "beyond" },
          { text: "Gracias, Maris.", end: true },
        ],
      },
      clinic: {
        text: "Calla atiende en el Centro de Recuperación, al oeste de la plaza. No cobra a quien llega con criaturas cansadas. Hay un PC junto a ella.",
        options: [{ text: "Entendido.", next: "start" }],
      },
      pc: {
        text: "El terminal está dentro de la clínica. Mismo PC de siempre: no hay almacén regional. Si el equipo está lleno, las capturas van allí.",
        options: [{ text: "Perfecto.", next: "start" }],
      },
      beyond: {
        text: "El Sendero de las Mareas sale hacia el puente y las Ruinas de Marea. El Camino del Faro sigue hasta el Faro Azur. Hay corrientes en los canales: no te arrastran del todo.",
        options: [{ text: "Saldré a verlo.", end: true }],
      },
    },
  },

  azure_healer_intro: {
    npcName: "Calla",
    nodes: {
      start: {
        text: "Centro de Recuperación. Trae a tus criaturas: las dejo como nuevas. El PC está a tu izquierda. No cobro, igual que Sena en el valle.",
        options: [
          {
            text: "¿Puedes curar a mi equipo?",
            actions: [{ type: "heal", source: "azure_healer" }],
            next: "healed",
          },
          { text: "¿El PC?", next: "pc" },
          { text: "Otro rato.", end: true },
        ],
      },
      healed: {
        text: "Listo. Vuelve cuando la costa os recuerde que sois de carne.",
        options: [{ text: "Gracias, Calla.", end: true }],
      },
      pc: {
        text: "El terminal no muerde. Deposita, retira, cambia el líder. Las instancias siguen siendo las mismas.",
        options: [{ text: "Lo usaré.", next: "start" }],
      },
    },
  },

  azure_merchant_intro: {
    npcName: "Marea",
    nodes: {
      start: {
        text: "Mercado de Marea. Vendo cubos, tónicos, hierbas y kits. Te compro fragmento de coral y perla de marea. Mira la mochila: lo que tienes, lo ves.",
        options: [
          { text: "A comerciar.", actions: [{ type: "openShop", title: "Mercado de Marea" }], end: true },
          { text: "¿Qué buscas?", next: "buys" },
          { text: "Otro día.", end: true },
        ],
      },
      buys: {
        text: "El coral se desprende en playas y ruinas. La perla es más rara: canales, santuarios viejos, rincones bajo el puente. Precios fijos.",
        options: [{ text: "A comerciar.", actions: [{ type: "openShop", title: "Mercado de Marea" }], end: true }],
      },
    },
  },

  azure_researcher_intro: {
    npcName: "Quill",
    nodes: {
      start: {
        text: "Estas ruinas no son un gimnasio. Son un recuerdo de marea: tres cámaras, agua baja, placas de coral. Si hallas fragmento o perla, tráemelos… o quédate con ellos. Yo mido, no cobro peaje.",
        options: [
          { text: "¿Qué buscas aquí?", next: "work" },
          { text: "¿Hay peligro?", next: "danger" },
          { text: "Sigo explorando.", end: true },
        ],
      },
      work: {
        text: "El coral vive en las paredes. Hay una criatura de arrecife —no pez, no tortuga— y a veces un destello de noche. Fosmar, si le pones nombre.",
        options: [{ text: "Lo tendré en cuenta.", end: true }],
      },
      danger: {
        text: "No hay jefe. Hay charcos y un par de recodos. Si te cansas, Calla está en el puerto. El faro, más al este, apunta a lo que viene.",
        options: [{ text: "Iré al faro después.", end: true }],
      },
    },
  },

  azure_sailor_intro: {
    npcName: "Bram",
    nodes: {
      start: {
        text: "Las barcas están amarradas. No hay travesía todavía: el mar se mira, no se monta. Si quieres isla, usa el puente o la corriente.",
        options: [{ text: "Entendido.", end: true }],
      },
    },
  },

  azure_child_intro: {
    npcName: "Peb",
    nodes: {
      start: {
        text: "¡La fuente es un pez de piedra que no es pez! Maris dice que si cuento las placas del coral me mareo. Ya voy por siete.",
        options: [{ text: "Sigue contando.", end: true }],
      },
    },
  },

  azure_fisher_intro: {
    npcName: "Osa",
    nodes: {
      start: {
        text: "No lanzo caña: espero a que el canal traiga algas. El recolector del puente pelea si le pides sitio. Yo no peleo. Yo miro.",
        options: [{ text: "Buen ojo.", end: true }],
      },
    },
  },

  azure_traveler_intro: {
    npcName: "Kess",
    nodes: {
      start: {
        text: "Bajé del vendaval con las rodillas temblando. El cartel no miente: Puerto Azur está aquí. Si buscas faro, no entres al mercado primero… o sí. El pan también orienta.",
        options: [{ text: "Gracias por el aviso.", end: true }],
      },
    },
  },

  azure_keeper_intro: {
    npcName: "Ryn",
    nodes: {
      start: {
        text: "Calla cura. Yo cuento. Las criaturas del puerto no entran en la plaza: hay un acuerdo viejo, o un olor a piedra. Fuera, en la playa, sí hay Riflines.",
        options: [{ text: "Lo respetaré.", end: true }],
      },
    },
  },

  azure_trainer_nerea: {
    npcName: "Nerea",
    nodes: {
      start: {
        text: "Exploro la costa desde que el arco se abrió. Un Riflín me sigue los talones. ¿Comprobamos el paso?",
        options: [
          {
            text: "¡Acepto el desafío!",
            actions: [{ type: "startTrainerBattle", trainerId: "azure_route_trainer_1" }],
            end: true,
          },
          { text: "Ahora no.", end: true },
        ],
      },
    },
  },
  azure_trainer_nerea_done: {
    npcName: "Nerea",
    nodes: {
      start: {
        text: "Bien. El puerto te espera abajo. Ciro, en el puente, es más terco que una boya.",
        options: [{ text: "Gracias, Nerea.", end: true }],
      },
    },
  },

  azure_trainer_ciro: {
    npcName: "Ciro",
    nodes: {
      start: {
        text: "Recolecto placas y no las vendo todas. Agua y mineral, como el canal. Si cruzas, pelea.",
        options: [
          {
            text: "¡Adelante!",
            actions: [{ type: "startTrainerBattle", trainerId: "azure_route_trainer_2" }],
            end: true,
          },
          { text: "Paso de largo.", end: true },
        ],
      },
    },
  },
  azure_trainer_ciro_done: {
    npcName: "Ciro",
    nodes: {
      start: {
        text: "Quédate el coral si lo hallas. Las ruinas están al oeste. El faro, si te queda aliento, al este.",
        options: [{ text: "Seguiré.", end: true }],
      },
    },
  },

  azure_trainer_solen: {
    npcName: "Solen",
    nodes: {
      start: {
        text: "El faro no es un gimnasio. Yo tampoco. Pero la lente agradece que alguien llegue con equipo vivo.",
        options: [
          {
            text: "Combatir",
            actions: [{ type: "startTrainerBattle", trainerId: "azure_route_trainer_3" }],
            end: true,
          },
          { text: "Solo miro el mar.", end: true },
        ],
      },
    },
  },
  azure_trainer_solen_done: {
    npcName: "Solen",
    nodes: {
      start: {
        text: "Sube. La lente espera una mano, no un título. Cuando despierte, el horizonte dirá hacia dónde sigue el agua.",
        options: [{ text: "Subo.", end: true }],
      },
    },
  },

  azure_sign: {
    npcName: "Señal",
    nodes: {
      start: {
        text: "…",
        options: [{ text: "Seguir.", end: true }],
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
