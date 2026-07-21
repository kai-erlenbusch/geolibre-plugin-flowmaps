import type { Map } from 'maplibre-gl';
import type { GeoLibreNativeLayerRegistration } from '../geolibre/host-api';

/**
 * Options for configuring the PluginControl
 */
export interface PluginControlOptions {
  /**
   * Whether the control panel should start collapsed (showing only the toggle button)
   * @default true
   */
  collapsed?: boolean;

  /**
   * Position of the control on the map
   * @default 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Title displayed in the control header
   * @default 'Plugin Control'
   */
  title?: string;

  /**
   * Width of the control panel in pixels
   * @default 300
   */
  panelWidth?: number;

  /**
   * Custom CSS class name for the control container
   */
  className?: string;

  /**
   * Host-provided directory picker (for example, GeoLibre Desktop). Resolves
   * with the selected files, or `null` when the user cancels or no host picker
   * is available. The GeoLibre wrapper binds this to
   * `app.pickLocalDirectoryFiles`; defaults to a no-op returning `null`.
   */
  pickFiles?: () => Promise<File[] | null>;

  /**
   * Host callback to register a native MapLibre layer that GeoLibre owns and
   * renders on the plugin's behalf. Bound by the GeoLibre wrapper to
   * `app.registerExternalNativeLayer`; defaults to a no-op so the control also
   * works as a standalone MapLibre control.
   */
  registerNativeLayer?: (layer: GeoLibreNativeLayerRegistration) => void;

  /**
   * Host callback to remove a native layer previously registered with
   * {@link PluginControlOptions.registerNativeLayer}. Bound by the GeoLibre
   * wrapper to `app.unregisterExternalNativeLayer`; defaults to a no-op.
   */
  unregisterNativeLayer?: (id: string) => void;

  /**
   * Host callback to fit the map bounds.
   */
  fitBounds?: (bounds: [number, number, number, number]) => void;
}

/**
 * Internal state of the plugin control
 */
export interface PluginState {
  /**
   * Whether the control panel is currently collapsed
   */
  collapsed: boolean;

  /**
   * Current panel width in pixels
   */
  panelWidth: number;

  /**
   * Any custom state data (holds flowmap raw data)
   */
  data?: any;

  colorScheme: string;
  highlightColor: string;
  
  // UI configurations
  darkMode: boolean;
  flowLineThicknessScale: number;
  adaptiveScalesEnabled: boolean;
  locationsEnabled: boolean;
  locationTotalsEnabled: boolean;
  locationLabelsEnabled: boolean;
  flowEndpointsInViewportMode: string;
  maxTopFlowsDisplayNum: number;
  volumeFilter?: [number, number];
  timeFilter?: [number, number];
  flowLinesRenderingMode: string;
  flowLineCurviness: number;
  scaleLockEnabled: boolean;
  opacity: number;
  fadeEnabled: boolean;
  fadeOpacityEnabled: boolean;
  fadeAmount: number;
  clusteringEnabled: boolean;
  clusteringMethod: string;
  clusteringAuto: boolean;
  clusteringLevel: number;
  
  // v8 back-compat features
  animationEnabled: boolean;
}

export const DEFAULT_PLUGIN_STATE: PluginState = {
  collapsed: false,
  panelWidth: 320,
  data: undefined,
  colorScheme: 'Teal',
  highlightColor: '#ff9b29',
  darkMode: false,
  flowLineThicknessScale: 1,
  adaptiveScalesEnabled: false,
  locationsEnabled: true,
  locationTotalsEnabled: true,
  locationLabelsEnabled: false,
  flowEndpointsInViewportMode: 'any',
  maxTopFlowsDisplayNum: 5000,
  flowLinesRenderingMode: 'lines',
  flowLineCurviness: 0.25,
  scaleLockEnabled: false,
  opacity: 1,
  fadeEnabled: false,
  fadeOpacityEnabled: false,
  fadeAmount: 50,
  clusteringEnabled: false,
  clusteringMethod: 'HCA',
  clusteringAuto: false,
  clusteringLevel: 5,
  animationEnabled: false,
};

/**
 * Props for the React wrapper component
 */
export interface PluginControlReactProps extends PluginControlOptions {
  /**
   * MapLibre GL map instance
   */
  map: Map;

  /**
   * Callback fired when the control state changes
   */
  onStateChange?: (state: PluginState) => void;
}

/**
 * Event types emitted by the plugin control
 */
export type PluginControlEvent = 'collapse' | 'expand' | 'statechange';

/**
 * Event handler function type
 */
export type PluginControlEventHandler = (event: { type: PluginControlEvent; state: PluginState }) => void;
