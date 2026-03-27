// ============================
// UTILIDADES
// ============================
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }
function escAttr(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const CARDS_JSON_URL = "data/cards.json";
const SETTINGS_KEYS = {
  fontSize: "statux:font-size",
  noHover: "statux:no-hover",
  focusMode: "statux:focus-mode"
};
let notificationTimeoutId = null;


// ============================
// UI NAVEGACIÓN
// ============================
const items = $all(".item");
const navItems = $all(".item");
const sections = $all(".app-section");
let navigationLocked = false;

items.forEach(item => {
  item.addEventListener("click", () => {
    items.forEach(i => i.classList.remove("active"));
    item.classList.add("active");
  });
});

const boton = $(".boton-de-ensanche-de-barra-de-navegacion");
const barra = $(".barra-de-navegacion");
if (boton && barra) {
  boton.addEventListener("click", () => barra.classList.toggle("expandida"));

  document.addEventListener("pointerdown", (e) => {
    if (!barra.classList.contains("expandida")) return;
    const clickedInsideBar = barra.contains(e.target);
    const clickedToggle = boton.contains(e.target);
    if (!clickedInsideBar && !clickedToggle) {
      barra.classList.remove("expandida");
    }
  });
}


function showNavigationLockedModal() {
  mostrarModal(
    "Navegación desactivada",
    "La navegación está desactivada mientras este contenido esté abierto. Sal para continuar.",
    true
  );
}

function mezclarCardsEnSeccion(seccion) {
  if (!seccion) return;
  const contenedores = seccion.querySelectorAll('[class*="contenedor-de-todos-"]');
  contenedores.forEach(container => {
    const cards = Array.from(container.children || []);
    if (cards.length > 1) {
      cards.sort(() => Math.random() - 0.5);
      cards.forEach(card => container.appendChild(card));
    }
  });
}

function updateNavActiveForSection(id) {
  navItems.forEach(item => {
    const href = item.getAttribute("href") || "";
    const targetId = href.replace("#", "");
    if (targetId === id) item.classList.add("active");
    else item.classList.remove("active");
  });
}

function showSection(id) {
  sections.forEach(section => section.classList.remove("active-section"));
  const target = document.getElementById(id);
  if (target) {
    target.classList.add("active-section");
    mezclarCardsEnSeccion(target);
  }
  updateNavActiveForSection(id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navigateInternalLink(anchor, absoluteUrl) {
  const href = (anchor.getAttribute("href") || "").trim();
  if (href.startsWith("#") && href.length > 1) {
    const targetId = href.slice(1);
    if (navigationLocked) {
      showNavigationLockedModal();
      return;
    }

    showSection(targetId);
    return;
  }

  window.location.assign(absoluteUrl.href);
}

document.addEventListener("click", (e) => {
  const anchor = e.target.closest("a");
  if (!anchor) return;

  const href = (anchor.getAttribute("href") || "").trim();
  if (!href || href === "#" || href.startsWith("javascript:")) return;
  if (href.includes("gumroad.com/l/")) return;

  let url;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch (_) {
    return;
  }

  if (url.origin !== window.location.origin) return;

  e.preventDefault();
  navigateInternalLink(anchor, url);
});

showSection("Home");

// ============================
// RENDER DINÁMICO DESDE JSON
// ============================
function buildEbootuxLikeCard(product) {
  const blocks = Array.isArray(product.blocks) ? product.blocks : [];
  const hasCode = Boolean((product.code || "").trim());
  const lockIcon = getLockIconByCode(product.code);
  const buyLink = (product.link || "").trim();
  const priceText = formatPriceText(product.price);

  const blockData = blocks.map((b, i) => {
    const n = i + 1;
    return `
      data-block${n}-title="${escAttr(b.title || "")}" 
      data-block${n}-text1="${escAttr(b.text1 || "")}" 
      data-block${n}-text2="${escAttr(b.text2 || "")}" 
      data-block${n}-text3="${escAttr(b.text3 || "")}" 
      data-block${n}-text4="${escAttr(b.text4 || "")}" 
      data-block${n}-text5="${escAttr(b.text5 || "")}" 
      data-block${n}-img="${escAttr(b.img || "")}" 
      data-block${n}-video="${escAttr(b.video || "")}"`;
  }).join(" ");

  return `
    <article class="ebootux-cards"
      data-ebootux-title="${escAttr(product.title || "")}" 
      data-ebootux-subtitle="${escAttr(product.subtitle || "")}" 
      data-code="${escAttr(product.code || "")}" 
      data-course-url="${escAttr(product.courseUrl || "")}"
      ${blockData}>

      <header class="header-ebootux-cards">
        <img src="${escAttr(product.image || "Statux-logo(SVG).svg")}" alt="${escAttr(product.title || "Producto")}">
      </header>

      <div class="contenedor-de-codigo">
        <h3>${escAttr(product.title || "Producto")}</h3>
        <img src="${escAttr(lockIcon)}" alt="estado de acceso">
        ${hasCode ? `<input type="password" class="input-codigo-ebootux" placeholder="Ingresa el código...">` : ""}
        <button class="btn-acceder-ebootux" type="button">Entrar</button>
      </div>

      <div class="contenedor-de-btn-de-compra">
        <a href="#" class="btn-de-vista-previa"
          data-title="${escAttr(product.title || "")}" 
          data-price="${escAttr(product.price || "")}" 
          data-image="${escAttr(product.image || "")}" 
          data-description="${escAttr(product.description || "")}" 
          data-yes="${escAttr(product.yes || "")}" 
          data-no="${escAttr(product.no || "")}" 
          data-link="${escAttr(product.link || "")}">
          <img src="visibility_24dp_777777_FILL0_wght400_GRAD0_opsz24.svg" class="img-de-vista-previa" alt="vista previa">
        </a>
        <a href="${escAttr(buyLink || "#")}" class="btn-de-compra btn-comprar" data-link="${escAttr(buyLink)}" data-price="${escAttr(product.price || "")}">
          <img src="shopping_cart_24dp_777777.svg" class="img-de-carrito-de-compra" alt="comprar">${priceText ? escAttr(priceText) : ""}
        </a>
      </div>
    </article>
  `;
}

function buildAssetCard(product) {
  const kind = (product.type || "").toLowerCase();
  const isMovitux = kind === "movitux";
  const hasCode = Boolean((product.code || "").trim());
  const lockIcon = getLockIconByCode(product.code);
  const buyLink = (product.link || "").trim();
  const priceText = formatPriceText(product.price);

  return `
    <article class="plantitux-cards ${isMovitux ? "movitux-cards" : ""}"
      data-title="${escAttr(product.title || "")}" 
      data-preview-img="${escAttr(product.image || "")}" 
      data-preview-video="${escAttr(product.previewVideo || "")}" 
      data-prompt="${escAttr(product.prompt || "")}" 
      data-code="${escAttr(product.code || "")}" 
      data-price="${escAttr(product.price || "")}"
      data-link="${escAttr(buyLink)}">

      <header class="header-plantitux-cards">
        <img src="${escAttr(product.image || "Statux-logo(SVG).svg")}" alt="${escAttr(product.title || "Plantitux")}">
      </header>

      <div class="contenedor-de-codigo">
        <h3>${escAttr(product.title || (isMovitux ? "Movitux" : "Plantitux"))}</h3>
        <img src="${escAttr(lockIcon)}" alt="estado de acceso">
        ${hasCode ? `<input type="password" class="input-codigo-plantitux" placeholder="Ingresa tu código...">` : ""}
        <button class="btn-acceder-plantitux" type="button">Entrar</button>
      </div>

      <div class="contenedor-de-btn-de-compra">
        <a href="#" class="btn-de-vista-previa-plantitux">
          <img src="visibility_24dp_777777_FILL0_wght400_GRAD0_opsz24.svg" class="img-de-vista-previa" alt="vista previa">
        </a>
        <a href="${escAttr(buyLink || "#")}" class="btn-de-compra btn-comprar" data-link="${escAttr(buyLink)}" data-price="${escAttr(product.price || "")}">
          <img src="shopping_cart_24dp_777777.svg" class="img-de-carrito-de-compra" alt="comprar">${priceText ? escAttr(priceText) : ""}
        </a>
      </div>
    </article>
  `;
}

function sectionContainer(section) {
  return $(`.contenedor-de-todos-los-${section}`) || $(`[data-json-section="${section}"]`);
}

function renderProducts(products) {
  const knownSections = ["ebootux", "getux", "plantitux", "movitux"];
  knownSections.forEach((section) => {
    const container = sectionContainer(section);
    if (container) container.innerHTML = "";
  });

  const bySection = products.reduce((acc, p) => {
    const sec = (p.section || "").toLowerCase();
    if (!sec) return acc;
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(p);
    return acc;
  }, {});

  Object.entries(bySection).forEach(([section, list]) => {
    const container = sectionContainer(section);
    if (!container) return;

    container.innerHTML = list.map(product => {
      const type = (product.type || "").toLowerCase();
      if (type === "plantitux" || type === "movitux") return buildAssetCard(product);
      return buildEbootuxLikeCard(product);
    }).join("\n");
  });

}


function normalizarProductsDesdeJSON(json) {
  const normalizeProduct = (p, fallbackCategory = "") => {
    if (!p || typeof p !== "object") return null;
    const normalizedType = String((p.type || p.section || fallbackCategory || "")).toLowerCase();
    const normalizedSection = String((p.section || p.type || fallbackCategory || "")).toLowerCase();
    if (!normalizedType || !normalizedSection) return null;
    return { ...p, type: normalizedType, section: normalizedSection };
  };

  const out = [];

  // Formato 1: array directo
  if (Array.isArray(json)) {
    json.forEach((p) => {
      const n = normalizeProduct(p);
      if (n) out.push(n);
    });
    return out;
  }

  // Formato 2: { products: [...] }
  if (Array.isArray(json?.products)) {
    json.products.forEach((p) => {
      const n = normalizeProduct(p);
      if (n) out.push(n);
    });
    return out;
  }

  // Formato 3: { products: { categoria: [...] } }
  if (json?.products && typeof json.products === "object") {
    Object.entries(json.products).forEach(([category, arr]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        const n = normalizeProduct(item, category);
        if (n) out.push(n);
      });
    });
    if (out.length) return out;
  }

  // Formato 4: { categoria: [...] }
  if (json && typeof json === "object") {
    Object.entries(json).forEach(([category, arr]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        const n = normalizeProduct(item, category);
        if (n) out.push(n);
      });
    });
  }

  return out;
}

