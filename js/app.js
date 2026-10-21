// Al Céntimo · web de descarga. Sin dependencias: versión al día desde GitHub Releases
// (con version.json de reserva), aviso de versión nueva, QR para quien no está en Android y
// las pantallas simuladas.
(function () {
  "use strict";

  var cfg = window.AL_CENTIMO;
  var URL_APK = "https://github.com/" + cfg.usuario + "/" + cfg.repo + "/releases/latest/download/" + cfg.apk;
  var URL_RELEASES = "https://github.com/" + cfg.usuario + "/" + cfg.repo + "/releases";
  var API = "https://api.github.com/repos/" + cfg.usuario + "/" + cfg.repo + "/releases?per_page=3";
  var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  // ---------- Formato de importes (igual que formatMoney de la app) ----------
  function euros(centimos) {
    var neg = centimos < 0, c = Math.abs(Math.round(centimos));
    var ent = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    var dec = ("0" + (c % 100)).slice(-2);
    return { neg: neg, ent: ent, dec: dec };
  }
  function texto(centimos, signo) {
    var e = euros(centimos);
    var s = signo && centimos > 0 ? "+" : (e.neg ? "−" : "");
    return s + e.ent + "," + e.dec + " €";
  }
  function precio(el, centimos) {
    var e = euros(centimos);
    el.innerHTML = '<span class="e">' + (e.neg ? "−" : "") + e.ent + '</span><span class="cts">,' + e.dec + '</span><span class="eur">€</span>';
  }
  function contar(desde, hasta, ms, cada) {
    if (reducido) { cada(hasta); return; }
    var t0 = performance.now();
    (function paso(t) {
      // El primer frame puede llegar con una marca de tiempo anterior a t0: k nunca baja de 0.
      var k = Math.max(0, Math.min(1, (t - t0) / ms)), f = 1 - Math.pow(1 - k, 4);
      cada(Math.round(desde + (hasta - desde) * f));
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }

  // ---------- Enlaces de descarga ----------
  document.querySelectorAll(".js-descarga").forEach(function (a) { a.href = URL_APK; });
  var enlVers = document.getElementById("enlace-versiones");
  if (enlVers) enlVers.href = URL_RELEASES;

  // ---------- Versión, fecha, tamaño y novedades ----------
  function fechaLarga(iso) {
    var d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    return isNaN(d) ? "" : d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
  }
  function fechaCorta(iso) {
    var d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
    return isNaN(d) ? "" : d.getDate() + " " + MESES_CORTOS[d.getMonth()];
  }
  function megas(bytes) { return Math.round(bytes / 1e6) + " MB"; }
  function poner(clave, valor) {
    if (!valor) return;
    document.querySelectorAll('[data-v="' + clave + '"]').forEach(function (el) { el.textContent = valor; });
  }
  function limpiarVersion(tag) { return String(tag || "").replace(/^v/i, "").trim(); }
  function compararVersiones(a, b) {
    var x = a.split("."), y = b.split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d;
    }
    return 0;
  }

  // Del Markdown del release saca las viñetas para el público (se salta "Cambios técnicos").
  function vinetas(md) {
    var out = [], saltar = false;
    String(md || "").split(/\r?\n/).forEach(function (l) {
      var h = l.match(/^#{1,6}\s+(.*)/);
      if (h) { saltar = /t[eé]cnic/i.test(h[1]); return; }
      var m = l.match(/^\s*[-*]\s+(.*)/);
      if (m && !saltar) out.push(m[1].trim());
    });
    return out;
  }
  function escapar(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sinMarkdown(s) { return s.replace(/\*\*|__|`/g, ""); }
  function mayuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function pintarNovedades(versiones) {
    var ol = document.getElementById("cartel");
    if (!ol) return;
    var html = "";
    versiones.forEach(function (v) {
      var tag = "v" + v.version + (v.fecha ? " · " + fechaCorta(v.fecha) : "");
      v.novedades.forEach(function (n) {
        var m = n.match(/^\*\*(.+?)\*\*\s*[:.·—-]?\s*(.*)$/);
        if (m) {
          html += '<li><span class="grande">' + escapar(sinMarkdown(m[1]).replace(/[:.]$/, "")) + '</span><span class="ver-tag">' + tag + "</span>" +
            (m[2] ? '<span class="detalle">' + escapar(mayuscula(sinMarkdown(m[2]))) + "</span>" : "") + "</li>";
        } else {
          html += '<li class="menor"><span class="grande">' + escapar(sinMarkdown(n)) + '</span><span class="ver-tag">' + tag + "</span></li>";
        }
      });
    });
    if (html) ol.innerHTML = html;
  }

  function aplicar(info) {
    poner("version", "v" + info.version);
    poner("fecha", fechaLarga(info.fecha));
    if (info.tamano) poner("tamano", megas(info.tamano));
    pintarNovedades(info.lista);
    avisoVersionNueva(info.version);
  }

  function avisoVersionNueva(version) {
    var vista = null;
    try { vista = localStorage.getItem("alcentimo:version-vista"); } catch (e) { /* sin almacenamiento */ }
    var aviso = document.getElementById("aviso-version");
    if (vista && compararVersiones(version, vista) > 0 && aviso) {
      aviso.hidden = false;
      document.getElementById("cerrar-aviso").addEventListener("click", function () { aviso.hidden = true; });
    }
    try { localStorage.setItem("alcentimo:version-vista", version); } catch (e) { /* sin almacenamiento */ }
  }

  function desdeGitHub() {
    return fetch(API, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error("API " + r.status); return r.json(); })
      .then(function (rels) {
        rels = rels.filter(function (r) { return !r.draft && !r.prerelease; });
        if (!rels.length) throw new Error("Sin releases");
        var ult = rels[0];
        var apk = (ult.assets || []).filter(function (a) { return a.name === cfg.apk; })[0] ||
          (ult.assets || []).filter(function (a) { return /\.apk$/i.test(a.name); })[0];
        return {
          version: limpiarVersion(ult.tag_name),
          fecha: (ult.published_at || "").slice(0, 10),
          tamano: apk ? apk.size : null,
          lista: rels.map(function (r) {
            return { version: limpiarVersion(r.tag_name), fecha: (r.published_at || "").slice(0, 10), novedades: vinetas(r.body) };
          })
        };
      });
  }
  function desdeLocal() {
    return fetch("version.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("version.json " + r.status); return r.json(); })
      .then(function (j) {
        var lista = [{ version: j.version, fecha: j.fecha, novedades: j.novedades || [] }].concat(j.anteriores || []);
        return { version: j.version, fecha: j.fecha, tamano: j.tamano, lista: lista };
      });
  }
  desdeGitHub().catch(desdeLocal).then(aplicar).catch(function () { /* se queda lo que trae el HTML */ });

  // ---------- Quien no está en Android ----------
  var esAndroid = /android/i.test(navigator.userAgent || "");
  if (!esAndroid) {
    var caja = document.getElementById("solo-android");
    var qr = document.getElementById("qr");
    if (caja && qr && window.qrSvg) {
      try {
        qr.innerHTML = window.qrSvg(cfg.web, "Código QR con la dirección de esta página");
        caja.hidden = false;
      } catch (e) { /* sin QR, la página sigue */ }
    }
  }

  // ---------- Entradas al hacer scroll ----------
  var subes = document.querySelectorAll(".sube");
  if ("IntersectionObserver" in window && !reducido) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("dentro"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    subes.forEach(function (el) { io.observe(el); });
  } else {
    subes.forEach(function (el) { el.classList.add("dentro"); });
  }

  // ---------- Inicio: el saldo cuenta y entra un movimiento nuevo ----------
  (function () {
    var saldo = document.getElementById("inicio-saldo");
    if (!saldo) return;
    var gas = document.getElementById("inicio-gas"), lista = document.getElementById("inicio-movs");
    contar(0, 124850, 1400, function (c) { precio(saldo, c); });
    setTimeout(function () {
      var li = document.createElement("li");
      li.className = "nuevo";
      li.innerHTML = '<span class="cat" style="background:#F4A89A">R</span><span><span class="que">Café</span><br><span class="cuando">Ahora</span></span><span class="cifra sale">−2,40 €</span>';
      lista.insertBefore(li, lista.firstChild);
      if (lista.children.length > 5) lista.removeChild(lista.lastElementChild);
      contar(124850, 124610, 350, function (c) { precio(saldo, c); });
      gas.textContent = "−903,90 €";
    }, reducido ? 0 : 2600);
  })();

  // ---------- Qué hace: el móvil fijo cambia de pantalla ----------
  var capas = {};
  document.querySelectorAll("[data-capa]").forEach(function (c) { capas[c.dataset.capa] = c; });
  var activa = "informes", vistas = {};
  var alEntrar = {
    informes: function () {
      capas.informes.querySelectorAll(".inf-cats i").forEach(function (i) { i.style.setProperty("--v", i.dataset.v); });
    },
    presupuestos: function () {
      capas.presupuestos.querySelectorAll("#pr-lista li").forEach(function (li, n) {
        var g = parseFloat(li.dataset.g), l = parseFloat(li.dataset.l), fin = g / l;
        var barra = li.querySelector(".barra i"), pct = li.querySelector(".pct");
        li.classList.remove("cerca", "pasado");
        var t0 = null, ms = reducido ? 1 : 1100, retraso = reducido ? 0 : n * 120;
        function paso(t) {
          if (t0 === null) t0 = t;
          var k = Math.max(0, Math.min(1, (t - t0 - retraso) / ms)), f = 1 - Math.pow(1 - k, 3), v = fin * f;
          barra.style.transform = "scaleX(" + Math.min(1, v) + ")";
          pct.textContent = Math.round(v * 100) + " %";
          li.classList.toggle("cerca", v >= 0.8 && v < 1);
          li.classList.toggle("pasado", v >= 1);
          if (k < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
      });
    },
    ticket: function () { cicloTicket(); },
    widget: function () { frase(fraseActual); }
  };

  function activar(nombre) {
    if (!capas[nombre] || nombre === activa && vistas[nombre]) return;
    Object.keys(capas).forEach(function (k) {
      capas[k].classList.toggle("activa", k === nombre);
      if (k !== nombre) capas[k].setAttribute("aria-hidden", "true"); else capas[k].removeAttribute("aria-hidden");
    });
    activa = nombre;
    vistas[nombre] = true;
    if (alEntrar[nombre]) alEntrar[nombre]();
  }
  if ("IntersectionObserver" in window) {
    // En el móvil el teléfono tapa la mitad de arriba: cuenta el capítulo que se lee debajo.
    var ioPasos = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activar(e.target.dataset.paso); });
    }, { rootMargin: window.matchMedia("(max-width: 860px)").matches ? "-62% 0px -30% 0px" : "-40% 0px -40% 0px" });
    document.querySelectorAll("[data-paso]").forEach(function (p) { ioPasos.observe(p); });
    var ioMovil = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting && !vistas[activa]) activar(activa);
    });
    var pant = document.getElementById("relato-pantalla");
    if (pant) ioMovil.observe(pant);
  } else {
    Object.keys(alEntrar).forEach(function (k) { if (k !== "ticket" && k !== "widget") alEntrar[k](); });
  }

  // Grupos: marcar pagado
  (function () {
    var lista = document.getElementById("gr-liq");
    if (!lista) return;
    var saldos = { "Lucía": 8420, "Tú": -1260, "Marcos": -4110, "Irene": -3050 };
    var hecho = document.getElementById("gr-hecho");
    function pintar() {
      document.querySelectorAll("#gr-saldos li").forEach(function (li) {
        var c = saldos[li.dataset.p], cifra = li.querySelector(".cifra");
        cifra.textContent = c === 0 ? "0,00 €" : texto(c, true);
        cifra.className = "cifra" + (c > 0 ? " entra" : c < 0 ? " sale" : "");
      });
      var pend = lista.querySelectorAll("li:not(.pagado)").length;
      hecho.textContent = pend ? "" : "Todo cuadrado. Nadie debe nada.";
      hecho.classList.toggle("ver", !pend);
    }
    lista.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b) return;
      var li = b.closest("li"), c = parseInt(li.dataset.c, 10), pagado = !li.classList.contains("pagado");
      li.classList.toggle("pagado", pagado);
      saldos[li.dataset.de] += pagado ? c : -c;
      saldos["Lucía"] -= pagado ? c : -c;
      b.textContent = pagado ? "Deshacer" : "Marcar pagado";
      pintar();
    });
  })();

  // Ticket: se lee y se convierte en gasto, en bucle mientras se ve
  var tkTimers = [];
  function cicloTicket() {
    var foto = document.getElementById("tk-foto"), gasto = document.getElementById("tk-gasto");
    if (!foto) return;
    tkTimers.forEach(clearTimeout); tkTimers = [];
    foto.style.setProperty("--alto-tk", foto.offsetHeight + "px");
    if (reducido) { foto.classList.add("leido"); gasto.classList.add("ver"); return; }
    foto.classList.remove("leyendo", "leido"); gasto.classList.remove("ver");
    void foto.offsetWidth;
    tkTimers.push(setTimeout(function () { foto.classList.add("leyendo"); }, 300));
    tkTimers.push(setTimeout(function () { foto.classList.add("leido"); }, 1700));
    tkTimers.push(setTimeout(function () { gasto.classList.add("ver"); }, 2400));
    tkTimers.push(setTimeout(function () { if (activa === "ticket") cicloTicket(); }, 7600));
  }

  // Widget + asistente: frases de ejemplo
  var FRASES = [
    { t: "Cena de 45 € con dos amigos, pagué yo", r: [["Qué es", "Gasto en un grupo nuevo"], ["Concepto", "Cena"], ["Importe", "45,00 €"], ["Pagó", "Tú"], ["Reparto", "3 personas · 15,00 € cada una"]] },
    { t: "Gasolina, 60 €", r: [["Qué es", "Gasto"], ["Concepto", "Gasolina"], ["Importe", "60,00 €"], ["Categoría", "Transporte"], ["Fecha", "Hoy"]] },
    { t: "Me han pagado 120 € por la clase", r: [["Qué es", "Ingreso"], ["Concepto", "Clase"], ["Importe", "120,00 €"], ["Categoría", "Otros ingresos"], ["Fecha", "Hoy"]] }
  ];
  var fraseActual = 0, wgTimers = [];
  function frase(i) {
    var hoja = document.getElementById("wg-hoja"), txt = document.getElementById("wg-texto");
    var ent = document.getElementById("wg-entendido"), dl = document.getElementById("wg-dl");
    if (!hoja) return;
    fraseActual = i;
    wgTimers.forEach(clearTimeout); wgTimers = [];
    var f = FRASES[i];
    dl.innerHTML = f.r.map(function (p) { return "<dt>" + p[0] + "</dt><dd>" + p[1] + "</dd>"; }).join("");
    if (reducido) { hoja.classList.add("ver"); txt.textContent = f.t; ent.classList.add("ver"); return; }
    ent.classList.remove("ver"); txt.textContent = "";
    hoja.classList.remove("ver");
    wgTimers.push(setTimeout(function () { hoja.classList.add("ver"); }, 250));
    var n = 0;
    function teclear() {
      txt.textContent = f.t.slice(0, ++n);
      if (n < f.t.length) wgTimers.push(setTimeout(teclear, 38 + Math.random() * 40));
      else wgTimers.push(setTimeout(function () { ent.classList.add("ver"); }, 450));
    }
    wgTimers.push(setTimeout(teclear, 800));
  }
  document.querySelectorAll(".frase-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll(".frase-btn").forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      activar("widget");
      frase(parseInt(b.dataset.f, 10));
    });
  });

  // ---------- Repartir al céntimo (repartoIgual de la app) ----------
  (function () {
    var inp = document.getElementById("rp-importe");
    if (!inp) return;
    var out = document.getElementById("rp-personas"), lista = document.getElementById("rp-lista");
    var menos = document.getElementById("rp-menos"), mas = document.getElementById("rp-mas");
    var titulo = document.getElementById("rp-titulo"), suma = document.getElementById("rp-suma"), cuadra = document.getElementById("rp-cuadra");
    var GENTE = [["Tú", "#F2C230"], ["Lucía", "#9ED3B3"], ["Marcos", "#A9C4EA"], ["Irene", "#F4A89A"], ["Pablo", "#F6C98B"], ["Nuria", "#9ED3B3"],
      ["Óscar", "#A9C4EA"], ["Carmen", "#F4A89A"], ["Javi", "#F6C98B"], ["Sara", "#F2C230"], ["Hugo", "#9ED3B3"], ["Elena", "#A9C4EA"]];
    var n = 3;
    function leer() {
      var s = inp.value.replace(/[^\d,.]/g, "");
      if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
      var v = parseFloat(s);
      return isNaN(v) ? 0 : Math.min(Math.round(v * 100), 99999999);
    }
    var NUM = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once"];
    function calcular() {
      var c = leer(), base = Math.floor(c / n), resto = c - base * n, total = 0, html = "";
      for (var i = 0; i < n; i++) {
        var parte = base + (i < resto ? 1 : 0), p = GENTE[i], ini = p[0] === "Tú" ? "Tú" : p[0][0];
        total += parte;
        var e = euros(parte);
        html += '<li' + (i < resto ? ' class="extra"' : "") + '><span class="ui-avatar" style="background:' + p[1] + '">' + ini + "</span><span>" + p[0] +
          '</span><span class="precio"><span class="e">' + e.ent + '</span><span class="cts">,' + e.dec + '</span><span class="eur">€</span></span></li>';
      }
      lista.innerHTML = html;
      out.textContent = n;
      menos.disabled = n <= 2; mas.disabled = n >= GENTE.length;
      titulo.textContent = !c ? "Escribe un importe" : resto === 0 ? "Sale exacto: " + texto(base) + " cada uno"
        : resto === 1 ? "Sobra un céntimo, y se lo lleva alguien" : "Sobran " + NUM[resto] + " céntimos: uno para cada uno de los primeros";
      suma.textContent = texto(total);
      cuadra.textContent = c && total === c ? "Cuadra con el total" : "";
    }
    inp.addEventListener("input", calcular);
    inp.addEventListener("blur", function () { var c = leer(); inp.value = texto(c).replace(" €", ""); calcular(); });
    menos.addEventListener("click", function () { if (n > 2) { n--; calcular(); } });
    mas.addEventListener("click", function () { if (n < GENTE.length) { n++; calcular(); } });
    calcular();
  })();

  // ---------- Privacidad: frases con interruptor ----------
  document.querySelectorAll(".banda").forEach(function (banda) {
    var sw = banda.querySelector(".switch");
    function cambiar() {
      var on = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", on ? "true" : "false");
      banda.classList.toggle("on", on);
    }
    sw.addEventListener("click", function (ev) { ev.stopPropagation(); cambiar(); });
    banda.addEventListener("click", function (ev) { if (!ev.target.closest("a")) cambiar(); });
  });

  // ---------- Franja: velocidad constante sea cual sea el ancho ----------
  var pista = document.querySelector(".franja-pista");
  if (pista) pista.style.setProperty("--dur", Math.max(20, pista.scrollWidth / 2 / 70) + "s");
})();
