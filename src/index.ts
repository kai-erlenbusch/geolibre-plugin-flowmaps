// Import styles
import './lib/styles/plugin-control.css';

// Main entry point - Core exports
export { PluginControl } from './lib/core/PluginControl';

// Type exports
export type {
  PluginControlOptions,
  PluginState,
  PluginControlEvent,
  PluginControlEventHandler,
} from './lib/core/types';

// GeoLibre host-plugin contract
export type {
  GeoLibreAppAPI,
  GeoLibrePlugin,
  GeoLibreControl,
  GeoLibreMapControlPosition,
  GeoLibreNativeLayerRegistration,
  GeoLibreNativeLayerStyle,
  GeoLibreFeatureCollection,
  GeoLibreRightPanelRegistration,
  GeoLibreToolbarMenu,
  GeoLibreToolbarMenuItem,
  GeoLibreToolbarMenuAction,
  GeoLibreToolbarSubmenu,
  GeoLibreToolbarSeparator,
  GeoLibreFloatingPanelRegistration,
} from './lib/geolibre/host-api';

// GeoLibre plugin UI surface demonstrations
export {
  RIGHT_PANEL_ID,
  registerTemplateRightPanel,
} from './lib/geolibre/right-panel';
export {
  FLOATING_PANEL_ID,
  registerTemplateFloatingPanel,
} from './lib/geolibre/floating-panel';
export {
  TOOLBAR_MENU_ID,
  registerTemplateToolbarMenu,
} from './lib/geolibre/toolbar-menu';

// Deep-linking helpers
export {
  PLUGIN_DATA_PARAM,
  getPluginDataValue,
  maybeHandleDeepLink,
} from './lib/utils/deep-link';
export type { DeepLinkConsumer } from './lib/utils/deep-link';

// Utility exports
export {
  clamp,
  formatNumericValue,
  generateId,
  debounce,
  throttle,
  classNames,
} from './lib/utils';
