// auth.js
// Maneja el login por código y la protección de curso.html.

(() => {
  const ACCESS_KEY = "getux_access";
  const ACCESS_VALUE = "granted";
  const VALID_CODE = "GETUX-HTMLCSS"; // cambia este valor cuando quieras.
  const RETURN_KEY = "stx_return_url";
  const OFFICIAL_HOME = "https://statux.netlify.app";

  const isIndex = location.pathname.endsWith("index.html") || location.pathname.endsWith("/getux-html-css/") || location.pathname.endsWith("/getux-html-css");
  const isCurso = location.pathname.endsWith("curso.html");
  const stxReturnParam = new URLSearchParams(location.search).get("stx_return");

  const isSafeReturnUrl = (value) => {
    if (!value) return false;
    try {
      const parsed = new URL(value, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  };

  if (isSafeReturnUrl(stxReturnParam)) {
    sessionStorage.setItem(RETURN_KEY, stxReturnParam);
  }

  const returnUrl = sessionStorage.getItem(RETURN_KEY);
  if (!isSafeReturnUrl(returnUrl)) {
    location.replace(OFFICIAL_HOME);
    return;
  }
  const injectBackToSiteBtn = () => {
    if (!isSafeReturnUrl(returnUrl)) return;
    if (document.querySelector(".btn-back-official")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-soft btn-back-official";
    btn.textContent = "Volver a Statux";
    btn.addEventListener("click", () => {
      window.location.href = returnUrl;
    });
    document.body.appendChild(btn);
  };

  // Protección interna: si intentan abrir curso.html sin acceso, vuelven al index.
  if (isCurso && sessionStorage.getItem(ACCESS_KEY) !== ACCESS_VALUE) {
    location.replace("index.html");
    return;
  }

  if (isIndex) {
    const input = document.getElementById("codigo");
    const btn = document.getElementById("btn-entrar");
    const msg = document.getElementById("auth-msg");

    if (!input || !btn) return;

    const entrar = () => {
      const code = input.value.trim();

      if (code === VALID_CODE) {
        sessionStorage.setItem(ACCESS_KEY, ACCESS_VALUE);
        msg.textContent = "Acceso concedido. Entrando...";
        msg.style.color = "#c1e8ff";
        const params = new URLSearchParams();
        if (isSafeReturnUrl(returnUrl)) params.set("stx_return", returnUrl);
        const nextUrl = params.toString() ? `curso.html?${params.toString()}` : "curso.html";
        setTimeout(() => location.href = nextUrl, 300);
        return;
      }

      msg.textContent = "Código incorrecto. Verifica e intenta de nuevo.";
      msg.style.color = "#ffb3b3";
    };

    btn.addEventListener("click", entrar);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") entrar();
    });
  }

  // Botón salir en el curso.
  const salir = document.getElementById("btn-salir");
  if (salir) {
    salir.addEventListener("click", () => {
      sessionStorage.removeItem(ACCESS_KEY);
      location.href = "index.html";
    });
  }

  injectBackToSiteBtn();
})();
