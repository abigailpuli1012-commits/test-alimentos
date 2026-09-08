(function(){
  "use strict";

  /* ============================================================
     CONSTANTES
     ============================================================ */
  var STORAGE_KEY = "test-alimentos-v1";
  var TOTAL = window.PREGUNTAS ? window.PREGUNTAS.length : 0;
  var SEG_POR_ALIMENTO = 4.6;
  var FOOT_HASTA = 3; // aviso "se guarda solo" solo en las tres primeras pantallas de alimento

  // Endpoint del recuento anónimo (dos avisos ciegos: "inicio" y "fin"). Vacío a propósito:
  // Abby lo rellenará cuando despliegue el Apps Script. Con la constante vacía, no se hace
  // ninguna petición y el test funciona exactamente igual.
  var ENDPOINT = "";

  // Aviso legal — lo crea Abby en Systeme.io. Vacía a propósito: mientras esté vacía, el
  // enlace del pie (portada y cierre) no se muestra en absoluto.
  var URL_AVISO_LEGAL = "";

  var T = window.TEXTOS || {};
  var TITULO_ORIGINAL = document.title;

  var MAPA_VERDE = "verde", MAPA_AMBAR = "ambar", MAPA_ROJO = "rojo", MAPA_NOSE = "nose";
  var VAL_A_KEY = ["verde", "ambar", "rojo", "nose"]; // 0..3
  var KEY_A_VAL = { verde: 0, ambar: 1, rojo: 2, nose: 3 };

  /* ============================================================
     CATEGORÍAS — posición dentro de cada categoría, precomputado
     ============================================================ */
  var CATINFO = []; // por índice de PREGUNTAS: {nombre, pos, total, esUltima, esUltimaCategoria}
  (function(){
    if(!TOTAL) return;
    var conteos = {};
    window.PREGUNTAS.forEach(function(p){ conteos[p.categoria] = (conteos[p.categoria]||0)+1; });
    var vistos = {};
    var ultimaCategoria = window.PREGUNTAS[TOTAL-1].categoria;
    for(var i=0;i<TOTAL;i++){
      var cat = window.PREGUNTAS[i].categoria;
      vistos[cat] = (vistos[cat]||0)+1;
      var esUltimaDeSuCategoria = (i === TOTAL-1) || (window.PREGUNTAS[i+1].categoria !== cat);
      CATINFO.push({
        nombre: cat, pos: vistos[cat], total: conteos[cat],
        esUltimaDeSuCategoria: esUltimaDeSuCategoria,
        esUltimaCategoriaDelTest: cat === ultimaCategoria
      });
    }
  })();

  /* ============================================================
     CATEGORÍAS Y SIGNATURAS PARA EL MAPA — precomputado una vez
     ============================================================ */
  var CATEGORIAS_ORDEN = [];
  (function(){
    var visto = {};
    for(var i=0;i<TOTAL;i++){
      var c = window.PREGUNTAS[i].categoria;
      if(!visto[c]){ visto[c] = true; CATEGORIAS_ORDEN.push(c); }
    }
  })();
  var CODIGO_CAT = {
    "Frutas":"FR","Verduras y hortalizas":"VE","Tubérculos y raíces":"TU","Legumbres":"LE",
    "Cereales y derivados":"CE","Frutos secos y semillas":"FS","Carnes":"CA",
    "Pescados y mariscos":"PE","Huevo":"HU","Lácteos":"LA"
  };
  function codCategoria(c){ return CODIGO_CAT[c] || c.slice(0,2).toUpperCase(); }
  var SIGNATURAS = []; // paralelo a PREGUNTAS
  (function(){
    var contadores = {};
    for(var i=0;i<TOTAL;i++){
      var cat = window.PREGUNTAS[i].categoria;
      contadores[cat] = (contadores[cat]||0) + 1;
      var n = contadores[cat];
      SIGNATURAS.push(codCategoria(cat) + "-" + (n < 10 ? "0"+n : String(n)));
    }
  })();

  /* ============================================================
     ESTADO Y PERSISTENCIA
     ============================================================ */
  var state = { v: 1, respuestas: {}, indice: -1, ts: Date.now() };

  function guardar(){
    state.v = 1; state.ts = Date.now();
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }
  function cargarLocal(){
    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      var data = JSON.parse(raw);
      if(!data || typeof data !== "object" || !data.respuestas) return null;
      return normalizarEstado(data);
    }catch(e){}
    return null;
  }
  function borrarLocal(){ try{ localStorage.removeItem(STORAGE_KEY); }catch(e){} }

  // Deja pasar SOLO lo que este código sabe producir. Todo lo demás se descarta en
  // silencio: ante un `localStorage` corrupto o manipulado, se arranca limpio, nunca se
  // rompe la pantalla. Reutiliza el mismo alfabeto de valores que decodificarYValidar.
  function normalizarEstado(data){
    var limpio = { v:1, respuestas:{}, indice:-1, ts: Date.now() };
    var src = data.respuestas;
    if(!src || typeof src !== "object") return null;

    var g = src["-1"];
    if(typeof g === "number" && g >= 0 && g <= 2) limpio.respuestas["-1"] = g;

    for(var i=0;i<TOTAL;i++){
      var r = src[String(i)];
      if(typeof r === "string" && KEY_A_VAL.hasOwnProperty(r)) limpio.respuestas[String(i)] = r;
    }

    var idx = data.indice;
    limpio.indice = (typeof idx === "number" && isFinite(idx) && idx >= -1 && idx <= TOTAL + 1)
      ? Math.floor(idx) : -1;
    return limpio;
  }

  // Progreso comparable entre dos estados: cuántos alimentos lleva, para el "n de total"
  // que se le muestra a la lectora cuando hay que elegir entre dos versiones.
  function progresoEstado(st){
    if(!st) return 0;
    return Math.min(TOTAL, Math.max(0, st.indice) + (st.indice >= 0 ? 1 : 0));
  }

  /* ============================================================
     CODIFICACIÓN COMPACTA PARA EL ENLACE DE CONTINUACIÓN
     El fragmento nunca viaja a ningún servidor: vive solo en la URL local.
     Formato: 1 carácter para la pregunta general (0-2 o '.'), + 144 caracteres
     para los alimentos (0-3 o '.'), todo en base64url.
     CRÍTICO: cualquier fragmento que no cuadre EXACTO se descarta entero.
     ============================================================ */
  function base64UrlEncode(str){
    var b64 = btoa(str);
    return b64.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  function base64UrlDecode(s){
    var b64 = String(s).replace(/-/g,"+").replace(/_/g,"/");
    while(b64.length % 4) b64 += "=";
    return atob(b64);
  }

  function codificarEstado(st){
    if(!TOTAL) return "";
    var chars = [];
    var g = st.respuestas["-1"];
    chars.push((typeof g === "number" && g >= 0 && g <= 2) ? String(g) : ".");
    for(var i=0;i<TOTAL;i++){
      var r = st.respuestas[String(i)];
      var v = KEY_A_VAL.hasOwnProperty(r) ? KEY_A_VAL[r] : undefined;
      chars.push(v === undefined ? "." : String(v));
    }
    return base64UrlEncode(chars.join(""));
  }

  // Devuelve un estado válido o null. Nunca lanza, nunca confía en la forma de `payload`.
  function decodificarYValidar(payload){
    if(typeof payload !== "string" || !payload.length || payload.length > 400) return null;
    if(!/^[A-Za-z0-9_-]+$/.test(payload)) return null; // solo alfabeto base64url
    var raw;
    try{ raw = base64UrlDecode(payload); }catch(e){ return null; }
    if(typeof raw !== "string" || raw.length !== TOTAL + 1) return null;

    for(var i=0;i<raw.length;i++){
      var c = raw.charAt(i);
      var permitido = (i === 0) ? /^[0-2.]$/ : /^[0-3.]$/;
      if(!permitido.test(c)) return null;
    }

    var respuestas = {};
    if(raw.charAt(0) !== ".") respuestas["-1"] = parseInt(raw.charAt(0), 10);

    var maxContiguo = -1;
    var enBloqueContiguo = true;
    for(var j=1;j<raw.length;j++){
      var ch = raw.charAt(j);
      var idxAlimento = j - 1;
      if(ch === "."){ enBloqueContiguo = false; continue; }
      var val = parseInt(ch, 10);
      if(val < 0 || val > 3 || VAL_A_KEY[val] === undefined) return null;
      respuestas[String(idxAlimento)] = VAL_A_KEY[val];
      if(enBloqueContiguo) maxContiguo = idxAlimento;
    }

    var indice;
    if(raw.charAt(0) === "." && maxContiguo === -1) indice = -1;
    else indice = Math.min(TOTAL, maxContiguo + 1);

    return { v: 1, respuestas: respuestas, indice: indice, ts: Date.now() };
  }

  // Procesa el fragmento de la URL al arrancar. Si es válido, lo DEVUELVE sin tocar nada
  // más: no pisa lo que hubiera guardado. Es `iniciar()` quien decide si se aplica directo
  // o si hay que preguntar. Si no es válido (basura, longitud incorrecta, caracteres fuera
  // de rango, un <script> metido a mano...), se descarta entero y devuelve null.
  function procesarFragmentoDeEntrada(){
    var h = location.hash || "";
    if(h.indexOf("#c=") !== 0) return null;
    var payload = h.slice(3);
    var parsed = null;
    try{ parsed = decodificarYValidar(payload); }catch(e){ parsed = null; }
    try{ history.replaceState(null, "", location.pathname + location.search); }catch(e){}
    return parsed;
  }

  function construirEnlaceContinuacion(){
    var payload = codificarEstado(state);
    return location.origin + location.pathname + "#c=" + payload;
  }

  /* ============================================================
     RECUENTO ANÓNIMO — dos avisos ciegos, sin nada que los una
     ============================================================ */
  function enviarRecuento(tipo){
    if(!ENDPOINT) return; // sin endpoint, no se hace ninguna petición
    var flag = "test-alimentos-recuento-" + tipo;
    try{ if(sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, "1"); }catch(e){}
    try{
      fetch(ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ evento: tipo })
      });
    }catch(e){}
  }

  /* ============================================================
     PRECARGA DE IMÁGENES
     ============================================================ */
  var precargadas = {};
  function precargar(i){
    if(i < 0 || i >= TOTAL) return;
    var src = window.PREGUNTAS[i].img;
    if(precargadas[src]) return;
    precargadas[src] = true;
    var img = new Image();
    img.src = src;
  }
  function precargarSiguientes(i){ precargar(i+1); precargar(i+2); precargar(i+3); }

  /* ============================================================
     UTILIDADES DOM
     ============================================================ */
  function el(tag, attrs, children){
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function(k){
      if(k === "class") node.className = attrs[k];
      else if(k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children||[]).forEach(function(c){ if(c) node.appendChild(c); });
    return node;
  }
  function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // Enlace discreto al aviso legal. Mientras URL_AVISO_LEGAL esté vacía, no se muestra nada.
  function enlaceAvisoLegal(){
    if(!URL_AVISO_LEGAL) return null;
    return el("a", {class:"aviso-legal", href: URL_AVISO_LEGAL, target:"_blank", rel:"noopener", text:"Aviso legal"});
  }

  var luz = document.getElementById("luz");
  var app = document.getElementById("app");
  var modoActual = null;
  var enTransicion = false;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function esperar(ms){ return new Promise(function(res){ setTimeout(res, ms); }); }

  /* ============================================================
     MOMENTO 1 · peso al tacto — filas de opción (alimento y general)
     La fila se contrae un poco al primer contacto y se asienta con
     deceleración fuerte. Con reduced-motion se salta directo al estado
     final: se sigue entendiendo qué quedó marcado, sin movimiento.
     ============================================================ */
  function marcarFila(filaEl, hermanas){
    Array.prototype.forEach.call(hermanas, function(c){ c.classList.remove("sel", "presiona"); });
    if(reduceMotion){
      filaEl.classList.add("sel");
      return;
    }
    filaEl.classList.add("presiona");
    setTimeout(function(){
      filaEl.classList.remove("presiona");
      filaEl.classList.add("sel");
    }, 90);
  }

  /* ============================================================
     MOMENTO 3 · pulsado + confirmación dorada breve
     La presión (contracción) es igual en todos los botones. `accion`
     se dispara pasado `retrasoAccion` ms desde el click (por defecto 90,
     lo que tarda la contracción) para que el gesto se vea antes de que
     la pantalla cambie debajo. `revertirMs` deshace la confirmación en
     botones que no navegan (no hace falta si la pantalla cambia sola).
     ============================================================ */
  function pulsarBoton(btn, accion, opts){
    opts = opts || {};
    var retraso = (opts.retrasoAccion === undefined) ? 90 : opts.retrasoAccion;
    if(reduceMotion){
      btn.classList.add("hecho");
      if(opts.revertirMs){ setTimeout(function(){ btn.classList.remove("hecho"); }, opts.revertirMs); }
      if(accion) accion();
      return;
    }
    btn.classList.add("presiona");
    setTimeout(function(){
      btn.classList.remove("presiona");
      btn.classList.add("hecho");
      if(opts.revertirMs){ setTimeout(function(){ btn.classList.remove("hecho"); }, opts.revertirMs); }
    }, 90);
    if(accion){
      if(retraso <= 0) accion();
      else setTimeout(accion, retraso);
    }
  }

  // Pinta `builder()` dentro de #app. Si el modo (dark/light) cambia respecto al anterior,
  // baja la luz casi a negro, cambia el contenido en el punto más oscuro y la vuelve a subir.
  // Si no cambia de modo, o es la primera pantalla, el cambio es directo.
  function mostrar(builder, modo){
    if(enTransicion) return;
    var primerPintado = modoActual === null;
    if(reduceMotion || primerPintado || modo === modoActual){
      luz.dataset.modo = modo;
      modoActual = modo;
      app.innerHTML = "";
      app.appendChild(builder());
      window.scrollTo(0, 0);
      return;
    }
    enTransicion = true;
    luz.classList.add("baja");
    esperar(210).then(function(){
      luz.dataset.modo = modo;
      modoActual = modo;
      app.innerHTML = "";
      app.appendChild(builder());
      window.scrollTo(0, 0);
      luz.classList.remove("baja");
      luz.classList.add("sube");
      return esperar(20);
    }).then(function(){
      luz.classList.remove("sube");
      enTransicion = false;
    });
  }

  function setTituloPagina(t){ document.title = t; }
  function restaurarTitulo(){ document.title = TITULO_ORIGINAL; }

  // Estado que trae un enlace de continuación cuando YA hay progreso guardado en este
  // navegador y ambos difieren: no se escribe nada hasta que ella elija en la pantalla
  // de "dos versiones". Se vacía en cuanto elige.
  var estadoDelEnlace = null;

  /* ============================================================
     PANTALLA: DOS VERSIONES (transitoria, no persiste)
     Solo aparece cuando un enlace de continuación no coincide con el progreso que ya
     había en este navegador. Nada se escribe en localStorage hasta que ella elige.
     ============================================================ */
  function pantallaElegirVersion(){
    var t = T.ui || {};
    var nAqui = progresoEstado(state);
    var nEnlace = progresoEstado(estadoDelEnlace);

    var aqui = el("button", {class:"principal", type:"button"});
    aqui.textContent = (t.dosVersionesAqui || "Seguir con lo de este navegador ({n} de {total})")
      .replace("{n}", nAqui).replace("{total}", TOTAL);
    var enlace = el("button", {class:"secundaria", type:"button"});
    enlace.textContent = (t.dosVersionesEnlace || "Usar el enlace ({n} de {total})")
      .replace("{n}", nEnlace).replace("{total}", TOTAL);

    aqui.addEventListener("click", function(){
      pulsarBoton(aqui, function(){
        estadoDelEnlace = null;
        guardar();
        mostrarRetomar();
      }, {retrasoAccion:220});
    });
    enlace.addEventListener("click", function(){
      pulsarBoton(enlace, function(){
        state = estadoDelEnlace;
        estadoDelEnlace = null;
        guardar();
        mostrarRetomar();
      }, {retrasoAccion:220});
    });

    var contenido = el("div", {class:"txtscr"}, [
      el("h1", {text: (T.bienvenida && T.bienvenida.titulo) || "Cómo te sienta cada alimento"}),
      el("p", {class:"nota", text: t.dosVersionesAviso ||
        "Este enlace trae un mapa distinto al que ya tenías guardado en este navegador. ¿Cuál quieres seguir?",
        style:"margin-top:18px"}),
      el("div", {class:"retomar-caja"}, [aqui, enlace]),
      enlaceAvisoLegal()
    ]);
    return contenido;
  }

  /* ============================================================
     PANTALLA: RETOMAR (transitoria, no persiste)
     ============================================================ */
  function pantallaRetomar(){
    var t = (T.ui) || {};
    var terminado = state.indice >= TOTAL;
    var indiceGuardado = Math.max(0, state.indice);
    var numeroVisible = Math.min(TOTAL, indiceGuardado + 1);
    var mensaje = terminado
      ? (t.terminado || "Ya lo terminaste entero. ¿Quieres ver tu mapa?")
      : (t.retomar || "Lo dejaste en el alimento {n} de {total}. ¿Seguimos por ahí?")
          .replace("{n}", numeroVisible).replace("{total}", TOTAL);

    var seguir = el("button", {class:"principal", type:"button"});
    seguir.textContent = terminado ? (t.verMapa || "Ver mi mapa") : (t.retomarBoton || "Seguir donde lo dejé");
    var cero = el("button", {class:"secundaria", type:"button"});
    cero.textContent = t.empezarDeCero || "Empezar de cero";

    seguir.addEventListener("click", function(){
      pulsarBoton(seguir, function(){
        if(terminado){ state.indice = TOTAL; guardar(); }
        mostrarPantallaActual();
      }, {retrasoAccion:220});
    });
    cero.addEventListener("click", function(){
      pulsarBoton(cero, function(){
        borrarLocal();
        state = { v:1, respuestas:{}, indice:-1, ts: Date.now() };
        guardar();
        mostrarPantallaActual();
      }, {retrasoAccion:220});
    });

    var contenido = el("div", {class:"txtscr"}, [
      el("h1", {text: (T.bienvenida && T.bienvenida.titulo) || "Cómo te sienta cada alimento"}),
      el("p", {class:"nota", text: mensaje, style:"margin-top:18px"}),
      el("div", {class:"retomar-caja"}, [seguir, cero]),
      enlaceAvisoLegal()
    ]);
    return contenido;
  }

  /* ============================================================
     PANTALLA: PORTADA (petróleo, mosaico)
     ============================================================ */
  function pantallaPortada(){
    var B = T.bienvenida || {};
    var mosaico = el("div", {class:"mosaico"}, [
      el("img", {class:"m-a", src:"img/salmon.jpg", alt:"Salmón", loading:"eager"}),
      el("img", {class:"m-b", src:"img/huevo.jpg", alt:"Huevo", loading:"eager"}),
      el("img", {class:"m-c", src:"img/manzana.jpg", alt:"Manzana", loading:"eager"}),
      el("img", {class:"m-d", src:"img/lenteja.jpg", alt:"Lenteja", loading:"lazy"}),
      el("img", {class:"m-e", src:"img/brocoli.jpg", alt:"Brócoli", loading:"lazy"}),
      el("img", {class:"m-f", src:"img/jamon-serrano.jpg", alt:"Jamón serrano", loading:"lazy"})
    ]);
    var parrafos = (B.parrafos||[]).map(function(p){ return el("p", {text:p}); });
    var boton = el("button", {class:"cta", type:"button"});
    boton.textContent = B.cta || "Empezar test";
    boton.addEventListener("click", function(){ pulsarBoton(boton, irAGeneral); });

    var cuerpo = el("div", {class:"portadaCuerpo"}, [
      el("h1", {text: B.titulo || ""}),
      el("div", {class:"parrafos"}, parrafos),
      el("p", {class:"nota", text: B.nota || ""}),
      el("div", {class:"relleno"}),
      boton,
      enlaceAvisoLegal()
    ]);
    var contenido = el("div", {class:"scr-portada"}, [mosaico, cuerpo]);
    return contenido;
  }

  /* ============================================================
     PANTALLA: PREGUNTA GENERAL (marfil, no puntúa)
     ============================================================ */
  function pantallaGeneral(){
    var G = T.general || {};
    var cols = ["var(--verde)", "var(--ambar)", "var(--rojo)"];
    var opsWrap = el("div", {class:"ops-generales"});
    (G.opciones||[]).forEach(function(texto, i){
      var boton = el("button", {class:"op-general", type:"button", style:"--c:"+cols[i]}, [
        el("span", {class:"dot"}),
        el("span", {class:"tx", text:texto})
      ]);
      boton.addEventListener("click", function(){
        marcarFila(boton, opsWrap.children);
        state.respuestas["-1"] = i;
        state.indice = -1;
        guardar();
        setTimeout(function(){
          state.indice = 0;
          guardar();
          mostrarPantallaActual();
        }, 300);
      });
      opsWrap.appendChild(boton);
    });
    var contenido = el("div", {class:"txtscr"}, [
      el("h1", {text: G.pregunta || ""}),
      opsWrap
    ]);
    precargarSiguientes(-1);
    return contenido;
  }

  /* ============================================================
     PANTALLA: ALIMENTO (marfil, foto a sangre)
     ============================================================ */
  function pantallaAlimento(i){
    var p = window.PREGUNTAS[i];
    var t = T.pregunta || {};
    var pct = ((i+1) / TOTAL * 100).toFixed(1);

    var rail = el("div", {class:"rail"}, [el("i", {style:"width:"+pct+"%"})]);
    var atras = el("button", {class:"atras", type:"button", "aria-label":"Volver a la pregunta anterior"});
    atras.textContent = "← " + ((T.ui && T.ui.atras) || "Atrás");
    atras.addEventListener("click", irAtras);
    var band = el("div", {class:"band"}, [el("span", {class:"cat", text: p.categoria}), atras]);
    var foto = el("img", {class:"foto", src:p.img, alt:cap(p.nombre), loading:(i===0?"eager":"lazy")});

    var respuestaActual = state.respuestas[String(i)];
    var opciones = [
      {key:"verde", texto: t.verde || "Bien, sin problema"},
      {key:"ambar", texto: t.ambar || "Depende del día"},
      {key:"rojo",  texto: t.rojo  || "Me sienta mal"},
      {key:"nose",  texto: t.nose  || "No lo sé", hueco:true}
    ];
    var opsWrap = el("div", {class:"ops"});
    opciones.forEach(function(o){
      var fila = el("button", {
        class: "op" + (respuestaActual === o.key ? " sel" : ""),
        type: "button",
        style: o.hueco ? "" : "--c:var(--"+o.key+")",
        "data-key": o.key
      }, [
        el("span", {class:"dot" + (o.hueco?" hueco":"")}),
        el("span", {class:"tx", text:o.texto})
      ]);
      fila.addEventListener("click", function(){ seleccionar(i, o.key, fila, opsWrap); });
      opsWrap.appendChild(fila);
    });

    var ident = el("div", {class:"ident"}, [
      el("h2", {class:"nm", text: cap(p.nombre)}),
      el("p", {class:"q", text: t.encabezado || "¿Cómo te suele sentar?"})
    ]);

    var foot = el("p", {class:"foot", text: (T.ui && T.ui.guardado) || "Se guarda solo, puedes cerrar cuando quieras."});
    if(i >= FOOT_HASTA) foot.hidden = true;

    var panel = el("div", {class:"panel"}, [ident, opsWrap, foot]);
    var cuerpo = el("div", {class:"cuerpoAlimento"}, [foto, panel]);

    var contenido = el("div", {class:"scr-alimento"}, [rail, band, cuerpo]);
    precargarSiguientes(i);
    return contenido;
  }

  function seleccionar(i, key, filaEl, opsWrap){
    marcarFila(filaEl, opsWrap.children);
    state.respuestas[String(i)] = key;
    state.indice = i;
    guardar();
    setTimeout(function(){ avanzarDesdeAlimento(i); }, 300);
  }

  function avanzarDesdeAlimento(i){
    if(i === TOTAL - 1){
      // último alimento del test entero: directo al mapa, sin respiro
      state.indice = TOTAL;
      guardar();
      mostrarPantallaActual();
      return;
    }
    var info = CATINFO[i];
    if(info.esUltimaDeSuCategoria){
      mostrarRespiro(i);
    }else{
      avanzarASiguienteAlimento(i, i + 1);
    }
  }

  /* ============================================================
     MOMENTO 2 · deslizamiento breve entre alimentos (mismo modo)
     La pantalla que sale se retira ~5px hacia arriba mientras se apaga;
     la que entra llega ~7px desde abajo. Es solo para el paso de un
     alimento a otro dentro del mismo modo de color: la bajada de luz de
     portada/respiro no se toca, y esta animación no se usa ahí.
     ============================================================ */
  function avanzarASiguienteAlimento(iActual, iSiguiente){
    state.indice = iSiguiente;
    guardar();
    var actual = app.querySelector(".scr-alimento");
    if(reduceMotion || !actual){
      app.innerHTML = "";
      app.appendChild(pantallaAlimento(iSiguiente));
      window.scrollTo(0, 0);
      return;
    }
    var nuevo = pantallaAlimento(iSiguiente);
    actual.classList.add("m2-saliendo");
    nuevo.classList.add("m2-entrando");
    app.appendChild(nuevo);
    void nuevo.offsetWidth; // fuerza el estado inicial antes de animar
    requestAnimationFrame(function(){
      actual.classList.add("m2-fuera");
      nuevo.classList.add("m2-entra");
    });
    setTimeout(function(){
      if(actual.parentNode){ actual.parentNode.removeChild(actual); }
      nuevo.classList.remove("m2-entrando", "m2-entra");
      window.scrollTo(0, 0);
    }, 300);
  }

  /* ============================================================
     PANTALLA: RESPIRO (petróleo, toda la información de progreso)
     ============================================================ */
  function mostrarRespiro(iCompletado){
    var info = CATINFO[iCompletado];
    var hecho = iCompletado + 1;
    var restan = TOTAL - hecho;
    var pct = Math.round(hecho / TOTAL * 100);
    var min = Math.max(1, Math.round(restan * SEG_POR_ALIMENTO / 60));
    var siguiente = iCompletado + 1;
    var linea = (T.respiro && T.respiro[info.nombre]) || "";

    var barra = el("div", {class:"barra"}, [el("i", {style:"width:"+pct+"%"})]);
    var cifras = el("div", {class:"cifras"}, [
      el("b", {text: pct + "%"}), el("span", {text:"hecho"})
    ]);
    var quedan = el("p", {class:"quedan", text: "Quedan " + restan + " alimentos de " + TOTAL + "."});
    var tiempo = el("div", {class:"tiempo"}, [
      document.createTextNode("Te quedan unos "),
      el("b", {text: min + " min"})
    ]);
    var barrablk = el("div", {class:"barrablk"}, [barra, cifras, quedan, tiempo]);

    // enlace de continuación — copia, nunca envía
    var etq = el("p", {class:"et", text:"Por si sigues en otro sitio"});
    var desc = el("p", {class:"desc", text:
      "Tus respuestas viven solo en este navegador. Este enlace las lleva dentro, comprimidas: " +
      "cópialo, mándatelo a ti misma y al abrirlo sigues donde lo dejaste. No pasa por ningún " +
      "servidor y a mí no me llega nada. Se queda donde tú lo dejes, así que bórralo cuando ya " +
      "no te haga falta."
    });
    var btnCopiar = el("button", {class:"btnEnlace", type:"button", text:"Copiar mi enlace"});
    var msgCopiado = el("p", {class:"copiado"});
    btnCopiar.addEventListener("click", function(ev){
      ev.stopPropagation();
      pulsarBoton(btnCopiar, function(){ copiarEnlace(msgCopiado); }, {retrasoAccion:0, revertirMs:1600});
    });
    var enlaceBlk = el("div", {class:"enlace"}, [etq, desc, btnCopiar, msgCopiado]);

    var seguirBtn = el("button", {class:"seguir", type:"button", text:"Seguir"});

    var contenido = el("div", {class:"scr-respiro"}, [
      el("p", {class:"linea", text: linea}),
      barrablk,
      enlaceBlk,
      seguirBtn
    ]);

    mostrar(function(){ return contenido; }, "dark");

    var avanzado = false;
    function continuar(){
      if(avanzado) return;
      avanzado = true;
      if(siguiente >= TOTAL){ state.indice = TOTAL; }else{ state.indice = siguiente; }
      guardar();
      mostrarPantallaActual();
    }
    // El respiro NO avanza solo: lleva el enlace de continuacion, y nadie lo lee ni lo
    // copia en dos segundos. Sale con el boton, y solo con el boton.
    seguirBtn.addEventListener("click", function(ev){
      ev.stopPropagation();
      pulsarBoton(seguirBtn, continuar);
    });
  }

  function copiarEnlace(msgEl){
    var enlace = construirEnlaceContinuacion();
    function feedback(ok){
      msgEl.textContent = ok
        ? "Copiado. Mándatelo a ti misma antes de cerrar esto."
        : "No se pudo copiar. Mantén pulsado el enlace para copiarlo a mano.";
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(enlace).then(function(){ feedback(true); }, function(){ feedback(false); });
    }else{
      try{
        var ta = document.createElement("textarea");
        ta.value = enlace;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        feedback(ok);
      }catch(e){ feedback(false); }
    }
  }

  /* ============================================================
     PANTALLA: MAPA — pliego de herbario compuesto por fichas de fichero.
     Se agrupa SOLO por color y, dentro, por categoría de alimento.
     ============================================================ */
  var COL_MAPA = { verde:"#7E9B76", ambar:"#CB9151", rojo:"#A65A4A", nose:"#94A4AC" };
  var ORDEN_MAPA = [MAPA_VERDE, MAPA_AMBAR, MAPA_ROJO, MAPA_NOSE];
  var MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  function agruparRespuestas(){
    var grupos = { verde:[], ambar:[], rojo:[], nose:[] };
    for(var i=0;i<TOTAL;i++){
      var r = state.respuestas[String(i)];
      if(!r || !grupos[r]) continue;
      var p = window.PREGUNTAS[i];
      grupos[r].push({ nombre: p.nombre, categoria: p.categoria, img: p.img, sig: SIGNATURAS[i] });
    }
    return grupos;
  }

  function fechaRegistro(){
    var d = new Date();
    return MESES[d.getMonth()] + " " + d.getFullYear();
  }

  // Una ficha del fichero: foto cuadrada + muesca de color + nombre (con signatura opcional).
  function ficha(item, conNombre){
    var img = el("img", {src:item.img, alt:cap(item.nombre), loading:"lazy"});
    var hijos = [el("div", {class:"muesca", style:"background:"+COL_MAPA[item._r || item.color]}), img];
    if(conNombre){
      hijos.push(el("div", {class:"et", text: cap(item.nombre)}));
      hijos.push(el("span", {class:"sig", text: item.sig}));
    }
    return el("div", {class:"ficha-mini"}, hijos);
  }

  // Construye las bandas (por color) y dentro las familias (por categoría).
  function bandas(grupos, conNombre){
    var out = [];
    ORDEN_MAPA.forEach(function(c){
      var lista = grupos[c];
      var titulo = (T.mapa && T.mapa.leyenda && T.mapa.leyenda[c]) || c;
      var tit = el("div", {class:"tit"}, [
        el("i", {style:"background:"+COL_MAPA[c]}),
        el("b", {text:titulo}),
        el("em", {text: lista.length + " de " + TOTAL})
      ]);
      var banda = el("div", {class:"banda"}, [tit]);
      if(!lista.length){
        banda.appendChild(el("p", {class:"vacio", text: (T.mapa && T.mapa.vacio) || "Ninguno por aquí."}));
      }else{
        CATEGORIAS_ORDEN.forEach(function(cat){
          var g = lista.filter(function(f){ return f.categoria === cat; });
          if(!g.length) return;
          g.forEach(function(f){ f._r = c; });
          var f = el("div", {class:"f"}, [
            el("span", {text:cat}), el("span", {text:String(g.length)})
          ]);
          var rej = el("div", {class:"rej"}, g.map(function(item){ return ficha(item, conNombre); }));
          banda.appendChild(el("div", {class:"fam"}, [f, rej]));
        });
      }
      out.push(banda);
    });
    return out;
  }

  function pantallaMapa(){
    var M = T.mapa || {};
    var grupos = agruparRespuestas();
    var registro = el("div", {class:"reg", text: fechaRegistro() + " · " + TOTAL + " ejemplares"});

    var acciones = el("div", {class:"acciones"});
    var btnImprimir = el("button", {type:"button", text:"Guardar en PDF"});
    btnImprimir.addEventListener("click", function(){
      pulsarBoton(btnImprimir, function(){ window.print(); }, {revertirMs:1600});
    });
    acciones.appendChild(btnImprimir);

    var continuar = el("button", {class:"continuar", type:"button", text:"Ya lo he visto"});
    continuar.addEventListener("click", function(){
      state.indice = TOTAL + 1;
      guardar();
      mostrarPantallaActual();
    });

    var cierre = el("div", {class:"cierre"}, [el("p", {text: M.cierre || ""})]);

    // Versión de pantalla — con nombres, 3 columnas (regla CSS).
    var pantalla = el("div", {class:"mapa-pantalla"}, [
      el("h1", {text: M.titulo || "Mi mapa de alimentos"}),
      el("p", {class:"sub", text: M.subtitulo || ""}),
      registro,
      el("div", {class:"bandas"}, bandas(grupos, true)),
      cierre
    ]);

    // Versión de impresión — solo fotos, 8 columnas (regla CSS), mismo cierre al final.
    var registroImp = el("div", {class:"reg", text: fechaRegistro() + " · " + TOTAL + " ejemplares"});
    var cierreImp = el("div", {class:"cierre"}, [el("p", {text: M.cierre || ""})]);
    var impresion = el("div", {class:"mapa-impresion"}, [
      el("div", {class:"top"}, [
        el("div", {}, [
          el("h1", {text: M.titulo || "Mi mapa de alimentos"}),
          el("p", {class:"sub", text: M.subtitulo || ""})
        ]),
        registroImp
      ]),
      el("div", {class:"cols"}, bandas(grupos, false)),
      cierreImp
    ]);

    var contenido = el("div", {class:"scr-mapa"}, [
      pantalla,
      acciones,
      continuar,
      enlaceAvisoLegal(),
      impresion
    ]);

    setTituloPagina("mi-mapa-de-alimentos");
    return contenido;
  }

  /* ============================================================
     PANTALLA: FINAL (petróleo, sin botón, solo enlace pequeño al mapa)
     ============================================================ */
  function pantallaFinal(){
    var F = T.final || {};
    var parrafos = (F.parrafos||[]).map(function(p){ return el("p", {text:p}); });
    var verMapa = el("a", {class:"enlace-mapa", href:"#", text: (T.ui && T.ui.verMapa) || "Ver mi mapa"});
    verMapa.addEventListener("click", function(ev){
      ev.preventDefault();
      state.indice = TOTAL;
      guardar();
      mostrarPantallaActual();
    });
    var contenido = el("div", {class:"txtscr"}, [
      el("h1", {text: F.titulo || "Gracias por terminarlo"}),
      el("div", {class:"parrafos"}, parrafos),
      el("p", {class:"nota", text: F.nota || ""}),
      verMapa,
      enlaceAvisoLegal()
    ]);
    restaurarTitulo();
    enviarRecuento("fin");
    return contenido;
  }

  /* ============================================================
     NAVEGACIÓN
     ============================================================ */
  function irAGeneral(){
    state.indice = -1;
    guardar();
    mostrar(pantallaGeneral, "light");
  }

  function mostrarPantallaActual(){
    if(state.indice === -1){
      mostrar(pantallaGeneral, "light");
    }else if(state.indice >= 0 && state.indice < TOTAL){
      mostrar(function(){ return pantallaAlimento(state.indice); }, "light");
    }else if(state.indice === TOTAL){
      mostrar(pantallaMapa, "light");
    }else{
      mostrar(pantallaFinal, "dark");
    }
  }

  function irAtras(){
    if(state.indice <= 0){
      state.indice = -1;
      guardar();
      mostrar(pantallaGeneral, "light");
      return;
    }
    state.indice = state.indice - 1;
    guardar();
    mostrarPantallaActual();
  }

  document.addEventListener("keydown", function(ev){
    if(state.indice < 0 || state.indice >= TOTAL) return;
    if(ev.key === "ArrowLeft"){ irAtras(); return; }
    var mapaTeclas = {"1":"verde", "2":"ambar", "3":"rojo", "4":"nose"};
    if(mapaTeclas[ev.key]){
      var fila = document.querySelector('.op[data-key="'+mapaTeclas[ev.key]+'"]');
      if(fila) fila.click();
    }
  });

  /* ============================================================
     ARRANQUE
     ============================================================ */
  // Pantalla transitoria (retomar o elegir versión): no pasa por `mostrar()` porque no es
  // una pantalla del recorrido normal ligada a `state.indice`.
  function mostrarRetomar(){
    modoActual = "light";
    luz.dataset.modo = "light";
    app.innerHTML = "";
    app.appendChild(estadoDelEnlace ? pantallaElegirVersion() : pantallaRetomar());
  }

  function iniciar(){
    var delEnlace = procesarFragmentoDeEntrada();
    var guardado = cargarLocal();
    var hayGuardado = !!(guardado && (guardado.indice > -1 || Object.keys(guardado.respuestas).length > 0));

    if(delEnlace && hayGuardado){
      if(progresoEstado(guardado) === progresoEstado(delEnlace)){
        // Mismo punto: no la mareamos con una elección que no cambia nada.
        state = delEnlace;
        guardar();
      }else{
        // Dos versiones distintas: no se escribe nada todavía. Elige ella.
        state = guardado;
        estadoDelEnlace = delEnlace;
      }
    }else if(delEnlace){
      state = delEnlace;
      guardar();
    }else if(guardado){
      state = guardado;
    }

    var hayProgreso = estadoDelEnlace || state.indice > -1 || Object.keys(state.respuestas).length > 0;
    if(hayProgreso){
      mostrarRetomar();
    }else{
      mostrar(pantallaPortada, "dark");
    }
    enviarRecuento("inicio");
  }

  iniciar();
})();
