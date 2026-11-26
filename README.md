# web-baruj

Catálogo web de **Baruj Cosmetics**: belleza, uñas, cosméticos y fibras premium.
El sitio es HTML, CSS y JavaScript; un servidor Node mínimo (sin dependencias)
lo sirve y protege la sección `/admin` con un token.

## Ver la página

Solo el catálogo: abre `index.html` en el navegador.

Con administración hace falta Node 18 o superior:

```bash
ADMIN_TOKEN="tu-token" node server.js
```

Luego abre `http://localhost:3000` (catálogo) y `http://localhost:3000/admin`
(administración). En PowerShell:

```powershell
$env:ADMIN_TOKEN="tu-token"; node server.js
```

## Estructura

```
index.html             Página completa (hero, categorías, catálogo, marca, opiniones)
css/estilos.css        Tokens de marca, componentes y responsive
css/admin.css          Estilos del acceso y del panel de administración
js/productos.js        Datos: tienda, categorías y productos
js/app.js              Filtros, búsqueda, ficha de producto y enlaces
assets/favicon.svg     Icono de la pestaña
assets/img/            Imágenes (fondo decorativo y fotos de productos)
server.js              Servidor: sitio estático + login de /admin
servidor/              Páginas privadas de administración (no se sirven como estáticas)
Dockerfile             Imagen para desplegar en Coolify
robots.txt             Bloquea /admin en buscadores
referencia/            Imágenes de referencia (ignoradas por git)
```

## Administración

- URL: `/admin` → pide el **token de administrador**.
- El token se toma de la variable de entorno `ADMIN_TOKEN`. **Usa el mismo
  token del agente de Conecta2**, no hace falta crear otro.
- `SESSION_SECRET` es opcional: si no se define, la sesión se firma con el
  token. Cambiar el token cierra las sesiones abiertas.
- `PORT` es opcional (por defecto 3000).
- La sesión dura 8 horas, la cookie es `HttpOnly` y `SameSite=Lax`, y el login
  se bloquea 10 minutos después de 8 intentos fallidos.
- El token nunca se envía al navegador ni se guarda en el repositorio: el
  formulario lo compara en el servidor.
- Todavía no está conectado al panel de Conecta2; por ahora el panel solo
  muestra el estado. Más adelante esa sesión servirá para llamar a la API.

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

### 5. Fondo decorativo

El fondo floral es `assets/img/fondo-floral.jpg` y se usa en el hero, las
categorías, la sección de marca y el acceso. Puedes reemplazarlo por otra
imagen con el mismo nombre y proporción vertical.

## Despliegue en Coolify

1. **Build Pack: Dockerfile** (ya no sirve el build pack “Static” porque el
   login necesita el servidor).
2. Puerto del contenedor: **3000**.
3. Variables de entorno:
   - `ADMIN_TOKEN` = el token del agente de Conecta2.
   - `SESSION_SECRET` (opcional).
4. Dominios: `https://barujcosmetics.com` y `https://www.barujcosmetics.com`.
5. Healthcheck: `/health`.

Si el token del agente se renueva, actualiza `ADMIN_TOKEN` en Coolify y
redespliega.

Para probar la imagen en local:

```bash
docker build -t web-baruj .
docker run --rm -p 3000:3000 -e ADMIN_TOKEN="tu-token" web-baruj
```

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
git commit -m "catálogo con administración"
git push
```

## Notas

- El repo es público; no guardar credenciales aquí.
- La carpeta `referencia/` está ignorada por git.
- `servidor/` y `server.js` no se sirven como archivos estáticos.