function isFreeProduct(price) {
  const raw = String(price || "").trim().toLowerCase();
  if (!raw) return false;
  return raw.includes("gratis") || raw === "0" || raw === "0.00" || raw === "$0" || raw === "$0.00";
}

function getLockIconByCode(code) {
  return String(code || "").trim()
    ? "candado.svg"
    : "iconos/lock_open_right_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg";
}

function formatPriceText(price) {
  const raw = String(price || "").trim();
  if (!raw) return "Gratis";
  return raw;
}

async function fetchAndRenderCards() {
  const cacheBuster = `v=${Date.now()}`;
  const candidates = [`${CARDS_JSON_URL}?${cacheBuster}`, `/${CARDS_JSON_URL}?${cacheBuster}`, CARDS_JSON_URL, `/${CARDS_JSON_URL}`];
  let lastError = null;
  const knownSections = ["ebootux", "getux", "plantitux", "movitux"];
  const showLoaders = () => {
    knownSections.forEach((section) => {
      const container = sectionContainer(section);
      if (!container) return;
      container.classList.add("json-loading");
      container.innerHTML = `<div class="loader loader--draw">
        <svg viewBox="0 0 500 500" aria-hidden="true" focusable="false">
          <path class="statux-path" d="M225.999908,329.843475 C208.754364,329.843475 192.008804,329.843475 174.326538,329.843475 C183.611938,341.056976 192.271851,351.515106 201.261032,362.370880 C198.201035,364.906006 195.220856,367.375000 191.866653,370.153839 C162.266953,334.482910 132.839920,299.020081 103.021248,263.085266 C106.050591,260.508453 109.014664,257.987183 112.288124,255.202759 C123.075844,268.182800 133.683395,280.943848 144.288391,293.707062 C150.143509,300.753723 155.873627,307.910797 161.941696,314.768921 C163.266907,316.266693 165.789505,317.506073 167.764267,317.511322 C222.420624,317.657349 277.077484,317.644531 331.734070,317.558258 C333.576935,317.555359 335.885620,317.044189 337.189117,315.884308 C353.355225,301.499847 369.375000,286.950897 385.765564,272.143280 C384.529877,271.209564 383.585388,270.391602 382.544098,269.724823 C368.535309,260.754486 354.548309,251.748917 340.451202,242.919220 C338.612091,241.767288 336.192261,240.988205 334.037231,240.978699 C305.376312,240.852310 276.714447,240.848129 248.053604,240.980316 C245.716446,240.991104 243.135544,241.783005 241.090210,242.951279 C224.796158,252.258209 208.604172,261.743835 192.237350,271.258118 C154.250488,236.330368 116.254845,201.394531 77.970634,166.193390 C80.767830,163.147354 83.423027,160.255966 86.187958,157.245056 C95.312439,165.605209 104.133522,173.687347 113.192673,181.987640 C139.652328,158.549835 165.922913,135.279526 192.507385,111.731171 C195.126694,114.674324 197.713943,117.581436 200.576889,120.798340 C193.693237,126.946930 186.950073,132.970047 179.546585,139.582977 C225.233124,139.582977 269.891693,139.582977 316.079834,139.582977 C305.787048,133.226379 296.696075,127.611984 287.241547,121.773094 C289.378204,118.239273 291.391663,114.909187 293.531769,111.369659 C323.998322,130.067764 354.320984,148.677551 384.869934,167.426239 C382.716797,170.945099 380.661011,174.304886 378.509949,177.820343 C365.633148,169.905273 352.947998,161.983688 340.103790,154.329025 C337.825287,152.971115 334.886292,152.067215 332.249664,152.060959 C278.093140,151.932190 223.936127,151.926331 169.779755,152.085236 C167.281876,152.092560 164.276749,153.270981 162.376389,154.910614 C149.017395,166.436722 135.886520,178.227234 122.291122,190.280457 C124.253517,192.145004 125.982010,193.833664 127.759735,195.468811 C138.674179,205.507919 149.487091,215.663086 160.621109,225.452835 C162.729492,227.306671 166.117020,228.585266 168.931488,228.617218 C191.257889,228.870651 213.589355,228.856125 235.916687,228.646942 C239.058304,228.617493 242.523361,227.688934 245.263626,226.151535 C259.913574,217.932327 274.475555,209.543991 288.845490,200.846649 C292.481537,198.645935 294.928314,199.068649 298.237244,201.202606 C328.990509,221.035446 359.838196,240.721878 390.662048,260.445282 C392.184418,261.419434 393.739471,262.342529 395.423279,263.377930 C404.486969,255.199051 413.382843,247.171646 422.686096,238.776596 C425.335449,241.677872 427.970490,244.563492 430.894501,247.765564 C385.515686,288.799805 340.207825,329.769928 294.767517,370.859802 C291.938629,367.680725 289.408600,364.837463 286.673309,361.763519 C298.251312,351.268311 309.629120,340.954590 321.886566,329.843475 C289.317291,329.843475 257.908600,329.843475 225.999908,329.843475 Z"></path>
        </svg>
      </div>`;
    });
  };
  const hideLoaders = () => {
    knownSections.forEach((section) => {
      const container = sectionContainer(section);
      if (!container) return;
      container.classList.remove("json-loading");
    });
  };

  showLoaders();

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`no-data:${res.status}`);

      const raw = await res.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch (parseError) {
        console.error("cards.json inválido:", parseError);
        mostrarModal(
          "Error en cards.json",
          "Hay un error de sintaxis en data/cards.json. Revisa comas, comillas y puntos extra (por ejemplo: previewVideo con un punto extra al final)."
        );
        throw parseError;
      }

      const products = normalizarProductsDesdeJSON(json);
      if (!Array.isArray(products) || products.length === 0) throw new Error("invalid-json");
      renderProducts(products);
      hideLoaders();
      return;
    } catch (err) {
      lastError = err;
    }
  }

  hideLoaders();
  console.info("cards.json no disponible; se usan cards estáticas si existen.", lastError);
}

