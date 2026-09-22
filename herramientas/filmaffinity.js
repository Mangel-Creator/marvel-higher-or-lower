// Extrae nota media y número de votos de FilmAffinity para cada título del
// catálogo. Busca por título en español, elige el resultado que cuadra por año
// y por tipo (película / serie), y lee los microdatos de la ficha.
//
//   node herramientas/filmaffinity.js           -> escribe datos/filmaffinity.json
//   node herramientas/filmaffinity.js "Loki"    -> lista candidatos, sin escribir
//
// Va despacio a propósito: una petición cada 1,2 s. No hay prisa y el servidor
// no es nuestro.

const fs = require('fs');
const path = require('path');
const titulos = require('./titulos.js');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PAUSA = 2500;          // entre peticiones
const PAUSA_429 = 300000;    // cuando nos dicen que paremos, paramos de verdad
const SALIDA = path.join(__dirname, '..', 'datos', 'filmaffinity.json');
// La caché vive fuera del proyecto: es desechable y no tiene por qué acabar
// subida a Netlify ni en el repositorio.
const CACHE = path.join(require('os').tmpdir(), 'marvel-mas-o-menos-cache');

const espera = ms => new Promise(r => setTimeout(r, ms));

// Cloudflare le da un reto al cliente HTTP de Node (huella TLS), pero deja pasar
// a curl sin rechistar. Así que tiramos de curl, que además ya está en el equipo.
const { execFile } = require('child_process');

// Nunca rechaza: si curl sale con error (TLS cortado, conexión rechazada, lo
// que Cloudflare tenga a bien hacer), se devuelve como código 0 y quien llama
// decide si espera y reintenta. Antes esto tumbaba el resto de la ejecución.
function curl(url) {
  return new Promise(resolve => {
    execFile('curl', [
      '-s', '-L', '--compressed', '--max-time', '30',
      '-w', '\n__CODIGO__%{http_code}',
      '-A', UA,
      '-H', 'Accept-Language: es-ES,es;q=0.9',
      '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      url
    ], { maxBuffer: 20 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
      if (err) return resolve({ codigo: 0, cuerpo: '', salida: err.code });
      const corte = stdout.lastIndexOf('\n__CODIGO__');
      const codigo = Number(stdout.slice(corte + 11).trim());
      resolve({ codigo, cuerpo: stdout.slice(0, corte) });
    });
  });
}

// Caché en disco: si hay que relanzar el script (y siempre hay que relanzarlo),
// no se vuelve a molestar al servidor por lo que ya se descargó una vez.
const crypto = require('crypto');
const nombreCache = url => path.join(CACHE, crypto.createHash('md5').update(url).digest('hex') + '.html');

async function pedir(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const guardado = nombreCache(url);
  if (fs.existsSync(guardado)) return { html: fs.readFileSync(guardado, 'utf8'), deCache: true };

  for (let intento = 1; intento <= 12; intento++) {
    const { codigo, cuerpo, salida } = await curl(url);

    if (codigo === 0 || codigo === 429 || codigo === 403) {
      const motivo = codigo === 0 ? `curl salió con ${salida}` : codigo;
      console.log(`      ${motivo}: esperando ${PAUSA_429 / 1000}s antes de reintentar (${intento}/12)…`);
      await espera(PAUSA_429);
      continue;
    }
    if (codigo >= 500) { await espera(5000 * intento); continue; }
    if (codigo >= 400) return { html: null, deCache: false };

    fs.writeFileSync(guardado, cuerpo, 'utf8');
    return { html: cuerpo, deCache: false };
  }
  throw new Error('el servidor no deja pasar');
}

const limpia = s => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// Parecido por palabras compartidas, penalizando las que sobran a cada lado.
function parecido(a, b) {
  const pa = limpia(a).split(' ').filter(Boolean);
  const pb = limpia(b).split(' ').filter(Boolean);
  if (!pa.length || !pb.length) return 0;
  const comunes = pa.filter(p => pb.includes(p)).length;
  return (2 * comunes) / (pa.length + pb.length);
}

