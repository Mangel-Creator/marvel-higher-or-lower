# Marvel Higher or Lower

Juego tipo *Higher or Lower* con el cine y la televisión de Marvel. Dos títulos
a pantalla partida: del primero ves el dato, del segundo tienes que adivinar si
tiene más o menos. Dos modos: **nota de TMDB** y **taquilla mundial**.

Las decisiones de diseño están en [BRIEF.md](BRIEF.md).

## Cómo se levanta en local

```bash
npx -y serve -l 4173 .
```

Y a `http://localhost:4173`. Tiene que ser por HTTP: abrir `index.html` como
archivo no funciona, porque el juego carga los datos con `fetch`.

## Archivos

```
index.html            la página entera
estilo.css            tokens de color, tipografía y espacio; todo sale de aquí
juego.js              motor del juego, sin dependencias
datos/peliculas.json  lo único que lee la web
img/                  pósters en WebP
herramientas/         los scripts que generan los datos (no se despliegan)
```

## Cómo se regeneran los datos

Los datos van congelados en `datos/peliculas.json`. La web publicada no llama a
ninguna API. Para actualizarlos, tres pasos en orden:

```bash
node herramientas/filmaffinity.js
```

Fuente original de las notas, hoy no usada: ver BRIEF. Saca nota y votos de
FilmAffinity, título a título. Tarda unos diez minutos a
propósito: hay una pausa de 2,5 s entre peticiones y, si FilmAffinity responde
429, espera cinco minutos antes de insistir. **No lo lances varias veces
seguidas**: acaban bloqueándote media hora. Lo ya descargado queda en
la carpeta temporal del sistema, así que relanzarlo no repite trabajo.

```bash
node herramientas/tmdb.js
```

Pósters y recaudación mundial. Necesita la clave en el entorno:

```bash
[Environment]::SetEnvironmentVariable('TMDB_API_KEY','tu-clave','User')
```

y una ventana nueva para que la vea. La clave nunca se escribe en el proyecto.
Vale tanto la clave v3 de 32 caracteres como el token de lectura v4: el script
distingue una de otra y manda cada una como toca.

Los pósters se guardan ya desenfocados y apagados, que es como se usan de fondo
(ver BRIEF). Si quieres cambiar ese punto, toca los valores de `blur` y
`modulate` en `herramientas/tmdb.js`, **borra la carpeta `img/`** y vuelve a
pasar el script: si los archivos ya existen, no los rehace. Necesita `sharp`;
sin él guarda los JPG originales, sin desenfocar.

```bash
node herramientas/montar.js
```

```bash
node herramientas/comparte.js
```

Opcional: rehace `img/comparte.jpg`, la imagen que se ve al pegar el enlace en
WhatsApp o Twitter. Solo hay que volver a pasarlo si cambia el título del juego
o quieres otros pósters en el montaje. Necesita `sharp` y que `img/` ya esté
lleno.

---

`montar.js` junta las dos fuentes en `datos/peliculas.json` y resume qué ha quedado dentro
y qué se ha caído. Si falta TMDB, monta igual: el modo de notas funciona y el de
taquilla queda desactivado hasta que haya datos. Nunca se rellena a ojo.

El catálogo de títulos que se busca está en `herramientas/titulos.js`. Para
añadir una película, basta con añadir una línea ahí y volver a pasar los tres
scripts.

## Despliegue

Está publicada en **GitHub Pages**, servida desde la rama `main` en la raíz:

**https://mangel-creator.github.io/marvel-higher-or-lower/**

No hay build. Se sube tal cual: cada `git push` a `main` republica la web en un
par de minutos.

```bash
git add -A; git commit -m "..."; git push
```

El `netlify.toml` se queda por si algún día se mueve a Netlify (era el plan
original, descartado porque el token de la cuenta había caducado). GitHub Pages
lo ignora.

## Créditos

Notas, taquilla y pósters de [TMDB](https://www.themoviedb.org) — este producto usa la API de
TMDB pero no está avalado ni certificado por TMDB. Proyecto de fans, sin ánimo
de lucro y sin relación con Marvel ni Disney.
