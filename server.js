/* ==========================================================================
   Servidor de Baruj Cosmetics
   --------------------------------------------------------------------------
   Sitio multipágina + administración con cuenta inicial y conexión al panel
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
const MAX_HERO = 10 * 1024 * 1024;
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

const CHISPAS = `<span class="chispa chispa--1"></span>
          <span class="chispa chispa--2"></span>
          <span class="chispa chispa--3"></span>`;

const COLLAGE_ARCOS = `<div class="collage" aria-hidden="true">
          <div class="collage__tile collage__tile--a">
            <svg class="collage__dibujo" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" focusable="false">
              <g fill="none" stroke="#a8792f" stroke-opacity=".6" stroke-width="1.35" stroke-linecap="round">
                <path d="M20 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M55 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M90 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M125 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M160 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M195 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M230 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M265 410c-28-70 30-105 2-175s30-105 2-175"/>
                <path d="M300 410c-28-70 30-105 2-175s30-105 2-175"/>
              </g>
            </svg>
          </div>
          <div class="collage__tile collage__tile--b">
            <svg class="collage__dibujo" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" focusable="false">
              <g fill="none" stroke="#f3d9a4" stroke-opacity=".75" stroke-width="1.5" stroke-linecap="round">
                <path d="M60 90c30-22 60 22 90 0s60 22 90 0"/>
                <path d="M60 150c30-22 60 22 90 0s60 22 90 0"/>
                <path d="M60 210c30-22 60 22 90 0s60 22 90 0"/>
                <path d="M60 270c30-22 60 22 90 0s60 22 90 0"/>
                <path d="M30 50l7 17 17 7-17 7-7 17-7-17-17-7 17-7z"/>
                <path d="M250 300l6 14 14 6-14 6-6 14-6-14-14-6 14-6z"/>
                <path d="M215 95l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/>
                <path d="M70 330l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/>
                <path d="M135 210l4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/>
              </g>
            </svg>
          </div>
          ${CHISPAS}
        </div>`;

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
  if (!Array.isArray(datos.usuarios)) datos.usuarios = [];
  if (!datos.hero || typeof datos.hero !== "object") datos.hero = {};
  if (typeof datos.hero.reemplazado !== "boolean") datos.hero.reemplazado = false;
  if (typeof datos.hero.archivo !== "string") datos.hero.archivo = "";
  if (typeof datos.hero.escala !== "number") datos.hero.escala = 1;
  if (typeof datos.hero.x !== "number") datos.hero.x = 0;
  if (typeof datos.hero.y !== "number") datos.hero.y = 0;
  if (!datos.textos || typeof datos.textos !== "object") datos.textos = {};
  if (!datos.textos.hero || typeof datos.textos.hero !== "object") {
    datos.textos.hero = {};
  }
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

const buscarUsuario = (nombre, rol) =>
  datos.usuarios.find(
    (u) => u.usuario === String(nombre || "").toLowerCase() &&
      (!rol || u.rol === rol)
  );

const usuariosVisibles = (sesion) => {
  const lista = Array.isArray(datos.usuarios) ? datos.usuarios : [];
  if (!sesion) return [];
  if (sesion.rol === "super") {
    return lista.filter((u) => u.rol === "admin" || u.rol === "vendedor");
  }
  if (sesion.rol === "admin") {
    return lista.filter((u) => u.rol === "vendedor");
  }
  return [];
};

const puedeGestionar = (sesion, rol) => {
  if (!sesion) return false;
  if (sesion.rol === "super") {
    return rol === "admin" || rol === "vendedor";
  }
  return sesion.rol === "admin" && rol === "vendedor";
};

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

const crearSesion = (rol, usuario, version = 0) => {
  const carga = Buffer.from(
    JSON.stringify({
      rol,
      u: usuario,
      v: Number(version) || 0,
      exp: Date.now() + DURACION,
    })
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
    if (!["super", "admin", "vendedor"].includes(valor.rol)) return null;
    return valor;
  } catch (_) {
    return null;
  }
};

const sesionValida = (sesion) => {
  if (!sesion) return null;
  if (sesion.rol === "super") {
    return datos.super && datos.super.usuario === sesion.u ? sesion : null;
  }
  const usuario = datos.usuarios.find(
    (u) => u.usuario === sesion.u && u.rol === sesion.rol
  );
  if (!usuario) return null;
  return Number(usuario.v || 0) === Number(sesion.v || 0) ? sesion : null;
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

const leerBinario = (req, limite) =>
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
    req.on("end", () => resolver(Buffer.concat(partes)));
    req.on("error", rechazar);
  });

const esPng = (bytes) =>
  bytes.length > 8 &&
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
  bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
  bytes[6] === 0x1a && bytes[7] === 0x0a;

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

const archivoHero = () => {
  const nombre = String((datos.hero && datos.hero.archivo) || "");
  if (nombre !== "hero.png") return "";
  return fs.existsSync(path.join(DATOS_DIR, nombre)) ? nombre : "";
};

const simbolo = () => {
  const logo = archivoLogo();
  if (!logo) return FLOR;
  const info = fs.statSync(path.join(DATOS_DIR, logo));
  return `<img class="marca__logo" src="/media/${logo}?v=${Math.floor(
    info.mtimeMs
  )}" alt="" width="72" height="72">`;
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

const numeroHero = (valor, minimo, maximo, defecto) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return defecto;
  return Math.max(minimo, Math.min(maximo, numero));
};

const TEXTO_HERO_DEFECTO = {
  linea: "Elegir calidad",
  scripto: "también es una forma de amor propio",
  parrafo:
    "Belleza, uñas, cosméticos y fibras premium elegidos para acompañarte " +
    "todos los días. Piezas que se sienten tan bien como se ven.",
};

const textoHero = () => {
  const guardado = (datos.textos && datos.textos.hero) || {};
  const elegir = (clave) =>
    typeof guardado[clave] === "string"
      ? guardado[clave]
      : TEXTO_HERO_DEFECTO[clave];
  return {
    linea: elegir("linea"),
    scripto: elegir("scripto"),
    parrafo: elegir("parrafo"),
  };
};

const heroHTML = () => {
  const hero = datos.hero || {};
  if (!hero.reemplazado) return COLLAGE_ARCOS;
  const archivo = archivoHero();
  if (!archivo) {
    return '<div class="collage collage--foto collage--vacio" aria-hidden="true"></div>';
  }
  const info = fs.statSync(path.join(DATOS_DIR, archivo));
  const escala = numeroHero(hero.escala, 0.2, 2.5, 1);
  const x = numeroHero(hero.x, -50, 50, 0);
  const y = numeroHero(hero.y, -50, 50, 0);
  return `<div class="collage collage--foto" aria-hidden="true">
          <img class="collage__foto" src="/media/${archivo}?v=${Math.floor(
            info.mtimeMs
          )}" alt="" style="--escala:${escala};--x:${x}%;--y:${y}%">
          ${CHISPAS}
        </div>`;
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
    sesion && (sesion.rol === "admin" || sesion.rol === "super")
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
    HERO: heroHTML(),
    HERO_LINEA: escapar(textoHero().linea),
    HERO_SCRIPT: escapar(textoHero().scripto),
    HERO_PARRAFO: escapar(textoHero().parrafo),
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
  if (!/^(logo\.(png|jpg|jpeg|webp|gif)|hero\.png)$/i.test(nombre)) {
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
  vendedor: "Usuario o clave incorrectos.",
  panel_no: "El panel todavía no está conectado.",
  intentos: "Demasiados intentos. Espera unos minutos.",
  datos: "Revisa los datos del formulario.",
  clave: "Las claves no coinciden o son muy cortas (mínimo 8).",
  usuario: "El usuario debe tener entre 3 y 30 caracteres.",
  existe: "Ese usuario ya existe.",
  permiso: "No tienes permiso para esa acción.",
  imagen: "El archivo debe ser un PNG de máximo 10 MB.",
  hero: "No hay una imagen guardada para ajustar.",
};

const avisoError = (codigo) =>
  codigo && ERRORES[codigo]
    ? `<p class="aviso aviso--error" role="alert">${escapar(
        ERRORES[codigo]
      )}</p>`
    : "";

const AVISOS_OK = {
  "1": "Panel guardado y sincronizado.",
  panel: "Panel guardado y sincronizado.",
  usuario: "Usuario creado.",
  clave: "Clave actualizada.",
  eliminado: "Usuario eliminado.",
  hero: "Imagen del inicio publicada.",
  "hero-quitada": "Imagen quitada.",
  textos: "Textos guardados.",
};

const avisoOk = (codigo) =>
  codigo && AVISOS_OK[codigo]
    ? `<p class="aviso aviso--ok" role="status">${escapar(
        AVISOS_OK[codigo]
      )}</p>`
    : "";

const panelBloqueHTML = () => {
  const panel = datos.panel || {};
  const logo = archivoLogo();
  const logoTxt = logo
    ? `<img class="admin__logo" src="/media/${logo}?v=${Date.now()}" alt="Logo del panel">`
    : '<span class="admin__logo admin__logo--vacio">Sin logo</span>';
  return `<section class="admin__tarjetas" aria-label="Estado">
        <article class="admin__tarjeta">
          <h2>Panel</h2>
          <p class="admin__estado">${panel.url ? "Conectado" : "Sin conectar"}</p>
          <p class="admin__sub">
            ${escapar(panel.url || "")}<br>
            Última sincronización: ${escapar(panel.sincronizado || "")}
          </p>
        </article>
        <article class="admin__tarjeta">
          <h2>Color principal</h2>
          <p class="admin__color-fila">
            <span class="admin__color" style="background:${colorPrincipal()}"></span>
            <span>${colorPrincipal()}</span>
          </p>
          <p class="admin__sub">Se usa en botones, enlaces y detalles de la web.</p>
        </article>
        <article class="admin__tarjeta">
          <h2>Logo</h2>
          ${logoTxt}
          <p class="admin__sub">Se usa en la cabecera y como favicon.</p>
        </article>
      </section>

      <section class="admin__bloque">
        <h2>Conectar con el panel</h2>
        <form class="admin__form" method="post" action="/admin/panel">
          <label for="panel-url">URL del panel</label>
          <input id="panel-url" name="url" type="url" required
                 value="${escapar(panel.url || "")}" placeholder="https://panel.barujcosmetics.com">

          <label for="panel-token">Token del panel</label>
          <input id="panel-token" name="token" type="password"
                 autocomplete="off" spellcheck="false"
                 placeholder="Dejar vacío para conservar el actual">

          <p class="admin__sub">
            Usa el mismo token del agente de Conecta2. Si ya está guardado,
            deja el campo vacío.
          </p>

          <button class="boton boton--rosa" type="submit">Guardar y sincronizar</button>
        </form>
      </section>`;
};

const heroBloqueHTML = () => {
  const hero = datos.hero || {};
  const archivo = archivoHero();
  const info = archivo ? fs.statSync(path.join(DATOS_DIR, archivo)) : null;
  const escala = numeroHero(hero.escala, 0.2, 2.5, 1);
  const x = numeroHero(hero.x, -50, 50, 0);
  const y = numeroHero(hero.y, -50, 50, 0);
  const src = archivo
    ? ` src="/media/${archivo}?v=${Math.floor(info.mtimeMs)}"`
    : "";
  const t = textoHero();
  return `<section class="admin__bloque" aria-labelledby="hero-titulo">
        <h2 id="hero-titulo">Inicio</h2>
        <p class="admin__texto">
          La vista previa muestra el inicio completo: el texto a la izquierda y
          el PNG a la derecha. Puedes mover y ajustar el PNG, y editar los
          textos sin cambiar la tipografía ni el color.
        </p>

        <div class="admin__lienzo admin__hero-lienzo">
          <div class="hero admin__hero">
            <div class="contenedor hero__interior">
              <div class="hero__texto">
                <h1>
                  <span class="hero__linea" id="prev-linea">${escapar(t.linea)}</span>
                  <span class="hero__scripto" id="prev-scripto">${escapar(t.scripto)}</span>
                </h1>
                <p class="hero__parrafo" id="prev-parrafo">${escapar(t.parrafo)}</p>
                <div class="hero__acciones" aria-hidden="true">
                  <span class="boton boton--rosa">Descubre Baruj</span>
                  <span class="boton boton--contorno">Ver categorías</span>
                </div>
              </div>

              <div class="collage collage--foto admin__collage" id="hero-preview" aria-hidden="true">
                <img class="collage__foto" id="hero-img"${src}
                     alt="" style="--escala:${escala};--x:${x}%;--y:${y}%"
                     data-escala="${escala}" data-x="${x}" data-y="${y}"${archivo ? "" : " hidden"}>
                <span class="admin__sin-foto" id="hero-vacio"${archivo ? " hidden" : ""}>
                  Sube un PNG transparente para verlo aquí
                </span>
                ${CHISPAS}
              </div>
            </div>
          </div>
        </div>

        <div class="admin__hero-controles">
          <label class="admin__archivo" for="hero-archivo">Imagen PNG (máx. 10 MB)</label>
          <div class="admin__archivo-caja">
            <input id="hero-archivo" type="file" accept="image/png"
                   class="admin__archivo-input">
            <label class="boton boton--contorno boton--compacto" for="hero-archivo">Elegir PNG</label>
            <span id="hero-archivo-nombre" class="admin__sub">Ningún archivo</span>
          </div>

          <label for="hero-escala">Tamaño</label>
          <input id="hero-escala" type="range" min="20" max="250" step="1"
                 value="${Math.round(escala * 100)}">
          <span class="admin__escala" id="hero-escala-valor">${Math.round(
            escala * 100
          )}%</span>

          <div class="admin__hero-botones">
            <button class="boton boton--rosa boton--compacto" id="hero-aplicar" type="button">Aplicar</button>
            <button class="boton boton--contorno boton--compacto" id="hero-reset" type="button">Restablecer</button>
            <button class="boton boton--contorno boton--compacto" id="hero-quitar" type="button">Quitar imagen</button>
          </div>
          <p class="admin__sub" id="hero-estado" role="status"></p>
        </div>

        <p class="admin__sub">
          Si quitas la imagen, ese espacio queda vacío con el fondo normal y los
          arcos no vuelven.
        </p>

        <form class="admin__form admin__textos" method="post" action="/admin/textos/hero">
          <h3>Textos del inicio</h3>
          <label for="texto-linea">Título principal (H1)</label>
          <input id="texto-linea" name="linea" type="text" maxlength="120"
                 value="${escapar(t.linea)}">

          <label for="texto-scripto">Frase en script</label>
          <input id="texto-scripto" name="scripto" type="text" maxlength="160"
                 value="${escapar(t.scripto)}">

          <label for="texto-parrafo">Párrafo</label>
          <textarea id="texto-parrafo" name="parrafo" rows="4"
                    maxlength="600">${escapar(t.parrafo)}</textarea>

          <p class="admin__sub">
            Cada campo conserva la tipografía y el color del texto original.
          </p>
          <button class="boton boton--rosa" type="submit">Guardar textos</button>
        </form>
      </section>`;
};

const usuariosBloqueHTML = (sesion) => {
  const orden = { admin: 0, vendedor: 1 };
  const lista = usuariosVisibles(sesion).slice().sort(
    (a, b) =>
      (orden[a.rol] ?? 9) - (orden[b.rol] ?? 9) ||
      String(a.nombre || a.usuario).localeCompare(
        String(b.nombre || b.usuario), "es"
      )
  );
  const filas = lista.length
    ? lista
        .map((u) => {
          const nombre = escapar(u.nombre || u.usuario);
          const rol = u.rol === "admin" ? "Administrador" : "Vendedor";
          return `<article class="admin__usuario">
            <div class="admin__usuario-datos">
              <strong>${nombre}</strong>
              <span class="admin__sub">${escapar(u.usuario)} · ${rol}</span>
            </div>
            <div class="admin__usuario-acciones">
              <details class="admin__clave">
                <summary>Cambiar clave</summary>
                <form class="admin__form admin__form--fila" method="post" action="/admin/usuarios/clave">
                  <input type="hidden" name="id" value="${escapar(u.id)}">
                  <input type="password" name="clave" required minlength="8"
                         placeholder="Nueva clave" autocomplete="new-password">
                  <input type="password" name="repetir" required minlength="8"
                         placeholder="Repetir clave" autocomplete="new-password">
                  <button class="boton boton--contorno boton--compacto" type="submit">Guardar</button>
                </form>
              </details>
              <form method="post" action="/admin/usuarios/eliminar"
                    data-confirm="¿Eliminar a ${nombre}?">
                <input type="hidden" name="id" value="${escapar(u.id)}">
                <button class="boton boton--contorno boton--compacto" type="submit">Eliminar</button>
              </form>
            </div>
          </article>`;
        })
        .join("")
    : '<p class="admin__sub">Todavía no hay usuarios para mostrar.</p>';

  const selectorRol =
    sesion.rol === "super"
      ? `<label for="usuario-rol">Rol</label>
         <select id="usuario-rol" name="rol">
           <option value="vendedor">Vendedor</option>
           <option value="admin">Administrador</option>
         </select>`
      : '<input type="hidden" name="rol" value="vendedor">';

  return `<section class="admin__bloque" aria-labelledby="usuarios-titulo">
        <h2 id="usuarios-titulo">Usuarios</h2>
        <p class="admin__texto">
          ${
            sesion.rol === "super"
              ? "Puedes crear administradores y vendedores, cambiar sus claves y eliminarlos."
              : "Puedes crear vendedores, cambiar sus claves y eliminarlos."
          }
        </p>

        <form class="admin__form" method="post" action="/admin/usuarios/crear">
          <label for="usuario-nombre">Nombre</label>
          <input id="usuario-nombre" name="nombre" type="text" maxlength="60"
                 autocomplete="off" placeholder="Nombre completo">

          <label for="usuario-cuenta">Usuario</label>
          <input id="usuario-cuenta" name="usuario" type="text" required
                 minlength="3" maxlength="30" pattern="[A-Za-z0-9._-]{3,30}"
                 autocomplete="off" autocapitalize="none" spellcheck="false"
                 placeholder="Ej. vendedor03">

          <label for="usuario-clave">Clave</label>
          <input id="usuario-clave" name="clave" type="password" required
                 minlength="8" autocomplete="new-password">

          <label for="usuario-repetir">Repetir clave</label>
          <input id="usuario-repetir" name="repetir" type="password" required
                 minlength="8" autocomplete="new-password">

          ${selectorRol}

          <button class="boton boton--rosa" type="submit">Crear usuario</button>
        </form>

        <div class="admin__usuarios">${filas}</div>
      </section>`;
};

const pieSesionHTML = (sesion) => {
  if (sesion.rol === "super") {
    return '<p class="admin__sub admin__cuenta">Sesión de administración.</p>';
  }
  const usuario = datos.usuarios.find((u) => u.usuario === sesion.u);
  const nombre = usuario ? usuario.nombre || usuario.usuario : sesion.u;
  return `<p class="admin__sub admin__cuenta">Sesión de administrador: <strong>${escapar(
    nombre
  )}</strong></p>`;
};

/* ---------- rutas ---------- */