// ============================
// MODAL PREVIEW GENÉRICO
// ============================
const previewModal = $("#preview-modal");
const previewTitle = previewModal?.querySelector(".head-box h2");
const previewImage = previewModal?.querySelector(".preview-multimedia");
const previewYes = previewModal?.querySelector(".preview-si");
const previewNo = previewModal?.querySelector(".preview-no");
const previewBuyBtn = previewModal?.querySelector(".btn-de-compra");
const previewDescription = previewModal?.querySelector(".preview-description");

if (previewModal) {
  const closeBtn = previewModal.querySelector(".logout-btn");
  if (closeBtn) closeBtn.addEventListener("click", () => previewModal.classList.remove("active"));
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-de-vista-previa");
  if (!btn) return;
  e.preventDefault();
  if (!previewModal) return;

  const title = btn.dataset.title || "";
  const price = btn.dataset.price || "";
  const image = btn.dataset.image || "";
  const description = btn.dataset.description || "";
  const yesList = (btn.dataset.yes || "").split(",");
  const noList = (btn.dataset.no || "").split(",");
  const link = btn.dataset.link || "#";

  if (previewTitle) previewTitle.textContent = title;
  if (previewImage) previewImage.src = image;
  if (previewDescription) previewDescription.textContent = description;

  if (previewBuyBtn) {
    const priceText = formatPriceText(price);
    previewBuyBtn.innerHTML = `<img src="shopping_cart_24dp_777777.svg" class="img-de-carrito-de-compra"/>${priceText ? `$${escAttr(priceText)}` : ""}`;
    previewBuyBtn.href = link;
    previewBuyBtn.target = "_self";
  }

  if (previewYes) {
    previewYes.innerHTML = "";
    yesList.forEach(item => {
      if (!item.trim()) return;
      const li = document.createElement("li");
      li.textContent = item.trim();
      previewYes.appendChild(li);
    });
  }

  if (previewNo) {
    previewNo.innerHTML = "";
    noList.forEach(item => {
      if (!item.trim()) return;
      const li = document.createElement("li");
      li.textContent = item.trim();
      previewNo.appendChild(li);
    });
  }

  previewModal.classList.add("active");
});

// ============================
// PREVIEW PLANTITUX
// ============================
const plantituxPreviewModal = $("#plantitux-preview-modal");
const plantituxPreviewImg = $("#plantitux-preview-img");
const plantituxPreviewVideo = $("#plantitux-preview-video");
const plantituxPreviewTitle = $("#plantitux-preview-title");
const plantituxPreviewBuy = $("#plantitux-preview-buy");
const plantituxPreviewClose = $("#plantitux-preview-close");
if (plantituxPreviewClose && plantituxPreviewModal) {
  plantituxPreviewClose.addEventListener("click", () => plantituxPreviewModal.classList.remove("active"));
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-de-vista-previa-plantitux");
  if (!btn) return;
  e.preventDefault();

  const card = btn.closest(".plantitux-cards");
  if (!card || !plantituxPreviewModal) return;

  const img = card.dataset.previewImg || "";
  const video = card.dataset.previewVideo || "";
  const title = card.dataset.title || "";
  const price = card.dataset.price || "";
  const link = card.dataset.link || "#";

  if (plantituxPreviewTitle) plantituxPreviewTitle.textContent = title;

  if (video && plantituxPreviewVideo) {
    plantituxPreviewVideo.src = video;
    plantituxPreviewVideo.classList.remove("hidden");
    if (plantituxPreviewImg) plantituxPreviewImg.classList.add("hidden");
  } else if (plantituxPreviewImg) {
    plantituxPreviewImg.src = img;
    plantituxPreviewImg.classList.remove("hidden");
    if (plantituxPreviewVideo) plantituxPreviewVideo.classList.add("hidden");
  }

  if (plantituxPreviewBuy) {
    const priceText = formatPriceText(price);
    plantituxPreviewBuy.innerHTML = `<img src="shopping_cart_24dp_777777.svg" class="img-de-carrito-de-compra"/>${priceText ? `$${escAttr(priceText)}` : ""}`;
    plantituxPreviewBuy.href = link;
    plantituxPreviewBuy.target = "_self";
  }

  plantituxPreviewModal.classList.add("active");
});

