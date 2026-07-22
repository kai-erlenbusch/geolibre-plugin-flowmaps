import maplibregl from 'maplibre-gl';
import { PluginControl } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import Papa from 'papaparse';

// Create map
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/positron',
  center: [0, 0],
  zoom: 2,
});

// Add navigation controls to top-right
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Add fullscreen control to top-right (after navigation)
map.addControl(new maplibregl.FullscreenControl(), 'top-right');

// Add plugin control when map loads
map.on('load', () => {
  // Create the plugin control with custom options
  // Set collapsed: true to start with just the 29x29 button (like navigation control)
  const pluginControl = new PluginControl({
    title: 'Flowmaps',
    collapsed: false,
    panelWidth: 300,
    fitBounds: (bounds) => {
      map.fitBounds(bounds, { padding: 50, duration: 1000 });
    }
  });

  // Add control to the map
  map.addControl(pluginControl, 'top-right');

  const locationsUrl = 'https://raw.githubusercontent.com/FlowmapBlue/flowmap.gl-data/main/BIXI-rides/output/locations.csv';
  const flowsUrl = 'https://raw.githubusercontent.com/FlowmapBlue/flowmap.gl-data/main/BIXI-rides/output/flows-2021-10.csv';

  // Load sample BIXI Montreal data automatically
  Promise.all([
    fetch(locationsUrl).then(r => r.text()),
    fetch(flowsUrl).then(r => r.text())
  ]).then(([locationsCsv, flowsCsv]) => {
    const locations = Papa.parse(locationsCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
    const flows = Papa.parse(flowsCsv, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

    const processedFlows = flows.map((f: any) => ({
      ...f,
      time: f.time ? new Date(f.time).getTime() : undefined
    }));

    pluginControl.setState({ 
      data: { 
        locations: locations as any, 
        flows: processedFlows as any
      },
      // Give a nice initial configuration for the BIXI dataset
      opacity: 0.8,
      fadeAmount: 20,
      colorScheme: 'Teal',
      flowLinesRenderingMode: 'lines',
      locationsEnabled: true,
      locationLabelsEnabled: false
    });
  }).catch(err => {
    console.error('Failed to load BIXI dataset:', err);
  });

  // Add Globe control to the map
  map.addControl(new maplibregl.GlobeControl(), 'top-right');

  // Listen for state changes
  pluginControl.on('statechange', (event) => {
    console.log('Plugin state changed:', event.state);
  });

  pluginControl.on('collapse', () => {
    console.log('Plugin panel collapsed');
  });

  pluginControl.on('expand', () => {
    console.log('Plugin panel expanded');
  });

  console.log('Plugin control added to map');
});
