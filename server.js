/* ==========================================================================
   Servidor del catálogo Baruj Cosmetics
   --------------------------------------------------------------------------
   Sirve el sitio estático y protege /admin con un token de administrador.
   Sin dependencias: solo Node.

   Variables de entorno:
   - PORT            puerto del servidor (por defecto 3000)
   - ADMIN_TOKEN     token para entrar a /admin. Usa el mismo del agente.
   - SESSION_SECRET  opcional; si no está, se deriva del token.
   ========================================================================== */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PUERTO = Number(process.env.PORT || 3000);
const RAIZ = __dirname;
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || "").trim();
const COOKIE = "baruj_admin";
const DURACION = 8 * 60 * 60 * 1000; // 8 horas
const SECRETO =
  String(process.env.SESSION_SECRET || "").trim() ||
  crypto.createHash("sha256").update("baruj-admin|" + ADMIN_TOKEN).digest("hex");

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
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const EXTENSIONES_PUBLICAS = new Set(Object.keys(MIME));
const CARPETAS_PRIVADAS = ["/servidor/", "/referencia/", "/node_modules/"];
const ARCHIVOS_PRIVADOS = new Set([
  "/server.js",
  "/Dockerfile",
  "/README.md",
  "/.dockerignore",
  "/.gitignore",
  "/package.json",
  "/package-lock.json",
]);

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

/* ---------- sesión ---------- */

const firmar = (datos) =>
  crypto.createHmac("sha256", SECRETO).update(datos).digest("base64url");

const crearSesion = () => {
  const datos = Buffer.from(
    JSON.stringify({
      exp: Date.now() + DURACION,
      n: crypto.randomBytes(8).toString("hex"),
    })
  ).toString("base64url");
  return `${datos}.${firmar(datos)}`;
};

const sesionValida = (cookie) => {
  const texto = String(cookie || "");
  const corte = texto.lastIndexOf(".");
  if (corte <= 0) return false;
  const datos = texto.slice(0, corte);
  const recibida = Buffer.from(texto.slice(corte + 1));
  const esperada = Buffer.from(firmar(datos));
  if (recibida.length !== esperada.length) return false;
  if (!crypto.timingSafeEqual(recibida, esperada)) return false;
  try {
    const carga = JSON.parse(Buffer.from(datos, "base64url").toString("utf8"));
    return Number(carga.exp) > Date.now();
  } catch (_) {
    return false;
  }
};

const tokenCorrecto = (enviado) => {
  if (!ADMIN_TOKEN) return false;
  const a = crypto.createHash("sha256").update(String(enviado)).digest();
  const b = crypto.createHash("sha256").update(ADMIN_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
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

const autenticado = (req) => {
  const cookie = leerCookies(req)[COOKIE];
  return cookie ? sesionValida(cookie) : false;
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

const limpiarIntentos = () => {
  const ahora = Date.now();
  for (const [ip, dato] of intentos) {
    if (ahora > dato.hasta) intentos.delete(ip);
  }
};

/* ---------- utilidades ---------- */

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

const plantilla = (archivo, variables) => {
  let html = fs.readFileSync(path.join(RAIZ, "servidor", archivo), "utf8");
  for (const [clave, valor] of Object.entries(variables)) {
    html = html.split(`{{${clave}}}`).join(valor);
  }
  return html;
};

const leerCuerpo = (req, limite = 4096) =>
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

const paginaError = (titulo, texto) =>
  `<!DOCTYPE html><html lang="es-CO"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width, initial-scale=1">` +
  `<title>${titulo} — Baruj Cosmetics</title>` +
  `<link rel="stylesheet" href="/css/estilos.css"></head>` +
  `<body><main class="acceso"><div class="acceso__caja">` +
  `<h1>${titulo}</h1><p class="acceso__texto">${texto}</p>` +
  `<a class="boton boton--contorno" href="/">Volver al inicio</a>` +
  `</div></main></body></html>`;

/* ---------- estáticos ---------- */

const servirArchivo = (req, res, ruta) => {
  const archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ + path.sep)) {
    responder(req, res, 403, "text/plain; charset=utf-8", "Prohibido");
    return;
  }
  let info;
  try {
    info = fs.statSync(archivo);
  } catch (_) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  if (!info.isFile()) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }
  const extension = path.extname(archivo).toLowerCase();
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
  fs.createReadStream(archivo).pipe(res);
};

const esPublico = (ruta) => {
  const rutaMin = ruta.toLowerCase();
  if (ARCHIVOS_PRIVADOS.has(rutaMin)) return false;
  if (rutaMin.split("/").some((parte) => parte.startsWith("."))) return false;
  for (const carpeta of CARPETAS_PRIVADAS) {
    if (rutaMin.startsWith(carpeta)) return false;
  }
  return EXTENSIONES_PUBLICAS.has(path.extname(rutaMin));
};