// ============================
// BUSCADOR POR SECCIÓN
// ============================
$all(".buscador-seccion").forEach(buscador => {
  const section = buscador.closest(".app-section");
  if (!section) return;

  let selector = ".ebootux-cards, .plantitux-cards, .tracktux-cards, .mindtux-cards, .soundtux-cards, .movitux-cards";
  switch ((section.id || "").toLowerCase()) {
    case "ebootux":
    case "getux":
      selector = ".ebootux-cards";
      break;
    case "movitux":
      selector = ".movitux-cards";
      break;
    case "plantitux":
      selector = ".plantitux-cards";
      break;
  }

  let emptyMsg = section.querySelector(".mensaje-vacio");
  if (!emptyMsg) {
    emptyMsg = document.createElement("p");
    emptyMsg.className = "mensaje-vacio";
    emptyMsg.textContent = "No hay coincidencias con ese nombre.";
    emptyMsg.style.display = "none";
    section.appendChild(emptyMsg);
  }

  buscador.addEventListener("input", () => {
    const cards = section.querySelectorAll(selector);
    const texto = buscador.value.toLowerCase().trim();
    let encontrados = 0;

    cards.forEach(card => {
      const titulo = card.querySelector("h3")?.textContent.toLowerCase() || "";
      const match = titulo.includes(texto);
      card.style.display = match ? "flex" : "none";
      if (match) encontrados++;
    });

    emptyMsg.style.display = encontrados === 0 ? "block" : "none";
  });
});

// ===============================
// MODAL MENSAJES
// ===============================
function mostrarModal(titulo, mensaje) {
  const modal = document.getElementById("modal-ebootux");
  const modalTitle = document.getElementById("modal-ebootux-title");
  const modalMessage = document.getElementById("modal-ebootux-message");
  const modalContent = modal?.querySelector(".modal-ebootux-content");

  if (!modal || !modalTitle || !modalMessage || !modalContent) {
    try { alert(`${titulo}

${mensaje}`); } catch (_) {}
    return;
  }

  const closeNow = () => {
    modal.classList.add("hidden");
    modalContent.removeEventListener("pointerdown", stopNotificationClose);
    modal.removeEventListener("pointerdown", closeNotificationByOverlay);
    if (notificationTimeoutId) {
      clearTimeout(notificationTimeoutId);
      notificationTimeoutId = null;
    }
  };

  const stopNotificationClose = (ev) => ev.stopPropagation();
  const closeNotificationByOverlay = () => closeNow();

  if (notificationTimeoutId) {
    clearTimeout(notificationTimeoutId);
    notificationTimeoutId = null;
  }

  modalTitle.textContent = titulo;
  modalMessage.textContent = mensaje;
  modal.classList.remove("hidden");

  modalContent.addEventListener("pointerdown", stopNotificationClose);
  modal.addEventListener("pointerdown", closeNotificationByOverlay);

  notificationTimeoutId = setTimeout(() => {
    closeNow();
  }, 6500);
}


function openPurchaseLink(link) {
  const normalizedLink = String(link || "").trim();
  if (!normalizedLink || normalizedLink === "#") {
    mostrarModal(
      "Card no disponible",
      "Estamos trabajando en ello 😁"
    );
    return;
  }

  window.location.assign(normalizedLink);
}

// ===============================
// ACCESO + EBOOTUX
// ===============================
document.addEventListener("click", function (e) {
  const ebootuxAccessBtn = e.target.closest(".btn-acceder-ebootux");
  if (ebootuxAccessBtn) {
    const card = ebootuxAccessBtn.closest(".ebootux-cards");
    if (!card) return;

    const input = card.querySelector(".input-codigo-ebootux");
    const plantilla = document.querySelector(".ebootux-template");
    if (!plantilla) return;

    const codigoCorrecto = (card.dataset.code || "").trim();
    const codigoIngresado = (input?.value || "").trim();
    const accesoLibre = !codigoCorrecto || isFreeProduct(card.dataset.price);
    const codigoValido = accesoLibre || codigoIngresado === codigoCorrecto;

    if (codigoValido) {
      stxRuntime.saveUnlockedCodeFromCard(card, "ebootux", codigoCorrecto);

      const courseUrl = card.dataset.courseUrl || "";
      if (courseUrl) {
        window.location.href = courseUrl;
        return;
      }

      cargarEbootuxDesdeCard(card);
      plantilla.classList.remove("hidden");
      entrarEnEbootux();
    } else {
      mostrarModal("Código incorrecto ❌", "Verifica tu código e inténtalo de nuevo.");
      if (input) {
        input.value = "";
        input.focus();
      }
    }
  }

  const assetAccessBtn = e.target.closest(".btn-acceder-plantitux");
  if (assetAccessBtn) {
    const card = assetAccessBtn.closest(".plantitux-cards, .movitux-cards");
    if (!card) return;

    const input = card.querySelector(".input-codigo-plantitux");
    const codigoCorrecto = (card.dataset.code || "").trim();
    const codigoIngresado = (input?.value || "").trim();
    const accesoLibre = !codigoCorrecto || isFreeProduct(card.dataset.price);
    const codigoValido = accesoLibre || codigoIngresado === codigoCorrecto;

    if (codigoValido) {
      stxRuntime.saveUnlockedCodeFromCard(card, "plantitux", codigoCorrecto);
      abrirPromptDesdeCard(card);
    } else {
      mostrarModal("Código incorrecto ❌", "Verifica tu código e inténtalo de nuevo.");
      if (input) {
        input.value = "";
        input.focus();
      }
    }
  }

  const buyBtn = e.target.closest(".btn-comprar");
  if (buyBtn) {
    const card = buyBtn.closest(".ebootux-cards, .plantitux-cards, .movitux-cards");
    if (!card) return;

    const link = (buyBtn.dataset.link || card.dataset.link || "").trim();
    if (link.includes("gumroad.com/l/")) return;

    e.preventDefault();

    const rawPrice = String(buyBtn.dataset.price || card.dataset.price || "").trim();
    if (!rawPrice) {
      const enterBtn = card.querySelector(".btn-acceder-ebootux, .btn-acceder-plantitux");
      if (enterBtn) {
        enterBtn.click();
        return;
      }
    }

    openPurchaseLink(link);
    return;
  }


  if (e.target.closest(".ebootux-exit-btn")) {
    const ebootux = document.querySelector(".ebootux-template");
    if (!ebootux) return;

    ebootux.classList.add("hidden");
    ebootux.classList.remove("active");
    navigationLocked = false;
    toggleFooterVisibility(true);
    showSection("Home");
  }
});

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function setFontSize(value) {
  const numeric = Math.max(14, Math.min(22, Number(value) || 20));
  document.body.style.setProperty("--statux-font", `${numeric}px`);
  const valueEl = document.getElementById("font-size-value");
  const slider = document.getElementById("font-size-control");
  if (valueEl) valueEl.textContent = `${numeric}px`;
  if (slider && String(slider.value) !== String(numeric)) slider.value = String(numeric);
  localStorage.setItem(SETTINGS_KEYS.fontSize, String(numeric));
}

