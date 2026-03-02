import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Chrome extension Vite config
// Builds content script and service worker as separate ES bundles.
// CSS modules are extracted to content.css and loaded into shadow DOM at runtime.

function copyExtensionFiles() {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, "manifest.json"),
        resolve(dist, "manifest.json"),
      );

      // Copy assets
      const assetsDist = resolve(dist, "assets");
      if (!existsSync(assetsDist)) mkdirSync(assetsDist, { recursive: true });
      for (const size of [16, 48, 128]) {
        const name = `icon-${size}.png`;
        copyFileSync(
          resolve(__dirname, "assets", name),
          resolve(assetsDist, name),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [preact(), copyExtensionFiles()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/index.ts"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        // Predictable asset names (content.css, not content-abc123.css)
        assetFileNames: "[name][extname]",
        format: "es",
        inlineDynamicImports: false,
        manualChunks: undefined,
      },
    },
    cssCodeSplit: false,
    minify: "esbuild",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
});
