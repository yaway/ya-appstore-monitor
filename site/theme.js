export const THEME_STORAGE_KEY = "paid-charts-theme";
export const THEME_OPTIONS = ["system", "light", "dark"];

export function normalizeTheme(value) {
  return THEME_OPTIONS.includes(value) ? value : "system";
}

export function resolveTheme(preference, systemDark) {
  const normalized = normalizeTheme(preference);
  return normalized === "system" ? (systemDark ? "dark" : "light") : normalized;
}

export function initThemeControl(doc = document, browser = window) {
  const root = doc.documentElement;
  const control = doc.querySelector(".theme-control");
  const button = doc.querySelector("#theme-button");
  const menu = doc.querySelector("#theme-menu");
  const options = [...doc.querySelectorAll("[data-theme-option]")];
  if (!control || !button || !menu || options.length === 0) return;

  const systemTheme = browser.matchMedia("(prefers-color-scheme: dark)");
  const reducedMotion = browser.matchMedia("(prefers-reduced-motion: reduce)");
  let preference = normalizeTheme(root.dataset.themePreference);
  let closeTimer = null;
  let activeTransition = null;

  function updateControls() {
    root.dataset.themePreference = preference;
    options.forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.themeOption === preference));
    });
    const labels = { system: "跟随系统", light: "浅色", dark: "深色" };
    button.setAttribute("aria-label", `外观：${labels[preference]}`);
    button.title = `外观：${labels[preference]}`;
  }

  function commitTheme() {
    const resolved = resolveTheme(preference, systemTheme.matches);
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    updateControls();
  }

  function applyTheme(animate = true) {
    activeTransition?.skipTransition?.();
    if (animate && !reducedMotion.matches && typeof doc.startViewTransition === "function") {
      const transition = doc.startViewTransition(commitTheme);
      activeTransition = transition;
      transition.finished.finally(() => {
        if (activeTransition === transition) activeTransition = null;
      });
    } else {
      commitTheme();
    }
  }

  function savePreference() {
    try {
      browser.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {}
  }

  function openMenu({ focusSelected = false } = {}) {
    if (closeTimer) browser.clearTimeout(closeTimer);
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    button.setAttribute("aria-expanded", "true");
    menu.getBoundingClientRect();
    menu.classList.add("is-open");
    if (focusSelected) {
      const selected = options.find((option) => option.dataset.themeOption === preference);
      selected?.focus();
    }
  }

  function closeMenu({ returnFocus = false } = {}) {
    if (menu.hidden) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    button.setAttribute("aria-expanded", "false");
    if (reducedMotion.matches) {
      menu.hidden = true;
    } else {
      closeTimer = browser.setTimeout(() => {
        menu.hidden = true;
        closeTimer = null;
      }, 150);
    }
    if (returnFocus) button.focus();
  }

  button.addEventListener("click", () => {
    if (menu.hidden || !menu.classList.contains("is-open")) openMenu();
    else closeMenu();
  });

  button.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      openMenu({ focusSelected: true });
    }
  });

  options.forEach((option, index) => {
    option.addEventListener("click", () => {
      preference = normalizeTheme(option.dataset.themeOption);
      savePreference();
      applyTheme();
      closeMenu({ returnFocus: true });
    });
    option.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
      if (event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = options.length - 1;
      options[nextIndex].focus();
    });
  });

  doc.addEventListener("pointerdown", (event) => {
    if (!control.contains(event.target)) closeMenu();
  });

  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu({ returnFocus: true });
  });

  const handleSystemThemeChange = () => {
    if (preference === "system") applyTheme();
  };
  if (typeof systemTheme.addEventListener === "function") {
    systemTheme.addEventListener("change", handleSystemThemeChange);
  } else {
    systemTheme.addListener(handleSystemThemeChange);
  }

  browser.addEventListener("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    preference = normalizeTheme(event.newValue);
    applyTheme();
  });

  applyTheme(false);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initThemeControl();
}
