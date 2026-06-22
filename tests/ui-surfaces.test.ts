import { describe, it, expect, vi } from "vitest";
import type {
  GeoLibreAppAPI,
  GeoLibreControl,
  GeoLibreToolbarMenu,
} from "../src/lib/geolibre/host-api";
import {
  FLOATING_PANEL_ID,
  registerTemplateFloatingPanel,
} from "../src/lib/geolibre/floating-panel";
import {
  TOOLBAR_MENU_ID,
  registerTemplateToolbarMenu,
} from "../src/lib/geolibre/toolbar-menu";
import { RIGHT_PANEL_ID } from "../src/lib/geolibre/right-panel";

function createApp(overrides: Partial<GeoLibreAppAPI<GeoLibreControl>> = {}) {
  const app: GeoLibreAppAPI<GeoLibreControl> = {
    addMapControl: () => true,
    removeMapControl: () => undefined,
    registerFloatingPanel: vi.fn(() => vi.fn()),
    registerToolbarMenu: vi.fn(() => vi.fn()),
    openRightPanel: vi.fn(() => true),
    openFloatingPanel: vi.fn(() => true),
    closeRightPanel: vi.fn(),
    closeFloatingPanel: vi.fn(),
    ...overrides,
  };
  return app;
}

describe("registerTemplateFloatingPanel", () => {
  it("registers the floating panel and renders into the container", () => {
    let registered:
      | Parameters<NonNullable<GeoLibreAppAPI["registerFloatingPanel"]>>[0]
      | null = null;
    const app = createApp({
      registerFloatingPanel: (panel) => {
        registered = panel;
        return vi.fn();
      },
    });

    const dispose = registerTemplateFloatingPanel(app);
    expect(dispose).toBeTypeOf("function");
    expect(registered?.id).toBe(FLOATING_PANEL_ID);

    const container = document.createElement("div");
    const cleanup = registered?.render(container);
    expect(container.querySelector("h2")?.textContent).toBe("Floating Tools");
    (cleanup as () => void)();
    expect(container.querySelector("h2")).toBeNull();
  });

  it("returns null when the host has no floating panels", () => {
    const app = createApp({ registerFloatingPanel: undefined });
    expect(registerTemplateFloatingPanel(app)).toBeNull();
  });
});

describe("registerTemplateToolbarMenu", () => {
  function findAction(menu: GeoLibreToolbarMenu, id: string) {
    for (const item of menu.items) {
      if ("id" in item && item.id === id && item.type !== "submenu") return item;
      if (item.type === "submenu") {
        const nested = item.items.find(
          (child) => "id" in child && child.id === id,
        );
        if (nested) return nested;
      }
    }
    return undefined;
  }

  it("registers a menu whose items open the plugin's panels", () => {
    let menu: GeoLibreToolbarMenu | null = null;
    const app = createApp({
      registerToolbarMenu: (registered) => {
        menu = registered;
        return vi.fn();
      },
    });

    const dispose = registerTemplateToolbarMenu(app);
    expect(dispose).toBeTypeOf("function");
    expect(menu?.id).toBe(TOOLBAR_MENU_ID);

    const openRight = findAction(menu!, "open-right");
    const openFloating = findAction(menu!, "open-floating");
    expect(openRight && "onSelect" in openRight).toBe(true);

    (openRight as { onSelect: () => void }).onSelect();
    expect(app.openRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);

    (openFloating as { onSelect: () => void }).onSelect();
    expect(app.openFloatingPanel).toHaveBeenCalledWith(FLOATING_PANEL_ID);

    const closePanels = findAction(menu!, "close-panels");
    (closePanels as { onSelect: () => void }).onSelect();
    expect(app.closeRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);
    expect(app.closeFloatingPanel).toHaveBeenCalledWith(FLOATING_PANEL_ID);
  });

  it("returns null when the host has no toolbar", () => {
    const app = createApp({ registerToolbarMenu: undefined });
    expect(registerTemplateToolbarMenu(app)).toBeNull();
  });
});
