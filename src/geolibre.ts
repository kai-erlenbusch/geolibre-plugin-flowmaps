import type {
  GeoLibreAppAPI,
  GeoLibrePlugin,
} from "./lib/geolibre/host-api";
import { PLUGIN_DATA_PARAM } from "./lib/utils/deep-link";

let pluginInstance: any = null;

export const plugin: GeoLibrePlugin<any> = {
  id: "geolibre-plugin-flowmaps",
  name: "Flowmaps.gl",
  version: "0.1.0",
  urlParameterNames: [PLUGIN_DATA_PARAM],
  async activate(app) {
    if (!pluginInstance) {
      const { FlowmapsPluginHost } = await import("./host-impl");
      pluginInstance = new FlowmapsPluginHost();
    }
    await pluginInstance.activate(app);
  },
  handleUrlParameters(app, params) {
    if (pluginInstance) pluginInstance.handleUrlParameters(app, params);
  },
  deactivate(app) {
    if (pluginInstance) {
      pluginInstance.deactivate(app);
    }
  },
  getProjectState() {
    return pluginInstance?.getProjectState() ?? undefined;
  },
  applyProjectState(app, state) {
    if (pluginInstance) {
      pluginInstance.applyProjectState(app, state);
    }
  },
};

export default plugin;
