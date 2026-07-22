import maplibregl from 'maplibre-gl';
import { PluginControl } from '../../src/index';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  });

  // Add control to the map
  map.addControl(pluginControl, 'top-right');

  // Load sample flowmap data automatically so there is a live demo
  const sampleData = {
    locations: [
      { id: '1', name: 'New York', lat: 40.7128, lon: -74.0060 },
      { id: '2', name: 'London', lat: 51.5074, lon: -0.1278 },
      { id: '3', name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
      { id: '4', name: 'Sydney', lat: -33.8688, lon: 151.2093 }
    ],
    flows: [
      { origin: '1', dest: '2', count: 2500, time: 1000 },
      { origin: '2', dest: '3', count: 1800, time: 2000 },
      { origin: '3', dest: '1', count: 1200, time: 3000 },
      { origin: '4', dest: '1', count: 3000, time: 4000 },
      { origin: '2', dest: '4', count: 900, time: 5000 }
    ]
  };

  setTimeout(() => {
    pluginControl.setState({ data: sampleData });
  }, 1000);

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
