// Textos del Test de Alimentos.
// Flujo: bienvenida -> pregunta general -> 144 alimentos (con respiros) -> mapa -> final.
// El test NO pide ningun dato personal: ni nombre ni correo. Si alguien vuelve a proponerlo,
// hay que pasar otra vez por cumplimiento-legal (ver INFORME_LEGAL_test-alimentos.md).
// Los textos del mapa los recorto Abby a proposito: sobraba disclaimer y sonaba defensivo.

window.TEXTOS = {
  bienvenida: {
    titulo: "Cómo te sienta cada alimento",
    parrafos: [
      "Vas a ver 144 fotos de alimentos, una detrás de otra, y en cada una marcas cómo te suele sentar. No hay preguntas con trampa ni tiempo límite: solo tu barriga y lo que ya sabes de ella.",
      "Se tarda entre diez y doce minutos si lo haces del tirón, pero puedes ir por partes: se va guardando en este navegador, así que cierras cuando quieras y sigues después por donde lo dejaste."
    ],
    nota: "No hay respuestas correctas, y decir \"no lo sé\" también cuenta como respuesta. Esto es autoconocimiento: no es un diagnóstico ni una pauta de lo que tienes que comer.",
    cta: "Empezar test"
  },
  general: {
    pregunta: "¿Cómo te sientes habitualmente después de comer?",
    opciones: [
      "Bien, con energía",
      "Depende del día, algo cansada",
      "Hinchada o con la barriga resentida"
    ]
  },
  pregunta: {
    encabezado: "¿Cómo te suele sentar?",
    verde: "Bien, sin problema",
    ambar: "Depende del día",
    rojo: "Me sienta mal",
    nose: "No lo sé",
    nocomo: "No lo como"
  },
  respiro: {
    "Frutas": "Frutas ya vistas, una a una. Queda un buen trecho todavía.",
    "Verduras y hortalizas": "Ese tramo de verduras era largo. Para si te apetece.",
    "Tubérculos y raíces": "Tubérculos y raíces atrás, casi rozando la mitad del test.",
    "Legumbres": "Con las legumbres acabas de dejar atrás la mitad del test.",
    "Cereales y derivados": "Cereales y derivados fuera. Respira un segundo si quieres.",
    "Carnes": "Carnes ya pasadas. Te queda menos de un tercio.",
    "Pescados y mariscos": "Pescados y mariscos, ya está esa parte. Casi lo tienes.",
    "Huevo": "Huevo era el bloque más corto de todos, y ya pasó.",
    "Lácteos": "Lácteos atrás. Después de esto solo queda una categoría más."
  },
  // Pantalla que se ve UNA vez, entre la portada y la pregunta general: lo imprescindible
  // para responder bien. Breve a proposito: aqui todavia no ha invertido nada y se va.
  comoResponder: {
    titulo: "Cinco respuestas",
    intro: "Te las explico una vez y ya no te interrumpo más.",
    items: [
      { key: "verde",  texto: "Te sienta bien casi siempre. Lo comes y no pasa nada." },
      { key: "ambar",  texto: "Unas veces bien y otras no, y cuando molesta, molesta poco: algo de hinchazón, la digestión más pesada." },
      { key: "rojo",   texto: "Casi siempre y fuerte: reflujo, cólicos, hinchazón muy marcada. Lo tienes fichado desde hace tiempo." },
      { key: "nose",   texto: "No te has fijado o no te acuerdas. Es una respuesta tan válida como las otras." },
      { key: "nocomo", texto: "No lo comes y no lo echas de menos. Así se queda fuera y no tienes que volver a pensarlo." }
    ],
    nota: "Lo primero que te venga es lo bueno: llevas años conviviendo con tu barriga y esa información ya la tienes.",
    cta: "Empezar"
  },
  // Pantalla que se ve UNA vez, justo antes del mapa. Aqui ya ha hecho el esfuerzo, asi
  // que puede ser mas larga: es lo que evita que lea el mapa como una lista de prohibidos.
  antesDelMapa: {
    titulo: "Antes de verlo",
    parrafos: [
      "Piensa en un vaso. Cada cosa que tu sistema tiene que gestionar echa un poco de agua dentro: lo que comes, pero también el sueño, el estrés y el día que llevas. Los síntomas no aparecen por el último trago, sino cuando el vaso rebosa.",
      "Un naranja echa poca agua: por eso unas veces te sienta bien y otras no, según lo lleno que estuviera ya. Uno solo casi nunca desborda nada; tres o cuatro el mismo día, sí. Un rojo echa tanta de golpe que desborda él solo, sin ayuda de nadie.",
      "Así que lo que vas a ver no es una lista de alimentos prohibidos. Es de dónde partes: cuánto verde tienes para construir encima."
    ],
    comoSeUsa: [
      "Los verdes son tu base, lo que te sostiene mientras el vaso baja de nivel.",
      "Sobre esa base se van añadiendo naranjas de uno en uno. De uno en uno no es una manía: es la única forma de saber si tu sistema ya no está reaccionando a ese alimento.",
      "Cuando se trabaja el umbral y el vaso baja, los naranjas empiezan a pasar a verdes. El mapa de hoy no es el de dentro de unos meses.",
      "Si tienes que elegir por dónde empezar, tira de lo versátil: recuperar la cebolla o el ajo te cambia media cocina; recuperar las nueces te cambia el desayuno del domingo."
    ],
    aviso: "Y lo más importante: esto no es para que salgas de aquí calculando cada comida ni dándole vueltas todo el día a qué puedes comer. Vigilarte todo el rato también llena el vaso. No hay que hacer cuentas: basta con no juntar varios naranjas el mismo día e ir poco a poco.",
    cta: "Ver mi mapa"
  },
  // Pantalla de resultado. Se agrupa SOLO por color y por categoría de alimento.
  // Prohibido agrupar por criterio técnico (histamina, fermentables, fibra): eso sería
  // una clasificación clínica sobre sus datos, no sus propias respuestas.
  mapa: {
    titulo: "Mi mapa de alimentos",
    subtitulo: "Mis propias respuestas, puestas en orden",
    cierre: "Un alimento en rojo significa que he observado que me sienta mal. Esto es una foto de hoy, no un diagnóstico ni una lista de lo que tengo que dejar de comer: es autoconocimiento. Lo que no me dice es por qué, y eso lo miro con mi médico.",
    leyenda: {
      verde: "Me sientan bien",
      ambar: "Depende del día",
      rojo: "Me sientan mal",
      nose: "No lo sé todavía",
      nocomo: "No lo como"
    },
    vacio: "Ninguno por aquí."
  },
  final: {
    titulo: "Gracias por terminarlo",
    parrafos: [
      "Gracias por dedicarle este rato a algo tan concreto como es escuchar tu propia barriga alimento a alimento. Ya está: no hace falta nada más por tu parte.",
      "Tu mapa se queda guardado en este navegador, así que si algún día quieres volver a verlo o cambiar alguna respuesta, puedes hacerlo cuando te apetezca."
    ],
    nota: "Esto no es un diagnóstico ni una pauta: es lo que tú ya sabías, puesto en orden."
  },
  ui: {
    atras: "Atrás",
    guardado: "Se guarda solo, puedes cerrar cuando quieras.",
    retomar: "Lo dejaste en el alimento {n} de {total}. ¿Seguimos por ahí?",
    retomarBoton: "Seguir donde lo dejé",
    empezarDeCero: "Empezar de cero",
    verMapa: "Ver mi mapa",
    terminado: "Ya lo terminaste entero. ¿Quieres ver tu mapa?",
    dosVersionesAviso: "Este enlace trae un mapa distinto al que ya tenías guardado en este navegador. ¿Cuál quieres seguir?",
    dosVersionesAqui: "Seguir con lo de este navegador ({n} de {total})",
    dosVersionesEnlace: "Usar el enlace ({n} de {total})"
  }
};
