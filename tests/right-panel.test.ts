import { describe, it, expect, vi } from "vitest";
import type {
  GeoLibreAppAPI,
  GeoLibreControl,
  GeoLibreRightPanelRegistration,
} from "../src/lib/geolibre/host-api";
import {
  RIGHT_PANEL_ID,
  registerFlowmapRightPanel,
} from "../src/lib/geolibre/right-panel";
import { DEFAULT_PLUGIN_STATE } from "../src/lib/core/types";

/**
 * Minimal stub of the host API. Captures the right-panel registration so the
 * test can drive its `render` callback the way GeoLibre would.
 */
function createApp(withRightPanel = true) {
  let registered: GeoLibreRightPanelRegistration | null = null;
  const unregister = vi.fn();
  const app: GeoLibreAppAPI<GeoLibreControl> = {
    addMapControl: () => true,
    removeMapControl: () => undefined,
  };

  if (withRightPanel) {
    app.registerRightPanel = (panel) => {
      registered = panel;
      return unregister;
    };
    app.openRightPanel = vi.fn(() => true);
    app.closeRightPanel = vi.fn();
  }

  return {
    app,
    unregister,
    getRegistered: () => registered,
  };
}

describe("registerFlowmapRightPanel", () => {
  const mockControl = {
    getState: () => ({ ...DEFAULT_PLUGIN_STATE, data: { flows: [], locations: [] } }),
    on: vi.fn(),
    off: vi.fn(),
    setState: vi.fn()
  } as any;

  it("registers and opens the panel, and renders into the container", () => {
    const { app, getRegistered } = createApp();

    const dispose = registerFlowmapRightPanel(app, mockControl);
    expect(dispose).toBeTypeOf("function");

    const panel = getRegistered();
    expect(panel?.id).toBe(RIGHT_PANEL_ID);
    expect(app.openRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);

    const container = document.createElement("div");
    const cleanup = panel?.render(container);

    // The returned cleanup removes the plugin's own DOM.
    expect(cleanup).toBeTypeOf("function");
    (cleanup as () => void)();
    expect(container.querySelector("h2")).toBeNull();
  });

  it("closes and unregisters the panel when disposed", () => {
    const { app, unregister } = createApp();
    const dispose = registerFlowmapRightPanel(app, mockControl);

    dispose?.();
    expect(app.closeRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);
    expect(unregister).toHaveBeenCalledOnce();
  });

  it("returns null when the host has no right sidebar", () => {
    const { app } = createApp(false);
    expect(registerFlowmapRightPanel(app, mockControl)).toBeNull();
  });
});
