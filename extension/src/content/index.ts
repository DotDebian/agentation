import { render, h } from "preact";
import { App } from "./app";
import type { ExtensionMessage } from "../types";

const HOST_ID = "agentation-root";

async function mount() {
  // Prevent double-injection
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-agentation", "");
  // Ensure host doesn't interfere with page layout
  host.style.cssText = "position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Load extension CSS into shadow DOM.
  // CSS modules are extracted to content.css by Vite build.
  try {
    const cssUrl = chrome.runtime.getURL("style.css");
    const res = await fetch(cssUrl);
    if (res.ok) {
      const cssText = await res.text();
      const styleEl = document.createElement("style");
      styleEl.textContent = cssText;
      shadow.appendChild(styleEl);
    }
  } catch {
    // CSS might not exist yet in dev — that's fine
  }

  // Mount point inside shadow root — pointer-events restored here
  const mountPoint = document.createElement("div");
  mountPoint.id = "agentation-mount";
  mountPoint.style.cssText = "pointer-events: auto;";
  shadow.appendChild(mountPoint);

  render(h(App, {}), mountPoint);
}

// Listen for toggle message from background service worker
chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type === "TOGGLE_TOOLBAR") {
    if (!document.getElementById(HOST_ID)) {
      mount();
    }
    // Dispatch custom event that App component listens for
    window.dispatchEvent(new CustomEvent("agentation-toggle"));
  }
});

// Mount when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mount());
} else {
  mount();
}
