/* ==========================================================================
   Baruj Cosmetics — catálogo
   Filtros, búsqueda, ficha de producto y enlaces de contacto.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const escapar = (texto) =>
    String(texto ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const normalizar = (texto) =>
    String(texto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const formatoPrecio = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

  const categoriaPorId = Object.fromEntries(
    CATEGORIAS.map((c) => [c.id, c])
  );

  const estado = { categoria: "todos", q: "", orden: "recomendado" };

  const icono = (nombre) =>
    `<svg class="icono" aria-hidden="true" focusable="false">` +
    `<use href="#i-${escapar(nombre)}"></use></svg>`;

  /* ---------- enlaces externos ---------- */

  const enlaceWhatsApp = (texto) => {
    const numero = String(TIENDA.whatsapp || "").replace(/\D/g, "");
    if (!numero) return "";
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  };

  const prepararEnlaces = () => {
    $$("[data-social]").forEach((enlace) => {
      const url = String(TIENDA[enlace.dataset.social] || "").trim();
      if (url) {
        enlace.href = url;
      } else {
        enlace.style.display = "none";
      }
    });

    const general = enlaceWhatsApp("Hola, quiero comprar en Baruj Cosmetics.");
    $$("[data-whatsapp]").forEach((enlace) => {
      if (general) {
        enlace.href = general;
      } else {
        enlace.removeAttribute("target");
        enlace.removeAttribute("rel");
      }
    });
  };

  /* ---------- categorías y filtros ---------- */

  const pintarCategorias = () => {
    $("#lista-categorias").innerHTML = CATEGORIAS.map(
      (c) => `
      <a class="categoria" href="#productos" data-filtro="${escapar(c.id)}">
        <span class="categoria__media" data-cat="${escapar(c.id)}">
          ${icono(c.icono)}
          <span class="categoria__flecha" aria-hidden="true">${icono("flecha")}</span>
        </span>
        <h3>${escapar(c.nombre)}</h3>
        <p>${escapar(c.detalle)}</p>
      </a>`
    ).join("");
  };

  const pintarChips = () => {
    const opciones = [
      { id: "todos", nombre: "Todos" },
      ...CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre })),
    ];
    $("#chips").innerHTML = opciones
      .map(
        (o) => `
      <button class="chip" type="button" data-filtro="${escapar(o.id)}"
        aria-pressed="${estado.categoria === o.id}">${escapar(o.nombre)}</button>`
      )
      .join("");
  };

  const marcarChips = () => {
    $$("#chips .chip").forEach((chip) => {
      chip.setAttribute(
        "aria-pressed",
        String(chip.dataset.filtro === estado.categoria)
      );
    });
  };

  /* ---------- catálogo ---------- */

  const filtrar = () => {
    const q = normalizar(estado.q);
    let lista = PRODUCTOS.filter((p) => {
      if (estado.categoria !== "todos" && p.categoria !== estado.categoria) {
        return false;
      }
      if (!q) return true;
      const categoria = categoriaPorId[p.categoria]?.nombre || "";
      return (
        normalizar(p.nombre).includes(q) ||
        normalizar(categoria).includes(q) ||
        normalizar(p.descripcion).includes(q)
      );
    });

    if (estado.orden === "nombre") {
      lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    } else if (estado.orden === "categoria") {
      lista = [...lista].sort((a, b) => {
        const ia = CATEGORIAS.findIndex((c) => c.id === a.categoria);
        const ib = CATEGORIAS.findIndex((c) => c.id === b.categoria);
        return ia - ib || a.nombre.localeCompare(b.nombre, "es");
      });
    }
    return lista;
  };

  const pintarProductos = () => {
    const lista = filtrar();
    const contenedor = $("#lista-productos");
    const vacio = $("#vacio");
    const cuenta = $("#cuenta");

    cuenta.textContent =
      lista.length === 1 ? "1 producto" : `${lista.length} productos`;

    vacio.hidden = lista.length > 0;
    contenedor.hidden = lista.length === 0;

    contenedor.innerHTML = lista
      .map((p) => {
        const categoria = categoriaPorId[p.categoria]?.nombre || "";
        const precio =
          p.precio == null ? "Precio por WhatsApp" : formatoPrecio.format(p.precio);
        return `
        <article class="producto">
          <a class="producto__enlace" href="#p-${p.id}"
             aria-label="Ver ${escapar(p.nombre)}">
            <span class="producto__media" data-cat="${escapar(p.categoria)}">
              ${p.imagen
                ? `<img src="${escapar(p.imagen)}" alt="" loading="lazy">`
                : icono(p.icono)}
              ${p.etiqueta
                ? `<span class="producto__etiqueta">${escapar(p.etiqueta)}</span>`
                : ""}
            </span>
            <span class="producto__texto">
              <span class="producto__categoria">${escapar(categoria)}</span>
              <span class="producto__nombre">${escapar(p.nombre)}</span>
              <span class="producto__precio">${escapar(precio)}</span>
              <span class="producto__ver">Ver detalles ${icono("flecha")}</span>
            </span>
          </a>
        </article>`;
      })
      .join("");
  };

  /* ---------- ficha del producto ---------- */

  const ficha = $("#ficha");
  const fichaMedia = $("#ficha-media");
  const fichaCategoria = $("#ficha-categoria");
  const fichaNombre = $("#ficha-nombre");
  const fichaDescripcion = $("#ficha-descripcion");
  const fichaPrecio = $("#ficha-precio");
  const fichaCta = $("#ficha-whatsapp");
  const fichaCtaTexto = $("#ficha-whatsapp-texto");

  const abrirFicha = (id) => {
    const producto = PRODUCTOS.find((p) => p.id === id);
    if (!producto) return;
    const categoria = categoriaPorId[producto.categoria]?.nombre || "";

    fichaMedia.dataset.cat = producto.categoria;
    fichaMedia.innerHTML = producto.imagen
      ? `<img src="${escapar(producto.imagen)}" alt="">`
      : icono(producto.icono);
    fichaCategoria.textContent = categoria;
    fichaNombre.textContent = producto.nombre;
    fichaDescripcion.textContent = producto.descripcion;
    fichaPrecio.textContent =
      producto.precio == null
        ? "Precio y disponibilidad por WhatsApp"
        : formatoPrecio.format(producto.precio);

    const mensaje =
      `Hola, me interesa ${producto.nombre} (${categoria}). ` +
      "¿Me das precio y disponibilidad?";
    const url = enlaceWhatsApp(mensaje);
    if (url) {
      fichaCta.href = url;
      fichaCta.target = "_blank";
      fichaCta.rel = "noopener";
      fichaCtaTexto.textContent = "Consultar por WhatsApp";
      fichaCta.onclick = null;
    } else {
      fichaCta.href = "#contacto";
      fichaCta.removeAttribute("target");
      fichaCta.removeAttribute("rel");
      fichaCtaTexto.textContent = "Escríbenos";
      fichaCta.onclick = () => ficha.close();
    }

    if (!ficha.open) ficha.showModal();
    document.body.classList.add("sin-scroll");
  };

  const cerrarFicha = () => ficha.close();

  const fichaDesdeHash = () => {
    const coincidencia = location.hash.match(/^#p-(\d+)$/);
    if (coincidencia) abrirFicha(Number(coincidencia[1]));
  };

  /* ---------- eventos ---------- */

  const inicializarEventos = () => {
    // categorías y chips
    document.addEventListener("click", (evento) => {
      const destino = evento.target.closest("[data-filtro]");
      if (destino) {
        evento.preventDefault();
        estado.categoria = destino.dataset.filtro;
        marcarChips();
        pintarProductos();
        if (destino.classList.contains("categoria")) {
          const seccion = $("#productos");
          const suave = !window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches;
          seccion.scrollIntoView({ behavior: suave ? "smooth" : "auto" });
        }
        return;
      }
      if (evento.target.closest("[data-cerrar]")) cerrarFicha();
      if (evento.target === ficha) cerrarFicha();
    });

    // búsqueda
    let temporizador;
    $("#buscar").addEventListener("input", (evento) => {
      clearTimeout(temporizador);
      const valor = evento.target.value;
      temporizador = setTimeout(() => {
        estado.q = valor;
        pintarProductos();
      }, 140);
    });

    // orden
    $("#orden").addEventListener("change", (evento) => {
      estado.orden = evento.target.value;
      pintarProductos();
    });

    // limpiar filtros
    $("#limpiar").addEventListener("click", () => {
      estado.categoria = "todos";
      estado.q = "";
      $("#buscar").value = "";
      $("#orden").value = "recomendado";
      estado.orden = "recomendado";
      marcarChips();
      pintarProductos();
    });

    // ficha desde la URL
    window.addEventListener("hashchange", () => {
      if (/^#p-\d+$/.test(location.hash)) {
        fichaDesdeHash();
      } else if (ficha.open) {
        cerrarFicha();
      }
    });
    ficha.addEventListener("close", () => {
      document.body.classList.remove("sin-scroll");
      if (location.hash.startsWith("#p-")) {
        history.replaceState(null, "", location.pathname + location.search);
      }
    });

    // menú móvil
    const cabecera = $("#cabecera");
    const botonMenu = $(".menu-boton");
    const cerrarMenu = () => {
      cabecera.classList.remove("cabecera--abierta");
      botonMenu.setAttribute("aria-expanded", "false");
      botonMenu.setAttribute("aria-label", "Abrir menú");
    };
    botonMenu.addEventListener("click", () => {
      const abierto = cabecera.classList.toggle("cabecera--abierta");
      botonMenu.setAttribute("aria-expanded", String(abierto));
      botonMenu.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    });
    $$("#menu a").forEach((enlace) =>
      enlace.addEventListener("click", cerrarMenu)
    );
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape") cerrarMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth >= 900) cerrarMenu();
    });

    // sombra de la cabecera
    const alDesplazar = () =>
      cabecera.classList.toggle("pegada", window.scrollY > 6);
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
  };

  /* ---------- arranque ---------- */

  prepararEnlaces();
  pintarCategorias();
  pintarChips();
  pintarProductos();
  inicializarEventos();
  fichaDesdeHash();

  const anio = $("#anio");
  if (anio) anio.textContent = String(new Date().getFullYear());
})();
