// Completa el catálogo con lo que FilmAffinity no tiene: póster y recaudación
// mundial. Lee la clave de la variable de entorno TMDB_API_KEY — nunca de un
// archivo del proyecto.
//
//   node herramientas/tmdb.js
//
// Escribe datos/tmdb.json y los pósters en img/*.webp.

const fs = require('fs');
const path = require('path');
const titulos = require('./titulos.js');

const CLAVE = process.env.TMDB_API_KEY;
if (!CLAVE) {
  console.error('Falta TMDB_API_KEY en el entorno. En PowerShell:\n' +
    "  [Environment]::SetEnvironmentVariable('TMDB_API_KEY','...','User')\n" +
    'y abre una ventana nueva para que la vea.');
  process.exit(1);
}

const RAIZ = path.join(__dirname, '..');
const DIR_IMG = path.join(RAIZ, 'img');
const SALIDA = path.join(RAIZ, 'datos', 'tmdb.json');
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w780';

let sharp = null;
try { sharp = require('sharp'); } catch { /* sin sharp se guarda el jpg tal cual */ }

const espera = ms => new Promise(r => setTimeout(r, ms));

// TMDB da dos credenciales: la clave v3 (32 caracteres, va en la URL) y el
// token de lectura v4 (un JWT, va en la cabecera). Aceptamos cualquiera de las
// dos para no obligar a nadie a distinguirlas.
const ES_TOKEN_V4 = CLAVE.split('.').length === 3;

async function api(ruta, params = {}) {
  const url = new URL(BASE + ruta);
  if (!ES_TOKEN_V4) url.searchParams.set('api_key', CLAVE);
  // En inglés: la web enseña los títulos originales, así que los pósters tienen
  // que ser los originales también. Un cartel en español bajo un título inglés
  // se nota aunque vaya desenfocado.
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cabeceras = ES_TOKEN_V4 ? { Authorization: 'Bearer ' + CLAVE } : {};

  for (let i = 1; i <= 3; i++) {
    const r = await fetch(url, { headers: cabeceras });
    if (r.status === 429) { await espera(2500 * i); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}

const babel = s => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function mejor(resultados, objetivo, campoFecha) {
  if (!resultados || !resultados.length) return null;
  return resultados
    .map(r => {
      const anio = Number((r[campoFecha] || '').slice(0, 4));
      const dif = anio ? Math.abs(anio - objetivo.anio) : 9;
      let p = r.popularity || 0;
      if (dif === 0) p += 500;
      else if (dif === 1) p += 250;
      else if (dif > 3) p -= 400;
      return { r, p };
    })
    .sort((a, b) => b.p - a.p)[0].r;
}

async function poster(rutaPoster, nombre) {
  if (!rutaPoster) return null;
  const destino = path.join(DIR_IMG, nombre + (sharp ? '.webp' : '.jpg'));
  if (fs.existsSync(destino)) return 'img/' + path.basename(destino);

  const r = await fetch(IMG + rutaPoster);
  if (!r.ok) return null;
  const bytes = Buffer.from(await r.arrayBuffer());

  // El póster se usa como fondo desenfocado y apagado. Se deja así ya guardado
  // en vez de pedírselo al navegador: se ahorra el filtro en tiempo real y,
  // como el desenfoque quita detalle, el archivo baja de ~125 KB a ~25 KB.
  if (sharp) {
    await sharp(bytes)
      .blur(11)
      .modulate({ brightness: 0.84, saturation: 0.95 })
      .webp({ quality: 70 })
      .toFile(destino);
  } else {
    fs.writeFileSync(destino, bytes);
  }

  return 'img/' + path.basename(destino);
}

async function main() {
  fs.mkdirSync(DIR_IMG, { recursive: true });
  if (!sharp) console.log('Aviso: sharp no está instalado, los pósters se guardan en JPG.\n');

  const salida = [];
  const fallos = [];

  for (let i = 0; i < titulos.length; i++) {
    const t = titulos[i];
    const etiqueta = `${String(i + 1).padStart(3)}/${titulos.length}  ${t.es}`;
    const serie = t.tipo === 'serie';

    const busca = await api(serie ? '/search/tv' : '/search/movie', {
      query: t.orig,
      ...(serie ? { first_air_date_year: t.anio } : { primary_release_year: t.anio })
    });

    let elegido = mejor(busca && busca.results, t, serie ? 'first_air_date' : 'release_date');

    // Si el filtro por año no da nada, se busca sin él y se elige por cercanía.
    if (!elegido) {
      const libre = await api(serie ? '/search/tv' : '/search/movie', { query: t.orig });
      elegido = mejor(libre && libre.results, t, serie ? 'first_air_date' : 'release_date');
    }

    if (!elegido) {
      fallos.push({ ...t, motivo: 'sin resultado en TMDB' });
      console.log(etiqueta + '  ✗ sin resultado');
      continue;
    }

    // La nota sale de la ficha completa cuando la hay (más fiable que la del
    // listado de búsqueda), y si no, del propio resultado de la búsqueda.
    let taquilla = null;
    let nota = elegido.vote_average;
    let votos = elegido.vote_count;

    if (!serie) {
      const ficha = await api('/movie/' + elegido.id);
      if (ficha) {
        taquilla = ficha.revenue || null;
        if (typeof ficha.vote_average === 'number') nota = ficha.vote_average;
        if (typeof ficha.vote_count === 'number') votos = ficha.vote_count;
      }
    }

    const archivo = await poster(elegido.poster_path, babel(t.es) + '-' + t.anio);

    salida.push({
      es: t.es, anio: t.anio, tipo: t.tipo,
      tmdbId: elegido.id,
      tmdbTitulo: elegido.title || elegido.name,
      tmdbAnio: Number((elegido.release_date || elegido.first_air_date || '').slice(0, 4)) || null,
      nota: typeof nota === 'number' && nota > 0 ? Math.round(nota * 10) / 10 : null,
      votos: votos || null,
      taquilla,
      poster: archivo
    });

    console.log(`${etiqueta}  ✓ ${elegido.title || elegido.name}` +
      `  nota ${nota ? nota.toFixed(1) : '—'}` +
      (taquilla ? `  ${Math.round(taquilla / 1e6)} M$` : '') +
      (archivo ? '  [póster]' : '  [sin póster]'));

    await espera(140);
  }

  fs.writeFileSync(SALIDA, JSON.stringify({
    extraido: new Date().toISOString().slice(0, 10),
    fuente: 'https://www.themoviedb.org',
    titulos: salida,
    fallos
  }, null, 2), 'utf8');

  console.log(`\nResueltos ${salida.length} de ${titulos.length}. Fallos: ${fallos.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