const manejar = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const ruta = url.pathname;
  const metodo = req.method;
  const sesion = sesionValida(sesionDe(req));

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
          crearSesion("super", datos.super.usuario, 0),
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
      if (sesion && (sesion.rol === "admin" || sesion.rol === "super")) {
        redirigir(req, res, "/admin");
        return;
      }
      if (sesion?.rol === "vendedor") {
        redirigir(req, res, "/vendedor");
        return;
      }
      paginaSimple(req, res, "entrar", {
        ERROR: avisoError(url.searchParams.get("error")),
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
    const raiz = datos.super || {};
    let rol = "";
    let version = 0;
    if (raiz.clave && raiz.usuario === usuario && claveOk(clave, raiz.clave)) {
      rol = "super";
    } else {
      const admin = buscarUsuario(usuario, "admin");
      if (admin && claveOk(clave, admin.clave)) {
        rol = "admin";
        version = Number(admin.v || 0);
      }
    }
    if (!rol) {
      anotarFallo(ip);
      redirigir(req, res, "/entrar?error=admin");
      return;
    }
    intentos.delete(ip);
    const cookie = cookieSesion(
      req,
      crearSesion(rol, usuario, version),
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
    const usuario = String(
      campos.get("usuario") || campos.get("codigo") || ""
    ).trim().toLowerCase();
    const clave = String(campos.get("clave") || "");
    const vendedor = usuario && clave ? buscarUsuario(usuario, "vendedor") : null;
    if (!vendedor || !claveOk(clave, vendedor.clave)) {
      anotarFallo(ip);
      redirigir(req, res, "/entrar?error=vendedor");
      return;
    }
    intentos.delete(ip);
    const cookie = cookieSesion(
      req,
      crearSesion("vendedor", vendedor.usuario, Number(vendedor.v || 0)),
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
    if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "super")) {
      redirigir(req, res, "/entrar");
      return;
    }
    if (metodo !== "GET" && metodo !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    const esSuper = sesion.rol === "super";
    const cuenta = esSuper
      ? null
      : datos.usuarios.find(
          (u) => u.usuario === sesion.u && u.rol === "admin"
        );
    const nombre = cuenta ? cuenta.nombre || cuenta.usuario : "";
    paginaSimple(req, res, "admin", {
      SESION: sesion,
      TITULO_ADMIN: esSuper ? "Configuración" : `Hola, ${escapar(nombre)}`,
      PANEL_BLOQUE: esSuper ? panelBloqueHTML() : "",
      HERO_BLOQUE: heroBloqueHTML(),
      USUARIOS_BLOQUE: usuariosBloqueHTML(sesion),
      PIE_SESION: pieSesionHTML(sesion),
      AVISO:
        avisoOk(url.searchParams.get("ok")) ||
        avisoError(url.searchParams.get("error")),
    });
    return;
  }

  if (ruta === "/admin/panel" && metodo === "POST") {
    if (!sesion) {
      redirigir(req, res, "/entrar");
      return;
    }
    if (sesion.rol !== "super") {
      redirigir(req, res, "/admin?error=permiso");
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

  // usuarios del sitio
  if (ruta === "/admin/usuarios/crear" && metodo === "POST") {
    if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "super")) {
      redirigir(req, res, "/entrar");
      return;
    }
    const campos = await formulario(req);
    const nombre = String(campos.get("nombre") || "").trim().slice(0, 60);
    const usuario = String(campos.get("usuario") || "").trim().toLowerCase();
    const clave = String(campos.get("clave") || "");
    const repetir = String(campos.get("repetir") || "");
    const rol = String(campos.get("rol") || "vendedor");
    if (!puedeGestionar(sesion, rol)) {
      redirigir(req, res, "/admin?error=permiso");
      return;
    }
    const raiz = String((datos.super && datos.super.usuario) || "").toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
      redirigir(req, res, "/admin?error=usuario");
      return;
    }
    if (usuario === raiz || buscarUsuario(usuario)) {
      redirigir(req, res, "/admin?error=existe");
      return;
    }
    if (clave.length < 8 || clave !== repetir) {
      redirigir(req, res, "/admin?error=clave");
      return;
    }
    datos.usuarios.push({
      id: crypto.randomUUID(),
      nombre: nombre || usuario,
      usuario,
      clave: hashClave(clave),
      rol,
      v: 1,
      creado: new Date().toISOString(),
    });
    guardarDatos();
    redirigir(req, res, "/admin?ok=usuario");
    return;
  }

  if (ruta === "/admin/usuarios/clave" && metodo === "POST") {
    if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "super")) {
      redirigir(req, res, "/entrar");
      return;
    }
    const campos = await formulario(req);
    const id = String(campos.get("id") || "");
    const objetivo = datos.usuarios.find((u) => u.id === id);
    if (!objetivo || !puedeGestionar(sesion, objetivo.rol)) {
      redirigir(req, res, "/admin?error=permiso");
      return;
    }
    const clave = String(campos.get("clave") || "");
    const repetir = String(campos.get("repetir") || "");
    if (clave.length < 8 || clave !== repetir) {
      redirigir(req, res, "/admin?error=clave");
      return;
    }
    objetivo.clave = hashClave(clave);
    objetivo.v = Number(objetivo.v || 0) + 1;
    guardarDatos();
    redirigir(req, res, "/admin?ok=clave");
    return;
  }

  if (ruta === "/admin/usuarios/eliminar" && metodo === "POST") {
    if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "super")) {
      redirigir(req, res, "/entrar");
      return;
    }
    const campos = await formulario(req);
    const id = String(campos.get("id") || "");
    const objetivo = datos.usuarios.find((u) => u.id === id);
    if (!objetivo || !puedeGestionar(sesion, objetivo.rol)) {
      redirigir(req, res, "/admin?error=permiso");
      return;
    }
    datos.usuarios = datos.usuarios.filter((u) => u.id !== id);
    guardarDatos();
    redirigir(req, res, "/admin?ok=eliminado");
    return;
  }

  // imagen del inicio
  if (ruta === "/admin/hero" && metodo === "POST") {
    if (!sesion) {
      responder(req, res, 401, "application/json; charset=utf-8",
        JSON.stringify({ error: "sesion" }));
      return;
    }
    if (sesion.rol !== "admin" && sesion.rol !== "super") {
      responder(req, res, 403, "application/json; charset=utf-8",
        JSON.stringify({ error: "permiso" }));
      return;
    }
    let bytes;
    try {
      bytes = await leerBinario(req, MAX_HERO);
    } catch (_) {
      responder(req, res, 413, "application/json; charset=utf-8",
        JSON.stringify({ error: "imagen" }));
      return;
    }
    if (!bytes.length || !esPng(bytes)) {
      responder(req, res, 400, "application/json; charset=utf-8",
        JSON.stringify({ error: "imagen" }));
      return;
    }
    const escala = numeroHero(url.searchParams.get("escala"), 0.2, 2.5, 1);
    const x = numeroHero(url.searchParams.get("x"), -50, 50, 0);
    const y = numeroHero(url.searchParams.get("y"), -50, 50, 0);
    fs.mkdirSync(DATOS_DIR, { recursive: true, mode: 0o700 });
    const destino = path.join(DATOS_DIR, "hero.png");
    const temporal = destino + ".tmp";
    fs.writeFileSync(temporal, bytes, { mode: 0o600 });
    fs.renameSync(temporal, destino);
    datos.hero = {
      reemplazado: true,
      archivo: "hero.png",
      escala,
      x,
      y,
    };
    guardarDatos();
    responder(req, res, 200, "application/json; charset=utf-8",
      JSON.stringify({ ok: true }));
    return;
  }

  if (ruta === "/admin/hero/ajustar" && metodo === "POST") {
    if (!sesion) {
      responder(req, res, 401, "application/json; charset=utf-8",
        JSON.stringify({ error: "sesion" }));
      return;
    }
    if (sesion.rol !== "admin" && sesion.rol !== "super") {
      responder(req, res, 403, "application/json; charset=utf-8",
        JSON.stringify({ error: "permiso" }));
      return;
    }
    if (!archivoHero()) {
      responder(req, res, 400, "application/json; charset=utf-8",
        JSON.stringify({ error: "hero" }));
      return;
    }
    const cuerpo = await leerCuerpo(req, 20000);
    let ajuste;
    try {
      ajuste = JSON.parse(cuerpo);
    } catch (_) {
      ajuste = Object.fromEntries(new URLSearchParams(cuerpo));
    }
    const escala = numeroHero(
      ajuste.escala, 0.2, 2.5, datos.hero.escala
    );
    const x = numeroHero(ajuste.x, -50, 50, datos.hero.x);
    const y = numeroHero(ajuste.y, -50, 50, datos.hero.y);
    datos.hero = {
      reemplazado: true,
      archivo: "hero.png",
      escala,
      x,
      y,
    };
    guardarDatos();
    responder(req, res, 200, "application/json; charset=utf-8",
      JSON.stringify({ ok: true }));
    return;
  }

  if (ruta === "/admin/hero/quitar" && metodo === "POST") {
    if (!sesion) {
      responder(req, res, 401, "application/json; charset=utf-8",
        JSON.stringify({ error: "sesion" }));
      return;
    }
    if (sesion.rol !== "admin" && sesion.rol !== "super") {
      responder(req, res, 403, "application/json; charset=utf-8",
        JSON.stringify({ error: "permiso" }));
      return;
    }
    try {
      fs.unlinkSync(path.join(DATOS_DIR, "hero.png"));
    } catch (_) {}
    datos.hero = {
      reemplazado: true,
      archivo: "",
      escala: 1,
      x: 0,
      y: 0,
    };
    guardarDatos();
    responder(req, res, 200, "application/json; charset=utf-8",
      JSON.stringify({ ok: true }));
    return;
  }

  // textos del inicio
  if (ruta === "/admin/textos/hero" && metodo === "POST") {
    if (!sesion || (sesion.rol !== "admin" && sesion.rol !== "super")) {
      redirigir(req, res, "/entrar");
      return;
    }
    const campos = await formulario(req);
    const linea = String(campos.get("linea") || "").trim().slice(0, 120);
    const scripto = String(campos.get("scripto") || "").trim().slice(0, 160);
    const parrafo = String(campos.get("parrafo") || "").trim().slice(0, 600);
    datos.textos = datos.textos && typeof datos.textos === "object"
      ? datos.textos
      : {};
    datos.textos.hero = { linea, scripto, parrafo };
    guardarDatos();
    redirigir(req, res, "/admin?ok=textos");
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
    const cuenta = datos.usuarios.find(
      (u) => u.usuario === sesion.u && u.rol === "vendedor"
    );
    paginaSimple(req, res, "vendedor", {
      SESION: sesion,
      NOMBRE: escapar(
        cuenta ? cuenta.nombre || cuenta.usuario : sesion.u
      ),
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
    console.log("Primera vez: crea la cuenta inicial en /instalar");
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
