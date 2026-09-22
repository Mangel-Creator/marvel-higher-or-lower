/* ═══════════════════════════════════════════════════════════════════════
   Marvel Higher or Lower
   Carril de tres paneles que avanza uno por acierto. Sin dependencias.
   ═══════════════════════════════════════════════════════════════════════ */

(() => {
'use strict';

const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MODOS = {
  nota: {
    nombre: 'Nota de FilmAffinity',
    campo: 'nota',
    unidad: 'nota media en FilmAffinity',
    pregunta: t => `¿tiene más o menos nota que <em>${t}</em>?`,
    formato: v => v.toFixed(1).replace('.', ','),
    sirve: t => typeof t.nota === 'number'
  },
  taquilla: {
    nombre: 'Taquilla mundial',
    campo: 'taquilla',
    unidad: 'de recaudación mundial',
    pregunta: t => `¿recaudó más o menos que <em>${t}</em>?`,
    formato: v => v >= 1e6
      ? Math.round(v / 1e6).toLocaleString('es-ES') + ' M$'
      : Math.max(0, Math.round(v / 1e5) / 10).toLocaleString('es-ES') + ' M$',
    sirve: t => t.tipo === 'pelicula' && typeof t.taquilla === 'number' && t.taquilla > 0
  }
};

// Fondo de reserva cuando una ficha no tiene póster: cada estudio, su tono.
// Son casi negros; solo sirven para que dos paneles sin imagen no sean idénticos.
const TONOS = {
  'UCM':      'oklch(.26 .055 28)',
  'Fox':      'oklch(.25 .045 252)',
  'Sony':     'oklch(.25 .045 305)',
  'Clásicos': 'oklch(.24 .030 62)',
  'Netflix':  'oklch(.24 .050 12)',
  'Disney+':  'oklch(.25 .045 268)',
  'TV':       'oklch(.24 .030 160)'
};

const FLECHAS = {
  mas:   '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menos: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const SELLOS = {
  bien: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 24.5l7 7 13-14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mal:  '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 16l16 16M32 16L16 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'
};

// En pantalla mandan los títulos en inglés; el español se queda como respaldo
// por si algún título no lo trae.
const nombre = t => t.titulo || t.es;

const $ = s => document.querySelector(s);

const el = {
  portada:   $('#portada'),
  aviso:     $('#portada-aviso'),
  fecha:     $('#fecha-datos'),
  jugar:     $('#jugar'),
  juego:     $('#juego'),
  carril:    $('#carril'),
  racha:     $('#racha'),
  barraModo: $('#barra-modo'),
  anuncio:   $('#anuncio'),
  salir:     $('#salir'),
  final:     $('#final'),
  finalRacha:    $('#final-racha'),
  finalUnidad:   $('#final-unidad'),
  finalDetalle:  $('#final-detalle'),
  finalRecord:   $('#final-record'),
  finalVeredicto:$('#final-veredicto'),
  reintentar:$('#reintentar'),
  copiar:    $('#copiar'),
  volver:    $('#volver')
};

let catalogo = [];
let modo = 'nota';
let baraja = [];
let ranura = [];        // los tres títulos en pantalla
let racha = 0;
let bloqueado = true;

/* ── Récords ─────────────────────────────────────────────────────────── */

const clave = m => 'marvel-higher-or-lower:record:' + m;

function leeRecord(m) {
  try { return Number(localStorage.getItem(clave(m))) || 0; } catch { return 0; }
}
function guardaRecord(m, valor) {
  try { localStorage.setItem(clave(m), String(valor)); } catch { /* modo privado */ }
}
function pintaRecords() {
  document.querySelectorAll('[data-record]').forEach(nodo => {
    const r = leeRecord(nodo.dataset.record);
    nodo.textContent = r ? `Tu récord: ${r}` : '';
  });
}

/* ── Baraja ──────────────────────────────────────────────────────────── */

function mezcla(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rellenaBaraja() {
  const sirve = MODOS[modo].sirve;
  baraja = mezcla(catalogo.filter(sirve));
}

function siguiente() {
  if (!baraja.length) rellenaBaraja();
  // Evita que salga algo que ya está en pantalla.
  let i = baraja.findIndex(t => !ranura.includes(t));
  if (i === -1) i = 0;
  return baraja.splice(i, 1)[0];
}

/* ── Paneles ─────────────────────────────────────────────────────────── */

function creaPanel(titulo, estado, referencia) {
  const cfg = MODOS[modo];
  const panel = document.createElement('article');
  panel.className = 'panel' + (titulo.poster ? '' : ' panel--sinposter');
  panel.dataset.estado = estado;
  panel.style.setProperty('--tono-estudio', TONOS[titulo.universo] || 'var(--superficie)');

  const anio = titulo.tipo === 'serie' ? `${titulo.anio} · serie` : titulo.anio;

  panel.innerHTML = `
    <div class="panel__fondo"${titulo.poster ? ` style="background-image:url('${titulo.poster}')"` : ''}></div>
    <div class="panel__velo"></div>
    <div class="panel__sello"></div>
    <div class="panel__cuerpo">
      <div class="panel__cabeza">
        <p class="panel__meta">${titulo.universo} · ${anio}</p>
        <h2 class="panel__titulo">${nombre(titulo)}</h2>
      </div>
      <div class="panel__dato">
        <p class="dato__cifra">${estado === 'revelado' ? cfg.formato(titulo[cfg.campo]) : ''}</p>
        <p class="dato__pie">${cfg.unidad}</p>
        <p class="dato__pregunta">${cfg.pregunta(referencia || '')}</p>
        <div class="opciones">
          <button class="opcion" data-op="mas">${FLECHAS.mas}<span>Higher</span></button>
          <button class="opcion" data-op="menos">${FLECHAS.menos}<span>Lower</span></button>
        </div>
      </div>
    </div>`;
  return panel;
}

const paneles = () => [...el.carril.children];

function pintaTablero() {
  el.carril.innerHTML = '';
  el.carril.append(
    creaPanel(ranura[0], 'revelado'),
    creaPanel(ranura[1], 'pregunta', nombre(ranura[0])),
    creaPanel(ranura[2], 'pregunta', nombre(ranura[1]))
  );
}

/* ── Contador ────────────────────────────────────────────────────────── */

function cuenta(nodo, destino) {
  const cfg = MODOS[modo];
  if (sinMovimiento) { nodo.textContent = cfg.formato(destino); return Promise.resolve(); }

  return new Promise(resolve => {
    const duracion = 700;
    const inicio = performance.now();
    let hecho = false;

    const remata = () => {
      if (hecho) return;
      hecho = true;
      nodo.textContent = cfg.formato(destino);
      resolve();
    };

    const paso = ahora => {
      if (hecho) return;
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - t, 3);
      nodo.textContent = cfg.formato(destino * suave);
      if (t < 1) requestAnimationFrame(paso);
      else remata();
    };

    requestAnimationFrame(paso);
    // Con la pestaña en segundo plano rAF no corre y la partida se quedaría
    // colgada esperando para siempre. El temporizador la desatasca.
    setTimeout(remata, duracion + 400);
  });
}

const pausa = ms => new Promise(r => setTimeout(r, sinMovimiento ? Math.min(ms, 120) : ms));

/* ── Turno ───────────────────────────────────────────────────────────── */

async function responde(op) {
  if (bloqueado) return;
  bloqueado = true;

  const cfg = MODOS[modo];
  const [izq, der] = paneles();
  const a = ranura[0][cfg.campo];
  const b = ranura[1][cfg.campo];
  const acierta = op === 'mas' ? b >= a : b <= a;

  der.dataset.estado = 'revelado';
  await cuenta(der.querySelector('.dato__cifra'), b);

  der.dataset.veredicto = acierta ? 'bien' : 'mal';
  der.querySelector('.panel__sello').innerHTML = SELLOS[acierta ? 'bien' : 'mal'];

  el.anuncio.textContent = acierta
    ? `Acierto. ${nombre(ranura[1])}: ${cfg.formato(b)}. Llevas ${racha + 1}.`
    : `Fallo. ${nombre(ranura[1])}: ${cfg.formato(b)}. Fin de la partida con ${racha}.`;

  if (!acierta) {
    el.juego.classList.add('juego--falla');
    await pausa(1100);
    el.juego.classList.remove('juego--falla');
    termina();
    return;
  }

  racha++;
  el.racha.textContent = racha;
  el.racha.classList.remove('barra__cifra--sube');
  void el.racha.offsetWidth;
  el.racha.classList.add('barra__cifra--sube');

  await pausa(780);
  await avanza();
  bloqueado = false;
}

function avanza() {
  return new Promise(resolve => {
    let hecho = false;
    const cierra = () => {
      if (hecho) return;
      hecho = true;
      el.carril.removeEventListener('transitionend', cierra);

      ranura.shift();
      ranura.push(siguiente());

      el.carril.firstElementChild.remove();
      el.carril.append(creaPanel(ranura[2], 'pregunta', nombre(ranura[1])));

      // Vuelta al origen sin transición: el carril queda como estaba pero
      // con los títulos corridos un hueco.
      el.carril.style.transition = 'none';
      el.carril.classList.remove('carril--anda');
      void el.carril.offsetWidth;
      el.carril.style.transition = '';

      // El panel que acaba de acertar pasa a ser la referencia: vuelve a su
      // color normal y se le quita el sello.
      const [izq, der] = paneles();
      delete izq.dataset.veredicto;
      izq.querySelector('.panel__sello').innerHTML = '';

      der.querySelector('.dato__pregunta').innerHTML = MODOS[modo].pregunta(nombre(ranura[0]));

      // El botón que se acaba de pulsar ya no existe; el foco se recoloca en el
      // siguiente. Con :focus-visible, a quien juega con ratón no le cambia nada.
      if (document.activeElement === document.body) der.querySelector('.opcion').focus();

      resolve();
    };

    if (sinMovimiento) { cierra(); return; }
    el.carril.addEventListener('transitionend', cierra, { once: true });
    el.carril.classList.add('carril--anda');
    setTimeout(cierra, 900);   // por si la transición no llega a avisar
  });
}

/* ── Partida ─────────────────────────────────────────────────────────── */

function empieza() {
  rellenaBaraja();
  ranura = [];
  ranura = [siguiente(), siguiente(), siguiente()];
  racha = 0;
  el.racha.textContent = '0';
  el.racha.classList.remove('barra__cifra--sube');
  el.barraModo.textContent = MODOS[modo].nombre;
  el.juego.dataset.modo = modo;   // la taquilla necesita cifras más pequeñas
  pintaTablero();
  el.portada.hidden = true;
  el.final.hidden = true;
  el.juego.hidden = false;
  bloqueado = false;
  // El foco estaba en un botón que acaba de ocultarse: se lleva a la decisión.
  const primera = paneles()[1].querySelector('.opcion');
  if (primera) primera.focus();
}

function termina() {
  const cfg = MODOS[modo];
  const record = leeRecord(modo);
  const nuevo = racha > record;
  if (nuevo) guardaRecord(modo, racha);

  el.finalVeredicto.textContent = nuevo && racha > 0 ? 'Récord nuevo' : 'Se acabó';
  el.finalRacha.textContent = racha;
  el.finalUnidad.textContent =
    racha === 0 ? 'aciertos. A la primera.' :
    racha === 1 ? 'acierto' : 'aciertos seguidos';
  el.finalDetalle.innerHTML = `Te ha pillado <strong>${nombre(ranura[1])}</strong>, con ` +
    `${cfg.formato(ranura[1][cfg.campo])} frente a ${cfg.formato(ranura[0][cfg.campo])} de ` +
    `<strong>${nombre(ranura[0])}</strong>.`;
  el.finalRecord.textContent = nuevo
    ? ''
    : record ? `Tu récord en este modo sigue siendo ${record}.` : '';

  el.final.hidden = false;
  el.reintentar.focus();
  pintaRecords();
}

function alPortada() {
  el.final.hidden = true;
  el.juego.hidden = true;
  el.portada.hidden = false;
  bloqueado = true;
  pintaRecords();
  el.jugar.focus();
}

/* ── Sucesos ─────────────────────────────────────────────────────────── */

el.carril.addEventListener('click', e => {
  const boton = e.target.closest('.opcion');
  if (!boton) return;
  if (boton.closest('.panel') !== paneles()[1]) return;
  responde(boton.dataset.op);
});

document.addEventListener('keydown', e => {
  if (!el.juego.hidden && el.final.hidden) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); responde('mas'); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); responde('menos'); }
  }
  if (e.key === 'Escape' && !el.juego.hidden) alPortada();
});

