import { PluginControl } from "./lib/core/PluginControl";
import type { PluginState } from "./lib/core/types";
import { DEFAULT_PLUGIN_STATE, COLOR_SCHEMES } from "./lib/core/types";
import type { GeoLibreAppAPI, GeoLibreMapControlPosition } from "./lib/geolibre/host-api";
import { registerFlowmapRightPanel } from "./lib/geolibre/right-panel";
import { maybeHandleDeepLink } from "./lib/utils/deep-link";
import "./lib/styles/plugin-control.css";

type AppAPI = GeoLibreAppAPI<PluginControl>;

export class FlowmapsPluginHost {
  private control: PluginControl | null = null;
  private pendingState: Partial<PluginState> | null = null;
  private disposeRightPanel: (() => void) | null = null;
  private previousProjection: "globe" | "mercator" | null = null;

  private createControl(app: AppAPI): PluginControl {
    const defaultPluginState = DEFAULT_PLUGIN_STATE;
    const nextControl = new PluginControl({
      collapsed: this.pendingState?.collapsed ?? defaultPluginState.collapsed,
      panelWidth: this.pendingState?.panelWidth ?? defaultPluginState.panelWidth,
      title: "Flowmaps.gl",
      pickFiles: () => app.pickLocalDirectoryFiles?.() ?? Promise.resolve(null),
      registerNativeLayer: (layer) => app.registerExternalNativeLayer?.(layer),
      unregisterNativeLayer: (id) => app.unregisterExternalNativeLayer?.(id),
      fitBounds: (bounds) => app.fitBounds?.(bounds),
    });

    if (this.pendingState) {
      nextControl.setState(this.pendingState);
    }
    return nextControl;
  }

  activate(app: AppAPI, position: GeoLibreMapControlPosition = "top-right") {
    this.control = this.control ?? this.createControl(app);
    const added = app.addMapControl(this.control, position);
    if (!added) {
      this.control = null;
      return false;
    }
    
    this.previousProjection = app.getMapProjection?.() ?? null;
    app.setMapProjection?.("mercator");
    
    this.disposeRightPanel = registerFlowmapRightPanel(app, this.control);
  }

  handleUrlParameters(_app: AppAPI, params: URLSearchParams) {
    if (this.control) return maybeHandleDeepLink(this.control, params);
  }

  deactivate(app: AppAPI) {
    this.disposeRightPanel?.();
    this.disposeRightPanel = null;
    if (this.previousProjection) {
      app.setMapProjection?.(this.previousProjection);
      this.previousProjection = null;
    }
    if (!this.control) return;
    this.pendingState = this.control.getState();
    app.removeMapControl(this.control);
    this.control = null;
  }

  getProjectState() {
    return this.control?.getState() ?? this.pendingState ?? undefined;
  }

  applyProjectState(_app: AppAPI, state: any) {
    if (!this.isPluginState(state)) return false;
    this.pendingState = state;
    this.control?.setState(state);
  }

  private isPluginState(value: unknown): value is Partial<PluginState> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as Record<string, unknown>;
    if ("collapsed" in candidate && typeof candidate.collapsed !== "boolean") return false;
    if ("panelWidth" in candidate && typeof candidate.panelWidth !== "number") return false;
    if ("data" in candidate && (typeof candidate.data !== "object" || candidate.data === null || Array.isArray(candidate.data))) return false;
    if ("colorScheme" in candidate && !COLOR_SCHEMES.includes(candidate.colorScheme as any)) return false;
    if ("flowLineThicknessScale" in candidate && typeof candidate.flowLineThicknessScale !== "number") return false;
    if ("opacity" in candidate && typeof candidate.opacity !== "number") return false;
    if ("animationEnabled" in candidate && typeof candidate.animationEnabled !== "boolean") return false;
    return true;
  }
}
