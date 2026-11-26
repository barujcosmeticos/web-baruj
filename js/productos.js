/* ==========================================================================
   Datos del catálogo
   --------------------------------------------------------------------------
   Todo lo que se muestra en la página sale de aquí. Cuando se conecte al
   panel de Conecta2, este archivo se reemplaza por la respuesta de la API
   manteniendo los mismos campos: id, nombre, categoria, descripcion,
   icono, precio, etiqueta e imagen.
   ========================================================================== */

const TIENDA = {
  // Número de WhatsApp con indicativo, sin + ni espacios. Ej.: "573001234567"
  whatsapp: "",
  instagram: "",
  tiktok: "",
};

const CATEGORIAS = [
  { id: "belleza", nombre: "Belleza", detalle: "Todo para tu cabello", icono: "tijeras" },
  { id: "unas", nombre: "Uñas", detalle: "Detalles que enamoran", icono: "esmalte" },
  { id: "cosmeticos", nombre: "Cosméticos", detalle: "Resalta tu belleza", icono: "labial" },
  { id: "fibras", nombre: "Fibras premium", detalle: "Calidad profesional", icono: "fibra" },
];

const PRODUCTOS = [
  {
    id: 1,
    nombre: "Secador iónico 2200 W",
    categoria: "belleza",
    icono: "secador",
    descripcion:
      "Secado rápido y parejo con tecnología iónica para reducir el frizz. " +
      "Ideal para uso diario en casa o en el salón.",
    etiqueta: "Más vendido",
    precio: null,
    imagen: null,
  },
  {
    id: 2,
    nombre: "Plancha de cerámica",
    categoria: "belleza",
    icono: "plancha",
    descripcion:
      "Placas de cerámica que deslizan sin maltratar el cabello y dejan un " +
      "acabado liso y brillante.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 3,
    nombre: "Cepillo alisador térmico",
    categoria: "belleza",
    icono: "cepillo",
    descripcion:
      "Cepilla y alisa en un solo paso. Práctico para retoques rápidos y " +
      "para peinados con movimiento.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 4,
    nombre: "Kit de uñas en gel",
    categoria: "unas",
    icono: "kit",
    descripcion:
      "Todo lo necesario para un set de uñas en gel: acabado prolijo y " +
      "larga duración desde la primera aplicación.",
    etiqueta: "Nuevo",
    precio: null,
    imagen: null,
  },
  {
    id: 5,
    nombre: "Esmalte semipermanente",
    categoria: "unas",
    icono: "esmalte",
    descripcion:
      "Color intenso y brillo de salón que se mantiene por semanas sin " +
      "descascararse.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 6,
    nombre: "Labial mate de larga duración",
    categoria: "cosmeticos",
    icono: "labial",
    descripcion:
      "Textura ligera, cobertura total y acabado mate que aguanta el día " +
      "sin resecar los labios.",
    etiqueta: "Más vendido",
    precio: null,
    imagen: null,
  },
  {
    id: 7,
    nombre: "Paleta de sombras nude",
    categoria: "cosmeticos",
    icono: "paleta",
    descripcion:
      "Tonos neutros que combinan entre sí, con pigmentación fácil de " +
      "difuminar para looks de día y de noche.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 8,
    nombre: "Fibra rizada premium",
    categoria: "fibras",
    icono: "fibra",
    descripcion:
      "Fibra de alta calidad para lograr volumen y rizo definido con un " +
      "acabado natural.",
    etiqueta: "Nuevo",
    precio: null,
    imagen: null,
  },
  {
    id: 9,
    nombre: "Fibra lisa premium",
    categoria: "fibras",
    icono: "fibra",
    descripcion:
      "Textura suave y natural para alargar y dar movimiento sin perder " +
      "el brillo del cabello.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 10,
    nombre: "Mascarilla de keratina",
    categoria: "belleza",
    icono: "mascarilla",
    descripcion:
      "Tratamiento profundo que devuelve suavidad y fuerza al cabello " +
      "seco o procesado.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
  {
    id: 11,
    nombre: "Brocha difuminadora",
    categoria: "cosmeticos",
    icono: "brocha",
    descripcion:
      "Cerdas suaves que reparten el producto parejo para un acabado " +
      "difuminado y natural.",
    etiqueta: "",
    precio: null,
    imagen: null,
  },
];
