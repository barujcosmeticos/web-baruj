# web-baruj

Catálogo web de **Baruj Cosmetics**: belleza, uñas, cosméticos y fibras premium.
HTML, CSS y JavaScript sin dependencias ni build. La idea es que más adelante
el catálogo se alimente desde el panel de Conecta2.

## Ver la página

Abre `index.html` en el navegador. No necesita servidor para funcionar.

Si quieres servirla en local:

```bash
npx serve .
```

## Estructura

```
index.html          Página completa (hero, categorías, catálogo, marca, opiniones)
css/estilos.css     Tokens de marca, componentes y responsive
js/productos.js     Datos: tienda, categorías y productos
js/app.js           Filtros, búsqueda, ficha de producto y enlaces
assets/favicon.svg  Icono de la pestaña
referencia/         Imagen de referencia del diseño (no se publica)
```

## Qué cambiar

### 1. WhatsApp y redes

En `js/productos.js`, arriba:

```js
const TIENDA = {
  whatsapp: "",   // ej. "573001234567" (sin + ni espacios)
  instagram: "",  // URL completa
  tiktok: "",     // URL completa
};
```

Mientras estén vacíos, los iconos de redes se ocultan y los botones de compra
llevan al catálogo. Con el número puesto, todos los botones abren WhatsApp con
un mensaje listo.

### 2. Productos

Cada producto de `PRODUCTOS` tiene:

| Campo | Para qué |
|---|---|
| `id` | Único. También arma el enlace directo `#p-3`. |
| `nombre` | Título de la tarjeta y de la ficha. |
| `categoria` | `belleza`, `unas`, `cosmeticos` o `fibras`. |
| `icono` | Icono de relleno mientras no hay foto (`secador`, `plancha`, `cepillo`, `kit`, `esmalte`, `labial`, `paleta`, `fibra`, `mascarilla`, `brocha`). |
| `descripcion` | Texto de la ficha. |
| `etiqueta` | Opcional: “Nuevo”, “Más vendido”… |
| `precio` | Número en pesos o `null` para mostrar “Precio por WhatsApp”. |
| `imagen` | Ruta a la foto (ej. `assets/img/secador.jpg`). Si está, reemplaza al icono. |

Para una foto: guárdala en `assets/img/`, ideal 800×1000 px y formato WebP o JPG.

### 3. Categorías

En `CATEGORIAS` puedes cambiar nombres y descripciones. El `id` debe coincidir
con el `categoria` de los productos.

### 4. Textos y opiniones

Los textos del hero, la marca y las opiniones están en `index.html`. Las
opiniones actuales son de ejemplo: reemplázalas por reseñas reales antes de
publicar.

## Conectar con Conecta2 (más adelante)

El panel de Conecta2 ya expone catálogo por `/api/app/*`. La idea es reemplazar
`js/productos.js` por una llamada a la API que devuelva la misma forma:

```js
{ id, nombre, categoria, descripcion, icono, etiqueta, precio, imagen }
```

Así el diseño no cambia: solo cambia de dónde salen los datos.

## Subir a GitHub

```bash
git add .
git commit -m "base del catálogo"
git push -u origin main
```

## Publicación

Es un sitio estático: se puede publicar en GitHub Pages, Netlify, Vercel o
cualquier hosting que sirva archivos. No necesita variables de entorno ni base
de datos.

## Notas

- El repo es público; no guardar credenciales aquí.
- La carpeta `referencia/` está ignorada por git: es solo para comparar el diseño.