function applyNoHoverState(active) {
  document.body.classList.toggle("no-hover", Boolean(active));
  localStorage.setItem(SETTINGS_KEYS.noHover, active ? "1" : "0");
}

function applyFocusModeState(active) {
  document.body.classList.toggle("focus-mode", Boolean(active));
  localStorage.setItem(SETTINGS_KEYS.focusMode, active ? "1" : "0");
}

function setSwitchState(switchEl, active) {
  if (!switchEl) return;
  switchEl.classList.toggle("active", Boolean(active));
  switchEl.setAttribute("aria-checked", active ? "true" : "false");
}

function enableSwitch(switchEl, onToggle) {
  if (!switchEl) return;
  const toggle = () => {
    const active = !switchEl.classList.contains("active");
    setSwitchState(switchEl, active);
    onToggle(active);
  };
  switchEl.addEventListener("click", toggle);
  switchEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  });
}

function initSettingsSystem() {
  const fab = document.getElementById("settings-fab");
  const overlay = document.getElementById("settings-overlay");
  const modal = overlay?.querySelector(".setting-modal");
  const fontSlider = document.getElementById("font-size-control");
  const hoverSwitch = document.getElementById("hover-switch");
  const focusSwitch = document.getElementById("focus-switch");
  const refreshBtn = document.getElementById("settings-refresh-btn");
  const codesBtn = document.getElementById("settings-codes-btn");
  const clearBtn = document.getElementById("settings-clear-btn");

  if (!fab || !overlay || !modal) return;

  const openSettings = () => {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  };

  const closeSettings = () => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  };

  fab.addEventListener("click", openSettings);
  overlay.addEventListener("click", closeSettings);
  modal.addEventListener("click", (e) => e.stopPropagation());

  if (fontSlider) {
    const saved = Number(localStorage.getItem(SETTINGS_KEYS.fontSize) || 20);
    setFontSize(saved);
    fontSlider.addEventListener("input", () => setFontSize(fontSlider.value));
  }

  const touch = isTouchDevice();
  const savedNoHover = localStorage.getItem(SETTINGS_KEYS.noHover) === "1";
  const noHoverActive = touch || savedNoHover;
  setSwitchState(hoverSwitch, noHoverActive);
  applyNoHoverState(noHoverActive);

  const focusActive = localStorage.getItem(SETTINGS_KEYS.focusMode) === "1";
  setSwitchState(focusSwitch, focusActive);
  applyFocusModeState(focusActive);

  enableSwitch(hoverSwitch, applyNoHoverState);
  enableSwitch(focusSwitch, applyFocusModeState);

  refreshBtn?.addEventListener("click", () => window.location.reload());
  codesBtn?.addEventListener("click", () => mostrarModal("Codes", "Funcionalidad en construcción (Parte 2)."));
  clearBtn?.addEventListener("click", () => {
    const ok = window.confirm("¿Seguro que quieres borrar los datos de Statux?");
    if (!ok) return;

    Object.values(SETTINGS_KEYS).forEach((key) => localStorage.removeItem(key));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.toLowerCase().includes("statux")) {
        localStorage.removeItem(key);
      }
    }

    mostrarModal("Datos borrados", "Los ajustes de Statux se limpiaron correctamente.");
  });
}

function markBodyLoaded() {
  document.body.classList.add("loaded");
}

if (document.readyState !== "loading") {
  markBodyLoaded();
} else {
  document.addEventListener("DOMContentLoaded", markBodyLoaded, { once: true });
}
window.addEventListener("load", markBodyLoaded, { once: true });