function candidatos(html) {
  return html.split('class="se-it').slice(1).map(bloque => {
    const anio = (bloque.match(/ye-w">\s*(\d{4})/) || [])[1];
    const id = (bloque.match(/\/film(\d+)\.html/) || [])[1];
    const mc = bloque.indexOf('mc-title');
    const titulo = mc === -1
      ? null
      : (bloque.slice(mc).match(/<a[^>]*>([^<]+)<\/a>/) || [])[1];
    const alt = (bloque.match(/alt="([^"]*)"/) || [])[1] || '';
    return {
      id,
      anio: anio ? Number(anio) : null,
      titulo: titulo ? titulo.trim() : null,
      serie: /serie de tv|miniserie/i.test(alt),
      corto: /\(C\)\s*$/.test(alt)
    };
  }).filter(c => c.id && c.titulo);
}

function elige(lista, objetivo) {
  const puntuados = lista.map(c => {
    let p = parecido(c.titulo, objetivo.es) * 100;
    const dif = c.anio === null ? 9 : Math.abs(c.anio - objetivo.anio);
    if (dif === 0) p += 45;
    else if (dif === 1) p += 25;
    else if (dif <= 3) p += 5;
    else p -= 30;                                   // año muy lejos: casi seguro que no es
    if (objetivo.tipo === 'serie' && c.serie) p += 30;
    if (objetivo.tipo === 'serie' && !c.serie) p -= 35;
    if (objetivo.tipo === 'pelicula' && c.serie) p -= 45;
    if (c.corto) p -= 40;                           // cortos y "así se hizo" fuera
    if (/asi se hizo|making of|documental/.test(limpia(c.titulo))) p -= 60;
    return { ...c, p: Math.round(p) };
  }).sort((a, b) => b.p - a.p);
  return puntuados;
}

function extrae(html) {
  const nota = (html.match(/itemprop="ratingValue"\s+content="([\d.]+)"/) || [])[1];
  const votos = (html.match(/itemprop="ratingCount"\s+content="(\d+)"/) || [])[1];
  const poster = (html.match(/https:\/\/pics\.filmaffinity\.com\/[a-z0-9_\-]+-large\.jpg/i) || [])[0];
  const original = (html.match(/Título original<\/dt>\s*<dd[^>]*>([^<]+)/) || [])[1];
  return {
    nota: nota ? Number(nota) : null,
    votos: votos ? Number(votos) : null,
    poster: poster || null,
    original: original ? original.trim() : null
  };
}

async function ficha(id) {
  const { html, deCache } = await pedir(`https://www.filmaffinity.com/es/film${id}.html`);
  if (!deCache) await espera(PAUSA);
  return html ? extrae(html) : null;
}

async function main() {
  const soloUno = process.argv[2];

  if (soloUno) {
    const { html } = await pedir(
      'https://www.filmaffinity.com/es/search.php?stext=' + encodeURIComponent(soloUno));
    console.log(candidatos(html).slice(0, 10));
    return;
  }

  const resultados = [];
  const fallos = [];

  // Se guarda después de cada título. Con esperas de cinco minutos por bloqueo,
  // una ejecución puede durar una hora: no tiene sentido perderlo todo si se
  // corta por el medio.
  const guarda = () => fs.writeFileSync(SALIDA, JSON.stringify({
    extraido: new Date().toISOString().slice(0, 10),
    fuente: 'https://www.filmaffinity.com',
    completo: resultados.length + fallos.length === titulos.length,
    titulos: resultados,
    fallos
  }, null, 2), 'utf8');

  for (let i = 0; i < titulos.length; i++) {
    const t = titulos[i];
    const etiqueta = `${String(i + 1).padStart(3)}/${titulos.length}  ${t.es} (${t.anio})`;
    try {
      const { html, deCache } = await pedir(
        'https://www.filmaffinity.com/es/search.php?stext=' + encodeURIComponent(t.es));
      if (!deCache) await espera(PAUSA);
      if (!html) {
        fallos.push({ ...t, motivo: 'la búsqueda devolvió error' });
        console.log(etiqueta + '  ✗ la búsqueda devolvió error');
        continue;
      }

      // Si la búsqueda tiene un único resultado, FilmAffinity redirige a la ficha.
      let lista = candidatos(html);
      let elegido = null;
      if (!lista.length) {
        // Con un único resultado, FilmAffinity redirige directamente a la ficha.
        // El og:url dice cuál es, y la página ya trae la nota: no hay que pedirla.
        const directo = (html.match(/og:url"\s+content="[^"]*\/film(\d+)\.html/) || [])[1];
        if (directo) {
          const cab = html.match(/<title>(.*?)\s*\((\d{4})\)\s*-\s*Filmaffinity/);
          elegido = {
            id: directo,
            titulo: cab ? cab[1].trim() : t.es,
            anio: cab ? Number(cab[2]) : t.anio,
            p: 100,
            htmlFicha: html
          };
        }
      } else {
        const orden = elige(lista, t);
        if (orden[0] && orden[0].p >= 45) elegido = orden[0];
        else {
          fallos.push({ ...t, motivo: 'sin candidato claro', mejor: orden.slice(0, 3) });
          console.log(etiqueta + '  ✗ sin candidato claro');
          continue;
        }
      }

      if (!elegido) {
        fallos.push({ ...t, motivo: 'la búsqueda no devolvió nada' });
        console.log(etiqueta + '  ✗ la búsqueda no devolvió nada');
        continue;
      }

      const f = elegido.htmlFicha ? extrae(elegido.htmlFicha) : await ficha(elegido.id);
      if (!f || f.nota === null) {
        fallos.push({ ...t, motivo: 'ficha sin nota', id: elegido.id });
        console.log(etiqueta + '  ✗ ficha sin nota (film' + elegido.id + ')');
        continue;
      }

      resultados.push({
        es: t.es, orig: t.orig, anio: t.anio, tipo: t.tipo, universo: t.universo,
        faId: elegido.id, faTitulo: elegido.titulo, faAnio: elegido.anio,
        nota: f.nota, votos: f.votos, faPoster: f.poster, confianza: elegido.p
      });
      console.log(`${etiqueta}  ✓ ${f.nota}  (${f.votos} votos)  -> ${elegido.titulo} ${elegido.anio || ''} [${elegido.p}]`);
    } catch (e) {
      fallos.push({ ...t, motivo: e.message });
      console.log(etiqueta + '  ✗ ' + e.message);
    } finally {
      guarda();   // el `continue` de dentro del try también pasa por aquí
    }
  }

  guarda();
  console.log(`\nResueltos ${resultados.length} de ${titulos.length}. Fallos: ${fallos.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
