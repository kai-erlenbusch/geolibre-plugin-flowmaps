import { PluginControl } from "./lib/core/PluginControl";
import type { PluginState } from "./lib/core/types";
import { DEFAULT_PLUGIN_STATE } from "./lib/core/types";
import type {
  GeoLibreAppAPI,
  GeoLibreMapControlPosition,
  GeoLibrePlugin,
} from "./lib/geolibre/host-api";
import { registerFlowmapRightPanel } from "./lib/geolibre/right-panel";
import { PLUGIN_DATA_PARAM, maybeHandleDeepLink } from "./lib/utils/deep-link";
import "./lib/styles/plugin-control.css";

// The host API is generic over the control type; bind it to this plugin's
// concrete control so the wired callbacks are fully typed.
type AppAPI = GeoLibreAppAPI<PluginControl>;

let control: PluginControl | null = null;
let position: GeoLibreMapControlPosition = "top-right";
let pendingState: Partial<PluginState> | null = null;
// Disposers for the demo UI surfaces; each is null when the host does not
// provide that surface. See ./lib/geolibre/{right-panel}.ts.
let disposeRightPanel: (() => void) | null = null;
let previousProjection: "globe" | "mercator" | null = null;

function createControl(app: AppAPI): PluginControl {
  const defaultPluginState = DEFAULT_PLUGIN_STATE;
  const nextControl = new PluginControl({
    collapsed: pendingState?.collapsed ?? defaultPluginState.collapsed,
    panelWidth: pendingState?.panelWidth ?? defaultPluginState.panelWidth,
    title: "Flowmaps.gl",
    // Bind optional host capabilities; each falls back to a no-op on hosts (or
    // standalone usage) that do not provide them.
    pickFiles: () => app.pickLocalDirectoryFiles?.() ?? Promise.resolve(null),
    registerNativeLayer: (layer) => app.registerExternalNativeLayer?.(layer),
    unregisterNativeLayer: (id) => app.unregisterExternalNativeLayer?.(id),
    fitBounds: (bounds) => app.fitBounds?.(bounds),
  });

  if (pendingState) {
    nextControl.setState(pendingState);
  }

  return nextControl;
}

function isPluginState(value: unknown): value is Partial<PluginState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if ("collapsed" in candidate && typeof candidate.collapsed !== "boolean") {
    return false;
  }
  if ("panelWidth" in candidate && typeof candidate.panelWidth !== "number") {
    return false;
  }
  if (
    "data" in candidate &&
    (typeof candidate.data !== "object" ||
      candidate.data === null ||
      Array.isArray(candidate.data))
  ) {
    return false;
  }
  if ("colorScheme" in candidate && !['Teal', 'Heatmap', 'Magenta', 'Ocean'].includes(candidate.colorScheme as string)) {
    return false;
  }
  if ("flowLineThicknessScale" in candidate && typeof candidate.flowLineThicknessScale !== "number") {
    return false;
  }
  if ("opacity" in candidate && typeof candidate.opacity !== "number") {
    return false;
  }
  if ("animationEnabled" in candidate && typeof candidate.animationEnabled !== "boolean") {
    return false;
  }

  return true;
}

export const plugin: GeoLibrePlugin<PluginControl> = {
  id: "geolibre-plugin-flowmaps",
  name: "Flowmaps.gl",
  version: "0.1.0",
  urlParameterNames: [PLUGIN_DATA_PARAM],
  activate(app) {
    control = control ?? createControl(app);
    const added = app.addMapControl(control, position);
    if (!added) {
      control = null;
      return false;
    }
    
    // deck.gl requires mercator projection
    previousProjection = app.getMapProjection?.() ?? null;
    app.setMapProjection?.("mercator");
    // Demonstrate the native plugin UI surfaces. Remove any you do not need
    // (and their imports) if your plugin only needs a map control. The right
    // panel opens immediately; the floating panel is registered and opened on
    // demand from the toolbar menu.
    disposeRightPanel = registerFlowmapRightPanel(app, control);
  },
  // Deep link: GeoLibre auto-activates this plugin when a URL carries a
  // parameter it owns and dispatches the parsed parameters here, e.g.
  // ?plugin-data=https://example.com/dataset.zip
  handleUrlParameters(_app, params) {
    if (control) return maybeHandleDeepLink(control, params);
  },
  deactivate(app) {
    disposeRightPanel?.();
    disposeRightPanel = null;
    if (previousProjection) {
      app.setMapProjection?.(previousProjection);
      previousProjection = null;
    }
    if (!control) return;
    pendingState = control.getState();
    app.removeMapControl(control);
    control = null;
  },
  getProjectState() {
    return control?.getState() ?? pendingState ?? undefined;
  },
  applyProjectState(_app, state) {
    if (!isPluginState(state)) return false;
    pendingState = state;
    control?.setState(state);
  },
};

export default plugin;
