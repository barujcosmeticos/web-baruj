/* ==========================================================================
   Servidor de Baruj Cosmetics
   --------------------------------------------------------------------------
   Sitio multipágina + administración con superusuario y conexión al panel
   de Conecta2 (logo y color principal). Sin dependencias: solo Node.

   Variables de entorno:
   - PORT        puerto (por defecto 3000)
   - DATA_DIR    carpeta de datos persistentes (por defecto ./datos)
   ========================================================================== */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PUERTO = Number(process.env.PORT || 3000);
const RAIZ = __dirname;
const VISTAS = path.join(RAIZ, "servidor", "vistas");
const DATOS_DIR = process.env.DATA_DIR || path.join(RAIZ, "datos");
const ARCHIVO_DATOS = path.join(DATOS_DIR, "baruj.json");
const COOKIE = "baruj_sesion";
const DURACION = 8 * 60 * 60 * 1000;
const MAX_LOGO = 3 * 1024 * 1024;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const IMAGENES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const NAV = [
  ["/", "Inicio"],
  ["/productos", "Productos"],
  ["/nosotros", "Nosotros"],
  ["/contacto", "Contacto"],
];

const FLOR = `<svg class="marca__flor" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="16" cy="8" r="5"/><circle cx="23.5" cy="13.5" r="5"/>
            <circle cx="20.6" cy="22.4" r="5"/><circle cx="11.4" cy="22.4" r="5"/>
            <circle cx="8.5" cy="13.5" r="5"/><circle cx="16" cy="16" r="2.4" fill="currentColor"/>
          </g>
        </svg>`;

const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/* ---------- datos persistentes ---------- */

let datos = null;

const cargarDatos = () => {
  if (datos) return datos;
  try {
    datos = JSON.parse(fs.readFileSync(ARCHIVO_DATOS, "utf8"));
  } catch (_) {
    datos = {};
  }
  if (!datos || typeof datos !== "object") datos = {};
  if (!datos.panel || typeof datos.panel !== "object") datos.panel = {};
  if (!datos.secreto) {
    datos.secreto = crypto.randomBytes(32).toString("hex");
    guardarDatos();
  }
  return datos;
};

const guardarDatos = () => {
  fs.mkdirSync(DATOS_DIR, { recursive: true, mode: 0o700 });
  const temporal = ARCHIVO_DATOS + ".tmp";
  fs.writeFileSync(temporal, JSON.stringify(datos, null, 2), { mode: 0o600 });
  fs.renameSync(temporal, ARCHIVO_DATOS);
};

const haySuper = () => Boolean(datos.super && datos.super.clave);

/* ---------- claves ---------- */

