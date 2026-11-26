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
  const guardadoMovimiento = (() => {
    try {
      return localStorage.getItem("baruj-movimiento");
    } catch (_) {
      return null;
    }
  })();
  // Las animaciones van siempre activas, sin importar el sistema ni el
  // dispositivo. El botón del pie sigue permitiendo apagarlas a mano.
  let animaciones = guardadoMovimiento !== "no";

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
    const contenedor = $("#lista-categorias");
    if (!contenedor) return;
    contenedor.innerHTML = CATEGORIAS.map(
      (c) => `
      <a class="categoria" href="/productos?categoria=${encodeURIComponent(c.id)}">
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
    const contenedor = $("#chips");
    if (!contenedor) return;
    const opciones = [
      { id: "todos", nombre: "Todos" },
      ...CATEGORIAS.map((c) => ({ id: c.id, nombre: c.nombre })),
    ];
    contenedor.innerHTML = opciones
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
    const contenedor = $("#lista-productos");
    if (!contenedor) return;
    const destacados = Number(contenedor.dataset.destacados || 0);
    const lista = destacados ? PRODUCTOS.slice(0, destacados) : filtrar();
    const vacio = $("#vacio");
    const cuenta = $("#cuenta");

    if (cuenta) {
      cuenta.textContent =
        lista.length === 1 ? "1 producto" : `${lista.length} productos`;
    }
    if (vacio) vacio.hidden = lista.length > 0;
    contenedor.hidden = lista.length === 0;

    contenedor.innerHTML = lista
      .map((p) => {
        const categoria = categoriaPorId[p.categoria]?.nombre || "";
        const precio =
          p.precio == null ? "Precio por WhatsApp" : formatoPrecio.format(p.precio);
        return `
        <div class="producto-marco">
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
          </article>
        </div>`;
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
    if (!ficha) return;
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
      fichaCta.href = "/contacto";
      fichaCta.removeAttribute("target");
      fichaCta.removeAttribute("rel");
      fichaCtaTexto.textContent = "Escríbenos";
      fichaCta.onclick = () => ficha.close();
    }

    if (!ficha.open) ficha.showModal();
    document.body.classList.add("sin-scroll");
  };

  const fichaDesdeHash = () => {
    const coincidencia = location.hash.match(/^#p-(\d+)$/);
    if (coincidencia) abrirFicha(Number(coincidencia[1]));
  };

  /* ---------- eventos ---------- */

  const inicializarEventos = () => {
    const chips = $("#chips");
    if (chips) {
      chips.addEventListener("click", (evento) => {
        const chip = evento.target.closest(".chip");
        if (!chip) return;
        estado.categoria = chip.dataset.filtro;
        marcarChips();
        pintarProductos();
      });
    }

    const buscar = $("#buscar");
    if (buscar) {
      let temporizador;
      buscar.addEventListener("input", (evento) => {
        clearTimeout(temporizador);
        const valor = evento.target.value;
        temporizador = setTimeout(() => {
          estado.q = valor;
          pintarProductos();
        }, 140);
      });
    }

    const orden = $("#orden");
    if (orden) {
      orden.addEventListener("change", (evento) => {
        estado.orden = evento.target.value;
        pintarProductos();
      });
    }

    const limpiar = $("#limpiar");
    if (limpiar) {
      limpiar.addEventListener("click", () => {
        estado.categoria = "todos";
        estado.q = "";
        if (buscar) buscar.value = "";
        if (orden) orden.value = "recomendado";
        estado.orden = "recomendado";
        marcarChips();
        pintarProductos();
      });
    }

    window.addEventListener("hashchange", () => {
      if (/^#p-\d+$/.test(location.hash)) {
        fichaDesdeHash();
      } else if (ficha && ficha.open) {
        ficha.close();
      }
    });

    if (ficha) {
      ficha.addEventListener("close", () => {
        document.body.classList.remove("sin-scroll");
        if (location.hash.startsWith("#p-")) {
          history.replaceState(null, "", location.pathname + location.search);
        }
      });
      ficha.addEventListener("click", (evento) => {
        if (evento.target === ficha) ficha.close();
      });
    }

    document.addEventListener("click", (evento) => {
      if (evento.target.closest("[data-cerrar]") && ficha) ficha.close();
    });

    const cabecera = $("#cabecera");
    const botonMenu = $(".menu-boton");
    if (cabecera && botonMenu) {
      const cerrarMenu = () => {
        cabecera.classList.remove("cabecera--abierta");
        botonMenu.setAttribute("aria-expanded", "false");
        botonMenu.setAttribute("aria-label", "Abrir menú");
      };
      botonMenu.addEventListener("click", () => {
        const abierto = cabecera.classList.toggle("cabecera--abierta");
        botonMenu.setAttribute("aria-expanded", String(abierto));
        botonMenu.setAttribute(
          "aria-label",
          abierto ? "Cerrar menú" : "Abrir menú"
        );
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

      const alDesplazar = () =>
        cabecera.classList.toggle("pegada", window.scrollY > 6);
      alDesplazar();
      window.addEventListener("scroll", alDesplazar, { passive: true });
    }

    const botonMotion = $("#motion");
    if (botonMotion) {
      botonMotion.addEventListener("click", () => {
        aplicarAnimaciones(!animaciones, true);
        if (animaciones) prepararRevelados();
      });
    }
  };

  /* ---------- movimiento ---------- */

  const aplicarAnimaciones = (activo, guardar) => {
    animaciones = activo;
    const raiz = document.documentElement;
    raiz.classList.toggle("motion-on", activo);
    raiz.classList.toggle("motion-off", !activo);
    raiz.classList.toggle("con-motion", activo);
    if (guardar) {
      try {
        localStorage.setItem("baruj-movimiento", activo ? "si" : "no");
      } catch (_) {}
    }
    const boton = $("#motion");
    if (boton) {
      boton.setAttribute("aria-pressed", String(activo));
      boton.textContent = activo ? "Animaciones: sí" : "Animaciones: no";
    }
    if (!activo) {
      $$(".collage").forEach((el) => {
        el.style.setProperty("--rx", "0deg");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--par", "0px");
      });
      $$(".producto").forEach((el) => {
        el.style.setProperty("--px", "0deg");
        el.style.setProperty("--py", "0deg");
      });
    }
  };

  const iniciarProgreso = () => {
    const barra = $("#progreso");
    if (!barra) return;
    let pendiente = false;
    const pintar = () => {
      const altura = document.documentElement.scrollHeight - window.innerHeight;
      const avance =
        altura > 0 ? Math.min(1, Math.max(0, window.scrollY / altura)) : 0;
      barra.style.transform = `scaleX(${avance})`;
      pendiente = false;
    };
    const pedir = () => {
      if (!pendiente) {
        pendiente = true;
        requestAnimationFrame(pintar);
      }
    };
    pintar();
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
  };

  const iniciarCollage = () => {
    const collage = $(".collage");
    const hero = $(".hero");
    if (!collage || !hero) return;
    let rx = 0;
    let ry = 0;
    let par = 0;
    let pendiente = false;
    const pintar = () => {
      collage.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      collage.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      collage.style.setProperty("--par", `${par.toFixed(1)}px`);
      pendiente = false;
    };
    const pedir = () => {
      if (!pendiente) {
        pendiente = true;
        requestAnimationFrame(pintar);
      }
    };
    hero.addEventListener(
      "pointermove",
      (evento) => {
        if (!animaciones) return;
        const r = hero.getBoundingClientRect();
        const x = (evento.clientX - r.left) / r.width - 0.5;
        const y = (evento.clientY - r.top) / r.height - 0.5;
        ry = x * 6;
        rx = -y * 4;
        pedir();
      },
      { passive: true }
    );
    hero.addEventListener("pointerleave", () => {
      if (!animaciones) return;
      rx = 0;
      ry = 0;
      pedir();
    });
    const alScroll = () => {
      if (!animaciones) return;
      const r = collage.getBoundingClientRect();
      par = Math.max(
        -18,
        Math.min(18, (r.top - window.innerHeight / 2) * -0.035)
      );
      pedir();
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
  };

  const iniciarTilt = () => {
    document.addEventListener(
      "pointermove",
      (evento) => {
        if (!animaciones) return;
        const carta = evento.target.closest(".producto");
        if (!carta) return;
        const r = carta.getBoundingClientRect();
        const x = (evento.clientX - r.left) / r.width - 0.5;
        const y = (evento.clientY - r.top) / r.height - 0.5;
        carta.style.setProperty("--py", `${(x * 5).toFixed(2)}deg`);
        carta.style.setProperty("--px", `${(-y * 4).toFixed(2)}deg`);
      },
      { passive: true }
    );
    document.addEventListener(
      "pointerout",
      (evento) => {
        if (!animaciones) return;
        const carta = evento.target.closest(".producto");
        if (!carta) return;
        if (!carta.contains(evento.relatedTarget)) {
          carta.style.setProperty("--py", "0deg");
          carta.style.setProperty("--px", "0deg");
        }
      },
      { passive: true }
    );
  };

  let reveladosListos = false;
  const prepararRevelados = () => {
    if (reveladosListos || !animaciones || !("IntersectionObserver" in window)) {
      return;
    }
    reveladosListos = true;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            entrada.target.classList.add("visible");
            observador.unobserve(entrada.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    const marcar = (el, i = 0) => {
      if (el.dataset.revelar !== undefined) return;
      el.dataset.revelar = "";
      el.style.setProperty("--retraso", `${Math.min(i, 4) * 70}ms`);
      observador.observe(el);
    };
    $$(".seccion__cabecera").forEach((el) => marcar(el));
    $$(".categoria").forEach((el, i) => marcar(el, i));
    $$(".producto-marco").forEach((el, i) => marcar(el, i));
    $$(".pilar").forEach((el, i) => marcar(el, i));
    $$(".opinion").forEach((el, i) => marcar(el, i));
    $$(".contacto__tarjeta").forEach((el, i) => marcar(el, i));
    $$(".marca-bloque__texto, .contacto__texto").forEach((el) => marcar(el));
  };

  /* ---------- arranque ---------- */

  const categoriaInicial = new URLSearchParams(location.search).get("categoria");
  if (
    categoriaInicial &&
    CATEGORIAS.some((c) => c.id === categoriaInicial)
  ) {
    estado.categoria = categoriaInicial;
  }

  prepararEnlaces();
  pintarCategorias();
  pintarChips();
  pintarProductos();
  inicializarEventos();
  fichaDesdeHash();
  aplicarAnimaciones(animaciones, false);
  iniciarProgreso();
  iniciarCollage();
  iniciarTilt();
  prepararRevelados();

  const anio = $("#anio");
  if (anio) anio.textContent = String(new Date().getFullYear());
})();
