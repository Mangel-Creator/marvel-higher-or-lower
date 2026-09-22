// Genera img/comparte.jpg, la imagen que sale cuando alguien pega el enlace en
// WhatsApp o en Twitter. 1200×630, que es lo que esperan todos.
//
//   node herramientas/comparte.js
//
// Se monta con seis pósters ya desenfocados (los mismos que usa la web) en
// diagonal, un velo oscuro encima y el título. Hay que haber pasado antes
// herramientas/tmdb.js para que exista img/.

const fs = require('fs');
const path = require('path');

let sharp;
try { sharp = require('sharp'); } catch {
  console.error('Hace falta sharp. Ejecuta con NODE_PATH apuntando a donde esté instalado.');
  process.exit(1);
}

const RAIZ = path.join(__dirname, '..');
const DIR_IMG = path.join(RAIZ, 'img');
const ANCHO = 1200, ALTO = 630;

// Seis películas reconocibles y de distintas épocas, para que la imagen cuente
// de qué va el juego de un vistazo.
const ELEGIDAS = [
  'iron-man-2008', 'x-men-2000', 'spider-man-2002',
  'vengadores-endgame-2019', 'logan-2017', 'deadpool-2016'
];

async function main() {
  const disponibles = ELEGIDAS
    .map(n => path.join(DIR_IMG, n + '.webp'))
    .filter(f => fs.existsSync(f));

  if (!disponibles.length) {
    console.error('No hay pósters en img/. Pasa antes herramientas/tmdb.js.');
    process.exit(1);
  }

  const cuantos = disponibles.length;
  const anchoTira = Math.ceil(ANCHO / cuantos) + 40;

  const tiras = await Promise.all(disponibles.map(async (f, i) => ({
    input: await sharp(f).resize(anchoTira, ALTO, { fit: 'cover' }).toBuffer(),
    left: i * Math.floor(ANCHO / cuantos) - 20,
    top: 0
  })));

  const velo = Buffer.from(`<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#0e0e10" stop-opacity=".72"/>
        <stop offset="55%"  stop-color="#0e0e10" stop-opacity=".88"/>
        <stop offset="100%" stop-color="#0e0e10" stop-opacity=".97"/>
      </linearGradient>
    </defs>
    <rect width="${ANCHO}" height="${ALTO}" fill="url(#v)"/>
  </svg>`);

  const texto = Buffer.from(`<svg width="${ANCHO}" height="${ALTO}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .marca { font-family: 'Arial Black', 'Arial Bold', Arial, sans-serif; font-weight: 900; }
      .pie   { font-family: Arial, sans-serif; font-weight: 400; }
    </style>
    <text class="marca" x="80" y="268" font-size="122" fill="#d6291f" letter-spacing="-4">MARVEL</text>
    <text class="marca" x="80" y="372" font-size="86"  fill="#f3ece0" letter-spacing="-2">HIGHER OR LOWER</text>
    <text class="pie"   x="84" y="446" font-size="32"  fill="#b9aea3">¿Qué película está mejor valorada en FilmAffinity?</text>
  </svg>`);

  await sharp({ create: { width: ANCHO, height: ALTO, channels: 3, background: '#0e0e10' } })
    .composite([...tiras, { input: velo }, { input: texto }])
    .jpeg({ quality: 82 })
    .toFile(path.join(DIR_IMG, 'comparte.jpg'));

  const kb = Math.round(fs.statSync(path.join(DIR_IMG, 'comparte.jpg')).size / 1024);
  console.log(`img/comparte.jpg escrita con ${cuantos} pósters, ${kb} KB`);
}

main().catch(e => { console.error(e); process.exit(1); });
