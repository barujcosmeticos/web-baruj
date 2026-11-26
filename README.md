# web-baruj

Sitio multipágina de **Baruj Cosmetics**: inicio, productos, nosotros y contacto.
Incluye administración con cuenta inicial y conexión con el panel de Conecta2
para traer el **logo** y el **color principal**. Sin dependencias: solo Node 18+.

## Páginas

| Ruta | Qué es |
|---|---|
| `/` | Inicio: hero, categorías y productos destacados |
| `/productos` | Catálogo completo con búsqueda, filtros y ficha |
| `/nosotros` | Marca, valores y opiniones |
| `/contacto` | WhatsApp, redes y envíos |
| `/entrar` | Entrada de administrador o vendedor |
| `/admin` | Administración (cuenta inicial y administradores) |
| `/vendedor` | Cuenta local del vendedor |

## Primera vez

1. Levanta el servidor:

   ```bash
   node server.js
   ```

2. Abre `http://localhost:3000`. La primera vez redirige a **`/instalar`**.
3. Crea la **cuenta inicial** (nombre, usuario y clave). Solo se puede hacer una vez.
4. Entra a `/admin` y conecta el panel:
   - **URL del panel**: `https://panel.barujcosmetics.com`
   - **Token del panel**: el **mismo token del agente de Conecta2** (no se crea otro).
   - Guardar y sincronizar.
5. Al sincronizar se traen el **logo** (cabecera y favicon) y el **color
   principal** (botones, enlaces y detalles).

### Usuarios

Los usuarios son locales de la web; no se validan contra el panel.

- La **cuenta inicial** es única, no aparece en las listas y solo se usa para
  entrar por el login de administrador. Puede crear administradores y
  vendedores, cambiarles la clave y eliminarlos.
- Un **administrador** puede cambiar la imagen y los textos del inicio, y
  crear, cambiar la clave o eliminar **vendedores**.
- Un **vendedor** entra a `/vendedor`; todavía no puede ver pedidos ni catálogo.

### Inicio: imagen y textos

En `/admin`, la cuenta inicial y los administradores ven una vista previa del
**inicio completo**, con el texto a la izquierda y la imagen a la derecha.

- **Imagen**: un **PNG transparente de hasta 10 MB** reemplaza los dos arcos del
  hero. Se puede mover y ajustar el tamaño antes de aplicar. Al quitarla, ese
  espacio queda vacío con el fondo normal y los arcos no vuelven.
- **Textos**: se editan el **título principal (H1)**, la **frase en script** y
  el **párrafo**. Cada campo conserva la tipografía y el color originales; la
  vista previa se actualiza mientras se escribe.

## Variables de entorno

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | `3000` |
| `DATA_DIR` | Carpeta de datos persistentes | `./datos` |

En Docker, `DATA_DIR=/data`. Ahí viven `baruj.json` (cuenta inicial, usuarios,
imagen del inicio, panel y secreto de sesión), el logo y la imagen.

## Estructura

```
server.js               Servidor: páginas, login, admin y sincronización
servidor/vistas/        Plantillas de todas las páginas
css/estilos.css         Tokens de marca, componentes y responsive
css/admin.css           Acceso, panel y formularios
js/productos.js         Datos: tienda, categorías y productos
js/app.js               Catálogo, filtros, ficha y enlaces
js/admin.js             Vista previa de la imagen, arrastre y confirmaciones
assets/favicon.svg      Icono por defecto (si el panel no tiene logo)
assets/img/             Fondo decorativo y fotos
Dockerfile              Imagen para Coolify
docker-entrypoint.sh    Prepara /data y arranca como usuario node
robots.txt              Bloquea las rutas privadas en buscadores
referencia/             Imágenes de referencia (ignoradas por git)
```

## Qué cambiar

### 1. WhatsApp y redes

En `js/productos.js`:

```js
const TIENDA = {
  whatsapp: "",   // ej. "573001234567" (sin + ni espacios)
  instagram: "",
  tiktok: "",
};
```

Mientras estén vacíos, las redes se ocultan y los botones de compra llevan al
catálogo. Con el número puesto, abren WhatsApp con un mensaje listo.

### 2. Productos y categorías

En `js/productos.js` están `CATEGORIAS` y `PRODUCTOS`. Cada producto acepta:
`id`, `nombre`, `categoria`, `icono`, `descripcion`, `etiqueta`, `precio` y
`imagen`. Si `precio` es `null` se muestra “Precio por WhatsApp”. Si pones
`imagen`, reemplaza al icono. Fotos ideales: 800×1000 px, WebP o JPG.

### 3. Textos

Cada página está en `servidor/vistas/`. Los textos de la marca y las opiniones
son de ejemplo: reemplázalos por los reales.

### 4. Logo y color

No se editan a mano: se traen del panel al sincronizar. Si el panel no tiene
logo, se usa la flor del sitio. El color se aplica a botones, enlaces, chips y
detalles; el dorado se mantiene como acento decorativo.

## Despliegue en Coolify

1. **Build Pack: Dockerfile**.
2. **Puerto: 3000**.
3. **Persistent Storage**: monta un volumen en **`/data`**. Sin esto, la
   cuenta inicial y la configuración se pierden en cada redeploy.
4. Dominios: `https://barujcosmetics.com` y `https://www.barujcosmetics.com`.
5. Healthcheck: `/health`.

No hace falta ninguna variable `ADMIN_TOKEN`: la cuenta inicial se crea en
`/instalar` y el token del panel se guarda desde `/admin`.

Para probar la imagen en local:

```bash
docker build -t web-baruj .
docker run --rm -p 3000:3000 -v "$PWD/datos:/data" web-baruj
```

## Seguridad

- Las claves se guardan con `scrypt`.
- El token del panel nunca se envía al navegador ni se muestra en el HTML.
- La sesión va en una cookie `HttpOnly`/`SameSite=Lax`, firmada con un secreto
  propio guardado en `/data`.
- El login se bloquea 10 minutos tras 8 intentos fallidos.
- `/admin`, `/entrar`, `/instalar` y `/vendedor` están fuera de buscadores.
- El repo es público: no guardar credenciales aquí.

## Subir a GitHub

```bash
git add .
git commit -m "sitio multipagina con administracion de usuarios e imagen del inicio"
git push
```