/* ---------- rutas ---------- */

const manejarAdmin = async (req, res, url) => {
  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    if (req.method !== "GET" && req.method !== "HEAD") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    if (!autenticado(req)) {
      redirigir(req, res, "/admin/login");
      return;
    }
    const html = plantilla("admin-panel.html", {
      TOKEN_ESTADO: ADMIN_TOKEN ? "Configurado" : "Sin configurar",
    });
    responder(req, res, 200, MIME[".html"], html, { "Cache-Control": "no-store" });
    return;
  }

  if (url.pathname === "/admin/login") {
    if (req.method === "GET" || req.method === "HEAD") {
      if (autenticado(req)) {
        redirigir(req, res, "/admin");
        return;
      }
      const error = url.searchParams.get("error");
      let aviso = "";
      if (!ADMIN_TOKEN) {
        aviso =
          '<p class="acceso__error" role="alert">Falta configurar el token ' +
          "del administrador en el servidor.</p>";
      } else if (error === "1") {
        aviso =
          '<p class="acceso__error" role="alert">Token incorrecto. ' +
          "Inténtalo de nuevo.</p>";
      } else if (error === "2") {
        aviso =
          '<p class="acceso__error" role="alert">Demasiados intentos. ' +
          "Espera unos minutos.</p>";
      }
      const html = plantilla("admin-login.html", { ERROR: aviso });
      responder(req, res, 200, MIME[".html"], html, { "Cache-Control": "no-store" });
      return;
    }

    if (req.method === "POST") {
      const ip = ipDe(req);
      if (bloqueado(ip)) {
        redirigir(req, res, "/admin/login?error=2");
        return;
      }
      let cuerpo = "";
      try {
        cuerpo = await leerCuerpo(req);
      } catch (_) {
        redirigir(req, res, "/admin/login?error=1");
        return;
      }
      const enviado = String(
        new URLSearchParams(cuerpo).get("token") || ""
      ).trim();
      if (!tokenCorrecto(enviado)) {
        anotarFallo(ip);
        redirigir(req, res, "/admin/login?error=1");
        return;
      }
      intentos.delete(ip);
      const cookie = cookieSesion(req, crearSesion(), DURACION / 1000);
      redirigir(req, res, "/admin", { "Set-Cookie": cookie });
      return;
    }

    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  if (url.pathname === "/admin/logout") {
    if (req.method !== "POST") {
      responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
      return;
    }
    redirigir(req, res, "/admin/login", {
      "Set-Cookie": cookieSesion(req, "", 0),
    });
    return;
  }

  responder(req, res, 404, MIME[".html"],
    paginaError("Página no encontrada", "Esa dirección de administración no existe."));
};

const manejar = async (req, res) => {
  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch (_) {
    responder(req, res, 400, "text/plain; charset=utf-8", "Solicitud inválida");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  if (url.pathname === "/health") {
    responder(req, res, 200, "text/plain; charset=utf-8", "ok");
    return;
  }

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    await manejarAdmin(req, res, url);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    responder(req, res, 405, "text/plain; charset=utf-8", "Método no permitido");
    return;
  }

  let ruta;
  try {
    ruta = decodeURIComponent(url.pathname);
  } catch (_) {
    responder(req, res, 400, "text/plain; charset=utf-8", "Solicitud inválida");
    return;
  }

  ruta = ruta.replace(/\\/g, "/");
  if (ruta.includes("\0") || ruta.split("/").some((parte) => parte === "..")) {
    responder(req, res, 403, "text/plain; charset=utf-8", "Prohibido");
    return;
  }
  if (ruta === "/") ruta = "/index.html";
  if (!esPublico(ruta)) {
    responder(req, res, 404, "text/plain; charset=utf-8", "No encontrado");
    return;
  }

  servirArchivo(req, res, ruta);
};

/* ---------- arranque ---------- */

const servidor = http.createServer((req, res) => {
  manejar(req, res).catch(() => {
    if (!res.headersSent) {
      responder(req, res, 500, "text/plain; charset=utf-8", "Error interno");
    } else {
      res.end();
    }
  });
});

setInterval(limpiarIntentos, VENTANA).unref();

servidor.listen(PUERTO, () => {
  console.log(`Baruj Cosmetics en http://localhost:${PUERTO}`);
  if (!ADMIN_TOKEN) {
    console.warn("Aviso: falta ADMIN_TOKEN; /admin no permitirá entrar.");
  }
});

const cerrar = () => {
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGTERM", cerrar);
process.on("SIGINT", cerrar);
