# GeoLibre Plugin Template

A template for creating GeoLibre Desktop plugins backed by MapLibre GL JS controls. It still includes the standalone MapLibre control and React wrapper so plugin authors can develop and test the control outside GeoLibre.

[![npm version](https://img.shields.io/npm/v/geolibre-plugin-template.svg)](https://www.npmjs.com/package/geolibre-plugin-template)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?logo=codesandbox)](https://codesandbox.io/p/github/opengeos/geolibre-plugin-template)
[![Open in StackBlitz](https://img.shields.io/badge/Open%20in-StackBlitz-blue?logo=stackblitz)](https://stackblitz.com/github/opengeos/geolibre-plugin-template)

## Features

- **GeoLibre Bundle Output** - Builds a zip with root `plugin.json`, bundled ESM, and CSS for GeoLibre Desktop
- **GeoLibre Host Contract** - Typed `GeoLibreAppAPI`/`GeoLibrePlugin` contract, URL deep-linking, native-layer registration, native UI surfaces (right-sidebar panels, top toolbar menus, floating panels), and a one-step `install:geolibre`
- **TypeScript Support** - Full TypeScript support with type definitions
- **React Integration** - React wrapper component and custom hooks
- **IControl Implementation** - Implements MapLibre's IControl interface
- **Modern Build Setup** - Vite-based library and GeoLibre bundle builds
- **Testing** - Vitest setup with React Testing Library
- **CI/CD Ready** - GitHub Actions for npm publishing and GitHub Pages

## Installation

```bash
npm install geolibre-plugin-template
```

## Build a GeoLibre plugin zip

GeoLibre Desktop loads external plugins from an app data `plugins/` directory. The zip must contain `plugin.json` at the root, plus a bundled ESM entry and optional CSS file.

```bash
npm install
npm run package:geolibre
```

This creates:

```text
geolibre-plugin/geolibre-plugin-template-0.1.0.zip
```

The generated zip contains:

```text
plugin.json
dist/index.js
dist/style.css
```

Copy the zip into GeoLibre Desktop's app data `plugins/` directory and restart GeoLibre. On Linux with the default app identifier, that directory is usually:

```text
~/.local/share/org.geolibre.desktop/plugins/
```

Customize the GeoLibre wrapper in `src/geolibre.ts` and the manifest in `geolibre-plugin/plugin.json`. The manifest `id`, `name`, and `version` must match the exported plugin in `src/geolibre.ts`.

For the GeoLibre web app, serve the unpacked plugin with CORS enabled:

```bash
npm run package:geolibre
npm run serve:geolibre -- 8000
```

Then add this manifest URL in GeoLibre Settings > Plugins:

```text
http://localhost:8000/plugin.json
```

Using `python -m http.server` for this cross-origin web app case is not enough
because it does not send `Access-Control-Allow-Origin`.

### Install into GeoLibre in one step

Instead of copying the zip by hand, `install:geolibre` builds the bundle and
drops it straight into a place GeoLibre loads from:

```bash
# GeoLibre Desktop's app-data plugins directory (auto-scanned on startup)
npm run install:geolibre

# A GeoLibre repo's bundled drop-in folder (apps/geolibre-desktop/public/plugins)
npm run install:geolibre -- --web /path/to/geolibre

# A custom directory
GEOLIBRE_PLUGINS_DIR=/path/to/plugins npm run install:geolibre
```

Restart GeoLibre Desktop (or rebuild/restart the GeoLibre dev server for `--web`)
to load the plugin. The script reads `geolibre-plugin/plugin.json`, so it works
for any plugin built from this template with no edits.

## GeoLibre integration

`src/geolibre.ts` is the entry point GeoLibre loads. It exports a plugin object
that GeoLibre calls across the plugin lifecycle. The full contract between the
plugin and the host lives in `src/lib/geolibre/host-api.ts` and is re-exported
from the package, so you import the types instead of redeclaring them:

```typescript
import type {
  GeoLibreAppAPI,
  GeoLibrePlugin,
  GeoLibreNativeLayerRegistration,
} from "geolibre-plugin-template";
```

### Host API (`GeoLibreAppAPI`)

The host passes this object to `activate`, `deactivate`, and the other hooks.
Only the first two members are guaranteed; the rest are optional capabilities,
so call them with optional chaining and degrade gracefully when a host build
does not provide them.

| Member                          | Required | Description                                              |
| ------------------------------- | -------- | ------------------------------------------------------- |
| `addMapControl`                 | yes      | Add the plugin's control to the map                     |
| `removeMapControl`              | yes      | Remove the control from the map                         |
| `pickLocalDirectoryFiles`       | no       | Open the host's directory picker (e.g. GeoLibre Desktop) |
| `resolvePluginAssetUrl`         | no       | Resolve a fetchable URL for an asset bundled in the plugin |
| `registerExternalNativeLayer`   | no       | Hand the host a dataset to render as a native layer     |
| `unregisterExternalNativeLayer` | no       | Remove a previously registered native layer             |
| `registerRightPanel`            | no       | Register a native right-sidebar panel (returns unregister) |
| `unregisterRightPanel`          | no       | Remove a registered right panel (closing it if active)  |
| `openRightPanel`                | no       | Make a right panel the active workspace and expand it    |
| `collapseRightPanel`            | no       | Collapse the active right panel to its rail              |
| `closeRightPanel`               | no       | Close the active right panel and restore the Style panel |
| `getActiveRightPanel`           | no       | Id of the active right panel, or `null`                 |
| `registerToolbarMenu`           | no       | Add a top-level toolbar menu (returns unregister)       |
| `unregisterToolbarMenu`         | no       | Remove a registered toolbar menu                        |
| `registerFloatingPanel`         | no       | Register a floating map-overlay card (returns unregister) |
| `unregisterFloatingPanel`       | no       | Remove a registered floating panel (closing it if open) |
| `openFloatingPanel`             | no       | Open a floating panel (or bring it to the front)        |
| `closeFloatingPanel`            | no       | Close an open floating panel                            |
| `getOpenFloatingPanels`         | no       | Ids of open floating panels, in stacking order          |

### Plugin lifecycle hooks (`GeoLibrePlugin`)

| Hook                                              | Description                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| `activate`                                        | Create and add the control; return `false` if it cannot be added |
| `deactivate`                                      | Capture state to restore, then remove the control                |
| `urlParameterNames`                               | Query parameters this plugin owns (drives auto-activation)       |
| `handleUrlParameters`                             | Receive deep-link query parameters (see below)                   |
| `getMapControlPosition` / `setMapControlPosition` | Report and change the control's dock position                    |
| `getProjectState` / `applyProjectState`           | Serialize and restore state with the GeoLibre project            |

### Deep linking

Declare the query parameters your plugin owns in `urlParameterNames`. When
GeoLibre opens a URL carrying one of them, it auto-activates the plugin and
dispatches the parsed parameters to `handleUrlParameters`. The template wires
this to the DOM-free helpers in `src/lib/utils/deep-link.ts`:

```text
https://geolibre.app/?plugin-data=https://example.com/dataset.zip
```

Rename `PLUGIN_DATA_PARAM` and adapt the `DeepLinkConsumer` interface (which
`PluginControl.loadFromUrl` implements) to whatever your plugin needs to receive.

### Native layer registration

When the host exposes `registerExternalNativeLayer`, a plugin can hand it a
dataset and let GeoLibre own the MapLibre sources and layers, so they appear in
the host's layer panel and follow its theme. The GeoLibre wrapper binds the
host callbacks into the control's `registerNativeLayer` / `unregisterNativeLayer`
options; `PluginControl.loadFromUrl` shows the end-to-end pattern, and the
control unregisters its layers automatically when removed. Outside GeoLibre the
callbacks default to no-ops, so the control still works as a standalone MapLibre
control.

### Right sidebar panel

When the host exposes `registerRightPanel`, a plugin can register a native
right-sidebar panel that docks beside GeoLibre's built-in Style panel and
behaves like a first-class part of the workspace, instead of emulating one with
a fixed overlay. The host renders the panel chrome (a header with collapse and
close buttons, a collapsible rail, and a resize handle); the plugin owns only
the body via `render(container)`, using plain DOM so it never has to share the
host's UI framework. Only one plugin right panel is the active right-side
workspace at a time: while one is active GeoLibre collapses its Style panel to
its rail and restores it when the plugin panel closes.

The template wires a demonstration panel in `src/lib/geolibre/right-panel.ts`,
opened from the plugin's `activate` hook and torn down in `deactivate`:

```ts
const unregister = app.registerRightPanel?.({
  id: "my-workbench",
  title: "Workbench",
  defaultWidth: 320,
  render(container) {
    container.textContent = "Rendered by the plugin via registerRightPanel().";
    return () => {
      // optional cleanup, run on close/unregister
    };
  },
});

app.openRightPanel?.("my-workbench");     // make it the active workspace
app.collapseRightPanel?.("my-workbench"); // collapse to the rail
app.closeRightPanel?.("my-workbench");    // close and restore the Style panel
```

The container stays mounted across collapse, so any state in your DOM persists.
The panel is a flex sibling of the map, so opening it shrinks the map view; no
manual map padding is required. Remove `registerTemplateRightPanel` from
`src/geolibre.ts` if your plugin only needs a map control.

### Toolbar menu

When the host exposes `registerToolbarMenu`, a plugin can add its own top-level
menu button to the GeoLibre banner (beside Project / Edit / View / Plugins),
with nested submenus and action items. Menu items typically open one of the
plugin's panels. The template wires this in `src/lib/geolibre/toolbar-menu.ts`,
opening the right panel and floating panel defined alongside it:

```ts
const unregister = app.registerToolbarMenu?.({
  id: "my-plugin-menu",
  label: "Template",
  items: [
    { id: "open", label: "Open workbench panel", onSelect: () => app.openRightPanel?.("...") },
    { type: "submenu", id: "tools", label: "Tools", items: [
      { id: "float", label: "Open floating tools", onSelect: () => app.openFloatingPanel?.("...") },
    ] },
    { type: "separator" },
    { id: "close", label: "Close panels", onSelect: () => { /* ... */ } },
  ],
});
```

Each item is an action (`onSelect`, the default when `type` is omitted), a
submenu (nested `items`), or a separator. Re-registering the same id replaces
the menu, so you can rebuild it as your plugin's state changes.

### Floating panel

When the host exposes `registerFloatingPanel`, a plugin can show a draggable,
closeable card overlaid on the map's top-left corner. Unlike the right panel (a
single docked workspace that collapses the Style panel), several floating panels
can be open at once and they do not shrink the map. The render contract is the
same plain-DOM `render(container)`. The template registers one in
`src/lib/geolibre/floating-panel.ts` and opens it from the toolbar menu:

```ts
const unregister = app.registerFloatingPanel?.({
  id: "my-tools",
  title: "Floating Tools",
  defaultWidth: 280,
  render(container) {
    container.textContent = "Rendered by the plugin via registerFloatingPanel().";
    return () => {
      // optional cleanup, run on close/unregister
    };
  },
});

app.openFloatingPanel?.("my-tools");   // open (or bring to front)
app.closeFloatingPanel?.("my-tools");  // close
```

### Bundling plugin-local assets

If your plugin ships static assets it loads over HTTP at runtime (sample
datasets, icons, JSON, etc.), copy them into the built bundle so a baked-in or
URL-served GeoLibre install can fetch them next to the plugin entry, then resolve
their URL at runtime with `app.resolvePluginAssetUrl(pluginId, relativePath)`:

```ts
// In createControl(app), enable a feature only when the asset is reachable:
const sampleDataBaseUrl =
  app.resolvePluginAssetUrl?.("your-plugin-id", "dist/sample-data") ?? undefined;
```

`resolvePluginAssetUrl` returns `null` when the plugin was not loaded from a URL
base (for example, a desktop filesystem install), so treat both `undefined`
(host lacks the method) and `null` (asset not resolvable) as "unavailable" and
hide any UI that depends on the asset.

`vite.geolibre.config.ts` ships a commented `bundlePluginAssets()` recipe that
copies a source directory into `geolibre-plugin/dist/` on `closeBundle` and sets
`publicDir: false` so unrelated `public/` files are not pulled into the bundle.
Uncomment it and point it at your asset directory to enable it.

## Quick Start

### Vanilla JavaScript/TypeScript

```typescript
import maplibregl from "maplibre-gl";
import { PluginControl } from "geolibre-plugin-template";
import "geolibre-plugin-template/style.css";

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/positron",
  center: [0, 0],
  zoom: 2,
});

map.on("load", () => {
  const control = new PluginControl({
    title: "My Plugin",
    collapsed: false,
    panelWidth: 300,
  });

  map.addControl(control, "top-right");
});
```

### React

```tsx
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import {
  PluginControlReact,
  usePluginState,
} from "geolibre-plugin-template/react";
import "geolibre-plugin-template/style.css";

function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const { state, toggle } = usePluginState();

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [0, 0],
      zoom: 2,
    });

    mapInstance.on("load", () => setMap(mapInstance));

    return () => mapInstance.remove();
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {map && (
        <PluginControlReact
          map={map}
          title="My Plugin"
          collapsed={state.collapsed}
          onStateChange={(newState) => console.log(newState)}
        />
      )}
    </div>
  );
}
```

## API

### PluginControl

The main control class implementing MapLibre's `IControl` interface.

#### Constructor Options

| Option       | Type      | Default            | Description                                                               |
| ------------ | --------- | ------------------ | ------------------------------------------------------------------------- |
| `collapsed`  | `boolean` | `true`             | Whether the panel starts collapsed (showing only the 29x29 toggle button) |
| `position`   | `string`  | `'top-right'`      | Control position on the map                                               |
| `title`      | `string`  | `'Plugin Control'` | Title displayed in the header                                             |
| `panelWidth` | `number`  | `300`              | Width of the dropdown panel in pixels                                     |
| `className`  | `string`  | `''`               | Custom CSS class name                                                     |
| `pickFiles`  | `function` | no-op (`null`)    | Host directory picker; the GeoLibre wrapper binds it to `pickLocalDirectoryFiles` |
| `registerNativeLayer`   | `function` | no-op   | Host callback to register a native layer; bound to `registerExternalNativeLayer` |
| `unregisterNativeLayer` | `function` | no-op   | Host callback to remove a native layer; bound to `unregisterExternalNativeLayer` |

#### Methods

- `toggle()` - Toggle the collapsed state
- `expand()` - Expand the panel
- `collapse()` - Collapse the panel
- `getState()` - Get the current state
- `setState(state)` - Update the state
- `loadFromUrl(value)` - Handle a deep-link value (implements `DeepLinkConsumer`)
- `openFiles()` - Open the host directory picker via `pickFiles`
- `on(event, handler)` - Register an event handler
- `off(event, handler)` - Remove an event handler
- `getMap()` - Get the map instance
- `getContainer()` - Get the container element

#### Events

- `collapse` - Fired when the panel is collapsed
- `expand` - Fired when the panel is expanded
- `statechange` - Fired when the state changes

### PluginControlReact

React wrapper component for `PluginControl`.

#### Props

All `PluginControl` options plus:

| Prop            | Type       | Description                         |
| --------------- | ---------- | ----------------------------------- |
| `map`           | `Map`      | MapLibre GL map instance (required) |
| `onStateChange` | `function` | Callback fired when state changes   |

### usePluginState

Custom React hook for managing plugin state.

```typescript
const {
  state, // Current state
  setState, // Update entire state
  setCollapsed, // Set collapsed state
  setPanelWidth, // Set panel width
  setData, // Set custom data
  reset, // Reset to initial state
  toggle, // Toggle collapsed state
} = usePluginState(initialState);
```

## Utilities

The package exports several utility functions:

- `clamp(value, min, max)` - Clamp a value between min and max
- `formatNumericValue(value, step)` - Format a number with appropriate decimals
- `generateId(prefix?)` - Generate a unique ID
- `debounce(fn, delay)` - Debounce a function
- `throttle(fn, limit)` - Throttle a function
- `classNames(classes)` - Build a class string from an object

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/geolibre-plugin-template.git
cd geolibre-plugin-template

# Install dependencies
npm install

# Start development server
npm run dev
```

### Scripts

| Script                     | Description                              |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Start development server                 |
| `npm run build`            | Build the library and GeoLibre bundle    |
| `npm run build:lib`        | Build the standalone MapLibre library    |
| `npm run build:geolibre`   | Build the GeoLibre ESM and CSS bundle    |
| `npm run package:geolibre` | Build and zip the GeoLibre plugin bundle |
| `npm run install:geolibre` | Build and install the bundle into GeoLibre |
| `npm run serve:geolibre`   | Serve the unpacked bundle with CORS      |
| `npm run build:examples`   | Build examples for deployment            |
| `npm run test`             | Run tests                                |
| `npm run test:ui`          | Run tests with UI                        |
| `npm run test:coverage`    | Run tests with coverage                  |
| `npm run lint`             | Lint the code                            |
| `npm run format`           | Format the code                          |

### Project Structure

```text
geolibre-plugin-template/
├── geolibre-plugin/
│   └── plugin.json          # GeoLibre external plugin manifest
├── scripts/
│   ├── package-geolibre-plugin.mjs
│   ├── install-geolibre-plugin.mjs  # Install the bundle into GeoLibre
│   └── serve-geolibre-plugin.mjs
├── src/
│   ├── index.ts              # Main entry point
│   ├── geolibre.ts           # GeoLibre plugin wrapper entry point
│   ├── react.ts              # React entry point
│   ├── index.css             # Root styles
│   └── lib/
│       ├── core/             # Core classes and types
│       ├── geolibre/         # GeoLibre host-plugin contract (host-api.ts)
│       ├── hooks/            # React hooks
│       ├── utils/            # Utility functions (incl. deep-link.ts)
│       └── styles/           # Component styles
├── tests/                    # Test files
├── examples/                 # Example applications
│   ├── basic/               # Vanilla JS example
│   └── react/               # React example
└── .github/workflows/        # CI/CD workflows
```

## Docker

The examples can be run using Docker. The image is automatically built and published to GitHub Container Registry.

### Pull and Run

```bash
# Pull the latest image
docker pull ghcr.io/opengeos/geolibre-plugin-template:latest

# Run the container
docker run -p 8080:80 ghcr.io/opengeos/geolibre-plugin-template:latest
```

Then open http://localhost:8080/geolibre-plugin-template/ in your browser to view the examples.

### Build Locally

```bash
# Build the image
docker build -t geolibre-plugin-template .

# Run the container
docker run -p 8080:80 geolibre-plugin-template
```

### Available Tags

| Tag      | Description                      |
| -------- | -------------------------------- |
| `latest` | Latest release                   |
| `x.y.z`  | Specific version (e.g., `1.0.0`) |
| `x.y`    | Minor version (e.g., `1.0`)      |

### Publish to npm

```bash
npm login
npm whoami
npm publish --access public
```

Set up Trusted Publisher on npmjs.com

## Customization

To use this template for your own plugin:

1. Clone or fork this repository
2. Update `package.json` with your plugin name and details
3. Modify `src/lib/core/PluginControl.ts` to implement your plugin logic
4. Update the styles in `src/lib/styles/plugin-control.css`
5. Add custom utilities, hooks, or components as needed
6. Update the README with your plugin's documentation

## License

MIT License - see [LICENSE](LICENSE) for details.
