// Generador mínimo de códigos QR (modo byte, corrección M, versiones 1–10), sin dependencias.
// Sigue el algoritmo de referencia de Project Nayuki (MIT). Devuelve un <svg> como texto.
(function () {
  "use strict";

  // Tablas para el nivel de corrección M, por versión (el índice 0 no se usa).
  var ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var BITS_FORMATO_M = 0;

  function modulosDeDatos(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }

  function palabrasDeDatos(ver) {
    return Math.floor(modulosDeDatos(ver) / 8) - ECC_POR_BLOQUE[ver] * BLOQUES[ver];
  }

  function multiplicar(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function divisor(grado) {
    var r = [];
    for (var i = 0; i < grado - 1; i++) r.push(0);
    r.push(1);
    var raiz = 1;
    for (i = 0; i < grado; i++) {
      for (var j = 0; j < r.length; j++) {
        r[j] = multiplicar(r[j], raiz);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      raiz = multiplicar(raiz, 0x02);
    }
    return r;
  }

  function resto(datos, div) {
    var r = div.map(function () { return 0; });
    datos.forEach(function (b) {
      var f = b ^ r.shift();
      r.push(0);
      div.forEach(function (c, i) { r[i] ^= multiplicar(c, f); });
    });
    return r;
  }

  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function generar(texto) {
    var bytes = Array.from(new TextEncoder().encode(texto));
    var ver = 1;
    for (; ver <= 10; ver++) {
      var cc = ver < 10 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= palabrasDeDatos(ver) * 8) break;
    }
    if (ver > 10) throw new Error("Texto demasiado largo para el QR");

    // Bits de datos: modo byte, longitud, contenido, terminador y relleno.
    var bits = [];
    function poner(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    poner(4, 4);
    poner(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { poner(b, 8); });
    var capacidad = palabrasDeDatos(ver) * 8;
    poner(0, Math.min(4, capacidad - bits.length));
    poner(0, (8 - bits.length % 8) % 8);
    for (var p = 0xec; bits.length < capacidad; p ^= 0xec ^ 0x11) poner(p, 8);
    var datos = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      datos.push(v);
    }

    // Bloques con su corrección de errores, entrelazados.
    var nBloques = BLOQUES[ver], eccLen = ECC_POR_BLOQUE[ver];
    var brutas = Math.floor(modulosDeDatos(ver) / 8);
    var cortos = nBloques - brutas % nBloques;
    var largoCorto = Math.floor(brutas / nBloques);
    var div = divisor(eccLen), bloques = [], pos = 0;
    for (i = 0; i < nBloques; i++) {
      var dat = datos.slice(pos, pos + largoCorto - eccLen + (i < cortos ? 0 : 1));
      pos += dat.length;
      var ecc = resto(dat, div);
      if (i < cortos) dat.push(0);
      bloques.push(dat.concat(ecc));
    }
    var palabras = [];
    for (i = 0; i < bloques[0].length; i++) {
      bloques.forEach(function (b, j) {
        if (i !== largoCorto - eccLen || j >= cortos) palabras.push(b[i]);
      });
    }

    // Matriz y patrones fijos.
    var n = ver * 4 + 17;
    var m = [], fijo = [];
    for (i = 0; i < n; i++) { m.push(new Array(n).fill(false)); fijo.push(new Array(n).fill(false)); }
    function fijar(x, y, oscuro) { m[y][x] = oscuro; fijo[y][x] = true; }

    for (i = 0; i < n; i++) { fijar(6, i, i % 2 === 0); fijar(i, 6, i % 2 === 0); }
    [[3, 3], [n - 4, 3], [3, n - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < n && yy >= 0 && yy < n) fijar(xx, yy, d !== 2 && d !== 4);
      }
    });
    if (ver > 1) {
      var nAl = Math.floor(ver / 7) + 2;
      var paso = Math.ceil((ver * 4 + 4) / (nAl * 2 - 2)) * 2;
      var al = [6];
      for (var q = n - 7; al.length < nAl; q -= paso) al.splice(1, 0, q);
      for (i = 0; i < nAl; i++) for (var j = 0; j < nAl; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === nAl - 1) || (i === nAl - 1 && j === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) for (var ax = -2; ax <= 2; ax++)
          fijar(al[i] + ax, al[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
      }
    }
    function formato(mascara) {
      var d = (BITS_FORMATO_M << 3) | mascara, r = d;
      for (var t = 0; t < 10; t++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      var b = ((d << 10) | r) ^ 0x5412;
      for (t = 0; t <= 5; t++) fijar(8, t, bit(b, t));
      fijar(8, 7, bit(b, 6)); fijar(8, 8, bit(b, 7)); fijar(7, 8, bit(b, 8));
      for (t = 9; t < 15; t++) fijar(14 - t, 8, bit(b, t));
      for (t = 0; t < 8; t++) fijar(n - 1 - t, 8, bit(b, t));
      for (t = 8; t < 15; t++) fijar(8, n - 15 + t, bit(b, t));
      fijar(8, n - 8, true);
    }
    formato(0);
    if (ver >= 7) {
      var rv = ver;
      for (i = 0; i < 12; i++) rv = (rv << 1) ^ ((rv >>> 11) * 0x1f25);
      var bv = (ver << 12) | rv;
      for (i = 0; i < 18; i++) {
        var a = n - 11 + i % 3, b = Math.floor(i / 3), o = bit(bv, i);
        fijar(a, b, o); fijar(b, a, o);
      }
    }

    // Palabras en zigzag.
    var idx = 0;
    for (var der = n - 1; der >= 1; der -= 2) {
      if (der === 6) der = 5;
      for (var vert = 0; vert < n; vert++) for (j = 0; j < 2; j++) {
        var x = der - j, sube = ((der + 1) & 2) === 0, y = sube ? n - 1 - vert : vert;
        if (!fijo[y][x] && idx < palabras.length * 8) {
          m[y][x] = bit(palabras[idx >>> 3], 7 - (idx & 7));
          idx++;
        }
      }
    }

    function mascarar(k) {
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var inv;
        switch (k) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: inv = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + (x * y) % 3) % 2 === 0;
        }
        if (!fijo[y][x] && inv) m[y][x] = !m[y][x];
      }
    }

    function penalizacion() {
      var pen = 0, oscuros = 0;
      var patron = [true, false, true, true, true, false, true];
      function linea(get) {
        var run = 1;
        for (var i = 0; i < n; i++) {
          if (i > 0 && get(i) === get(i - 1)) { run++; } else { if (run >= 5) pen += run - 2; run = 1; }
          // Patrón parecido al de los cuadros de posición, con cuatro claros a un lado.
          if (i + 7 <= n) {
            var ok = true;
            for (var k = 0; k < 7 && ok; k++) ok = get(i + k) === patron[k];
            if (ok) {
              var antes = true, despues = true;
              for (k = 1; k <= 4; k++) {
                if (i - k >= 0 && get(i - k)) antes = false;
                if (i + 6 + k < n && get(i + 6 + k)) despues = false;
              }
              if (antes || despues) pen += 40;
            }
          }
        }
        if (run >= 5) pen += run - 2;
      }
      for (var y = 0; y < n; y++) linea(function (i) { return m[y][i]; });
      for (var x = 0; x < n; x++) linea(function (i) { return m[i][x]; });
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) {
        var c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) pen += 3;
      }
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y][x]) oscuros++;
      var total = n * n;
      pen += (Math.ceil(Math.abs(oscuros * 20 - total * 10) / total) - 1) * 10;
      return pen;
    }

    var mejor = 0, minPen = Infinity;
    for (k = 0; k < 8; k++) {
      mascarar(k); formato(k);
      var pe = penalizacion();
      if (pe < minPen) { minPen = pe; mejor = k; }
      mascarar(k);
    }
    mascarar(mejor); formato(mejor);
    return m;
  }

  /** SVG del QR con 4 módulos de margen; los colores salen de currentColor y del fondo. */
  window.qrSvg = function (texto, etiqueta) {
    var m = generar(texto), n = m.length, borde = 4, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + (x + borde) + "," + (y + borde) + "h1v1h-1z";
    var t = n + borde * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" role="img" aria-label="' +
      (etiqueta || "Código QR") + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  };
})();
