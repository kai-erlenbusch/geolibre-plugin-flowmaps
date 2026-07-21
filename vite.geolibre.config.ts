import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Recipe: bundle plugin-local assets into the GeoLibre dist/ folder
// ---------------------------------------------------------------------------
// If your plugin ships static assets (sample datasets, icons, JSON, etc.) that
// it loads over HTTP at runtime, copy them into the built bundle so a baked-in
// or URL-served GeoLibre install can fetch them next to the plugin entry. At
// runtime, resolve their URL with the host's `resolvePluginAssetUrl(pluginId,
// relativePath)` capability (see src/lib/geolibre/host-api.ts) and degrade
// gracefully when it returns null/undefined (e.g. a desktop filesystem install
// where the assets are not reachable over HTTP).
//
// To enable it, uncomment the imports and plugin below, point ASSET_SRC at your
// source directory, and add `bundlePluginAssets()` to the `plugins` array. Set
// `publicDir: false` so Vite does not also copy unrelated public/ files (e.g.
// robots.txt) into the plugin bundle.
//
// import { cp, rm } from "node:fs/promises";
// import type { Plugin } from "vite";
//
// const ASSET_SRC = resolve(__dirname, "public/sample-data");
// const ASSET_DEST = resolve(__dirname, "geolibre-plugin/dist/sample-data");
//
// function bundlePluginAssets(): Plugin {
//   return {
//     name: "geolibre-plugin:bundle-assets",
//     async closeBundle() {
//       await rm(ASSET_DEST, { recursive: true, force: true });
//       await cp(ASSET_SRC, ASSET_DEST, { recursive: true });
//     },
//   };
// }

export default defineConfig({
  // publicDir: false, // enable with the bundlePluginAssets() recipe above
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "globalThis.deck.VERSION": JSON.stringify("8.9.36"),
    "globalThis.luma.VERSION": JSON.stringify("8.5.21")
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/geolibre.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "geolibre-plugin/dist",
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: () => "style.css",
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
    minify: false,
  },
  plugins: [
    {
      name: "remove-deck-version-check",
      transform(code, id) {
        if (code.includes("multiple versions detected")) {
          // completely remove the throw statement
          return code.replace(/throw new Error\([\s\S]*?multiple versions detected[\s\S]*?\);/g, "console.warn('version check bypassed');");
        }
      }
    }
  ]
});
