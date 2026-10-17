import { isProductPage } from "./extractProduct";
import { removeIherbFab, syncIherbFab } from "./fab";

console.log("NavGPT iHerb content script loaded.");

let debounceTimer: number | null = null;
let lastUrl = location.href;

function scheduleSync(reason: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    if (!isProductPage()) {
      removeIherbFab();
      return;
    }
    console.log(`NavGPT iHerb: sync FAB (${reason})`);
    syncIherbFab();
  }, 200);
}

function onUrlMaybeChanged() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  scheduleSync("url");
}

function watchSpaNavigation() {
  const wrap = (method: "pushState" | "replaceState") => {
    const original = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      onUrlMaybeChanged();
      return result;
    };
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", onUrlMaybeChanged);
  window.setInterval(onUrlMaybeChanged, 800);
}

const observer = new MutationObserver(() => scheduleSync("mutation"));
observer.observe(document.documentElement, { childList: true, subtree: true });

watchSpaNavigation();
scheduleSync("init");
