import { IControl, Map as MapLibreMap, Popup } from 'maplibre-gl';
import type {
  PluginControlOptions,
  PluginState,
  PluginControlEvent,
  PluginControlEventHandler,
} from './types';
import { DEFAULT_PLUGIN_STATE } from './types';
import type { DeepLinkConsumer } from '../utils/deep-link';
import type { GeoLibreNativeLayerRegistration } from '../geolibre/host-api';
// @ts-ignore
import { MapboxOverlay } from '@deck.gl/mapbox';
// @ts-ignore
import { FlowmapLayer, PickingType } from '@flowmap.gl/layers';

import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { TimelineOverlay } from '../components/TimelineOverlay';

/**
 * Default options for the PluginControl.
 *
 * The host-capability callbacks default to safe no-ops so the control works as a
 * standalone MapLibre control. The GeoLibre wrapper (`src/geolibre.ts`) binds
 * them to the real host APIs when the plugin runs inside GeoLibre.
 */
const DEFAULT_OPTIONS: Required<PluginControlOptions> = {
  collapsed: true,
  position: 'top-right',
  title: 'Plugin Control',
  panelWidth: 300,
  className: '',
  pickFiles: () => Promise.resolve(null),
  registerNativeLayer: () => undefined,
  unregisterNativeLayer: () => undefined,
  fitBounds: undefined as any,
};

/**
 * Event handlers map type
 */
type EventHandlersMap = globalThis.Map<PluginControlEvent, Set<PluginControlEventHandler>>;

/**
 * A template MapLibre GL control that can be customized for various plugin needs.
 */
export class PluginControl implements IControl, DeepLinkConsumer {
  private _map?: MapLibreMap;
  private _mapContainer?: HTMLElement;
  private _container?: HTMLElement;
  private _panel?: HTMLElement;
  private _status?: HTMLElement;
  private _options: Required<PluginControlOptions>;
  private _state: PluginState;
  private _eventHandlers: EventHandlersMap = new globalThis.Map();

  private _registeredNativeLayerIds: string[] = [];

  private _resizeHandler: (() => void) | null = null;
  private _mapResizeHandler: (() => void) | null = null;
  private _clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  private _deckOverlay?: MapboxOverlay;
  private _popup?: Popup;

  private _timelineContainer?: HTMLElement;
  private _timelineRoot?: Root;