function revisaModo() {
  const cuantos = catalogo.filter(MODOS[modo].sirve).length;
  const listo = cuantos >= 4;
  el.jugar.disabled = !listo;
  el.aviso.textContent = listo
    ? `${cuantos} títulos en juego.`
    : modo === 'taquilla'
      ? 'Este modo todavía no tiene datos de taquilla. Juega al de notas.'
      : 'No hay títulos suficientes para jugar.';
}

document.querySelectorAll('.modo').forEach(boton => {
  boton.addEventListener('click', () => {
    modo = boton.dataset.modo;
    document.querySelectorAll('.modo').forEach(b =>
      b.setAttribute('aria-checked', String(b === boton)));
    revisaModo();
  });
});

el.jugar.addEventListener('click', empieza);
el.reintentar.addEventListener('click', empieza);
el.volver.addEventListener('click', alPortada);
el.salir.addEventListener('click', alPortada);

el.copiar.addEventListener('click', async () => {
  const texto = `Marvel Higher or Lower — ${racha} ${racha === 1 ? 'acierto' : 'aciertos seguidos'} ` +
    `en el modo «${MODOS[modo].nombre}». Me pilló ${nombre(ranura[1])}.`;
  try {
    await navigator.clipboard.writeText(texto);
    el.copiar.textContent = 'Copiado';
    setTimeout(() => { el.copiar.textContent = 'Copiar resultado'; }, 1800);
  } catch {
    el.copiar.textContent = 'No se pudo copiar';
  }
});

/* ── Arranque ────────────────────────────────────────────────────────── */

fetch('datos/peliculas.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(datos => {
    catalogo = datos.titulos;
    el.fecha.textContent = new Date(datos.extraido + 'T00:00:00')
      .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    el.fecha.dateTime = datos.extraido;
    pintaRecords();
    revisaModo();
  })
  .catch(() => {
    el.aviso.textContent = 'No se han podido cargar los datos. Recarga la página.';
    el.jugar.disabled = true;
  });

el.jugar.disabled = true;

})();
