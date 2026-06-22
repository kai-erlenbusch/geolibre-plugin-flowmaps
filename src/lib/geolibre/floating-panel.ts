import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";

/**
 * Demonstration of the GeoLibre floating panel host API.
 *
 * A floating panel is a draggable, closeable card the host overlays on the
 * map's top-left corner. Unlike the right-sidebar panel (a single docked
 * workspace), several floating panels can be open at once and they do not
 * shrink the map. The render contract is the same plain-DOM `render(container)`
 * as the right panel.
 *
 * Self-contained so it is easy to copy, adapt, or delete. It is registered (but
 * not opened) from the plugin's `activate` hook; the template's toolbar menu
 * opens it on demand (see `./toolbar-menu.ts`).
 */

/** Stable id for this plugin's floating panel. Replace with your own. */
export const FLOATING_PANEL_ID = "geolibre-plugin-template-tools";

/**
 * Register the template's floating panel.
 *
 * @param app - The GeoLibre host API passed to the plugin's `activate` hook.
 * @returns A disposer that unregisters (and closes) the panel, or `null` when
 *   the host does not provide floating panels.
 */
export function registerTemplateFloatingPanel<TControl extends GeoLibreControl>(
  app: GeoLibreAppAPI<TControl>,
): (() => void) | null {
  if (!app.registerFloatingPanel) return null;

  return app.registerFloatingPanel({
    id: FLOATING_PANEL_ID,
    title: "Floating Tools",
    defaultWidth: 280,
    render(container) {
      const wrap = document.createElement("div");
      wrap.className = "geolibre-plugin-floating-panel";

      const heading = document.createElement("h2");
      heading.textContent = "Floating Tools";

      const body = document.createElement("p");
      body.textContent =
        "A draggable card over the map, rendered by the plugin through " +
        "app.registerFloatingPanel(). Open it with app.openFloatingPanel() " +
        "and close it with app.closeFloatingPanel().";

      wrap.append(heading, body);
      container.appendChild(wrap);

      return () => {
        wrap.remove();
      };
    },
  });
}
