// Junta todo en el único archivo que lee la web.
//
//   node herramientas/montar.js
//
// La base es TMDB, que trae nota, votos, taquilla y póster de los 105 títulos.
// FilmAffinity era la fuente original de las notas, pero bloquea la extracción
// cada pocas decenas de peticiones y se quedaba a medias; sus notas se siguen
// guardando como referencia en `notaFa`, sin usarlas en el juego.
//
// Regla que no se salta: todas las notas del juego salen de la MISMA fuente.
// Con 57 de FilmAffinity y 48 de TMDB, las comparaciones serían mentira.

const fs = require('fs');
const path = require('path');
const titulos = require('./titulos.js');

const RAIZ = path.join(__dirname, '..');
const lee = f => {
  const ruta = path.join(RAIZ, 'datos', f);
  return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : null;
};

const tmdb = lee('tmdb.json');
if (!tmdb) {
  console.error('Falta datos/tmdb.json. Ejecuta antes herramientas/tmdb.js');
  process.exit(1);
}
const fa = lee('filmaffinity.json');

const llave = t => `${t.es}::${t.anio}`;
const catalogo = new Map(titulos.map(t => [llave(t), t]));
const porFa = new Map((fa ? fa.titulos : []).map(t => [llave(t), t]));

const lista = tmdb.titulos
  .filter(t => typeof t.nota === 'number' && t.nota > 0)
  .map(t => {
    const base = catalogo.get(llave(t)) || {};
    const ref = porFa.get(llave(t));
    return {
      titulo: base.orig || t.tmdbTitulo || t.es,
      es: t.es,
      anio: t.anio,
      tipo: t.tipo,
      universo: base.universo || 'Marvel',
      nota: t.nota,
      votos: t.votos ?? null,
      taquilla: t.taquilla ?? null,
      poster: t.poster ?? null,
      notaFa: ref ? ref.nota : null
    };
  })
  .sort((a, b) => a.anio - b.anio || a.titulo.localeCompare(b.titulo, 'es'));

fs.writeFileSync(path.join(RAIZ, 'datos', 'peliculas.json'), JSON.stringify({
  extraido: tmdb.extraido,
  fuentes: { nota: 'TMDB', taquilla: 'TMDB', poster: 'TMDB' },
  titulos: lista
}, null, 2), 'utf8');

const notas = lista.map(t => t.nota);
const conTaquilla = lista.filter(t => t.taquilla > 0).length;
const sinPoster = lista.filter(t => !t.poster);

console.log('datos/peliculas.json escrito.');
console.log(`  ${lista.length} títulos  (${lista.filter(t => t.tipo === 'serie').length} series)`);
console.log(`  nota: todos · taquilla: ${conTaquilla} · póster: ${lista.length - sinPoster.length}`);
console.log(`  rango de notas: ${Math.min(...notas)} — ${Math.max(...notas)}`);
if (sinPoster.length) {
  console.log(`\n  Sin póster (${sinPoster.length}):`);
  sinPoster.forEach(t => console.log(`    · ${t.titulo} (${t.anio})`));
}

const descartados = tmdb.titulos.length - lista.length;
if (descartados) console.log(`\n  Descartados por no tener nota en TMDB: ${descartados}`);
