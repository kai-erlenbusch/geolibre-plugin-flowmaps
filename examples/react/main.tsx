import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl, { Map } from 'maplibre-gl';
import { PluginControlReact, usePluginState } from '../../src/react';
import '../../src/index.css';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Main App component demonstrating the React integration
 */
function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [pluginControl, setPluginControl] = useState<any>(null);

  // Initialize the map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [0, 0],
      zoom: 2,
    });

    // Add navigation controls to top-right
    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.addControl(new maplibregl.FullscreenControl(), 'top-right');

    mapInstance.on('load', () => {
      setMap(mapInstance);
      
      import('../../src/lib/core/PluginControl').then(({ PluginControl }) => {
        const control = new PluginControl({ 
          collapsed: true,
          fitBounds: (bbox) => {
            mapInstance.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 50, maxZoom: 11 });
          }
        });
        mapInstance.addControl(control, 'top-right');
        setPluginControl(control);
      });
    });

    return () => {
      mapInstance.remove();
    };
  }, []);

  // Dynamically import the panel
  const [FlowmapConfigPanel, setFlowmapConfigPanel] = useState<any>(null);
  useEffect(() => {
    import('../../src/lib/geolibre/right-panel').then((mod) => {
      setFlowmapConfigPanel(() => mod.FlowmapConfigPanel);
    });
  }, []);

  // Detect system theme for the test harness sidebar
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'row' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      </div>
      
      {/* Plugin control panel sidebar */}
      <div style={{ 
        width: 350, 
        height: '100%', 
        backgroundColor: isDark ? '#111' : '#f9fafb', 
        color: isDark ? '#fff' : '#111827',
        borderLeft: isDark ? '1px solid #333' : '1px solid #e5e7eb',
        overflowY: 'auto'
      }}>
        {pluginControl && FlowmapConfigPanel ? (
          <div style={{ padding: '20px' }}>
            <FlowmapConfigPanel control={pluginControl} />
          </div>
        ) : (
          <div style={{ padding: '20px', color: '#888' }}>Loading panel...</div>
        )}
      </div>
    </div>
  );
}

// Mount the app
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