  constructor(options?: Partial<PluginControlOptions>) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._state = { 
      ...DEFAULT_PLUGIN_STATE,
      collapsed: this._options.collapsed 
    };
  }

  onAdd(map: MapLibreMap): HTMLElement {
    this._map = map;
    this._mapContainer = map.getContainer();
    this._container = this._createContainer();
    this._panel = this._createPanel();

    this._mapContainer.appendChild(this._panel);

    this._setupEventListeners();

    if (!this._state.collapsed) {
      this._panel.classList.add('expanded');
      requestAnimationFrame(() => {
        this._updatePanelPosition();
      });
    }

    this._deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: []
    });
    map.addControl(this._deckOverlay as unknown as IControl);

    this._popup = new Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'flowmap-tooltip'
    });

    this._timelineContainer = document.createElement('div');
    this._mapContainer.appendChild(this._timelineContainer);
    this._timelineRoot = createRoot(this._timelineContainer);

    this._updateFlowmapLayer();
    this._renderTimeline();

    return this._container;
  }

  onRemove(): void {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._mapResizeHandler && this._map) {
      this._map.off('resize', this._mapResizeHandler);
      this._mapResizeHandler = null;
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
      this._clickOutsideHandler = null;
    }

    this._clearNativeLayers();

    this._panel?.parentNode?.removeChild(this._panel);
    this._container?.parentNode?.removeChild(this._container);

    if (this._deckOverlay && this._map) {
      this._map.removeControl(this._deckOverlay as unknown as IControl);
    }
    
    if (this._popup) {
      this._popup.remove();
      this._popup = undefined;
    }

    this._map = undefined;
    this._mapContainer = undefined;
    this._container = undefined;
    this._panel = undefined;
    this._status = undefined;
    this._deckOverlay = undefined;
    
    if (this._timelineRoot) {
      this._timelineRoot.unmount();
      this._timelineRoot = undefined;
    }
    if (this._timelineContainer) {
      this._timelineContainer.parentNode?.removeChild(this._timelineContainer);
      this._timelineContainer = undefined;
    }
    
    this._eventHandlers.clear();
  }

  getState(): PluginState {
    return { ...this._state };
  }

  setState(newState: Partial<PluginState>): void {
    const dataChanged = newState.data !== undefined && newState.data !== this._state.data;
    
    this._state = { ...this._state, ...newState };
    this._emit('statechange');
    
    if (dataChanged && this._map && this._state.data) {
      this._fitToData();
    }
    
    this._updateFlowmapLayer();
    this._renderTimeline();
  }

  private _renderTimeline() {
    if (this._timelineContainer) {
      this._timelineContainer.style.display = 'block';
    }
    if (this._timelineRoot) {
      const dataKey = (this._state.data as any)?.loadedUrl || (this._state.data ? this._state.data.locations.length : "empty");
      this._timelineRoot.render(
        React.createElement(TimelineOverlay, {
          key: dataKey,
          state: this.getState(),
          updatePluginState: (updates: Partial<PluginState>) => this.setState(updates)
        })
      );
    }
  }

  private _fitToData() {
    const locations = (this._state.data as any)?.locations;
    if (!this._map || !locations || locations.length === 0) return;
    
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    
    for (const loc of locations) {
      const lng = Number(loc.lon);
      const lat = Number(loc.lat);
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    
    if (minLng < Infinity && maxLng > -Infinity && minLat < Infinity && maxLat > -Infinity) {
      try {
        if (this._options.fitBounds) {
          this._options.fitBounds([minLng, minLat, maxLng, maxLat]);
        } else if (this._map) {
          const centerLng = (minLng + maxLng) / 2;
          const centerLat = (minLat + maxLat) / 2;
          this._map.flyTo({
            center: [centerLng, centerLat],
            zoom: 6,
            duration: 2000
          });
        }
      } catch (err: any) {
        console.error("GeoLibre Flowmaps: Error flying to bounds:", err);
      }
    }
  }

  private _updateFlowmapLayer() {
    if (!this._deckOverlay) return;
    
    if (this._state.data && this._state.data.locations && this._state.data.flows) {
      const { data, ...config } = this._state;

      let filteredFlows = data.flows;
      if (config.volumeFilter || config.timeFilter) {
        filteredFlows = filteredFlows.filter((f: any) => {
          const passVolume = !config.volumeFilter || (f.count >= config.volumeFilter[0] && f.count <= config.volumeFilter[1]);
          const passTime = !config.timeFilter || (Number(f.time) >= config.timeFilter[0] && Number(f.time) <= config.timeFilter[1]);
          return passVolume && passTime;
        });
      }

      const layerProps = {
        id: 'flowmap-layer',
        data: { locations: data.locations, flows: filteredFlows },
        opacity: config.opacity,
        pickable: true,
        darkMode: config.darkMode,
        colorScheme: config.colorScheme,
        fadeAmount: config.fadeAmount,
        fadeEnabled: config.fadeEnabled,
        fadeOpacityEnabled: config.fadeOpacityEnabled,
        locationsEnabled: config.locationsEnabled,
        locationTotalsEnabled: config.locationTotalsEnabled,
        locationLabelsEnabled: config.locationLabelsEnabled,
        flowLinesRenderingMode: config.flowLinesRenderingMode,
        clusteringEnabled: config.clusteringEnabled,
        clusteringMethod: config.clusteringMethod,
        clusteringAuto: config.clusteringAuto,
        clusteringLevel: config.clusteringLevel,
        adaptiveScalesEnabled: config.adaptiveScalesEnabled,
        highlightColor: config.highlightColor,
        maxTopFlowsDisplayNum: config.maxTopFlowsDisplayNum,
        flowEndpointsInViewportMode: config.flowEndpointsInViewportMode,
        flowLineThicknessScale: config.flowLineThicknessScale,
        flowLineCurviness: config.flowLineCurviness,
        scaleLock: {enabled: config.scaleLockEnabled},
        getLocationId: (loc: any) => String(loc.id),
        getLocationLat: (loc: any) => Number(loc.lat),
        getLocationLon: (loc: any) => Number(loc.lon),
        getFlowOriginId: (flow: any) => String(flow.origin),
        getLocationName: (loc: any) => loc.name || String(loc.id),
        getFlowDestId: (flow: any) => String(flow.dest),
        getFlowMagnitude: (flow: any) => Number(flow.count ?? 1),
        onHover: (info: any) => this._onHover(info),
      };

      const layer = new FlowmapLayer(layerProps as any);
        
      this._deckOverlay.setProps({
        layers: [layer]
      });
      this._map?.triggerRepaint();
      this._setStatus(`Rendered ${data.locations.length} locs, ${data.flows.length} flows.`);
    } else {
      this._deckOverlay.setProps({ layers: [] });
      this._map?.triggerRepaint();
    }
  }

  private _onHover(info: any) {
    if (!this._map || !this._popup) return;

    if (!info) {
      this._popup.remove();
      return;
    }
    
    const {object} = info;
    if (!object) {
      this._popup.remove();
      return;
    }
    
    if (info.coordinate) {
      const container = document.createElement('div');
      container.style.padding = '4px';
      container.style.color = '#000';

      if (object.type === PickingType.LOCATION) {
        const title = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = object.name || object.id;
        title.appendChild(strong);
        container.appendChild(title);

        const inc = document.createElement('div');
        inc.textContent = `Incoming trips: ${object.totals?.incomingCount || 0}`;
        container.appendChild(inc);

        const out = document.createElement('div');
        out.textContent = `Outgoing trips: ${object.totals?.outgoingCount || 0}`;
        container.appendChild(out);

        const int = document.createElement('div');
        int.textContent = `Internal/round trips: ${object.totals?.internalCount || 0}`;
        container.appendChild(int);
      } else if (object.type === PickingType.FLOW) {
        const title = document.createElement('div');
        
        const orgStrong = document.createElement('strong');
        orgStrong.textContent = object.origin.id;
        
        const arrow = document.createTextNode(' \u2192 ');
        
        const destStrong = document.createElement('strong');
        destStrong.textContent = object.dest.id;
        
        title.appendChild(orgStrong);
        title.appendChild(arrow);
        title.appendChild(destStrong);
        container.appendChild(title);

        const vol = document.createElement('div');
        vol.textContent = `Volume: ${object.count}`;
        container.appendChild(vol);
      } else {
        container.textContent = 'Unknown object';
      }
      this._popup.setLngLat(info.coordinate).setDOMContent(container).addTo(this._map);
    }
  }

  toggle(): void {
    this._state.collapsed = !this._state.collapsed;

    if (this._panel) {
      if (this._state.collapsed) {
        this._panel.classList.remove('expanded');
        this._emit('collapse');
      } else {
        this._panel.classList.add('expanded');
        this._updatePanelPosition();
        this._emit('expand');
      }
    }

    this._emit('statechange');
  }

  expand(): void {
    if (this._state.collapsed) {
      this.toggle();
    }
  }

  collapse(): void {
    if (!this._state.collapsed) {
      this.toggle();
    }
  }

  on(event: PluginControlEvent, handler: PluginControlEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: PluginControlEvent, handler: PluginControlEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  getMap(): MapLibreMap | undefined {
    return this._map;
  }

  getContainer(): HTMLElement | undefined {
    return this._container;
  }

  async openFiles(): Promise<File[] | null> {
    try {
      const files = await this._options.pickFiles();
      if (!files || files.length === 0) {
        this._setStatus('No files selected.');
        return files;
      }
      this._setStatus(`Selected ${files.length} file(s).`);
      return files;
    } catch {
      this._setStatus('Unable to open folder.');
      return null;
    }
  }

  async loadFromUrl(value: string): Promise<void> {
    this.setState({ data: { ...this._state.data, loadedUrl: value } });
    this._setStatus(`Loaded: ${value}`);

    this._registerNativeLayer({
      id: 'plugin-template-data',
      name: 'Plugin data',
      nativeLayerIds: ['plugin-template-data-layer'],
      sourceIds: ['plugin-template-data-source'],
      opacity: 1,
      style: { circleRadius: 5, fillColor: '#2f7ed8' },
      metadata: { sourceUrl: value },
    });
  }

  private _registerNativeLayer(layer: GeoLibreNativeLayerRegistration): void {
    try {
      this._options.registerNativeLayer(layer);
      if (!this._registeredNativeLayerIds.includes(layer.id)) {
        this._registeredNativeLayerIds.push(layer.id);
      }
    } catch {
      this._setStatus('Failed to register native layer.');
    }
  }

  private _clearNativeLayers(): void {
    const ids = [...this._registeredNativeLayerIds];
    this._registeredNativeLayerIds = [];
    for (const id of ids) {
      try {
        this._options.unregisterNativeLayer(id);
      } catch {}
    }
  }

  private _setStatus(message: string): void {
    if (this._status) {
      this._status.textContent = message;
    }
  }

  private _emit(event: PluginControlEvent): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const eventData = { type: event, state: this.getState() };
      handlers.forEach((handler) => handler(eventData));
    }
  }

  private _createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = `maplibregl-ctrl maplibregl-ctrl-group plugin-control${
      this._options.className ? ` ${this._options.className}` : ''
    }`;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'plugin-control-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', this._options.title);
    toggleBtn.innerHTML = `
      <span class="plugin-control-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </span>
    `;
    toggleBtn.addEventListener('click', () => this.toggle());

    container.appendChild(toggleBtn);
    return container;
  }

  private _createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'plugin-control-panel';
    panel.style.width = `${this._options.panelWidth}px`;

    const header = document.createElement('div');
    header.className = 'plugin-control-header';

    const title = document.createElement('span');
    title.className = 'plugin-control-title';
    title.textContent = this._options.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'plugin-control-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => this.collapse());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'plugin-control-content';

    const placeholder = document.createElement('p');
    placeholder.className = 'plugin-control-placeholder';
    placeholder.textContent = 'Flowmaps controls are located in the right panel. Use the toolbar menu to open the panel if it is closed.';

    const actions = document.createElement('div');
    actions.className = 'plugin-control-actions';

    const openFolderBtn = document.createElement('button');
    openFolderBtn.type = 'button';
    openFolderBtn.className = 'plugin-control-action';
    openFolderBtn.textContent = 'Open folder…';
    openFolderBtn.addEventListener('click', () => {
      void this.openFiles();
    });

    actions.appendChild(openFolderBtn);

    const status = document.createElement('div');
    status.className = 'plugin-control-status';
    status.textContent = '';
    this._status = status;

    content.appendChild(placeholder);
    content.appendChild(actions);
    content.appendChild(status);

    panel.appendChild(header);
    panel.appendChild(content);

    return panel;
  }

  private _setupEventListeners(): void {
    this._clickOutsideHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        this._container &&
        this._panel &&
        !this._container.contains(target) &&
        !this._panel.contains(target)
      ) {
        this.collapse();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    this._resizeHandler = () => {
      if (!this._state.collapsed) {
        this._updatePanelPosition();
      }
    };
    window.addEventListener('resize', this._resizeHandler);
  }

  private _updatePanelPosition(): void {
    if (!this._container || !this._panel || !this._mapContainer) return;

    const btnRect = this._container.getBoundingClientRect();
    const mapRect = this._mapContainer.getBoundingClientRect();
    const panelRect = this._panel.getBoundingClientRect();

    const padding = 10;
    
    // Position relative to the map container, matching standard MapLibre control placement
    const btnTop = btnRect.top - mapRect.top;
    let top = btnTop;
    let left = 0;
    
    // Auto-detect horizontal placement based on the button position
    // If the button is on the right side of the map container, open panel to the left
    if (btnRect.left - mapRect.left > mapRect.width / 2) {
      left = btnRect.left - mapRect.left - this._options.panelWidth - padding;
    } else {
      // If the button is on the left side, open panel to the right
      left = btnRect.right - mapRect.left + padding;
    }

    if (top + panelRect.height > mapRect.height - padding) {
      top = mapRect.height - panelRect.height - padding;
    }

    this._panel.style.top = `${Math.max(padding, top)}px`;
    this._panel.style.left = `${Math.max(padding, left)}px`;
  }
}
