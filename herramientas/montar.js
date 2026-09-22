// Junta lo de FilmAffinity y lo de TMDB en el único archivo que lee la web.
//
//   node herramientas/montar.js
//
// Si todavía no hay datos de TMDB, se monta igual: el modo nota funciona y el
// de taquilla queda sin títulos hasta que los haya. Nunca se rellena a ojo.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const lee = f => {
  const ruta = path.join(RAIZ, 'datos', f);
  return fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : null;
};

const fa = lee('filmaffinity.json');
if (!fa) { console.error('Falta datos/filmaffinity.json. Ejecuta antes herramientas/filmaffinity.js'); process.exit(1); }
const tmdb = lee('tmdb.json');

const llave = t => `${t.es}::${t.anio}`;
const porLlave = new Map((tmdb ? tmdb.titulos : []).map(t => [llave(t), t]));

const titulos = fa.titulos
  .filter(t => typeof t.nota === 'number')
  .map(t => {
    const extra = porLlave.get(llave(t)) || {};
    return {
      // `titulo` es lo que se ve en pantalla: el título original en inglés.
      // `es` se guarda porque es con el que se buscó en FilmAffinity y sirve
      // para rastrear de dónde salió cada dato.
      titulo: t.orig,
      es: t.es,
      anio: t.anio,
      tipo: t.tipo,
      universo: t.universo,
      nota: t.nota,
      votos: t.votos,
      taquilla: extra.taquilla ?? null,
      poster: extra.poster ?? null
    };
  })
  .sort((a, b) => a.anio - b.anio || a.es.localeCompare(b.es, 'es'));

const salida = {
  extraido: fa.extraido,
  fuentes: {
    nota: 'FilmAffinity',
    taquilla: tmdb ? 'TMDB' : null,
    poster: tmdb ? 'TMDB' : null
  },
  titulos
};

fs.writeFileSync(path.join(RAIZ, 'datos', 'peliculas.json'),
  JSON.stringify(salida, null, 2), 'utf8');

const conTaquilla = titulos.filter(t => t.taquilla > 0).length;
const conPoster = titulos.filter(t => t.poster).length;
const notas = titulos.map(t => t.nota);

console.log(`datos/peliculas.json escrito.`);
console.log(`  ${titulos.length} títulos  (${titulos.filter(t => t.tipo === 'serie').length} series)`);
console.log(`  nota: todos · taquilla: ${conTaquilla} · póster: ${conPoster}`);
console.log(`  rango de notas: ${Math.min(...notas)} — ${Math.max(...notas)}`);
if (fa.fallos && fa.fallos.length) {
  console.log(`\n  Sin resolver en FilmAffinity (${fa.fallos.length}):`);
  fa.fallos.forEach(f => console.log(`    · ${f.es} (${f.anio}) — ${f.motivo}`));
}
