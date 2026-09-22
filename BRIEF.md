# BRIEF — Marvel Higher or Lower

Juego web tipo *Higher or Lower* con el catálogo de cine y televisión de Marvel.
Documento de decisiones: sirve para retomar el proyecto sin repetir la entrevista.

## Qué es

Salen dos títulos a pantalla partida. Del de la izquierda se ve el dato; del de
la derecha hay que adivinar si tiene **más** o **menos**. Se acierta, el de la
derecha pasa a la izquierda y entra uno nuevo. Se falla, se acabó la partida.

**Público**: gente que ha visto muchas pelis de Marvel y cree saber cuáles están
mejor valoradas. Es un juego de sobremesa, no un producto.

## Modos

| Modo | Dato comparado | Catálogo |
|---|---|---|
| **Nota FilmAffinity** | Nota media sobre 10 | Películas + series |
| **Taquilla mundial** | Recaudación bruta mundial en dólares | Solo películas |

Las series no tienen taquilla, así que quedan fuera del segundo modo. El menú
de inicio lo dice.

## Idioma

**Interfaz en español, nombres en inglés.** El juego se llama *Marvel Higher or
Lower* y los botones son **HIGHER / LOWER**, porque así es como se conoce el
formato. Las películas salen con su **título original en inglés** (*Avengers:
Endgame*, no *Vengadores: Endgame*), y los pósters se descargan también en
inglés para que no choquen con el título. Todo lo demás —explicaciones, pie,
pantalla de fin— va en español, que es el idioma de quien va a jugar y el de
FilmAffinity, de donde salen las notas.

El título en español se guarda igualmente en los datos: es con el que se busca
en FilmAffinity y permite rastrear de dónde salió cada nota.

## Catálogo

Todo Marvel en pantalla, sin filtrar por calidad ni por estudio:

- **UCM** (Marvel Studios), de *Iron Man* (2008) en adelante.
- **Fox**: saga X-Men, *Los 4 Fantásticos* (2005, 2007, 2015), *Deadpool*, *Logan*.
- **Sony**: Spider-Man de Raimi y de Webb, *Venom*, *Morbius*, *Madame Web*, *Kraven*.
- **Antiguas y sueltas**: *Blade*, *Hulk* (2003), *Daredevil*, *Elektra*, *Punisher*, *Ghost Rider*, *Howard el Pato*.
- **Series**: Netflix (*Daredevil*, *Jessica Jones*, *Luke Cage*, *Iron Fist*, *The Punisher*, *The Defenders*), Disney+ (*WandaVision*, *Falcon y el Soldado de Invierno*, *Loki*, *Ojo de Halcón*, *Ms. Marvel*, *Moon Knight*, *Caballero Luna*, *She-Hulk*, *Secret Invasion*, *Echo*, *Agatha*, *¿Qué pasaría si...?*), y *Agents of S.H.I.E.L.D.*

Objetivo: entre 80 y 100 títulos. El rango amplio de notas (de ~3,5 a ~7,5) es
lo que hace jugable el modo nota.

## Datos

| Dato | Origen |
|---|---|
| Nota media y nº de votos | **FilmAffinity**, extraído título a título |
| Recaudación mundial | **TMDB** (campo `revenue`) |
| Póster, año, título original | **TMDB** |

Los datos se congelan en un `peliculas.json` dentro del proyecto, con la fecha
de extracción visible en el pie de la web. Nada se pide en tiempo de ejecución:
la web publicada no llama a ninguna API.

Los pósters se descargan una sola vez, se convierten a **WebP** y se guardan en
`img/`. La clave de TMDB se lee de la variable de entorno `TMDB_API_KEY` y no
se escribe en ningún archivo del proyecto.

**Comprobado antes de escribir esto**: la ficha de FilmAffinity trae la nota y
el número de votos en microdatos (`ratingValue`, `ratingCount`) y responde a una
petición normal — *Logan* da 6,9 con 38.790 votos. La extracción es viable
título a título, con pausa entre peticiones para no castigar el servidor.

## Dirección visual

