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
import { cp, rm } from "node:fs/promises";
import type { Plugin } from "vite";

const ASSET_SRC = resolve(__dirname, "public");
const ASSET_DEST = resolve(__dirname, "geolibre-plugin/dist");

function bundlePluginAssets(): Plugin {
  return {
    name: "geolibre-plugin:bundle-assets",
    async closeBundle() {
      // Just copy the public folder contents to dist
      try {
        await cp(ASSET_SRC, ASSET_DEST, { recursive: true });
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }
    },
  };
}

export default defineConfig({
  publicDir: false, // enable with the bundlePluginAssets() recipe above
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
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    sourcemap: false,
  },
  plugins: [
    bundlePluginAssets(),
    {
      name: "remove-deck-version-check",
      transform(code, id) {
        if (code.includes("multiple versions detected")) {
          // completely remove the throw statement
          return code.replace(/throw new Error\([\s\S]*?multiple versions detected[\s\S]*?\);/g, "console.warn('version check bypassed');");
        }
      }
    },
    {
      name: "patch-node-dom",
      transform(code, id) {
        if (id.includes("hammerjs") || id.includes("hammer.js") || id.includes("index.mjs")) {
          return "if (typeof window === 'undefined') { globalThis.window = globalThis; }\n" + 
                 "if (typeof document === 'undefined') { const makeProxy = (name) => new Proxy(function(){}, { get: (target, prop) => { if (prop === 'length') return 0; if (prop === 'cssRules') return makeProxy('cssRules'); if (prop === 'sheet') return makeProxy('sheet'); if (prop === 'appendChild') return () => makeProxy('node'); if (prop === 'createElement') return () => makeProxy('node'); if (prop === 'setAttribute') return () => {}; if (prop === 'insertRule') return () => 0; if (prop === 'head') return makeProxy('head'); if (prop === 'style') return makeProxy('style'); if (prop === Symbol.toPrimitive) return () => name; if (prop === 'then') return undefined; return makeProxy(prop); }, apply: () => makeProxy('apply'), construct: () => makeProxy('construct') }); globalThis.document = makeProxy('document'); }\n" + code;
        }
      }
    }
  ]
});