function cargarEbootuxDesdeCard(card) {
  const ebootux = document.querySelector(".ebootux-template");
  const content = document.getElementById("ebootux-content");
  const template = document.getElementById("ebootux-block-template");

  if (!ebootux || !content || !template || !card) return;

  const h1 = ebootux.querySelector("[data-ebootux-h1]");
  const subtitle = ebootux.querySelector("[data-ebootux-subtitle]");

  if (h1) h1.textContent = card.dataset.ebootuxTitle || "";
  if (subtitle) subtitle.textContent = card.dataset.ebootuxSubtitle || "";

  content.innerHTML = "";

  const blockNumbers = Object.keys(card.dataset)
    .map(key => {
      const match = key.match(/^block(\d+)(Title|Text1|Text2|Text3|Text4|Text5|Img|Video)$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(n => n !== null);

  const totalBlocks = blockNumbers.length ? Math.max(...blockNumbers) : 0;

  for (let i = 1; i <= totalBlocks; i++) {
    const clone = template.content.cloneNode(true);
    const title = card.dataset[`block${i}Title`];
    const text1 = card.dataset[`block${i}Text1`];
    const text2 = card.dataset[`block${i}Text2`];
    const text3 = card.dataset[`block${i}Text3`];
    const text4 = card.dataset[`block${i}Text4`];
    const text5 = card.dataset[`block${i}Text5`];
    const img = card.dataset[`block${i}Img`];
    const video = card.dataset[`block${i}Video`];

    const h2 = clone.querySelector("[data-block-title]");
    const pTags = clone.querySelectorAll("[data-block-text]");
    const mediaContainer = clone.querySelector("[data-media-container]");
    const imgTag = clone.querySelector("[data-media-img]");
    const videoTag = clone.querySelector("[data-media-video]");

    if (h2) {
      if (title) { h2.textContent = title; h2.style.display = "block"; }
      else { h2.style.display = "none"; }
    }

    const textos = [text1, text2, text3, text4, text5];
    pTags.forEach((p, idx) => {
      if (textos[idx]) {
        p.innerHTML = textos[idx].replace(/\n/g, "<br>");
        p.style.display = "block";
      } else {
        p.style.display = "none";
      }
    });

    let hayMedia = false;

    if (imgTag && img) {
      imgTag.src = img;
      imgTag.style.display = "block";
      hayMedia = true;
    } else if (imgTag) {
      imgTag.style.display = "none";
    }

    if (videoTag && video) {
      videoTag.src = video;
      videoTag.style.display = "block";
      hayMedia = true;
    } else if (videoTag) {
      videoTag.style.display = "none";
    }

    if (mediaContainer) mediaContainer.hidden = !hayMedia;
    content.appendChild(clone);
  }
}

function toggleFooterVisibility(show) {
  const footer = document.querySelector("footer");
  if (!footer) return;
  footer.style.display = show ? "" : "none";
}

function entrarEnEbootux() {
  const ebootux = document.querySelector(".ebootux-template");
  const appSections = document.querySelectorAll(".app-section");

  appSections.forEach(section => section.classList.remove("active-section"));
  navItems.forEach(item => item.classList.remove("active"));

  if (ebootux) {
    ebootux.classList.remove("hidden");
    ebootux.classList.add("active");
  }

  navigationLocked = true;
  toggleFooterVisibility(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ===============================
// PROMPT PLANTITUX
// ===============================
const promptModal = document.getElementById("prompt-modal");
const promptTextarea = document.getElementById("prompt-textarea");
const promptClose = document.getElementById("prompt-modal-close");
const copyPromptBtn = document.getElementById("copy-prompt-btn");
const miniModal = document.querySelector(".mini-modal");
const downloadReferenceBtn = document.getElementById("download-reference-btn");
let _copyTimeoutId = null;

function createInlineCheckIcon() {
  const span = document.createElement("span");
  span.className = "icon-check";
  span.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="none" fill="#00ffdd"/>
      <path d="M7 12.5L10 15.5L17 8.5" stroke="#012" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  span.style.display = "none";
  return span;
}

function resetCopyButtonState() {
  if (!copyPromptBtn) return;
  copyPromptBtn.classList.remove("copied");

  const iconCopy = copyPromptBtn.querySelector(".icon-copy");
  if (iconCopy) iconCopy.style.display = "inline-block";

  const iconCheckImg = copyPromptBtn.querySelector("img.icon-check");
  if (iconCheckImg) iconCheckImg.style.display = "none";

  const inlineCheck = copyPromptBtn.querySelector(".icon-check:not(img)");
  if (inlineCheck) inlineCheck.style.display = "none";


  if (_copyTimeoutId) {
    clearTimeout(_copyTimeoutId);
    _copyTimeoutId = null;
  }
}

function abrirPromptDesdeCard(card) {
  const prompt = card.dataset.copyText || card.dataset.prompt || card.dataset.link || "";
  if (!promptModal || !promptTextarea) return;

  promptTextarea.value = prompt;

  const modalTitle = promptModal.querySelector(".head-box h2");
  if (modalTitle) {
    const isMovitux = card.classList.contains("movitux-cards");
    modalTitle.textContent = isMovitux ? "Prompt Movitux" : "Prompt Plantitux";
  }
  if (downloadReferenceBtn) {
    const imageUrl = card.dataset.previewImg || "";
    downloadReferenceBtn.href = imageUrl || "#";
    const fileName = (card.dataset.title || "referencia").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".jpg";
    downloadReferenceBtn.setAttribute("download", fileName);
  }

  if (copyPromptBtn) {
    let iconCopy = copyPromptBtn.querySelector(".icon-copy");
    if (!iconCopy) {
      iconCopy = document.createElement("span");
      iconCopy.className = "icon-copy";
      iconCopy.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="9" width="9" height="9" fill="#777" rx="1"/>
          <rect x="6" y="6" width="9" height="9" fill="#222" rx="1" opacity="0.9"/>
        </svg>
      `;
      copyPromptBtn.insertBefore(iconCopy, copyPromptBtn.firstChild);
    }

    const iconCheckImg = copyPromptBtn.querySelector("img.icon-check");
    const inlineCheck = copyPromptBtn.querySelector(".icon-check:not(img)");
    if (!iconCheckImg && !inlineCheck) {
      const created = createInlineCheckIcon();
      copyPromptBtn.appendChild(created);
    }

    resetCopyButtonState();
  }

  promptModal.classList.add("active");
  if (miniModal) miniModal.style.height = miniModal.scrollHeight + "px";
}

if (promptClose) {
  promptClose.addEventListener("click", () => {
    if (promptModal) promptModal.classList.remove("active");
    resetCopyButtonState();
  });
}

if (copyPromptBtn && promptTextarea) {
  copyPromptBtn.addEventListener("click", () => {
    const prompt = promptTextarea.value || "";

    const doCopiedUI = () => {
      const iconCopy = copyPromptBtn.querySelector(".icon-copy");
      if (iconCopy) iconCopy.style.display = "none";

      const iconCheckImg = copyPromptBtn.querySelector("img.icon-check");
      if (iconCheckImg) iconCheckImg.style.display = "inline-block";
      else {
        const inlineCheck = copyPromptBtn.querySelector(".icon-check:not(img)");
        if (inlineCheck) inlineCheck.style.display = "inline-block";
      }

      copyPromptBtn.classList.add("copied");
      if (_copyTimeoutId) clearTimeout(_copyTimeoutId);
      _copyTimeoutId = setTimeout(() => resetCopyButtonState(), 2000);
    };

    if (!navigator.clipboard) {
      try {
        promptTextarea.select();
        const ok = document.execCommand("copy");
        if (ok) doCopiedUI();
      } catch (err) {
        console.warn("Copiado no soportado", err);
      }
      return;
    }

    navigator.clipboard.writeText(prompt)
      .then(() => doCopiedUI())
      .catch(err => {
        console.warn("Error copiando:", err);
        doCopiedUI();
      });
  });
}


// Permite usar Enter en inputs de código del sitio oficial.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const ebootuxInput = e.target.closest(".input-codigo-ebootux");
  if (ebootuxInput) {
    const card = ebootuxInput.closest(".ebootux-cards");
    const btn = card?.querySelector(".btn-acceder-ebootux");
    if (btn) {
      e.preventDefault();
      btn.click();
    }
    return;
  }

  const assetInput = e.target.closest(".input-codigo-plantitux");
  if (assetInput) {
    const card = assetInput.closest(".plantitux-cards, .movitux-cards");
    const btn = card?.querySelector(".btn-acceder-plantitux");
    if (btn) {
      e.preventDefault();
      btn.click();
    }
  }
});

fetchAndRenderCards();


// ============================
// PWA
// ============================
let deferredInstallPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/pwa/sw.js").catch((error) => {
      console.warn("No se pudo registrar el Service Worker:", error);
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

const installButton = document.querySelector(".dwl-statux");
if (installButton) {
  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });
}

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
});

async function downloadModule(moduleId) {
  const modulesCache = await caches.open("statux-modules");
  const response = await fetch("/pwa/modules.json", { cache: "no-store" });

  if (!response.ok) throw new Error("No se pudo cargar modules.json");

  const data = await response.json();
  const module = (data.modules || []).find((item) => item.id === moduleId);

  if (!module) throw new Error(`Módulo no encontrado: ${moduleId}`);

  await modulesCache.addAll(module.files || []);
  return module.files || [];
}

window.downloadModule = downloadModule;


// ============================
// STX UI + STORAGE + EVENTS
// ============================
const stxRuntime = (() => {
  const stxKeys = {
    codes: "stx_codes",
    hover: "stx_hover",
    focus: "stx_focus",
    font: "stx_font",
    reduceMotion: "stx_reduce_motion"
  };

  const stxUi = {
    settingsBtn: null,
    settingsOverlay: null,
    settingsModal: null,
    libraryOverlay: null,
    libraryModal: null,
    accessOverlay: null,
    accessModal: null,
    tabs: [],
    codesContainer: null,
    switches: [],
    fontItem: null,
    advancedItem: null,
    accessCloseBtn: null,
    accessHoverToggle: null,
    accessReduceMotionToggle: null,
    accessResetBtn: null
  };

  const stxStorage = {
    getCodes() {
      const raw = localStorage.getItem(stxKeys.codes);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    },
    setCodes(list) {
      localStorage.setItem(stxKeys.codes, JSON.stringify(list));
    },
    saveCode(entry) {
      const current = stxStorage.getCodes();
      const exists = current.some((item) => item.id === entry.id);
      if (exists) return;
      current.push(entry);
      stxStorage.setCodes(current);
    },
    deleteCode(id) {
      const current = stxStorage.getCodes();
      const next = current.filter((item) => item.id !== id);
      stxStorage.setCodes(next);
    },
    setFlag(key, value) {
      localStorage.setItem(key, JSON.stringify(Boolean(value)));
    },
    getFlag(key, fallback = false) {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      try {
        return Boolean(JSON.parse(raw));
      } catch (_) {
        return fallback;
      }
    },
    setFont(value) {
      localStorage.setItem(stxKeys.font, String(value));
    },
    getFont() {
      return Number(localStorage.getItem(stxKeys.font) || 20);
    }
  };

  function stxNormalizeType(type) {
    const map = {
      ebootux: "Ebootux",
      getux: "Getux",
      plantitux: "Plantitux",
      movitux: "Movitux",
      tracktux: "Tracktux",
      soundtux: "Soundtux",
      mindtux: "Mindtux",
      marketux: "Marketux"
    };
    return map[String(type || "").toLowerCase()] || "Statux";
  }

  function stxBuildCodeId(card, type, code) {
    const title = (card?.dataset?.ebootuxTitle || card?.dataset?.title || card?.querySelector("h3")?.textContent || "card").trim().toLowerCase();
    return `${String(type || "statux").toLowerCase()}::${title.replace(/\s+/g, "-")}::${String(code || "").trim()}`;
  }

  function stxRenderCodes() {
    if (!stxUi.codesContainer) return;
    const items = stxStorage.getCodes();
    if (!items.length) {
      stxUi.codesContainer.innerHTML = '<div class="stx-code-item"><div class="stx-code-info"><span class="stx-card-name">Sin códigos guardados</span><span class="stx-card-type">Statux</span></div></div>';
      return;
    }

    stxUi.codesContainer.innerHTML = items.map((item) => `
      <div class="code-item stx-code-item" data-stx-id="${escAttr(item.id)}">
        <div class="stx-code-info">
          <span class="stx-card-name">${escAttr(item.name)}</span>
          <span class="stx-card-type">${escAttr(item.type)}</span>
        </div>

        <div class="code-actions stx-code-actions">
          <button class="icon-btn stx-icon-btn copy" type="button" data-stx-action="copy" data-stx-id="${escAttr(item.id)}" aria-label="Copiar código">
            <img src="content_copy.svg" alt="Copiar código">
          </button>
          <button class="icon-btn stx-icon-btn delete" type="button" data-stx-action="delete" data-stx-id="${escAttr(item.id)}" aria-label="Eliminar código">
            <img src="iconos/delete_24dp_FF0000_FILL0_wght400_GRAD0_opsz24.svg" alt="Eliminar código">
          </button>
        </div>
      </div>
    `).join("");
  }

  async function stxCopyCode(id, button) {
    const found = stxStorage.getCodes().find((item) => item.id === id);
    if (!found || !found.code) return;
    try {
      await navigator.clipboard.writeText(found.code);
      if (button) {
        button.classList.add("stx-copied");
        setTimeout(() => button.classList.remove("stx-copied"), 900);
      }
    } catch (_) {
      mostrarModal("Copiado no disponible", "No se pudo copiar el código en este dispositivo.");
    }
  }

  function stxApplyHoverState(active) {
    document.body.classList.toggle("stx-no-hover", Boolean(active));
    stxStorage.setFlag(stxKeys.hover, active);
  }

  function stxApplyFocusState(active) {
    document.body.classList.toggle("stx-focus-mode", Boolean(active));
    stxStorage.setFlag(stxKeys.focus, active);
  }

  function stxApplyFont(size) {
    const bounded = Math.max(14, Math.min(22, Number(size) || 20));
    document.body.style.fontSize = `${bounded}px`;
    stxStorage.setFont(bounded);
  }

  function stxApplyReduceMotionState(active) {
    document.body.classList.toggle("stx-reduce-motion", Boolean(active));
    stxStorage.setFlag(stxKeys.reduceMotion, active);
  }

  function stxSyncOverlayLock() {
    const hasOpenOverlay = [
      stxUi.settingsOverlay,
      stxUi.libraryOverlay,
      stxUi.accessOverlay,
      previewModal,
      plantituxPreviewModal,
      document.getElementById("modal-ebootux")
    ].some((overlay) => overlay && overlay.classList.contains("active") && !overlay.classList.contains("hidden"));

    document.body.classList.toggle("stx-overlay-open", hasOpenOverlay);
  }

  function stxSyncAccessControls() {
    if (stxUi.accessHoverToggle) stxUi.accessHoverToggle.checked = document.body.classList.contains("stx-no-hover");
    if (stxUi.accessReduceMotionToggle) stxUi.accessReduceMotionToggle.checked = document.body.classList.contains("stx-reduce-motion");
  }

  function stxOpenAccess() {
    if (!stxUi.accessOverlay) return;
    stxCloseSettings();
    stxSyncAccessControls();
    stxUi.accessOverlay.classList.add("active");
    stxUi.accessOverlay.setAttribute("aria-hidden", "false");
    stxSyncOverlayLock();
  }

  function stxCloseAccess() {
    stxUi.accessOverlay?.classList.remove("active");
    stxUi.accessOverlay?.setAttribute("aria-hidden", "true");
    stxSyncOverlayLock();
  }

  function stxResetAccessSettings() {
    const defaultNoHover = isTouchDevice();
    stxApplyHoverState(defaultNoHover);
    stxApplyReduceMotionState(false);
    stxApplyFocusState(false);
    stxApplyFont(20);
    stxSyncAccessControls();
  }

  function stxToggleSettings() {
    if (!stxUi.settingsBtn || !stxUi.settingsOverlay) return;
    const willOpen = !stxUi.settingsOverlay.classList.contains("active");
    if (willOpen) {
      stxUi.settingsBtn.classList.add("active");
      stxUi.settingsOverlay.classList.add("active");
      stxUi.settingsOverlay.setAttribute("aria-hidden", "false");
      document.querySelector(".floating-container")?.classList.add("active");
      stxSyncOverlayLock();
      return;
    }
    stxCloseSettings();
  }

  function stxCloseSettings() {
    stxUi.settingsBtn?.classList.remove("active");
    stxUi.settingsOverlay?.classList.remove("active");
    stxUi.settingsOverlay?.setAttribute("aria-hidden", "true");
    document.querySelector(".floating-container")?.classList.remove("active");
    stxSyncOverlayLock();
  }

  function stxOpenLibrary() {
    if (!stxUi.libraryOverlay) return;
    stxCloseSettings();
    stxCloseAccess();
    stxRenderCodes();
    stxUi.libraryOverlay.classList.add("active");
    stxUi.libraryOverlay.setAttribute("aria-hidden", "false");
    stxSyncOverlayLock();
  }

  function stxCloseLibrary() {
    stxUi.libraryOverlay?.classList.remove("active");
    stxUi.libraryOverlay?.setAttribute("aria-hidden", "true");
    stxSyncOverlayLock();
  }


  function stxBindPseudoButton(element, handler) {
    if (!element) return;
    element.addEventListener("click", handler);
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handler();
    });
  }

  function stxBindTabs() {
    stxUi.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const modal = tab.closest(".stx-library-modal");
        if (!modal) return;

        const target = tab.dataset.tab;
        if (!target) return;

        modal.querySelectorAll(".stx-tab").forEach((btn) => btn.classList.remove("active"));
        modal.querySelectorAll(".stx-tab-content").forEach((content) => content.classList.remove("active"));

        tab.classList.add("active");
        const section = modal.querySelector(`#${target}`);
        if (section) section.classList.add("active");
      });
    });
  }

  function stxBindEvents() {
    const closeBtn = document.getElementById("closeModal");
    const libraryBtn = document.getElementById("libraryBtn");

    stxUi.settingsBtn?.addEventListener("click", stxToggleSettings);
    closeBtn?.addEventListener("click", stxCloseSettings);
    libraryBtn?.addEventListener("click", stxOpenLibrary);

    stxUi.settingsOverlay?.addEventListener("click", (e) => {
      if (e.target === stxUi.settingsOverlay) stxCloseSettings();
    });

    stxUi.settingsModal?.addEventListener("click", (e) => e.stopPropagation());

    stxUi.libraryOverlay?.addEventListener("click", (e) => {
      if (e.target === stxUi.libraryOverlay) stxCloseLibrary();
    });

    stxBindPseudoButton(stxUi.advancedItem, () => {
      mostrarModal("Avanzado", "Seguimos con esta parte en el siguiente paso.");
    });

    stxBindPseudoButton(stxUi.fontItem, () => {
      stxOpenAccess();
    });

    stxUi.accessCloseBtn?.addEventListener("click", stxCloseAccess);

    stxUi.accessOverlay?.addEventListener("click", (e) => {
      if (e.target === stxUi.accessOverlay) stxCloseAccess();
    });

    stxUi.accessModal?.addEventListener("click", (e) => e.stopPropagation());

    stxUi.accessHoverToggle?.addEventListener("change", (event) => {
      stxApplyHoverState(Boolean(event.target.checked));
    });

    stxUi.accessReduceMotionToggle?.addEventListener("change", (event) => {
      stxApplyReduceMotionState(Boolean(event.target.checked));
    });

    stxUi.accessResetBtn?.addEventListener("click", () => {
      stxResetAccessSettings();
      stxCloseAccess();
    });

    stxUi.codesContainer?.addEventListener("click", (e) => {
      const button = e.target.closest(".stx-icon-btn");
      if (!button) return;

      const action = button.dataset.stxAction;
      const id = button.dataset.stxId;
      if (!action || !id) return;

      if (action === "copy") {
        stxCopyCode(id, button);
        return;
      }

      if (action === "delete") {
        stxStorage.deleteCode(id);
        stxRenderCodes();
      }
    });

    stxBindTabs();
  }

  function stxBindUI() {
    stxUi.settingsBtn = document.querySelector(".stx-settings-btn");
    stxUi.settingsOverlay = document.querySelector(".stx-settings-overlay");
    stxUi.settingsModal = document.querySelector(".stx-setting-modal");
    stxUi.libraryOverlay = document.querySelector(".stx-library-overlay");
    stxUi.libraryModal = document.querySelector(".stx-library-modal");
    stxUi.accessOverlay = document.querySelector(".stx-access-overlay");
    stxUi.accessModal = document.querySelector(".stx-access-modal");
    stxUi.tabs = Array.from(document.querySelectorAll(".stx-tab"));
    stxUi.codesContainer = document.getElementById("codes");
    stxUi.fontItem = document.getElementById("settingsAccessibilityBtn");
    stxUi.advancedItem = document.getElementById("settingsAdvancedBtn");
    stxUi.accessCloseBtn = document.getElementById("accessCloseBtn");
    stxUi.accessHoverToggle = document.getElementById("toggle-hover");
    stxUi.accessReduceMotionToggle = document.getElementById("reduce-motion");
    stxUi.accessResetBtn = document.getElementById("accessResetBtn");
  }

  function stxHydrateState() {
    const hover = stxStorage.getFlag(stxKeys.hover, isTouchDevice());
    const focus = stxStorage.getFlag(stxKeys.focus, false);
    const font = stxStorage.getFont();
    const reduceMotion = stxStorage.getFlag(stxKeys.reduceMotion, false);

    stxApplyHoverState(hover);
    stxApplyFocusState(focus);
    stxApplyFont(font);
    stxApplyReduceMotionState(reduceMotion);
    stxSyncAccessControls();
    stxSyncOverlayLock();
  }

  function init() {
    stxBindUI();
    stxHydrateState();
    stxBindEvents();
    stxRenderCodes();
  }

  function saveUnlockedCodeFromCard(card, rawType, rawCode) {
    const code = String(rawCode || "").trim();
    if (!code) return;

    const type = stxNormalizeType(rawType || card?.dataset?.section || card?.dataset?.type || "Statux");
    const name = (card?.dataset?.ebootuxTitle || card?.dataset?.title || card?.querySelector("h3")?.textContent || "Sin nombre").trim();
    const id = stxBuildCodeId(card, type, code);

    stxStorage.saveCode({ id, name, type, code });
  }

  return {
    init,
    saveUnlockedCodeFromCard
  };
})();

stxRuntime.init();