**Pantalla partida cinematográfica.** El póster ocupa la mitad de la pantalla a
sangre, muy oscurecido, con el título en grande encima y el dato en el centro.
En móvil la partición es horizontal (arriba / abajo), no vertical.

Lo que evita: no hay tarjetas dentro de tarjetas, no hay degradado morado, no
hay cristal esmerilado, no hay neón. El color fuerte lo ponen los pósters.

**El póster va desenfocado, apagado y bajo un velo oscuro.** Sin eso, su propia
tipografía compite con el título del panel y el dato deja de leerse — con
*Deadpool* y *Vengadores: La era de Ultrón* se comprobó que era ilegible. El
desenfoque se aplica **al descargar la imagen**, no en CSS: así el navegador no
tiene que filtrar tres capas a pantalla completa, y de paso cada póster pasa de
~125 KB a ~25 KB. Para cambiar el punto de desenfoque hay que borrar `img/` y
volver a pasar `herramientas/tmdb.js`.

Encontrar ese punto costó tres vueltas: al primer intento el póster tapaba el
texto, al segundo el póster no se veía. El equilibrio está en que se reconozcan
el color y la figura pero no se lea una sola letra de la imagen.

### Paleta (OKLCH)

```css
--fondo:       oklch(.155 .008 25);   /* #0e0e10 */
--superficie:  oklch(.215 .012 25);
--borde:       oklch(.33  .014 25);
--texto:       oklch(.935 .016 85);   /* #f3ece0 papel crudo */
--texto-suave: oklch(.70  .014 60);
--acento:      oklch(.55  .21  28);   /* #d6291f rojo tinta */
--acierto:     oklch(.74  .17  148);
```

El rojo tinta se usa poco y siempre con significado: la marca, la racha cuando
está en juego, y el fallo. Los botones **HIGHER / LOWER** van en papel crudo con
borde, no en rojo — si todo fuera rojo, el fallo no se notaría.

Neutros con croma bajo en el mismo tono que el acento: nada de grises puros.

### Tipografía

- **Titulares**: `Archivo` variable, peso 800, ancho condensado (`wdth` 70) en
  los títulos de película. `letter-spacing: -.02em` a partir de 2rem.
- **Texto e interfaz**: `Inter`, pesos 400 y 600. Cifras tabulares para notas y
  taquilla, que no bailen al contar.
- Escala modular de razón 1.333. El dato central llega a `clamp(4rem, 12vw, 9rem)`.

## Movimiento — marcado

- La nota se revela **contando hacia arriba** (~700 ms, easing de salida).
- Al acertar, el panel derecho **se desliza a la izquierda** y entra el
  siguiente por la derecha.
- El marcador de racha **pulsa una vez** al subir. Una vez, no en bucle.
- Al fallar: la pantalla **se tiñe de rojo un instante** y se sacude, corto.
- Todo dentro de `prefers-reduced-motion`: sin movimiento, los cambios son
  instantáneos y la nota aparece directamente. El juego sigue siendo jugable.

Sin librerías: CSS y transiciones en JS. GSAP no aporta nada aquí.

## Estructura

1. **Inicio** — título, elección de modo, récord guardado, botón de jugar.
2. **Partida** — pantalla partida, racha arriba, botones HIGHER / LOWER.
3. **Fin** — puntuación, récord, qué peli te ha matado, reintentar, copiar resultado.
4. **Pie** — origen de los datos, fecha de extracción y atribución a TMDB.

El récord se guarda en `localStorage`, por modo. Sin cuentas ni servidor.

## Stack

HTML + CSS + JavaScript sin framework ni build. Un `index.html`, un `estilo.css`,
un `juego.js` y un `datos/peliculas.json`. Fuentes desde Google Fonts con
`preconnect` y `display=swap`.

Despliegue en **Netlify** con la CLI (`netlify deploy --prod`).

## Atribución

Pósters y datos de taquilla: **The Movie Database (TMDB)**. Aviso obligatorio en
el pie: *"Este producto usa la API de TMDB pero no está avalado ni certificado
por TMDB."* Notas y votos: **FilmAffinity**. Proyecto de fans sin ánimo de lucro.