const hashClave = (clave) => {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(clave), sal, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt$16384$8$1$${sal.toString("base64")}$${hash.toString("base64")}`;
};

const claveOk = (clave, guardado) => {
  try {
    const partes = String(guardado || "").split("$");
    if (partes.length !== 6 || partes[0] !== "scrypt") return false;
    const sal = Buffer.from(partes[4], "base64");
    const esperado = Buffer.from(partes[5], "base64");
    const calculado = crypto.scryptSync(String(clave), sal, esperado.length, {
      N: Number(partes[1]) || 16384,
      r: Number(partes[2]) || 8,
      p: Number(partes[3]) || 1,
    });
    return crypto.timingSafeEqual(calculado, esperado);
  } catch (_) {
    return false;
  }
};

/* ---------- sesión ---------- */

const firmar = (texto) =>
  crypto
    .createHmac("sha256", String(datos.secreto || ""))
    .update(texto)
    .digest("base64url");

const crearSesion = (rol, usuario) => {
  const carga = Buffer.from(
    JSON.stringify({ rol, u: usuario, exp: Date.now() + DURACION })
  ).toString("base64url");
  return `${carga}.${firmar(carga)}`;
};

const sesionDe = (req) => {
  const texto = leerCookies(req)[COOKIE] || "";
  const corte = texto.lastIndexOf(".");
  if (corte <= 0) return null;
  const carga = texto.slice(0, corte);
  const recibida = Buffer.from(texto.slice(corte + 1));
  const esperada = Buffer.from(firmar(carga));
  if (recibida.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(recibida, esperada)) return null;
  try {
    const valor = JSON.parse(Buffer.from(carga, "base64url").toString("utf8"));
    if (Number(valor.exp) <= Date.now()) return null;
    if (!["admin", "vendedor"].includes(valor.rol)) return null;
    return valor;
  } catch (_) {
    return null;
  }
};

const leerCookies = (req) => {
  const salida = {};
  for (const parte of String(req.headers.cookie || "").split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const nombre = parte.slice(0, i).trim();
    try {
      salida[nombre] = decodeURIComponent(parte.slice(i + 1).trim());
    } catch (_) {
      salida[nombre] = "";
    }
  }
  return salida;
};

const esHttps = (req) =>
  String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim() === "https" || Boolean(req.socket.encrypted);

const cookieSesion = (req, valor, segundos) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}` +
  (esHttps(req) ? "; Secure" : "");

/* ---------- intentos de acceso ---------- */

const intentos = new Map();
const VENTANA = 10 * 60 * 1000;
const MAXIMO = 8;

const ipDe = (req) =>
  String(
    req.headers["cf-connecting-ip"] ||
      String(req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket.remoteAddress ||
      ""
  ).trim();

const bloqueado = (ip) => {
  const dato = intentos.get(ip);
  if (!dato) return false;
  if (Date.now() > dato.hasta) {
    intentos.delete(ip);
    return false;
  }
  return dato.n >= MAXIMO;
};

const anotarFallo = (ip) => {
  const ahora = Date.now();
  const dato = intentos.get(ip);
  if (!dato || ahora > dato.hasta) {
    intentos.set(ip, { n: 1, hasta: ahora + VENTANA });
  } else {
    dato.n += 1;
  }
};

/* ---------- utilidades HTTP ---------- */

const cabeceras = (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Content-Security-Policy", CSP);
  if (esHttps(req)) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
};

const responder = (req, res, codigo, tipo, cuerpo, extra = {}) => {
  cabeceras(req, res);
  res.writeHead(codigo, { "Content-Type": tipo, ...extra });
  if (req.method === "HEAD") res.end();
  else res.end(cuerpo);
};

const redirigir = (req, res, destino, extra = {}) => {
  cabeceras(req, res);
  res.writeHead(303, { Location: destino, ...extra });
  res.end();
};

const leerCuerpo = (req, limite = 20000) =>
  new Promise((resolver, rechazar) => {
    const partes = [];
    let total = 0;
    req.on("data", (trozo) => {
      total += trozo.length;
      if (total > limite) {
        rechazar(new Error("cuerpo demasiado grande"));
        req.destroy();
        return;
      }
      partes.push(trozo);
    });
    req.on("end", () => resolver(Buffer.concat(partes).toString("utf8")));
    req.on("error", rechazar);
  });

const formulario = async (req) =>
  new URLSearchParams(await leerCuerpo(req));

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

/* ---------- marca ---------- */

const archivoLogo = () => {
  const nombre = String((datos.panel && datos.panel.logo) || "");
  if (!/^logo\.(png|jpg|jpeg|webp|gif)$/i.test(nombre)) return "";
  const ruta = path.join(DATOS_DIR, nombre);
  return fs.existsSync(ruta) ? nombre : "";
};

const simbolo = () => {
  const logo = archivoLogo();
  if (!logo) return FLOR;
  const info = fs.statSync(path.join(DATOS_DIR, logo));
  return `<img class="marca__logo" src="/media/${logo}?v=${Math.floor(
    info.mtimeMs
  )}" alt="" width="44" height="44">`;
};

const favicon = () => {
  const logo = archivoLogo();
  if (logo) {
    const ext = path.extname(logo).toLowerCase();
    const info = fs.statSync(path.join(DATOS_DIR, logo));
    return {
      href: `/media/${logo}?v=${Math.floor(info.mtimeMs)}`,
      tipo: MIME[ext] || "image/png",
    };
  }
  return { href: "/assets/favicon.svg", tipo: "image/svg+xml" };
};

const colorPrincipal = () => {
  const color = String((datos.panel && datos.panel.color) || "");
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#d92b6b";
};

const navHTML = (activo) =>
  NAV.map(
    ([href, texto]) =>
      `<li><a href="${href}"${
        activo === href ? ' class="activo" aria-current="page"' : ""
      }>${texto}</a></li>`
  ).join("");

const cuentaHTML = (sesion) => {
  const destino =
    sesion && sesion.rol === "admin"
      ? { href: "/admin", etiqueta: "Ir a la administración", titulo: "Admin" }
      : sesion && sesion.rol === "vendedor"
        ? { href: "/vendedor", etiqueta: "Ir a mi cuenta", titulo: "Mi cuenta" }
        : { href: "/entrar", etiqueta: "Iniciar sesión", titulo: "Entrar" };
  return `<a class="cuenta" href="${destino.href}" aria-label="${destino.etiqueta}" title="${destino.titulo}">
      <svg class="icono" aria-hidden="true"><use href="#i-usuario"></use></svg>
      <span class="solo-lectores">${destino.titulo}</span>
    </a>`;
};

const anio = () => String(new Date().getFullYear());

/* ---------- vistas ---------- */

const leerVista = (nombre) =>
  fs.readFileSync(path.join(VISTAS, `${nombre}.html`), "utf8");

const aplicar = (html, variables) => {
  let salida = html;
  for (const [clave, valor] of Object.entries(variables)) {
    salida = salida.split(`{{${clave}}}`).join(String(valor));
  }
  return salida;
};

const variablesBase = (req, sesion) => {
  const icono = favicon();
  return {
    NAV: navHTML(""),
    CUENTA: cuentaHTML(sesion),
    SIMBOLO: simbolo(),
    FAVICON: icono.href,
    FAVICON_TIPO: icono.tipo,
    COLOR: colorPrincipal(),
    COLOR_CSS: `<style>:root{--primario:${colorPrincipal()}}</style>`,
    ANIO: anio(),
  };
};

const vista = (nombre, variables) =>
  aplicar(leerVista(nombre), variables);

const pagina = (req, res, vistaNombre, { titulo, descripcion, activo, sesion }) => {
  const base = variablesBase(req, sesion);
  const contenido = vista(vistaNombre, base);
  const html = aplicar(leerVista("base"), {
    ...base,
    TITULO: titulo,
    DESCRIPCION: descripcion,
    NAV: navHTML(activo),
    CONTENIDO: contenido,
  });
  responder(req, res, 200, MIME[".html"], html, { "Cache-Control": "no-cache" });
};

const paginaSimple = (req, res, vistaNombre, variables) => {
  const html = vista(vistaNombre, { ...variablesBase(req, variables.SESION), ...variables });
  responder(req, res, 200, MIME[".html"], html, { "Cache-Control": "no-store" });
};

/* ---------- Conecta2 ---------- */

const urlPanel = () => String((datos.panel && datos.panel.url) || "").replace(/\/+$/, "");

const sincronizarPanel = async (url, token) => {
  const base = String(url || "").replace(/\/+$/, "");
  let destino;
  try {
    destino = new URL(base);
  } catch (_) {
    throw new Error("url");
  }
  if (destino.protocol !== "https:") throw new Error("url");
  const senal = AbortSignal.timeout(15000);

  let saludo;
  try {
    saludo = await fetch(`${base}/api/saludo`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
      signal: senal,
    });
  } catch (_) {
    throw new Error("conexion");
  }
  if (saludo.status !== 200) throw new Error("token");
  let respuesta;
  try {
    respuesta = await saludo.json();
  } catch (_) {
    throw new Error("panel");
  }
  if (!respuesta || respuesta.ok !== true) throw new Error("token");

  let html = "";
  try {
    const login = await fetch(`${base}/login`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15000),
    });
    if (login.ok) html = await login.text();
  } catch (_) {
    html = "";
  }

  if (!html) throw new Error("panel");
  const color = (html.match(/--primario:\s*(#[0-9a-fA-F]{6})/) || [])[1] || "";
  const relativo = (html.match(/class="login-logo"[^>]*src="([^"]+)"/) || [])[1] || "";
  if (!color && !relativo) throw new Error("panel");
  let logo = null;

  if (relativo) {
    try {
      const urlLogo = new URL(relativo, `${base}/`).href;
      const descarga = await fetch(urlLogo, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (descarga.ok) {
        const tipo = String(descarga.headers.get("content-type") || "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        const extension = IMAGENES[tipo];
        const bytes = Buffer.from(await descarga.arrayBuffer());
        if (extension && bytes.length > 0 && bytes.length <= MAX_LOGO) {
          logo = { bytes, extension };
        }
      }
    } catch (_) {
      logo = null;
    }
  }

  return { color, logo };
};

const guardarLogo = (logo) => {
  if (!logo) return false;
  for (const extension of ["png", "jpg", "jpeg", "webp", "gif"]) {
    try {
      fs.unlinkSync(path.join(DATOS_DIR, `logo.${extension}`));
    } catch (_) {}
  }
  const nombre = `logo.${logo.extension}`;
  fs.writeFileSync(path.join(DATOS_DIR, nombre), logo.bytes, { mode: 0o600 });
  datos.panel.logo = nombre;
  return true;
};

const validarVendedor = async (codigo, clave) => {
  const base = urlPanel();
  if (!base) return "panel";
  let respuesta;
  try {
    respuesta = await fetch(`${base}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: new URLSearchParams({ codigo, clave }),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch (_) {
    return "conexion";
  }
  if (respuesta.status >= 300 && respuesta.status < 400) {
    const destino = String(respuesta.headers.get("location") || "");
    return destino.includes("/inicio") ? "ok" : "vendedor";
  }
  return "vendedor";
};

/* ---------- estáticos ---------- */

const servirArchivo = (req, res, absoluto) => {
  let info;
  try {
    info = fs.statSync(absoluto);
  } catch (_) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  if (!info.isFile()) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  const extension = path.extname(absoluto).toLowerCase();
  const tipo = MIME[extension] || "application/octet-stream";
  const cache = extension === ".html" ? "no-cache" : "public, max-age=300";
  cabeceras(req, res);
  res.writeHead(200, {
    "Content-Type": tipo,
    "Content-Length": info.size,
    "Cache-Control": cache,
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  fs.createReadStream(absoluto).pipe(res);
};

const servirPublico = (req, res, ruta) => {
  const publico = ["/css/", "/js/", "/assets/"];
  const nombre = ruta.toLowerCase();
  const permitido =
    publico.some((prefijo) => nombre.startsWith(prefijo)) ||
    nombre === "/robots.txt";
  if (!permitido) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  const absoluto = path.join(RAIZ, ruta);
  if (!absoluto.startsWith(RAIZ + path.sep)) {
    responder(req, res, 403, "text/plain; charset=utf-8", "Prohibido");
    return;
  }
  servirArchivo(req, res, absoluto);
};

const servirMedia = (req, res, nombre) => {
  if (!/^logo\.(png|jpg|jpeg|webp|gif)$/i.test(nombre)) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  servirArchivo(req, res, path.join(DATOS_DIR, nombre));
};

/* ---------- mensajes ---------- */

const ERRORES = {
  url: "La URL del panel debe empezar con https://",
  token: "El token no fue aceptado por el panel.",
  conexion: "No se pudo conectar con el panel. Revisa la URL.",
  panel: "El panel respondió algo inesperado.",
  admin: "Usuario o clave incorrectos.",
  vendedor: "Código o clave incorrectos en el panel.",
  panel_no: "El panel todavía no está conectado.",
  intentos: "Demasiados intentos. Espera unos minutos.",
  datos: "Revisa los datos del formulario.",
  clave: "Las claves no coinciden o son muy cortas (mínimo 8).",
  usuario: "El usuario debe tener entre 3 y 30 caracteres.",
};

const avisoError = (codigo) =>
  codigo && ERRORES[codigo]
    ? `<p class="aviso aviso--error" role="alert">${escapar(
        ERRORES[codigo]
      )}</p>`
    : "";

/* ---------- rutas ---------- */

const manejar = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const ruta = url.pathname;
  const metodo = req.method;
  const sesion = sesionDe(req);

  if (metodo !== "GET" && metodo !== "HEAD" && metodo !== "POST") {
    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  if (ruta === "/health") {
    responder(req, res, 200, "text/plain; charset=utf-8", "ok");
    return;
  }

  if (ruta.startsWith("/media/")) {
    if (metodo !== "GET" && metodo !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    servirMedia(req, res, ruta.slice("/media/".length));
    return;
  }

  if (ruta === "/favicon.ico") {
    redirigir(req, res, favicon().href);
    return;
  }

  if (
    ruta.startsWith("/css/") ||
    ruta.startsWith("/js/") ||
    ruta.startsWith("/assets/") ||
    ruta === "/robots.txt"
  ) {
    if (metodo !== "GET" && metodo !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    servirPublico(req, res, ruta);
    return;
  }

  // primera puesta en marcha
  if (!haySuper()) {
    if (ruta === "/instalar") {
      if (metodo === "GET" || metodo === "HEAD") {
        paginaSimple(req, res, "instalar", {
          ERROR: avisoError(url.searchParams.get("error")),
          SESION: null,
        });
        return;
      }
      if (metodo === "POST") {
        const campos = await formulario(req);
        const nombre = String(campos.get("nombre") || "").trim();
        const usuario = String(campos.get("usuario") || "").trim();
        const clave = String(campos.get("clave") || "");
        const repetir = String(campos.get("repetir") || "");
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(usuario)) {
          redirigir(req, res, "/instalar?error=usuario");
          return;
        }
        if (clave.length < 8 || clave !== repetir) {
          redirigir(req, res, "/instalar?error=clave");
          return;
        }
        if (haySuper()) {
          redirigir(req, res, "/entrar");
          return;
        }
        datos.super = {
          nombre: nombre.slice(0, 60) || usuario,
          usuario: usuario.toLowerCase(),
          clave: hashClave(clave),
          creado: new Date().toISOString(),
        };
        guardarDatos();
        const cookie = cookieSesion(
          req,
          crearSesion("admin", datos.super.usuario),
          DURACION / 1000
        );
        redirigir(req, res, "/admin", { "Set-Cookie": cookie });
        return;
      }
    }
    redirigir(req, res, "/instalar");
    return;
  }

  if (ruta === "/instalar") {
    redirigir(req, res, "/entrar");
    return;
  }

  // acceso
  if (ruta === "/entrar") {
    if (metodo === "GET" || metodo === "HEAD") {
      if (sesion?.rol === "admin") {
        redirigir(req, res, "/admin");
        return;
      }
      if (sesion?.rol === "vendedor") {
        redirigir(req, res, "/vendedor");
        return;
      }
      paginaSimple(req, res, "entrar", {
        ERROR: avisoError(url.searchParams.get("error")),
        PANEL_NOTA: urlPanel()
          ? ""
          : '<p class="acceso__nota">La entrada de vendedores se activa cuando el administrador conecte el panel de Conecta2.</p>',
        SESION: null,
      });
      return;
    }
    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  if (ruta === "/entrar/admin" && metodo === "POST") {
    const ip = ipDe(req);
    if (bloqueado(ip)) {
      redirigir(req, res, "/entrar?error=intentos");
      return;
    }
    const campos = await formulario(req);
    const usuario = String(campos.get("usuario") || "").trim().toLowerCase();
    const clave = String(campos.get("clave") || "");
    const superusuario = datos.super || {};
    if (
      !superusuario.clave ||
      superusuario.usuario !== usuario ||
      !claveOk(clave, superusuario.clave)
    ) {
      anotarFallo(ip);
      redirigir(req, res, "/entrar?error=admin");
      return;
    }
    intentos.delete(ip);
    const cookie = cookieSesion(
      req,
      crearSesion("admin", superusuario.usuario),
      DURACION / 1000
    );
    redirigir(req, res, "/admin", { "Set-Cookie": cookie });
    return;
  }

  if (ruta === "/entrar/vendedor" && metodo === "POST") {
    const ip = ipDe(req);
    if (bloqueado(ip)) {
      redirigir(req, res, "/entrar?error=intentos");
      return;
    }
    const campos = await formulario(req);
    const codigo = String(campos.get("codigo") || "").trim();
    const clave = String(campos.get("clave") || "");
    if (!codigo || !clave) {
      redirigir(req, res, "/entrar?error=vendedor");
      return;
    }
    const resultado = await validarVendedor(codigo, clave);
    if (resultado !== "ok") {
      anotarFallo(ip);
      redirigir(
        req,
        res,
        `/entrar?error=${resultado === "panel" ? "panel_no" : "vendedor"}`
      );
      return;
    }
    intentos.delete(ip);
    const cookie = cookieSesion(
      req,
      crearSesion("vendedor", codigo),
      DURACION / 1000
    );
    redirigir(req, res, "/vendedor", { "Set-Cookie": cookie });
    return;
  }

  if (ruta === "/salir" && metodo === "POST") {
    redirigir(req, res, "/", { "Set-Cookie": cookieSesion(req, "", 0) });
    return;
  }

  // administración
  if (ruta === "/admin") {
    if (!sesion || sesion.rol !== "admin") {
      redirigir(req, res, "/entrar");
      return;
    }
    if (metodo !== "GET" && metodo !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    const panel = datos.panel || {};
    const logo = archivoLogo();
    paginaSimple(req, res, "admin", {
      SESION: sesion,
      NOMBRE: escapar(datos.super?.nombre || datos.super?.usuario || "administrador"),
      USUARIO: escapar(datos.super?.usuario || ""),
      PANEL_URL: escapar(panel.url || ""),
      PANEL_COLOR: colorPrincipal(),
      PANEL_LOGO: logo
        ? `<img class="admin__logo" src="/media/${logo}?v=${Date.now()}" alt="Logo del panel">`
        : '<span class="admin__logo admin__logo--vacio">Sin logo</span>',
      PANEL_SINC: escapar(panel.sincronizado || ""),
      PANEL_ESTADO: panel.url ? "Conectado" : "Sin conectar",
      AVISO:
        url.searchParams.get("ok") === "1"
          ? '<p class="aviso aviso--ok" role="status">Panel guardado y sincronizado.</p>'
          : avisoError(url.searchParams.get("error")),
    });
    return;
  }

  if (ruta === "/admin/panel" && metodo === "POST") {
    if (!sesion || sesion.rol !== "admin") {
      redirigir(req, res, "/entrar");
      return;
    }
    const campos = await formulario(req);
    const urlPanelNueva = String(campos.get("url") || "").trim();
    const tokenNuevo = String(campos.get("token") || "").trim();
    const token = tokenNuevo || String((datos.panel && datos.panel.token) || "");
    if (!urlPanelNueva || !token) {
      redirigir(req, res, "/admin?error=datos");
      return;
    }
    let resultado;
    try {
      resultado = await sincronizarPanel(urlPanelNueva, token);
    } catch (e) {
      const codigo = ["url", "token", "conexion", "panel"].includes(e.message)
        ? e.message
        : "conexion";
      redirigir(req, res, `/admin?error=${codigo}`);
      return;
    }
    datos.panel = {
      ...(datos.panel || {}),
      url: urlPanelNueva.replace(/\/+$/, ""),
      token,
      sincronizado: new Date().toISOString().slice(0, 19).replace("T", " "),
    };
    if (resultado.color) datos.panel.color = resultado.color;
    guardarLogo(resultado.logo);
    guardarDatos();
    redirigir(req, res, "/admin?ok=1");
    return;
  }

  // vendedor
  if (ruta === "/vendedor") {
    if (!sesion || sesion.rol !== "vendedor") {
      redirigir(req, res, "/entrar");
      return;
    }
    if (metodo !== "GET" && metodo !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    paginaSimple(req, res, "vendedor", {
      SESION: sesion,
      CODIGO: escapar(sesion.u || ""),
    });
    return;
  }

  // páginas públicas
  if (metodo !== "GET" && metodo !== "HEAD") {
    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  const paginas = {
    "/": {
      vista: "inicio",
      titulo: "Baruj Cosmetics — Belleza, uñas, cosméticos y fibras",
      descripcion:
        "Belleza, uñas, cosméticos y fibras premium. Calidad garantizada y envíos a todo Colombia.",
    },
    "/productos": {
      vista: "productos",
      titulo: "Productos — Baruj Cosmetics",
      descripcion:
        "Catálogo de belleza, uñas, cosméticos y fibras premium de Baruj Cosmetics.",
    },
    "/nosotros": {
      vista: "nosotros",
      titulo: "Nosotros — Baruj Cosmetics",
      descripcion: "La historia y los valores de Baruj Cosmetics.",
    },
    "/contacto": {
      vista: "contacto",
      titulo: "Contacto — Baruj Cosmetics",
      descripcion: "Escríbenos por WhatsApp y síguenos en redes.",
    },
  };

  const paginaPedida = paginas[ruta];
  if (paginaPedida) {
    pagina(req, res, paginaPedida.vista, {
      titulo: paginaPedida.titulo,
      descripcion: paginaPedida.descripcion,
      activo: ruta,
      sesion,
    });
    return;
  }

  responder(
    req,
    res,
    404,
    MIME[".html"],
    aplicar(leerVista("base"), {
      ...variablesBase(req, sesion),
      TITULO: "Página no encontrada — Baruj Cosmetics",
      DESCRIPCION: "Esa página no existe.",
      NAV: navHTML(""),
      CONTENIDO:
        '<section class="seccion"><div class="contenedor"><h1>Página no encontrada</h1><p class="admin__texto">Esa dirección no existe.</p><a class="boton boton--rosa" href="/">Volver al inicio</a></div></section>',
    })
  );
};

/* ---------- arranque ---------- */

cargarDatos();

const servidor = http.createServer((req, res) => {
  manejar(req, res).catch(() => {
    if (!res.headersSent) {
      responder(req, res, 500, "text/plain; charset=utf-8", "Error interno");
    } else {
      res.end();
    }
  });
});

setInterval(() => {
  const ahora = Date.now();
  for (const [ip, dato] of intentos) {
    if (ahora > dato.hasta) intentos.delete(ip);
  }
}, VENTANA).unref();

servidor.listen(PUERTO, () => {
  console.log(`Baruj Cosmetics en http://localhost:${PUERTO}`);
  if (!haySuper()) {
    console.log("Primera vez: crea el superusuario en /instalar");
  }
  if (!urlPanel()) {
    console.log("Panel de Conecta2 sin conectar todavía.");
  }
});

const cerrar = () => {
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGTERM", cerrar);
process.on("SIGINT", cerrar);
