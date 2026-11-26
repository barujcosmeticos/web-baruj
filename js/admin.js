/* Administración: imagen del inicio y confirmaciones. */
(() => {
  "use strict";

  /* confirmaciones de eliminar */
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (evento) => {
      const texto = form.getAttribute("data-confirm") || "¿Eliminar?";
      if (!window.confirm(texto)) evento.preventDefault();
    });
  });

  const img = document.getElementById("hero-img");
  const vacio = document.getElementById("hero-vacio");
  const archivo = document.getElementById("hero-archivo");
  const archivoNombre = document.getElementById("hero-archivo-nombre");
  const escala = document.getElementById("hero-escala");
  const escalaValor = document.getElementById("hero-escala-valor");
  const aplicar = document.getElementById("hero-aplicar");
  const reset = document.getElementById("hero-reset");
  const quitar = document.getElementById("hero-quitar");
  const estado = document.getElementById("hero-estado");
  const preview = document.getElementById("hero-preview");

  if (!img || !archivo || !escala || !aplicar || !preview) return;

  const MAXIMO = 10 * 1024 * 1024;
  let x = Number(img.dataset.x) || 0;
  let y = Number(img.dataset.y) || 0;
  let nuevo = null;
  let urlNueva = "";

  const limitar = (valor, minimo, maximo) =>
    Math.max(minimo, Math.min(maximo, valor));

  const aviso = (texto) => {
    if (estado) estado.textContent = texto || "";
  };

  const hayImagen = () => !img.hidden && Boolean(img.getAttribute("src"));

  const pintar = () => {
    img.style.setProperty("--escala", String(Number(escala.value) / 100));
    img.style.setProperty("--x", `${x}%`);
    img.style.setProperty("--y", `${y}%`);
    img.dataset.escala = String(Number(escala.value) / 100);
    img.dataset.x = String(x);
    img.dataset.y = String(y);
    if (escalaValor) escalaValor.textContent = `${escala.value}%`;
  };

  const mostrarImagen = (src) => {
    img.src = src;
    img.hidden = false;
    if (vacio) vacio.hidden = true;
  };

  const limpiarNueva = () => {
    if (urlNueva) URL.revokeObjectURL(urlNueva);
    urlNueva = "";
    nuevo = null;
  };

  pintar();

  archivo.addEventListener("change", () => {
    aviso("");
    const file = archivo.files && archivo.files[0];
    if (!file) {
      if (archivoNombre) archivoNombre.textContent = "Ningún archivo";
      return;
    }
    const esPng =
      file.type === "image/png" || /\.png$/i.test(String(file.name || ""));
    if (!esPng || file.size > MAXIMO) {
      aviso("El archivo debe ser un PNG de máximo 10 MB.");
      archivo.value = "";
      if (archivoNombre) archivoNombre.textContent = "Ningún archivo";
      return;
    }
    if (archivoNombre) archivoNombre.textContent = file.name;
    limpiarNueva();
    nuevo = file;
    urlNueva = URL.createObjectURL(file);
    mostrarImagen(urlNueva);
    pintar();
  });

  escala.addEventListener("input", () => {
    pintar();
  });

  reset.addEventListener("click", () => {
    escala.value = "100";
    x = 0;
    y = 0;
    pintar();
    aviso("Vista previa restablecida. Pulsa Aplicar para guardar.");
  });

  let arrastre = null;
  preview.addEventListener("pointerdown", (evento) => {
    if (!hayImagen()) return;
    const rect = preview.getBoundingClientRect();
    arrastre = {
      id: evento.pointerId,
      clientX: evento.clientX,
      clientY: evento.clientY,
      x,
      y,
      ancho: rect.width || 1,
      alto: rect.height || 1,
    };
    preview.setPointerCapture(evento.pointerId);
    evento.preventDefault();
  });

  preview.addEventListener("pointermove", (evento) => {
    if (!arrastre || evento.pointerId !== arrastre.id) return;
    const dx = ((evento.clientX - arrastre.clientX) / arrastre.ancho) * 100;
    const dy = ((evento.clientY - arrastre.clientY) / arrastre.alto) * 100;
    x = limitar(arrastre.x + dx, -50, 50);
    y = limitar(arrastre.y + dy, -50, 50);
    pintar();
  });

  const terminarArrastre = (evento) => {
    if (!arrastre || evento.pointerId !== arrastre.id) return;
    arrastre = null;
    try {
      preview.releasePointerCapture(evento.pointerId);
    } catch (_) {}
  };
  preview.addEventListener("pointerup", terminarArrastre);
  preview.addEventListener("pointercancel", terminarArrastre);

  const guardar = async (respuesta) => {
    let datos = {};
    try {
      datos = await respuesta.json();
    } catch (_) {}
    if (respuesta.ok && datos.ok) {
      window.location.href = "/admin?ok=hero";
      return;
    }
    if (respuesta.status === 401) {
      window.location.href = "/entrar";
      return;
    }
    const mensajes = {
      imagen: "El archivo debe ser un PNG de máximo 10 MB.",
      hero: "No hay una imagen guardada para ajustar.",
      permiso: "No tienes permiso para cambiar esta imagen.",
    };
    aviso(mensajes[datos.error] || "No se pudo guardar la imagen.");
  };

  aplicar.addEventListener("click", async () => {
    if (!hayImagen()) {
      aviso("Selecciona primero un PNG.");
      return;
    }
    aplicar.disabled = true;
    aviso("Guardando…");
    const params = new URLSearchParams({
      escala: String(Number(escala.value) / 100),
      x: String(x),
      y: String(y),
    });
    try {
      const respuesta = nuevo
        ? await fetch(`/admin/hero?${params}`, {
            method: "POST",
            headers: { "Content-Type": "image/png" },
            body: nuevo,
          })
        : await fetch("/admin/hero/ajustar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              escala: Number(escala.value) / 100,
              x,
              y,
            }),
          });
      await guardar(respuesta);
    } catch (_) {
      aviso("No se pudo conectar. Intenta de nuevo.");
    } finally {
      aplicar.disabled = false;
    }
  });

  quitar.addEventListener("click", async () => {
    if (!window.confirm("¿Quitar la imagen? El espacio quedará vacío y los arcos no vuelven.")) {
      return;
    }
    quitar.disabled = true;
    aviso("Quitando…");
    try {
      const respuesta = await fetch("/admin/hero/quitar", { method: "POST" });
      if (respuesta.ok) {
        window.location.href = "/admin?ok=hero-quitada";
        return;
      }
      aviso("No se pudo quitar la imagen.");
    } catch (_) {
      aviso("No se pudo conectar. Intenta de nuevo.");
    } finally {
      quitar.disabled = false;
    }
  });
})();
